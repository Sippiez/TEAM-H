import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function setup({
  env = { OPENAI_API_KEY: "test-key" }, fetch: fetchImpl,
  routing = "official_lookup", gemini, now,
} = {}) {
  const calls = [];
  const routeCalls = [];
  const geminiCalls = [];
  const logs = [];
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
      Date: now ? class extends Date { static now() { return now(); } } : Date,
      console: { info: (...args) => logs.push(args) },
      process: { env },
      fetch: async (url, init) => {
        const body = JSON.parse(init.body);
        if (routing !== null && body.text?.format.schema.properties.mode) {
          routeCalls.push({ url, ...init, body });
          return Response.json(completed(JSON.stringify({
            mode: routing,
            question: JSON.parse(body.input).message,
          })));
        }
        calls.push({ url, ...init, body });
        assert.ok(fetchImpl, "Unexpected provider call");
        return fetchImpl(url, init);
      },
      require(name) {
        if (name === "server-only") return {};
        if (name === "@google/genai") return {
          ThinkingLevel: { LOW: "LOW" },
          FunctionCallingConfigMode: { ANY: "ANY" },
          GoogleGenAI: class {
            constructor({ apiKey }) {
              const invoke = async (params, stream) => {
                geminiCalls.push({ apiKey, stream, ...params });
                assert.ok(gemini, "OpenAI must not call Gemini");
                return gemini(params, stream);
              };
              this.models = {
                generateContent: (params) => invoke(params, false),
                generateContentStream: (params) => invoke(params, true),
              };
            }
          },
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
  return { load, calls, routeCalls, geminiCalls, logs };
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

const fallbackEnv = {
  OPENAI_API_KEY: "test-key", AI_FALLBACK_PROVIDER: "gemini", GEMINI_API_KEY: "google-key",
};
const explanation = {
  meaning: "Your full name.", whatToEnter: "Enter your legal name.",
  formatExample: "", whereToFind: "", keyPoints: { title: "", items: [] }, commonMistakes: [],
};
function explain(load, signal = new AbortController().signal) {
  return load("lib/ai/gemini").generateGeminiFieldExplanation({
    field, language: "en", curated: { grounded: false }, signal,
  });
}

test("enabling fallback leaves successful OpenAI requests on the primary provider", async () => {
  const { load, calls, geminiCalls } = setup({
    env: { ...fallbackEnv },
    fetch: async () => Response.json(completed(JSON.stringify(explanation))),
  });
  assert.equal((await explain(load)).meaning, explanation.meaning);
  assert.equal(calls.length, 1);
  assert.equal(geminiCalls.length, 0);
});

test("opted-in field explanations recover from a real OpenAI HTTP 429 using Gemini", async () => {
  const { load, calls, geminiCalls } = setup({
    env: { ...fallbackEnv },
    fetch: async () => new Response("PRIVATE QUOTA ERROR", { status: 429 }),
    gemini: async () => ({ text: JSON.stringify(explanation) }),
  });
  const signal = new AbortController().signal;
  assert.equal((await explain(load, signal)).meaning, explanation.meaning);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.model, "gpt-6-luna");
  assert.equal(geminiCalls.length, 1);
  assert.equal(geminiCalls[0].model, "gemini-3.1-flash-lite");
  assert.equal(geminiCalls[0].config.abortSignal, signal);
  assert.equal(geminiCalls[0].config.thinkingConfig.thinkingLevel, "LOW");
  assert.equal(load("lib/ai/config").getAIConfig().provider, "openai");
});

test("fallback preserves field-context evidence, prompts, schemas, budgets and signal using the Gemini model", async () => {
  const association = {
    status: "resolved", questionBlockIds: ["q"], instructionBlockIds: [], optionBlockIds: [],
  };
  const { load, calls, geminiCalls } = setup({
    env: { ...fallbackEnv, GEMINI_MODEL: "gemini-2.5-flash", OPENAI_MODEL: "custom-primary" },
    fetch: async () => new Response(null, { status: 429 }),
    gemini: async (params) => ({
      text: JSON.stringify(params.config.responseJsonSchema.properties.meaning ? explanation : association),
    }),
  });
  const signal = new AbortController().signal;
  await explain(load, signal);
  const associated = await load("lib/ai/gemini").associateFieldContext({
    page: 1, type: "text",
    candidates: {
      blocks: [{ id: "q", text: "Full legal name", rect: [0, 0, 50, 20], value: "PRIVATE_VALUE" }],
      widgets: [],
    },
  }, signal);
  assert.equal(associated.questionBlockIds[0], "q");
  assert.equal(calls.length, 2);
  assert.equal(geminiCalls.length, 2);
  for (const [index, call] of geminiCalls.entries()) {
    assert.equal(call.model, "gemini-2.5-flash");
    assert.equal(calls[index].body.model, "custom-primary");
    assert.equal(call.contents, calls[index].body.input);
    assert.doesNotMatch(call.contents, /PRIVATE_VALUE/);
    assert.equal(call.config.systemInstruction, calls[index].body.instructions);
    assert.deepEqual(JSON.parse(JSON.stringify(call.config.responseJsonSchema)), calls[index].body.text.format.schema);
    assert.equal(call.config.responseMimeType, "application/json");
    assert.equal(call.config.maxOutputTokens, index === 0 ? 1_024 : 2_048);
    assert.equal(call.config.abortSignal, signal);
    assert.deepEqual(JSON.parse(JSON.stringify(call.config.thinkingConfig)), { thinkingBudget: 512 });
  }
});

test("routing HTTP 429 falls back to structured Gemini routing and streams chat during cooldown", async () => {
  const signal = new AbortController().signal;
  const { load, calls, geminiCalls } = setup({
    env: { ...fallbackEnv }, routing: null,
    fetch: async () => new Response(null, { status: 429, headers: { "Retry-After": "60" } }),
    gemini: async (params, stream) => stream
      ? (async function* () { yield { text: "A general explanation." }; })()
      : { text: JSON.stringify({ mode: "conversation", question: "What is a guarantor?" }) },
  });
  const events = await Array.fromAsync(await load("lib/ai/gemini").streamGeminiChat({
    message: "What is a guarantor?", language: "en", signal,
  }));
  assert.deepEqual(events.map((event) => event.text), ["A general explanation."]);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].body.text.format.schema.properties.mode);
  assert.deepEqual(geminiCalls.map((call) => call.stream), [false, true]);
  assert.equal(geminiCalls[0].config.maxOutputTokens, 512);
  assert.equal(geminiCalls[0].contents, calls[0].body.input);
  for (const call of geminiCalls) {
    assert.equal(call.model, "gemini-3.1-flash-lite");
    assert.equal(call.config.abortSignal, signal);
  }
});

test("chat recovers a lazy OpenAI streaming HTTP 429 before its first chunk", async () => {
  const { load, calls, routeCalls, geminiCalls } = setup({
    env: { ...fallbackEnv }, routing: "conversation",
    fetch: async () => new Response(null, { status: 429 }),
    gemini: async (_params, stream) => {
      assert.equal(stream, true);
      return (async function* () { yield { text: "Fallback " }; yield { text: "answer." }; })();
    },
  });
  const events = await Array.fromAsync(await load("lib/ai/gemini").streamGeminiChat({
    message: "Explain the concept", language: "en",
  }));
  assert.deepEqual(events.map((event) => event.text), ["Fallback ", "answer."]);
  assert.equal(routeCalls.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.stream, true);
  assert.equal(geminiCalls.length, 1);
  assert.equal(geminiCalls[0].contents, calls[0].body.input);
  assert.equal(geminiCalls[0].config.maxOutputTokens, 2_048);
});

test("lookup-planner HTTP 429 retains the forced allowlisted tool on Gemini", async () => {
  const { load, calls, geminiCalls } = setup({
    env: { ...fallbackEnv },
    fetch: async () => new Response(null, { status: 429 }),
    gemini: async () => ({
      functionCalls: [{
        name: "lookup_official_information",
        args: { serviceId: "unknown", jurisdiction: "unknown", facetId: "unknown", language: "en" },
      }],
    }),
  });
  const events = await Array.fromAsync(await load("lib/ai/gemini").streamGeminiChat({
    message: "Can you help me?", language: "en",
  }));
  assert.ok(events.some((event) => event.type === "lookup" && event.outcome.status === "clarification_required"));
  assert.equal(calls.length, 1);
  assert.equal(geminiCalls.length, 1);
  const params = geminiCalls[0];
  assert.equal(params.config.maxOutputTokens, 256);
  assert.equal(params.config.toolConfig.functionCallingConfig.allowedFunctionNames[0], "lookup_official_information");
  assert.equal(params.config.tools[0].functionDeclarations[0].name, "lookup_official_information");
  assert.deepEqual(
    JSON.parse(JSON.stringify(params.config.tools[0].functionDeclarations[0].parametersJsonSchema)),
    calls[0].body.tools[0].parameters,
  );
});

test("fallback requires explicit valid configuration, not merely a Gemini key", async () => {
  const disabled = setup({
    env: { OPENAI_API_KEY: "test-key", GEMINI_API_KEY: "google-key" },
    fetch: async () => new Response(null, { status: 429 }),
    gemini: async () => ({ text: JSON.stringify(explanation) }),
  });
  await assert.rejects(explain(disabled.load), /HTTP 429/);
  assert.equal(disabled.geminiCalls.length, 0);
  for (const [env, message] of [
    [{ ...fallbackEnv, AI_FALLBACK_PROVIDER: "other" }, /AI_FALLBACK_PROVIDER/],
    [{ ...fallbackEnv, AI_FALLBACK_PROVIDER: "" }, /AI_FALLBACK_PROVIDER/],
    [{ ...fallbackEnv, GEMINI_API_KEY: " " }, /GEMINI_API_KEY/],
    [{ ...fallbackEnv, AI_PROVIDER: "gemini" }, /AI_PROVIDER=openai/],
  ]) {
    const config = setup({ env }).load("lib/ai/config");
    assert.throws(() => config.getAIConfig(), message);
    assert.equal(config.isAIConfigured(), false);
  }
});

test("opt-in does not mask authentication, server, malformed, incomplete or refused primary output", async (t) => {
  for (const [name, response] of [
    ["authentication", () => new Response("PRIVATE AUTH ERROR", { status: 401 })],
    ["server failure", () => new Response(null, { status: 503 })],
    ["invalid response JSON", () => new Response("not JSON")],
    ["invalid structured output", () => Response.json(completed("not JSON"))],
    ["incomplete generation", () => Response.json({ status: "incomplete", output: [] })],
    ["refusal", () => Response.json({
      status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "No" }] }],
    })],
  ]) {
    await t.test(name, async () => {
      const { load, calls, geminiCalls } = setup({
        env: { ...fallbackEnv }, fetch: async () => response(),
        gemini: async () => ({ text: JSON.stringify(explanation) }),
      });
      await assert.rejects(explain(load));
      assert.equal(calls.length, 1);
      assert.equal(geminiCalls.length, 0);
    });
  }
});

test("client cancellation never starts fallback, including a 429 racing an abort", async (t) => {
  for (const responseAfterAbort of [false, true]) {
    await t.test(responseAfterAbort ? "429 after abort" : "AbortError", async () => {
      const controller = new AbortController();
      const { load, geminiCalls } = setup({
        env: { ...fallbackEnv },
        fetch: async () => {
          controller.abort();
          if (responseAfterAbort) return new Response(null, { status: 429 });
          throw new DOMException("Aborted", "AbortError");
        },
        gemini: async () => ({ text: JSON.stringify(explanation) }),
      });
      await assert.rejects(explain(load, controller.signal));
      assert.equal(geminiCalls.length, 0);
    });
  }
});

test("a primary stream cannot switch providers after a chunk escapes, even for a typed 429", async () => {
  const { load, geminiCalls } = setup({
    env: { ...fallbackEnv }, routing: "conversation",
    fetch: async () => {
      let first = true;
      return new Response(new ReadableStream({
        pull(controller) {
          if (first) {
            first = false;
            controller.enqueue(new TextEncoder().encode(
              'data: {"type":"response.output_text.delta","delta":"Primary partial"}\n\n',
            ));
          } else {
            controller.error(new (load("lib/ai/openai").OpenAIRequestError)(429));
          }
        },
      }, { highWaterMark: 0 }));
    },
    gemini: async () => assert.fail("Cannot splice providers"),
  });
  const stream = await load("lib/ai/gemini").streamGeminiChat({ message: "Explain", language: "en" });
  assert.equal((await stream.next()).value.text, "Primary partial");
  await assert.rejects(stream.next(), /HTTP 429/);
  assert.equal(geminiCalls.length, 0);
});

test("Gemini fallback failures propagate once and its actual provider is logged without private data", async () => {
  const failure = new Error("PRIVATE GEMINI ERROR");
  const { load, calls, geminiCalls, logs } = setup({
    env: { ...fallbackEnv, NODE_ENV: "development" },
    fetch: async () => new Response("PRIVATE QUOTA ERROR", { status: 429 }),
    gemini: async () => { throw failure; },
  });
  await assert.rejects(explain(load), (error) => error === failure);
  assert.equal(calls.length, 1);
  assert.equal(geminiCalls.length, 1);
  assert.ok(logs.some(([prefix, event]) => prefix === "[gemini]" &&
    event.event === "start" && event.fallbackReason === "openai_http_429" &&
    event.model === "gemini-3.1-flash-lite"));
  assert.ok(logs.some(([prefix, event]) => prefix === "[gemini]" && event.event === "error"));
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE|Full legal name|test-key|google-key|Your full name/);
});

test("Retry-After seconds and HTTP dates bypass exhausted OpenAI until expiry without sleeping", async (t) => {
  for (const header of ["60", "Wed, 01 Jan 2031 00:01:00 GMT"]) {
    await t.test(header, async () => {
      let now = Date.parse("2031-01-01T00:00:00Z");
      const { load, calls, geminiCalls, logs } = setup({
        env: { ...fallbackEnv, NODE_ENV: "development" }, now: () => now,
        fetch: async () => new Response(null, { status: 429, headers: { "Retry-After": header } }),
        gemini: async () => ({ text: JSON.stringify(explanation) }),
      });
      await explain(load);
      now += 59_999;
      await explain(load);
      assert.equal(calls.length, 1);
      assert.equal(geminiCalls.length, 2);
      assert.ok(logs.some(([prefix, event]) => prefix === "[gemini]" &&
        event.fallbackReason === "openai_cooldown"));
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(explain(load, controller.signal), { name: "AbortError" });
      assert.equal(calls.length, 1);
      assert.equal(geminiCalls.length, 2);
      now += 1;
      await explain(load);
      assert.equal(calls.length, 2);
    });
  }
});

test("missing, invalid, nonfinite and past Retry-After values do not create a cooldown", async () => {
  for (const header of [null, "-1", "1.5", "99999999999999999999999", "nonsense", "Tue, 01 Jan 2030 00:00:00 GMT"]) {
    const { load, calls } = setup({
      env: { ...fallbackEnv }, now: () => Date.parse("2031-01-01T00:00:00Z"),
      fetch: async () => new Response(null, {
        status: 429, headers: header === null ? {} : { "Retry-After": header },
      }),
      gemini: async () => ({ text: JSON.stringify(explanation) }),
    });
    await explain(load);
    await explain(load);
    assert.equal(calls.length, 2, `No cooldown for ${header}`);
  }
});

test("cooldown resets on credential, model and provider changes and can be disabled", async () => {
  const env = { ...fallbackEnv };
  const { load, calls, geminiCalls } = setup({
    env,
    fetch: async () => new Response(null, { status: 429, headers: { "Retry-After": "60" } }),
    gemini: async () => ({ text: JSON.stringify(explanation) }),
  });
  await explain(load);
  await explain(load);
  assert.equal(calls.length, 1);
  env.OPENAI_API_KEY = "second-primary";
  await explain(load);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers.Authorization, "Bearer second-primary");
  env.OPENAI_MODEL = "second-model";
  await explain(load);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].body.model, "second-model");
  env.GEMINI_API_KEY = "second-gemini";
  await explain(load);
  assert.equal(calls.length, 4);
  assert.equal(geminiCalls.at(-1).apiKey, "second-gemini");
  delete env.AI_FALLBACK_PROVIDER;
  env.AI_PROVIDER = "gemini";
  await explain(load);
  env.AI_PROVIDER = "openai";
  env.AI_FALLBACK_PROVIDER = "gemini";
  await explain(load);
  assert.equal(calls.length, 5);
  delete env.AI_FALLBACK_PROVIDER;
  await assert.rejects(explain(load), /HTTP 429/);
  assert.equal(calls.length, 6);
});

test("a deferred stream uses its captured primary credentials and cannot cool down a changed configuration", async () => {
  const env = { ...fallbackEnv };
  const { load, calls } = setup({
    env, routing: "conversation",
    fetch: async () => new Response(null, { status: 429, headers: { "Retry-After": "60" } }),
    gemini: async (_params, stream) => stream
      ? (async function* () { yield { text: "Fallback." }; })()
      : { text: JSON.stringify(explanation) },
  });
  const stream = await load("lib/ai/gemini").streamGeminiChat({ message: "Explain", language: "en" });
  env.OPENAI_API_KEY = "changed-key";
  await Array.fromAsync(stream);
  await explain(load);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.Authorization, "Bearer test-key");
  assert.equal(calls[1].headers.Authorization, "Bearer changed-key");
});

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
  const { load, calls, routeCalls } = setup({
    routing: "conversation",
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
    history: [{ role: "user", text: "Earlier question" }, { role: "assistant", text: "Earlier answer" }],
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
  assert.match(call.body.input, /Earlier question[\s\S]*Earlier answer/);
  assert.equal(routeCalls.length, 1);
  const routing = routeCalls[0];
  assert.equal(routing.body.model, "gpt-6-luna");
  assert.equal(routing.body.stream, false);
  assert.equal(routing.body.text.format.strict, true);
  assert.equal(routing.body.store, false);
  assert.equal(routing.signal, signal);
  assert.match(routing.body.input, /Earlier question[\s\S]*Earlier answer/);
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

test("one-line field follow-up sends the selected field and preceding answer to OpenAI without official lookup", async () => {
  const guarantor = { ...field, label: "Guarantor: passport date of issue", context: undefined };
  const previousAnswer = "This field asks for the issue date of the guarantor's passport.";
  const { load, calls } = setup({
    routing: "conversation",
    fetch: async () => sse([
      { type: "response.output_text.delta", delta: previousAnswer },
      { type: "response.completed", response: completed(previousAnswer) },
    ]),
  });
  const events = await Array.fromAsync(await load("lib/ai/gemini").streamGeminiChat({
    message: "explain in one line", language: "en", selectedFieldId: guarantor.id,
    form: { formNumber: "PPTC 153", pageCount: 1, fields: [guarantor] },
    history: [
      { role: "user", text: "What does this field mean?" },
      { role: "assistant", text: previousAnswer },
    ],
  }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.stream, true);
  assert.match(calls[0].body.input, /Guarantor: passport date of issue/);
  assert.ok(calls[0].body.input.includes(previousAnswer));
  assert.match(calls[0].body.input, /CURRENT_USER_REQUEST:\nexplain in one line/);
  assert.ok(events.every((event) => event.type === "delta"));
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
