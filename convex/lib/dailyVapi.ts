import { DAILY_START_SPEAKING_PLAN } from "./dailyPrompt";

export const VAPI_CALL_URL = "https://api.vapi.ai/call";

export type DailyPlacement = {
  callId: string;
  assistantId: string;
  phoneE164: string;
  parentName: string;
  firstMessage: string;
  systemPrompt: string;
  provider: string;
  model: string;
  maxDurationSeconds: number;
};

/**
 * The body for Vapi's "create call" API: our Twilio number dials the parent and
 * Remi speaks first. Everything Remi says and knows is sent here, per call,
 * like browser sessions do, so the Vapi dashboard copy never matters.
 */
export function buildVapiCallRequest(p: DailyPlacement, phoneNumberId: string) {
  return {
    phoneNumberId,
    customer: { number: p.phoneE164, name: p.parentName },
    assistantId: p.assistantId,
    assistantOverrides: {
      firstMessage: p.firstMessage,
      firstMessageMode: "assistant-speaks-first",
      maxDurationSeconds: p.maxDurationSeconds,
      model: {
        provider: p.provider,
        model: p.model,
        messages: [{ role: "system", content: p.systemPrompt }],
      },
      startSpeakingPlan: DAILY_START_SPEAKING_PLAN,
      // Hang up on answering machines instead of talking to them. No message is
      // left: the parent hasn't said yes to an AI voice yet.
      voicemailDetection: {
        provider: "vapi",
        backoffPlan: { startAtSeconds: 2, frequencySeconds: 2.5, maxRetries: 5 },
      },
      metadata: { call_id: p.callId },
    },
  };
}

/** Vapi's call id from its response, if there is one. */
export function vapiCallIdFrom(response: unknown): string | null {
  if (typeof response !== "object" || response === null) return null;
  const id = (response as { id?: unknown }).id;
  return typeof id === "string" && id !== "" ? id : null;
}
