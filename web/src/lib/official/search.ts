import "server-only";

import type { LookupSelection } from "./catalog";
import { allowedRootsForSelection, buildCanonicalQuery, publicFormDirectoryPages } from "./catalog";
import { getServiceResources } from "../catalog/resources";

export interface SearchCandidate {
  url: string;
  sponsored: boolean;
}

export interface SearchResult {
  candidates: SearchCandidate[];
  rejectedSponsored: number;
  method: "official_page" | "search";
}

async function readJsonBodyLimited(response: Response, maxBytes: number): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("provider_response_invalid");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("provider_response_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("provider_response_invalid");
  }
}

export async function searchOfficialCandidates(
  selection: LookupSelection,
  signal: AbortSignal,
): Promise<SearchResult> {
  const pages = selection.serviceId
    ? getServiceResources(selection.serviceId, selection.facetId, selection.jurisdiction, selection.passportMode).map(({ url }) => url)
    : publicFormDirectoryPages(selection);
  if (pages.length > 0) {
    return {
      candidates: pages.map((url) => ({ url, sponsored: false })),
      rejectedSponsored: 0,
      method: "official_page",
    };
  }
  return searchSerperCandidates(selection, signal);
}

export async function searchSerperCandidates(
  selection: LookupSelection,
  signal: AbortSignal,
): Promise<SearchResult> {
  signal.throwIfAborted();
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error("provider_not_configured");
  const query = buildCanonicalQuery(selection);
  const roots = allowedRootsForSelection(selection);
  const sites = roots.map((root) => `site:${root}`).join(" OR ");

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: `${roots.length === 1 ? sites : `(${sites})`} ${query}`,
      gl: "ca",
      hl: selection.language,
      num: 5,
    }),
    cache: "no-store",
    redirect: "error",
    credentials: "omit",
    signal,
  });
  if (response.status === 429 || response.status === 402) throw new Error("search_quota");
  if (response.status === 401 || response.status === 403) throw new Error("search_auth");
  if (!response.ok) throw new Error("provider_request_failed");

  const payload = await readJsonBodyLimited(response, 256_000);
  if (!payload || typeof payload !== "object" || !("organic" in payload) || !Array.isArray(payload.organic)) {
    throw new Error("provider_response_invalid");
  }
  const results: unknown[] = payload.organic.slice(0, 20);
  const candidates: SearchCandidate[] = [];
  let rejectedSponsored = 0;
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const item = result as Record<string, unknown>;
    if (item.is_sponsored === true || item.is_ad === true || item.type === "ad") {
      rejectedSponsored += 1;
      continue;
    }
    if (typeof item.link !== "string" || item.link.length > 2_048 || !URL.canParse(item.link)) continue;
    const url = new URL(item.link);
    // Search indexes may advertise HTTP; verification still requires HTTPS.
    if (url.protocol === "http:") url.protocol = "https:";
    candidates.push({ url: url.toString(), sponsored: false });
    if (candidates.length === 5) break;
  }
  return { candidates, rejectedSponsored, method: "search" };
}
