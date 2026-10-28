import { findKnownForm, resolveRule } from "@/lib/catalog/forms";
import { cleanWhitespace, humanize } from "@/lib/text";
import type { FieldType, FormField, PdfRect } from "@/lib/types";

/** A field as read from the PDF, before labels and sections are resolved. */
export interface RawField {
  rawName: string;
  path: string;
  page: number;
  rects: PdfRect[];
  type: FieldType;
  tooltip?: string;
  /** Radio export values or choice display values. */
  options?: string[];
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
  const text = cleanWhitespace(tooltip).replace(/^\d+\.\s+/, "");
  return text.length > 0 && text.length <= 90 ? text : undefined;
}

export function enrichFields(raw: RawField[], formNumber?: string): FormField[] {
  const form = findKnownForm(formNumber);
  return raw.map((f, i) => {
    const rule = resolveRule(form, f.path);
    const leaf = f.path.split(".").pop() ?? f.path;
    let label = rule?.label ?? tooltipLabel(f.tooltip) ?? humanize(leaf);
    if (!rule?.label && rule?.labelPrefix && !label.startsWith(rule.labelPrefix)) {
      label = `${rule.labelPrefix}: ${label}`;
    }
    const options =
      f.type === "radio" && rule?.optionLabels
        ? f.options?.map((o) => rule.optionLabels?.[o] ?? o)
        : f.options;
    return {
      id: `f-${i}`,
      rawName: f.rawName,
      path: f.path,
      page: f.page,
      rects: f.rects,
      type: f.type,
      label,
      tooltip: f.tooltip ? cleanWhitespace(f.tooltip) : undefined,
      options,
      section: rule?.section ?? genericSection(f.path, f.page),
    };
  });
}
