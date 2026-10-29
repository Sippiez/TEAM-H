/** PDF user-space rectangle: [x1, y1, x2, y2]. */
export type PdfRect = [number, number, number, number];

export type FieldType = "text" | "checkbox" | "radio" | "choice" | "signature";

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
}

export type FieldSummary = Pick<
  FormField,
  "id" | "path" | "page" | "type" | "label" | "section" | "options"
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
}

export type SourceProvenance =
  | { kind: "live_official"; retrievedAt: string }
  | { kind: "reviewed_snapshot"; reviewedAt: string }
  | { kind: "saved_guidance"; reviewedAt: null };

export type OfficialLookupStatus =
  | "verified"
  | "clarification_required"
  | "no_verified_results"
  | "unavailable";

export interface OfficialLookupSummary {
  status: OfficialLookupStatus;
  reason: string;
  partial: boolean;
  jurisdiction?: string;
  serviceId?: string;
  facetId?: string;
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
}

export interface AssistantReply {
  text: string;
  resources?: Resource[];
  overview?: FormOverview;
  fieldRefs?: FieldRef[];
  highlightFieldId?: string;
}

export interface ChatMessage extends Partial<AssistantReply> {
  id: string;
  role: "user" | "assistant";
  text: string;
  language?: "en" | "fr";
  lookup?: OfficialLookupSummary;
  incomplete?: boolean;
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
