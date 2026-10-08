import { z } from "zod";

// Only the fields we use, read leniently: Vapi adds fields often and has moved
// some (transcript and recordingUrl now live under `artifact`).
const metadataSchema = z.object({ call_id: z.string().optional() }).loose();

const messageSchema = z
  .object({
    type: z.string(),
    endedReason: z.string().optional(),
    cost: z.number().optional(),
    durationSeconds: z.number().optional(),
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
    transcript: z.string().optional(),
    recordingUrl: z.string().optional(),
    artifact: z
      .object({ transcript: z.string().optional(), recordingUrl: z.string().optional() })
      .loose()
      .optional(),
    call: z
      .object({
        id: z.string().optional(),
        metadata: metadataSchema.optional(),
        assistantOverrides: z.object({ metadata: metadataSchema.optional() }).loose().optional(),
      })
      .loose()
      .optional(),
    assistant: z.object({ metadata: metadataSchema.optional() }).loose().optional(),
  })
  .loose();

const payloadSchema = z.object({ message: messageSchema }).loose();

export type NormalizedReport = {
  callId?: string;
  vapiCallId?: string;
  transcript?: string;
  recordingUrl?: string;
  durationSeconds?: number;
  costUsd?: number;
  endedReason?: string;
  startedAt?: number;
  endedAt?: number;
};

export type ParsedWebhook =
  | { kind: "end-of-call-report"; report: NormalizedReport }
  | { kind: "other"; type: string }
  | { kind: "invalid" };

function toMs(iso: string | undefined): number | undefined {
  if (iso === undefined) return undefined;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : ms;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export function parseVapiWebhook(body: unknown): ParsedWebhook {
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return { kind: "invalid" };
  const message = parsed.data.message;
  if (message.type !== "end-of-call-report") return { kind: "other", type: message.type };

  const startedAt = toMs(message.startedAt);
  const endedAt = toMs(message.endedAt);
  const durationSeconds =
    message.durationSeconds ??
    (startedAt !== undefined && endedAt !== undefined ? (endedAt - startedAt) / 1000 : undefined);

  return {
    kind: "end-of-call-report",
    report: stripUndefined({
      callId:
        message.call?.metadata?.call_id ??
        message.call?.assistantOverrides?.metadata?.call_id ??
        message.assistant?.metadata?.call_id,
      vapiCallId: message.call?.id,
      transcript: message.artifact?.transcript ?? message.transcript,
      recordingUrl: message.artifact?.recordingUrl ?? message.recordingUrl,
      durationSeconds,
      costUsd: message.cost,
      endedReason: message.endedReason,
      startedAt,
      endedAt,
    }),
  };
}
