import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadModule(path, imports = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, Error, DOMException, AbortController, setTimeout, clearTimeout,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
    ...globals,
  });
  return exports;
}

const association = loadModule("../src/lib/context-association.ts");
const input = {
  fieldId: "f-1", page: 1, type: "radio",
  candidates: {
    blocks: [
      { id: "q", text: "Do you receive the benefit?", rect: [20, 130, 200, 140] },
      { id: "i", text: "Choose one.", rect: [20, 115, 100, 125] },
      { id: "yes", text: "Yes", rect: [70, 90, 90, 100] },
      { id: "no", text: "No", rect: [120, 90, 140, 100] },
    ],
    widgets: [
      { option: "2", rect: [55, 90, 65, 100] },
      { option: "1", rect: [105, 90, 115, 100] },
    ],
  },
};
const selection = {
  status: "resolved", questionBlockIds: ["q"],
  instructionBlockIds: ["i"], optionBlockIds: ["yes", "no"],
};

function setupRoute(provider, { env = { GEMINI_API_KEY: "test-only" }, fakeTimers = false } = {}) {
  const timers = new Map();
  const logs = [];
  return {
    ...loadModule("../src/app/api/field-context/route.ts", {
      "next/server": { NextResponse: Response },
      "@/lib/ai/gemini": { associateFieldContext: provider },
      "@/lib/context-association": association,
    }, {
      process: { env },
      console: { error: (...args) => logs.push(args) },
      ...(fakeTimers ? {
        setTimeout(callback, delay) {
          assert.equal(delay, 30_000);
          const id = Symbol();
          timers.set(id, callback);
          return id;
        },
        clearTimeout(id) { timers.delete(id); },
      } : {}),
    }),
    timers, logs,
  };
}
const request = (body = input, signal) => new Request("http://localhost/api/field-context", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body), signal,
});

test("association accepts only existing, distinct block references and preserves widget order", () => {
  assert.ok(association.isAssociationRequest(input));
  const result = association.resolveAssociation(input.candidates, selection);
  assert.equal(result.question, input.candidates.blocks[0].text);
  assert.deepEqual(Array.from(result.instructions), ["Choose one."]);
  assert.deepEqual(Array.from(result.options), ["Yes", "No"]);
  const field = {
    id: input.fieldId, path: "rb_choice", rawName: "rb_choice", page: 1,
    type: "radio", label: "Unidentified field", section: "Page 1",
    rects: input.candidates.widgets.map((widget) => widget.rect),
    options: ["2", "1"], contextCandidates: input.candidates,
  };
  const resolved = association.applyAssociation(field, selection);
  assert.equal(resolved.context.source, "ai");
  assert.equal(resolved.context.status, "resolved");
  assert.deepEqual(Array.from(resolved.options), ["Yes", "No"]);
  assert.equal(association.applyAssociation(field, { status: "uncertain" }), field);
  const invalid = [
    null, {}, { ...selection, questionBlockIds: ["invented"] },
    { ...selection, questionBlockIds: ["yes"] },
    { ...selection, instructionBlockIds: ["q"] },
    { ...selection, questionBlockIds: ["q", "q"] },
    { ...selection, optionBlockIds: [] },
    { ...selection, questionBlockIds: "q" },
    { status: "resolved", question: "Invented question" },
  ];
  for (const value of invalid) assert.throws(() => association.resolveAssociation(input.candidates, value));
  const duplicateOptions = {
    ...input.candidates,
    blocks: input.candidates.blocks.map((block) =>
      block.id === "no" ? { ...block, text: "Yes" } : block),
  };
  assert.throws(() => association.resolveAssociation(duplicateOptions, selection), /duplicate option labels/);
});

test("invalid or oversized evidence is rejected before contacting AI", async () => {
  const { POST } = setupRoute(() => assert.fail("Provider should not be called"));
  const invalid = [
    null, [], {}, { ...input, page: 0 }, { ...input, type: "other" },
    { ...input, candidates: { ...input.candidates, blocks: [] } },
    { ...input, candidates: { ...input.candidates, blocks: [...input.candidates.blocks, input.candidates.blocks[0]] } },
    { ...input, candidates: { ...input.candidates, widgets: [{ rect: [1, 2, null, 4] }] } },
    { ...input, candidates: { ...input.candidates, blocks: [{ id: "q", text: "x".repeat(1201), rect: [0, 0, 1, 1] }] } },
  ];
  for (const body of invalid) assert.equal((await POST(request(body))).status, 400);
  assert.equal((await POST(request({ extra: "x".repeat(30_001) }))).status, 413);
  assert.equal((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status, 400);
});

test("missing configuration, explicit uncertainty, invalid AI output, and provider errors stay distinct", async () => {
  assert.equal((await setupRoute(() => assert.fail(), { env: {} }).POST(request())).status, 503);
  const uncertain = await setupRoute(async () => ({ status: "uncertain" })).POST(request());
  assert.deepEqual(await uncertain.json(), { selection: { status: "uncertain" } });
  for (const provider of [
    async () => ({ ...selection, questionBlockIds: ["unknown"] }),
    async () => { throw new Error("private-provider-details"); },
  ]) {
    const response = await setupRoute(provider).POST(request());
    assert.equal(response.status, 502);
    assert.doesNotMatch(JSON.stringify(await response.json()), /private-provider-details/);
  }
});

test("successful association is no-store and timeout aborts even a stalled provider", async () => {
  const success = await setupRoute(async () => selection).POST(request());
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await success.json()).selection, selection);
  let upstreamSignal;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const { POST, timers } = setupRoute(async (_, signal) => {
    upstreamSignal = signal;
    started();
    return new Promise(() => {});
  }, { fakeTimers: true });
  const response = POST(request());
  await ready;
  [...timers.values()][0]();
  assert.equal((await response).status, 504);
  assert.ok(upstreamSignal.aborted);
  assert.equal(timers.size, 0);
});

test("client cancellation aborts pending association without returning a successful match", async () => {
  const controller = new AbortController();
  let upstreamSignal;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const { POST } = setupRoute(async (_, signal) => {
    upstreamSignal = signal;
    started();
    return new Promise(() => {});
  });
  const pending = POST(request(input, controller.signal));
  await ready;
  controller.abort();
  assert.equal((await pending).status, 499);
  assert.ok(upstreamSignal.aborted);
  let called = false;
  const alreadyAborted = await setupRoute(() => { called = true; }).POST(request(input, controller.signal));
  assert.equal(alreadyAborted.status, 499);
  assert.equal(called, false);
});

test("AI sees bounded block evidence, not PDF bytes, entered values or arbitrary extra properties", async () => {
  let call;
  const { associateFieldContext } = loadModule("../src/lib/ai/gemini.ts", {
    "server-only": {},
    "@/lib/official/catalog": loadModule("../src/lib/official/catalog.ts", {
      "./hosts": loadModule("../src/lib/official/hosts.ts", {}),
    }),
    "@/lib/official/context": {},
    "@/lib/official/lookup": {},
    "@/lib/official/grounding": {},
    "@google/genai": {
      ThinkingLevel: { LOW: "LOW" },
      GoogleGenAI: class {
        models = {
          generateContent: async (value) => {
            call = value;
            return { text: JSON.stringify(selection) };
          },
        };
      },
    },
  }, { process: { env: { GEMINI_API_KEY: "test-only" } } });
  await associateFieldContext({
    ...input, pdfBytes: "private-pdf",
    candidates: {
      ...input.candidates,
      blocks: input.candidates.blocks.map((block) => ({ ...block, value: "private-answer" })),
      widgets: input.candidates.widgets.map((widget) => ({ ...widget, value: "private-answer" })),
    },
  }, new AbortController().signal);
  assert.doesNotMatch(call.contents, /private-pdf|private-answer/);
  assert.match(call.config.systemInstruction, /untrusted data/);
  assert.match(call.config.systemInstruction, /return status uncertain/);
  assert.equal(call.config.responseMimeType, "application/json");
});
