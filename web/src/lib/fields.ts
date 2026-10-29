import { findKnownForm, resolveRule } from "@/lib/catalog/forms";
import { cleanPdfText, humanize } from "@/lib/text";
import type { FieldContext, FieldContextCandidates, FieldType, FormField, PdfRect } from "@/lib/types";

/** A field as read from the PDF, before labels and sections are resolved. */
export interface RawField {
  rawName: string;
  path: string;
  page: number;
  rects: PdfRect[];
  type: FieldType;
  tooltip?: string;
  /** Question recovered from adjacent static PDF text, not entered values. */
  label?: string;
  /** Radio export values or choice display values. */
  options?: string[];
  optionLabels?: Record<string, string>;
  context?: FieldContext;
  contextCandidates?: FieldContextCandidates;
}

/** "PPTC_153[0].Page1[0].#subform[2].Name[0]" -> "PPTC_153.Page1.Name" */
export function normalizePath(rawName: string): string {
  return rawName
    .split(".")
    .map((s) => s.replace(/\[\d+\]$/, ""))
    .filter((s) => s && !s.startsWith("#"))
    .join(".");
}

function genericSection(path: string, page: number): string {
  const segments = path.split(".");
  const parents = segments.slice(segments.length > 2 ? 1 : 0, -1);
  const named = parents.find((s) => !/^page\d*$/i.test(s) && !/^(topmost)?subform$/i.test(s));
  return named ? humanize(named) : `Page ${page}`;
}

function tooltipLabel(tooltip?: string): string | undefined {
  if (!tooltip) return undefined;
  const text = cleanPdfText(tooltip).replace(/^\d+\.\s+/, "");
  return text.length > 3 && text.length <= 1_200 &&
    !/^(yes|no|oui|non|yes\s*[/,-]\s*no|select one(?: only)?|choose one(?: option)?|check one|s[eé]lectionnez une? (?:seule? )?(?:option|choix))[:.!]?$/i.test(text) &&
    !/^(?:rb|cb|radio(?:button)?|check(?:box)?|field)[_\s-]*\d+$/i.test(text)
    ? text : undefined;
}

export function enrichFields(raw: RawField[], formNumber?: string): FormField[] {
  const form = findKnownForm(formNumber);
  return raw.map((f, i) => {
    const rule = resolveRule(form, f.path);
    const tooltip = tooltipLabel(f.tooltip);
    const question = rule?.label ?? tooltip ?? f.context?.question ?? f.label;
    const context: FieldContext = rule?.label || tooltip
      ? { status: "resolved", source: rule?.label ? "curated" : "tooltip", question, instructions: f.context?.instructions ?? [] }
      : f.context ?? { status: "ambiguous", source: "layout", instructions: [] };
    let label = question ?? `Unidentified field ${i + 1} (page ${f.page})`;
    if (!rule?.label && rule?.labelPrefix && !label.startsWith(rule.labelPrefix)) {
      label = `${rule.labelPrefix}: ${label}`;
    }
    const options =
      f.type === "radio"
        ? f.options?.map((o) => rule?.optionLabels?.[o] ?? f.optionLabels?.[o] ?? o)
        : f.options;
    return {
      id: `f-${i}`,
      rawName: f.rawName,
      path: f.path,
      page: f.page,
      rects: f.rects,
      type: f.type,
      label,
      tooltip: f.tooltip ? cleanPdfText(f.tooltip) || undefined : undefined,
      options,
      section: rule?.section ?? genericSection(f.path, f.page),
      context,
      contextCandidates: f.contextCandidates,
    };
  });
}
