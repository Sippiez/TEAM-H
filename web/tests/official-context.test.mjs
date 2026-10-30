import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    URL,
    require(name) {
      assert.ok(Object.hasOwn(imports, name), name);
      return imports[name];
    },
  });
  return exports;
}

const hosts = load("../src/lib/official/hosts.ts", {});
const catalog = load("../src/lib/official/catalog.ts", { "./hosts": hosts });
const { resolveLookupContext } = load("../src/lib/official/context.ts", {
  "./hosts": hosts,
  "./catalog": catalog,
});
const forms = load("../src/lib/catalog/forms.ts", {
  "@/lib/official/catalog": catalog,
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test("uncatalogued public form identities bypass service planning and survive follow-ups", () => {
  const first = resolveLookupContext({
    message: "Where do I download this form?",
    formNumber: "CIT 0001",
    formTitle: "Application for citizenship certificate for adults and minors",
    language: "en",
    lookupContext: { serviceId: "passport", jurisdiction: "federal" },
  });
  assert.equal(first.reason, "none");
  assert.equal(first.selection.serviceId, undefined);
  assert.equal(first.selection.publicForm.number, "CIT 0001");
  assert.equal(first.selection.publicForm.title, "Application for citizenship certificate for adults and minors");
  const next = resolveLookupContext({ message: "What about the fees?", lookupContext: first.context, language: "en" });
  assert.equal(next.selection.publicForm.number, "CIT 0001");
  assert.equal(next.selection.facetId, "fees");
  const different = resolveLookupContext({
    message: "How do I get a health card in Ontario?", lookupContext: first.context, language: "en",
  });
  assert.equal(different.selection.serviceId, "health_card");
  assert.equal(different.selection.publicForm, undefined);
});

test("public-form discovery validates bounds and keeps private extra properties out of queries", () => {
  const selection = catalog.validateLookupSelection({
    publicForm: { title: "Application for accessibility assistance", number: "ABC 123" },
    facetId: "documents", language: "en",
  });
  assert.ok(selection);
  assert.match(catalog.buildCanonicalQuery(selection), /ABC 123/);
  assert.match(catalog.buildCanonicalQuery(selection), /Application for accessibility assistance/);
  for (const publicForm of [
    {}, { title: "x".repeat(201) }, { title: "https://evil.test/info" },
    { number: "PRIVATE FILENAME.pdf" }, { number: "ABC 123", query: "PRIVATE-CANARY" },
  ]) {
    assert.equal(catalog.validateLookupSelection({ publicForm, facetId: "documents", language: "en" }), null);
  }
});

test("public-form references match formatted numbers without admitting other variants or years", () => {
  for (const number of ["CIT0001", "CIT 0001", "CIT-0001"]) {
    assert.ok(catalog.publicFormMatchesText({ number }, "Download CIT 0001 here."));
    assert.equal(catalog.publicFormMatchesText({ number }, "Download CIT 0001A here."), false);
    assert.equal(catalog.publicFormMatchesText({ number }, "Download CIT 00010 here."), false);
  }
  const identity = { title: "Application for accessibility assistance 2026-27" };
  assert.ok(catalog.publicFormMatchesText(identity, "Accessibility assistance application 2026-27"));
  assert.equal(catalog.publicFormMatchesText(identity, "Accessibility assistance application 2026-28"), false);
});

test("IRCC directory candidates preserve language, number variants and jurisdiction restrictions", () => {
  for (const language of ["en", "fr"]) {
    const selection = { publicForm: { number: "IMM 0503" }, facetId: "documents", language };
    const pages = Array.from(catalog.publicFormDirectoryPages(selection));
    assert.equal(pages.length, 1);
    assert.ok(pages[0].startsWith(`https://www.canada.ca/${language}/`));
    assert.ok(pages[0].endsWith("/imm0503.html"));
    assert.deepEqual(Array.from(catalog.publicFormDirectoryPages({ ...selection, jurisdiction: "on" })), []);
  }
  assert.ok(catalog.publicFormDirectoryPages({
    publicForm: { number: "IMM 5257B" }, facetId: "documents", language: "en",
  })[0].endsWith("/imm5257b.html"));
});

test("a typed unregistered form resumes the question and jurisdiction replies retain only its scope", () => {
  const first = resolveLookupContext({
    message: "ABC123", history: [{ role: "user", text: "Where do I download this form?" }],
    lookupContext: { serviceId: "passport", jurisdiction: "federal", formId: "pptc153" },
    formNumber: "PPTC 153", language: "en",
  });
  assert.equal(first.selection.publicForm.number, "ABC123");
  assert.equal(first.selection.jurisdiction, undefined);
  assert.equal(first.selection.facetId, "documents");
  const next = resolveLookupContext({
    message: "Ontario", lookupContext: first.context,
    history: [{ role: "user", text: "What are passport fees?" }], language: "en",
  });
  assert.equal(next.selection.publicForm.number, "ABC123");
  assert.equal(next.selection.jurisdiction, "on");
  assert.equal(next.selection.serviceId, undefined);
  const titled = resolveLookupContext({
    message: "Application for accessibility assistance",
    history: [{ role: "user", text: "Where do I download this form?" }], language: "en",
  });
  assert.equal(titled.selection.publicForm.title, "Application for accessibility assistance");
  assert.equal(titled.selection.facetId, "documents");
});

test("the student-aid screenshot resolves from its public PDF title through provincial routing", () => {
  const formNumber = forms.detectFormNumber(
    "Full-Time Post-Secondary Student Saskatchewan Student Aid 2026-27 Student Service Centre",
    ["Text field 3", "Radio button 1"],
  );
  assert.equal(formNumber, "154091");
  const result = resolveLookupContext({
    message: "where do I download this form from",
    formNumber,
    lookupContext: { serviceId: "income_tax", jurisdiction: "federal" },
    language: "en",
  });
  assert.deepEqual(plain(result.selection), {
    serviceId: "student_aid", jurisdiction: "sk", facetId: "documents", language: "en", formId: "sk154091",
  });
});

test("student aid can be clarified without uploading a recognized PDF", () => {
  const first = resolveLookupContext({ message: "Where do I download a student aid application?", language: "en" });
  assert.equal(first.reason, "missing_jurisdiction");
  assert.equal(first.context.serviceId, "student_aid");
  const result = resolveLookupContext({
    message: "Saskatchewan", lookupContext: first.context, language: "en",
  });
  assert.equal(result.selection?.serviceId, "student_aid");
  assert.equal(result.selection?.jurisdiction, "sk");
  assert.equal(result.selection?.facetId, "documents");
});

test("student-aid identity excludes other years, part-time forms and private field names", () => {
  for (const text of [
    "Full-Time Post-Secondary Student Saskatchewan Student Aid 2025-26",
    "Part-Time Post-Secondary Student Saskatchewan Student Aid 2026-27",
    "Unknown application",
  ]) {
    assert.equal(forms.detectFormNumber(text, ["154091", "student aid", "PERSONAL-CANARY"]), undefined);
  }
  const provincial = resolveLookupContext({
    message: "Where do I download student aid forms in Alberta?",
    formNumber: "154091", language: "en",
  });
  assert.equal(provincial.selection?.jurisdiction, "ab");
  assert.equal(provincial.selection?.formId, undefined);
});

test("the screenshot download question resolves only a recognized public form ID", () => {
  const result = resolveLookupContext({
    message: "where do I download this form from?",
    formNumber: "ISP 1000",
    language: "en",
  });
  assert.deepEqual(plain(result.selection), {
    serviceId: "pension", jurisdiction: "federal", facetId: "documents", language: "en", formId: "isp1000",
  });
  assert.equal(result.reason, "none");
  assert.equal(catalog.publicFormForNumber("ISP-1000"), "isp1000");
  assert.equal(catalog.publicFormForNumber("ISP 1000 PERSONAL-CANARY"), undefined);
});

test("ISP 3550 download questions resolve the open OAS form without a service-selection loop", () => {
  const result = resolveLookupContext({
    message: "where do I download this from?",
    formNumber: "ISP 3550",
    language: "en",
  });
  assert.equal(result.selection?.formId, "isp3550");
  assert.equal(result.selection.serviceId, "old_age_security");
  assert.equal(result.selection.jurisdiction, "federal");
  assert.equal(result.selection.facetId, "documents");
  assert.equal(result.reason, "none");
});

test("ISP 3550 typed as a clarification resumes the earlier download question", () => {
  const result = resolveLookupContext({
    message: "ISP 3550",
    history: [
      { role: "user", text: "where do I download this from?" },
      { role: "assistant", text: "Choose the service." },
    ],
    lookupContext: { facetId: "documents" },
    language: "en",
  });
  assert.equal(result.selection?.formId, "isp3550");
  assert.equal(result.selection.serviceId, "old_age_security");
  assert.equal(result.selection.facetId, "documents");
  assert.equal(result.reason, "none");
});

test("all registered forms resolve formatted IDs and bilingual inline mentions without leaking message text", () => {
  for (const [formId, form] of Object.entries(catalog.PUBLIC_FORMS)) {
    for (const number of [form.formNumber, form.formNumber.replaceAll(" ", "-"), form.formNumber.replaceAll(" ", "").toLowerCase()]) {
      const result = resolveLookupContext({
        message: "where do I download this from?",
        formNumber: number,
        language: "en",
      });
      assert.deepEqual(plain(result.selection), {
        serviceId: form.serviceId, jurisdiction: form.jurisdiction,
        facetId: "documents", language: "en", formId,
      });
    }
    const inline = resolveLookupContext({
      message: `Où télécharger le formulaire ${form.formNumber} ? PERSONAL-CANARY`,
      language: "fr",
    });
    assert.equal(inline.selection.formId, formId);
    assert.equal(inline.selection.facetId, "documents");
    assert.doesNotMatch(catalog.buildCanonicalQuery(inline.selection), /PERSONAL-CANARY/);
  }
  for (const unknown of ["ISP 3550A", "ISP 35500", "XISP3550", "ISP 9999"]) {
    assert.equal(catalog.publicFormForNumber(unknown), undefined);
    assert.deepEqual(plain(catalog.publicFormsInText(unknown)), []);
  }
});

test("French download questions and canonical form keywords use no private metadata", () => {
  const result = resolveLookupContext({
    message: "Où télécharger ce formulaire ? PERSONAL-CANARY",
    formNumber: "PPTC 153",
    language: "fr",
  });
  assert.equal(result.selection.formId, "pptc153");
  const query = catalog.buildCanonicalQuery(result.selection);
  assert.match(query, /PPTC 153/);
  assert.doesNotMatch(query, /PERSONAL-CANARY|file|history/);
});

test("federal programs do not make users repeat their jurisdiction", () => {
  for (const [message, serviceId] of [
    ["How do I renew a passport?", "passport"],
    ["I lost my job. How do I apply?", "employment_insurance"],
    ["How do I get a Social Insurance Number?", "social_insurance"],
  ]) {
    const result = resolveLookupContext({ message, language: "en" });
    assert.equal(result.selection.serviceId, serviceId);
    assert.equal(result.selection.jurisdiction, "federal");
  }
});

test("clarification retains the question facet and asks only for the missing region", () => {
  const first = resolveLookupContext({ message: "How do I apply for a health card?", language: "en" });
  assert.equal(first.reason, "missing_jurisdiction");
  assert.equal(first.context.serviceId, "health_card");
  const next = resolveLookupContext({ message: "Ontario", lookupContext: first.context, language: "en" });
  assert.deepEqual(plain(next.selection), {
    serviceId: "health_card", jurisdiction: "on", facetId: "steps", language: "en",
  });
  const followup = resolveLookupContext({ message: "And what documents?", lookupContext: next.context, language: "en" });
  assert.equal(followup.selection.facetId, "documents");
  assert.equal(followup.selection.serviceId, "health_card");
  assert.equal(followup.selection.jurisdiction, "on");
});

test("new services and jurisdictions override old conversation or form routing", () => {
  const result = resolveLookupContext({
    message: "How do I get a health card in Alberta?",
    formNumber: "PPTC 153",
    lookupContext: { serviceId: "passport", jurisdiction: "federal", formId: "pptc153" },
    language: "en",
  });
  assert.equal(result.selection.serviceId, "health_card");
  assert.equal(result.selection.jurisdiction, "ab");
  assert.equal(result.selection.formId, undefined);
  const followup = resolveLookupContext({
    message: "And what documents?",
    formNumber: "PPTC 153",
    lookupContext: result.context,
    language: "en",
  });
  assert.equal(followup.selection.serviceId, "health_card");
  assert.equal(followup.selection.jurisdiction, "ab");
  assert.equal(followup.selection.formId, undefined);
  const openForm = resolveLookupContext({
    message: "Where do I download this form?",
    formNumber: "PPTC 153",
    lookupContext: followup.context,
    language: "en",
  });
  assert.equal(openForm.selection.formId, "pptc153");
});

test("unknown forms and assistant claims do not establish service or jurisdiction", () => {
  const result = resolveLookupContext({
    message: "Where do I download this form?",
    formNumber: "PRIVATE-CANARY",
    history: [{ role: "assistant", text: "This is the Ontario health card." }],
    language: "en",
  });
  assert.equal(result.selection, null);
  assert.equal(result.reason, "missing_service");
});

test("context and form IDs cannot inject queries, URLs or mismatched services", () => {
  assert.equal(catalog.validateLookupContext({ serviceId: "passport", query: "PERSONAL-CANARY" }), null);
  assert.equal(catalog.validateLookupContext({ jurisdiction: "https://evil.test" }), null);
  assert.equal(catalog.validateLookupSelection({
    serviceId: "health_card", jurisdiction: "on", facetId: "documents", language: "en", formId: "isp1000",
  }), null);
});

test("a confirmed choice resolves ambiguity instead of repeating the same question", () => {
  const question = {
    message: "How do I get a health card in Ontario or Alberta?",
    language: "en",
  };
  assert.equal(resolveLookupContext(question).reason, "ambiguous_selection");
  const resolved = resolveLookupContext({ ...question, lookupChoice: { jurisdiction: "ab" } });
  assert.equal(resolved.selection.jurisdiction, "ab");
  assert.equal(resolved.selection.serviceId, "health_card");
  const multiple = resolveLookupContext({
    message: "What are passport and income tax fees?",
    lookupChoice: { serviceId: "passport" },
    language: "en",
  });
  assert.equal(multiple.selection.serviceId, "passport");
});

test("French follow-ups retain only the scoped service identifiers", () => {
  const first = resolveLookupContext({ message: "Comment obtenir une carte santé en Ontario ?", language: "fr" });
  const next = resolveLookupContext({
    message: "Quels sont les frais ?",
    lookupContext: first.context,
    history: [{ role: "assistant", text: "PERSONAL-ASSISTANT-CANARY" }],
    language: "fr",
  });
  assert.equal(next.selection.serviceId, "health_card");
  assert.equal(next.selection.jurisdiction, "on");
  assert.equal(next.selection.facetId, "fees");
  assert.doesNotMatch(JSON.stringify(next), /PERSONAL-ASSISTANT-CANARY/);
});
