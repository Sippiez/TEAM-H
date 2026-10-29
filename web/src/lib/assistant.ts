import { findKnownForm, resolveRule } from "@/lib/catalog/forms";
import { getResources, RESOURCES } from "@/lib/catalog/resources";
import { explainField } from "@/lib/explain";
import { tokenize } from "@/lib/text";
import type {
  AssistantReply,
  ChatRequest,
  FieldSummary,
  FormContext,
  FormOverview,
  Resource,
} from "@/lib/types";

// "should I …" is advice-seeking unless it's about how to fill something in ("should I enter…").
const ADVICE =
  /\b(should i(?! (put|write|enter|fill|type|use|include|list|sign|attach|print|leave|check|tick)\b)|am i eligible|do i qualify|will i (get|be approved)|legal advice|lawyer|which (one|option) is better|is it better)\b/i;
const OVERVIEW = /\b(overview|summar|what is this form|what's this form|about this form|explain (this|the) form)\b/i;
const FIND_FIELD = /\b(where (do|should|can|would) i|which (field|box|section)|where does|where is the|where to)\b/i;
const THIS_FIELD = /\b(this|that|the selected) (field|box|question|one|section)\b|\bwhat (do|should) i (put|write|enter) (here|in it)\b/i;

export function buildOverview(form?: FormContext): FormOverview {
  const known = findKnownForm(form?.formNumber);
  const pageCount = form?.pageCount ?? 0;
  const fieldCount = form?.fields.length ?? 0;
  if (known) {
    return {
      formNumber: known.formNumber,
      title: known.title,
      department: known.department,
      summary: known.summary,
      whoFiles: known.whoFiles,
      youNeed: known.youNeed,
      howToSubmit: known.howToSubmit,
      fieldCount,
      pageCount,
      resources: getResources(known.resourceIds),
      curated: true,
    };
  }
  const sections = [...new Set(form?.fields.map((f) => f.section) ?? [])];
  const related = searchResources(form?.formNumber ?? "", 2);
  return {
    formNumber: form?.formNumber,
    title: form?.formNumber ? `Form ${form.formNumber}` : (form?.fileName ?? "Uploaded form"),
    summary: form?.formNumber
      ? `I don't have curated guidance for ${form.formNumber} yet, but I found its fillable fields. Click any field for a general explanation, and check the official instructions for this form.`
      : "I couldn't identify this form number. Click any highlighted field for a general explanation.",
    youNeed: sections.slice(0, 8).map((s) => `Section: ${s}`),
    fieldCount,
    pageCount,
    resources: related.length ? related : getResources(["cra-forms", "contact"]),
    curated: false,
  };
}

export function searchResources(query: string, limit = 3): Resource[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return RESOURCES.map((r) => {
    const title = new Set(tokenize(r.title));
    const tags = new Set(r.tags.flatMap((t) => tokenize(t)));
    const desc = new Set(tokenize(r.description));
    const score = tokens.reduce(
      (s, t) => s + (title.has(t) ? 3 : 0) + (tags.has(t) ? 2 : 0) + (desc.has(t) ? 1 : 0),
      0,
    );
    return { r, score };
  })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.r);
}

function rankFields(query: string, form: FormContext): { field: FieldSummary; score: number }[] {
  const tokens = new Set(tokenize(query));
  const known = findKnownForm(form.formNumber);
  return form.fields
    .map((field) => {
      const rule = resolveRule(known, field.path);
      const label = new Set(tokenize(field.label));
      const keywords = new Set((rule?.keywords ?? []).flatMap((k) => tokenize(k)));
      const section = new Set(tokenize(field.section));
      let score = 0;
      for (const t of tokens) {
        if (label.has(t)) score += 3;
        if (keywords.has(t)) score += 2;
        if (section.has(t)) score += 1;
      }
      return { field, score };
    })
    .filter((x) => x.score >= 3)
    .sort((a, b) => b.score - a.score || a.field.page - b.field.page);
}

function explainSelected(field: FieldSummary, form?: FormContext): AssistantReply {
  const e = explainField(field, form?.formNumber);
  const lines = [
    `**${field.label}** (page ${field.page})`,
    e.meaning,
    `**What to enter:** ${e.whatToEnter}`,
  ];
  if (e.formatExample) lines.push(`**Example:** ${e.formatExample}`);
  if (e.keyPoints) lines.push(`**${e.keyPoints.title}:**`, ...e.keyPoints.items.map((i) => `- ${i}`));
  if (e.commonMistakes.length) {
    lines.push("**Avoid:**", ...e.commonMistakes.slice(0, 2).map((m) => `- ${m}`));
  }
  return {
    text: lines.join("\n"),
    resources: e.sources.slice(0, 2),
    fieldRefs: [fieldReference(field, form)],
  };
}

function fieldReference(field: FieldSummary, form?: FormContext) {
  return {
    id: field.id,
    label: field.label,
    page: field.page,
    document: form?.formNumber ?? form?.fileName ?? "Current document",
  };
}

const SUGGESTIONS_WITH_FORM =
  "Try asking:\n- **Give me an overview of this form**\n- **Where do I put my date of birth?**\n- **Who can be my guarantor?**\n- **How much does a passport cost?**";
const SUGGESTIONS_NO_FORM =
  "Try asking about a service, for example:\n- **How do I renew my passport?**\n- **I lost my job, what can I apply for?**\n- **Where do I sign in to my CRA account?**";

/** Rule-based demo assistant. Swap for an LLM with tool calls behind /api/chat. */
export function reply(req: ChatRequest): AssistantReply {
  const message = (req.message ?? "").trim();
  const form = req.form;
  const selected = form?.fields.find((f) => f.id === req.selectedFieldId);

  if (req.intent === "overview" || (form && OVERVIEW.test(message))) {
    const overview = buildOverview(form);
    return {
      text: overview.curated
        ? `This is **${overview.formNumber} – ${overview.title}**. Here's what it's for and what you'll need. Click any highlighted field on the form to see what it means.`
        : overview.summary,
      overview,
    };
  }

  if (!message) {
    return { text: form ? SUGGESTIONS_WITH_FORM : SUGGESTIONS_NO_FORM };
  }

  if (ADVICE.test(message)) {
    const resources = searchResources(message);
    return {
      text:
        "I can explain what a form asks for, but I can't decide eligibility or give legal advice for your situation. The official pages below set out the rules, and the department can confirm your case.",
      resources: resources.length ? resources : getResources(["contact"]),
    };
  }

  if (selected && THIS_FIELD.test(message)) return explainSelected(selected, form);

  const fieldMatches = form ? rankFields(message, form) : [];
  const resources = searchResources(message);
  const wantsField = FIND_FIELD.test(message);

  if (fieldMatches.length && (wantsField || fieldMatches[0].score >= (resources.length ? 6 : 3))) {
    const [best, ...rest] = fieldMatches;
    const others = rest.slice(0, 3).map((m) => m.field);
    const e = explainField(best.field, form?.formNumber);
    const text = [
      `That goes in **${best.field.label}** on page ${best.field.page} (${best.field.section}). Select its reference below to open it on the form.`,
      e.whatToEnter,
      e.keyPoints ? `**${e.keyPoints.title}:**\n${e.keyPoints.items.map((i) => `- ${i}`).join("\n")}` : "",
      others.length ? "Related fields:" : "",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      text,
      fieldRefs: [best.field, ...others].map((f) => fieldReference(f, form)),
      resources: e.sources.slice(0, 1),
    };
  }

  if (resources.length) {
    return {
      text: "Here are the official Government of Canada pages that cover this:",
      resources,
    };
  }

  if (selected) return explainSelected(selected, form);

  return {
    text: `I couldn't find a match for that in the form or my list of Canada.ca services. ${form ? SUGGESTIONS_WITH_FORM : SUGGESTIONS_NO_FORM}`,
    resources: getResources(["benefits", "contact"]),
  };
}
