import "server-only";

import type { LookupSelection } from "./catalog";
import { allowedRootForSelection, buildCanonicalQuery } from "./catalog";

export interface SearchCandidate {
  url: string;
  sponsored: boolean;
}

export interface SearchResult {
  candidates: SearchCandidate[];
  rejectedSponsored: number;
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
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error("provider_not_configured");

  const query = buildCanonicalQuery(selection);
  const site = allowedRootForSelection(selection);
  const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
  endpoint.searchParams.set("q", `site:${site} ${query}`);
  endpoint.searchParams.set("count", "5");
  endpoint.searchParams.set("safesearch", "strict");

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    cache: "no-store",
    redirect: "error",
    signal,
  });
  if (!response.ok) throw new Error("provider_request_failed");

  const payload = (await readJsonBodyLimited(response, 256_000)) as {
    web?: { results?: unknown[] };
  };
  const results = Array.isArray(payload.web?.results)
    ? payload.web.results.slice(0, 20)
    : [];
  const candidates: SearchCandidate[] = [];
  let rejectedSponsored = 0;
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const item = result as Record<string, unknown>;
    if (item.is_sponsored === true || item.is_ad === true || item.type === "ad") {
      rejectedSponsored += 1;
      continue;
    }
    if (typeof item.url !== "string") continue;
    candidates.push({ url: item.url, sponsored: false });
    if (candidates.length === 5) break;
  }
  return { candidates, rejectedSponsored };
}
