import type { LookupChoice, LookupContext } from "./official/catalog";

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
  /** Present only when the PDF marks the field as required. */
  required?: boolean;
  context?: FieldContext;
  /** Browser-only evidence for on-demand association; never includes field values. */
  contextCandidates?: FieldContextCandidates;
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
  language?: "en-CA" | "fr-CA";
  jurisdiction?: string;
  provenance?: SourceProvenance;
  citationUrl?: string;
}

export type SourceProvenance =
  | { kind: "live_official"; retrievedAt: string }
  | { kind: "google_grounded"; searchedAt: string }
  | { kind: "reviewed_snapshot"; reviewedAt: string }
  | { kind: "saved_guidance"; reviewedAt: null };

export type OfficialLookupStatus =
  | "verified"
  | "clarification_required"
  | "no_verified_results"
  | "unavailable";

export interface OfficialLookupSummary extends LookupContext {
  status: OfficialLookupStatus;
  reason: string;
  partial: boolean;
  method?: "official_page" | "search" | "google_grounding";
  searchSuggestionsHtml?: string;
  fallbackReason?: string;
  restrictedDownload?: boolean;
}

export type ChatStreamEvent =
  | { version: 1; type: "lookup"; outcome: OfficialLookupSummary; sources: Resource[] }
  | { version: 1; type: "delta"; text: string }
  | { version: 1; type: "error"; code: "interrupted" | "unavailable" }
  | { version: 1; type: "complete"; complete: boolean };

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
  lookup?: OfficialLookupSummary;
  incomplete?: boolean;
  error?: "timeout" | "connection" | "not_configured" | "unavailable";
  request?: Pick<ChatRequest, "message" | "intent" | "selectedFieldId" | "lookupContext" | "lookupChoice">;
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
  lookupContext?: LookupContext;
  lookupChoice?: LookupChoice;
}

export interface ExplainRequest {
  field: FieldSummary;
  formNumber?: string;
  language?: "en" | "fr";
}
