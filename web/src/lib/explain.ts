import { findKnownForm, resolveRule } from "@/lib/catalog/forms";
import { getResources } from "@/lib/catalog/resources";
import type { FieldExplanation, FieldSummary } from "@/lib/types";

interface Heuristic {
  test: (text: string, field: FieldSummary) => boolean;
  meaning: (label: string) => string;
  whatToEnter: string;
  formatExample?: string;
  commonMistakes: string[];
}

const HEURISTICS: Heuristic[] = [
  {
    test: (_, f) => f.type === "signature" || /\bsignature\b|\bsign\b/.test(_),
    meaning: () => "Your handwritten signature confirming the information is true.",
    whatToEnter: "Print the form and sign by hand inside the box, unless the instructions allow an electronic signature.",
    commonMistakes: ["Typing your name instead of signing", "Signing outside the border"],
  },
  {
    test: (t) => /\b(date|dob|birth|year|month|day|expiry|issue)\b/.test(t),
    meaning: (label) => `A date: ${label.toLowerCase()}.`,
    whatToEnter: "Use the date format printed on the form. Government of Canada forms usually use year-month-day.",
    formatExample: "2025-03-14 (YYYY-MM-DD)",
    commonMistakes: ["Using DD/MM/YYYY or MM/DD/YYYY", "Writing the month as a word when numbers are expected"],
  },
  {
    test: (t) => /\b(postal|zip|pc)\b/.test(t),
    meaning: () => "The postal code (Canada) or ZIP code (USA) for this address.",
    whatToEnter: "Enter the full code in capital letters.",
    formatExample: "K1A 0B1 or 90210",
    commonMistakes: ["Mixing up the letter O and the number 0"],
  },
  {
    test: (t) => /\b(e-?mail)\b/.test(t),
    meaning: () => "An email address where you can be contacted.",
    whatToEnter: "Enter an email address you check often.",
    formatExample: "name@example.com",
    commonMistakes: ["Typos in the domain name"],
  },
  {
    test: (t) => /\b(phone|telephone|tel|cell)\b/.test(t),
    meaning: () => "A telephone number where you can be reached.",
    whatToEnter: "Include the area code. Add the country code if the number is outside North America.",
    formatExample: "613-555-0123",
    commonMistakes: ["Leaving out the area code"],
  },
  {
    test: (t) => /\b(prov|province|territory|state)\b/.test(t),
    meaning: () => "The province, territory or state for this address.",
    whatToEnter: "Choose or write the standard abbreviation.",
    formatExample: "ON, QC, BC",
    commonMistakes: [],
  },
  {
    test: (t) => /\b(surname|given|name)\b/.test(t),
    meaning: (label) => `${label}.`,
    whatToEnter: "Write the name exactly as it appears on your official documents.",
    commonMistakes: ["Using a nickname or an abbreviation"],
  },
  {
    test: (t) => /\b(address|street|city|apt|apartment|number)\b/.test(t),
    meaning: (label) => `Part of an address: ${label.toLowerCase()}.`,
    whatToEnter: "Write it as it would appear on mail you receive.",
    commonMistakes: [],
  },
];

function fallback(field: FieldSummary): Omit<FieldExplanation, "fieldId" | "sources" | "grounded"> {
  if (field.context && field.context.status !== "resolved") {
    return {
      meaning: "We could not identify this field's question reliably.",
      whatToEnter: field.context.status === "needs-ocr"
        ? "This page has no readable PDF text. Use a text-based copy or check the original form; OCR is needed before its question can be identified."
        : "Check the highlighted field and surrounding instructions on the original form. Its question or option labels could not be matched reliably.",
      commonMistakes: [],
    };
  }
  if (field.context?.question) {
    return {
      meaning: field.context.question,
      whatToEnter: field.context.instructions.length
        ? field.context.instructions.join(" ")
        : field.type === "radio" || field.type === "choice"
          ? `Choose one of the printed options${field.options?.length ? `: ${field.options.join(", ")}` : ""}.`
          : "Use the instructions printed beside this field. No additional entry requirements were identified.",
      commonMistakes: [],
    };
  }
  const text = `${field.label} ${field.path}`.toLowerCase().replace(/([a-z])([A-Z])/g, "$1 $2");
  if (field.type === "checkbox") {
    return {
      meaning: `A checkbox: ${field.label}.`,
      whatToEnter: "Check the box only if this statement applies to you.",
      commonMistakes: ["Checking boxes that don't apply"],
    };
  }
  if (field.type === "radio" || field.type === "choice") {
    const opts = field.options?.length ? ` Options: ${field.options.join(", ")}.` : "";
    return {
      meaning: `${field.label}.`,
      whatToEnter: `Choose one option.${opts}`,
      commonMistakes: ["Choosing more than one option"],
    };
  }
  const h = HEURISTICS.find((x) => x.test(text, field));
  if (h) {
    return {
      meaning: h.meaning(field.label),
      whatToEnter: h.whatToEnter,
      formatExample: h.formatExample,
      commonMistakes: h.commonMistakes,
    };
  }
  return {
    meaning: `This field asks for: ${field.label}.`,
    whatToEnter: "Read the instructions for this section of the form, then answer accurately and completely.",
    commonMistakes: ["Leaving it blank when it applies to you"],
  };
}

/** Explain one field using curated rules when available, otherwise generic heuristics. */
export function explainField(field: FieldSummary, formNumber?: string): FieldExplanation {
  const form = findKnownForm(formNumber);
  const rule = resolveRule(form, field.path);
  const base = fallback(field);
  const sources = getResources(rule?.sourceIds ?? form?.resourceIds.slice(0, 1) ?? []);
  return {
    fieldId: field.id,
    meaning: rule?.meaning ?? base.meaning,
    whatToEnter: rule?.whatToEnter ?? base.whatToEnter,
    formatExample: rule?.formatExample ?? base.formatExample,
    whereToFind: rule?.whereToFind,
    keyPoints: rule?.keyPoints,
    commonMistakes: rule?.commonMistakes ?? base.commonMistakes,
    sources,
    grounded: Boolean(rule?.grounded && rule.meaning),
  };
}
