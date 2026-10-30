import { cleanPdfText } from "@/lib/text";
import type { FieldContext, FieldContextCandidates, FieldType, PdfRect, PdfTextBlock } from "@/lib/types";

interface TextFragment {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

type Widget = FieldContextCandidates["widgets"][number];
const clean = (text: string) => text.replace(/\s+/g, " ").trim();
const conditional = (text: string) => /^(if\b|si\b|please\b|veuillez\b)/i.test(text);
const descriptive = (text: string) =>
  text.length > 4 && !/^(yes|no|oui|non|you|vous|\d+)[.!]?$/.test(text.toLowerCase());
const bounds = (rect: PdfRect): PdfRect => [
  Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]),
  Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3]),
];

/** Preserve columns while joining adjacent text runs and wrapped lines once per page. */
export function buildTextBlocks(items: TextFragment[], widgets: Widget[] = []): PdfTextBlock[] {
  const lines: PdfTextBlock[] = [];
  const captionOwner = (rect: PdfRect) => widgets.filter((widget) => {
    const control = bounds(widget.rect);
    return rect[1] < control[1] && rect[3] <= control[1] + 3 && control[1] - rect[3] <= 16 &&
      rect[0] >= control[0] - 60 && rect[0] <= control[0] + 16;
  }).sort((a, b) => Math.abs(a.rect[0] - rect[0]) - Math.abs(b.rect[0] - rect[0]))[0];
  for (const item of items.map((item) => ({
    ...item, str: cleanPdfText(item.str), hasAnswerLine: /_{3,}/.test(item.str),
  })).filter((item) => (item.str || item.hasAnswerLine) && item.height > 0)
    .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
    const [x, y] = item.transform.slice(4);
    const owner = captionOwner([x, y, x + item.width, y + item.height]);
    const line = lines.find((line) => Math.abs(line.rect[1] - y) < 3 &&
      x >= line.rect[2] - 1 && x - line.rect[2] <= Math.max(12, item.height * 2) &&
      (!owner || !captionOwner(line.rect) || captionOwner(line.rect) === owner));
    if (line) {
      line.text = clean(`${line.text} ${item.str}`);
      line.rect[2] = x + item.width;
      line.rect[3] = Math.max(line.rect[3], y + item.height);
      line.hasAnswerLine ||= item.hasAnswerLine;
    } else {
      lines.push({
        id: "", text: item.str, rect: [x, y, x + item.width, y + item.height],
        hasAnswerLine: item.hasAnswerLine,
      });
    }
  }
  const blocks: PdfTextBlock[] = [];
  for (const line of lines.sort((a, b) => b.rect[1] - a.rect[1] || a.rect[0] - b.rect[0])) {
    const height = line.rect[3] - line.rect[1];
    const previous = blocks.findLast((block) =>
      !block.hasAnswerLine && !line.hasAnswerLine &&
      !/[?!:.]\s*$/.test(block.text) &&
      Math.abs(block.rect[0] - line.rect[0]) <= height * 1.6 &&
      block.rect[1] - line.rect[1] > 3 && block.rect[1] - line.rect[1] <= height * 1.6 &&
      !widgets.some((widget) => {
        const rect = bounds(widget.rect);
        return rect[3] < block.rect[1] && rect[3] > line.rect[1] &&
          rect[2] >= Math.min(block.rect[0], line.rect[0]) &&
          rect[0] <= Math.max(block.rect[2], line.rect[2]) + 24;
      }));
    if (previous) {
      previous.text = clean(`${previous.text} ${line.text}`);
      previous.rect[1] = line.rect[1];
      previous.rect[2] = Math.max(previous.rect[2], line.rect[2]);
    } else {
      blocks.push({ ...line, rect: [...line.rect] });
    }
  }
  return blocks.map((block, index) => ({ ...block, id: `b-${index}` }));
}

export function matchFieldContext(
  widgets: Widget[],
  allWidgets: Widget[],
  blocks: PdfTextBlock[],
  type: FieldType,
): { context: FieldContext; candidates: FieldContextCandidates; optionLabels: Record<string, string> } {
  const positions = widgets.map((widget) => bounds(widget.rect));
  const first = [...positions].sort((a, b) =>
    Math.abs(a[3] - b[3]) < 4 ? a[0] - b[0] : b[3] - a[3])[0];
  const groupBottom = Math.min(...positions.map((rect) => rect[1]));
  const groupRight = Math.max(...positions.map((rect) => rect[2]));
  const local = blocks.filter((block) => block.text.length > 0 && block.text.length <= 1_200 &&
    block.rect[3] >= groupBottom - 65 && block.rect[1] <= first[3] + 110 &&
    block.rect[2] >= first[0] - 450 && block.rect[0] <= groupRight + 300);
  const nearby = [...local].sort((a, b) =>
    Math.abs(a.rect[1] - first[1]) - Math.abs(b.rect[1] - first[1]));
  let textBudget = 12_000;
  const evidence = nearby.filter((block) => {
    if (block.text.length > textBudget) return false;
    textBudget -= block.text.length;
    return true;
  }).slice(0, 40);
  const candidates = { blocks: widgets.length <= 30 ? evidence : [], widgets };
  const optionLabels: Record<string, string> = {};
  const optionBlocks = new Set<PdfTextBlock>();
  const rightLabels: PdfTextBlock[] = [];
  for (const widget of widgets) {
    const rect = bounds(widget.rect);
    const next = allWidgets.filter((other) => other !== widget &&
      bounds(other.rect)[0] >= rect[2] &&
      Math.abs((other.rect[1] + other.rect[3] - rect[1] - rect[3]) / 2) < 4)
      .reduce((end, other) => Math.min(end, bounds(other.rect)[0]), Infinity);
    const labels = blocks.filter((block) => block.text &&
      block.rect[0] >= rect[2] - 1 && block.rect[0] - rect[2] <= 24 &&
      block.rect[2] <= next && block.rect[3] >= rect[1] - 3 && block.rect[1] <= rect[3] + 3)
      .sort((a, b) => a.rect[0] - b.rect[0]);
    if (labels.length !== 1) continue;
    const label = labels[0];
    rightLabels.push(label);
    optionBlocks.add(label);
    if (widget.option) optionLabels[widget.option] = label.text;
  }
  const eligible = local.filter((block) => !optionBlocks.has(block) && descriptive(block.text));
  const foreignWidgets = allWidgets.filter((widget) =>
    !widgets.some((own) => own.rect.every((value, i) => value === widget.rect[i])));
  const intersectsOtherWidget = (block: PdfTextBlock) => foreignWidgets.some((widget) => {
    const rect = bounds(widget.rect);
    const row = (block.rect[1] + block.rect[3]) / 2;
    return rect[0] < block.rect[2] && rect[2] > block.rect[0] &&
      rect[1] < row && rect[3] > row;
  });
  const rowMargin = type === "radio" || type === "checkbox" ? 3 : 0;
  const onLeft = (block: PdfTextBlock) =>
    block.rect[2] < first[0] - 2 && first[0] - block.rect[2] <= 240 &&
    (block.rect[1] + block.rect[3]) / 2 >= first[1] - rowMargin &&
    block.rect[1] < first[3] + rowMargin;
  const inline = (block: PdfTextBlock) =>
    type !== "radio" && type !== "checkbox" && block.hasAnswerLine &&
    block.rect[0] < first[0] && block.rect[2] >= first[0] &&
    block.rect[3] >= first[1] && block.rect[1] <= first[3];
  const above = (block: PdfTextBlock) =>
    block.rect[1] >= first[3] && block.rect[1] - first[3] <= 64 &&
    block.rect[0] <= first[0] + 16 && block.rect[2] >= first[0] - 60;
  const printedAnswerLine = blocks.some((block) => !block.text && block.hasAnswerLine &&
    block.rect[0] <= first[2] && block.rect[2] >= first[0] &&
    block.rect[3] >= first[1] && block.rect[1] <= first[3]);
  const below = (block: PdfTextBlock) =>
    printedAnswerLine && type !== "radio" && type !== "checkbox" && block.text.length <= 120 &&
    block.rect[1] < first[1] && block.rect[3] <= first[1] + 3 && first[1] - block.rect[3] <= 16 &&
    block.rect[0] >= first[0] - 60 && block.rect[0] <= first[0] + 16;
  const instructions = eligible.filter((block) =>
    !intersectsOtherWidget(block) && onLeft(block) && conditional(block.text));
  const ranked = eligible.filter((block) => !conditional(block.text) &&
    (inline(block) || (!intersectsOtherWidget(block) && (onLeft(block) || above(block) || below(block)))))
    .map((block) => ({
      block,
      score: inline(block) ? -10 : onLeft(block) ? (first[0] - block.rect[2]) / 100
        : below(block) ? 5 + first[1] - block.rect[3] + Math.abs(first[0] - block.rect[0]) / 100
          : 10 + block.rect[1] - first[3],
    }))
    .sort((a, b) => a.score - b.score);
  const foreignRow = foreignWidgets.some((widget) =>
    Math.abs((widget.rect[1] + widget.rect[3] - first[1] - first[3]) / 2) < 4);
  const sharedAnswerLine = eligible.some((block) => inline(block) && intersectsOtherWidget(block));
  const tableHeadings = foreignRow &&
    ranked.some(({ block }) => onLeft(block) && !/\?/.test(block.text)) &&
    ranked.some(({ block }) => above(block) && !/\?/.test(block.text));
  const uncertain = sharedAnswerLine || tableHeadings || (ranked.length > 1 && ranked[1].score - ranked[0].score < 6);
  let question = !uncertain ? ranked[0]?.block.text : undefined;
  if (!question && type === "checkbox" && rightLabels.length === 1 && descriptive(rightLabels[0].text)) {
    question = rightLabels[0].text;
  }
  // A conditional instruction needs its parent question; never treat "If yes" as the question.
  if (instructions.length && !question && !uncertain) {
    const parents = eligible.filter((block) => !intersectsOtherWidget(block) && /\?\s*$/.test(block.text) &&
      block.rect[1] > first[3] && block.rect[1] - first[3] <= 100 &&
      block.rect[0] < first[2] && block.rect[2] > first[0] - 250)
      .sort((a, b) => a.rect[1] - b.rect[1]);
    if (parents.length === 1) question = parents[0].text;
  }
  const missingOptions = type === "radio" && widgets.some((widget) => !widget.option || !optionLabels[widget.option]);
  return {
    context: {
      status: question && !missingOptions ? "resolved" : blocks.some((block) => block.text) ? "ambiguous" : "needs-ocr",
      source: "layout",
      question,
      instructions: instructions.slice(0, 8).map((block) => block.text),
    },
    candidates,
    optionLabels,
  };
}
