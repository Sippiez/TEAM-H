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
    exports, URL, TextDecoder, TextEncoder, AbortController, setTimeout, clearTimeout, Error,
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
const resources = load("../src/lib/catalog/resources.ts", {});
const cancellation = load("../src/lib/abortable.ts", {});
const selection = { serviceId: "health_card", jurisdiction: "on", facetId: "steps", language: "en" };

function setup({ env = { SERPER_API_KEY: "test-secret" }, response, fetchPage } = {}) {
  const requests = [];
  const search = load("../src/lib/official/search.ts", {
    "server-only": {}, "./catalog": catalog, "../catalog/resources": resources,
  }, {
    process: { env },
    fetch: async (url, init) => {
      requests.push({ url: String(url), ...init });
      return response ? response(url, init) : new Response(JSON.stringify({
        organic: [{ title: "Health card", link: "https://www.ontario.ca/page/health-card", snippet: "Not evidence" }],
      }));
    },
  });
  const lookup = load("../src/lib/official/lookup.ts", {
    "server-only": {}, "node:crypto": crypto, "./catalog": catalog, "./hosts": hosts,
    "./search": search, "@/lib/abortable": cancellation,
    "./fetch": {
      fetchOfficialPage: fetchPage ?? (async (url) => ({
        url, title: "Ontario health card", text: "Ontario health card application steps.", language: "en-CA",
      })),
      isArchivedPage: (page) => page.archived === true,
      OfficialFetchError: class extends Error {},
    },
  });
  return { ...search, ...lookup, requests };
}

test("Serper uses a server-side POST with public canonical terms, language and cancellation", async () => {
  const api = setup();
  const controller = new AbortController();
  const result = await api.searchSerperCandidates(selection, controller.signal);
  assert.equal(api.requests.length, 1);
  const request = api.requests[0];
  assert.equal(request.url, "https://google.serper.dev/search");
  assert.equal(request.method, "POST");
  assert.equal(request.headers["X-API-KEY"], "test-secret");
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.equal(request.signal, controller.signal);
  assert.equal(request.cache, "no-store");
  assert.equal(request.redirect, "error");
  assert.equal(request.credentials, "omit");
  assert.deepEqual(JSON.parse(request.body), {
    q: "site:ontario.ca Ontario health card health coverage how to apply application steps",
    gl: "ca", hl: "en", num: 5,
  });
  assert.equal(result.method, "search");
  assert.equal(result.candidates[0].url, "https://www.ontario.ca/page/health-card");
  assert.equal(result.candidates[0].snippet, undefined);
});

test("public-form search considers only approved roots, never arbitrary request fields", async () => {
  const api = setup();
  await api.searchSerperCandidates({
    publicForm: { number: "ABC 123", title: "Application for accessibility assistance" },
    facetId: "documents", language: "fr",
    message: "PRIVATE-QUESTION", fileName: "PRIVATE-FILENAME", history: "PRIVATE-HISTORY",
  }, new AbortController().signal);
  const body = JSON.parse(api.requests[0].body);
  for (const root of hosts.ALLOWED_ROOTS) assert.ok(body.q.includes(`site:${root}`));
  assert.match(body.q, /ABC 123 Application for accessibility assistance/);
  assert.equal(body.hl, "fr");
  assert.doesNotMatch(JSON.stringify(api.requests), /PRIVATE-/);
});

test("Serper ignores ads, snippets and answer boxes, and bounds organic candidates", async () => {
  const api = setup({
    response: async () => new Response(JSON.stringify({
      ads: [{ link: "https://ontario.ca/ad" }],
      answerBox: { answer: "Unsupported answer" },
      organic: [
        { link: "https://ontario.ca/sponsored", is_sponsored: true },
        null, { link: 42 },
        ...Array.from({ length: 10 }, (_, i) => ({ link: `https://ontario.ca/page-${i}`, snippet: "Not evidence" })),
      ],
    })),
  });
  const result = await api.searchSerperCandidates(selection, new AbortController().signal);
  assert.equal(result.candidates.length, 5);
  assert.equal(result.rejectedSponsored, 1);
  assert.ok(result.candidates.every((candidate) => !candidate.url.includes("ad") && !candidate.url.includes("sponsored")));
});

test("missing credentials, quota, authentication and malformed responses are explicit", async () => {
  for (const [status, reason] of [[429, "search_quota"], [402, "search_quota"], [401, "search_auth"], [403, "search_auth"], [500, "search_failed"]]) {
    const api = setup({ response: async () => new Response("PRIVATE-PROVIDER-ERROR", { status }) });
    const result = await api.lookupOfficialWithSerper(selection);
    assert.equal(result.outcome.status, "unavailable");
    assert.equal(result.outcome.reason, reason);
    assert.equal(result.sources.length, 0);
    assert.equal(api.requests.length, 1, "Do not repeat a failed search or invoke Gemini grounding");
  }
  const missing = setup({ env: {} });
  assert.equal((await missing.lookupOfficialWithSerper(selection)).outcome.reason, "provider_not_configured");
  assert.equal(missing.requests.length, 0);
  for (const body of ["null", "{}", '{"organic":{}}', "not json", "x".repeat(256_001)]) {
    const api = setup({ response: async () => new Response(body) });
    assert.equal((await api.lookupOfficialWithSerper(selection)).outcome.reason, "search_failed");
  }
});

test("direct mapped pages cost no search credits; failure searches Serper once and verifies the result", async () => {
  const args = { serviceId: "student_aid", jurisdiction: "sk", facetId: "documents", formId: "sk154091", language: "en" };
  const alternate = "https://www.saskatchewan.ca/student-aid/forms";
  const page = (url) => ({
    url, title: "2026-27 Full-Time Saskatchewan Student Aid forms",
    text: "Download the 2026-27 Full-Time Saskatchewan Student Aid application.", language: "en-CA",
  });
  const direct = setup({ fetchPage: async (url) => page(url) });
  assert.equal((await direct.lookupOfficialWithSerper(args)).outcome.status, "verified");
  assert.equal(direct.requests.length, 0);
  const fetched = [];
  const fallback = setup({
    response: async () => new Response(JSON.stringify({ organic: [{ link: alternate }] })),
    fetchPage: async (url) => {
      fetched.push(url);
      if (url !== alternate) throw new Error("TLS failure");
      return page(url);
    },
  });
  const result = await fallback.lookupOfficialWithSerper(args);
  assert.equal(fallback.requests.length, 1);
  assert.equal(fetched.length, 2);
  assert.equal(result.outcome.status, "verified");
  assert.equal(result.outcome.method, "search");
  assert.equal(result.outcome.fallbackReason, "fetch_failed");
  assert.equal(result.sources[0].provenance.kind, "live_official");
  assert.equal(result.sources[0].url, alternate);
});

test("unapproved URLs and snippets never bypass official-page verification", async () => {
  let fetches = 0;
  const blocked = setup({
    response: async () => new Response(JSON.stringify({ organic: [
      { link: "https://evil.test/info" }, { link: "https://alberta.ca/health-card" },
      { link: "https://ontario.ca/sign-in" },
    ] })),
    fetchPage: async () => { fetches++; assert.fail("Blocked result must not be fetched"); },
  });
  assert.equal((await blocked.lookupOfficialWithSerper(selection)).outcome.reason, "no_allowed_candidates");
  assert.equal(fetches, 0);
  const failed = setup({ fetchPage: async () => { throw new Error("TLS failure"); } });
  const result = await failed.lookupOfficialWithSerper(selection);
  assert.equal(result.outcome.reason, "fetch_failed");
  assert.equal(result.answer, undefined);
  assert.equal(result.sources.length, 0);
  assert.equal(failed.requests.length, 1);
});

test("HTTP links returned by the search index are upgraded before HTTPS-only verification", async () => {
  const fetched = [];
  const api = setup({
    response: async () => new Response(JSON.stringify({ organic: [
      { link: "http://www.ontario.ca/page/apply-ohip-and-get-health-card" },
      { link: "http://www.ontario.ca.evil.test/info" },
      { link: "http://www.ontario.ca:8080/info" },
    ] })),
    fetchPage: async (url) => {
      fetched.push(url);
      return { url, title: "Ontario health card", text: "Ontario health card application steps.", language: "en-CA" };
    },
  });
  const result = await api.lookupOfficialWithSerper(selection);
  assert.equal(result.outcome.status, "verified");
  assert.deepEqual(fetched, ["https://www.ontario.ca/page/apply-ohip-and-get-health-card"]);
  assert.equal(result.sources[0].provenance.kind, "live_official");
});

test("clarification and cancellation never trigger search; in-flight work is bounded", async () => {
  const api = setup();
  assert.equal((await api.lookupOfficialWithSerper({ ...selection, query: "private" })).outcome.status, "clarification_required");
  const controller = new AbortController();
  controller.abort();
  assert.equal((await api.lookupOfficialWithSerper(selection, controller.signal)).outcome.reason, "deadline");
  assert.equal(api.requests.length, 0);
  const stalled = setup({ response: async () => new Promise(() => {}) });
  const parent = new AbortController();
  const pending = stalled.lookupOfficialWithSerper(selection, parent.signal);
  parent.abort();
  assert.equal((await pending).outcome.reason, "deadline");
  assert.equal(stalled.requests.length, 1);
});
