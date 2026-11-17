import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";

function chatPanel(language) {
  const cache = new Map();
  const root = new URL("../src/", import.meta.url);
  function load(url) {
    if (!existsSync(url)) {
      url = new URL(`${url.href}.ts`);
      if (!existsSync(url)) url = new URL(`${url.href.slice(0, -3)}.tsx`);
    }
    if (cache.has(url.href)) return cache.get(url.href);
    const exports = {};
    cache.set(url.href, exports);
    const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    vm.runInNewContext(outputText, {
      exports, URL,
      require(name) {
        if (name === "react") return { ...React, useSyncExternalStore: () => language };
        if (name === "react/jsx-runtime") return jsxRuntime;
        if (name === "lucide-react") return icons;
        if (name === "cn") return { cn: (...values) => values.filter(Boolean).join(" ") };
        if (name.startsWith("@/")) return load(new URL(name.slice(2), root));
        if (name.startsWith(".")) return load(new URL(name, url));
        throw new Error(`Unexpected import: ${name}`);
      },
    }, { filename: url.pathname });
    return exports;
  }
  return load(new URL("components/form-helper/chat-panel.tsx", root)).ChatPanel;
}

const Panels = { en: chatPanel("en"), fr: chatPanel("fr") };
function render(message, language = "en", props = {}) {
  return renderToStaticMarkup(React.createElement(Panels[language], {
    id: "test-chat",
    messages: [{ id: "reply-1", role: "assistant", text: "", request: { message: "Original question" }, ...message }],
    pending: false,
    suggestions: [],
    placeholder: "",
    inputLabel: "Question",
    onSend() {},
    onRetry() {},
    onResolve() {},
    ...props,
  }));
}

test("saved links retain renewal scope when live lookup is unavailable", () => {
  const html = render({ lookup: {
    status: "unavailable", reason: "fetch_failed", partial: false,
    serviceId: "passport", jurisdiction: "federal", facetId: "steps", passportMode: "renewal",
  } });
  assert.match(html, /\/renew-adult-passport\.html/);
  assert.doesNotMatch(html, /\/new-adult-passport/);
});

test("complete direct lookups keep source provenance without a redundant success sentence", () => {
  for (const language of ["en", "fr"]) {
    const html = render({
      text: "Download the form from the linked official page. [1]",
      lookup: { status: "verified", reason: "none", partial: false, method: "official_page" },
      resources: [{
        id: "official-form", title: "Official form", url: "https://www.canada.ca/en/form",
        department: "Canada", description: "", tags: [],
        provenance: { kind: "live_official", retrievedAt: "2026-10-30T01:00:00Z" },
      }],
    }, language);
    assert.doesNotMatch(html, /Current information was checked|Les renseignements actuels ont été vérifiés/);
    assert.doesNotMatch(html, /role="status"[^>]*><\/p>/);
    assert.match(html, language === "en" ? /Live official source/ : /Source officielle en direct/);
  }
});

test("partial direct lookups retain their verification warning in both languages", () => {
  for (const language of ["en", "fr"]) {
    const html = render({
      text: "An answer using the pages that could be verified.",
      lookup: { status: "verified", reason: "none", partial: true, method: "official_page" },
    }, language);
    assert.match(html, /role="status"/);
    assert.match(html, language === "en"
      ? /Some official pages could not be verified/
      : /Certaines pages officielles n’ont pas pu être vérifiées/);
  }
});

test("clarification renders one labeled missing-detail selector in both languages", () => {
  const message = {
    lookup: { status: "clarification_required", reason: "missing_jurisdiction", partial: false, serviceId: "health_card" },
  };
  const english = render(message);
  const french = render(message, "fr");
  assert.match(english, /Which province or territory\?/);
  assert.match(french, /Quelle province ou quel territoire/);
  assert.equal((english.match(/<select/g) ?? []).length, 1);
  const selectId = english.match(/<select id="([^"]+)"/)?.[1];
  assert.ok(selectId);
  assert.ok(english.includes(`<label for="${selectId}"`));
  assert.match(english, /value="on"/);
  assert.doesNotMatch(english, /value="federal"/);
});

test("unknown services never render the catalog dropdown in either language", () => {
  for (const language of ["en", "fr"]) {
    const html = render({
      lookup: { status: "clarification_required", reason: "missing_service", partial: false },
    }, language);
    assert.doesNotMatch(html, /<select|Which service|De quel service|Choose one below|Choisissez-le ci-dessous/);
    assert.match(html, language === "en" ? /public title or number/ : /titre public ou son numéro/);
  }
});

test("ambiguous public-form jurisdictions can select federal as well as a province", () => {
  const html = render({ lookup: {
    status: "clarification_required", reason: "missing_jurisdiction", partial: false,
    publicForm: { title: "Application for accessibility assistance" },
  } });
  assert.match(html, /Which government issued this form/);
  assert.match(html, /value="federal"/);
  assert.match(html, /value="on"/);
  assert.equal((html.match(/<select/g) ?? []).length, 1);
});

test("missing search setup shows truthful saved links without a pointless retry", () => {
  const html = render({
    lookup: {
      status: "unavailable", reason: "provider_not_configured", partial: false,
      serviceId: "health_card", jurisdiction: "on",
    },
  });
  assert.match(html, /Live search isn&#x27;t enabled/);
  assert.match(html, /Saved official links/);
  assert.match(html, /href="https:\/\/ontario\.ca\/"/);
  assert.match(html, /review date unrecorded; not checked live/);
  assert.doesNotMatch(html, /Try again|Live official source/);
  const french = render({
    lookup: {
      status: "unavailable", reason: "provider_not_configured", partial: false,
      serviceId: "health_card", jurisdiction: "on",
    },
  }, "fr");
  assert.match(french, /lang="fr-CA">[^<]*Ontario/);
});

test("an interrupted answer keeps its text and source with a retry action", () => {
  const html = render({
    text: "The partial answer is retained [1].",
    incomplete: true,
    error: "timeout",
    resources: [{
      id: "live-source", title: "Official page", url: "https://www.canada.ca/en/service",
      department: "Canada", description: "", tags: [],
      provenance: { kind: "live_official", retrievedAt: "2026-10-29T18:00:00.000Z" },
    }],
  });
  assert.match(html, /The partial answer is retained/);
  assert.match(html, /Treat any text above as incomplete/);
  assert.match(html, /Try again/);
  assert.match(html, /href="https:\/\/www\.canada\.ca\/en\/service"/);
  assert.match(html, /Live official source/);
});

test("Serper failures name the provider in both languages without suggesting Gemini billing", () => {
  for (const language of ["en", "fr"]) {
    for (const reason of ["search_quota", "search_auth", "search_failed"]) {
      const html = render({ lookup: {
        status: "unavailable", reason, partial: false, method: "search",
        serviceId: "student_aid", jurisdiction: "sk", facetId: "documents",
      } }, language);
      assert.match(html, /Serper/);
      assert.match(html, /printable-applications-and-forms/);
      assert.doesNotMatch(html, /Gemini billing|Live official source|Source officielle en direct/);
      if (reason === "search_auth") assert.doesNotMatch(html, /Try again|Réessayer/);
    }
  }
});

test("Google quota failures explain billing and preserve Saskatchewan navigation without live claims", () => {
  const html = render({ lookup: {
    status: "unavailable", reason: "grounding_quota", partial: false, method: "google_grounding",
    serviceId: "student_aid", jurisdiction: "sk", facetId: "documents",
    fallbackReason: "fetch_failed",
  } });
  assert.match(html, /quota/);
  assert.match(html, /direct lookup did not succeed/);
  assert.match(html, /billing/);
  assert.match(html, /printable-applications-and-forms/);
  assert.doesNotMatch(html, /Live official source/);
});

test("Google-grounded sources keep provider links, distinct provenance and sandboxed suggestions", () => {
  const html = render({
    text: "Use the official form page. [1]",
    lookup: {
      status: "verified", reason: "none", partial: false, method: "google_grounding",
      fallbackReason: "fetch_failed",
      searchSuggestionsHtml: "<div>Google search suggestions</div>",
    },
    resources: [{
      id: "grounded-source", title: "Student Aid forms",
      url: "https://www.saskatchewan.ca/forms", department: "Saskatchewan", description: "", tags: [],
      citationUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/ABCD",
      provenance: { kind: "google_grounded", searchedAt: "2026-10-29T20:00:00Z" },
    }],
  });
  assert.match(html, /Google Search grounded/);
  assert.match(html, /Google Search was used as a fallback/);
  assert.match(html, /page not checked directly/);
  assert.match(html, /href="https:\/\/vertexaisearch.cloud.google.com\/grounding-api-redirect\/ABCD"/);
  assert.match(html, /sandbox="allow-popups allow-popups-to-escape-sandbox"/);
  assert.doesNotMatch(html, /allow-scripts|allow-same-origin|Live official source/);
  assert.match(html, /title="Google Search suggestions"/);
});
test("OAS recovery links to Old Age Security rather than CPP", () => {
  const html = render({
    lookup: {
      status: "unavailable", reason: "provider_not_configured", partial: false,
      serviceId: "old_age_security", jurisdiction: "federal",
    },
  });
  assert.match(html, /href="https:\/\/www\.canada\.ca\/en\/services\/benefits\/publicpensions\/old-age-security\.html"/);
  assert.doesNotMatch(html, /href="[^"]*\/cpp\//);
});

test("missing AI setup is not described as an interrupted answer or a retryable failure", () => {
  const html = render({ error: "not_configured", incomplete: true });
  assert.match(html, /assistant isn&#x27;t enabled here yet/);
  assert.doesNotMatch(html, /Try again|response was interrupted/);
});

test("blocked downloads have an explicit warning beside verified sources", () => {
  const html = render({
    lookup: {
      status: "verified", reason: "none", partial: false,
      serviceId: "pension", jurisdiction: "federal", restrictedDownload: true,
    },
  });
  assert.match(html, /outside the permitted domains/);
  assert.doesNotMatch(html, /href=.*gc\.ca/);
});

test("starter suggestions yield space to answers while privacy details remain accessible", () => {
  const suggestions = ["Download this form"];
  const initial = render({ text: "Overview" }, "en", { suggestions });
  assert.match(initial, /Download this form/);
  assert.match(initial, /<summary[^>]*>.*AI and search privacy<\/summary>/);
  assert.match(initial, /Chat uses the configured AI provider \(OpenAI by default, or Google Gemini\)/);
  assert.match(initial, /Serper/);
  assert.match(initial, /Search snippets are not evidence/);
  assert.doesNotMatch(initial, /using Brave|Google Search grounding is the fallback/);
  assert.doesNotMatch(initial, /Chat shares form metadata/);
  assert.doesNotMatch(initial, /<details[^>]*\bopen/);

  const conversation = render({}, "fr", {
    suggestions,
    messages: [
      { id: "question", role: "user", text: "My question" },
      { id: "answer", role: "assistant", text: "My answer" },
    ],
  });
  assert.doesNotMatch(conversation, /Download this form/);
  assert.match(conversation, /Confidentialité : IA et recherche/);
  assert.match(conversation, /Le clavardage utilise le fournisseur d&#x27;IA configuré \(OpenAI par défaut, ou Google Gemini\)/);
  assert.match(conversation, /Serper/);
  assert.doesNotMatch(conversation, /Le clavardage partage les métadonnées/);
});
