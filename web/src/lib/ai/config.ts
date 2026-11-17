export function getAIConfig() {
  const provider = process.env.AI_PROVIDER || "gemini";
  const fallbackProvider = process.env.AI_FALLBACK_PROVIDER;
  if (fallbackProvider !== undefined && fallbackProvider !== "gemini") {
    throw new Error("AI_FALLBACK_PROVIDER must be gemini or unset");
  }
  if (fallbackProvider && provider !== "openai") {
    throw new Error("AI_FALLBACK_PROVIDER requires AI_PROVIDER=openai");
  }
  if (fallbackProvider && !process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("AI_FALLBACK_PROVIDER=gemini requires GEMINI_API_KEY");
  }
  if (provider === "openai") {
    return {
      provider,
      model: process.env.OPENAI_MODEL || "gpt-6-luna",
      apiKey: process.env.OPENAI_API_KEY,
      fallback: fallbackProvider ? {
        model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
        apiKey: process.env.GEMINI_API_KEY!,
      } : undefined,
    } as const;
  }
  if (provider === "gemini") {
    return {
      provider,
      model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
      apiKey: process.env.GEMINI_API_KEY,
    } as const;
  }
  throw new Error("AI_PROVIDER must be openai or gemini");
}

export function isAIConfigured(): boolean {
  try {
    return Boolean(getAIConfig().apiKey?.trim());
  } catch {
    return false;
  }
}
