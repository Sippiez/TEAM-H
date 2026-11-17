import "server-only";

import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

// Keep the existing orchestration's request/response shape at the provider boundary.
export type ModelResponse = Partial<Pick<GenerateContentResponse, "text" | "functionCalls" | "candidates" | "usageMetadata">>;
export interface ModelClient {
  models: {
    generateContent(params: GenerateContentParameters): Promise<ModelResponse>;
    generateContentStream(params: GenerateContentParameters): Promise<AsyncGenerator<ModelResponse>>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function responseValue(value: unknown): ModelResponse {
  if (!isRecord(value) || value.status !== "completed" || !Array.isArray(value.output)) {
    throw new Error("The OpenAI generation did not finish successfully");
  }
  let text = "";
  const functionCalls: NonNullable<ModelResponse["functionCalls"]> = [];
  for (const item of value.output) {
    if (!isRecord(item)) throw new Error("Invalid OpenAI output");
    if (item.type === "function_call") {
      if (typeof item.name !== "string" || typeof item.arguments !== "string") {
        throw new Error("Invalid OpenAI function call");
      }
      const args: unknown = JSON.parse(item.arguments);
      if (!isRecord(args)) throw new Error("Invalid OpenAI function arguments");
      functionCalls.push({ name: item.name, args });
    } else if (item.type === "message") {
      if (!Array.isArray(item.content)) throw new Error("Invalid OpenAI message");
      for (const part of item.content) {
        if (!isRecord(part) || part.type !== "output_text" || typeof part.text !== "string") {
          throw new Error("OpenAI refused or returned unsupported content");
        }
        text += part.text;
      }
    } else if (item.type !== "reasoning") {
      throw new Error("Unsupported OpenAI output");
    }
  }
  return { text, functionCalls };
}

export function createOpenAIClient(apiKey: string): ModelClient {
  async function request(params: GenerateContentParameters, stream: boolean): Promise<Response> {
    if (typeof params.contents !== "string" ||
        (params.config?.systemInstruction !== undefined && typeof params.config.systemInstruction !== "string")) {
      throw new Error("Unsupported AI prompt format");
    }
    const declarations = (params.config?.tools ?? []).flatMap((tool) =>
      "functionDeclarations" in tool ? tool.functionDeclarations ?? [] : [],
    );
    const allowed = params.config?.toolConfig?.functionCallingConfig?.allowedFunctionNames;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: params.config?.abortSignal,
      body: JSON.stringify({
        model: params.model,
        input: params.contents,
        instructions: params.config?.systemInstruction,
        store: false,
        stream,
        reasoning: { effort: "low" },
        // Responses budgets include reasoning tokens as well as visible output.
        max_output_tokens: (params.config?.maxOutputTokens ?? 2_048) + 4_096,
        ...(declarations.length ? {
          tools: declarations.map((declaration) => ({
            type: "function",
            name: declaration.name,
            description: declaration.description,
            parameters: declaration.parametersJsonSchema,
            strict: true,
          })),
          tool_choice: allowed?.length === 1
            ? { type: "function", name: allowed[0] }
            : "required",
          parallel_tool_calls: false,
        } : {}),
        ...(params.config?.responseJsonSchema ? {
          text: {
            format: {
              type: "json_schema",
              name: "form_response",
              strict: true,
              schema: params.config.responseJsonSchema,
            },
          },
        } : {}),
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`OpenAI request failed (HTTP ${response.status})`);
    }
    return response;
  }

  async function* streamContent(params: GenerateContentParameters): AsyncGenerator<ModelResponse> {
    const response = await request(params, true);
    if (!response.body) throw new Error("Empty OpenAI response stream");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) throw new Error("OpenAI stream ended before completion");
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          if (frame.length > 1_048_576) throw new Error("OpenAI stream event too large");
          const data = frame.split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart()).join("\n");
          if (!data) continue;
          const event: unknown = JSON.parse(data);
          if (!isRecord(event)) throw new Error("Invalid OpenAI stream event");
          if (event.type === "response.output_text.delta") {
            if (typeof event.delta !== "string") throw new Error("Invalid OpenAI text delta");
            yield { text: event.delta };
          } else if (event.type === "response.completed") {
            responseValue(event.response);
            return;
          } else if (event.type === "error" || event.type === "response.failed" ||
                     event.type === "response.incomplete" || event.type === "response.refusal.delta") {
            throw new Error("The OpenAI generation did not finish successfully");
          }
        }
        if (buffer.length > 1_048_576) throw new Error("OpenAI stream event too large");
      }
    } finally {
      try {
        await reader.cancel();
      } finally {
        reader.releaseLock();
      }
    }
  }

  return {
    models: {
      async generateContent(params) {
        const response = await request(params, false);
        return responseValue(await response.json());
      },
      async generateContentStream(params) {
        return streamContent(params);
      },
    },
  };
}
