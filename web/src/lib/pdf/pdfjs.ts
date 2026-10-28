import type * as PdfJs from "pdfjs-dist";

let pdfjsPromise: Promise<typeof PdfJs> | undefined;

/** Load pdf.js in the browser only. The worker is copied to /public by scripts/copy-pdf-worker.mjs. */
export function getPdfjs(): Promise<typeof PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return pdfjs;
  });
  return pdfjsPromise;
}

export type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
