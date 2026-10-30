import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}

const source = compile("../src/components/form-helper/form-helper-app.tsx");
const chatStream = {};
vm.runInNewContext(compile("../src/lib/chat-stream.ts"), {
  exports: chatStream, require: () => ({}), TextDecoder,
});
const translations = {};
vm.runInNewContext(compile("../src/components/form-helper/i18n.ts") + "\nexports.dicts = DICTS;", {
  exports: translations, require: () => ({}),
});

const settle = () => new Promise((resolve) => setImmediate(resolve));
const pdf = { name: "test.pdf", size: 8, arrayBuffer: async () => new TextEncoder().encode("%PDF-1.7").buffer };

function mount({ language = "en", failPdf = false } = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let tree;
  const calls = [];
  const streams = [];
  const errors = [];
  const components = Object.fromEntries(
    ["ChatPanel", "FieldPanel", "FormViewer", "Landing", "Route", "WorkspacePanels"].map((name) => [name, name]),
  );
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect) { effects.push(effect); },
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
  };
  const imports = {
    react,
    "react/jsx-runtime": jsx,
    "lucide-react": { FileUpIcon: "FileUpIcon", InfoIcon: "InfoIcon", LockIcon: "LockIcon", RotateCcwIcon: "RotateCcwIcon" },
    sonner: { toast: { info() {}, warning() {}, error: (...args) => errors.push(args) } },
    cn: { cn: (...classes) => classes.filter(Boolean).join(" ") },
    "@/hooks/use-media-query": { useMediaQuery: () => true },
    "@/lib/context-association": {},
    "@/lib/chat-stream": chatStream,
    "@/lib/field-context": { summarizeField: (field) => field },
    "@/lib/pdf/extract": { loadForm: async (_data, fileName) => {
      if (failPdf) throw new Error("Unreadable PDF");
      return { fileName, pageCount: 1, fields: [], doc: { loadingTask: { destroy() {} } } };
    } },
    "./i18n": { useI18n: () => ({ lang: language, t: translations.dicts[language] }), setLang() {} },
    "./styles": {},
    ...Object.fromEntries(Object.entries(components).map(([name, component]) => [
      `./${name.replace(/[A-Z]/g, (letter, index) => `${index ? "-" : ""}${letter.toLowerCase()}`)}`,
      { [name]: component },
    ])),
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports, crypto: webcrypto, AbortController, TextDecoder, Uint8Array,
    console: { error() {} },
    document: { documentElement: {}, getElementById: () => null, querySelector: () => null },
    window: { setTimeout, clearTimeout, scrollTo() {}, matchMedia: () => ({ matches: true }) },
    requestAnimationFrame: (fn) => fn(),
    fetch: async (url, options) => {
      calls.push({ url, ...options, payload: JSON.parse(options.body) });
      let controller;
      const body = new ReadableStream({ start(value) { controller = value; } });
      options.signal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")));
      const frame = (event) => controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify({ version: 1, ...event })}\n\n`),
      );
      streams.push({
        write: (text) => frame({ type: "delta", text }),
        end: () => {
          frame({ type: "complete", complete: true });
          controller.close();
        },
      });
      return { ok: true, body, headers: new Map([["content-type", "text/event-stream"]]) };
    },
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
  });
  function render() {
    cursor = 0;
    effects = [];
    tree = exports.FormHelperApp();
    effects.forEach((effect) => effect());
  }
  function find(predicate, node = tree) {
    if (!node || typeof node !== "object") return undefined;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      const match = find(predicate, child ?? null);
      if (match) return match;
    }
  }
  const component = (type) => find((node) => node.type === type)?.props;
  render();
  return {
    render, find, component, calls, streams, errors,
    start() { component("Landing").onStartChat(); render(); },
    async upload(file = pdf) {
      const input = find((node) => node.type === "input" && node.props.type === "file");
      input.props.onChange({ target: { files: [file], value: file.name } });
      await settle();
      render();
    },
    reset() {
      find((node) => node.type === "button" && node.props.children?.[1]?.type === "span" &&
        node.props.children[1].props.children === translations.dicts[language].newSession).props.onClick();
      render();
    },
  };
}

test("landing starts chat without a PDF; requests omit form context", async () => {
  const app = mount();
  assert.ok(app.component("Landing").onStartChat);
  app.start();
  assert.equal(app.component("FormViewer"), undefined);
  assert.ok(app.find((node) => node.props?.id === "chat-only-title"));
  app.component("ChatPanel").onSend("How do I renew my passport?");
  await settle();
  app.render();
  assert.equal(app.calls[0].payload.form, undefined);
  assert.equal(app.calls[0].payload.message, "How do I renew my passport?");
  app.streams[0].write("Check the official passport page.");
  app.streams[0].end();
  await settle();
  app.render();
  assert.equal(app.component("ChatPanel").messages.length, 2);
  app.reset();
  assert.ok(app.component("Landing"));
  app.start();
  assert.equal(app.component("ChatPanel").messages.length, 0);
});

test("adding a PDF carries chat into Ask, retains preview features, and supplies form context", async () => {
  const app = mount();
  app.start();
  app.component("ChatPanel").onSend("Help with a form");
  await settle();
  app.streams[0].write("Add your blank PDF.");
  app.streams[0].end();
  await settle();
  app.render();
  await app.upload();
  assert.ok(app.component("Route"));
  assert.ok(app.component("FormViewer"));
  assert.ok(app.component("FieldPanel"));
  assert.equal(app.find((node) => node.props?.id === "panel-ask").props.hidden, false);
  assert.equal(app.component("ChatPanel").messages[0].text, "Help with a form");
  assert.equal(app.calls[1].payload.intent, "overview");
  assert.equal(app.calls[1].payload.form.fileName, pdf.name);
  assert.equal(app.calls[1].payload.history.length, 2);
  app.streams[1].write("Here is the form overview.");
  app.streams[1].end();
  await settle();
  app.render();
  const viewer = app.component("FormViewer");
  viewer.onClose(viewer.activeKey);
  app.render();
  assert.equal(app.component("FormViewer"), undefined);
  assert.ok(app.find((node) => node.props?.id === "chat-only-title"));
  assert.equal(app.component("ChatPanel").messages.at(-1).text, "Here is the form overview.");
  app.reset();
});

test("an in-flight general answer finishes in the PDF chat without a second request", async () => {
  const app = mount();
  app.start();
  app.component("ChatPanel").onSend("Help me get started");
  await settle();
  app.streams[0].write("First, ");
  await settle();
  app.render();
  await app.upload();
  assert.equal(app.calls.length, 1);
  assert.equal(app.component("ChatPanel").pending, true);
  app.streams[0].write("check the official instructions.");
  app.streams[0].end();
  await settle();
  app.render();
  assert.equal(app.component("ChatPanel").pending, false);
  assert.equal(app.component("ChatPanel").messages.at(-1).text, "First, check the official instructions.");
  app.reset();
});

test("closing the PDF aborts a migrated request and removes its incomplete answer", async () => {
  const app = mount();
  app.start();
  app.component("ChatPanel").onSend("Help");
  await settle();
  app.render();
  await app.upload();
  const viewer = app.component("FormViewer");
  viewer.onClose(viewer.activeKey);
  await settle();
  app.render();
  assert.equal(app.calls[0].signal.aborted, true);
  assert.equal(app.component("ChatPanel").pending, false);
  assert.equal(app.component("ChatPanel").messages.length, 1);
  app.reset();
});

test("invalid or unreadable PDFs keep chat open with a visible error", async () => {
  for (const failPdf of [false, true]) {
    const app = mount({ failPdf });
    app.start();
    await app.upload(failPdf ? pdf : {
      name: "not.pdf", size: 3, arrayBuffer: async () => new TextEncoder().encode("bad").buffer,
    });
    assert.equal(app.component("FormViewer"), undefined);
    assert.ok(app.find((node) => node.props?.id === "chat-only-title"));
    assert.equal(app.errors.length, 1);
    app.reset();
  }
});

test("chat-only heading and PDF action follow the interface language", () => {
  const app = mount({ language: "fr" });
  app.start();
  assert.equal(app.find((node) => node.props?.id === "chat-only-title").props.children, translations.dicts.fr.chatTitle);
  assert.ok(app.find((node) => node.props?.["aria-label"] === translations.dicts.fr.addPdf));
  app.reset();
});

test("New session aborts a pending chat and prevents late answers from returning", async () => {
  const app = mount();
  app.start();
  app.component("ChatPanel").onSend("Help");
  await settle();
  app.render();
  app.reset();
  await settle();
  app.render();
  assert.equal(app.calls[0].signal.aborted, true);
  assert.ok(app.component("Landing"));
  app.start();
  assert.equal(app.component("ChatPanel").messages.length, 0);
  assert.equal(app.component("ChatPanel").pending, false);
  app.reset();
});

test("starting with a PDF still opens field mode and closes back to landing", async () => {
  const app = mount();
  await app.component("Landing").onFile(pdf);
  app.render();
  assert.equal(app.find((node) => node.props?.id === "panel-field").props.hidden, false);
  const viewer = app.component("FormViewer");
  viewer.onClose(viewer.activeKey);
  await settle();
  app.render();
  assert.ok(app.component("Landing"));
  assert.equal(app.calls[0].signal.aborted, true);
});
