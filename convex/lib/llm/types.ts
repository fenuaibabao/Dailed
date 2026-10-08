import type { Doc } from "../../_generated/dataModel";

export type LlmProviderName = Doc<"personas">["llmProvider"];

export type JsonCompletionRequest = {
  model: string;
  system: string;
  user: string;
  maxOutputTokens?: number;
};

/**
 * The one thing the processor needs from a model: a system + user prompt in,
 * a JSON string out. Each provider adapts this to its own API.
 */
export interface LlmProvider {
  readonly name: LlmProviderName;
  completeJson(request: JsonCompletionRequest): Promise<string>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
