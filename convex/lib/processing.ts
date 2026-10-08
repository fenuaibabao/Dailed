import { z } from "zod";
import type { LlmProvider } from "./llm";

// ---------------------------------------------------------------------------
// Output contract
// ---------------------------------------------------------------------------

const memorySchema = z.object({
  kind: z.enum(["fact", "goal", "open_thread", "idea", "theme"]),
  content: z.string().trim().min(1).max(500),
  importance: z.coerce.number().int().min(1).max(5),
});

const postSchema = z.object({
  platform: z.string().trim().max(40).optional(),
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1),
  source_excerpt: z.string().trim().min(1),
});

const scriptSchema = z.object({
  title: z.string().trim().max(200).optional(),
  hook: z.string().trim().min(1),
  beats: z.array(z.string().trim().min(1)).min(1).max(5),
  close: z.string().trim().min(1),
  source_excerpt: z.string().trim().min(1),
});

const newsletterSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
});

/** What the model must return. Counts above the caps are trimmed, not failed. */
export const sessionResultSchema = z.object({
  session_summary: z.string().trim().min(1),
  themes: z.array(z.string().trim().min(1)).max(10),
  posts: z.array(postSchema).default([]),
  scripts: z.array(scriptSchema).default([]),
  newsletter: newsletterSchema.nullable().optional(),
  ideas: z.array(z.string().trim().min(1)).default([]),
  memories: z.array(memorySchema).default([]),
});

export type SessionResult = z.infer<typeof sessionResultSchema>;

const chunkNotesSchema = z.object({
  notes: z.string().trim().min(1),
  quotes: z.array(z.string().trim().min(1)).default([]),
});

export const LIMITS = { themes: 5, posts: 5, scripts: 2, ideas: 10, memories: 20 } as const;

// ---------------------------------------------------------------------------
// Transcript helpers
// ---------------------------------------------------------------------------

// About 30 minutes of conversation. Longer transcripts are summarized in
// chunks first so the final call stays small and cheap.
export const LONG_SESSION_SECONDS = 30 * 60;
export const LONG_TRANSCRIPT_CHARS = 30_000;
export const CHUNK_CHARS = 12_000;

export function isLongSession(transcript: string, durationSeconds?: number): boolean {
  return (durationSeconds ?? 0) > LONG_SESSION_SECONDS || transcript.length > LONG_TRANSCRIPT_CHARS;
}

/** Splits on line boundaries into chunks of at most maxChars (unless one line is longer). */
export function chunkTranscript(transcript: string, maxChars = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of transcript.split("\n")) {
    if (current.length > 0 && current.length + line.length + 1 > maxChars) {
      chunks.push(current);
      current = "";
    }
    current = current.length > 0 ? `${current}\n${line}` : line;
  }
  if (current.trim().length > 0) chunks.push(current);
  return chunks;
}

/**
 * The user's side of a Vapi transcript ("User: ..." lines). Falls back to the
 * whole transcript when it has no speaker labels.
 */
export function userSpeech(transcript: string): string {
  const lines = transcript.split("\n");
  const labeled = lines.some((line) => /^\s*(user|customer)\s*:/i.test(line));
  if (!labeled) return transcript;
  const parts: string[] = [];
  let inUserTurn = false;
  for (const line of lines) {
    const speaker = /^\s*([a-z]+)\s*:/i.exec(line);
    if (speaker) {
      inUserTurn = /^(user|customer)$/i.test(speaker[1]);
      if (inUserTurn) parts.push(line.slice(speaker[0].length));
    } else if (inUserTurn) {
      parts.push(line);
    }
  }
  return parts.join("\n");
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the excerpt is something the user actually said: after
 * normalizing case and punctuation, it must appear in their speech. Excerpts
 * under four words are too weak to count.
 */
export function isGroundedExcerpt(excerpt: string, speech: string): boolean {
  const needle = normalizeForMatch(excerpt);
  if (needle.split(" ").length < 4) return false;
  return normalizeForMatch(speech).includes(needle);
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const GROUNDING_RULES = `Hard rules:
- Use only what the USER said in the transcript. Never invent facts, numbers, names, stories, results or opinions they did not express.
- Write drafts in the user's own voice and phrasing, as if they wrote them.
- Every post and script must include "source_excerpt": a passage copied word for word from the user's own lines (at least 8 words) that the draft is built on.
- If there isn't enough material for something, return fewer items or an empty list. Fewer honest drafts beat more invented ones.
- Ignore the interviewer's (AI's) lines as a source of content; they are only context.`;

export const FINAL_SYSTEM_PROMPT = `You turn an interview transcript into a private session summary, themes and content drafts for the person who was interviewed.

${GROUNDING_RULES}

Return one JSON object with exactly these keys:
{
  "session_summary": string,        // bird's-eye view of the session in 5 to 8 sentences, second person ("You talked about...")
  "themes": string[],               // 3 to 5 big-picture through-lines, one sentence each (fewer if the session was short)
  "posts": [{ "platform": "linkedin" | "x" | "threads" | "instagram", "title": string, "body": string, "source_excerpt": string }],   // up to 5
  "scripts": [{ "title": string, "hook": string, "beats": [string, string, string], "close": string, "source_excerpt": string }],     // up to 2 short-video scripts, under 60 seconds spoken
  "newsletter": { "title": string, "body": string } | null,    // only if there is enough material for a real newsletter, otherwise null
  "ideas": string[],                // seeds for future sessions: topics or questions worth exploring next time
  "memories": [{ "kind": "fact" | "goal" | "open_thread" | "idea" | "theme", "content": string, "importance": 1 | 2 | 3 | 4 | 5 }]  // what the interviewer should remember next time; 5 = central to who they are or what they're doing
}
Return JSON only.`;

export const CHUNK_SYSTEM_PROMPT = `You are condensing one part of a long interview transcript so it can be summarized later.

${GROUNDING_RULES}

Return one JSON object:
{
  "notes": string,      // dense notes on what the user said in this part: topics, stories, opinions, goals, open questions. No interpretation.
  "quotes": string[]    // up to 12 of the user's most vivid or quotable passages, copied word for word (8 to 60 words each)
}
Return JSON only.`;

const SENSITIVE_NOTE =
  "\nThis is a private sensitive session: return empty lists for posts and scripts and null for newsletter.";

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export class ProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessingError";
  }
}

/** Parses and validates; on bad output asks the model once more, then gives up. */
async function completeValidated<T>(
  llm: LlmProvider,
  request: { model: string; system: string; user: string },
  schema: z.ZodType<T>,
): Promise<T> {
  let lastProblem = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      attempt === 0
        ? request.user
        : `${request.user}\n\nYour previous reply was not valid (${lastProblem}). Reply again with only the JSON object in the required shape.`;
    const raw = await llm.completeJson({ ...request, user });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      lastProblem = "not parseable JSON";
      continue;
    }
    const result = schema.safeParse(parsed);
    if (result.success) return result.data;
    lastProblem = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
  }
  throw new ProcessingError(`Model output failed validation twice: ${lastProblem}`);
}

export type ProcessedSession = {
  summary: string;
  themes: string[];
  posts: { platform?: string; title?: string; body: string; sourceExcerpt: string }[];
  scripts: { title?: string; body: string; sourceExcerpt: string }[];
  newsletter: { title: string; body: string } | null;
  ideas: string[];
  memories: SessionResult["memories"];
  droppedUngrounded: number;
};

export function formatScript(script: SessionResult["scripts"][number]): string {
  const beats = script.beats.map((beat, i) => `${i + 1}. ${beat}`).join("\n");
  return `Hook: ${script.hook}\n\n${beats}\n\nClose: ${script.close}`;
}

/** Applies caps, the grounding check and the sensitive-session rule. */
export function finalizeResult(
  result: SessionResult,
  transcript: string,
  sensitive: boolean,
): ProcessedSession {
  const speech = userSpeech(transcript);
  let dropped = 0;
  const posts = sensitive
    ? []
    : result.posts.filter((p) => {
        const ok = isGroundedExcerpt(p.source_excerpt, speech);
        if (!ok) dropped++;
        return ok;
      });
  const scripts = sensitive
    ? []
    : result.scripts.filter((s) => {
        const ok = isGroundedExcerpt(s.source_excerpt, speech);
        if (!ok) dropped++;
        return ok;
      });
  return {
    summary: result.session_summary,
    themes: result.themes.slice(0, LIMITS.themes),
    posts: posts.slice(0, LIMITS.posts).map((p) => ({
      platform: p.platform,
      title: p.title,
      body: p.body,
      sourceExcerpt: p.source_excerpt,
    })),
    scripts: scripts.slice(0, LIMITS.scripts).map((s) => ({
      title: s.title,
      body: formatScript(s),
      sourceExcerpt: s.source_excerpt,
    })),
    newsletter: sensitive ? null : (result.newsletter ?? null),
    ideas: result.ideas.slice(0, LIMITS.ideas),
    memories: result.memories.slice(0, LIMITS.memories),
    droppedUngrounded: dropped,
  };
}

export async function processTranscript(
  llm: LlmProvider,
  args: { model: string; transcript: string; durationSeconds?: number; sensitive: boolean },
): Promise<ProcessedSession> {
  const transcript = args.transcript.trim();
  if (transcript.length === 0) throw new ProcessingError("Empty transcript");
  const sensitiveNote = args.sensitive ? SENSITIVE_NOTE : "";

  let finalInput: string;
  if (isLongSession(transcript, args.durationSeconds)) {
    const chunks = chunkTranscript(transcript);
    const parts: string[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const notes = await completeValidated(
        llm,
        {
          model: args.model,
          system: CHUNK_SYSTEM_PROMPT,
          user: `Part ${index + 1} of ${chunks.length}:\n\n${chunk}`,
        },
        chunkNotesSchema,
      );
      const quotes = notes.quotes.map((q) => `> ${q}`).join("\n");
      parts.push(`## Part ${index + 1}\n${notes.notes}\n\nUser quotes (verbatim):\n${quotes}`);
    }
    finalInput =
      "This was a long session, condensed part by part below. Source excerpts must be copied from the verbatim user quotes.\n\n" +
      parts.join("\n\n");
  } else {
    finalInput = `Transcript:\n\n${transcript}`;
  }

  const result = await completeValidated(
    llm,
    { model: args.model, system: FINAL_SYSTEM_PROMPT + sensitiveNote, user: finalInput },
    sessionResultSchema,
  );
  return finalizeResult(result, transcript, args.sensitive);
}
