import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/components/form-helper/form-helper-app.tsx", import.meta.url),
  "utf8",
);

function reloadClientModule() {
  const tree = ts.createSourceFile("form-helper-app.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let documentKey;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(tree) === "key" &&
      node.initializer &&
      ts.isTemplateExpression(node.initializer) &&
      node.initializer.head.text === "d-"
    ) {
      documentKey = node.initializer.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(documentKey, "Find the document key actually used by openPdf");

  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  // Re-evaluate the real module's allocators while retaining existing list keys,
  // as Fast Refresh does with component state. No component is rendered here.
  vm.runInNewContext(`${outputText}
    exports.messageKey = nextId;
    exports.documentKey = () => ${documentKey};
  `, { exports, require: () => ({}), crypto: webcrypto });
  return exports;
}

test("retained message keys do not collide after Fast Refresh", () => {
  const existing = reloadClientModule();
  const messages = Array.from({ length: 3 }, () => existing.messageKey());
  const refreshed = reloadClientModule();
  messages.push(...Array.from({ length: 3 }, () => refreshed.messageKey()));

  assert.equal(new Set(messages).size, messages.length, `Duplicate message keys: ${messages}`);
});

test("retained document keys do not collide after Fast Refresh", () => {
  const existing = reloadClientModule();
  const documents = [existing.documentKey()];
  const refreshed = reloadClientModule();
  documents.push(refreshed.documentKey());

  assert.equal(new Set(documents).size, documents.length, `Duplicate document keys: ${documents}`);
});
