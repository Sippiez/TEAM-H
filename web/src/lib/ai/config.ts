export function getAIConfig() {
  const provider = process.env.AI_PROVIDER || "openai";
  if (provider === "openai") {
    return {
      provider,
      model: process.env.OPENAI_MODEL || "gpt-6-luna",
      apiKey: process.env.OPENAI_API_KEY,
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
  const provider = process.env.AI_PROVIDER || "openai";
  if (provider !== "openai" && provider !== "gemini") return false;
  return Boolean(getAIConfig().apiKey?.trim());
}
