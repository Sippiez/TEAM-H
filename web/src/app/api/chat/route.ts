import { NextResponse } from "next/server";

import { streamGeminiChat } from "@/lib/ai/gemini";
import { abortable } from "@/lib/abortable";
import { validateLookupChoice, validateLookupContext, validatePublicForm } from "@/lib/official/catalog";
import { isFieldSummary } from "@/lib/field-context";
import type {
  ChatStreamEvent,
  ChatHistoryMessage,
  ChatRequest,
  FormContext,
} from "@/lib/types";

const MAX_MESSAGE = 1_000;
const MAX_FIELDS = 2_000;
const MAX_HISTORY = 12;
const MAX_HISTORY_TEXT = 1_000;
const REQUEST_TIMEOUT_MS = 30_000;

function isFormContext(value: unknown): value is FormContext {
  if (!value || typeof value !== "object") return false;

  const form = value as Partial<FormContext>;
  const pageCount = form.pageCount;

  return (
    typeof pageCount === "number" &&
    Number.isInteger(pageCount) &&
    pageCount > 0 &&
    pageCount <= 30 &&
    Array.isArray(form.fields) &&
    form.fields.length <= MAX_FIELDS &&
    form.fields.every(
      (field) => isFieldSummary(field) && field.page <= pageCount,
    ) &&
    (form.formNumber === undefined ||
      typeof form.formNumber === "string") &&
    (form.formTitle === undefined || validatePublicForm({ title: form.formTitle }) !== null) &&
    (form.fileName === undefined ||
      typeof form.fileName === "string")
  );
}

function sanitizeHistory(value: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-MAX_HISTORY)
    .filter((item): item is ChatHistoryMessage => {
      if (!item || typeof item !== "object") return false;

      const message = item as Partial<ChatHistoryMessage>;

      return (
        (message.role === "user" ||
          message.role === "assistant") &&
        typeof message.text === "string" &&
        message.text.trim().length > 0
      );
    })
    .map((message) => ({
      role: message.role,
      text: message.text.slice(0, MAX_HISTORY_TEXT),
    }));
}

function validateRequest(body: ChatRequest): string | null {
  if (body.lookupContext !== undefined && !validateLookupContext(body.lookupContext)) {
    return "Invalid lookup context";
  }
  if (body.lookupChoice !== undefined && !validateLookupChoice(body.lookupChoice)) {
    return "Invalid lookup choice";
  }
  if (
    body.intent !== undefined &&
    body.intent !== "overview" &&
    body.intent !== "field"
  ) {
    return "Unsupported intent";
  }

  if (
    body.message !== undefined &&
    typeof body.message !== "string"
  ) {
    return "Invalid message";
  }

  if (
    typeof body.message === "string" &&
    body.message.length > MAX_MESSAGE
  ) {
    return "Message too long";
  }

  if (!body.message?.replace(/\u0000/g, "").trim() && body.intent !== "overview") {
    return "Message is required";
  }

  if (body.form !== undefined && !isFormContext(body.form)) {
    return "Invalid form context";
  }

  if (body.intent === "overview" && !body.form) {
    return "An overview requires form context";
  }

  if (
    body.intent === "field" &&
    body.selectedFieldId === undefined
  ) {
    return "A field explanation requires a selected field";
  }

  if (
    body.selectedFieldId !== undefined &&
    typeof body.selectedFieldId !== "string"
  ) {
    return "Invalid selected field";
  }

  if (
    body.selectedFieldId !== undefined &&
    (!body.form ||
      !body.form.fields.some(
        (field) => field.id === body.selectedFieldId,
      ))
  ) {
    return "Selected field is not in the supplied form";
  }

  if (
    body.language !== undefined &&
    body.language !== "en" &&
    body.language !== "fr"
  ) {
    return "Unsupported language";
  }

  return null;
}

export async function POST(request: Request) {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 },
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json(
      { error: "Expected a JSON object" },
      { status: 400 },
    );
  }

  const body = parsed as ChatRequest;
  const validationError = validateRequest(body);

  if (validationError) {
    const status =
      validationError === "Message too long" ? 413 : 400;

    return NextResponse.json(
      { error: validationError },
      { status },
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        error: "The AI service is not configured",
      },
      { status: 503 },
    );
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    REQUEST_TIMEOUT_MS,
  );

  const abortFromClient = () => timeoutController.abort();
  request.signal.addEventListener("abort", abortFromClient, {
    once: true,
  });
  if (request.signal.aborted) abortFromClient();

  const cleanup = () => {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortFromClient);
  };

  try {
    timeoutController.signal.throwIfAborted();
    const geminiStream = await abortable(streamGeminiChat({
      message: body.message,
      intent: body.intent,
      form: body.form,
      selectedFieldId: body.selectedFieldId,
      history: body.intent === "field" ? [] : sanitizeHistory(body.history),
      language: body.language ?? "en",
      signal: timeoutController.signal,
      lookupContext: body.lookupContext,
      lookupChoice: body.lookupChoice,
    }), timeoutController.signal);

    const iterator = geminiStream[Symbol.asyncIterator]();
    const nextEvent = async (): Promise<ChatStreamEvent | null> => {
      while (true) {
        timeoutController.signal.throwIfAborted();
        const chunk = await abortable(iterator.next(), timeoutController.signal);
        if (chunk.done) return null;
        return chunk.value;
      }
    };

    // The SDK may defer upstream failures until the first iterator read.
    const firstEvent = await nextEvent();
    if (firstEvent === null) throw new Error("The AI returned an empty response");
    const encoder = new TextEncoder();
    let cancelled = false;
    const frame = (event: ChatStreamEvent) =>
      encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

    const bodyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(frame(firstEvent));
      },
      async pull(controller) {
        try {
          const event = await nextEvent();
          if (cancelled) return;
          if (event === null) {
            cleanup();
            controller.enqueue(frame({
              version: 1,
              type: "complete",
              complete: true,
            }));
            controller.close();
          } else {
            controller.enqueue(frame(event));
          }
        } catch (error) {
          cleanup();
          if (cancelled) return;
          console.error("AI chat stream failed", {
            name:
              error instanceof Error
                ? error.name
                : "UnknownError",
          });

          controller.enqueue(frame({
            version: 1,
            type: "error",
            code: timeoutController.signal.aborted ? "unavailable" : "interrupted",
          }));
          controller.enqueue(frame({
            version: 1,
            type: "complete",
            complete: false,
          }));
          controller.close();
        }
      },
      cancel() {
        cancelled = true;
        timeoutController.abort();
        cleanup();
      },
    });

    return new Response(bodyStream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const aborted =
      timeoutController.signal.aborted ||
      (error instanceof Error && error.name === "AbortError");
    cleanup();
    timeoutController.abort();

    const missingKey =
      error instanceof Error &&
      error.message === "GEMINI_API_KEY is not configured";

    console.error("AI chat request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      missingKey,
      aborted,
    });

    return NextResponse.json(
      {
        error: missingKey
          ? "The AI service is not configured"
          : aborted
            ? "The AI request timed out"
            : "The AI service could not complete the request",
      },
      { status: missingKey ? 503 : request.signal.aborted ? 499 : aborted ? 504 : 502 },
    );
  }
}