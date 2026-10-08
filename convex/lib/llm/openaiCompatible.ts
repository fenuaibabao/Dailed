import { LlmError, type JsonCompletionRequest, type LlmProvider, type LlmProviderName } from "./types";

type ChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
};

/** OpenAI's Chat Completions API, which xAI (Grok) also implements. */
export function openAICompatibleProvider(options: {
  name: LlmProviderName;
  baseUrl: string;
  apiKey: string;
}): LlmProvider {
  return {
    name: options.name,
    async completeJson(request: JsonCompletionRequest): Promise<string> {
      const response = await fetch(`${options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          response_format: { type: "json_object" },
          max_tokens: request.maxOutputTokens ?? 4000,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
        }),
      });
      if (!response.ok) {
        // Never include the request (it carries the key) or the body in errors.
        throw new LlmError(`${options.name} request failed with HTTP ${response.status}`, response.status);
      }
      const data = (await response.json()) as ChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new LlmError(`${options.name} returned an empty completion`);
      }
      return content;
    },
  };
}
