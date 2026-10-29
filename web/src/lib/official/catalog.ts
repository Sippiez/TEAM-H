import { JURISDICTIONS, type JurisdictionId } from "./hosts";

export const SERVICE_CATALOG = {
  passport: {
    label: "passport application and renewal",
    labelFr: "demande et renouvellement de passeport",
    keywords: ["passport", "passports", "Canadian passport", "PPTC 153"],
    keywordsFr: ["passeport", "passeports", "passeport canadien", "PPTC 153"],
  },
  income_tax: {
    label: "personal income tax filing",
    labelFr: "déclaration de revenus des particuliers",
    keywords: ["personal income tax", "income tax", "taxes", "tax return", "CRA form"],
    keywordsFr: ["impôt sur le revenu des particuliers", "impôt", "déclaration de revenus", "formulaire ARC"],
  },
  social_insurance: {
    label: "Social Insurance Number application",
    labelFr: "demande de numéro d’assurance sociale",
    keywords: ["Social Insurance Number", "SIN", "SIN application"],
    keywordsFr: ["numéro d’assurance sociale", "demande de NAS"],
  },
  employment_insurance: {
    label: "Employment Insurance benefits",
    labelFr: "prestations d’assurance-emploi",
    keywords: ["Employment Insurance", "EI benefits"],
    keywordsFr: ["assurance-emploi", "prestations AE"],
  },
  child_benefits: {
    label: "child and family benefits",
    labelFr: "prestations pour enfants et familles",
    keywords: ["child benefit", "child benefits", "family benefits"],
    keywordsFr: ["allocation pour enfants", "prestations familiales"],
  },
  pension: {
    label: "retirement pension benefits",
    labelFr: "prestations de pension de retraite",
    keywords: ["retirement pension", "Canada Pension Plan"],
    keywordsFr: ["pension de retraite", "Régime de pensions du Canada"],
  },
  health_card: {
    label: "provincial or territorial health card",
    labelFr: "carte d’assurance maladie provinciale ou territoriale",
    keywords: ["health card", "health coverage"],
    keywordsFr: ["carte santé", "assurance maladie"],
  },
  driver_licence: {
    label: "driver licence application and renewal",
    labelFr: "demande et renouvellement de permis de conduire",
    keywords: ["driver licence", "driving licence"],
    keywordsFr: ["permis de conduire"],
  },
  housing_support: {
    label: "housing assistance and rent support",
    labelFr: "aide au logement et soutien au loyer",
    keywords: ["housing assistance", "rent support"],
    keywordsFr: ["aide au logement", "aide au loyer"],
  },
} as const;

export type ServiceId = keyof typeof SERVICE_CATALOG;
export type FacetId = "overview" | "steps" | "fees" | "documents";

const FACETS: Record<FacetId, { en: string; fr: string }> = {
  overview: { en: "official program information", fr: "renseignements officiels sur le programme" },
  steps: { en: "how to apply application steps", fr: "comment présenter une demande étapes" },
  fees: { en: "fees costs", fr: "frais coûts" },
  documents: { en: "required documents forms", fr: "formulaires documents requis" },
};

const FACET_CUES: Record<FacetId, string[]> = {
  overview: ["overview", "about", "information", "what is", "aperçu", "renseignements", "à propos"],
  steps: ["how to", "how do", "apply", "application steps", "renew", "steps", "comment", "demande", "renouvel", "étapes"],
  fees: ["fee", "fees", "cost", "price", "how much", "pay", "frais", "coût", "cout", "prix", "combien"],
  documents: ["document", "form", "proof", "what do i need", "required", "documents", "formulaire", "preuve", "pièce", "requis"],
};

const JURISDICTION_KEYWORDS: Record<JurisdictionId, { en: string; fr: string }> = {
  bc: { en: "British Columbia", fr: "Colombie-Britannique" },
  ab: { en: "Alberta", fr: "Alberta" },
  sk: { en: "Saskatchewan", fr: "Saskatchewan" },
  mb: { en: "Manitoba", fr: "Manitoba" },
  on: { en: "Ontario", fr: "Ontario" },
  qc: { en: "Quebec", fr: "Québec" },
  nb: { en: "New Brunswick", fr: "Nouveau-Brunswick" },
  ns: { en: "Nova Scotia", fr: "Nouvelle-Écosse" },
  nl: { en: "Newfoundland and Labrador", fr: "Terre-Neuve-et-Labrador" },
  pe: { en: "Prince Edward Island", fr: "Île-du-Prince-Édouard" },
  yt: { en: "Yukon", fr: "Yukon" },
  nt: { en: "Northwest Territories", fr: "Territoires du Nord-Ouest" },
  nu: { en: "Nunavut", fr: "Nunavut" },
  federal: { en: "Canada federal government", fr: "gouvernement fédéral du Canada" },
};

export const SERVICE_IDS = Object.keys(SERVICE_CATALOG) as ServiceId[];
export const FACET_IDS = Object.keys(FACETS) as FacetId[];
export const JURISDICTION_IDS = Object.keys(JURISDICTION_KEYWORDS) as JurisdictionId[];

export interface LookupSelection {
  serviceId: ServiceId;
  jurisdiction: JurisdictionId;
  facetId: FacetId;
  language: "en" | "fr";
}

export function validateLookupSelection(value: unknown): LookupSelection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  if (
    Object.keys(object).sort().join(",") !==
    ["facetId", "jurisdiction", "language", "serviceId"].sort().join(",") ||
    typeof object.serviceId !== "string" ||
    !SERVICE_IDS.includes(object.serviceId as ServiceId) ||
    typeof object.jurisdiction !== "string" ||
    !JURISDICTION_IDS.includes(object.jurisdiction as JurisdictionId) ||
    typeof object.facetId !== "string" ||
    !FACET_IDS.includes(object.facetId as FacetId) ||
    (object.language !== "en" && object.language !== "fr")
  ) {
    return null;
  }
  return object as unknown as LookupSelection;
}

export function buildCanonicalQuery(selection: LookupSelection): string {
  const service = SERVICE_CATALOG[selection.serviceId];
  const facet = FACETS[selection.facetId];
  const jurisdiction = JURISDICTION_KEYWORDS[selection.jurisdiction];
  const terms = selection.language === "fr"
    ? [jurisdiction.fr, ...service.keywordsFr, facet.fr]
    : [jurisdiction.en, ...service.keywords, facet.en];
  return terms.join(" ").replace(/\s+/g, " ").trim().slice(0, 240);
}

function normalizedText(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

function containsPhrase(text: string, phrase: string): boolean {
  const escaped = normalizedText(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(text);
}

export function serviceMatchesText(text: string, serviceId: ServiceId): boolean {
  const normalized = normalizedText(text);
  const service = SERVICE_CATALOG[serviceId];
  return [...service.keywords, ...service.keywordsFr, service.label, service.labelFr]
    .some((phrase) => containsPhrase(normalized, phrase));
}

export function selectionIsExplicit(
  message: string,
  selection: LookupSelection,
): boolean {
  const text = normalizedText(message);
  const mentionedServices = SERVICE_IDS.filter((serviceId) =>
    serviceMatchesText(text, serviceId),
  );
  const matchingFacets = FACET_IDS.filter((facetId) =>
    FACET_CUES[facetId].some((cue) => containsPhrase(text, cue)),
  );
  return mentionedServices.length === 1 &&
    mentionedServices[0] === selection.serviceId &&
    matchingFacets.length === 1 &&
    matchingFacets[0] === selection.facetId;
}

export function allowedRootForSelection(
  selection: LookupSelection,
): string {
  return JURISDICTIONS[selection.jurisdiction].root;
}
