import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const modules = new Map();
const tasks = [];
let fixture;
let chatCall;
let documentOptions;
function loadModule(path) {
  if (modules.has(path)) return modules.get(path);
  const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  modules.set(path, exports);
  vm.runInNewContext(outputText, {
    exports,
    URL,
    process: { env: { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-only" } },
    require(name) {
      if (name === "server-only") return {};
      if (name === "@google/genai") return {
        ThinkingLevel: { LOW: "LOW" },
        GoogleGenAI: class {
          models = {
            generateContentStream: async (call) => {
              chatCall = call;
              return (async function* () { yield { text: "Field explanation." }; })();
            },
          };
        },
      };
      if (name === "@/lib/official/lookup") return {
        lookupOfficialWithFallback: () => assert.fail("Field-context chat must not perform an official lookup"),
      };
      if (name === "@/lib/official/grounding") return {
        lookupGoogleGrounding: () => assert.fail("Field-context chat must not perform a web search"),
      };
      if (name === "@/lib/pdf/pdfjs") return {
        getPdfjs: async () => ({
          getDocument(options) {
            documentOptions = options;
            if (fixture) return { promise: Promise.resolve(fixture) };
            const task = pdfjs.getDocument({
              ...options,
              standardFontDataUrl: fileURLToPath(new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url)),
            });
            tasks.push(task);
            return task;
          },
        }),
      };
      if (name.startsWith(".")) return loadModule(posix.join(posix.dirname(path), name));
      assert.ok(name.startsWith("@/"), `Unexpected import: ${name}`);
      return loadModule(name.slice(2));
    },
  }, { filename: path });
  return exports;
}

async function explainInChat(input) {
  chatCall = undefined;
  const stream = await loadModule("lib/ai/gemini").streamGeminiChat(input);
  for await (const event of stream) assert.equal(event.type, "delta");
  assert.ok(chatCall);
}

test("CIT 0001 public identity comes from printed PDF text rather than its filename", async () => {
  const { loadForm } = loadModule("lib/pdf/extract");
  const data = readFileSync(new URL("../../test-forms/cit0001e.pdf", import.meta.url));
  const form = await loadForm(Uint8Array.from(data).buffer, "PRIVATE-FILENAME.pdf");
  assert.equal(form.formNumber, "CIT 0001");
  assert.match(form.formTitle, /APPLICATION FOR CITIZENSHIP CERTIFICATE/i);
  assert.doesNotMatch(form.formTitle, /PRIVATE-FILENAME/);
});

test("printed field context preserves explicit PDF required flags without inventing them", () => {
  const { enrichFields } = loadModule("lib/fields");
  const context = {
    status: "resolved", source: "layout",
    question: "Printed question", instructions: [],
  };
  for (const required of [true, false, undefined]) {
    const [field] = enrichFields([{
      name: "Text Field 1", path: "Text Field 1", page: 1,
      rects: [[10, 10, 80, 20]], type: "text", required, context,
    }]);
    assert.equal(field.required, required);
    assert.equal(field.label, context.question);
    assert.equal(field.context, context);
  }
});

test("ISP-1000 Yes/No fields retain their printed questions and choices", async () => {
  const { loadForm } = loadModule("lib/pdf/extract");
  const data = readFileSync(new URL("../../test-forms/ISP-1000.pdf", import.meta.url));
  const form = await loadForm(Uint8Array.from(data).buffer, "ISP-1000.pdf");
  try {
    const field = form.fields.find((f) => f.page === 5 && /rb_YesNo2$/i.test(f.path));
    assert.ok(field, "The reported rb_yes_no2 radio group must exist");
    assert.match(field.label, /Canada Child Benefit/i);
    assert.match(field.label, /receive/i);
    assert.deepEqual(Array.from(field.options), ["Yes", "No"]);
    const { explainField } = loadModule("lib/explain");
    assert.match(explainField(field, form.formNumber).meaning, /Canada Child Benefit/i);
    const allowance = form.fields.find((f) => f.page === 5 && /rb_YesNo$/i.test(f.path));
    assert.match(allowance.label, /Family Allowance\?/);
    assert.doesNotMatch(field.label, /Family Allowance/);
    const fields = form.fields.map(loadModule("lib/field-context").summarizeField);
    await explainInChat({
      message: "What does this field mean?", language: "en",
      selectedFieldId: field.id,
      form: { fields, pageCount: form.pageCount, fileName: form.fileName },
    });
    const context = JSON.parse(chatCall.contents.split("FORM_CONTEXT:\n")[1].split("\n\nRECENT_CONVERSATION:")[0]);
    assert.equal(context.selectedField.label, field.label);
    assert.deepEqual(context.selectedField.options, ["Yes", "No"]);
    assert.equal(context.selectedField.context.question, field.context.question);
    assert.match(field.context.question, /Canada Child Benefit/);
  } finally {
    await Promise.all(tasks.splice(0).map((task) => task.destroy()));
  }
});

const text = (str, x, y, width) => ({
  str, transform: [10, 0, 0, 10, x, y], width, height: 10,
});
const radioWidgets = () => [477, 526.5].map((x, i) => ({
  subtype: "Widget", fieldName: "rb_YesNo2", fieldType: "Btn",
  radioButton: true, buttonValue: String(i + 1), rect: [x, 111.1, x + 10, 121.1],
}));
const questionText = () => [
  text("Did you or your current/former spouse or common-law partner receive,", 55.8, 115.6, 311.8),
  text("or were either of you eligible for the Canada Child Benefit?", 55.8, 103.6, 259),
  text("Yes", 493.6, 113.2, 17.2),
  text("No", 542.4, 113.2, 12.8),
];

async function loadFixture(annotations, items) {
  fixture = {
    numPages: 1,
    getPage: async () => ({
      getAnnotations: async () => annotations,
      getTextContent: async () => ({ items }),
      cleanup() {},
    }),
  };
  try {
    return await loadModule("lib/pdf/extract").loadForm(new ArrayBuffer(0), "minimal.pdf");
  } finally {
    fixture = undefined;
  }
}

test("browser PDF loading uses bundled standard fonts instead of host system fonts", async () => {
  await loadFixture([], []);
  assert.equal(documentOptions.useSystemFonts, false);
  assert.equal(documentOptions.standardFontDataUrl, "/pdf-standard-fonts/");
});

test("public-form heading extraction excludes text inside widgets", async () => {
  const form = await loadFixture([{
    subtype: "Widget", fieldName: "Field1", fieldType: "Tx", rect: [20, 480, 500, 530],
  }], [
    { ...text("APPLICATION FOR PUBLIC HOUSING ASSISTANCE", 20, 700, 400), height: 14 },
    { ...text("APPLICATION FOR PRIVATE VALUE CIT 9999", 20, 500, 400), height: 30 },
  ]);
  assert.equal(form.formTitle, "APPLICATION FOR PUBLIC HOUSING ASSISTANCE");
  assert.equal(form.formNumber, undefined);
  assert.doesNotMatch(JSON.stringify({ title: form.formTitle, number: form.formNumber }), /PRIVATE|9999/);
});

test("student-aid SIN and birth date use their own printed labels", async () => {
  const data = readFileSync(new URL("../../test-forms/154091_Student_Aid_Application_2026-27.pdf", import.meta.url));
  const form = await loadModule("lib/pdf/extract").loadForm(Uint8Array.from(data).buffer, "student-aid.pdf");
  try {
    const sin = form.fields.find((field) => field.page === 1 && field.rawName === "Text Field 3");
    const birthDate = form.fields.find((field) => field.page === 1 && field.rawName === "Text Field 2");
    assert.ok(sin);
    assert.ok(birthDate);
    assert.match(sin.context.question, /^Social Insurance Number \(SIN\):?$/);
    assert.match(birthDate.context.question, /^Date of Birth \(dd\/mmm\/yyyy\):?$/);
    assert.doesNotMatch(birthDate.context.instructions.join(" "), /SIN|Employment and Social Development/);
    const summary = loadModule("lib/field-context").summarizeField(birthDate);
    assert.doesNotMatch(loadModule("lib/explain").explainField(summary).whatToEnter, /SIN|Social Insurance/i);
    await explainInChat({
      message: "What should I enter in this field?", language: "en", selectedFieldId: birthDate.id,
      form: { pageCount: form.pageCount, fields: form.fields.map(loadModule("lib/field-context").summarizeField) },
    });
    const context = JSON.parse(chatCall.contents.split("FORM_CONTEXT:\n")[1].split("\n\nRECENT_CONVERSATION:")[0]);
    assert.equal(context.selectedField.context.question, summary.context.question);
    assert.doesNotMatch(JSON.stringify(context.selectedField.context), /SIN|Social Insurance/);
    for (const [page, rawName, label] of [
      [1, "Text Field 4", "Legal Last Name:"],
      [1, "Text Field 5", "Legal First Name:"],
      [1, "Text Field 6", "Legal Middle Name:"],
      [2, "Text Field 7", "Street/Box No."],
      [2, "Text Field 8", "Apartment No."],
      [2, "Text Field 9", "City/Town"],
      [2, "Text Field 10", "Province/State"],
      [2, "Text Field 11", "Country (other than Canada)"],
      [2, "Text Field 12", "Postal Code/Zip Code"],
      [2, "Text Field 132", "Street/Box No."],
      [2, "Text Field 133", "Apartment No."],
      [2, "Text Field 134", "City/Town"],
    ]) {
      const field = form.fields.find((field) => field.page === page && field.rawName === rawName);
      assert.equal(field?.context.status, "resolved", rawName);
      assert.equal(field.label, label, rawName);
      assert.doesNotMatch(JSON.stringify(loadModule("lib/field-context").summarizeField(field)), /_{3}/);
    }
  } finally {
    await Promise.all(tasks.splice(0).map((task) => task.destroy()));
  }
});

test("answer-line underscores are not part of field labels or shared context", async () => {
  const form = await loadFixture([{
    subtype: "Widget", fieldName: "Text Field 4", fieldType: "Tx",
    rect: [116.32, 199.039, 578.04, 217.039],
  }], [
    text("Legal Last Name: _____________________________________________________________________________", 34.56, 200.8631, 544.884),
  ]);
  assert.equal(form.fields[0].context.status, "resolved");
  assert.match(form.fields[0].label, /^Legal Last Name:?$/);
  assert.doesNotMatch(form.fields[0].context.question, /_{3}/);
});

test("an answer line spanning a widget does not hide its own label", async () => {
  const form = await loadFixture([{
    subtype: "Widget", fieldName: "sin", fieldType: "Tx",
    rect: [189.648, 313.313, 306, 331.313],
  }], [
    text("Personal Information", 34.56, 337.8631, 139.3424),
    text("Social Insurance Number (SIN): ____________________", 34.56, 314.4631, 272.7804),
  ]);
  assert.equal(form.fields[0].context.question, "Social Insurance Number (SIN):");
});

test("below-line captions stay with their own address column", async () => {
  const form = await loadFixture([
    { subtype: "Widget", fieldName: "street", fieldType: "Tx", rect: [36, 615.917, 354.24, 630.08] },
    { subtype: "Widget", fieldName: "apartment", fieldType: "Tx", rect: [360, 615.917, 463.68, 630.08] },
    { subtype: "Widget", fieldName: "city", fieldType: "Tx", rect: [468.008, 616.48, 576, 630.643] },
  ], [
    text("Mailing Address", 36, 640.2, 97.1866),
    text("__________________________________________________________________________________________", 36, 616.8, 537.84),
    text("Street/Box No.", 36, 602.4, 71.7216),
    text("Apartment No.", 324, 602.4, 72.7812),
    text("City/Town", 432, 602.4, 49.1808),
  ]);
  assert.deepEqual(Array.from(form.fields, (field) => field.label), ["Street/Box No.", "Apartment No.", "City/Town"]);
});

test("a caption above the next input is not borrowed by the previous input", async () => {
  const form = await loadFixture([
    { subtype: "Widget", fieldName: "first", fieldType: "Tx", rect: [36, 615, 200, 630] },
    { subtype: "Widget", fieldName: "second", fieldType: "Tx", rect: [36, 580, 200, 595] },
  ], [text("Second field", 36, 602, 80)]);
  assert.equal(form.fields[0].context.status, "ambiguous");
  assert.equal(form.fields[1].context.question, "Second field");
});

test("a combined answer line spanning independent controls stays ambiguous", async () => {
  const form = await loadFixture([
    { subtype: "Widget", fieldName: "first", fieldType: "Tx", rect: [120, 400, 200, 418] },
    { subtype: "Widget", fieldName: "second", fieldType: "Tx", rect: [300, 400, 380, 418] },
  ], [text("Name: __________ Date: __________", 36, 405, 350)]);
  assert.ok(form.fields.every((field) => field.context.status === "ambiguous"));
  assert.ok(form.fields.every((field) => field.context.question === undefined));
});

test("separate input rows prevent adjacent unpunctuated labels from merging", async () => {
  const form = await loadFixture([
    { subtype: "Widget", fieldName: "first", fieldType: "Tx", rect: [180, 324, 300, 334] },
    { subtype: "Widget", fieldName: "second", fieldType: "Tx", rect: [180, 312, 300, 322] },
  ], [
    text("Applicant name", 36, 326, 120),
    text("Partner name", 36, 314, 120),
  ]);
  assert.deepEqual(Array.from(form.fields, (field) => field.context.question), ["Applicant name", "Partner name"]);
});

test("a label owned by another input cannot become the next input's question", async () => {
  const form = await loadFixture([
    { subtype: "Widget", fieldName: "sin", fieldType: "Tx", rect: [189.648, 313.313, 306, 331.313] },
    { subtype: "Widget", fieldName: "unknown", fieldType: "Tx", rect: [183.004, 255.313, 370.08, 273.313] },
  ], [text("Social Insurance Number (SIN): ____________________", 34.56, 314.4631, 272.7804)]);
  assert.equal(form.fields[0].context.question, "Social Insurance Number (SIN):");
  assert.equal(form.fields[1].context.status, "ambiguous");
  assert.equal(form.fields[1].context.question, undefined);
});

test("filler-only text is not evidence of a readable question", async () => {
  const form = await loadFixture(radioWidgets(), [text("_________________________", 36, 113, 500)]);
  assert.equal(form.fields[0].context.status, "needs-ocr");
  assert.equal(form.fields[0].contextCandidates.blocks.length, 0);
});

test("answer-line filler is removed from PDF tooltips as well as static labels", async () => {
  const form = await loadFixture([{
    subtype: "Widget", fieldName: "name", fieldType: "Tx",
    rect: [120, 400, 380, 418], alternativeText: "Legal Last Name: __________________",
  }], []);
  assert.equal(form.fields[0].label, "Legal Last Name:");
  assert.equal(form.fields[0].context.source, "tooltip");
  assert.equal(form.fields[0].tooltip, "Legal Last Name:");
});

test("minimal two-line question beside radio widgets retains context", async () => {
  const form = await loadFixture(radioWidgets(), questionText());
  assert.match(form.fields[0].label, /receive, or were either of you eligible for the Canada Child Benefit\?/);
  assert.deepEqual(Array.from(form.fields[0].options), ["Yes", "No"]);
});

test("split text runs are joined without losing the question", async () => {
  const items = questionText();
  items.splice(1, 1,
    text("or were either of you eligible for the", 55.8, 103.6, 155),
    text("Canada Child Benefit?", 213.8, 103.6, 101));
  const form = await loadFixture(radioWidgets(), items);
  assert.match(form.fields[0].label, /receive, or were either of you eligible for the Canada Child Benefit\?/);
});

test("option labels follow widgets, not numeric export-value conventions", async () => {
  const widgets = radioWidgets();
  widgets[0].buttonValue = "2";
  widgets[1].buttonValue = "1";
  const form = await loadFixture(widgets, questionText());
  assert.deepEqual(Array.from(form.fields[0].options), ["Yes", "No"]);
});

test("missing or unrelated text does not invent a question or Yes/No mapping", async () => {
  const form = await loadFixture(radioWidgets(), [
    text("An unrelated question?", 55.8, 200, 150),
    text("Do not use this other column?", 700, 115, 150),
  ]);
  assert.equal(form.fields[0].context.status, "ambiguous");
  assert.doesNotMatch(form.fields[0].label, /rb|yes no2/i);
  assert.deepEqual(Array.from(form.fields[0].options), ["1", "2"]);
});

test("a question above a horizontal radio group is shared with guidance and chat", async () => {
  const form = await loadFixture(radioWidgets(), [
    text("Do you receive this benefit?", 477, 142, 150),
    ...questionText().slice(2),
  ]);
  const field = form.fields[0];
  assert.equal(field.context.status, "resolved");
  assert.equal(field.context.question, "Do you receive this benefit?");
  const { summarizeField } = loadModule("lib/field-context");
  const summary = summarizeField(field);
  assert.equal(summary.context.question, field.context.question);
  assert.match(loadModule("lib/explain").explainField(summary).meaning, /Do you receive this benefit/);
  await explainInChat({
    message: "Explain this field", language: "en", selectedFieldId: field.id,
    form: { pageCount: 1, fields: [summary] },
  });
  assert.match(chatCall.contents, /"question":"Do you receive this benefit\?"/);
});

test("widget annotation order does not change the question anchor", async () => {
  const widgets = radioWidgets();
  widgets[1].rect = [900, 111.1, 910, 121.1];
  const form = await loadFixture(widgets.reverse(), [
    text("Do you receive this benefit?", 477, 142, 150),
    text("Yes", 493.6, 113.2, 17.2),
    text("No", 916.5, 113.2, 12.8),
  ]);
  assert.equal(form.fields[0].context.status, "resolved");
  assert.equal(form.fields[0].context.question, "Do you receive this benefit?");
  assert.deepEqual(Array.from(form.fields[0].options), ["No", "Yes"]);
});

test("a statement without a question mark can describe a checkbox", async () => {
  const [widget] = radioWidgets();
  widget.radioButton = false;
  widget.checkBox = true;
  const form = await loadFixture([widget], [
    text("I authorize the release of this information.", 493.6, 113.2, 220),
  ]);
  assert.equal(form.fields[0].context.question, "I authorize the release of this information.");
  assert.equal(form.fields[0].context.status, "resolved");
});

test("a conditional follow-up retains its parent question and instruction", async () => {
  const form = await loadFixture(radioWidgets(), [
    text("Do you receive the Canada Child Benefit?", 400, 151, 210),
    text("If Yes, please indicate who received the benefit:", 55.8, 115.6, 250),
    text("You", 493.6, 113.2, 17.2),
    text("Your partner", 542.4, 113.2, 65),
  ]);
  assert.match(form.fields[0].context.question, /Canada Child Benefit/);
  assert.match(form.fields[0].context.instructions.join(" "), /If Yes/);
});

test("a field on a page without readable text explicitly requires OCR", async () => {
  const form = await loadFixture(radioWidgets(), []);
  assert.equal(form.fields[0].context.status, "needs-ocr");
  const explanation = loadModule("lib/explain").explainField(form.fields[0]);
  assert.match(explanation.meaning, /could not identify/i);
  assert.deepEqual(Array.from(explanation.commonMistakes), []);
});

test("table row and column headings stay ambiguous rather than choosing only one", async () => {
  const widgets = radioWidgets();
  widgets[1].fieldName = "another_row_control";
  const form = await loadFixture(widgets, [
    text("Applicant", 400, 113, 50),
    text("Canadian resident", 477, 142, 100),
    ...questionText().slice(2),
  ]);
  assert.equal(form.fields[0].context.status, "ambiguous");
  assert.ok(form.fields[0].contextCandidates.blocks.some((block) => block.text === "Applicant"));
  assert.ok(form.fields[0].contextCandidates.blocks.some((block) => block.text === "Canadian resident"));
});

test("layout evidence and structured context respect association size limits", async () => {
  const items = questionText();
  for (let i = 0; i < 80; i++) items.push(text(`Candidate ${i} ${"x".repeat(220)}`, 60 + i * 0.1, 150 + i * 0.2, 200));
  const form = await loadFixture(radioWidgets(), items);
  assert.ok(form.fields[0].contextCandidates.blocks.length <= 40);
  assert.ok(form.fields[0].contextCandidates.blocks.reduce((sum, block) => sum + block.text.length, 0) <= 12_000);
});

test("meaningful PDF tooltips and curated labels keep precedence", async () => {
  const widgets = radioWidgets().map((widget) => ({ ...widget, alternativeText: "Official question tooltip" }));
  const form = await loadFixture(widgets, questionText());
  assert.equal(form.fields[0].label, "Official question tooltip");
  const { enrichFields } = loadModule("lib/fields");
  const [field] = enrichFields([{
    rawName: "PPTC_153.Gender.Sex", path: "PPTC_153.Gender.Sex",
    page: 1, rects: [[1, 1, 2, 2]], type: "radio",
    label: "Nearby question?", options: ["F", "M", "X"],
    optionLabels: { F: "Nearby F", M: "Nearby M" },
  }], "PPTC 153");
  assert.equal(field.label, "Sex");
  assert.deepEqual(Array.from(field.options), ["Female", "Male", "Another gender"]);
});

test("generic choice tooltips are instructions, not a resolved question", async () => {
  const form = await loadFixture(radioWidgets().map((widget) => ({
    ...widget, alternativeText: "Select one only",
  })), [
    text("Other nearby text", 700, 150, 100),
    ...questionText().slice(2),
  ]);
  assert.equal(form.fields[0].context.status, "ambiguous");
  assert.notEqual(form.fields[0].context.question, "Select one only");
});

test("the bundled passport retains its curated question and radio labels", async () => {
  const data = readFileSync(new URL("../public/forms/pptc153.pdf", import.meta.url));
  const form = await loadModule("lib/pdf/extract").loadForm(Uint8Array.from(data).buffer, "pptc153.pdf");
  try {
    assert.equal(form.formNumber, "PPTC 153");
    const field = form.fields.find((f) => /\.PreviousPassportInfo\.PreviousPassport$/.test(f.path));
    assert.ok(field);
    assert.equal(field.label, "Have you had a Canadian travel document?");
    assert.deepEqual(Array.from(field.options).sort(), ["No", "Yes"]);
  } finally {
    await Promise.all(tasks.splice(0).map((task) => task.destroy()));
  }
});
