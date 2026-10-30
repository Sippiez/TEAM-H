import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";

function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, URL, Buffer, TextDecoder, AbortController, setTimeout, clearTimeout,
    console: { error() {} },
    require(name) {
      assert.ok(Object.hasOwn(imports, name), name);
      return imports[name];
    },
    ...globals,
  });
  return exports;
}
const hosts = load("../src/lib/official/hosts.ts", {});
const catalog = load("../src/lib/official/catalog.ts", { "./hosts": hosts });
const cancellation = load("../src/lib/abortable.ts", {});
const { lookupGoogleGrounding } = load("../src/lib/official/grounding.ts", {
  "server-only": {}, "node:crypto": crypto, "./catalog": catalog, "./hosts": hosts,
  "@/lib/abortable": cancellation,
}, { fetch: (...args) => globalThis.fetch(...args) });
const selection = { serviceId: "student_aid", jurisdiction: "sk", facetId: "documents", formId: "sk154091", language: "en" };
const official = catalog.PUBLIC_FORMS.sk154091.url;
const gateway = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/ABCD_123-xyz";
const text = "Download the 2026-27 full-time Saskatchewan Student Aid application from the official forms page.";
function groundedResponse({
  answer = text,
  urls = [official],
  supports,
} = {}) {
  return {
    candidates: [{
      finishReason: "STOP",
      content: { parts: [{ text: answer }] },
      groundingMetadata: {
        webSearchQueries: ["site:saskatchewan.ca 2026-27 full-time student aid"],
        searchEntryPoint: { renderedContent: "<div>Search suggestions</div>" },
        groundingChunks: urls.map((uri) => ({ web: { uri, title: "Saskatchewan Student Aid forms" } })),
        groundingSupports: supports ?? [{
          segment: { startIndex: 0, endIndex: Buffer.byteLength(answer), text: answer },
          groundingChunkIndices: urls.map((_, index) => index),
        }],
      },
    }],
  };
}
const generate = async () => groundedResponse();

test("automatic form discovery searches all approved roots and derives jurisdiction from citations", async () => {
  const number = "CIT 0001";
  const title = "Application for citizenship certificate for adults and minors";
  const url = "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/cit0001.html";
  const result = await lookupGoogleGrounding({
    publicForm: { number, title }, facetId: "documents", language: "en",
  }, undefined, {
    generate: async (prompt) => {
      assert.match(prompt, /CIT 0001/);
      assert.match(prompt, /Application for citizenship certificate/);
      for (const root of hosts.ALLOWED_ROOTS) assert.ok(prompt.includes(`site:${root}`));
      return groundedResponse({ answer: `Get ${number} from its official application page.`, urls: [url] });
    },
  });
  assert.equal(result.outcome.status, "verified");
  assert.equal(result.outcome.jurisdiction, "federal");
  assert.equal(result.sources[0].jurisdiction, "federal");
  const blocked = await lookupGoogleGrounding({
    publicForm: { number, title }, facetId: "documents", language: "en",
  }, undefined, {
    generate: async () => groundedResponse({ answer: number, urls: [url, "https://evil.test/cit0001"] }),
  });
  assert.equal(blocked.outcome.reason, "blocked_grounding_sources");
});

test("Google grounding provides dated provider provenance without fetching government pages", async () => {
  const result = await lookupGoogleGrounding(selection, undefined, {
    generate: async (prompt, signal) => {
      assert.match(prompt, /site:saskatchewan\.ca/);
      assert.match(prompt, /154091/);
      assert.match(prompt, /Full-Time Post-Secondary Student Saskatchewan Student Aid 2026-27/);
      assert.doesNotMatch(prompt, /PRIVATE-CANARY|file\.pdf/);
      assert.equal(signal.aborted, false);
      return groundedResponse();
    },
    resolveCitation: async () => assert.fail("Direct official citations require no HTTP request"),
    now: () => new Date("2026-10-29T20:00:00Z"),
  });
  assert.equal(result.outcome.status, "verified");
  assert.equal(result.outcome.method, "google_grounding");
  assert.equal(result.answer, `${text} [1]`);
  assert.equal(result.sources[0].url, official);
  assert.equal(result.sources[0].provenance.kind, "google_grounded");
  assert.equal(result.sources[0].provenance.searchedAt, "2026-10-29T20:00:00.000Z");
  assert.equal(result.sources[0].language, undefined);
  assert.equal(result.outcome.searchSuggestionsHtml, "<div>Search suggestions</div>");
});

test("only fixed Google citation redirects are resolved, never the official destination", async () => {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(null, { status: 302, headers: { location: official } });
  };
  try {
    const result = await lookupGoogleGrounding(selection, undefined, {
      generate: async () => groundedResponse({ urls: [gateway] }),
    });
    assert.equal(result.outcome.status, "verified");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, gateway);
    assert.equal(calls[0].init.redirect, "manual");
    assert.equal(calls[0].init.method, "HEAD");
    assert.equal(calls[0].init.credentials, "omit");
    assert.equal(result.sources[0].url, official);
    assert.equal(result.sources[0].citationUrl, gateway);
  } finally { globalThis.fetch = previous; }
});

test("Google redirect policy never broadens the approved content roots", async () => {
  for (const url of [
    "https://vertexaisearch.cloud.google.com.evil.test/grounding-api-redirect/ABCD",
    "https://vertexaisearch.cloud.google.com/other/ABCD",
    "https://vertexaisearch.cloud.google.com/grounding-api-redirect/ABCD?url=evil",
    "https://user:password@vertexaisearch.cloud.google.com/grounding-api-redirect/ABCD",
    "http://vertexaisearch.cloud.google.com/grounding-api-redirect/ABCD",
  ]) {
    assert.equal(hosts.isGoogleGroundingRedirect(url), false);
    const result = await lookupGoogleGrounding(selection, undefined, {
      generate: async () => groundedResponse({ urls: [url] }),
      resolveCitation: async () => assert.fail("Invalid citation gateway must not be contacted"),
    });
    assert.equal(result.outcome.status, "no_verified_results");
  }
  assert.equal(hosts.isAllowedHost("vertexaisearch.cloud.google.com"), false);
});

test("mixed, excluded, wrong-jurisdiction and unsafe sources reject the whole answer", async () => {
  for (const url of [
    "https://evil.test/info", "https://catalogue.servicecanada.gc.ca/form",
    "https://www.canada.ca/en/service", "https://saskatchewan.ca.evil.test/info",
    "https://www.saskatchewan.ca/portal", "https://www.saskatchewan.ca/info?session=secret",
  ]) {
    const result = await lookupGoogleGrounding(selection, undefined, {
      generate: async () => groundedResponse({ urls: [official, url] }),
    });
    assert.equal(result.outcome.reason, "blocked_grounding_sources");
    assert.equal(result.sources.length, 0);
    assert.equal(result.answer, undefined);
  }
  const redirected = await lookupGoogleGrounding(selection, undefined, {
    generate: async () => groundedResponse({ urls: [gateway] }),
    resolveCitation: async () => "https://evil.test/",
  });
  assert.equal(redirected.outcome.reason, "blocked_grounding_sources");
});

test("missing search metadata, supports, suggestions, truncation and forged citations never become answers", async () => {
  for (const mutate of [
    (value) => { delete value.candidates[0].groundingMetadata; },
    (value) => { value.candidates[0].groundingMetadata.webSearchQueries = []; },
    (value) => { value.candidates[0].groundingMetadata.groundingSupports = []; },
    (value) => { delete value.candidates[0].groundingMetadata.searchEntryPoint; },
    (value) => { value.candidates[0].finishReason = "MAX_TOKENS"; },
    (value) => { value.candidates[0].groundingMetadata.groundingSupports[0].groundingChunkIndices = [99]; },
    (value) => { value.candidates[0].groundingMetadata.groundingSupports[0].segment.endIndex = 99_999; },
    (value) => { value.candidates[0].groundingMetadata.groundingSupports[0].segment.text = "Forged support"; },
  ]) {
    const response = groundedResponse();
    mutate(response);
    const result = await lookupGoogleGrounding(selection, undefined, { generate: async () => response });
    assert.equal(result.outcome.status, "no_verified_results");
    assert.equal(result.answer, undefined);
  }
});

test("UTF-8 byte offsets, repeated references and duplicate source URLs keep citation numbering correct", async () => {
  const answer = "Québec 😀. Étudiants.";
  const result = await lookupGoogleGrounding(
    { serviceId: "student_aid", jurisdiction: "qc", facetId: "overview", language: "fr" }, undefined, {
      generate: async () => groundedResponse({
        answer, urls: ["https://quebec.ca/education", "https://quebec.ca/education"],
        supports: [
          { segment: { startIndex: 0, endIndex: Buffer.byteLength("Québec 😀."), text: "Québec 😀." }, groundingChunkIndices: [0, 1] },
          { segment: { startIndex: Buffer.byteLength("Québec 😀. "), endIndex: Buffer.byteLength(answer), text: "Étudiants." }, groundingChunkIndices: [1] },
        ],
      }),
    },
  );
  assert.equal(result.answer, "Québec 😀. [1] Étudiants. [1]");
  assert.equal(result.sources.length, 1);
});

test("unsupported body URLs are rejected instead of being silently stripped", async () => {
  const result = await lookupGoogleGrounding(selection, undefined, {
    generate: async () => groundedResponse({ answer: `${text} https://evil.test/download` }),
  });
  assert.equal(result.outcome.reason, "blocked_grounding_sources");
});

test("quota and network failures are explicit with no ungrounded or local-fetch fallback", async () => {
  for (const [status, reason] of [[429, "grounding_quota"], [403, "grounding_failed"], [503, "grounding_failed"]]) {
    const result = await lookupGoogleGrounding(selection, undefined, {
      generate: async () => { throw Object.assign(new Error("PRIVATE-ERROR-CANARY"), { status }); },
    });
    assert.equal(result.outcome.status, "unavailable");
    assert.equal(result.outcome.reason, reason);
    assert.equal(result.answer, undefined);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE-ERROR-CANARY/);
  }
});

test("invalid arguments and already-aborted requests do not call Google", async () => {
  const dependencies = { generate: async () => assert.fail("Provider must not be called") };
  assert.equal((await lookupGoogleGrounding({ ...selection, query: "PRIVATE-CANARY" }, undefined, dependencies)).outcome.reason, "invalid_selection");
  const controller = new AbortController();
  controller.abort();
  assert.equal((await lookupGoogleGrounding(selection, controller.signal, dependencies)).outcome.reason, "deadline");
});

test("parent cancellation reaches the provider and becomes a deadline outcome", async () => {
  const controller = new AbortController();
  const result = await lookupGoogleGrounding(selection, controller.signal, {
    generate: async (_prompt, signal) => {
      controller.abort();
      signal.throwIfAborted();
      return generate();
    },
  });
  assert.equal(result.outcome.reason, "deadline");
});

test("cancellation returns even when the provider ignores the abort signal", async () => {
  const controller = new AbortController();
  const result = await lookupGoogleGrounding(selection, controller.signal, {
    generate: () => {
      queueMicrotask(() => controller.abort());
      return new Promise(() => {});
    },
  });
  assert.equal(result.outcome.reason, "deadline");
});

test("the grounding sub-budget also bounds a citation resolver that ignores cancellation", async () => {
  const timed = load("../src/lib/official/grounding.ts", {
    "server-only": {}, "node:crypto": crypto, "./catalog": catalog, "./hosts": hosts,
    "@/lib/abortable": cancellation,
  }, {
    setTimeout(callback, milliseconds) {
      assert.equal(milliseconds, 20_000);
      return setTimeout(callback, 10);
    },
  }).lookupGoogleGrounding;
  const result = await timed(selection, undefined, {
    generate: async () => groundedResponse({ urls: [gateway] }),
    resolveCitation: () => new Promise(() => {}),
  });
  assert.equal(result.outcome.reason, "deadline");
});

test("multipart citation offsets exclude thought parts and preserve UTF-8 boundaries", async () => {
  const response = groundedResponse();
  response.candidates[0].content.parts = [
    { text: "Internal thought.", thought: true },
    { text: "Read this. " },
    { text: "Québec 😀." },
  ];
  response.candidates[0].groundingMetadata.groundingSupports = [{
    segment: { partIndex: 2, startIndex: 0, endIndex: Buffer.byteLength("Québec 😀."), text: "Québec 😀." },
    groundingChunkIndices: [0],
  }];
  const result = await lookupGoogleGrounding(selection, undefined, { generate: async () => response });
  assert.equal(result.answer, "Read this. Québec 😀. [1]");
  assert.doesNotMatch(result.answer, /Internal thought/);
});
