import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import crypto from "node:crypto";
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
    Error,
    AbortController,
    TextDecoder,
    TextEncoder,
    Buffer,
    URL,
    setTimeout,
    clearTimeout,
    ...globals,
  }, { filename: path });
  return exports;
}

const hosts = loadModule("../src/lib/official/hosts.ts", {});
const catalog = loadModule("../src/lib/official/catalog.ts", {
  "./hosts": hosts,
});
const resources = loadModule("../src/lib/catalog/resources.ts", {});
const cancellation = loadModule("../src/lib/abortable.ts", {});
const fetcher = loadModule("../src/lib/official/fetch.ts", {
  "server-only": {},
  "node:dns/promises": dns,
  "node:net": net,
  "node:https": https,
  "./hosts": hosts,
});
const search = loadModule("../src/lib/official/search.ts", {
  "server-only": {},
  "./catalog": catalog,
  "../catalog/resources": resources,
}, {
  process,
  fetch: (...args) => globalThis.fetch(...args),
});
const lookupImports = {
  "server-only": {},
  "node:crypto": crypto,
  "./catalog": catalog,
  "./fetch": fetcher,
  "./hosts": hosts,
  "./search": search,
  "@/lib/abortable": cancellation,
};
const lookup = loadModule("../src/lib/official/lookup.ts", lookupImports);

test("uncatalogued forms directly verify matching pages without assuming a jurisdiction", async () => {
  const selection = {
    publicForm: { number: "CIT 0001", title: "Application for citizenship certificate for adults and minors" },
    facetId: "documents", language: "en",
  };
  const url = "https://www.canada.ca/en/citizenship-application";
  const dependencies = {
    search: async () => ({ candidates: [{ url, sponsored: false }], rejectedSponsored: 0 }),
    fetchPage: async () => ({
      url, title: "Citizenship certificate application", text: "Download the application for a citizenship certificate CIT 0001.",
      language: "en-CA",
    }),
  };
  const result = await lookup.lookupOfficialInformation(selection, undefined, dependencies);
  assert.equal(result.outcome.status, "verified");
  assert.equal(result.outcome.jurisdiction, "federal");
  assert.equal(result.sources[0].jurisdiction, "federal");
  const wrongForm = await lookup.lookupOfficialInformation(selection, undefined, {
    ...dependencies,
    fetchPage: async () => ({ url, title: "Citizenship certificate", text: "Download CIT 0002.", language: "en-CA" }),
  });
  assert.equal(wrongForm.outcome.reason, "no_relevant_pages");
});

test("discovery follows a matching public-form link within the existing page budget", async () => {
  const selection = {
    publicForm: { number: "CIT 0001", title: "Application for citizenship certificate for adults and minors" },
    facetId: "documents", language: "en",
  };
  const start = "https://www.canada.ca/en/citizenship/apply";
  const formUrl = "https://www.canada.ca/en/application-citizenship-certificate-adults-minors.html";
  const fetched = [];
  const result = await lookup.lookupOfficialInformation(selection, undefined, {
    search: async () => ({ candidates: [{ url: start, sponsored: false }], rejectedSponsored: 0 }),
    fetchPage: async (url) => {
      fetched.push(url);
      return url === start ? {
        url, title: "Apply for a citizenship certificate", language: "en-CA",
        text: "Apply on paper by getting the official application package.",
        links: [
          { url: "https://evil.test/cit0001", title: "CIT 0001" },
          { url: "https://www.canada.ca/en/sign-in", title: "CIT 0001" },
          { url: formUrl, title: "Get the application package" },
        ],
      } : {
        url, title: "Citizenship certificate application", text: "Download the CIT 0001 application form here.", language: "en-CA",
      };
    },
  });
  assert.deepEqual(fetched, [start, formUrl]);
  assert.equal(result.outcome.status, "verified");
  assert.equal(result.sources[0].url, formUrl);
});

test("automatic form discovery asks for jurisdiction only when matching pages actually conflict", async () => {
  const selection = { publicForm: { number: "ABC 123" }, facetId: "documents", language: "en" };
  const result = await lookup.lookupOfficialInformation(selection, undefined, {
    search: async () => ({
      candidates: ["https://ontario.ca/abc123", "https://alberta.ca/abc123"].map((url) => ({ url, sponsored: false })),
      rejectedSponsored: 0,
    }),
    fetchPage: async (url) => ({ url, title: "ABC 123 application", text: "Get the ABC 123 form.", language: "en-CA" }),
  });
  assert.equal(result.outcome.status, "clarification_required");
  assert.equal(result.outcome.reason, "missing_jurisdiction");
  assert.equal(result.sources.length, 0);
});

test("the approved registry contains exactly the fourteen jurisdiction roots", () => {
  assert.deepEqual(Array.from(hosts.ALLOWED_ROOTS), [
    "gov.bc.ca", "alberta.ca", "saskatchewan.ca", "gov.mb.ca", "ontario.ca",
    "quebec.ca", "gnb.ca", "novascotia.ca", "gov.nl.ca",
    "princeedwardisland.ca", "yukon.ca", "gov.nt.ca", "gov.nu.ca", "canada.ca",
  ]);
  for (const root of hosts.ALLOWED_ROOTS) {
    assert.ok(hosts.isAllowedHost(root));
    assert.ok(hosts.isAllowedHost(`www.${root}`));
    assert.ok(hosts.isAllowedHost(`deep.service.${root}`));
  }
});

test("official URL policy rejects lookalikes, gc.ca, queries, sign-in and unsafe URLs", () => {
  const allowed = [
    "https://CANADA.CA/services/info",
    "https://www2.gov.bc.ca/service/info",
    "https://service.deep.gov.nu.ca/info",
  ];
  for (const url of allowed) assert.ok(hosts.parseAllowedOfficialUrl(url), url);
  const blocked = [
    "https://evilgov.bc.ca/info",
    "https://gov.bc.ca.evil.test/info",
    "https://canada.ca.evil.test/info",
    "https://services.gc.ca/info",
    "https://canada.ca@evil.test/info",
    "https://user:pass@canada.ca/info",
    "http://canada.ca/info",
    "https://canada.ca:444/info",
    "https://canada.ca./info",
    "https://canada.ca/info?session=secret",
    "https://canada.ca/info#fragment",
    "https://canada.ca/en/account",
    "https://canada.ca/en/sign-in",
    "https://127.0.0.1/info",
    "https://[::1]/info",
    "not a url",
  ];
  for (const url of blocked) assert.equal(hosts.parseAllowedOfficialUrl(url), null, url);
});

const publicAddress = [{ address: "8.8.8.8", family: 4 }];
const longHtml =
  "<html lang='en-CA'><title>Official service page</title><main><p>" +
  "Official information about application steps and public service requirements. ".repeat(3) +
  "</p><script>window.location='https://evil.test'</script><img src='https://evil.test/tracker'>" +
  "</main><meta http-equiv='refresh' content='0;url=https://evil.test'></html>";

test("safe fetch follows only prevalidated official redirects and does not execute page resources", async () => {
  const contacted = [];
  const result = await fetcher.fetchOfficialPage(
    "https://canada.ca/start",
    new AbortController().signal,
    {
      resolve: async () => publicAddress,
      request: async (url, addresses) => {
        contacted.push(url.toString());
        assert.deepEqual(addresses, publicAddress);
        if (url.hostname === "canada.ca") {
          return {
            status: 302,
            headers: { location: "https://www.gov.bc.ca/public/info" },
            body: new Uint8Array(),
          };
        }
        return {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
          body: new TextEncoder().encode(longHtml),
        };
      },
    },
  );
  assert.deepEqual(contacted, [
    "https://canada.ca/start",
    "https://www.gov.bc.ca/public/info",
  ]);
  assert.equal(result.url, "https://www.gov.bc.ca/public/info");
  assert.equal(result.title, "Official service page");
  assert.match(result.text, /Official information about application steps/);
  assert.doesNotMatch(result.text, /window\.location|evil\.test|meta http-equiv/i);
});

test("blocked redirects are rejected before the forbidden destination is contacted", async (t) => {
  const blocked = [
    "https://services.gc.ca/next",
    "https://canada.ca.evil.test/next",
    "http://canada.ca/next",
    "https://canada.ca/en/account",
  ];
  for (const location of blocked) {
    await t.test(location, async () => {
      const contacted = [];
      await assert.rejects(
        fetcher.fetchOfficialPage("https://canada.ca/start", new AbortController().signal, {
          resolve: async () => publicAddress,
          request: async (url) => {
            contacted.push(url.toString());
            return {
              status: 302,
              headers: { location },
              body: new Uint8Array(),
            };
          },
        }),
        (error) => error.reason === "blocked_url",
      );
      assert.deepEqual(contacted, ["https://canada.ca/start"]);
    });
  }
});

test("redirect loops, hop exhaustion, unsupported media and oversized bodies are bounded", async (t) => {
  await t.test("loop", async () => {
    let contacted = 0;
    await assert.rejects(
      fetcher.fetchOfficialPage("https://canada.ca/start", new AbortController().signal, {
        resolve: async () => publicAddress,
        request: async () => {
          contacted += 1;
          return {
            status: 302,
            headers: { location: contacted === 1 ? "/next" : "/start" },
            body: new Uint8Array(),
          };
        },
      }),
      (error) => error.reason === "redirect_loop",
    );
    assert.equal(contacted, 2);
  });
  await t.test("hop limit", async () => {
    let contacted = 0;
    await assert.rejects(
      fetcher.fetchOfficialPage("https://canada.ca/start", new AbortController().signal, {
        resolve: async () => publicAddress,
        request: async () => ({
          status: 302,
          headers: { location: `/hop-${++contacted}` },
          body: new Uint8Array(),
        }),
      }),
      (error) => error.reason === "redirect_limit",
    );
    assert.equal(contacted, 4);
  });
  await t.test("unsupported PDF", async () => {
    await assert.rejects(
      fetcher.fetchOfficialPage("https://canada.ca/form", new AbortController().signal, {
        resolve: async () => publicAddress,
        request: async () => ({
          status: 200,
          headers: { "content-type": "application/pdf" },
          body: new Uint8Array([37, 80, 68, 70]),
        }),
      }),
      (error) => error.reason === "content_type",
    );
  });
  await t.test("oversized body", async () => {
    await assert.rejects(
      fetcher.fetchOfficialPage("https://canada.ca/page", new AbortController().signal, {
        resolve: async () => publicAddress,
        request: async () => ({
          status: 200,
          headers: { "content-type": "text/plain" },
          body: new Uint8Array(1_000_001),
        }),
      }),
      (error) => error.reason === "body_too_large",
    );
  });
});

test("private, loopback and mixed DNS answers never reach the HTTP transport", async (t) => {
  for (const addresses of [
    [{ address: "127.0.0.1", family: 4 }],
    [{ address: "169.254.169.254", family: 4 }],
    [{ address: "10.0.0.1", family: 4 }],
    [{ address: "::1", family: 6 }],
    [{ address: "3fff:00a0::1", family: 6 }],
    [{ address: "2606:4700:4700::1111", family: 6 }, { address: "192.168.1.1", family: 4 }],
  ]) {
    await t.test(addresses.map((item) => item.address).join(","), async () => {
      let requested = false;
      await assert.rejects(
        fetcher.fetchOfficialPage("https://canada.ca/info", new AbortController().signal, {
          resolve: async () => addresses,
          request: async () => { requested = true; throw new Error("must not connect"); },
        }),
        (error) => error.reason === "unsafe_address",
      );
      assert.equal(requested, false);
    });
  }
});

test("the production HTTPS lookup callback pins socket DNS to the validated address", async () => {
  const pinned = [
    { address: "8.8.8.8", family: 4 },
    { address: "2001:4860:4860::8888", family: 6 },
  ];
  const lookupFunction = fetcher.createPinnedLookup(pinned);
  const result = await new Promise((resolve, reject) => {
    lookupFunction("not-resolved-again.example", { family: 4 }, (error, address, family) => {
      if (error) reject(error);
      else resolve({ address, family });
    });
  });
  assert.deepEqual(result, { address: pinned[0].address, family: 4 });
});

test("lookup validates enum-only arguments and constructs no query for invalid IDs", async () => {
  let called = false;
  const invalid = await lookup.lookupOfficialInformation(
    {
      serviceId: "passport",
      jurisdiction: "on",
      facetId: "steps",
      language: "en",
      prompt: "PERSONAL-CANARY",
    },
    new AbortController().signal,
    { search: async () => { called = true; return { candidates: [], rejectedSponsored: 0 }; } },
  );
  assert.equal(invalid.outcome.status, "clarification_required");
  assert.equal(called, false);
});

test("selection requires explicit, token-bounded service and facet mentions in either language", () => {
  const passportSteps = { serviceId: "passport", jurisdiction: "federal", facetId: "steps", language: "en" };
  assert.equal(catalog.selectionIsExplicit("How do I renew my Canadian passports?", passportSteps), true);
  assert.equal(catalog.selectionIsExplicit("I'm using the online service and need steps", {
    serviceId: "social_insurance",
    jurisdiction: "federal",
    facetId: "steps",
    language: "en",
  }), false);
  assert.equal(catalog.selectionIsExplicit("Combien coûte la carte santé en Ontario?", {
    serviceId: "health_card",
    jurisdiction: "on",
    facetId: "fees",
    language: "fr",
  }), true);
});

test("lookup admits only same-jurisdiction policy-approved organic candidates", async () => {
  const fetched = [];
  const result = await lookup.lookupOfficialInformation(
    { serviceId: "passport", jurisdiction: "federal", facetId: "documents", language: "en" },
    new AbortController().signal,
    {
      now: () => new Date("2026-10-29T18:00:00.000Z"),
      search: async () => ({
        rejectedSponsored: 1,
        candidates: [
          { url: "https://canada.ca/en/info?session=NO", sponsored: false },
          { url: "https://example.test/summary", sponsored: false },
          { url: "https://services.gc.ca/official", sponsored: false },
          { url: "https://www.canada.ca/en/service/documents", sponsored: false },
          { url: "https://canada.ca/en/ad", sponsored: true },
        ],
      }),
      fetchPage: async (url) => {
        fetched.push(url);
        return {
          url,
          title: "Canadian passport application instructions",
          text: "Verified Canadian passport application documents and supporting information. ".repeat(8),
          language: "en-CA",
        };
      },
    },
  );
  assert.deepEqual(fetched, ["https://www.canada.ca/en/service/documents"]);
  assert.equal(result.outcome.status, "verified");
  assert.equal(result.outcome.partial, true);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].provenance.kind, "live_official");
  assert.equal(result.sources[0].provenance.retrievedAt, "2026-10-29T18:00:00.000Z");
  assert.equal(result.sources[0].jurisdiction, "federal");
  assert.equal(result.sources[0].facetId, "documents");
});

test("candidates resolving to the same final page produce one source identity", async () => {
  const result = await lookup.lookupOfficialInformation(
    { serviceId: "passport", jurisdiction: "federal", facetId: "overview", language: "en" },
    new AbortController().signal,
    {
      search: async () => ({
        candidates: [
          { url: "https://www.canada.ca/en/service/passport", sponsored: false },
          { url: "https://www.canada.ca/en/service/passports", sponsored: false },
        ],
        rejectedSponsored: 0,
      }),
      fetchPage: async () => ({
        url: "https://www.canada.ca/en/service/canadian-passport",
        title: "Canadian passport information",
        text: "Information about Canadian passport applications and renewal. ".repeat(3),
        language: "en-CA",
        archived: false,
      }),
    },
  );
  assert.equal(result.outcome.status, "verified");
  assert.equal(result.sources.length, 1);
  assert.equal(new Set(result.sources.map((source) => source.id)).size, result.sources.length);
});

test("no-result, provider failure, and failed verification are distinct", async () => {
  const signal = new AbortController().signal;
  const none = await lookup.lookupOfficialInformation(
    { serviceId: "health_card", jurisdiction: "on", facetId: "overview", language: "en" },
    signal,
    { search: async () => ({ candidates: [{ url: "https://evil.test", sponsored: false }], rejectedSponsored: 0 }) },
  );
  assert.equal(none.outcome.status, "no_verified_results");

  const searchFailure = await lookup.lookupOfficialInformation(
    { serviceId: "health_card", jurisdiction: "on", facetId: "overview", language: "en" },
    signal,
    { search: async () => { throw new Error("private provider failure"); } },
  );
  assert.equal(searchFailure.outcome.status, "unavailable");
  assert.equal(searchFailure.outcome.reason, "search_failed");

  const fetchFailure = await lookup.lookupOfficialInformation(
    { serviceId: "health_card", jurisdiction: "on", facetId: "overview", language: "en" },
    signal,
    {
      search: async () => ({ candidates: [{ url: "https://www.ontario.ca/page", sponsored: false }], rejectedSponsored: 0 }),
      fetchPage: async () => { throw new Error("private fetch failure"); },
    },
  );
  assert.equal(fetchFailure.outcome.status, "unavailable");
  assert.equal(fetchFailure.outcome.reason, "fetch_failed");
});

test("unrelated official content is not admitted as evidence", async () => {
  const result = await lookup.lookupOfficialInformation(
    { serviceId: "health_card", jurisdiction: "on", facetId: "steps", language: "en" },
    new AbortController().signal,
    {
      search: async () => ({
        candidates: [{ url: "https://www.ontario.ca/page", sponsored: false }],
        rejectedSponsored: 0,
      }),
      fetchPage: async (url) => ({
        url,
        title: "Ontario parks",
        text: "Information about provincial parks and campsite reservations. ".repeat(5),
        language: "en-CA",
      }),
    },
  );
  assert.equal(result.outcome.status, "no_verified_results");
  assert.equal(result.outcome.reason, "no_relevant_pages");
});

test("service evidence matches whole keywords rather than SIN inside ordinary words", async (t) => {
  for (const [text, expectedStatus] of [
    ["Information about using the online campsite reservation service. ".repeat(3), "no_verified_results"],
    ["Information about camping cuisine and single campsite reservations. ".repeat(3), "no_verified_results"],
    ["Apply for your Social Insurance Number using the official SIN application instructions. ".repeat(3), "verified"],
  ]) {
    await t.test(text.slice(0, 80), async () => {
      const url = "https://www.canada.ca/en/service/information";
      const result = await lookup.lookupOfficialInformation(
        { serviceId: "social_insurance", jurisdiction: "federal", facetId: "steps", language: "en" },
        new AbortController().signal,
        {
          search: async () => ({ candidates: [{ url, sponsored: false }], rejectedSponsored: 0 }),
          fetchPage: async (candidate, signal) => fetcher.fetchOfficialPage(candidate, signal, {
            resolve: async () => publicAddress,
            request: async () => ({
              status: 200,
              headers: { "content-type": "text/html" },
              body: new TextEncoder().encode(`<html><title>Service information</title><main>${text}</main></html>`),
            }),
          }),
        },
      );
      assert.equal(result.outcome.status, expectedStatus);
      assert.equal(result.sources.length, expectedStatus === "verified" ? 1 : 0);
    });
  }
});

test("document-level archive notices survive main-content extraction", async (t) => {
  for (const [language, notice] of [
    ["en", "This page is archived and is no longer updated."],
    ["fr", "Cette page est archivée et ne sera plus mise à jour."],
  ]) {
    await t.test(language, async () => {
      const url = "https://www.canada.ca/en/service/passport-fees";
      const result = await lookup.lookupOfficialInformation(
        { serviceId: "passport", jurisdiction: "federal", facetId: "fees", language },
        new AbortController().signal,
        {
          search: async () => ({ candidates: [{ url, sponsored: false }], rejectedSponsored: 0 }),
          fetchPage: async (candidate, signal) => fetcher.fetchOfficialPage(candidate, signal, {
            resolve: async () => publicAddress,
            request: async () => ({
              status: 200,
              headers: { "content-type": "text/html" },
              body: new TextEncoder().encode(
                `<html lang="${language}"><title>Passport fees</title><aside>${notice}</aside>` +
                `<main>${"Official passport fees and application instructions. ".repeat(4)}</main></html>`,
              ),
            }),
          }),
        },
      );
      assert.equal(result.outcome.status, "no_verified_results");
      assert.equal(result.outcome.reason, "no_relevant_pages");
      assert.equal(result.sources.length, 0);
    });
  }
});

test("archived pages are not current evidence and fetch budgets disclose partial checks", async (t) => {
  await t.test("archived source excluded", async () => {
    const result = await lookup.lookupOfficialInformation(
      { serviceId: "health_card", jurisdiction: "on", facetId: "steps", language: "en" },
      new AbortController().signal,
      {
        search: async () => ({
          candidates: [{ url: "https://www.ontario.ca/page", sponsored: false }],
          rejectedSponsored: 0,
        }),
        fetchPage: async (url) => ({
          url,
          title: "Archived content — Ontario health card",
          text: "Information about health card application steps. ".repeat(5),
          language: "en-CA",
        }),
      },
    );
    assert.equal(result.outcome.status, "no_verified_results");
  });
  await t.test("three fetch limit and concurrency", async () => {
    let active = 0;
    let peak = 0;
    let calls = 0;
    const result = await lookup.lookupOfficialInformation(
      { serviceId: "health_card", jurisdiction: "on", facetId: "steps", language: "en" },
      new AbortController().signal,
      {
        search: async () => ({
          candidates: Array.from({ length: 5 }, (_, i) => ({
            url: `https://www.ontario.ca/page/health-card-${i}`,
            sponsored: false,
          })),
          rejectedSponsored: 0,
        }),
        fetchPage: async (url) => {
          calls += 1;
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
          return {
            url,
            title: "Ontario health card application steps",
            text: "Ontario health card application steps. ".repeat(5),
            language: "en-CA",
          };
        },
      },
    );
    assert.equal(calls, 3);
    assert.equal(peak, 2);
    assert.equal(result.sources.length, 3);
    assert.equal(result.outcome.partial, true);
  });
});

test("missing provider credential is an explicit unavailable outcome", async () => {
  const previous = process.env.SERPER_API_KEY;
  delete process.env.SERPER_API_KEY;
  try {
    const result = await lookup.lookupOfficialInformation(
      { serviceId: "health_card", jurisdiction: "on", facetId: "overview", language: "en" },
      new AbortController().signal,
    );
    assert.equal(result.outcome.status, "unavailable");
    assert.equal(result.outcome.reason, "provider_not_configured");
    assert.equal(result.sources.length, 0);
  } finally {
    if (previous === undefined) delete process.env.SERPER_API_KEY;
    else process.env.SERPER_API_KEY = previous;
  }
});

test("Serper adapter sends canonical catalog keywords, not user-supplied canaries", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SERPER_API_KEY;
  process.env.SERPER_API_KEY = "test-only";
  globalThis.fetch = async (input, init) => {
    calls.push({ url: new URL(input), init });
    return new Response(JSON.stringify({
      organic: [
        { link: "https://www.ontario.ca/page", is_sponsored: true },
        { link: "https://www.ontario.ca/info", is_sponsored: false },
        { link: "https://evil.test/summary", is_sponsored: false },
      ],
      summary: { text: "AI answer must not be used" },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await search.searchOfficialCandidates(
      { serviceId: "health_card", jurisdiction: "on", facetId: "steps", language: "en" },
      new AbortController().signal,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.origin, "https://google.serper.dev");
    const query = JSON.parse(calls[0].init.body).q;
    assert.match(query, /^site:ontario\.ca Ontario health card health coverage how to apply application steps$/);
    assert.doesNotMatch(query, /PERSONAL-CANARY|file\.pdf|chat-history/);
    assert.equal(calls[0].init.cache, "no-store");
    assert.equal(calls[0].init.redirect, "error");
    assert.equal(result.rejectedSponsored, 1);
    assert.deepEqual(Array.from(result.candidates, (candidate) => candidate.url), [
      "https://www.ontario.ca/info",
      "https://evil.test/summary",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SERPER_API_KEY;
    else process.env.SERPER_API_KEY = originalKey;
  }
});

const studentSelection = {
  serviceId: "student_aid", jurisdiction: "sk", facetId: "documents", language: "en", formId: "sk154091",
};
const studentPage = {
  url: catalog.PUBLIC_FORMS.sk154091.url,
  title: "2026-27 Full-Time Saskatchewan Student Aid forms",
  text: "2026-27 Full-Time Saskatchewan Student Aid forms. Download the full-time application for this study year.",
  language: "en-CA",
};
const quotaResult = {
  outcome: { status: "unavailable", reason: "grounding_quota", partial: false, method: "google_grounding" },
  sources: [],
};

test("registered Student Aid pages use direct verification before any search fallback", async () => {
  const fetched = [];
  const result = await lookup.lookupOfficialWithFallback(studentSelection, undefined,
    async () => assert.fail("A verified direct result must not call Google"),
    {
      search: async () => assert.fail("A registered download has its own fixed page"),
      fetchPage: async (url) => { fetched.push(url); return studentPage; },
    },
  );
  assert.deepEqual(fetched, [studentPage.url]);
  assert.equal(result.outcome.status, "verified");
  assert.equal(result.outcome.method, "official_page");
  assert.equal(result.outcome.fallbackReason, undefined);
  assert.equal(result.sources[0].provenance.kind, "live_official");
  assert.match(result.sources[0].evidence, /2026-27 Full-Time/);
});

test("failed direct fetch invokes Google once with the same public selection and retains the first failure", async () => {
  const order = [];
  const controller = new AbortController();
  const result = await lookup.lookupOfficialWithFallback(studentSelection, controller.signal,
    async (selection, signal) => {
      order.push("google");
      assert.equal(selection, studentSelection);
      assert.equal(signal, controller.signal);
      assert.equal(signal.aborted, false);
      return quotaResult;
    },
    { fetchPage: async () => { order.push("direct"); throw new fetcher.OfficialFetchError("network_failed"); } },
  );
  assert.deepEqual(order, ["direct", "google"]);
  assert.equal(result.outcome.reason, "grounding_quota");
  assert.equal(result.outcome.fallbackReason, "fetch_failed");
  assert.equal(result.sources.length, 0);
});

test("wrong study years, part-time forms and archived pages use fallback, never direct evidence", async () => {
  for (const page of [
    { ...studentPage, title: "2025-26 Full-Time Saskatchewan Student Aid", text: "2025-26 Full-Time Saskatchewan Student Aid forms." },
    { ...studentPage, title: "2026-27 Part-Time Saskatchewan Student Aid", text: "2026-27 Part-Time Saskatchewan Student Aid forms." },
    { ...studentPage, archived: true },
  ]) {
    let fallbacks = 0;
    const result = await lookup.lookupOfficialWithFallback(studentSelection, undefined,
      async () => { fallbacks += 1; return quotaResult; },
      { fetchPage: async () => page },
    );
    assert.equal(fallbacks, 1);
    assert.equal(result.outcome.fallbackReason, "no_relevant_pages");
    assert.equal(result.sources.length, 0);
  }
});

test("clarification and parent cancellation never start a Google fallback", async () => {
  const fallback = async () => assert.fail("Do not search after clarification or cancellation");
  const invalid = await lookup.lookupOfficialWithFallback({ ...studentSelection, query: "PRIVATE-CANARY" }, undefined, fallback);
  assert.equal(invalid.outcome.status, "clarification_required");
  const controller = new AbortController();
  const cancelled = await lookup.lookupOfficialWithFallback(studentSelection, controller.signal, fallback, {
    fetchPage: async () => { controller.abort(); throw new Error("cancelled"); },
  });
  assert.equal(cancelled.outcome.reason, "deadline");
  assert.equal(cancelled.outcome.method, "official_page");
});

test("the direct sub-budget expires without aborting the parent's Google fallback signal", async () => {
  const timed = loadModule("../src/lib/official/lookup.ts", lookupImports, {
    setTimeout(callback, milliseconds) {
      assert.equal(milliseconds, 10_000);
      return setTimeout(callback, 10);
    },
  });
  const parent = new AbortController();
  let directSignal;
  const result = await timed.lookupOfficialWithFallback(studentSelection, parent.signal,
    async (_selection, signal) => {
      assert.equal(signal, parent.signal);
      assert.equal(signal.aborted, false);
      assert.equal(directSignal.aborted, true);
      return quotaResult;
    },
    { fetchPage: async (_url, signal) => { directSignal = signal; return new Promise(() => {}); } },
  );
  assert.equal(result.outcome.fallbackReason, "deadline");
});

test("mapped personal income tax lookup works without a search key when direct fetch succeeds", async () => {
  const previous = process.env.SERPER_API_KEY;
  delete process.env.SERPER_API_KEY;
  try {
    const result = await lookup.lookupOfficialWithFallback(
      { serviceId: "income_tax", jurisdiction: "federal", facetId: "overview", language: "en" },
      undefined, async () => assert.fail("Mapped tax page must be tried and used first"),
      { fetchPage: async (url) => ({
        url, title: "Personal income tax",
        text: "Personal income tax filing instructions and current official information.",
        language: "en-CA",
      }) },
    );
    assert.equal(result.outcome.method, "official_page");
    assert.equal(result.outcome.status, "verified");
    assert.match(result.sources[0].url, /personal-income-tax/);
  } finally {
    if (previous === undefined) delete process.env.SERPER_API_KEY;
    else process.env.SERPER_API_KEY = previous;
  }
});
