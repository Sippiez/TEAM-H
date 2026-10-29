import { parseAllowedOfficialUrl } from "@/lib/official/hosts";

const STOPWORDS = new Set(
  (
    "a an the i im my me mine is are am was be been do does did to of in on at for and or but " +
    "what whats where which who whom how can could should would will this that these those it its " +
    "with your you we our us put write enter fill form field fields go goes about tell please " +
    "there here any some if then than so just get give find need know want help"
  ).split(" "),
);

function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/** Lowercase, accent-folded keyword tokens with stopwords removed. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/** "PlaceBirthCity" -> "Place birth city", "Surname_txr" -> "Surname". */
export function humanize(segment: string): string {
  const words = segment
    .replace(/_(txt|txr)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** The shared user-approved official-host and public-page URL policy. */
export function isAllowedGovUrl(url: string): boolean {
  return parseAllowedOfficialUrl(url) !== null;
}
