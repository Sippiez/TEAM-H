import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import * as icons from "lucide-react";
import { cn } from "cn";
import ts from "typescript";

function loadModule(path, imports, suffix = "") {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  vm.runInNewContext(outputText + suffix, {
    exports,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return exports;
}

const { dicts } = loadModule("../src/components/form-helper/i18n.ts", { react: React }, "\nexports.dicts = DICTS;");

function workspace(language = "en") {
  let collapsed = false;
  let displayedCollapsed = false;
  const calls = [];
  const panelRef = { current: {
    collapse() { calls.push("collapse"); collapsed = true; },
    expand() { calls.push("expand"); collapsed = false; },
    isCollapsed() { return collapsed; },
  } };
  const { WorkspacePanels } = loadModule("../src/components/form-helper/workspace-panels.tsx", {
    react: { ...React, useState: () => [displayedCollapsed, (value) => { displayedCollapsed = value; }] },
    "react/jsx-runtime": jsx,
    "react-resizable-panels": { usePanelRef: () => panelRef },
    "lucide-react": icons,
    cn: { cn },
    "@/components/ui/resizable": {
      ResizablePanelGroup: "group", ResizablePanel: "panel", ResizableHandle: "separator",
    },
    "./i18n": { useI18n: () => ({ t: dicts[language] }) },
  });
  const children = [
    React.createElement("nav", { key: "fields" }, "Fields"),
    React.createElement("section", { key: "document" }, "Document"),
    React.createElement("aside", { key: "details" }, "Details"),
  ];
  return {
    render: (desktop = true) => WorkspacePanels({ desktop, children }),
    children, calls,
    dragCollapse: () => { collapsed = true; },
  };
}

function find(element, predicate) {
  if (!React.isValidElement(element)) return undefined;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props.children)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}

test("the fields sidebar toggles with an accessible persistent control and native panel APIs", () => {
  const ui = workspace();
  let tree = ui.render();
  const panel = find(tree, (el) => el.props.id === "workspace-fields");
  assert.equal(panel.props.collapsible, true);
  assert.equal(panel.props.collapsedSize, "52px");
  assert.equal(panel.props.minSize, "220px");
  let button = find(tree, (el) => el.type === "button");
  assert.equal(button.props["aria-expanded"], true);
  assert.equal(button.props["aria-label"], "Collapse fields sidebar");
  button.props.onClick();
  panel.props.onResize();
  tree = ui.render();
  button = find(tree, (el) => el.type === "button");
  assert.equal(button.props["aria-expanded"], false);
  assert.equal(button.props["aria-label"], "Expand fields sidebar");
  const content = find(tree, (el) => el.props.id === button.props["aria-controls"]);
  assert.equal(content.props.hidden, true);
  assert.equal(content.props.children, ui.children[0], "Keep the route mounted so its search and filters survive");
  button.props.onClick();
  panel.props.onResize();
  assert.deepEqual(ui.calls, ["collapse", "expand"]);
  assert.equal(find(ui.render(), (el) => el.props.id === content.props.id).props.hidden, false);
});

test("drag and keyboard-driven collapse updates the toggle, including French labels", () => {
  const ui = workspace("fr");
  const panel = find(ui.render(), (el) => el.props.id === "workspace-fields");
  ui.dragCollapse();
  panel.props.onResize();
  const button = find(ui.render(), (el) => el.type === "button");
  assert.equal(button.props["aria-expanded"], false);
  assert.equal(button.props["aria-label"], dicts.fr.expandFieldsPanel);
});

test("small screens retain the existing stacked workspace without a desktop rail", () => {
  const ui = workspace();
  const tree = ui.render(false);
  assert.equal(tree.type, React.Fragment);
  assert.equal(tree.props.children, ui.children);
  assert.equal(find(tree, (el) => el.type === "button"), undefined);
});
