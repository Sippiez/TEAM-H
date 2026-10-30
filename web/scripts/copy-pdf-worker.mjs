import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// pdf.js needs matching worker and standard-font assets served locally.
const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = dirname(require.resolve("pdfjs-dist/package.json"));
const src = join(pkgDir, "build", "pdf.worker.min.mjs");
const dest = join(root, "public", "pdf.worker.min.mjs");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log(`Copied pdf.js worker to ${dest}`);
const fontsDest = join(root, "public", "pdf-standard-fonts");
cpSync(join(pkgDir, "standard_fonts"), fontsDest, { recursive: true });
console.log(`Copied pdf.js standard fonts and licenses to ${fontsDest}`);
