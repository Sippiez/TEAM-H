import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("Atkinson keeps an explicit fallback without requesting unavailable Next font metrics", () => {
  const source = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  let fontOptions;
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports: {},
    require(name) {
      if (name === "next/font/google") return {
        Atkinson_Hyperlegible_Next(options) { fontOptions = options; return { variable: "font-sans" }; },
      };
      return {};
    },
  });
  assert.equal(fontOptions.adjustFontFallback, false);
  assert.ok(fontOptions.fallback.includes("Arial"));
  assert.ok(fontOptions.fallback.includes("sans-serif"));
});

test("the predev/prebuild asset script copies matching PDF fonts and their licenses", () => {
  const root = mkdtempSync(join(tmpdir(), "form-helper-pdf-assets-"));
  try {
    const script = join(root, "scripts", "copy-pdf-worker.mjs");
    mkdirSync(dirname(script), { recursive: true });
    copyFileSync(new URL("../scripts/copy-pdf-worker.mjs", import.meta.url), script);
    const packageRoot = join(root, "node_modules", "pdfjs-dist");
    const files = {
      "package.json": '{"name":"pdfjs-dist"}',
      "build/pdf.worker.min.mjs": "matching worker",
      "standard_fonts/FoxitDingbats.pfb": "matching dingbats",
      "standard_fonts/LiberationSans-Regular.ttf": "matching text font",
      "standard_fonts/LICENSE_FOXIT": "font license",
      "standard_fonts/LICENSE_LIBERATION": "text font license",
    };
    for (const [file, content] of Object.entries(files)) {
      const path = join(packageRoot, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
    execFileSync(process.execPath, [script], { stdio: "pipe" });
    assert.equal(readFileSync(join(root, "public", "pdf.worker.min.mjs"), "utf8"), files["build/pdf.worker.min.mjs"]);
    for (const [file, content] of Object.entries(files)) {
      if (file.startsWith("standard_fonts/")) {
        assert.equal(readFileSync(join(root, "public", file.replace("standard_fonts/", "pdf-standard-fonts/")), "utf8"), content);
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
