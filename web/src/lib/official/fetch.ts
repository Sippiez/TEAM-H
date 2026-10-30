import "server-only";

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { request as httpsRequest } from "node:https";
import type { RequestOptions } from "node:https";
import { parseAllowedOfficialUrl } from "./hosts";

const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_TEXT_CHARS = 12_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface OfficialPage {
  url: string;
  title: string;
  text: string;
  language: "en-CA" | "fr-CA";
  archived: boolean;
  hasBlockedDownloads?: boolean;
  links?: Array<{ url: string; title: string }>;
}

export function isArchivedPage(
  page: { title: string; text: string; archived?: boolean },
): boolean {
  const text = `${page.title} ${page.text}`;
  return page.archived === true ||
    /\b(?:archived content|this page (?:(?:has been|is(?: now)?) )?archived|superseded|replaced by (?:the )?current (?:version|page)|out of date)\b|(?:page (?:est|a été) archivée|contenu archivé|remplacé par la version actuelle)/i.test(text);
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: Uint8Array;
}

export interface OfficialFetchDependencies {
  resolve?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  request?: (
    url: URL,
    addresses: Array<{ address: string; family: number }>,
    signal: AbortSignal,
  ) => Promise<HttpResponse>;
}

export function createPinnedLookup(
  addresses: Array<{ address: string; family: number }>,
): LookupFunction {
  const chosen = addresses[0];
  return (_hostname, options, callback) => {
    if (options && typeof options === "object" && "all" in options && options.all) {
      callback(null, addresses);
    } else {
      callback(null, chosen.address, chosen.family);
    }
  };
}

export class OfficialFetchError extends Error {
  constructor(
    readonly reason:
      | "blocked_url"
      | "unsafe_address"
      | "dns_failed"
      | "network_failed"
      | "redirect_limit"
      | "redirect_loop"
      | "redirect_missing_location"
      | "http_status"
      | "content_type"
      | "content_encoding"
      | "body_too_large"
      | "empty_content"
      | "deadline",
  ) {
    super(reason);
  }
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b, c] = parts;
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function ipv6Groups(address: string): number[] | null {
  if (isIP(address) !== 6) return null;
  const normalized = address.toLowerCase().split("%")[0];
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  let left = halves[0] ? halves[0].split(":") : [];
  let right = halves[1] ? halves[1].split(":") : [];
  const dotted = [...left, ...right].find((group) => group.includes("."));
  if (dotted) {
    const parts = dotted.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) {
      return null;
    }
    const replacement = [
      ((parts[0] << 8) | parts[1]).toString(16),
      ((parts[2] << 8) | parts[3]).toString(16),
    ];
    const expand = (groups: string[]) =>
      groups.flatMap((group) => group === dotted ? replacement : [group]);
    left = expand(left);
    right = expand(right);
  }
  const groups = halves.length === 1
    ? left
    : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  if (groups.length !== 8) return null;
  const values = groups.map((group) => Number.parseInt(group || "0", 16));
  return values.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffff)
    ? null
    : values;
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;
  const groups = ipv6Groups(address);
  if (!groups) return false;
  const [first, second] = groups;
  const globallyRoutable = (first & 0xe000) === 0x2000;
  const documentation = first === 0x2001 && second === 0x0db8;
  const protocolAssignment = first === 0x2001 && second <= 0x01ff;
  const sixToFour = first === 0x2002;
  const documentationV2 = first === 0x3fff && second <= 0x0fff;
  return globallyRoutable &&
    !documentation &&
    !protocolAssignment &&
    !sixToFour &&
    !documentationV2;
}

async function resolvePublicAddresses(hostname: string) {
  if (isIP(hostname)) throw new OfficialFetchError("unsafe_address");
  let records: Array<{ address: string; family: number }>;
  try {
    records = await dnsLookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new OfficialFetchError("dns_failed");
  }
  if (records.length === 0 || records.some(({ address }) => !isPublicAddress(address))) {
    throw new OfficialFetchError("unsafe_address");
  }
  return records;
}

function resolveWithSignal(
  hostname: string,
  signal: AbortSignal,
  resolve: NonNullable<OfficialFetchDependencies["resolve"]>,
): Promise<Array<{ address: string; family: number }>> {
  return new Promise((accept, reject) => {
    if (signal.aborted) {
      reject(new OfficialFetchError("deadline"));
      return;
    }
    const onAbort = () => {
      cleanup();
      reject(new OfficialFetchError("deadline"));
    };
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
    resolve(hostname).then(
      (records) => {
        cleanup();
        accept(records);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

async function pinnedHttpsRequest(
  url: URL,
  addresses: Array<{ address: string; family: number }>,
  signal: AbortSignal,
): Promise<HttpResponse> {
  if (signal.aborted) throw new OfficialFetchError("deadline");
  return new Promise((resolve, reject) => {
    const options: RequestOptions = {
      protocol: "https:",
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      signal,
      headers: {
        Accept: "text/html, text/plain;q=0.9",
        "Accept-Encoding": "identity",
        "User-Agent": "TEAM-H-Official-Information-Helper/1.0",
      },
      lookup: createPinnedLookup(addresses),
    };
    const request = httpsRequest(url, options, (incoming) => {
      const chunks: Buffer[] = [];
      let total = 0;
      incoming.on("data", (chunk: Buffer) => {
        total += chunk.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          request.destroy(new OfficialFetchError("body_too_large"));
          return;
        }
        chunks.push(chunk);
      });
      incoming.on("end", () => {
        const response: HttpResponse = {
          status: incoming.statusCode ?? 0,
          headers: {
            "content-type": incoming.headers["content-type"],
            "content-encoding": incoming.headers["content-encoding"],
            location: incoming.headers.location,
          },
          body: Buffer.concat(chunks),
        };
        resolve(response);
      });
      incoming.on("error", reject);
    });
    request.setTimeout(8_000, () => request.destroy(new OfficialFetchError("deadline")));
    request.on("error", (error) => {
      if (error instanceof OfficialFetchError) reject(error);
      else reject(new OfficialFetchError(signal.aborted ? "deadline" : "network_failed"));
    });
    request.end();
  });
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    nbsp: " ",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] !== "#") return named[entity.toLowerCase()] ?? whole;
    const hex = entity[1]?.toLowerCase() === "x";
    const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : whole;
  });
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<(script|style|noscript|svg|iframe|form|nav|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

function extractPage(body: Uint8Array, contentType: string, url: URL): OfficialPage {
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  if (mediaType !== "text/html" && mediaType !== "text/plain") {
    throw new OfficialFetchError("content_type");
  }
  const source = new TextDecoder("utf-8", { fatal: false }).decode(body);
  let title = "";
  let text = source;
  let documentText = source;
  let hasBlockedDownloads = false;
  const links: Array<{ url: string; title: string }> = [];
  let language: "en-CA" | "fr-CA" =
    /(?:^|\/)fr(?:\/|$)/i.test(url.pathname) ? "fr-CA" : "en-CA";
  if (mediaType === "text/html") {
    const main = source.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1] ??
      source.match(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/i)?.[1] ??
      source;
    const documentLanguage = source.match(/<html\b[^>]*\blang=["']([^"']+)/i)?.[1];
    if (documentLanguage?.toLowerCase().startsWith("fr")) language = "fr-CA";
    else if (documentLanguage?.toLowerCase().startsWith("en")) language = "en-CA";
    title = decodeHtmlEntities(
      source.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? "",
    ).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    text = htmlToText(main);
    documentText = htmlToText(source);
    for (const match of main.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi)) {
      const reference = decodeHtmlEntities(match[1]);
      if (!URL.canParse(reference, url)) continue;
      const destination = parseAllowedOfficialUrl(new URL(reference, url).toString());
      if (destination && !/\.(?:pdf|docx?|xlsx?|zip)$/i.test(destination.url.pathname) &&
        !links.some((link) => link.url === destination.url.toString())) {
        links.push({ url: destination.url.toString(), title: htmlToText(match[2]).slice(0, 240) });
      }
      if (links.length >= 80) break;
    }
    for (const match of source.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
      if (!/\.pdf(?:$|[?#])|\/CallForm\.html\b/i.test(match[1])) continue;
      try {
        const destination = new URL(decodeHtmlEntities(match[1]), url);
        if (!parseAllowedOfficialUrl(destination.toString())) hasBlockedDownloads = true;
      } catch {
        hasBlockedDownloads = true;
      }
    }
  }
  const archived = isArchivedPage({ title, text: documentText });
  text = text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
  if (text.length < 80) throw new OfficialFetchError("empty_content");
  return { url: url.toString(), title: title || url.hostname, text, language, archived, hasBlockedDownloads, links };
}

export async function fetchOfficialPage(
  candidate: string,
  signal: AbortSignal,
  dependencies: OfficialFetchDependencies = {},
): Promise<OfficialPage> {
  const resolve = dependencies.resolve ?? resolvePublicAddresses;
  const request = dependencies.request ?? pinnedHttpsRequest;
  let current = parseAllowedOfficialUrl(candidate)?.url;
  if (!current) throw new OfficialFetchError("blocked_url");
  const visited = new Set<string>();

  for (let hop = 0; hop <= 3; hop += 1) {
    if (signal.aborted) throw new OfficialFetchError("deadline");
    const normalized = current.toString();
    if (visited.has(normalized)) throw new OfficialFetchError("redirect_loop");
    visited.add(normalized);

    const parsed = parseAllowedOfficialUrl(normalized);
    if (!parsed) throw new OfficialFetchError("blocked_url");
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await resolveWithSignal(parsed.url.hostname, signal, resolve);
    } catch (error) {
      if (error instanceof OfficialFetchError) throw error;
      throw new OfficialFetchError("dns_failed");
    }
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new OfficialFetchError("unsafe_address");
    }
    const response = await request(parsed.url, addresses, signal);
    const encoding = response.headers["content-encoding"];
    if (encoding && encoding.toLowerCase() !== "identity") {
      throw new OfficialFetchError("content_encoding");
    }
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.location;
      if (!location) throw new OfficialFetchError("redirect_missing_location");
      if (hop === 3) throw new OfficialFetchError("redirect_limit");
      let next: URL;
      try {
        next = new URL(location, parsed.url);
      } catch {
        throw new OfficialFetchError("blocked_url");
      }
      const nextAllowed = parseAllowedOfficialUrl(next.toString());
      if (!nextAllowed) {
        throw new OfficialFetchError("blocked_url");
      }
      current = nextAllowed.url;
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new OfficialFetchError("http_status");
    }
    if (response.body.byteLength > MAX_RESPONSE_BYTES) {
      throw new OfficialFetchError("body_too_large");
    }
    return extractPage(
      response.body,
      response.headers["content-type"] ?? "",
      parsed.url,
    );
  }
  throw new OfficialFetchError("redirect_limit");
}
