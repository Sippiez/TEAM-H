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
      yield { version: 1, type: "delta", text: "Bonjour " };
      await gate;
      yield { version: 1, type: "delta", text: "Qu\u00e9bec" };
    })();
  });
  const history = Array.from({ length: 20 }, () => ({ role: "user", text: "x".repeat(1100) }));
  const response = await POST(request({ ...message, history }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/event-stream; charset=utf-8");
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(input.history.length, 12);
  assert.equal(input.history[0].text.length, 1000);
  assert.equal(input.language, "fr");
  assert.equal(input.selectedFieldId, field.id);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const firstFrame = decoder.decode((await reader.read()).value);
  assert.match(firstFrame, /"type":"delta"/);
  assert.match(firstFrame, /Bonjour /);
  release();
  const secondFrame = decoder.decode((await reader.read()).value);
  assert.match(secondFrame, /Qu\u00e9bec/);
  const completeFrame = decoder.decode((await reader.read()).value);
  assert.match(completeFrame, /"type":"complete","complete":true/);
  assert.equal((await reader.read()).done, true);
  assert.equal(timers.size, 0);
});

test("provider startup, lazy iterator, and empty-stream failures return 502", async (t) => {
  const cases = [
    async () => { throw new Error("private-provider-details"); },
    async () => (async function* () { throw new Error("private-provider-details"); })(),
    async () => (async function* () {})(),
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

test("midstream failure is sent as an incomplete typed event", async () => {
  const { POST, timers } = setupRoute(async () => (async function* () {
    yield { version: 1, type: "delta", text: "Partial" };
    throw new Error("private-provider-details");
  })());
  const response = await POST(request(message));
  const body = await response.text();
  assert.match(body, /"type":"error","code":"interrupted"/);
  assert.match(body, /"type":"complete","complete":false/);
  assert.doesNotMatch(body, /private-provider-details/);
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
    yield { version: 1, type: "delta", text: "Partial" };
    await new Promise(() => {});
  })());
  const response = await POST(request(message));
  const reader = response.body.getReader();
  await reader.read();
  const pending = reader.read();
  for (const expire of timers.values()) expire();
  const interrupted = new TextDecoder().decode((await pending).value);
  assert.match(interrupted, /"type":"error","code":"unavailable"/);
  assert.equal(timers.size, 0);
});

test("browser cancellation propagates both before and after the first token", async () => {
  let signal;
  const { POST, timers } = setupRoute(async (input) => {
    signal = input.signal;
    return (async function* () {
      yield { version: 1, type: "delta", text: "First" };
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

function setupGemini({
  env = { GEMINI_API_KEY: "test-only" },
  functionArgs = null,
  functionCalls = null,
  finalChunks = [{ text: "verified [source:live-source-id]" }],
} = {}) {
  const calls = [];
  const officialHosts = loadModule("../src/lib/official/hosts.ts", {});
  const officialCatalog = loadModule("../src/lib/official/catalog.ts", {
    "./hosts": officialHosts,
  });
  const { streamGeminiChat } = loadModule("../src/lib/ai/gemini.ts", {
    "server-only": {},
    "@google/genai": {
      ThinkingLevel: { LOW: "LOW" },
      FunctionCallingConfigMode: { ANY: "ANY" },
      GoogleGenAI: class {
        models = {
          generateContent: async (input) => {
            calls.push({ kind: "planner", ...input });
            return functionCalls !== null
              ? { functionCalls }
              : functionArgs === null
                ? { functionCalls: [] }
                : { functionCalls: [{ name: "lookup_official_information", args: functionArgs }] };
          },
          generateContentStream: async (input) => {
            calls.push({ kind: "stream", ...input });
            return (async function* () {
              for (const chunk of finalChunks) yield chunk;
            })();
          },
        };
      },
    },
    "@/lib/official/catalog": officialCatalog,
    "@/lib/official/lookup": {
      lookupOfficialInformation: async () => assert.fail("Injected lookup must be used"),
    },
  }, { process: { env } });
  return { streamGeminiChat, calls };
}

async function collect(stream) {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
}

test("metadata-only Gemini prompt bounds context and excludes PDF bytes and field values", async () => {
  const { streamGeminiChat, calls } = setupGemini({
    env: { GEMINI_API_KEY: "test-only", GEMINI_MODEL: "configured-model" },
  });
  const fields = Array.from({ length: 251 }, (_, i) => ({
    ...field, id: `field-${i}`, label: "\u0000" + "L".repeat(300),
    options: Array(40).fill("O".repeat(300)), value: "private-field-value",
  }));
  const signal = new AbortController().signal;
  const stream = await streamGeminiChat({
    message: "What should I enter in this field?", language: "fr", selectedFieldId: "field-250", signal,
    form: { ...form, fields, pdfBytes: "private-pdf-bytes" },
    history: Array(20).fill({ role: "user", text: "H".repeat(1500) }),
  });
  const events = await collect(stream);
  const call = calls.find((item) => item.kind === "stream");
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
  assert.deepEqual(
    events.map(({ version, type, text }) => ({ version, type, text })),
    [{ version: 1, type: "delta", text: "verified [source:live-source-id]" }],
  );
});

test("overview remains metadata-only and missing Gemini configuration remains explicit", async () => {
  const { streamGeminiChat, calls } = setupGemini();
  const stream = await streamGeminiChat({ intent: "overview", form, language: "en" });
  await collect(stream);
  const call = calls.find((item) => item.kind === "stream");
  assert.equal(call.model, "gemini-3.1-flash-lite");
  assert.match(call.contents, /"document":/);
  assert.match(call.config.systemInstruction, /Answer in English/);
  assert.match(call.contents, /Give a concise overview/);
  await assert.rejects(
    setupGemini({ env: {} }).streamGeminiChat({ message: "Help", language: "en" }),
    /not configured/,
  );
});

test("a Gemini 2.5 override uses its supported nonzero thinking budget", async () => {
  const { streamGeminiChat, calls } = setupGemini({
    env: { GEMINI_API_KEY: "test-only", GEMINI_MODEL: "gemini-2.5-flash" },
  });
  const stream = await streamGeminiChat({
    message: "What should I enter in this field?",
    selectedFieldId: field.id,
    form,
    language: "en",
  });
  await collect(stream);
  const call = calls.find((item) => item.kind === "stream");
  assert.equal(call.config.thinkingConfig.thinkingBudget, 512);
  assert.equal(call.config.thinkingConfig.thinkingLevel, undefined);
});

test("official synthesis requires one bounded function call and only verified evidence", async () => {
  const functionArgs = {
    serviceId: "health_card",
    jurisdiction: "on",
    facetId: "steps",
    language: "en",
  };
  const source = {
    id: "live-source-id",
    title: "Ontario health card",
    url: "https://www.ontario.ca/page/health-card",
    department: "Ontario",
    description: "",
    tags: [],
    language: "en-CA",
    jurisdiction: "on",
    facetId: "steps",
    provenance: { kind: "live_official", retrievedAt: "2026-10-29T18:00:00.000Z" },
    evidence: "Use the official online application process.",
  };
  const { streamGeminiChat, calls } = setupGemini({
    functionArgs,
    finalChunks: [
      { text: "Apply using the current instructions [source:live-" },
      { text: "source-id]. [source:forged-id] https://forged.example/" },
    ],
  });
  const stream = await streamGeminiChat({
    message: "How do I apply for a health card in Ontario? PRIVATE-CANARY",
    language: "en",
    history: [{ role: "assistant", text: "STALE-ANSWER-CANARY" }],
    lookup: async (args) => {
      assert.deepEqual(JSON.parse(JSON.stringify(args)), functionArgs);
      return {
        outcome: { status: "verified", reason: "none", partial: false, jurisdiction: "on" },
        sources: [source],
      };
    },
  });
  const events = await collect(stream);
  const planner = calls.find((item) => item.kind === "planner");
  const final = calls.find((item) => item.kind === "stream");
  assert.equal(planner.config.toolConfig.functionCallingConfig.mode, "ANY");
  assert.deepEqual(Array.from(planner.config.toolConfig.functionCallingConfig.allowedFunctionNames), [
    "lookup_official_information",
  ]);
  assert.equal(planner.config.tools[0].functionDeclarations.length, 1);
  assert.equal(planner.config.tools[0].functionDeclarations[0].parametersJsonSchema.additionalProperties, false);
  assert.doesNotMatch(final.contents, /STALE-ANSWER-CANARY|https:\/\/www\.ontario\.ca/);
  assert.match(final.contents, /Use the official online application process/);
  const lookupEvent = events.find((event) => event.type === "lookup");
  assert.equal(lookupEvent.sources[0].evidence, undefined);
  assert.equal(lookupEvent.sources[0].url, source.url);
  const answer = events.filter((event) => event.type === "delta").map((event) => event.text).join("");
  assert.match(answer, /\[source:live-source-id\]/);
  assert.doesNotMatch(answer, /forged-id|https?:\/\//);
});

test("unavailable lookup has no free-form current-facts fallback", async () => {
  const { streamGeminiChat, calls } = setupGemini({ functionArgs: {
    serviceId: "health_card",
    jurisdiction: "on",
    facetId: "overview",
    language: "en",
  } });
  const stream = await streamGeminiChat({
    message: "How do I get a health card in Ontario?",
    language: "en",
    lookup: async () => ({
      outcome: { status: "unavailable", reason: "provider_not_configured", partial: false },
      sources: [],
    }),
  });
  const events = await collect(stream);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "lookup");
  assert.equal(calls.filter((item) => item.kind === "stream").length, 0);
});

test("selected-field wording cannot bypass current-instructions lookup", async (t) => {
  for (const [language, messageText] of [
    ["en", "What should I enter in income according to current federal income tax instructions?"],
    ["en", "Explain this field. What are the current federal passport fees?"],
    ["fr", "Explique ce champ. Quels sont les frais actuels du passeport fédéral?"],
  ]) {
    await t.test(messageText, async () => {
      const { streamGeminiChat, calls } = setupGemini();
      let lookups = 0;
      const stream = await streamGeminiChat({
        message: messageText,
        selectedFieldId: field.id,
        form,
        language,
        lookup: async () => {
          lookups += 1;
          return {
            outcome: { status: "clarification_required", reason: "invalid_selection", partial: false },
            sources: [],
          };
        },
      });
      const events = await collect(stream);
      assert.equal(lookups, 1);
      assert.equal(calls.filter((call) => call.kind === "planner").length, 1);
      assert.equal(calls.filter((call) => call.kind === "stream").length, 0);
      assert.equal(events[0].type, "lookup");
    });
  }
});

test("plain field-meaning questions remain metadata-only in both languages", async (t) => {
  for (const [language, messageText] of [
    ["en", "What does this field mean?"],
    ["fr", "Que signifie ce champ ?"],
  ]) {
    await t.test(language, async () => {
      const { streamGeminiChat, calls } = setupGemini();
      const stream = await streamGeminiChat({
        message: messageText,
        selectedFieldId: field.id,
        form,
        language,
        lookup: async () => assert.fail("A plain field-meaning question needs no live lookup"),
      });
      await collect(stream);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].kind, "stream");
      assert.match(calls[0].contents, /FORM_CONTEXT/);
    });
  }
});

test("planner selections require explicit service, facet, and jurisdiction; repeated calls are rejected", async (t) => {
  const valid = {
    name: "lookup_official_information",
    args: { serviceId: "health_card", jurisdiction: "on", facetId: "steps", language: "en" },
  };
  for (const [label, messageText, functionCalls] of [
    ["missing jurisdiction", "How do I apply for a health card?", [valid]],
    ["missing service", "How do I apply in Ontario?", [valid]],
    ["ambiguous facet", "How do I apply and what fees are there for a health card in Ontario?", [valid]],
    ["repeated call", "How do I apply for a health card in Ontario?", [valid, valid]],
  ]) {
    await t.test(label, async () => {
      let dispatched;
      const { streamGeminiChat } = setupGemini({ functionCalls });
      const stream = await streamGeminiChat({
        message: messageText,
        language: "en",
        lookup: async (args) => {
          dispatched = args;
          return {
            outcome: { status: "clarification_required", reason: "invalid_selection", partial: false },
            sources: [],
          };
        },
      });
      const events = await collect(stream);
      assert.equal(dispatched, null);
      assert.equal(events[0].outcome.status, "clarification_required");
    });
  }
});
