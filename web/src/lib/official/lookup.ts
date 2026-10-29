import "server-only";

import { createHash } from "node:crypto";
import { abortable } from "@/lib/abortable";
import {
  allowedRootForSelection,
  PUBLIC_FORMS,
  publicFormReference,
  serviceMatchesText,
  validateLookupSelection,
  type LookupSelection,
} from "./catalog";
import {
  fetchOfficialPage,
  isArchivedPage,
  OfficialFetchError,
  type OfficialPage,
} from "./fetch";
import {
  JURISDICTIONS,
  parseAllowedOfficialUrl,
  type JurisdictionId,
} from "./hosts";
import { searchOfficialCandidates } from "./search";
import type {
  OfficialLookupSummary,
  Resource,
  SourceProvenance,
} from "@/lib/types";

export type LookupReason =
  | "none"
  | "invalid_selection"
  | "provider_not_configured"
  | "search_failed"
  | "no_allowed_candidates"
  | "no_relevant_pages"
  | "fetch_failed"
  | "grounding_quota"
  | "grounding_failed"
  | "no_grounding"
  | "blocked_grounding_sources"
  | "deadline";

export interface OfficialSource extends Resource {
  language?: "en-CA" | "fr-CA";
  jurisdiction: JurisdictionId;
  facetId: string;
  provenance: Extract<SourceProvenance, { kind: "live_official" | "google_grounded" }>;
  evidence?: string;
  restrictedDownload?: boolean;
}

export interface OfficialLookupResult {
  outcome: OfficialLookupSummary & { reason: LookupReason };
  sources: OfficialSource[];
  answer?: string;
}

export interface LookupDependencies {
  search?: (
    selection: LookupSelection,
    signal: AbortSignal,
  ) => Promise<{
    candidates: Array<{ url: string; sponsored: boolean }>;
    rejectedSponsored: number;
    method?: "official_page" | "search";
  }>;
  fetchPage?: (
    url: string,
    signal: AbortSignal,
  ) => Promise<OfficialPage>;
  now?: () => Date;
}

const LOOKUP_TIMEOUT_MS = 10_000;
const MAX_CANDIDATES = 5;
const MAX_FETCHES = 3;
const MAX_CONCURRENCY = 2;
const MAX_EVIDENCE_CHARS = 4_000;

function isRelevantServicePage(
  selection: LookupSelection,
  page: { title: string; text: string },
): boolean {
  const content = `${page.title} ${page.text}`;
  return serviceMatchesText(content, selection.serviceId) &&
    (!selection.formId || selection.facetId !== "documents" || publicFormReference(selection.formId, content) !== null);
}

function failureReason(error: unknown): LookupReason {
  if (error instanceof Error && error.message === "provider_not_configured") {
    return "provider_not_configured";
  }
  if (error instanceof OfficialFetchError && error.reason === "deadline") {
    return "deadline";
  }
  return "fetch_failed";
}

function asSource(
  selection: LookupSelection,
  page: {
    url: string;
    title: string;
    text: string;
    language: "en-CA" | "fr-CA";
    hasBlockedDownloads?: boolean;
  },
  now: Date,
): OfficialSource {
  const parsed = parseAllowedOfficialUrl(page.url);
  if (!parsed || parsed.jurisdiction !== selection.jurisdiction) {
    throw new OfficialFetchError("blocked_url");
  }
  const retrievedAt = now.toISOString();
  const id = `live-${createHash("sha256").update(page.url).digest("hex").slice(0, 16)}`;
  const jurisdiction = JURISDICTIONS[parsed.jurisdiction];
  const formMention = selection.formId && selection.facetId === "documents"
    ? publicFormReference(selection.formId, page.text) : null;
  const evidenceStart = formMention ? Math.max(0, formMention.index - 1_000) : 0;
  return {
    id,
    title: page.title.slice(0, 240),
    url: parsed.url.toString(),
    department: page.language === "fr-CA" ? jurisdiction.labelFr : jurisdiction.label,
    description: "",
    tags: [],
    language: page.language,
    jurisdiction: parsed.jurisdiction,
    facetId: selection.facetId,
    provenance: { kind: "live_official", retrievedAt },
    evidence: page.text.slice(evidenceStart, evidenceStart + MAX_EVIDENCE_CHARS),
    restrictedDownload: page.hasBlockedDownloads === true,
  };
}

export async function lookupOfficialInformation(
  argumentsValue: unknown,
  signal?: AbortSignal,
  dependencies: LookupDependencies = {},
): Promise<OfficialLookupResult> {
  const selection = validateLookupSelection(argumentsValue);
  if (!selection) {
    return {
      outcome: { status: "clarification_required", reason: "invalid_selection", partial: false },
      sources: [],
    };
  }
  const jurisdiction = selection.jurisdiction;
  const common: Pick<OfficialLookupSummary, "jurisdiction" | "serviceId" | "facetId" | "formId" | "method"> = {
    jurisdiction,
    serviceId: selection.serviceId,
    facetId: selection.facetId,
    ...(selection.formId ? { formId: selection.formId } : {}),
    method: selection.formId && selection.facetId === "documents" ? "official_page" : "search",
  };
  if (signal?.aborted) {
    return {
      outcome: { status: "unavailable", reason: "deadline", partial: false, ...common },
      sources: [],
    };
  }

  const controller = new AbortController();
  const abortParent = () => controller.abort();
  signal?.addEventListener("abort", abortParent, { once: true });
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  const search = dependencies.search ?? searchOfficialCandidates;
  const fetchPage = dependencies.fetchPage ?? fetchOfficialPage;
  const now = dependencies.now ?? (() => new Date());
  let stage: "search" | "fetch" = "search";

  try {
    const searchResult = selection.formId && selection.facetId === "documents"
      ? {
          candidates: [{ url: PUBLIC_FORMS[selection.formId].url, sponsored: false }],
          rejectedSponsored: 0,
          method: "official_page" as const,
        }
      : await abortable(search(selection, controller.signal), controller.signal);
    common.method = searchResult.method ?? common.method;
    stage = "fetch";
    const urls = [...new Set(searchResult.candidates
      .filter((candidate) => !candidate.sponsored)
      .map((candidate) => candidate.url)
      .filter((url) => {
        const parsed = parseAllowedOfficialUrl(url);
        return parsed?.jurisdiction === jurisdiction &&
          parsed.root === allowedRootForSelection(selection);
      }))].slice(0, MAX_CANDIDATES);
    if (urls.length === 0) {
      return {
        outcome: { status: "no_verified_results", reason: "no_allowed_candidates", partial: false, ...common },
        sources: [],
      };
    }

    const sources: OfficialSource[] = [];
    let failedFetches = 0;
    let irrelevantPages = 0;
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < Math.min(urls.length, MAX_FETCHES)) {
        const index = nextIndex++;
        if (controller.signal.aborted) {
          failedFetches += 1;
          continue;
        }
        try {
          const page = await abortable(fetchPage(urls[index], controller.signal), controller.signal);
          if (isArchivedPage(page) || !isRelevantServicePage(selection, page)) {
            irrelevantPages += 1;
            continue;
          }
          const source = asSource(selection, page, now());
          if (!sources.some((existing) => existing.id === source.id)) {
            sources.push(source);
          }
        } catch {
          failedFetches += 1;
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENCY, urls.length) }, () => worker()),
    );

    if (sources.length > 0) {
      return {
        outcome: {
          status: "verified",
          reason: "none",
          partial:
            failedFetches > 0 ||
            irrelevantPages > 0 ||
            urls.length > MAX_FETCHES ||
            searchResult.rejectedSponsored > 0,
          ...common,
          restrictedDownload: sources.some((source) => source.restrictedDownload),
        },
        sources: sources.slice(0, MAX_FETCHES),
      };
    }

    return {
      outcome: {
        status: controller.signal.aborted || failedFetches > 0 ? "unavailable" : "no_verified_results",
        reason: controller.signal.aborted
          ? "deadline"
          : failedFetches > 0
            ? "fetch_failed"
            : "no_relevant_pages",
        partial: false,
        ...common,
      },
      sources: [],
    };
  } catch (error) {
    return {
      outcome: {
        status: "unavailable",
        reason: controller.signal.aborted
          ? "deadline"
          : stage === "search"
            ? failureReason(error) === "provider_not_configured"
              ? "provider_not_configured"
              : "search_failed"
            : failureReason(error),
        partial: false,
        ...common,
      },
      sources: [],
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortParent);
  }
}

export async function lookupOfficialWithFallback(
  argumentsValue: unknown,
  signal: AbortSignal | undefined,
  fallback: (args: unknown, signal?: AbortSignal) => Promise<OfficialLookupResult>,
  dependencies: LookupDependencies = {},
): Promise<OfficialLookupResult> {
  const direct = await lookupOfficialInformation(argumentsValue, signal, dependencies);
  if (direct.outcome.status === "verified" ||
    direct.outcome.status === "clarification_required" || signal?.aborted) return direct;
  const grounded = await fallback(argumentsValue, signal);
  return {
    ...grounded,
    outcome: { ...grounded.outcome, fallbackReason: direct.outcome.reason },
  };
}
