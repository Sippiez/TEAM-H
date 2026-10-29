import type { Resource } from "@/lib/types";
import type { FacetId, ServiceId } from "@/lib/official/catalog";
import type { JurisdictionId } from "@/lib/official/hosts";

const PASSPORTS =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports";
const PASSPORT_PROGRAM = "IRCC – Passport Program";

/**
 * Curated official federal services. URL verification on 2026-10-28 did not
 * record a content-review date; these remain saved guidance, not live sources.
 */
export const RESOURCES: Resource[] = [
  {
    id: "sk-student-aid-forms",
    title: "Saskatchewan Student Aid — printable applications and forms",
    url: "https://www.saskatchewan.ca/residents/education-and-learning/saskatchewan-student-aid/student-loans-and-grants/printable-applications-and-forms",
    department: "Government of Saskatchewan",
    description: "Official paper applications and supporting forms, organized by study year and full-time or part-time study.",
    tags: ["student", "aid", "loans", "grants", "saskatchewan", "application"],
  },
  {
    id: "passports",
    title: "Canadian passports",
    url: `${PASSPORTS}.html`,
    department: PASSPORT_PROGRAM,
    description: "Apply for, renew or replace a Canadian passport and check requirements.",
    tags: ["passport", "travel", "document", "replace", "lost", "stolen", "status"],
  },
  {
    id: "passport-new-adult",
    title: "Apply for a new adult passport",
    url: `${PASSPORTS}/new-adult-passport.html`,
    department: PASSPORT_PROGRAM,
    description: "Steps for Canadians 16 or older applying for a new passport.",
    tags: ["passport", "new", "apply", "adult", "first", "pptc"],
  },
  {
    id: "passport-required-docs",
    title: "What you need to apply for an adult passport",
    url: `${PASSPORTS}/new-adult-passport/required-documents-photos.html`,
    department: PASSPORT_PROGRAM,
    description:
      "Proof of citizenship, ID, 2 photos, a guarantor and 2 references, including who can be a guarantor or reference.",
    tags: [
      "guarantor",
      "reference",
      "requirement",
      "document",
      "checklist",
      "photo",
      "need",
      "eligible",
    ],
  },
  {
    id: "passport-get-form",
    title: "Get the adult passport application form",
    url: `${PASSPORTS}/new-adult-passport/get-application-form.html`,
    department: PASSPORT_PROGRAM,
    description: "Download PPTC 153 and related forms for addresses, jobs and references.",
    tags: ["form", "download", "pptc", "153", "application", "pdf"],
  },
  {
    id: "passport-submit",
    title: "Submit your passport application and pay the fees",
    url: `${PASSPORTS}/new-adult-passport/apply-submit-fees.html`,
    department: PASSPORT_PROGRAM,
    description: "Where and how to submit (in person or by mail) based on when you need it.",
    tags: ["submit", "mail", "person", "office", "where", "send", "urgent", "apply", "pay"],
  },
  {
    id: "passport-renew",
    title: "Renew an adult passport",
    url: `${PASSPORTS}/renew-adult-passport.html`,
    department: PASSPORT_PROGRAM,
    description: "Find out if you're eligible to renew, which is simpler than applying for a new passport.",
    tags: ["renew", "renewal", "expire", "expired", "simplified", "online"],
  },
  {
    id: "passport-fees",
    title: "Passport fees",
    url: `${PASSPORTS}/fees.html`,
    department: PASSPORT_PROGRAM,
    description: "Current fees for 5-year and 10-year passports and other services.",
    tags: ["fee", "cost", "price", "pay", "payment", "much", "validity"],
  },
  {
    id: "passport-photos",
    title: "Passport photo requirements",
    url: `${PASSPORTS}/photos.html`,
    department: PASSPORT_PROGRAM,
    description: "Size, background and what the photographer must write on the back.",
    tags: ["photo", "picture", "photographer"],
  },
  {
    id: "passport-id-docs",
    title: "Documents to support your identity",
    url: `${PASSPORTS}/new-adult-passport/identity-documents.html`,
    department: PASSPORT_PROGRAM,
    description: "Accepted ID such as a driver's licence or health card, and how to submit copies.",
    tags: ["id", "identity", "identification", "driver", "licence", "license", "health", "card"],
  },
  {
    id: "passport-citizenship-proof",
    title: "Proof of Canadian citizenship for a passport",
    url: `${PASSPORTS}/new-adult-passport/citizenship-proof.html`,
    department: PASSPORT_PROGRAM,
    description: "Birth certificates and citizenship certificates you can use.",
    tags: ["citizenship", "birth", "certificate", "proof", "born"],
  },
  {
    id: "passport-change-name",
    title: "Change the name in your passport",
    url: `${PASSPORTS}/change-name.html`,
    department: PASSPORT_PROGRAM,
    description: "Documents you need if your name changed through marriage or a legal change.",
    tags: ["name", "change", "marriage", "married", "divorce", "surname"],
  },
  {
    id: "cra-sign-in",
    title: "CRA sign-in services (My Account)",
    url: "https://www.canada.ca/en/revenue-agency/services/e-services/cra-login-services.html",
    department: "Canada Revenue Agency",
    description: "Sign in to view your tax returns, notices of assessment and benefit payments.",
    tags: ["cra", "account", "tax", "login", "sign", "notice", "assessment", "online"],
  },
  {
    id: "income-tax",
    title: "Personal income tax",
    url: "https://www.canada.ca/en/services/taxes/income-tax/personal-income-tax.html",
    department: "Canada Revenue Agency",
    description: "File your return, check deadlines and find deductions and credits.",
    tags: ["tax", "income", "file", "return", "deadline", "refund"],
  },
  {
    id: "cra-forms",
    title: "CRA forms and publications",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications.html",
    department: "Canada Revenue Agency",
    description: "Search for tax and benefit forms by number or name.",
    tags: ["form", "cra", "tax", "publication", "download"],
  },
  {
    id: "ccb",
    title: "Canada child benefit",
    url: "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit.html",
    department: "Canada Revenue Agency",
    description: "Tax-free monthly payment to help families with the cost of raising children.",
    tags: ["child", "children", "kid", "benefit", "ccb", "family", "baby", "rc66"],
  },
  {
    id: "gst-credit",
    title: "GST/HST credit",
    url: "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/gst-hst-credit.html",
    department: "Canada Revenue Agency",
    description: "Tax-free quarterly payment for individuals and families with low and modest incomes.",
    tags: ["gst", "hst", "credit", "payment", "low", "income"],
  },
  {
    id: "ei",
    title: "Employment Insurance (EI)",
    url: "https://www.canada.ca/en/services/benefits/ei.html",
    department: "Employment and Social Development Canada",
    description: "Temporary income support for job loss, sickness, caregiving and parental leave.",
    tags: ["ei", "employment", "insurance", "job", "lost", "laid", "off", "sick", "maternity", "parental"],
  },
  {
    id: "ei-regular",
    title: "EI regular benefits",
    url: "https://www.canada.ca/en/services/benefits/ei/ei-regular-benefit.html",
    department: "Employment and Social Development Canada",
    description: "Eligibility and how to apply if you lost your job through no fault of your own.",
    tags: ["ei", "unemployed", "job", "laid", "off", "apply", "regular"],
  },
  {
    id: "cpp",
    title: "Canada Pension Plan (CPP)",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/cpp.html",
    department: "Employment and Social Development Canada",
    description: "Retirement pension, disability and survivor benefits.",
    tags: ["cpp", "pension", "retire", "retirement", "disability", "survivor", "isp"],
  },
  {
    id: "oas",
    title: "Old Age Security (OAS)",
    url: "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security.html",
    department: "Employment and Social Development Canada",
    description: "Monthly payment for people 65 and older, plus the Guaranteed Income Supplement.",
    tags: ["oas", "senior", "65", "old", "age", "pension", "gis"],
  },
  {
    id: "sin",
    title: "Social Insurance Number (SIN)",
    url: "https://www.canada.ca/en/employment-social-development/services/sin.html",
    department: "Service Canada",
    description: "Apply for, update or protect your SIN.",
    tags: ["sin", "social", "insurance", "number", "work"],
  },
  {
    id: "dental",
    title: "Canadian Dental Care Plan",
    url: "https://www.canada.ca/en/services/benefits/dental/dental-care-plan.html",
    department: "Health Canada / Service Canada",
    description: "Check eligibility and apply for help with the cost of dental care.",
    tags: ["dental", "dentist", "teeth", "cdcp", "health"],
  },
  {
    id: "benefits",
    title: "Benefits",
    url: "https://www.canada.ca/en/services/benefits.html",
    department: "Government of Canada",
    description: "Browse all federal benefits by life situation.",
    tags: ["benefit", "support", "money", "help", "financial"],
  },
  {
    id: "visit-canada",
    title: "Visit Canada",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html",
    department: "Immigration, Refugees and Citizenship Canada",
    description: "Visitor visas, eTAs and requirements to travel to Canada.",
    tags: ["visit", "visitor", "visa", "eta", "tourist", "imm", "5257"],
  },
  {
    id: "immigrate",
    title: "Immigrate to Canada",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada.html",
    department: "Immigration, Refugees and Citizenship Canada",
    description: "Permanent residence programs, including Express Entry and family sponsorship.",
    tags: ["immigrate", "immigration", "permanent", "resident", "pr", "express", "entry", "sponsor"],
  },
  {
    id: "citizenship",
    title: "Canadian citizenship",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship.html",
    department: "Immigration, Refugees and Citizenship Canada",
    description: "Apply for citizenship or proof of citizenship, and prepare for the test.",
    tags: ["citizenship", "citizen", "test", "oath", "certificate"],
  },
  {
    id: "ircc-status",
    title: "Check your IRCC application status",
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-status.html",
    department: "Immigration, Refugees and Citizenship Canada",
    description: "Check processing status for immigration, citizenship and passport applications.",
    tags: ["status", "check", "processing", "track", "application", "time"],
  },
  {
    id: "sign-in",
    title: "Sign in to a Government of Canada online account",
    url: "https://www.canada.ca/en/government/sign-in-online-account.html",
    department: "Government of Canada",
    description: "Find the right sign-in for GCKey, CRA, IRCC and other online accounts.",
    tags: ["sign", "login", "gckey", "account", "online", "password"],
  },
  {
    id: "contact",
    title: "Contact the Government of Canada",
    url: "https://www.canada.ca/en/contact.html",
    department: "Government of Canada",
    description: "Phone numbers and contact options for federal departments and services.",
    tags: ["contact", "phone", "call", "help", "agent", "talk"],
  },
];

const BY_ID = new Map(RESOURCES.map((r) => [r.id, r]));

export function getResources(ids: string[]): Resource[] {
  return ids.flatMap((id) => {
    const r = BY_ID.get(id);
    return r ? [r] : [];
  });
}

const SERVICE_RESOURCE_IDS: Record<ServiceId, string[]> = {
  passport: ["passports"],
  income_tax: ["income-tax"],
  social_insurance: ["sin"],
  employment_insurance: ["ei", "ei-regular"],
  child_benefits: ["ccb"],
  pension: ["cpp"],
  old_age_security: ["oas"],
  student_aid: [],
  health_card: [],
  driver_licence: [],
  housing_support: [],
};

export function getServiceResources(
  serviceId: ServiceId,
  facetId?: FacetId,
  jurisdiction: JurisdictionId = "federal",
): Resource[] {
  if (serviceId === "student_aid") {
    return jurisdiction === "sk" ? getResources(["sk-student-aid-forms"]) : [];
  }
  if (jurisdiction !== "federal") return [];
  if (serviceId === "passport") {
    if (facetId === "fees") return getResources(["passport-fees"]);
    if (facetId === "steps") return getResources(["passport-new-adult", "passport-submit"]);
    if (facetId === "documents") return getResources(["passport-get-form", "passport-required-docs"]);
  }
  if (serviceId === "income_tax" && facetId === "documents") {
    return getResources(["cra-forms", "income-tax"]);
  }
  return getResources(SERVICE_RESOURCE_IDS[serviceId]);
}
