import { openAICompatibleProvider } from "./openaiCompatible";
import { LlmError, type LlmProvider, type LlmProviderName } from "./types";

export type { LlmProvider, LlmProviderName } from "./types";

function requireKey(name: string): string {
  const key = process.env[name];
  if (!key) throw new LlmError(`${name} is not set on this Convex deployment`);
  return key;
}

/**
 * Picks the provider a persona asks for. OpenAI is the default; xAI uses the
 * same API shape. Anthropic is reserved in the schema and gets an adapter when
 * a persona needs it.
 */
export function getLlmProvider(name: LlmProviderName): LlmProvider {
  switch (name) {
    case "openai":
      return openAICompatibleProvider({
        name,
        baseUrl: "https://api.openai.com/v1",
        apiKey: requireKey("OPENAI_API_KEY"),
      });
    case "xai":
      return openAICompatibleProvider({
        name,
        baseUrl: "https://api.x.ai/v1",
        apiKey: requireKey("XAI_API_KEY"),
      });
    case "anthropic":
      throw new LlmError("The Anthropic provider isn't implemented yet");
  }
}
