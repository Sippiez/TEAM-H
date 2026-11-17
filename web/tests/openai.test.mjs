import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function setup({ env = { OPENAI_API_KEY: "test-key" }, fetch: fetchImpl } = {}) {
  const calls = [];
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const exports = {};
    cache.set(path, exports);
    vm.runInNewContext(outputText, {
      exports, Error, DOMException, AbortController, TextDecoder,
      process: { env },
      fetch: async (url, init) => {
        calls.push({ url, ...init, body: JSON.parse(init.body) });
        assert.ok(fetchImpl, "Unexpected provider call");
        return fetchImpl(url, init);
      },
      require(name) {
        if (name === "server-only") return {};
        if (name === "@google/genai") return {
          ThinkingLevel: { LOW: "LOW" },
          FunctionCallingConfigMode: { ANY: "ANY" },
          GoogleGenAI: class { constructor() { assert.fail("OpenAI must not call Gemini"); } },
        };
        if (name === "@/lib/official/lookup") return {
          lookupOfficialWithSerper() { assert.fail("Unexpected official lookup"); },
        };
        if (name.startsWith(".")) return load(posix.join(posix.dirname(path), name));
        if (name.startsWith("@/")) return load(name.slice(2));
        assert.fail(`Unexpected import: ${name}`);
      },
    }, { filename: path });
    return exports;
  }
  return { load, calls };
}

function completed(text = "Bonjour") {
  return {
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  };
}

function sse(events, { split = false, keepOpen = false, onCancel } = {}) {
  const bytes = new TextEncoder().encode(events.map((event) =>
    `event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`,
  ).join(""));
  let offset = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        if (!keepOpen) controller.close();
        return;
      }
      const end = split ? offset + 1 : bytes.length;
      controller.enqueue(bytes.slice(offset, end));
      offset = end;
    },
    cancel() { onCancel?.(); },
  }));
}

const field = {
  id: "f1", label: "Name", type: "text", page: 1, section: "Applicant",
  context: { status: "resolved", source: "layout", question: "Full legal name", instructions: [] },
};

test("provider selection defaults to OpenAI Luna, supports overrides, and never falls back to another vendor's key", () => {
  const defaults = setup().load("lib/ai/config");
  assert.deepEqual(JSON.parse(JSON.stringify(defaults.getAIConfig())), {
    provider: "openai", model: "gpt-6-luna", apiKey: "test-key",
  });
  assert.equal(defaults.isAIConfigured(), true);
  assert.equal(setup({ env: { OPENAI_MODEL: "another-model" } }).load("lib/ai/config").getAIConfig().model, "another-model");
  assert.equal(setup({ env: { GEMINI_API_KEY: "only-google" } }).load("lib/ai/config").isAIConfigured(), false);
  assert.equal(setup({ env: { OPENAI_API_KEY: "  " } }).load("lib/ai/config").isAIConfigured(), false);
  const gemini = setup({ env: { AI_PROVIDER: "gemini", GEMINI_API_KEY: "google", OPENAI_API_KEY: "openai" } }).load("lib/ai/config");
  assert.equal(gemini.getAIConfig().model, "gemini-3.1-flash-lite");
  assert.equal(gemini.getAIConfig().apiKey, "google");
  assert.equal(gemini.isAIConfigured(), true);
  assert.equal(setup({ env: { AI_PROVIDER: "gemini", OPENAI_API_KEY: "openai" } }).load("lib/ai/config").isAIConfigured(), false);
  const invalid = setup({ env: { AI_PROVIDER: "invalid", OPENAI_API_KEY: "openai" } }).load("lib/ai/config");
  assert.equal(invalid.isAIConfigured(), false);
  assert.throws(() => invalid.getAIConfig(), /AI_PROVIDER/);
});

test("default chat streams OpenAI UTF-8 SSE across arbitrary byte boundaries with the request signal", async () => {
  const signal = new AbortController().signal;
  const { load, calls } = setup({
    fetch: async () => sse([
      { type: "response.created" },
      { type: "response.output_text.delta", delta: "Prénom " },
      { type: "response.output_text.delta", delta: "légal." },
      { type: "response.completed", response: completed("Prénom légal.") },
    ], { split: true }),
  });
  const stream = await load("lib/ai/gemini").streamGeminiChat({
    intent: "field", message: "Explain the selected field", language: "fr",
    form: { pageCount: 1, fields: [field] }, selectedFieldId: field.id, signal,
  });
  const events = await Array.fromAsync(stream);
  assert.deepEqual(events.map((event) => event.text), ["Prénom ", "légal."]);
  const call = calls[0];
  assert.equal(calls.length, 1);
  assert.equal(call.url, "https://api.openai.com/v1/responses");
  assert.equal(call.headers.Authorization, "Bearer test-key");
  assert.equal(call.redirect, "error");
  assert.equal(call.signal, signal);
  assert.equal(call.body.model, "gpt-6-luna");
  assert.equal(call.body.stream, true);
  assert.equal(call.body.store, false);
  assert.equal(call.body.reasoning.effort, "low");
  assert.match(call.body.input, /Full legal name/);
  assert.match(call.body.instructions, /French/);
  assert.equal(call.body.tools, undefined);
});

test("OpenAI explanations and associations use strict JSON schemas and preserve existing parsing", async () => {
  const explanation = {
    meaning: "Your full name.", whatToEnter: "Enter your legal name.",
    formatExample: "", whereToFind: "", keyPoints: { title: "", items: [] }, commonMistakes: [],
  };
  const association = {
    status: "resolved", questionBlockIds: ["q"], instructionBlockIds: [], optionBlockIds: [],
  };
  const { load, calls } = setup({
    env: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "custom-openai-model" },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      return Response.json(completed(JSON.stringify(body.text.format.schema.properties.meaning ? explanation : association)));
    },
  });
  const ai = load("lib/ai/gemini");
  const signal = new AbortController().signal;
  const result = await ai.generateGeminiFieldExplanation({
    field, language: "en", curated: { grounded: false }, signal,
  });
  assert.equal(result.meaning, explanation.meaning);
  const associated = await ai.associateFieldContext({
    page: 1, type: "text",
    candidates: {
      blocks: [{ id: "q", text: "Full legal name", rect: [0, 0, 50, 20], value: "PRIVATE" }],
      widgets: [],
    },
  }, signal);
  assert.equal(associated.questionBlockIds[0], "q");
  for (const call of calls) {
    assert.equal(call.body.model, "custom-openai-model");
    assert.equal(call.body.text.format.type, "json_schema");
    assert.equal(call.body.text.format.strict, true);
    assert.equal(call.body.text.format.schema.additionalProperties, false);
    assert.equal(call.body.stream, false);
    assert.equal(call.signal, signal);
    assert.doesNotMatch(call.body.input, /PRIVATE/);
  }
});

test("OpenAI lookup planning requires exactly the allowlisted function and parses its arguments", async () => {
  const args = { serviceId: "unknown", jurisdiction: "unknown", facetId: "unknown", language: "en" };
  const { load, calls } = setup({
    fetch: async () => Response.json({
      status: "completed",
      output: [{ type: "function_call", name: "lookup_official_information", arguments: JSON.stringify(args) }],
    }),
  });
  const stream = await load("lib/ai/gemini").streamGeminiChat({
    message: "Can you help me?", language: "en", signal: new AbortController().signal,
  });
  await Array.fromAsync(stream);
  assert.equal(calls.length, 1);
  const { body } = calls[0];
  assert.deepEqual(body.tool_choice, { type: "function", name: "lookup_official_information" });
  assert.equal(body.parallel_tool_calls, false);
  assert.equal(body.tools.length, 1);
  assert.equal(body.tools[0].strict, true);
  assert.equal(body.tools[0].parameters.additionalProperties, false);
  const parsed = await load("lib/ai/openai").createOpenAIClient("test-key").models.generateContent({
    model: "test", contents: "test",
  });
  assert.equal(parsed.functionCalls[0].name, "lookup_official_information");
  assert.deepEqual(JSON.parse(JSON.stringify(parsed.functionCalls[0].args)), args);
});

test("OpenAI HTTP failures, refusals, malformed function arguments and incomplete generations fail explicitly", async (t) => {
  const responses = [
    () => new Response("PRIVATE PROVIDER ERROR", { status: 401 }),
    () => Response.json({ status: "incomplete", output: [] }),
    () => Response.json({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }] }),
    () => Response.json({ status: "completed", output: [{ type: "function_call", name: "tool", arguments: "[]" }] }),
    () => Response.json({ status: "completed", output: [{ type: "function_call", name: "tool", arguments: "not JSON" }] }),
  ];
  for (const response of responses) {
    await t.test("provider failure", async () => {
      const { load } = setup({ fetch: async () => response() });
      const client = load("lib/ai/openai").createOpenAIClient("test-key");
      await assert.rejects(client.models.generateContent({ model: "test", contents: "test" }), (error) => {
        assert.doesNotMatch(error.message, /PRIVATE PROVIDER ERROR/);
        return true;
      });
    });
  }
});

test("OpenAI streaming rejects truncation and failed terminal events, preserving partial output", async (t) => {
  for (const terminal of [
    null,
    { type: "response.failed" },
    { type: "response.incomplete" },
    { type: "response.refusal.delta", delta: "No" },
    { type: "response.completed", response: { status: "incomplete", output: [] } },
  ]) {
    await t.test(terminal?.type ?? "truncated", async () => {
      const { load } = setup({
        fetch: async () => sse([
          { type: "response.output_text.delta", delta: "Partial" },
          ...(terminal ? [terminal] : []),
        ]),
      });
      const client = load("lib/ai/openai").createOpenAIClient("test-key");
      const stream = await client.models.generateContentStream({ model: "test", contents: "test" });
      assert.equal((await stream.next()).value.text, "Partial");
      await assert.rejects(stream.next());
    });
  }
});

test("cancelling consumption releases the OpenAI response and aborting reaches fetch", async () => {
  let cancelled = false;
  const { load } = setup({
    fetch: async () => sse([{ type: "response.output_text.delta", delta: "Partial" }], {
      keepOpen: true,
      onCancel: () => { cancelled = true; },
    }),
  });
  const stream = await load("lib/ai/openai").createOpenAIClient("test").models.generateContentStream({
    model: "test", contents: "test",
  });
  await stream.next();
  await stream.return();
  assert.equal(cancelled, true);

  const controller = new AbortController();
  const aborting = setup({
    fetch: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }),
  });
  const pending = aborting.load("lib/ai/openai").createOpenAIClient("test").models.generateContent({
    model: "test", contents: "test", config: { abortSignal: controller.signal },
  });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
