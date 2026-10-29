import type { ChatHistoryMessage } from "@/lib/types";
import {
  containsPhrase,
  normalizedText,
  PUBLIC_FORMS,
  publicFormForNumber,
  publicFormsInText,
  requestedFacet,
  SERVICE_IDS,
  serviceMatchesText,
  validateLookupContext,
  validateLookupChoice,
  validateLookupSelection,
  type LookupContext,
  type LookupChoice,
  type LookupSelection,
  type ServiceId,
} from "./catalog";
import { JURISDICTIONS, type JurisdictionId } from "./hosts";

const FEDERAL_SERVICES = new Set<ServiceId>([
  "passport", "income_tax", "social_insurance", "employment_insurance",
  "child_benefits", "pension", "old_age_security",
]);

function jurisdictionsIn(message: string): JurisdictionId[] {
  const text = normalizedText(message);
  return (Object.keys(JURISDICTIONS) as JurisdictionId[]).filter((id) => {
    const jurisdiction = JURISDICTIONS[id];
    const aliases = id === "federal"
      ? ["federal", "fédéral", "government of Canada", "gouvernement du Canada", "Canada.ca"]
      : [jurisdiction.label, jurisdiction.labelFr];
    return aliases.some((alias) => containsPhrase(text, alias));
  });
}

function servicesIn(message: string): ServiceId[] {
  const matches = SERVICE_IDS.filter((id) => serviceMatchesText(message, id));
  matches.push(...publicFormsInText(message).map((id) => PUBLIC_FORMS[id].serviceId));
  const text = normalizedText(message);
  if (/\b(lost my job|laid off|unemployed|perdu mon emploi|au chomage)\b/.test(text)) {
    matches.push("employment_insurance");
  }
  return [...new Set(matches)];
}

export function resolveLookupQuestion(message: string, history?: ChatHistoryMessage[]): string {
  if (!publicFormForNumber(message)) return message;
  return history?.filter((turn) => turn.role === "user" && !publicFormForNumber(turn.text))
    .at(-1)?.text ?? message;
}

export function resolveLookupContext(input: {
  message: string;
  formNumber?: string;
  history?: ChatHistoryMessage[];
  lookupContext?: LookupContext;
  lookupChoice?: LookupChoice;
  language: "en" | "fr";
  serviceHint?: ServiceId;
}): {
  context: LookupContext;
  selection: LookupSelection | null;
  reason: "none" | "missing_service" | "missing_jurisdiction" | "ambiguous_selection";
} {
  const text = normalizedText(input.message);
  const previous = input.history?.filter((message) => message.role === "user").at(-1)?.text ?? "";
  const previousServices = servicesIn(previous);
  const previousJurisdictions = jurisdictionsIn(previous);
  const previousForms = publicFormsInText(previous);
  const supplied = validateLookupContext(input.lookupContext ?? {}) ?? {};
  const prior: LookupContext = {
    ...(previousServices.length === 1 ? { serviceId: previousServices[0] } : {}),
    ...(previousJurisdictions.length === 1 ? { jurisdiction: previousJurisdictions[0] } : {}),
    ...(previousForms.length === 1 ? { formId: previousForms[0] } : {}),
    ...(previous ? { facetId: requestedFacet(previous) } : {}),
    ...supplied,
  };
  const services = servicesIn(input.message);
  const jurisdictions = jurisdictionsIn(input.message);
  const choice = validateLookupChoice(input.lookupChoice);
  const mentionedForms = publicFormsInText(input.message);
  const question = resolveLookupQuestion(input.message, input.history);
  const formReply = publicFormForNumber(input.message) !== undefined;
  const refersBack = /\b(this|that|same) (form|application|service|program)\b|\b(it|its)\b|^(and\b|what about\b|what documents\b|what forms\b|what fees\b|where (?:do|can) i (?:download|get|find)\b)|^how much(?: does (?:it|this|that) cost)?\s*[?.!]*$|^what are the (?:fees|costs|documents|requirements)\s*[?.!]*$|\b(ce|cet|cette|le meme|la meme) (formulaire|service|programme)\b|^(et\b|combien\b|quels documents\b|quelles pieces\b|quels sont les frais\b|ou (?:puis-je|telecharger)\b)/.test(text);
  const jurisdictionReply = jurisdictions.length === 1 &&
    [JURISDICTIONS[jurisdictions[0]].label, JURISDICTIONS[jurisdictions[0]].labelFr, "federal", "fédéral"]
      .some((label) => normalizedText(label) === text.replace(/[.!?]+$/, "").trim());
  const refersToOpenForm = /\bthis (form|application)\b|\bce formulaire\b|\bcette demande\b/.test(text);
  const followupService = (refersBack || jurisdictionReply) && !refersToOpenForm ? prior.serviceId : undefined;
  const formId = mentionedForms.length === 1
    ? mentionedForms[0]
    : mentionedForms.length === 0
      ? ((refersBack && !refersToOpenForm) ? prior.formId : undefined) ??
        publicFormForNumber(input.formNumber) ??
        (refersBack ? prior.formId : undefined)
      : undefined;
  const form = formId ? PUBLIC_FORMS[formId] : undefined;
  const serviceId = choice?.serviceId ?? (services.length === 1
    ? services[0]
    : services.length === 0
      ? followupService ?? form?.serviceId ?? input.serviceHint
      : undefined);
  const sameService = serviceId === prior.serviceId;
  const jurisdiction = serviceId && FEDERAL_SERVICES.has(serviceId)
    ? "federal"
    : choice?.jurisdiction ?? (jurisdictions.length === 1
      ? jurisdictions[0]
      : refersToOpenForm && form && form.serviceId === serviceId
        ? form.jurisdiction
        : ((refersBack || jurisdictionReply || sameService) ? prior.jurisdiction : undefined) ??
          (form && form.serviceId === serviceId ? form.jurisdiction : undefined));
  const facetId = jurisdictionReply || (formReply && question === input.message)
    ? prior.facetId ?? "overview"
    : requestedFacet(question);
  const context: LookupContext = {
    ...(serviceId ? { serviceId } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
    facetId,
    ...(formId && form && form.serviceId === serviceId && jurisdiction === form.jurisdiction ? { formId } : {}),
  };
  if ((services.length > 1 && !choice?.serviceId) ||
    (jurisdictions.length > 1 && !choice?.jurisdiction && !(serviceId && FEDERAL_SERVICES.has(serviceId)))) {
    return { context, selection: null, reason: "ambiguous_selection" };
  }
  return {
    context,
    selection: validateLookupSelection({ ...context, language: input.language }),
    reason: !serviceId ? "missing_service" : !jurisdiction ? "missing_jurisdiction" : "none",
  };
}
