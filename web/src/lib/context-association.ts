import type { FieldContextCandidates, FieldType, FormField, PdfRect } from "@/lib/types";

export interface AssociationRequest {
  fieldId: string;
  page: number;
  type: FieldType;
  candidates: FieldContextCandidates;
}

export type AssociationSelection =
  | { status: "uncertain" }
  | { status: "resolved"; questionBlockIds: string[]; instructionBlockIds: string[]; optionBlockIds: string[] };

function isRect(value: unknown): value is PdfRect {
  return Array.isArray(value) && value.length === 4 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100_000);
}

export function isAssociationRequest(value: unknown): value is AssociationRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<AssociationRequest>;
  const evidence = request.candidates;
  return typeof request.fieldId === "string" && request.fieldId.trim().length > 0 && request.fieldId.length <= 200 &&
    typeof request.page === "number" && Number.isInteger(request.page) && request.page > 0 && request.page <= 30 &&
    (request.type === "text" || request.type === "radio" || request.type === "checkbox" || request.type === "choice" || request.type === "signature") &&
    Boolean(evidence) && Array.isArray(evidence?.blocks) && evidence.blocks.length > 0 && evidence.blocks.length <= 40 &&
    evidence.blocks.every((block) => block && typeof block.id === "string" && block.id.length <= 50 &&
      typeof block.text === "string" && block.text.trim().length > 0 && block.text.length <= 1_200 && isRect(block.rect)) &&
    evidence.blocks.reduce((sum, block) => sum + block.text.length, 0) <= 12_000 &&
    new Set(evidence.blocks.map((block) => block.id)).size === evidence.blocks.length &&
    Array.isArray(evidence.widgets) && evidence.widgets.length > 0 && evidence.widgets.length <= 30 &&
    evidence.widgets.every((widget) => widget && isRect(widget.rect) &&
      (widget.option === undefined || (typeof widget.option === "string" && widget.option.length <= 200)));
}

/** Reconstruct exclusively from supplied evidence; generated question text is never accepted. */
export function resolveAssociation(candidates: FieldContextCandidates, value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Invalid association response");
  const selection = value as Omit<Partial<Extract<AssociationSelection, { status: "resolved" }>>, "status"> & { status?: string };
  if (selection.status === "uncertain") return null;
  const lists = [selection.questionBlockIds, selection.instructionBlockIds, selection.optionBlockIds];
  if (selection.status !== "resolved" || !lists.every((ids) =>
    Array.isArray(ids) && ids.every((id) => typeof id === "string")) ||
    !selection.questionBlockIds?.length || selection.questionBlockIds.length > 4 ||
    !selection.instructionBlockIds || selection.instructionBlockIds.length > 4 ||
    !selection.optionBlockIds || selection.optionBlockIds.length > 30) {
    throw new Error("Invalid association references");
  }
  const allIds = lists.flat();
  const blocks = new Map(candidates.blocks.map((block) => [block.id, block.text]));
  if (new Set(allIds).size !== allIds.length || allIds.some((id) => !id || !blocks.has(id))) {
    throw new Error("Unknown or reused association reference");
  }
  const widgetsWithOptions = candidates.widgets.filter((widget) => widget.option !== undefined);
  if (selection.optionBlockIds.length !== widgetsWithOptions.length) throw new Error("Missing option references");
  const question = selection.questionBlockIds.map((id) => blocks.get(id)).join(" ");
  if (question.length > 1_200 || /^(yes|no|oui|non|\d+)[.!]?$/i.test(question.trim())) {
    throw new Error("Invalid associated question");
  }
  const instructions = selection.instructionBlockIds.map((id) => blocks.get(id)!);
  const options = selection.optionBlockIds.map((id) => blocks.get(id)!);
  if (new Set(options).size !== options.length) throw new Error("Ambiguous duplicate option labels");
  return { question, instructions, options };
}

export function applyAssociation(field: FormField, selection: unknown): FormField {
  if (!field.contextCandidates) throw new Error("Missing association evidence");
  const resolved = resolveAssociation(field.contextCandidates, selection);
  if (!resolved) return field;
  return {
    ...field,
    label: resolved.question,
    options: field.type === "radio" ? resolved.options : field.options,
    context: {
      status: "resolved", source: "ai",
      question: resolved.question, instructions: resolved.instructions,
    },
  };
}
