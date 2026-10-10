import { z } from "zod";

// Weaves are the ongoing topics in someone's sessions: a project, a question,
// a part of their life that keeps coming back. After each session the model
// sees the person's existing weaves (as short refs, never database ids) plus
// the new session's summary and themes, and says which weaves the session
// belongs to.

/** Weaves a single session can join. */
export const MAX_WEAVES_PER_SESSION = 3;
/** Existing weaves shown to the model, most recently updated first. */
export const MAX_CANDIDATE_WEAVES = 40;

export const WEAVE_SYSTEM_PROMPT = `You keep track of the ongoing topics ("weaves") in one person's interview sessions over time. A weave is a topic, project, question or part of their life that comes up across sessions, like "Launching the podcast" or "Whether to hire a first employee".

You get their existing weaves and the summary and themes of their newest session. Decide which weaves this session belongs to.

Rules:
- Use only what is in the session summary, themes and existing weaves. Never invent facts.
- Prefer an existing weave when the session continues that topic. Start a new weave only for a topic no existing weave covers.
- Return 1 to ${MAX_WEAVES_PER_SESSION} weaves: the topics the session spent real time on. Skip passing mentions.
- Titles are 2 to 6 plain words in the person's own terms, with no dates.
- "summary" is the weave's updated summary in 2 or 3 sentences, second person ("You..."), covering what the existing summary says and what this session added.
- "note" is one sentence on what this session added to the weave.

Return one JSON object:
{ "weaves": [{ "ref": string | null, "title": string, "summary": string, "note": string }] }
"ref" is an existing weave's ref (like "w2"), or null for a new weave.
Return JSON only.`;

export const weaveResultSchema = z.object({
  weaves: z
    .array(
      z.object({
        ref: z.string().trim().nullable().optional(),
        title: z.string().trim().min(1).max(80),
        summary: z.string().trim().min(1).max(1000),
        note: z.string().trim().min(1).max(300),
      }),
    )
    .max(10),
});

export type WeaveResult = z.infer<typeof weaveResultSchema>;

export type CandidateWeave<Id extends string = string> = { id: Id; title: string; summary: string };

export function weaveRef(index: number): string {
  return `w${index + 1}`;
}

/** The user prompt: existing weaves by ref, then the new session. */
export function buildWeaveInput(
  candidates: CandidateWeave[],
  session: { summary: string; themes: string[]; focus?: string | null },
): string {
  const existing =
    candidates.length === 0
      ? "None yet. This is their first woven session."
      : candidates.map((w, i) => `- ${weaveRef(i)}: ${w.title}. ${w.summary}`).join("\n");
  const themes = session.themes.length > 0 ? session.themes.map((t) => `- ${t}`).join("\n") : "- (none)";
  const focus = session.focus ? `\nWhat they said they wanted to focus on: ${session.focus}\n` : "";
  return `Existing weaves:\n${existing}\n\nNewest session summary:\n${session.summary}\n\nNewest session themes:\n${themes}\n${focus}`;
}

export type WeaveAssignment<Id extends string = string> = {
  /** An existing weave to add the session to, or null to start a new one. */
  weaveId: Id | null;
  title: string;
  summary: string;
  note: string;
};

/**
 * Maps the model's refs back to real weaves. A ref that isn't one we sent
 * starts a new weave, a weave named twice is joined once, and the list is
 * capped.
 */
export function resolveAssignments<Id extends string>(
  result: WeaveResult,
  candidates: CandidateWeave<Id>[],
): WeaveAssignment<Id>[] {
  const byRef = new Map(candidates.map((w, i) => [weaveRef(i), w]));
  const seen = new Set<string>();
  const assignments: WeaveAssignment<Id>[] = [];
  for (const item of result.weaves) {
    const existing = item.ref ? byRef.get(item.ref.toLowerCase()) : undefined;
    const key = existing ? `id:${existing.id}` : `title:${item.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    assignments.push({
      weaveId: existing?.id ?? null,
      // An existing weave keeps its name so it stays recognizable.
      title: existing?.title ?? item.title,
      summary: item.summary,
      note: item.note,
    });
    if (assignments.length === MAX_WEAVES_PER_SESSION) break;
  }
  return assignments;
}
