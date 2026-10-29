import { NextResponse } from "next/server";

import { generateGeminiFieldExplanation } from "@/lib/ai/gemini";
import { explainField } from "@/lib/explain";
import { isFieldSummary } from "@/lib/field-context";
import type { ExplainRequest } from "@/lib/types";

const MAX_BODY_LENGTH = 20_000;
const REQUEST_TIMEOUT_MS = 30_000;

export async function POST(request: Request) {
  let value: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    value = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
  }

  const body = value as Partial<ExplainRequest>;
  const f = body?.field;
  if (!isFieldSummary(f)) {
    return NextResponse.json({ error: "Missing field" }, { status: 400 });
  }
  if (body.formNumber !== undefined && (typeof body.formNumber !== "string" || body.formNumber.length > 100)) {
    return NextResponse.json({ error: "Invalid form number" }, { status: 400 });
  }
  if (body.language !== undefined && body.language !== "en" && body.language !== "fr") {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "The AI service is not configured" }, { status: 503 });
  }

  const curated = explainField(f, body.formNumber);
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();

  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new DOMException("Explanation aborted", "AbortError"));
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
    if (controller.signal.aborted) rejectAbort();
  });

  try {
    const generated = await Promise.race([
      aborted,
      generateGeminiFieldExplanation({
        field: f,
        formNumber: body.formNumber,
        language: body.language ?? "en",
        curated,
        signal: controller.signal,
      }),
    ]);
    return NextResponse.json({
      ...curated,
      ...generated,
      fieldId: f.id,
      sources: curated.sources,
      grounded: curated.grounded,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const abortedByClient = request.signal.aborted;
    console.error("AI explanation failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({
      error: timedOut ? "The AI request timed out" : abortedByClient ? "Request cancelled" : "The AI could not explain this field",
    }, { status: timedOut ? 504 : abortedByClient ? 499 : 502 });
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectAbort);
    controller.abort();
  }
}
