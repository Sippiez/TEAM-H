import { detectFormNumber } from "@/lib/catalog/forms";
import { enrichFields, normalizePath, type RawField } from "@/lib/fields";
import { buildTextBlocks, matchFieldContext } from "@/lib/pdf/context";
import { getPdfjs, type PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import type { FieldType, FormField, PdfRect } from "@/lib/types";

/** The subset of pdf.js widget annotation data we use. Field values are never read. */
interface WidgetAnnotation {
  subtype: string;
  fieldName?: string;
  fieldType?: string;
  rect: PdfRect;
  alternativeText?: string;
  checkBox?: boolean;
  radioButton?: boolean;
  pushButton?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  required?: boolean;
  buttonValue?: string;
  options?: { exportValue?: string; displayValue?: string }[];
}

const IGNORED_NAMES = /barcode|BARCODE_VERSION|FT_IND/i;

export interface LoadedForm {
  doc: PDFDocumentProxy;
  fileName: string;
  pageCount: number;
  formNumber?: string;
  fields: FormField[];
}

function fieldType(a: WidgetAnnotation): FieldType | undefined {
  switch (a.fieldType) {
    case "Tx":
      return "text";
    case "Ch":
      return "choice";
    case "Sig":
      return "signature";
    case "Btn":
      if (a.pushButton) return undefined;
      return a.radioButton ? "radio" : "checkbox";
    default:
      return undefined;
  }
}

async function readFields(doc: PDFDocumentProxy): Promise<RawField[]> {
  const byName = new Map<string, RawField>();
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const annotations = (await page.getAnnotations({ intent: "display" })) as WidgetAnnotation[];
    const widgets = annotations.filter((a) => a.subtype === "Widget");
    const blocks = buildTextBlocks((await page.getTextContent()).items.filter((item) => "str" in item), widgets);
    const pageGroups = new Map<string, { rect: PdfRect; option?: string }[]>();
    for (const a of annotations) {
      if (a.subtype !== "Widget" || !a.fieldName || a.readOnly || a.hidden) continue;
      if (IGNORED_NAMES.test(a.fieldName)) continue;
      const type = fieldType(a);
      if (!type) continue;
      const group = pageGroups.get(a.fieldName) ?? [];
      group.push({ rect: a.rect, option: type === "radio" ? a.buttonValue : undefined });
      pageGroups.set(a.fieldName, group);
      const existing = byName.get(a.fieldName);
      if (existing) {
        existing.rects.push(a.rect);
        existing.required = existing.required || Boolean(a.required);
        if (type === "radio" && a.buttonValue && !existing.options?.includes(a.buttonValue)) {
          existing.options = [...(existing.options ?? []), a.buttonValue];
        }
        continue;
      }
      const options =
        type === "radio"
          ? a.buttonValue
            ? [a.buttonValue]
            : []
          : type === "choice"
            ? (a.options ?? [])
                .map((o) => (o.displayValue ?? o.exportValue ?? "").trim())
                .filter((o) => o && !/^-+$/.test(o))
            : undefined;
      byName.set(a.fieldName, {
        rawName: a.fieldName,
        path: normalizePath(a.fieldName),
        page: p,
        rects: [a.rect],
        type,
        tooltip: a.alternativeText?.trim() || undefined,
        options,
        required: Boolean(a.required),
      });
    }
    for (const [name, group] of pageGroups) {
      const field = byName.get(name);
      if (!field || field.page !== p) continue;
      const matched = matchFieldContext(group, widgets, blocks, field.type);
      field.context = matched.context;
      field.contextCandidates = matched.candidates;
      field.optionLabels = matched.optionLabels;
    }
    page.cleanup();
  }
  // Reading order: page, then top-to-bottom rows (PDF y grows upward), then left-to-right.
  return [...byName.values()].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    const ay = Math.round(Math.max(a.rects[0][1], a.rects[0][3]) / 8);
    const by = Math.round(Math.max(b.rects[0][1], b.rects[0][3]) / 8);
    if (ay !== by) return by - ay;
    return Math.min(a.rects[0][0], a.rects[0][2]) - Math.min(b.rects[0][0], b.rects[0][2]);
  });
}

async function firstPageText(doc: PDFDocumentProxy): Promise<string> {
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return content.items.map((i) => ("str" in i ? i.str : "")).join(" ");
}

export async function loadForm(data: ArrayBuffer, fileName: string): Promise<LoadedForm> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const raw = await readFields(doc);
  const formNumber = detectFormNumber(
    await firstPageText(doc),
    raw.map((f) => f.rawName),
  );
  return {
    doc,
    fileName,
    pageCount: doc.numPages,
    formNumber,
    fields: enrichFields(raw, formNumber),
  };
}
