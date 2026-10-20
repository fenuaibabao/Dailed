import { z } from "zod";
import type { LlmProvider } from "./llm";
import { completeValidated, userSpeech } from "./processing";
import { asksToStop, containsQuote, findConcerns } from "../../src/lib/dailySafety";

// Turns a finished Daily call into the family summary, the parent's answer
// about the calls, alerts and memories for next time. The model reads the
// call; plain checks then decide what counts:
// - "Yes" to the calls only counts when the parent's own words for it are in
//   the transcript. Anything less is not a yes.
// - "Stop calling" and worrying words are also caught by word lists, so a
//   model miss can't hide them.

const quote = z.string().trim().min(1).max(300);

export const dailyResultSchema = z.object({
  consent: z.enum(["yes", "no", "unclear", "not_asked"]),
  consent_quote: quote.nullable().optional(),
  stop_requested: z.boolean().default(false),
  mood: z.string().trim().min(1).max(80).nullable().optional(),
  highlights: z.array(z.string().trim().min(1).max(300)).default([]),
  check_ins: z.array(z.string().trim().min(1).max(300)).default([]),
  pass_on: z.string().trim().min(1).max(500).nullable().optional(),
  concerns: z.array(z.object({ label: z.string().trim().min(1).max(80), quote })).default([]),
  memories: z
    .array(z.object({ content: z.string().trim().min(1).max(300), importance: z.coerce.number().int().min(1).max(5) }))
    .default([]),
});

export const DAILY_LIMITS = { highlights: 2, checkIns: 3, memories: 8 } as const;

export const DAILY_SYSTEM_PROMPT = `You read the transcript of a short check-in phone call between an AI caller ("AI:" lines) and an older parent ("User:" lines). The parent's family will read a short summary.

Return one JSON object:
{
  "consent": "yes" | "no" | "unclear" | "not_asked",
  "consent_quote": the parent's own words answering whether the AI may call each day, copied exactly from a User line, or null,
  "stop_requested": true if the parent asked the AI to stop calling,
  "mood": how the parent seemed, in 1 to 4 plain words they'd recognize (e.g. "cheerful", "tired but upbeat"), or null,
  "highlights": up to 2 short sentences about what they talked about,
  "check_ins": up to 3 short sentences reporting what the parent said about medicine, sleep or meals, written as self-reported ("Said she took her morning pills."),
  "pass_on": anything the parent asked the AI to tell the family, in one or two sentences, or null,
  "concerns": [{"label": a few words, "quote": the parent's exact words from a User line}] for falls, pain, breathing trouble, confusion, calls for help or anything a family should hear about soon,
  "memories": up to 8 facts about the parent's life to remember for future calls (people, pets, hobbies, plans), each {"content", "importance" 1-5}
}

Rules:
- "consent" is only about whether the AI may keep calling. Use "not_asked" if the AI didn't ask. Use "yes" only for a clear yes; "unclear" if they hesitated, changed the subject or hung up.
- Use only what the parent actually said. Never invent details, feelings or events.
- If the parent asked the AI not to tell their family something, leave it out of highlights, check_ins and pass_on, unless it is about their safety (then it goes in concerns).
- Never add medical interpretation, advice or diagnoses. Report their words, not conclusions.
- Write about the parent in the third person, plainly and kindly.`;

export type DailyJob = { transcript: string; parentName: string; isConsentCall: boolean };

export type DailyOutcome = {
  /** What the call means for the parent's answer about the calls. */
  consent: "granted" | "declined" | "unclear" | "unchanged";
  /** The parent's words for that answer, when there are some. */
  consentQuote: string | null;
  stopRequested: boolean;
  mood: string | null;
  highlights: string[];
  checkIns: string[];
  passOn: string | null;
  /** Worrying things the parent said, each tied to their words. */
  concerns: { label: string; quote: string | null }[];
  memories: { content: string; importance: number }[];
};

/** Applies the plain checks to what the model read. Pure, so it can be tested on its own. */
export function finalizeDailyResult(raw: z.infer<typeof dailyResultSchema>, job: DailyJob): DailyOutcome {
  const parent = userSpeech(job.transcript);

  let consent: DailyOutcome["consent"] = "unchanged";
  let consentQuote: string | null = null;
  if (job.isConsentCall) {
    if (raw.consent === "yes" && raw.consent_quote && containsQuote(parent, raw.consent_quote)) {
      consent = "granted";
      consentQuote = raw.consent_quote;
    } else if (raw.consent === "no") {
      consent = "declined";
      consentQuote = raw.consent_quote && containsQuote(parent, raw.consent_quote) ? raw.consent_quote : null;
    } else {
      consent = "unclear";
    }
  }

  const concerns: DailyOutcome["concerns"] = [];
  const seen = new Set<string>();
  for (const c of raw.concerns) {
    if (!containsQuote(parent, c.quote)) continue;
    concerns.push({ label: c.label, quote: c.quote });
    seen.add(c.label.toLowerCase());
  }
  for (const label of findConcerns(parent)) {
    if (!seen.has(label)) concerns.push({ label, quote: null });
  }

  return {
    consent,
    consentQuote,
    // Saying no on the first call is handled as a "no", not as a stop.
    stopRequested: consent !== "declined" && (raw.stop_requested || asksToStop(parent)),
    mood: raw.mood ?? null,
    highlights: raw.highlights.slice(0, DAILY_LIMITS.highlights),
    checkIns: raw.check_ins.slice(0, DAILY_LIMITS.checkIns),
    passOn: raw.pass_on ?? null,
    concerns,
    memories: raw.memories.slice(0, DAILY_LIMITS.memories),
  };
}

export async function processDailyTranscript(llm: LlmProvider, model: string, job: DailyJob): Promise<DailyOutcome> {
  const raw = await completeValidated(
    llm,
    {
      model,
      system: DAILY_SYSTEM_PROMPT,
      user: `The parent is called ${job.parentName}. ${job.isConsentCall ? "This was the first call, where the AI asks for permission to keep calling." : "This was a regular check-in call."}\n\nTranscript:\n${job.transcript}`,
    },
    dailyResultSchema,
  );
  return finalizeDailyResult(raw, job);
}
