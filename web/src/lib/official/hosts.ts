export const ALLOWED_ROOTS = [
  "gov.bc.ca",
  "alberta.ca",
  "saskatchewan.ca",
  "gov.mb.ca",
  "ontario.ca",
  "quebec.ca",
  "gnb.ca",
  "novascotia.ca",
  "gov.nl.ca",
  "princeedwardisland.ca",
  "yukon.ca",
  "gov.nt.ca",
  "gov.nu.ca",
  "canada.ca",
] as const;

export type JurisdictionId =
  | "bc"
  | "ab"
  | "sk"
  | "mb"
  | "on"
  | "qc"
  | "nb"
  | "ns"
  | "nl"
  | "pe"
  | "yt"
  | "nt"
  | "nu"
  | "federal";

export const JURISDICTIONS: Record<
  JurisdictionId,
  { label: string; labelFr: string; root: (typeof ALLOWED_ROOTS)[number] }
> = {
  bc: { label: "British Columbia", labelFr: "Colombie-Britannique", root: "gov.bc.ca" },
  ab: { label: "Alberta", labelFr: "Alberta", root: "alberta.ca" },
  sk: { label: "Saskatchewan", labelFr: "Saskatchewan", root: "saskatchewan.ca" },
  mb: { label: "Manitoba", labelFr: "Manitoba", root: "gov.mb.ca" },
  on: { label: "Ontario", labelFr: "Ontario", root: "ontario.ca" },
  qc: { label: "Quebec", labelFr: "Québec", root: "quebec.ca" },
  nb: { label: "New Brunswick", labelFr: "Nouveau-Brunswick", root: "gnb.ca" },
  ns: { label: "Nova Scotia", labelFr: "Nouvelle-Écosse", root: "novascotia.ca" },
  nl: { label: "Newfoundland and Labrador", labelFr: "Terre-Neuve-et-Labrador", root: "gov.nl.ca" },
  pe: { label: "Prince Edward Island", labelFr: "Île-du-Prince-Édouard", root: "princeedwardisland.ca" },
  yt: { label: "Yukon", labelFr: "Yukon", root: "yukon.ca" },
  nt: { label: "Northwest Territories", labelFr: "Territoires du Nord-Ouest", root: "gov.nt.ca" },
  nu: { label: "Nunavut", labelFr: "Nunavut", root: "gov.nu.ca" },
  federal: { label: "Canada", labelFr: "Canada", root: "canada.ca" },
};

const NON_INFORMATION_SEGMENTS = new Set([
  "account",
  "accounts",
  "auth",
  "authentication",
  "login",
  "log-in",
  "sign-in",
  "signin",
  "session",
  "sessions",
  "submit",
  "submission",
  "portal",
]);

function isNonInformationPath(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  return decoded
    .split("/")
    .map((segment) => segment.split(";")[0].toLowerCase())
    .some((segment) => NON_INFORMATION_SEGMENTS.has(segment));
}

export interface AllowedOfficialUrl {
  url: URL;
  root: (typeof ALLOWED_ROOTS)[number];
  jurisdiction: JurisdictionId;
}

export function isAllowedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return ALLOWED_ROOTS.some(
    (root) => normalized === root || normalized.endsWith(`.${root}`),
  );
}

export function jurisdictionForHost(hostname: string): JurisdictionId | null {
  const root = ALLOWED_ROOTS.find(
    (candidate) =>
      hostname === candidate || hostname.endsWith(`.${candidate}`),
  );
  if (!root) return null;
  return (
    (Object.entries(JURISDICTIONS).find(([, jurisdiction]) => jurisdiction.root === root)?.[0] as
      | JurisdictionId
      | undefined) ?? null
  );
}

export function parseAllowedOfficialUrl(value: string): AllowedOfficialUrl | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      hostname.endsWith(".") ||
      !isAllowedHost(hostname) ||
      url.search ||
      url.hash ||
      isNonInformationPath(url.pathname)
    ) {
      return null;
    }

    const jurisdiction = jurisdictionForHost(hostname);
    if (!jurisdiction) return null;
    return {
      url,
      root: JURISDICTIONS[jurisdiction].root,
      jurisdiction,
    };
  } catch {
    return null;
  }
}
