import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import { cn } from "cn";
import ts from "typescript";

function loadModule(path, imports, suffix = "") {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  });
  const exports = {};
  vm.runInNewContext(outputText + suffix, {
    exports, React,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return exports;
}

const i18n = loadModule("../src/components/form-helper/i18n.ts", { react: React }, "\nexports.dicts = DICTS;");
const styles = loadModule("../src/components/form-helper/styles.ts", {});
let language = "en";
const { FieldPanel } = loadModule("../src/components/form-helper/field-panel.tsx", {
  react: React, "lucide-react": icons, cn: { cn },
  "./i18n": { useI18n: () => ({ lang: language, t: i18n.dicts[language] }), englishOnly: i18n.englishOnly },
  "./styles": styles,
  "./resource-list": { ResourceList: () => null },
});
const field = {
  id: "f-1", path: "rb_choice", rawName: "rb_choice",
  page: 1, type: "radio", label: "Unidentified field 1 (page 1)", section: "Page 1",
  rects: [[1, 1, 2, 2]], options: ["1", "2"],
  context: { status: "ambiguous", source: "layout", instructions: [] },
  contextCandidates: { blocks: [{ id: "q", text: "Possible question?", rect: [1, 2, 3, 4] }], widgets: [] },
};
const explanation = {
  fieldId: field.id, meaning: "Question?", whatToEnter: "Choose an option.",
  commonMistakes: [], sources: [], grounded: false,
};
function render(extra = {}, selected = field) {
  return renderToStaticMarkup(React.createElement(FieldPanel, {
    fields: [selected], pageCount: 1, selected, explanation,
    onSelect() {}, onAsk() {}, onRetry() {}, onShowOnForm() {}, onIdentify() {},
    ...extra,
  }));
}

test("unresolved fields show uncertainty and recovery, not numeric options or invented guidance", () => {
  const html = render();
  assert.match(html, /This field&#x27;s context is unclear/);
  assert.match(html, /Identify question with AI/);
  assert.match(html, /nearby printed text and positions/);
  assert.doesNotMatch(html, />Options<|What to enter|rb_choice/);
  assert.match(render({ contextPending: true }), /disabled=""[^>]*>Identifying the question/);
  assert.match(render({ contextError: "failed" }), /role="alert"/);
  assert.match(render({ contextError: "uncertain" }), /couldn&#x27;t make a reliable match/);
});

test("OCR-needed fields explain the limitation without offering a text-only AI action", () => {
  const html = render({}, { ...field, context: { ...field.context, status: "needs-ocr" } });
  assert.match(html, /OCR isn&#x27;t enabled/);
  assert.doesNotMatch(html, /Identify question with AI/);
});

test("resolved AI associations are labelled as AI-matched rather than official guidance", () => {
  const html = render({}, {
    ...field, label: "Actual question?",
    context: { status: "resolved", source: "ai", question: "Actual question?", instructions: [] },
  });
  assert.match(html, /Question matched with AI/);
  assert.doesNotMatch(html, /This field&#x27;s context is unclear|Based on official/);
});

test("uncertainty and retry states use the selected interface language", () => {
  language = "fr";
  try {
    const html = render({ contextError: "failed" });
    assert.match(html, /Le contexte de ce champ est incertain/);
    assert.match(html, /Identifier la question avec l&#x27;IA/);
    assert.doesNotMatch(html, /This field&#x27;s context is unclear/);
  } finally {
    language = "en";
  }
});
