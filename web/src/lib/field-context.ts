import type { FieldContext, FieldSummary, FormField } from "@/lib/types";

export function summarizeField(field: FormField): FieldSummary {
  const { id, path, page, type, label, section, options, context } = field;
  return { id, path, page, type, label, section, options, context };
}

export function isFieldContext(value: unknown): value is FieldContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<FieldContext>;
  return (context.status === "resolved" || context.status === "ambiguous" || context.status === "needs-ocr") &&
    (context.source === "curated" || context.source === "tooltip" || context.source === "layout" || context.source === "ai") &&
    (context.question === undefined || (typeof context.question === "string" && context.question.length <= 1_200)) &&
    Array.isArray(context.instructions) && context.instructions.length <= 8 &&
    context.instructions.every((text) => typeof text === "string" && text.length <= 1_200) &&
    (context.status !== "resolved" || Boolean(context.question?.trim()));
}

export function isFieldSummary(value: unknown): value is FieldSummary {
  if (!value || typeof value !== "object") return false;
  const field = value as Partial<FieldSummary>;
  return typeof field.id === "string" && typeof field.path === "string" &&
    typeof field.label === "string" && typeof field.section === "string" &&
    typeof field.page === "number" && Number.isInteger(field.page) && field.page > 0 &&
    (field.type === "text" || field.type === "checkbox" || field.type === "radio" || field.type === "choice" || field.type === "signature") &&
    (field.options === undefined || (Array.isArray(field.options) && field.options.every((option) => typeof option === "string"))) &&
    (field.context === undefined || isFieldContext(field.context));
}
