/** PDF user-space rectangle: [x1, y1, x2, y2]. */
export type PdfRect = [number, number, number, number];

export type FieldType = "text" | "checkbox" | "radio" | "choice" | "signature";

export interface FieldContext {
  status: "resolved" | "ambiguous" | "needs-ocr";
  source: "curated" | "tooltip" | "layout" | "ai";
  question?: string;
  instructions: string[];
}

export interface PdfTextBlock {
  id: string;
  text: string;
  rect: PdfRect;
  /** The source run included a printed blank answer line. */
  hasAnswerLine?: boolean;
}

export interface FieldContextCandidates {
  blocks: PdfTextBlock[];
  widgets: { rect: PdfRect; option?: string }[];
}

export interface FormField {
  id: string;
  rawName: string;
  /** Field name with array indexes and anonymous subforms removed. */
  path: string;
  page: number;
  /** One rect per widget; radio groups have several. */
  rects: PdfRect[];
  type: FieldType;
  label: string;
  tooltip?: string;
  options?: string[];
  section: string;
  context?: FieldContext;
  /** Browser-only evidence for on-demand association; never includes field values. */
  contextCandidates?: FieldContextCandidates;
  /** Present only when the PDF marks the field as required. */
  required?: boolean;
}

export type FieldSummary = Pick<
  FormField,
  "id" | "path" | "page" | "type" | "label" | "section" | "options" | "context"
>;

/** What the client sends to the server about the open form. Never includes field values. */
export interface FormContext {
  formNumber?: string;
  fileName?: string;
  pageCount: number;
  fields: FieldSummary[];
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  department: string;
  description: string;
  tags: string[];
}

export interface KeyPoints {
  title: string;
  items: string[];
}

export interface FieldExplanation {
  fieldId: string;
  meaning: string;
  whatToEnter: string;
  formatExample?: string;
  whereToFind?: string;
  keyPoints?: KeyPoints;
  commonMistakes: string[];
  sources: Resource[];
  /** True when the content comes from curated official guidance. */
  grounded: boolean;
}

export interface FormOverview {
  formNumber?: string;
  title: string;
  department?: string;
  summary: string;
  whoFiles?: string;
  youNeed: string[];
  howToSubmit?: string;
  fieldCount: number;
  pageCount: number;
  resources: Resource[];
  curated: boolean;
}

export interface FieldRef {
  id: string;
  label: string;
  page: number;
  document: string;
}

export interface AssistantReply {
  text: string;
  resources?: Resource[];
  overview?: FormOverview;
  fieldRefs?: FieldRef[];
}

export interface ChatMessage extends Partial<AssistantReply> {
  id: string;
  role: "user" | "assistant";
  text: string;
  language?: "en" | "fr";
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatRequest {
  message?: string;
  intent?: "overview";
  form?: FormContext;
  selectedFieldId?: string;
  history?: ChatHistoryMessage[];
  language?: "en" | "fr";
}

export interface ExplainRequest {
  field: FieldSummary;
  formNumber?: string;
}
