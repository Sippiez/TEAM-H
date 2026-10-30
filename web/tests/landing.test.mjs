import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";

function renderLanding(language) {
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
      exports,
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
  const { Landing } = load(new URL("components/form-helper/landing.tsx", root));
  return renderToStaticMarkup(React.createElement(Landing, {
    loading: false, onFile() {}, onSample() {}, onStartChat() {},
  }));
}

for (const language of ["en", "fr"]) {
  test(`all landing links, including preview sources, follow ${language}`, () => {
    const html = renderLanding(language);
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)];
    assert.equal(links.length, 10);
    for (const [, url] of links) {
      assert.equal(new URL(url).hostname, "www.canada.ca");
      assert.ok(new URL(url).pathname.startsWith(`/${language}/`), url);
    }
    assert.match(html, /formER/);
    assert.doesNotMatch(html, /Form Helper|Aide-formulaires/);
    assert.match(html, language === "en" ? /Up to 10 MB/ : /Jusqu&#x27;à 10 Mo/);
    assert.match(html, language === "en" ? /Up to 5 open/ : /Jusqu&#x27;à 5 ouverts/);
    if (language === "fr") {
      assert.doesNotMatch(html, /<a\b[^>]*lang="en"|ESDC|CRA|Proof of Canadian citizenship|Submit your passport/);
      assert.match(html, /EDSC/);
      assert.match(html, /ARC/);
    }
  });

  test(`landing summarizes features and keeps data details available in ${language}`, () => {
    const html = renderLanding(language);
    const section = html.match(/<section aria-labelledby="features-title"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section);
    assert.match(section, /class="marginalia-features min-w-0"/);
    assert.match(html, /<\/figure><section aria-labelledby="features-title"/);
    assert.equal(section.match(/<li>/g)?.length, 4);
    assert.match(section, language === "en" ? /What formER does/ : /Ce que fait formER/);
    assert.match(section, /<details class="marginalia-data-details"><summary>/);
    assert.match(section, /Google Gemini/);
    assert.match(section, language === "en" ? /30 days/ : /30 jours/);
    assert.doesNotMatch(html, /Important information|Informations importantes/);
  });
}
