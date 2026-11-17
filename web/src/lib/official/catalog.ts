import { ALLOWED_ROOTS, JURISDICTIONS, type JurisdictionId } from "./hosts";

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
    keywords: ["Employment Insurance", "EI benefits", "EI"],
    keywordsFr: ["assurance-emploi", "prestations AE"],
  },
  child_benefits: {
    label: "child and family benefits",
    labelFr: "prestations pour enfants et familles",
    keywords: ["child benefit", "child benefits", "family benefits"],
    keywordsFr: ["allocation pour enfants", "prestations familiales"],
  },
  pension: {
    label: "Canada Pension Plan (CPP) retirement pension",
    labelFr: "pension de retraite du Régime de pensions du Canada (RPC)",
    keywords: ["retirement pension", "Canada Pension Plan", "CPP"],
    keywordsFr: ["pension de retraite", "Régime de pensions du Canada"],
  },
  old_age_security: {
    label: "Old Age Security (OAS) and Guaranteed Income Supplement (GIS)",
    labelFr: "Sécurité de la vieillesse (SV) et Supplément de revenu garanti (SRG)",
    keywords: ["Old Age Security", "OAS", "Guaranteed Income Supplement", "GIS"],
    keywordsFr: ["Sécurité de la vieillesse", "Supplément de revenu garanti", "SRG"],
  },
  student_aid: {
    label: "student aid, loans and grants",
    labelFr: "aide financière, prêts et bourses aux étudiants",
    keywords: ["student aid", "student loan", "student loans", "student grants"],
    keywordsFr: ["aide financière aux étudiants", "aide aux étudiants", "prêts étudiants", "bourses étudiantes"],
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

export const PUBLIC_FORMS = {
  pptc153: {
    formNumber: "PPTC 153",
    serviceId: "passport",
    jurisdiction: "federal",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports/new-adult-passport/get-application-form.html",
  },
  isp1000: {
    formNumber: "ISP 1000",
    serviceId: "pension",
    jurisdiction: "federal",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp/apply.html",
  },
  isp3550: {
    formNumber: "ISP 3550",
    serviceId: "old_age_security",
    jurisdiction: "federal",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/apply.html",
  },
  sk154091: {
    formNumber: "154091",
    title: "Full-Time Post-Secondary Student Saskatchewan Student Aid 2026-27",
    serviceId: "student_aid",
    jurisdiction: "sk",
    url: "https://www.saskatchewan.ca/residents/education-and-learning/saskatchewan-student-aid/student-loans-and-grants/printable-applications-and-forms",
    reference: /\b154091\b|\bFull-Time Post-Secondary Student\s+Saskatchewan Student Aid\s+2026[-\u2013]27\b|\b2026[-\u2013]27\s+Full-Time Saskatchewan Student Aid\b/i,
  },
} as const;

export type PublicFormId = keyof typeof PUBLIC_FORMS;

export interface PublicFormIdentity {
  number?: string;
  title?: string;
}

export function validatePublicForm(value: unknown): PublicFormIdentity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => key !== "number" && key !== "title")) return null;
  if (object.number !== undefined && (typeof object.number !== "string" ||
    object.number.length > 32 ||
    !/^(?:[A-Z]{1,8}[\s-]?\d{1,8}(?:[\s-]?[A-Z]{1,2})?|\d{3,8}(?:-[A-Z]{1,3})?)$/i.test(object.number.trim()))) return null;
  if (object.title !== undefined && (typeof object.title !== "string" ||
    object.title.trim().length < 8 || object.title.length > 200 ||
    !/^[\p{L}\p{N} ()'’.,/&–-]+$/u.test(object.title) ||
    object.title.trim().split(/\s+/).length < 2)) return null;
  if (object.number === undefined && object.title === undefined) return null;
  return {
    ...(typeof object.number === "string" ? { number: object.number.trim().toUpperCase().replace(/\s+/g, " ") } : {}),
    ...(typeof object.title === "string" ? { title: object.title.trim().replace(/\s+/g, " ") } : {}),
  };
}

export interface LookupContext {
  serviceId?: ServiceId;
  passportMode?: "new" | "renewal";
  jurisdiction?: JurisdictionId;
  facetId?: FacetId;
  formId?: PublicFormId;
  publicForm?: PublicFormIdentity;
}

export type LookupChoice = Pick<LookupContext, "serviceId" | "jurisdiction">;

export function validateLookupChoice(value: unknown): LookupChoice | null {
  const context = validateLookupContext(value);
  if (!context || Object.keys(context).length === 0 ||
    context.formId !== undefined || context.facetId !== undefined || context.publicForm !== undefined || context.passportMode !== undefined) return null;
  return context;
}

export function publicFormForNumber(value?: string): PublicFormId | undefined {
  const normalized = value?.trim().toUpperCase().replace(/[.!?]+$/, "").replace(/[\s-]/g, "");
  return (Object.keys(PUBLIC_FORMS) as PublicFormId[]).find(
    (id) => PUBLIC_FORMS[id].formNumber.replace(/\s/g, "") === normalized,
  );
}

export function publicFormReference(formId: PublicFormId, text: string): RegExpExecArray | null {
  const form = PUBLIC_FORMS[formId];
  if ("reference" in form) return form.reference.exec(text);
  const number = form.formNumber
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "[\\s-]*");
  return new RegExp(`\\b${number}\\b`, "i").exec(text);
}

export function publicFormsInText(text: string): PublicFormId[] {
  return (Object.keys(PUBLIC_FORMS) as PublicFormId[]).filter((id) => publicFormReference(id, text));
}

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
  documents: ["document", "form", "proof", "what do i need", "required", "documents", "formulaire", "preuve", "pièce", "requis", "download", "télécharger", "téléchargement"],
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

export type LookupSelection = {
  facetId: FacetId;
  language: "en" | "fr";
} & (
  { serviceId: ServiceId; jurisdiction: JurisdictionId; formId?: PublicFormId; passportMode?: "new" | "renewal"; publicForm?: never } |
  { publicForm: PublicFormIdentity; jurisdiction?: JurisdictionId; serviceId?: never; formId?: never; passportMode?: never }
);

export function validateLookupContext(value: unknown): LookupContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !["serviceId", "jurisdiction", "facetId", "formId", "publicForm", "passportMode"].includes(key))) return null;
  const serviceId = SERVICE_IDS.find((id) => id === object.serviceId);
  const jurisdiction = JURISDICTION_IDS.find((id) => id === object.jurisdiction);
  const facetId = FACET_IDS.find((id) => id === object.facetId);
  const formId = (Object.keys(PUBLIC_FORMS) as PublicFormId[]).find((id) => id === object.formId);
  const publicForm = object.publicForm === undefined ? undefined : validatePublicForm(object.publicForm);
  if (
    (object.serviceId !== undefined && !serviceId) ||
    (object.jurisdiction !== undefined && !jurisdiction) ||
    (object.facetId !== undefined && !facetId) ||
    (object.formId !== undefined && !formId) ||
    (object.publicForm !== undefined && (!publicForm || serviceId || formId)) ||
    (object.passportMode !== undefined && (serviceId !== "passport" ||
      (object.passportMode !== "new" && object.passportMode !== "renewal") || !!publicForm ||
      (object.passportMode === "renewal" && formId === "pptc153")))
  ) return null;
  return {
    ...(serviceId ? { serviceId } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    ...(facetId ? { facetId } : {}),
    ...(formId ? { formId } : {}),
    ...(object.passportMode === "new" || object.passportMode === "renewal" ? { passportMode: object.passportMode } : {}),
    ...(publicForm ? { publicForm } : {}),
  };
}

export function validateLookupSelection(value: unknown): LookupSelection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  if (object.publicForm !== undefined) {
    if (Object.keys(object).some((key) => !["publicForm", "jurisdiction", "facetId", "language"].includes(key))) return null;
    const context = validateLookupContext({
      publicForm: object.publicForm,
      jurisdiction: object.jurisdiction,
      facetId: object.facetId,
    });
    if (!context?.publicForm || !context.facetId ||
      (object.language !== "en" && object.language !== "fr")) return null;
    return {
      publicForm: context.publicForm, facetId: context.facetId, language: object.language,
      ...(context.jurisdiction ? { jurisdiction: context.jurisdiction } : {}),
    };
  }
  if (
    Object.keys(object).filter((key) => key !== "formId" && key !== "passportMode").sort().join(",") !==
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
  const context = validateLookupContext({
    serviceId: object.serviceId,
    jurisdiction: object.jurisdiction,
    facetId: object.facetId,
    ...(object.formId !== undefined ? { formId: object.formId } : {}),
    ...(object.passportMode !== undefined ? { passportMode: object.passportMode } : {}),
  });
  if (!context?.serviceId || !context.jurisdiction || !context.facetId) return null;
  if (context.formId) {
    const form = PUBLIC_FORMS[context.formId];
    if (form.serviceId !== context.serviceId || form.jurisdiction !== context.jurisdiction) return null;
  }
  return {
    serviceId: context.serviceId,
    jurisdiction: context.jurisdiction,
    facetId: context.facetId,
    language: object.language,
    ...(context.formId ? { formId: context.formId } : {}),
    ...(context.passportMode ? { passportMode: context.passportMode } : {}),
  };
}

export function buildCanonicalQuery(selection: LookupSelection): string {
  const facet = FACETS[selection.facetId];
  if (selection.publicForm) {
    return [
      selection.publicForm.number, selection.publicForm.title,
      selection.language === "fr" ? facet.fr : facet.en,
    ].filter(Boolean).join(" ");
  }
  const service = SERVICE_CATALOG[selection.serviceId];
  const jurisdiction = JURISDICTION_KEYWORDS[selection.jurisdiction];
  const terms = selection.language === "fr"
    ? [jurisdiction.fr, ...service.keywordsFr.filter((term) => selection.passportMode !== "renewal" || term !== "PPTC 153"), facet.fr]
    : [jurisdiction.en, ...service.keywords.filter((term) => selection.passportMode !== "renewal" || term !== "PPTC 153"), facet.en];
  if (selection.passportMode === "renewal") terms.push(selection.language === "fr" ? "renouvellement" : "renewal");
  if (selection.formId) terms.push(PUBLIC_FORMS[selection.formId].formNumber);
  return terms.join(" ").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function normalizedText(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

export function containsPhrase(text: string, phrase: string): boolean {
  const escaped = normalizedText(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(text);
}

export function requestedFacet(message: string): FacetId {
  const text = normalizedText(message);
  if (/\b(download|telecharger|telechargement)\b/.test(text)) return "documents";
  const matches = FACET_IDS.filter((id) => id !== "overview" &&
    FACET_CUES[id].some((cue) => containsPhrase(text, cue)),
  );
  return matches.length === 1 ? matches[0] : "overview";
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
  if (!selection.serviceId) return false;
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

export function allowedRootsForSelection(
  selection: LookupSelection,
): readonly string[] {
  return selection.jurisdiction ? [JURISDICTIONS[selection.jurisdiction].root] : ALLOWED_ROOTS;
}

export function publicFormDirectoryPages(selection: LookupSelection): string[] {
  const number = selection.publicForm?.number?.match(/^(CIT|IMM)[\s-]?(\d{4}[A-Z]?)$/);
  if (!number || !allowedRootsForSelection(selection).includes("canada.ca")) return [];
  const directory = selection.language === "fr"
    ? "fr/immigration-refugies-citoyennete/services/demande/formulaires-demande-guides"
    : "en/immigration-refugees-citizenship/services/application/application-forms-guides";
  return [`https://www.canada.ca/${directory}/${number[1].toLowerCase()}${number[2].toLowerCase()}.html`];
}

export function publicFormMention(identity: PublicFormIdentity, text: string): RegExpExecArray | null {
  const reference = identity.number
    ? identity.number.replace(/^([A-Z]+)[\s-]*(\d)/i, "$1 $2")
    : identity.title;
  if (!reference) return null;
  const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]*");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").exec(text);
}

export function publicFormMatchesText(identity: PublicFormIdentity, text: string): boolean {
  if (identity.number) return publicFormMention(identity, text) !== null;
  const terms = [...new Set(normalizedText(identity.title ?? "").match(/[a-z0-9]+/g))]
    .filter((term) => (term.length > 2 || /^\d+$/.test(term)) &&
      !["the", "for", "and", "application", "form", "request", "demande", "formulaire", "les", "des", "pour", "une", "aux"].includes(term));
  return terms.length >= 2 && terms.every((term) => containsPhrase(normalizedText(text), term));
}
