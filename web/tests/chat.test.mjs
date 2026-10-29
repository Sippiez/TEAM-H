import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Use the existing compiler and Node runner; isolate SDK calls and credentials.
function loadModule(path, imports, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
    Error, DOMException, AbortController, ReadableStream, TextEncoder,
    Response, setTimeout, clearTimeout,
    ...globals,
  }, { filename: path });
  return exports;
}

function setupRoute(streamGeminiChat, env = { GEMINI_API_KEY: "test-only" }) {
  const timers = new Map();
  const logs = [];
  const route = loadModule("../src/app/api/chat/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/ai/gemini": { streamGeminiChat },
  }, {
    process: { env },
    console: { error: (...args) => logs.push(args) },
    setTimeout(callback, delay) {
      assert.equal(delay, 30_000);
      const id = Symbol();
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  return { ...route, timers, logs };
}

function request(body, signal) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

const field = {
  id: "field-1", path: "form.name", page: 1, type: "text",
  label: "Name", section: "Applicant",
};
const form = { pageCount: 1, fields: [field], fileName: "sample.pdf" };
const message = { message: "Explain the selected field", language: "fr", form, selectedFieldId: field.id };

test("malformed requests fail before contacting the provider", async (t) => {
  const { POST } = setupRoute(() => assert.fail("Provider should not be called"));
  const invalid = [
    null, [], "hello", 42, true, {}, { message: 1 }, { message: "\u0000 " },
    { message: "a", language: "de" }, { message: "a", intent: "unknown" },
    { intent: "overview" }, { message: "a", selectedFieldId: "orphan" },
    { ...message, selectedFieldId: "missing" },
    { ...message, form: { ...form, fields: [{ ...field, page: 2 }] } },
    { ...message, form: { ...form, fields: [{ ...field, type: "unknown" }] } },
  ];
  for (const body of invalid) {
    await t.test(JSON.stringify(body), async () => {
      assert.equal((await POST(request(body))).status, 400);
    });
  }
  assert.equal((await POST(request({ message: "x".repeat(1001) }))).status, 413);
  assert.equal((await POST(new Request("http://localhost/api/chat", {
    method: "POST", body: "{",
  }))).status, 400);
});

test("missing key returns a retryable 503 without leaking configuration", async () => {
  const { POST } = setupRoute(() => assert.fail("Provider should not be called"), {});
  const response = await POST(request(message));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "The AI service is not configured" });
});

test("text is streamed incrementally with bounded history and selected context", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let input;
  const { POST, timers } = setupRoute(async (value) => {
    input = value;
    return (async function* () {
      yield {};
      yield { text: "Bonjour " };
      await gate;
      yield { text: "Qu\u00e9bec" };
    })();
  });
  const history = Array.from({ length: 20 }, () => ({ role: "user", text: "x".repeat(1100) }));
  const response = await POST(request({ ...message, history }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/plain; charset=utf-8");
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(input.history.length, 12);
  assert.equal(input.history[0].text.length, 1000);
  assert.equal(input.language, "fr");
  assert.equal(input.selectedFieldId, field.id);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  assert.equal(decoder.decode((await reader.read()).value), "Bonjour ");
  release();
  assert.equal(decoder.decode((await reader.read()).value), "Qu\u00e9bec");
  assert.equal((await reader.read()).done, true);
  assert.equal(timers.size, 0);
});

test("provider startup, lazy iterator, and empty-stream failures return 502", async (t) => {
  const cases = [
    async () => { throw new Error("private-provider-details"); },
    async () => (async function* () { throw new Error("private-provider-details"); })(),
    async () => (async function* () { yield {}; })(),
  ];
  for (const provider of cases) {
    await t.test("upstream failure", async () => {
      const { POST, timers, logs } = setupRoute(provider);
      const response = await POST(request(message));
      assert.equal(response.status, 502);
      assert.doesNotMatch(await response.text(), /private-provider-details/);
      assert.doesNotMatch(JSON.stringify(logs), /private-provider-details/);
      assert.equal(timers.size, 0);
    });
  }
});

test("midstream failure errors the body rather than returning a successful partial answer", async () => {
  const { POST, timers } = setupRoute(async () => (async function* () {
    yield { text: "Partial" };
    throw new Error("private-provider-details");
  })());
  const response = await POST(request(message));
  await assert.rejects(response.text(), /response was interrupted/);
  assert.equal(timers.size, 0);
});

test("timeout covers provider startup and a stalled first iterator read", async (t) => {
  for (const stage of ["startup", "first read"]) {
    await t.test(stage, async () => {
      let signal;
      let started;
      const ready = new Promise((resolve) => { started = resolve; });
      const { POST, timers } = setupRoute(async (input) => {
        signal = input.signal;
        if (stage === "startup") {
          started();
          return new Promise(() => {});
        }
        return (async function* () {
          started();
          await new Promise(() => {});
        })();
      });
      const pending = POST(request(message));
      await ready;
      for (const expire of timers.values()) expire();
      const response = await pending;
      assert.equal(response.status, 504);
      assert.equal(signal.aborted, true);
      assert.equal(timers.size, 0);
    });
  }
});

test("timeout interrupts an already-started response", async () => {
  const { POST, timers } = setupRoute(async () => (async function* () {
    yield { text: "Partial" };
    await new Promise(() => {});
  })());
  const response = await POST(request(message));
  const reader = response.body.getReader();
  await reader.read();
  const pending = reader.read();
  for (const expire of timers.values()) expire();
  await assert.rejects(pending, /response was interrupted/);
  assert.equal(timers.size, 0);
});

test("browser cancellation propagates both before and after the first token", async () => {
  let signal;
  const { POST, timers } = setupRoute(async (input) => {
    signal = input.signal;
    return (async function* () {
      yield { text: "First" };
      await new Promise(() => {});
    })();
  });
  const response = await POST(request(message));
  await response.body.cancel();
  assert.equal(signal.aborted, true);
  assert.equal(timers.size, 0);

  const controller = new AbortController();
  controller.abort();
  const cancelled = await POST(request(message, controller.signal));
  assert.equal(cancelled.status, 499);
});

function setupGemini(env = { GEMINI_API_KEY: "test-only" }) {
  const calls = [];
  const { streamGeminiChat } = loadModule("../src/lib/ai/gemini.ts", {
    "server-only": {},
    "@google/genai": {
      ThinkingLevel: { LOW: "LOW" },
      GoogleGenAI: class {
        models = {
          generateContentStream: async (input) => { calls.push(input); return []; },
        };
      },
    },
  }, { process: { env } });
  return { streamGeminiChat, calls };
}

test("Gemini prompt bounds metadata and history and excludes PDF bytes and field values", async () => {
  const { streamGeminiChat, calls } = setupGemini({
    GEMINI_API_KEY: "test-only", GEMINI_MODEL: "configured-model",
  });
  const fields = Array.from({ length: 251 }, (_, i) => ({
    ...field, id: `field-${i}`, label: "\u0000" + "L".repeat(300),
    options: Array(40).fill("O".repeat(300)), value: "private-field-value",
  }));
  const signal = new AbortController().signal;
  await streamGeminiChat({
    message: " Explain ", language: "fr", selectedFieldId: "field-250", signal,
    form: { ...form, fields, pdfBytes: "private-pdf-bytes" },
    history: Array(20).fill({ role: "user", text: "H".repeat(1500) }),
  });
  const call = calls[0];
  assert.equal(call.model, "configured-model");
  assert.equal(call.config.abortSignal, signal);
  assert.equal(call.config.thinkingConfig.thinkingLevel, "LOW");
  assert.equal(call.config.maxOutputTokens, 2048);
  assert.match(call.config.systemInstruction, /Answer in French/);
  assert.match(call.config.systemInstruction, /untrusted data/);
  assert.match(call.config.systemInstruction, /field label alone establishes its meaning, not official instructions/);
  assert.doesNotMatch(call.contents, /private-field-value|private-pdf-bytes|\u0000/);
  const context = JSON.parse(call.contents.split("FORM_CONTEXT:\n")[1].split("\n\nRECENT_CONVERSATION:")[0]);
  assert.equal(context.fields.length, 250);
  assert.equal(context.fieldsTruncated, true);
  assert.equal(context.selectedField.id, "field-250");
  assert.equal(context.selectedField.label.length, 200);
  assert.equal(context.selectedField.options.length, 30);
  assert.equal(context.selectedField.options[0].length, 200);
  assert.equal((call.contents.match(/USER:\n/g) ?? []).length, 12);
  assert.equal((call.contents.match(/H/g) ?? []).length, 12000);
});

test("navigator, overview, default model, and missing-key behavior", async () => {
  const { streamGeminiChat, calls } = setupGemini();
  await streamGeminiChat({ message: "Help", language: "en" });
  assert.equal(calls[0].model, "gemini-3.1-flash-lite");
  assert.match(calls[0].contents, /"document":null/);
  assert.match(calls[0].config.systemInstruction, /Answer in English/);
  await streamGeminiChat({ intent: "overview", form, language: "en" });
  assert.match(calls[1].contents, /Give a concise overview/);
  await assert.rejects(setupGemini({}).streamGeminiChat({ message: "Help", language: "en" }), /not configured/);
});

test("a Gemini 2.5 override uses its supported nonzero thinking budget", async () => {
  const { streamGeminiChat, calls } = setupGemini({
    GEMINI_API_KEY: "test-only", GEMINI_MODEL: "gemini-2.5-flash",
  });
  await streamGeminiChat({ message: "Help", language: "en" });
  assert.equal(calls[0].config.thinkingConfig.thinkingBudget, 512);
  assert.equal(calls[0].config.thinkingConfig.thinkingLevel, undefined);
});
