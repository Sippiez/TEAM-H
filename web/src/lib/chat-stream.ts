import type {
  ChatStreamEvent,
  OfficialLookupSummary,
  Resource,
} from "./types";

const LOOKUP_STATUSES = new Set([
  "verified",
  "clarification_required",
  "no_verified_results",
  "unavailable",
]);

function isResource(value: unknown): value is Resource {
  if (!value || typeof value !== "object") return false;
  const resource = value as Partial<Resource>;
  return (
    typeof resource.id === "string" &&
    typeof resource.title === "string" &&
    typeof resource.url === "string" &&
    typeof resource.department === "string" &&
    typeof resource.description === "string" &&
    Array.isArray(resource.tags) &&
    resource.tags.every((tag) => typeof tag === "string")
  );
}

function parseEvent(frame: string): ChatStreamEvent | null {
  const data = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;

  const value = JSON.parse(data) as Record<string, unknown>;
  if (!value || value.version !== 1 || typeof value.type !== "string") {
    throw new Error("Unsupported chat stream event");
  }
  if (value.type === "delta" && typeof value.text === "string") {
    return value as ChatStreamEvent;
  }
  if (
    value.type === "error" &&
    (value.code === "interrupted" || value.code === "unavailable")
  ) {
    return value as ChatStreamEvent;
  }
  if (value.type === "complete" && typeof value.complete === "boolean") {
    return value as ChatStreamEvent;
  }
  if (value.type === "lookup") {
    const outcome = value.outcome as Partial<OfficialLookupSummary> | undefined;
    if (
      outcome &&
      LOOKUP_STATUSES.has(outcome.status ?? "") &&
      typeof outcome.reason === "string" &&
      typeof outcome.partial === "boolean" &&
      (outcome.fallbackReason === undefined ||
        (typeof outcome.fallbackReason === "string" && outcome.fallbackReason.length <= 80)) &&
      (outcome.searchSuggestionsHtml === undefined ||
        (typeof outcome.searchSuggestionsHtml === "string" && outcome.searchSuggestionsHtml.length <= 32_000)) &&
      Array.isArray(value.sources) &&
      value.sources.every(isResource)
    ) {
      return value as ChatStreamEvent;
    }
  }
  throw new Error("Invalid chat stream event");
}

/** Decode versioned SSE frames without losing UTF-8 characters split across chunks. */
export async function* readChatEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let ended = false;
  const consume = (chunk: string): ChatStreamEvent[] => {
    buffer += chunk;
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    return frames.flatMap((frame) => {
      const event = parseEvent(frame);
      return event ? [event] : [];
    });
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        ended = true;
        break;
      }
      for (const event of consume(decoder.decode(value, { stream: true }))) {
        yield event;
      }
    }
    for (const event of consume(decoder.decode())) yield event;
    if (buffer.trim()) {
      const event = parseEvent(buffer);
      if (event) yield event;
    }
  } finally {
    if (!ended) {
      await reader.cancel().catch(() => undefined);
    }
    reader.releaseLock();
  }
}
