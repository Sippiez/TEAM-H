import { NextResponse } from "next/server";

import { associateFieldContext } from "@/lib/ai/gemini";
import { isAIConfigured } from "@/lib/ai/config";
import { isAssociationRequest, resolveAssociation } from "@/lib/context-association";

export async function POST(request: Request) {
  let input: unknown;
  try {
    const text = await request.text();
    if (text.length > 30_000) return NextResponse.json({ error: "Context too large" }, { status: 413 });
    input = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isAssociationRequest(input)) return NextResponse.json({ error: "Invalid field context" }, { status: 400 });
  if (!isAIConfigured()) return NextResponse.json({ error: "The AI service is not configured" }, { status: 503 });

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new DOMException("Association aborted", "AbortError"));
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
    if (controller.signal.aborted) rejectAbort();
  });
  try {
    const selection = await Promise.race([
      aborted,
      controller.signal.aborted ? aborted : associateFieldContext(input, controller.signal),
    ]);
    const resolved = resolveAssociation(input.candidates, selection);
    return NextResponse.json(resolved ? { selection } : { selection: { status: "uncertain" } }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Field context association failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({
      error: timedOut ? "The AI request timed out" : request.signal.aborted ? "Request cancelled" : "The AI could not identify this field",
    }, { status: timedOut ? 504 : request.signal.aborted ? 499 : 502 });
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", rejectAbort);
    controller.abort();
  }
}
