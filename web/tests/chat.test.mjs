import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import crypto from "node:crypto";
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
    Error, DOMException, AbortController, ReadableStream, TextEncoder, TextDecoder, URL,
    Response, setTimeout, clearTimeout,
    ...globals,
  }, { filename: path });
  return exports;
}

function setupRoute(streamGeminiChat, env = { GEMINI_API_KEY: "test-only" }) {
  const timers = new Map();
  const logs = [];
  const hosts = loadModule("../src/lib/official/hosts.ts", {});
  const catalog = loadModule("../src/lib/official/catalog.ts", { "./hosts": hosts });
  const route = loadModule("../src/app/api/chat/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/ai/gemini": { streamGeminiChat },
    "@/lib/official/catalog": catalog,
    "@/lib/abortable": loadModule("../src/lib/abortable.ts", {}),
    "@/lib/field-context": loadModule("../src/lib/field-context.ts", {}),
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
    { ...message, intent: "field", selectedFieldId: undefined },
    { message: "Explain", intent: "field", selectedFieldId: field.id },
    { ...message, selectedFieldId: "missing" },
    { ...message, form: { ...form, fields: [{ ...field, page: 2 }] } },
    { ...message, form: { ...form, fields: [{ ...field, type: "unknown" }] } },
    { ...message, lookupContext: { serviceId: "passport", query: "PERSONAL-CANARY" } },
    { ...message, lookupChoice: { jurisdiction: "evil.test" } },
    { ...message, lookupChoice: { serviceId: "passport", formId: "isp1000" } },
    { ...message, form: { ...form, fields: [{ ...field, context: { status: "resolved", source: "layout", instructions: [] } }] } },
    { ...message, form: { ...form, fields: [{ ...field, context: { status: "ambiguous", source: "layout", instructions: [42] } }] } },
    { ...message, form: { ...form, formTitle: "https://evil.test/info" } },
    { ...message, form: { ...form, formTitle: "x".repeat(201) } },
    { ...message, lookupContext: { publicForm: { number: "ABC 123", query: "PRIVATE-QUERY" } } },
    { ...message, lookupContext: { publicForm: { number: "ABC 123" }, serviceId: "passport" } },
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

test("field intent validates the selection, drops history and preserves streaming", async () => {
  let input;
  const { POST, timers } = setupRoute(async (value) => {
    input = value;
    return (async function* () {
      yield { version: 1, type: "delta", text: "Use the printed " };
      yield { version: 1, type: "delta", text: "instructions." };
    })();
  });
  const response = await POST(request({
    ...message, intent: "field",
    history: [{ role: "user", text: "Unrelated earlier conversation" }],
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "text/event-stream; charset=utf-8");
  const events = (await response.text()).trim().split("\n\n").map((frame) => JSON.parse(frame.slice(6)));
  assert.deepEqual(events, [
    { version: 1, type: "delta", text: "Use the printed " },
    { version: 1, type: "delta", text: "instructions." },
    { version: 1, type: "complete", complete: true },
  ]);
  assert.equal(input.intent, "field");
  assert.equal(input.selectedFieldId, field.id);
  assert.equal(input.language, "fr");
  assert.equal(input.history.length, 0);
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
  directPage,
  generationError,
  streamError,
  searchUrls = [],
  searchStatus = 200,
} = {}) {
  const calls = [];
  const logs = [];
  const directAttempts = [];
  const searchRequests = [];
  const officialHosts = loadModule("../src/lib/official/hosts.ts", {});
  const officialCatalog = loadModule("../src/lib/official/catalog.ts", {
    "./hosts": officialHosts,
  });
  const officialContext = loadModule("../src/lib/official/context.ts", {
    "./catalog": officialCatalog,
    "./hosts": officialHosts,
  });
  const officialSearch = loadModule("../src/lib/official/search.ts", {
    "server-only": {}, "./catalog": officialCatalog,
    "../catalog/resources": loadModule("../src/lib/catalog/resources.ts", {}),
  }, {
    process: { env },
    fetch: async (url, init) => {
      searchRequests.push({ url, ...init });
      return new Response(JSON.stringify({ organic: searchUrls.map((link) => ({ link })) }), { status: searchStatus });
    },
  });
  const officialLookup = loadModule("../src/lib/official/lookup.ts", {
    "server-only": {}, "node:crypto": crypto,
    "@/lib/abortable": loadModule("../src/lib/abortable.ts", {}),
    "./catalog": officialCatalog, "./hosts": officialHosts,
    "./search": officialSearch,
    "./fetch": {
      fetchOfficialPage: async (url) => {
        directAttempts.push(url);
        if (typeof directPage === "function") return directPage(url);
        if (directPage) return { url, language: "en-CA", ...directPage };
        throw new Error("direct-fetch-test-failure");
      },
      isArchivedPage: (page) => page.archived === true,
      OfficialFetchError: class extends Error {},
    },
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
            if (generationError) throw generationError;
            if (input.config.responseMimeType === "application/json") {
              assert.fail("Discovery must use Serper, not model-generated URLs");
            }
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
              if (streamError) throw streamError;
            })();
          },
        };
      },
    },
    "@/lib/official/catalog": officialCatalog,
    "@/lib/official/context": officialContext,
    "@/lib/official/lookup": officialLookup,
  }, { process: { env }, console: { info: (...args) => logs.push(args) } });
  return { streamGeminiChat, calls, directAttempts, searchRequests, logs };
}

async function collect(stream) {
  const events = [];
  for await (const event of stream) events.push(event);
  return events;
}

test("renewal mode reaches direct lookup, answer scope and subsequent fee questions", async () => {
  const { streamGeminiChat, calls, directAttempts } = setupGemini({
    directPage: { title: "Renew your Canadian passport", text: "Passport renewal steps and fees are described here." },
  });
  const first = await collect(await streamGeminiChat({ message: "How do I renew my passport?", form: { ...form, formNumber: "PPTC 153" }, language: "en" }));
  assert.equal(first[0].outcome.passportMode, "renewal");
  assert.equal(first[0].outcome.formId, undefined);
  assert.match(calls[0].contents, /"passportMode":"renewal"/);
  await collect(await streamGeminiChat({ message: "What about the fees?", language: "en", lookupContext: {
    serviceId: "passport", jurisdiction: "federal", facetId: "steps", passportMode: "renewal",
  } }));
  assert.equal(directAttempts.length, 2);
  assert.ok(directAttempts.every((url) => url.endsWith("/renew-adult-passport.html")));
  assert.match(calls[1].contents, /"passportMode":"renewal"/);
});

test("selected-field blank follow-ups retain printed instructions without masking live questions", async () => {
  const signature = { ...field, label: "Signature", context: {
    status: "resolved", source: "layout", question: "Signature",
    instructions: ["Leave blank until an officer asks you to sign."],
  } };
  for (const [question, language] of [["Can I leave it blank?", "en"], ["Puis-je le laisser vide ?", "fr"]]) {
    const { streamGeminiChat, calls } = setupGemini();
    await collect(await streamGeminiChat({ message: question, language, selectedFieldId: signature.id,
      form: { ...form, formNumber: "PPTC 153", fields: [signature] },
      lookup: () => assert.fail("Field follow-up must not look up the passport overview"),
    }));
    assert.equal(calls[0].kind, "stream");
    assert.match(calls[0].contents, /Leave blank until an officer asks you to sign/);
  }
  for (const question of ["What are the passport fees?", "Where can I download this form?", "How do I apply for a passport?"]) {
    const { streamGeminiChat } = setupGemini();
    let lookedUp = false;
    await collect(await streamGeminiChat({ message: question, language: "en", selectedFieldId: signature.id,
      form: { ...form, formNumber: "PPTC 153", fields: [signature] },
      lookup: async (args) => { lookedUp = true; return { outcome: { ...args, status: "unavailable", reason: "fetch_failed", partial: false }, sources: [] }; },
    }));
    assert.equal(lookedUp, true, question);
  }
});

test("route reports terminal generation status and retains partial metadata and official sources", async () => {
  for (const reason of ["MAX_TOKENS", "STOP", "SAFETY"]) {
    const { streamGeminiChat } = setupGemini({ finalChunks: [{ text: "Partial answer", candidates: [{ finishReason: reason }] }] });
    const { POST } = setupRoute(streamGeminiChat);
    const response = await POST(request({ message: "Explain this field", language: "en", form, selectedFieldId: field.id }));
    const body = await response.text();
    assert.match(body, /Partial answer/);
    assert.match(body, reason === "STOP" ? /"complete":true/ : /"type":"error","code":"interrupted"/);
    assert.match(body, reason === "STOP" ? /"complete":true/ : /"complete":false/);
    if (reason !== "STOP") assert.doesNotMatch(body, /"complete":true/);
  }
  const { streamGeminiChat } = setupGemini({
    finalChunks: [{ text: "Truncated [source:live-source-id]", candidates: [{ finishReason: "MAX_TOKENS" }] }],
    directPage: { title: "Citizenship certificate CIT 0001", text: "Download the CIT 0001 application here." },
  });
  const { POST } = setupRoute(streamGeminiChat);
  const body = await (await POST(request({ message: "Where do I download this form?", language: "en", form: { ...form, formNumber: "CIT 0001" } }))).text();
  assert.match(body, /"type":"lookup"/);
  assert.match(body, /live_official/);
  assert.match(body, /"type":"error","code":"interrupted"/);
  assert.match(body, /"complete":false/);
  assert.doesNotMatch(body, /"complete":true/);
});

test("citizenship certificate download uses the open CIT 0001 form without asking which service", async () => {
  const { streamGeminiChat, calls } = setupGemini({
    functionArgs: { serviceId: "unknown", jurisdiction: "unknown", facetId: "documents", language: "en" },
  });
  let selection;
  const events = await collect(await streamGeminiChat({
    message: "where do I download this form from?",
    form: { ...form, formNumber: "CIT 0001", fields: [{ ...field, label: "Certificate no.", section: "3 Reason for application" }] },
    selectedFieldId: field.id,
    language: "en",
    lookup: async (args) => {
      selection = args;
      return {
        outcome: { ...args, status: "unavailable", reason: "fetch_failed", partial: false },
        sources: [],
      };
    },
  }));
  assert.ok(selection, "The open citizenship form must dispatch a lookup, not a missing-service selector");
  assert.equal(selection.publicForm.number, "CIT 0001");
  assert.equal(selection.serviceId, undefined);
  assert.equal(calls.length, 0, "A recognized form must not need Gemini service planning");
  assert.ok(events.every((event) => event.outcome?.reason !== "missing_service"));
});

test("uncatalogued forms search Serper with their public title without private context or Gemini grounding", async () => {
  const { streamGeminiChat, calls, searchRequests } = setupGemini({
    env: { GEMINI_API_KEY: "test-only", SERPER_API_KEY: "test-only" },
    searchStatus: 429,
  });
  const events = await collect(await streamGeminiChat({
    message: "Where do I download this form? PRIVATE-QUESTION",
    form: { ...form, formTitle: "Application for accessibility assistance", fileName: "PRIVATE-FILENAME" },
    history: [{ role: "user", text: "PRIVATE-HISTORY" }],
    language: "en",
  }));
  assert.equal(calls.length, 0);
  assert.equal(searchRequests.length, 1);
  assert.match(searchRequests[0].body, /Application for accessibility assistance/);
  assert.doesNotMatch(JSON.stringify(searchRequests), /PRIVATE-/);
  assert.equal(events[0].outcome.reason, "search_quota");
});

test("automatic form discovery verifies suggested pages live before synthesizing an answer", async () => {
  const url = "https://www.canada.ca/en/accessibility-application";
  const { streamGeminiChat, calls, directAttempts, logs, searchRequests } = setupGemini({
    env: { GEMINI_API_KEY: "test-only", SERPER_API_KEY: "test-only", NODE_ENV: "development" },
    searchUrls: [url],
    directPage: { title: "Accessibility assistance ABC 123", text: "Download ABC 123 from this official accessibility assistance application page." },
  });
  const events = await collect(await streamGeminiChat({
    message: "Where do I download this form? PRIVATE-QUESTION",
    form: {
      ...form, formNumber: "ABC 123",
      formTitle: "Application for accessibility assistance",
      fileName: "PRIVATE-FILENAME",
    },
    history: [{ role: "user", text: "PRIVATE-HISTORY" }], language: "en",
  }));
  assert.deepEqual(directAttempts, [url]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "stream");
  assert.doesNotMatch(searchRequests[0].body, /PRIVATE-/);
  assert.match(calls[0].contents, /Download ABC 123 from this official/);
  assert.equal(events[0].outcome.status, "verified");
  assert.equal(events[0].outcome.jurisdiction, "federal");
  assert.equal(events[0].sources[0].provenance.kind, "live_official");
  assert.ok(logs.some(([, event]) => event.operation === "lookup_official_information"));
  assert.doesNotMatch(JSON.stringify(logs), /Application for accessibility|PRIVATE-/);
});

test("untrusted page suggestions cannot bypass the government URL policy", async () => {
  const { streamGeminiChat, directAttempts } = setupGemini({
    env: { GEMINI_API_KEY: "test-only", SERPER_API_KEY: "test-only" },
    searchUrls: ["https://evil.test/info", "https://www.canada.ca/en/sign-in"],
  });
  const events = await collect(await streamGeminiChat({
    message: "Where do I download this form?", form: { ...form, formNumber: "ABC 123" }, language: "en",
  }));
  assert.equal(directAttempts.length, 0);
  assert.equal(events[0].outcome.reason, "no_allowed_candidates");
});

test("IRCC form numbers use the official form directory without a catalog entry or model URL guess", async () => {
  const { streamGeminiChat, calls, directAttempts } = setupGemini({
    directPage: { title: "Citizenship certificate CIT 0001", text: "Download the CIT 0001 application here." },
  });
  const events = await collect(await streamGeminiChat({
    message: "Where do I download this form?", form: { ...form, formNumber: "CIT 0001" }, language: "en",
  }));
  assert.deepEqual(directAttempts, [
    "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/cit0001.html",
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "stream");
  assert.equal(events[0].outcome.status, "verified");
});

test("development logs Gemini calls and tool execution without private payloads", async () => {
  const selection = { serviceId: "passport", jurisdiction: "federal", facetId: "fees", language: "en" };
  const { streamGeminiChat, logs } = setupGemini({
    env: { GEMINI_API_KEY: "PRIVATE-KEY", NODE_ENV: "development" },
    functionArgs: selection,
  });
  await collect(await streamGeminiChat({
    message: "PRIVATE-QUESTION", language: "en",
    lookupContext: { jurisdiction: "federal", facetId: "fees" },
    lookup: async () => ({
      outcome: { ...selection, status: "unavailable", reason: "fetch_failed", partial: false },
      sources: [],
    }),
  }));
  const events = logs.map(([prefix, event]) => {
    assert.equal(prefix, "[gemini]");
    assert.ok(event.elapsedMs >= 0);
    return event;
  });
  const planning = events.find((event) => event.operation === "lookup-planning" && event.event === "start");
  assert.deepEqual(Array.from(planning.tools), ["lookup_official_information"]);
  const response = events.find((event) => event.id === planning.id && event.event === "complete");
  assert.equal(response.functionCalls[0].selection.serviceId, "passport");
  const tool = events.find((event) => event.operation === "lookup_official_information" && event.event === "complete");
  assert.equal(tool.status, "unavailable");
  assert.equal(tool.reason, "fetch_failed");
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE-/);
});

test("invalid planner arguments are diagnosable without logging arbitrary values", async () => {
  const { streamGeminiChat, logs } = setupGemini({
    env: { GEMINI_API_KEY: "test-only", NODE_ENV: "development" },
    functionArgs: { serviceId: "unknown", jurisdiction: "PRIVATE-LOCATION", facetId: "documents", language: "en", query: "PRIVATE-QUERY" },
  });
  await collect(await streamGeminiChat({ message: "PRIVATE-QUESTION", language: "en" }));
  const call = logs.find(([, event]) => event.event === "complete")[1].functionCalls[0];
  assert.equal(call.selection, null);
  assert.equal(call.argumentStatus, "unknown_or_invalid_selection");
  assert.equal(call.arguments.serviceId, "unknown");
  assert.equal(call.arguments.jurisdiction, "invalid_or_missing");
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE-/);
});
test("development stream logs track completion, errors and cancellation without answer text", async () => {
  for (const mode of ["complete", "error", "cancelled"]) {
    const failure = new Error("PRIVATE-ERROR");
    const { streamGeminiChat, logs } = setupGemini({
      env: { GEMINI_API_KEY: "PRIVATE-KEY", NODE_ENV: "development" },
      finalChunks: [{
        text: "PRIVATE-ANSWER",
        usageMetadata: { totalTokenCount: 12 },
        candidates: [{ finishReason: "STOP" }],
      }],
      streamError: mode === "error" ? failure : undefined,
    });
    const stream = await streamGeminiChat({
      intent: "overview", form: { ...form, fileName: "PRIVATE-FILENAME" }, language: "en",
    });
    if (mode === "cancelled") {
      await stream.next();
      await stream.return();
    } else if (mode === "error") {
      await assert.rejects(collect(stream), (error) => error === failure);
    } else {
      await collect(stream);
    }
    const events = logs.map(([, event]) => event);
    assert.equal(events.at(-1).event, mode);
    assert.equal(events.find((event) => event.event === "response").usage.totalTokenCount, 12);
    assert.doesNotMatch(JSON.stringify(logs), /PRIVATE-/);
  }
});

test("development generation failures are logged and rethrown without raw errors", async () => {
  const failure = new Error("PRIVATE-PROVIDER-ERROR");
  const { streamGeminiChat, logs } = setupGemini({
    env: { GEMINI_API_KEY: "PRIVATE-KEY", NODE_ENV: "development" },
    generationError: failure,
  });
  await assert.rejects(collect(await streamGeminiChat({
    message: "PRIVATE-QUESTION", language: "en",
  })), (error) => error === failure);
  assert.equal(logs.at(-1)[1].event, "error");
  assert.doesNotMatch(JSON.stringify(logs), /PRIVATE-/);
});

test("Gemini request and tool logging is disabled outside development", async () => {
  for (const NODE_ENV of ["production", "test", undefined]) {
    const { streamGeminiChat, logs } = setupGemini({
      env: { GEMINI_API_KEY: "test-only", NODE_ENV },
    });
    await collect(await streamGeminiChat({ intent: "overview", form, language: "en" }));
    await collect(await streamGeminiChat({ message: "Unrecognized request", language: "en" }));
    assert.equal(logs.length, 0);
  }
});

test("the default lookup falls back to Serper after a failed direct fetch and synthesizes only verified text", async () => {
  const alternate = "https://www.saskatchewan.ca/forms";
  const { streamGeminiChat, calls, directAttempts, searchRequests } = setupGemini({
    env: { GEMINI_API_KEY: "test-only", SERPER_API_KEY: "test-only" },
    searchUrls: [alternate],
    directPage: async (url) => {
      if (url !== alternate) throw new Error("direct-fetch-test-failure");
      return {
        url, language: "en-CA", title: "2026-27 Full-Time Saskatchewan Student Aid forms",
        text: "Download the 2026-27 Full-Time Saskatchewan Student Aid application.",
      };
    },
  });
  const events = await collect(await streamGeminiChat({
    message: "Where do I download this form? PRIVATE-QUESTION-CANARY",
    form: { ...form, formNumber: "154091", fileName: "PRIVATE-FILENAME-CANARY.pdf" },
    history: [{ role: "user", text: "PRIVATE-HISTORY-CANARY" }], language: "en",
  }));
  assert.equal(calls.length, 1);
  assert.equal(directAttempts.length, 2);
  assert.equal(searchRequests.length, 1);
  assert.equal(events[0].outcome.fallbackReason, "fetch_failed");
  assert.equal(events[0].outcome.method, "search");
  assert.equal(calls[0].config.tools, undefined);
  assert.match(calls[0].contents, /Download the 2026-27 Full-Time/);
  assert.doesNotMatch(JSON.stringify(searchRequests), /PRIVATE-/);
  assert.ok(events.some((event) => event.type === "delta"));
});

test("a successful default direct lookup synthesizes verified excerpts without calling Google Search", async () => {
  const url = "https://www.saskatchewan.ca/residents/education-and-learning/saskatchewan-student-aid/student-loans-and-grants/printable-applications-and-forms";
  const sourceId = `live-${crypto.createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
  const { streamGeminiChat, calls, directAttempts } = setupGemini({
    directPage: {
      title: "2026-27 Full-Time Saskatchewan Student Aid forms",
      text: "Download the 2026-27 Full-Time Saskatchewan Student Aid application from this official forms page.",
    },
    finalChunks: [
      { text: `Use the official application page [source:${sourceId}].` },
      { text: " [source:forged-id] https://forged.example/" },
    ],
  });
  const events = await collect(await streamGeminiChat({
    message: "Where do I download this form?",
    form: { ...form, formNumber: "154091", fileName: "PRIVATE-FILENAME-CANARY.pdf" },
    history: [{ role: "assistant", text: "STALE-ANSWER-CANARY" }], language: "en",
  }));
  assert.equal(directAttempts.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "stream");
  assert.equal(calls[0].config.tools, undefined);
  assert.match(calls[0].contents, /Download the 2026-27 Full-Time Saskatchewan Student Aid/);
  assert.doesNotMatch(calls[0].contents, /PRIVATE-FILENAME-CANARY|STALE-ANSWER-CANARY/);
  assert.equal(events[0].outcome.method, "official_page");
  assert.equal(events[0].outcome.fallbackReason, undefined);
  assert.equal(events[0].sources[0].provenance.kind, "live_official");
  assert.equal(events[0].sources[0].evidence, undefined);
  const answer = events.filter((event) => event.type === "delta").map((event) => event.text).join("");
  assert.match(answer, /\[1\]/);
  assert.doesNotMatch(answer, /forged-id|https?:\/\//);
});

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

test("resolved requests display the grounded answer without planning or another model call", async () => {
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
    provenance: { kind: "google_grounded", searchedAt: "2026-10-29T18:00:00.000Z" },
  };
  const { streamGeminiChat, calls } = setupGemini({ functionArgs });
  const stream = await streamGeminiChat({
    message: "How do I apply for a health card in Ontario? PRIVATE-CANARY",
    language: "en",
    history: [{ role: "assistant", text: "STALE-ANSWER-CANARY" }],
    lookup: async (args) => {
      assert.deepEqual(JSON.parse(JSON.stringify(args)), functionArgs);
      return {
        outcome: { status: "verified", reason: "none", partial: false, jurisdiction: "on" },
        sources: [source],
        answer: "Apply using the current instructions. [1]",
      };
    },
  });
  const events = await collect(stream);
  assert.equal(calls.length, 0);
  const lookupEvent = events.find((event) => event.type === "lookup");
  assert.equal(lookupEvent.sources[0].evidence, undefined);
  assert.equal(lookupEvent.sources[0].url, source.url);
  const answer = events.filter((event) => event.type === "delta").map((event) => event.text).join("");
  assert.equal(answer, "Apply using the current instructions. [1]");
  assert.doesNotMatch(answer, /STALE-ANSWER-CANARY|PRIVATE-CANARY/);
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

test("a verified adapter result missing its answer never triggers a synthesis fallback", async () => {
  const { streamGeminiChat, calls } = setupGemini();
  const stream = await streamGeminiChat({
    message: "Where do I download this form?",
    form: { ...form, formNumber: "154091" },
    language: "en",
    lookup: async () => ({
      outcome: { status: "verified", reason: "none", partial: false },
      sources: [{
        id: "incomplete-adapter-result",
        provenance: { kind: "google_grounded", searchedAt: "2026-10-29T20:00:00Z" },
      }],
    }),
  });
  await assert.rejects(collect(stream), /official-source answer or its sources were empty/);
  assert.equal(calls.length, 0);
});

test("the open-form download request dispatches canonical form IDs without planning", async () => {
  const { streamGeminiChat, calls } = setupGemini();
  let dispatched;
  const stream = await streamGeminiChat({
    message: "where do I download this form from?",
    form: { ...form, formNumber: "ISP 1000", fileName: "PERSONAL-FILE-CANARY.pdf" },
    history: [{ role: "assistant", text: "STALE-ANSWER-CANARY" }],
    language: "en",
    lookup: async (args) => {
      dispatched = args;
      return {
        outcome: { status: "unavailable", reason: "fetch_failed", partial: false },
        sources: [],
      };
    },
  });
  const events = await collect(stream);
  assert.deepEqual(JSON.parse(JSON.stringify(dispatched)), {
    serviceId: "pension", jurisdiction: "federal", facetId: "documents", language: "en", formId: "isp1000",
  });
  assert.equal(calls.length, 0);
  assert.equal(events[0].outcome.formId, "isp1000");
  assert.doesNotMatch(JSON.stringify(dispatched), /PERSONAL-FILE-CANARY|STALE-ANSWER-CANARY/);
});

test("ISP 3550 with a selected field resumes the download question and never routes to CPP", async () => {
  const { streamGeminiChat, calls } = setupGemini();
  let dispatched;
  const stream = await streamGeminiChat({
    message: "ISP 3550",
    form: { ...form, formNumber: "ISP 3550", fileName: "PERSONAL-FILE-CANARY.pdf" },
    selectedFieldId: field.id,
    lookupContext: { facetId: "overview" },
    history: [
      { role: "user", text: "where do I download this from?" },
      { role: "assistant", text: "Choose the service. STALE-ANSWER-CANARY" },
      { role: "user", text: "ISP 3550" },
      { role: "assistant", text: "Choose the service again." },
    ],
    language: "en",
    lookup: async (args) => {
      dispatched = args;
      return {
        outcome: { status: "verified", reason: "none", partial: false, ...args },
        answer: "Use the official application page. [1]",
        sources: [{
          id: "oas-source",
          title: "Old Age Security application",
          url: "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/apply.html",
          department: "Canada", description: "", tags: [], language: "en-CA",
          jurisdiction: "federal", facetId: "documents",
          provenance: { kind: "google_grounded", searchedAt: "2026-10-29T19:00:00.000Z" },
        }],
      };
    },
  });
  const events = await collect(stream);
  assert.deepEqual(JSON.parse(JSON.stringify(dispatched)), {
    serviceId: "old_age_security", jurisdiction: "federal",
    facetId: "documents", language: "en", formId: "isp3550",
  });
  assert.equal(calls.length, 0);
  assert.doesNotMatch(JSON.stringify(dispatched), /PERSONAL-FILE-CANARY|STALE-ANSWER-CANARY/);
  assert.equal(events[0].outcome.formId, "isp3550");
  assert.match(events.filter((event) => event.type === "delta").map((event) => event.text).join(""), /\[1\]/);
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
      assert.equal(calls.filter((call) => call.kind === "planner").length, 0);
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

test("unresolved or repeated planner calls produce guided clarification", async (t) => {
  const valid = {
    name: "lookup_official_information",
    args: { serviceId: "health_card", jurisdiction: "on", facetId: "steps", language: "en" },
  };
  for (const [label, messageText, functionCalls] of [
    ["missing jurisdiction", "How do I apply for a health card?", [valid]],
    ["missing service", "How do I apply in Ontario?", []],
    ["repeated call", "Which service can help me?", [valid, valid]],
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
      assert.equal(dispatched, undefined);
      assert.equal(events[0].outcome.status, "clarification_required");
    });
  }
});

test("full structured context is kept for the selected field without multiplying instructions across the catalogue", async () => {
  const { streamGeminiChat, calls } = setupGemini();
  const detailed = {
    ...field,
    context: {
      status: "resolved", source: "layout",
      question: "Question ".repeat(100),
      instructions: ["A printed conditional instruction."],
      fieldValue: "private-answer",
    },
    contextCandidates: { blocks: [{ text: "private-candidate-not-for-chat" }] },
  };
  await collect(await streamGeminiChat({
    message: "Explain this field", language: "en", selectedFieldId: field.id,
    form: { ...form, fields: [detailed, { ...detailed, id: "other" }] },
  }));
  const context = JSON.parse(calls[0].contents.split("FORM_CONTEXT:\n")[1].split("\n\nRECENT_CONVERSATION:")[0]);
  assert.equal(context.selectedField.context.question, detailed.context.question.trim());
  assert.deepEqual(context.selectedField.context.instructions, detailed.context.instructions);
  assert.equal(context.fields[1].context.question.length, 200);
  assert.deepEqual(context.fields[1].context.instructions, []);
  assert.doesNotMatch(calls[0].contents, /private-answer|private-candidate-not-for-chat/);
});

test("field intent sends only the selected field and document metadata to Gemini", async (t) => {
  const { streamGeminiChat, calls } = setupGemini();
  const selected = {
    ...field,
    context: {
      status: "resolved", source: "layout", question: "Your full name?",
      instructions: ["Use the name printed on your document."],
    },
  };
  const fields = Array.from({ length: 250 }, (_, i) => ({
    ...field, id: `other-${i}`, label: `Unrelated field ${i}`,
  }));
  fields.push(selected);
  const input = {
    message: "What should I enter in this field?", language: "fr",
    selectedFieldId: selected.id, form: { ...form, fields },
    history: [{ role: "user", text: "Unrelated earlier conversation" }],
  };
  await collect(await streamGeminiChat(input));
  await collect(await streamGeminiChat({ ...input, intent: "field" }));
  const regular = calls[0].contents;
  const focused = calls[1].contents;
  const context = JSON.parse(focused.split("FORM_CONTEXT:\n")[1].split("\n\nRECENT_CONVERSATION:")[0]);
  assert.equal(context.fields.length, 0);
  assert.equal(context.fieldsTruncated, false);
  assert.equal(context.document.fileName, form.fileName);
  assert.equal(context.document.pageCount, form.pageCount);
  assert.equal(context.selectedField.id, selected.id);
  assert.deepEqual(context.selectedField.context, selected.context);
  assert.match(calls[1].config.systemInstruction, /Answer in French/);
  assert.doesNotMatch(focused, /Unrelated field|Unrelated earlier conversation/);
  assert.ok(focused.length < regular.length / 5, "Focused prompt must be at least 80% smaller for a 251-field form");
  t.diagnostic(`Prompt size: ${regular.length} -> ${focused.length} characters (${Math.round((1 - focused.length / regular.length) * 100)}% smaller)`);
  const minimal = { ...input, form: { ...form, fields: [fields[0], selected] } };
  await collect(await streamGeminiChat({ ...minimal, intent: "field" }));
  assert.equal(calls[2].contents, focused, "Unrelated fields must not affect a field-only prompt");
});

test("explicit field intent uses focused metadata without depending on the question wording", async () => {
  const { streamGeminiChat, calls } = setupGemini();
  const events = await collect(await streamGeminiChat({
    message: "Help me understand the selected question.",
    intent: "field",
    language: "en",
    selectedFieldId: field.id,
    form,
    history: [{ role: "user", text: "Unrelated earlier conversation" }],
    lookup: () => assert.fail("A focused field explanation must not dispatch official lookup"),
  }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "stream");
  assert.ok(events.every((event) => event.type === "delta"));
  const context = JSON.parse(calls[0].contents.split("FORM_CONTEXT:\n")[1].split("\n\nRECENT_CONVERSATION:")[0]);
  assert.equal(context.selectedField.id, field.id);
  assert.deepEqual(context.fields, []);
  assert.doesNotMatch(calls[0].contents, /Unrelated earlier conversation/);
});
