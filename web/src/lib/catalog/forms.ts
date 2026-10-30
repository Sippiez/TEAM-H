import type { KeyPoints } from "@/lib/types";
import { PUBLIC_FORMS, publicFormsInText } from "@/lib/official/catalog";

/**
 * Curated guidance for one or more fields. Rules are matched against the
 * normalised field path; for each property the first matching rule that
 * defines it wins, so put specific rules before section-wide ones.
 */
export interface FieldRule {
  match: RegExp;
  label?: string;
  /** Prepended to the PDF tooltip label, e.g. "Reference 1" + "Street". */
  labelPrefix?: string;
  /** Human-readable names for radio export values. */
  optionLabels?: Record<string, string>;
  section?: string;
  keywords?: string[];
  meaning?: string;
  whatToEnter?: string;
  formatExample?: string;
  whereToFind?: string;
  keyPoints?: KeyPoints;
  commonMistakes?: string[];
  sourceIds?: string[];
  grounded?: boolean;
}

export interface KnownForm {
  formNumber: string;
  /** Matches page-1 text or raw field names. */
  detect: RegExp;
  title: string;
  department: string;
  summary: string;
  whoFiles: string;
  youNeed: string[];
  howToSubmit: string;
  resourceIds: string[];
  rules: FieldRule[];
  sample?: { url: string; description: string };
}

const GUARANTOR_POINTS: KeyPoints = {
  title: "Who can be your guarantor",
  items: [
    "18 or older and has known you personally for at least 2 years",
    "A Canadian citizen",
    "Has a 5- or 10-year Canadian passport that is valid or expired for less than 1 year",
    "Was 16 or older when they applied for that passport",
    "Can communicate in English or French and is available if the Passport Program contacts them",
  ],
};

const REFERENCE_POINTS: KeyPoints = {
  title: "Who can be a reference",
  items: [
    "18 or older and has known you for at least 2 years",
    "Agrees to you using their name and contact information",
    "Not your guarantor",
    "Not a relative, spouse or common-law partner (including in-laws and step-family)",
  ],
};

export const PPTC_153: KnownForm = {
  formNumber: "PPTC 153",
  detect: /PPTC[\s_-]?153\b/,
  title: "Adult General Passport Application",
  department: "IRCC – Passport Program",
  summary:
    "Use this form to apply for a new Canadian passport if you are 16 or older and applying in Canada or the USA. If you already have an adult passport, you may be able to renew instead, which is simpler.",
  whoFiles: "Canadian citizens aged 16 or older, applying in Canada or the USA.",
  youNeed: [
    "Proof of Canadian citizenship (original birth certificate or citizenship certificate)",
    "At least 1 document to support your identity, such as a driver's licence or health card",
    "2 identical passport photos (your guarantor signs 1)",
    "A guarantor who has known you for 2+ years",
    "2 references who aren't relatives",
    "Your current passport, if it's still valid",
  ],
  howToSubmit:
    "In person at a passport office or Service Canada Centre, or by mail. The best option depends on when you need your passport.",
  resourceIds: ["passport-required-docs", "passport-submit", "passport-renew", "passport-fees"],
  sample: {
    url: "/forms/pptc153.pdf",
    description: "Adult general passport application (IRCC, 8 pages)",
  },
  rules: [
    // 1 · Personal information
    {
      match: /\.PersonalInfo\.Surname$/,
      label: "Surname (last name)",
      keywords: ["last", "family", "name"],
      meaning: "Your family name, exactly as you want it printed in your passport.",
      whatToEnter:
        "Write your surname in CAPITAL LETTERS. It must match your proof of citizenship, or the legal documents that changed your name.",
      formatExample: "TREMBLAY",
      whereToFind: "Birth certificate or citizenship certificate, plus any legal name-change documents.",
      commonMistakes: [
        "Using a nickname or a spelling your documents don't support",
        "Swapping your surname and given names",
      ],
      sourceIds: ["passport-citizenship-proof", "passport-change-name"],
      grounded: true,
    },
    {
      match: /\.PersonalInfo\.GivenName$/,
      label: "Given name(s)",
      keywords: ["first", "middle", "name"],
      meaning: "Your first name and any middle names, as you want them printed in your passport.",
      whatToEnter: "Write all given names in CAPITAL LETTERS, in the same order as on your proof of citizenship.",
      formatExample: "MARIE CLAIRE",
      whereToFind: "Birth certificate or citizenship certificate.",
      commonMistakes: ["Leaving out middle names that appear on your documents"],
      sourceIds: ["passport-citizenship-proof"],
      grounded: true,
    },
    {
      match: /\.PersonalInfo\.SurnameBirth$/,
      label: "Former surnames",
      keywords: ["former", "previous", "maiden", "birth", "name"],
      meaning:
        "Any surnames you used before, including your surname at birth if it's different. These won't appear in your passport.",
      whatToEnter: "List every former surname, separated by commas. Leave it blank if you've never had another surname.",
      formatExample: "GAGNON, SMITH",
      commonMistakes: ["Forgetting a surname used before marriage or adoption"],
      sourceIds: ["passport-change-name"],
      grounded: true,
    },
    {
      match: /\.PersonalInfo\.MaidenName$/,
      label: "Surname of parent(s) at their birth",
      keywords: ["parent", "mother", "father", "maiden"],
      meaning: "The surname each of your parents had when they were born.",
      whatToEnter: "Write your parents' surnames at birth, which may differ from their current surnames.",
      whereToFind: "A long-form birth certificate often lists parents' names; otherwise ask a family member.",
      commonMistakes: ["Entering a parent's married name instead of their surname at birth"],
      grounded: false,
    },
    {
      match: /\.TravelSection\.TravelDate$/,
      label: "Anticipated date of travel",
      optionLabels: { DATE: "Date (enter below)", UNKNOWN: "Unknown" },
    },
    { match: /\.TravelSection\.Month$/, label: "Travel date: month", formatExample: "07" },
    { match: /\.TravelSection\.Day$/, label: "Travel date: day", formatExample: "15" },
    {
      match: /\.TravelSection\./,
      keywords: ["travel", "trip", "date", "when", "leave"],
      meaning: "When you plan to travel, so the Passport Program knows when you need the passport.",
      whatToEnter: "Choose a date and enter the month and day, or choose Unknown if you have no travel plans.",
      formatExample: "Month 07, Day 15",
      commonMistakes: [
        "Booking non-refundable travel before your passport arrives. The form recommends waiting.",
      ],
      sourceIds: ["passport-submit"],
      grounded: true,
    },
    {
      match: /\.PlaceOfBirth\./,
      keywords: ["birth", "born", "birthplace", "city", "country"],
      meaning: "The city, country and province, territory or state where you were born.",
      whatToEnter: "Enter it exactly as it appears on your birth certificate or citizenship certificate.",
      formatExample: "WINNIPEG · CANADA · MB",
      whereToFind: "Proof of citizenship (birth certificate or citizenship certificate).",
      sourceIds: ["passport-citizenship-proof"],
      grounded: true,
    },
    {
      match: /\.DOBYear$/,
      label: "Date of birth",
      keywords: ["birthday", "dob", "born", "date", "birth"],
      meaning: "The date you were born.",
      whatToEnter: "Use the format shown on the form: year, month, day.",
      formatExample: "1990-04-15 (YYYY-MM-DD)",
      whereToFind: "Birth certificate or citizenship certificate.",
      commonMistakes: ["Writing the date as DD-MM-YYYY or MM-DD-YYYY"],
      grounded: true,
    },
    {
      match: /\.Gender\.Sex$/,
      label: "Sex",
      optionLabels: { F: "Female", M: "Male", X: "Another gender" },
      keywords: ["gender", "sex", "male", "female"],
      meaning: "The sex or gender identifier you want displayed in your passport.",
      whatToEnter: "Select F (female), M (male) or X (another gender).",
      commonMistakes: ["Selecting more than one option"],
      sourceIds: ["passports"],
      grounded: true,
    },
    {
      match: /\.EyeColour$/,
      keywords: ["eye", "colour", "color"],
      meaning: "Your natural eye colour. It's used as a physical description.",
      whatToEnter: "Write a simple colour word.",
      formatExample: "BROWN, BLUE, GREEN, HAZEL or GREY",
      commonMistakes: ["Describing tinted contact lenses instead of your natural colour"],
      grounded: true,
    },
    {
      match: /\.Height$/,
      keywords: ["height", "tall"],
      meaning: "How tall you are. It's used as a physical description.",
      whatToEnter: "Enter your height and include the unit (cm or in).",
      formatExample: "170 cm or 5 ft 7 in",
      commonMistakes: ["Leaving out the unit"],
      grounded: true,
    },
    {
      match: /\.CurrentAddress\.PC$/,
      formatExample: "R3C 4T3 (Canada) or 98101 (USA)",
    },
    {
      match: /\.CurrentAddress\./,
      keywords: ["home", "address", "live", "residence"],
      meaning: "The address where you live now.",
      whatToEnter: "Write your full home address. Use the Apt. box only if you live in a unit.",
      whereToFind: "A recent bill, lease or your driver's licence.",
      commonMistakes: ["Entering a PO box as your home address", "Leaving out the apartment number"],
      grounded: false,
    },
    {
      match: /\.MailingAddress\./,
      keywords: ["mailing", "mail", "address", "po", "box"],
      meaning: "Where mail should go, if it's different from your home address.",
      whatToEnter: "Complete this only if your mailing address is different from your current home address.",
      commonMistakes: ["Repeating your home address when it's the same. You can leave this blank."],
      sourceIds: ["passport-submit"],
      grounded: true,
    },
    {
      match: /\.MorepersonalInfo\.(CellEmail|DaytimePhone|EveningPhone)$/,
      keywords: ["contact", "phone", "telephone", "email", "reach"],
      meaning: "How the Passport Program can contact you about your application.",
      whatToEnter: "Give a phone number (with area code) and an email address you check often.",
      formatExample: "204-555-0142 · name@example.com",
      grounded: false,
    },

    // 2 · Guarantor
    {
      match: /\.Section2\.Surname_txr$/,
      label: "Guarantor: surname in passport",
      whatToEnter: "Your guarantor's surname, exactly as it appears in their Canadian passport.",
      whereToFind: "Guarantor's Canadian passport.",
    },
    { match: /\.Section2\.GivenNames_txt$/, label: "Guarantor: given name(s)" },
    {
      match: /\.Section2\.DOB_txt$/,
      label: "Guarantor: date of birth",
      formatExample: "1975-09-30 (YYYY-MM-DD)",
    },
    {
      match: /\.Section2\.IssueNumber_txt$/,
      label: "Guarantor: Canadian passport number",
      whatToEnter: "Your guarantor must write their own passport number.",
      whereToFind: "Guarantor's Canadian passport (the page with their photo).",
      formatExample: "AB123456",
    },
    {
      match: /\.Section2\.IssueYear_txt$/,
      label: "Guarantor: passport date of issue",
      whatToEnter: "Your guarantor must write the date their passport was issued.",
      formatExample: "2021-06-01 (YYYY-MM-DD)",
    },
    {
      match: /\.Section2\.ExpiryYear_txt$/,
      label: "Guarantor: passport date of expiry",
      whatToEnter: "Your guarantor must write the date their passport expires.",
      formatExample: "2031-06-01 (YYYY-MM-DD)",
    },
    {
      match: /\.Section2\.Reference1\./,
      labelPrefix: "Guarantor",
      keywords: ["guarantor", "address", "phone", "relationship"],
      whatToEnter: "The guarantor's own address, phone numbers and how they know you (for example friend, colleague, neighbour).",
    },
    {
      match: /\.Section2\./,
      section: "2 · Guarantor declaration",
      keywords: ["guarantor", "vouch", "confirm", "identity", "sign"],
      meaning:
        "Your guarantor confirms who you are. You or your guarantor can fill in this section, but the 4 bold fields (passport details) must be completed by the guarantor.",
      whatToEnter:
        "Enter your guarantor's details from their Canadian passport. They also sign this section, 1 of your photos, and copies of your ID.",
      keyPoints: GUARANTOR_POINTS,
      commonMistakes: [
        "Using a guarantor whose passport expired more than 1 year ago",
        "Filling in the bold passport fields yourself instead of your guarantor",
        "Forgetting the guarantor's signature on a photo",
      ],
      sourceIds: ["passport-required-docs"],
      grounded: true,
    },

    // 3 · Previous travel document
    {
      match: /\.PreviousPassportInfo\.PreviousPassport$/,
      label: "Have you had a Canadian travel document?",
      optionLabels: { "1": "Yes", "0": "No" },
      whatToEnter: "Choose Yes if you've ever had a Canadian passport, certificate of identity or refugee travel document, in any name.",
    },
    {
      match: /\.PreviousPassportInfo\.PassportNumber$/,
      label: "Previous travel document number",
      keywords: ["old", "previous", "current", "existing", "expired", "passport", "number"],
      whatToEnter: "Enter the number of your most recent Canadian passport or travel document.",
      whereToFind: "Your previous passport, on the page with your photo.",
      formatExample: "AB123456",
    },
    {
      match: /\.PreviousPassportInfo\.DateofIssue$/,
      label: "Previous travel document date of issue",
      formatExample: "2016-03-22 (YYYY-MM-DD)",
    },
    {
      match: /\.PreviousPassport\.List\.S0\.option$/,
      label: "Return or destroy previous passport",
      optionLabels: { "1": "Yes, return it to me", "2": "No, securely destroy it" },
      whatToEnter:
        "Choose whether you want your previous passport returned to you or securely destroyed. If you choose neither, it will be destroyed.",
    },
    {
      match: /\.PreviousPassport\./,
      section: "3 · Previous travel document",
      keywords: ["old", "previous", "passport", "travel", "document"],
      meaning: "Information about any Canadian travel document issued to you before, in your current name or any other name.",
      whatToEnter: "If you've had one, give its number and date of issue.",
      commonMistakes: [
        "Not including a passport that hasn't expired. It must be sent with your application.",
        "Not filing form PPTC 203 if your previous passport was lost, stolen or damaged",
      ],
      sourceIds: ["passports", "passport-renew"],
      grounded: true,
    },

    // 4 · Proof of citizenship
    {
      match: /\.section4\.ProofOfCit$/,
      label: "Born in Canada: document type",
      optionLabels: { "0": "Birth certificate (original only)", "1": "Certificate of Canadian citizenship" },
    },
    {
      match: /\.Section4B\.C1_Choice$/,
      label: "Born outside Canada: document type",
      optionLabels: {
        "1": "Certificate of Canadian citizenship",
        "2": "Certificate of naturalization",
        "3": "Certificate of registration of birth abroad",
        "4": "Certificate of retention of citizenship",
      },
    },
    { match: /\.CdnCit\./, labelPrefix: "Born in Canada" },
    { match: /\.CdnCertNumandDate\./, labelPrefix: "Born outside Canada" },
    {
      match: /\.ProofOfCanadianCitizenship\./,
      section: "4 · Proof of Canadian citizenship",
      keywords: ["citizenship", "birth", "certificate", "proof", "registration"],
      meaning: "Details from the document that proves you're a Canadian citizen.",
      whatToEnter:
        "Complete part A if you were born in Canada, or part B if you were born outside Canada. Copy the number and date exactly from your document.",
      whereToFind: "The registration or certificate number and date of issue are printed on your certificate.",
      keyPoints: {
        title: "Accepted documents",
        items: [
          "Born in Canada: provincial or territorial birth certificate (original only), or a citizenship certificate",
          "Born outside Canada: citizenship certificate, certificate of naturalization, registration of birth abroad, or certificate of retention",
          "Citizenship certificates issued before February 1, 2012 must be originals",
        ],
      },
      commonMistakes: [
        "Sending a photocopy of a birth certificate. The original is required.",
        "Completing both part A and part B",
      ],
      sourceIds: ["passport-citizenship-proof"],
      grounded: true,
    },

    // 5 · Supporting identity document
    { match: /\.DocType1\./, labelPrefix: "ID document 1" },
    { match: /\.DocType2\./, labelPrefix: "ID document 2" },
    { match: /\.ExpiryYear_txt$/, formatExample: "2029-11-30 (YYYY-MM-DD)" },
    {
      match: /\.DocstoSuportID\./,
      section: "5 · Document to support your identity",
      keywords: ["id", "identity", "identification", "driver", "licence", "health", "card"],
      meaning: "A government-issued ID that supports your identity.",
      whatToEnter:
        "Enter the type of document, its number, expiry date and your name exactly as it appears on it.",
      keyPoints: {
        title: "Accepted ID (examples)",
        items: [
          "Provincial or territorial driver's licence or health card",
          "Canadian passport, foreign passport or Certificate of Indian Status",
          "Federal, provincial or territorial government ID or employee ID",
          "Your SIN card is NOT accepted",
        ],
      },
      commonMistakes: [
        "Sending photocopies without both sides",
        "Photocopies not signed and dated by your guarantor",
      ],
      sourceIds: ["passport-id-docs"],
      grounded: true,
    },

    // 6 · Period of validity
    {
      match: /\.PeriodOfValidity\./,
      label: "Period of validity",
      optionLabels: { "5": "5-year", "10": "10-year" },
      section: "6 · Period of validity",
      keywords: ["validity", "valid", "years", "5", "10", "length"],
      meaning: "How long you want your passport to be valid.",
      whatToEnter: "Choose a 5-year or 10-year passport. The fees are different.",
      commonMistakes: ["Not checking the fee for the option you chose"],
      sourceIds: ["passport-fees"],
      grounded: true,
    },

    // 7 · Additional personal information
    {
      match: /\.SameAddress$/,
      label: "Address in the last 2 years: same or different?",
      optionLabels: { "1": "Same as current home address", "0": "Different (complete below)" },
    },
    {
      match: /\.SectionA\./,
      section: "7A · Addresses in the last 2 years",
      keywords: ["previous", "past", "address", "moved", "years"],
      meaning: "Every address you lived at during the last 2 years.",
      whatToEnter:
        "Choose Same as current home address, or list each previous address with from and to dates.",
      formatExample: "From 2024-03 To 2025-08 (YYYY-MM)",
      commonMistakes: ["Leaving gaps between date ranges", "Not using form PPTC 056 if you run out of space"],
      sourceIds: ["passport-get-form"],
      grounded: true,
    },
    {
      match: /\.SectionB\./,
      section: "7B · Occupation in the last 2 years",
      keywords: ["job", "work", "employer", "school", "occupation", "employment"],
      meaning: "What you did during the last 2 years, such as work, school or other activities.",
      whatToEnter:
        "Check all boxes that apply, then list each employer or school with its address, phone number and dates. Write HOMEMAKER or RETIRED if that applies.",
      formatExample: "2023-01 to present",
      commonMistakes: ["Leaving gaps in the 2-year period", "Not using form PPTC 056 if you need more space"],
      sourceIds: ["passport-get-form"],
      grounded: true,
    },

    // 8 · References
    { match: /\.References\.Reference1\./, labelPrefix: "Reference 1" },
    { match: /\.References\.Reference2\./, labelPrefix: "Reference 2" },
    {
      match: /\.References\./,
      section: "8 · References",
      keywords: ["reference", "references", "friend", "know"],
      meaning: "2 people who can confirm your identity if the Passport Program contacts them.",
      whatToEnter: "Give each reference's full name, relationship to you, address, phone numbers, email address and how many years they've known you.",
      keyPoints: REFERENCE_POINTS,
      commonMistakes: [
        "Listing a relative or your guarantor",
        "Listing someone who'll be travelling or hard to reach",
      ],
      sourceIds: ["passport-required-docs"],
      grounded: true,
    },

    // 9 · Emergency contact
    {
      match: /\.EmergencyContact\./,
      labelPrefix: "Emergency contact",
      section: "9 · Emergency contact (mandatory)",
      keywords: ["emergency", "contact", "family"],
      meaning: "Someone to contact if you need emergency assistance while you're outside Canada.",
      whatToEnter: "Give their name, relationship to you, phone numbers, email address and home address. This section is mandatory.",
      commonMistakes: ["Skipping this section. It's mandatory."],
      grounded: true,
    },

    // Payment
    {
      match: /\.CreditCardInformation\.Type$/,
      label: "Credit card type",
      optionLabels: { VISA: "Visa", MC: "Mastercard", AMEX: "American Express" },
    },
    {
      match: /\.CreditCardInformation\./,
      section: "Payment by credit card",
      keywords: ["pay", "payment", "credit", "card", "fee"],
      meaning: "Credit card details if you want to pay the fees by card.",
      whatToEnter: "Complete this only if you're paying by credit card. Check the fee list for the amount.",
      commonMistakes: ["Entering an amount that doesn't match the current fee list"],
      sourceIds: ["passport-fees", "passport-submit"],
      grounded: true,
    },

    // Section labels for fields not covered above
    { match: /\.Page1\.PersonalInformation\./, section: "1 · Personal information" },
  ],
};

// Some PDF tooltips in 7A/7B are wrong (e.g. row 4 says "Third"), so generate labels.
const OCCUPATION_PARTS: Record<string, string> = {
  EmployerSchool: "employer, school or other",
  Address: "address",
  Phone: "telephone",
  Nature: "field of employment or studies",
  DateFrom: "from date",
  DateTo: "to date",
};
const ADDRESS_DATE_PARTS: Record<string, string> = {
  FromYear: "from year",
  FromMonth: "from month",
  ToYear: "to year",
  ToMonth: "to month",
};
PPTC_153.rules.unshift(
  ...[1, 2, 3, 4].flatMap((n) =>
    Object.entries(OCCUPATION_PARTS).map(([key, text]) => ({
      match: new RegExp(`\\.Occupation_${n}\\.${key}$`),
      label: `Occupation ${n}: ${text}`,
      ...(key.startsWith("Date") ? { formatExample: "2024-09 (YYYY-MM), or PRESENT" } : {}),
    })),
  ),
  ...[1, 2].flatMap((n) =>
    Object.entries(ADDRESS_DATE_PARTS).map(([key, text]) => ({
      match: new RegExp(`\\.PrevAddr${n}\\.ToFromDate\\.${key}$`),
      label: `Previous address ${n}: ${text}`,
      formatExample: key.endsWith("Year") ? "2024" : "03",
    })),
  ),
  { match: /\.PrevAddr1\./, labelPrefix: "Previous address 1" },
  { match: /\.PrevAddr2\./, labelPrefix: "Previous address 2" },
);

export const KNOWN_FORMS: KnownForm[] = [PPTC_153];

export function findKnownForm(formNumber?: string): KnownForm | undefined {
  return formNumber ? KNOWN_FORMS.find((f) => f.formNumber === formNumber) : undefined;
}

const GENERIC_FORM_NUMBER =
  /\b(PPTC|IMM|ISP|RC|NAS|EMP|INS|CIT|ESDC|SC|GST|TD1?|CPP)[\s-]?(\d{1,5}[A-Z]?)\b/;

export function detectFormNumber(pageText: string, fieldNames: string[]): string | undefined {
  for (const form of KNOWN_FORMS) {
    if (form.detect.test(pageText) || fieldNames.some((n) => form.detect.test(n))) {
      return form.formNumber;
    }
  }
  const registered = publicFormsInText(pageText);
  if (registered.length === 1) return PUBLIC_FORMS[registered[0]].formNumber;
  const m = pageText.match(GENERIC_FORM_NUMBER);
  return m ? `${m[1]} ${m[2]}` : undefined;
}

export type ResolvedRule = Omit<FieldRule, "match">;

export function resolveRule(form: KnownForm | undefined, path: string): ResolvedRule | undefined {
  if (!form) return undefined;
  const matches = form.rules.filter((r) => r.match.test(path));
  if (matches.length === 0) return undefined;
  const merged: ResolvedRule = {};
  for (const rule of matches) {
    for (const [key, value] of Object.entries(rule) as [keyof FieldRule, unknown][]) {
      if (key === "match" || value === undefined) continue;
      if ((merged as Record<string, unknown>)[key] === undefined) {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }
  return merged;
}
