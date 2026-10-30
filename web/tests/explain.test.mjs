import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

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
    Error, DOMException, AbortController, Response, setTimeout, clearTimeout,
    ...globals,
  }, { filename: path });
  return exports;
}

const field = {
  id: "field-1", path: "form.name", page: 1, type: "text",
  label: "Name", section: "Applicant",
  context: { status: "resolved", source: "layout", question: "Full legal name", instructions: [] },
};
const curated = {
  fieldId: field.id, meaning: "Curated meaning", whatToEnter: "Curated instructions",
  commonMistakes: [], sources: [{ id: "official", title: "Official guide" }], grounded: true,
};
const generated = {
  meaning: "Gemini meaning", whatToEnter: "Gemini instructions",
  commonMistakes: ["Gemini warning"],
};

function setupRoute(provider, env = { GEMINI_API_KEY: "test-only" }) {
  const timers = new Map();
  const logs = [];
  const route = loadModule("../src/app/api/explain/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/ai/gemini": { generateGeminiFieldExplanation: provider },
    "@/lib/explain": { explainField: () => curated },
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
  return new Request("http://localhost/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

test("explain calls Gemini with field context and language, retaining curated sources", async () => {
  let input;
  const { POST, timers } = setupRoute(async (value) => {
    input = value;
    return generated;
  });
  const response = await POST(request({ field, formNumber: "PPTC 153", language: "fr" }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(JSON.stringify(input.field), JSON.stringify(field));
  assert.equal(input.formNumber, "PPTC 153");
  assert.equal(input.language, "fr");
  assert.equal(input.curated, curated);
  assert.equal(body.fieldId, field.id);
  assert.equal(body.meaning, generated.meaning);
  assert.deepEqual(body.sources, curated.sources);
  assert.equal(body.grounded, true);
  assert.equal(timers.size, 0);
});

test("invalid requests and missing Gemini configuration fail before provider calls", async () => {
  const provider = () => assert.fail("Gemini should not be called");
  const { POST } = setupRoute(provider);
  for (const body of [null, [], {}, { field: { ...field, page: 0 } }, { field, language: "de" }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal((await POST(new Request("http://localhost/api/explain", {
    method: "POST", body: "{",
  }))).status, 400);
  assert.equal((await setupRoute(provider, {}).POST(request({ field }))).status, 503);
});

test("provider failures are sanitized and timeout aborts the request", async (t) => {
  await t.test("provider error", async () => {
    const { POST, logs } = setupRoute(async () => { throw new Error("private-provider-details"); });
    const response = await POST(request({ field }));
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /private-provider-details/);
    assert.doesNotMatch(JSON.stringify(logs), /private-provider-details/);
  });

  await t.test("timeout", async () => {
    let upstreamSignal;
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    const { POST, timers } = setupRoute((input) => {
      upstreamSignal = input.signal;
      started();
      return new Promise(() => {});
    });
    const pending = POST(request({ field }));
    await ready;
    [...timers.values()][0]();
    assert.equal((await pending).status, 504);
    assert.equal(upstreamSignal.aborted, true);
    assert.equal(timers.size, 0);
  });
});

test("Gemini explanation uses structured JSON, safe context, and selected language", async () => {
  const calls = [];
  const { generateGeminiFieldExplanation } = loadModule("../src/lib/ai/gemini.ts", {
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
            calls.push(value);
            return { text: JSON.stringify({
              meaning: "Signification", whatToEnter: "Votre nom", formatExample: "",
              whereToFind: "", keyPoints: { title: "", items: [] }, commonMistakes: [],
            }) };
          },
        };
      },
    },
  }, { process: { env: { GEMINI_API_KEY: "test-only", GEMINI_MODEL: "test-model" } } });

  const signal = new AbortController().signal;
  const result = await generateGeminiFieldExplanation({
    field, formNumber: "PPTC 153", language: "fr", curated, signal,
  });
  const call = calls[0];
  const context = JSON.parse(call.contents);
  assert.equal(call.model, "test-model");
  assert.equal(call.config.abortSignal, signal);
  assert.equal(call.config.responseMimeType, "application/json");
  assert.match(call.config.systemInstruction, /French/);
  assert.match(call.config.systemInstruction, /untrusted data/);
  assert.equal(context.field.context.question, "Full legal name");
  assert.equal(context.curatedGuidance.meaning, curated.meaning);
  assert.doesNotMatch(call.contents, /test-only|pdfBytes|fieldValue/);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    meaning: "Signification", whatToEnter: "Votre nom", commonMistakes: [],
  });
});