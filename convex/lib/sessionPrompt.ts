import type { Doc } from "../_generated/dataModel";

export type SessionMode = Doc<"calls">["mode"];

export const SESSION_MODES = {
  quick: {
    maxDurationSeconds: 600,
    promptSuffix: "This is a quick session of about 10 minutes.",
  },
  deep: {
    maxDurationSeconds: 5400,
    promptSuffix: "This is a deep session; the user has set aside up to 90 minutes.",
  },
  open: {
    maxDurationSeconds: 5400,
    promptSuffix:
      "The user didn't pick a length. Early on, ask how much time they have today (anything from 10 to 90 minutes) and pace the session to it.",
  },
} as const satisfies Record<SessionMode, { maxDurationSeconds: number; promptSuffix: string }>;

export const MEMORY_LIMIT = 15;
export const RECENT_SUMMARY_LIMIT = 3;
export const FOCUS_MAX_LENGTH = 280;

export type PromptMemory = Pick<Doc<"memories">, "kind" | "content" | "importance">;
export type PromptSummary = { date: string; summary: string };

const MEMORY_KIND_LABEL: Record<PromptMemory["kind"], string> = {
  fact: "Fact",
  goal: "Goal",
  open_thread: "Open thread",
  idea: "Idea",
  theme: "Theme",
};

/**
 * Persona prompt + one mode suffix line + a memory block + optional focus,
 * in that order.
 */
export function buildSessionPrompt(args: {
  basePrompt: string;
  mode: SessionMode;
  memories: PromptMemory[];
  recentSummaries: PromptSummary[];
  focus?: string;
}): string {
  const parts = [args.basePrompt.trimEnd(), SESSION_MODES[args.mode].promptSuffix];

  const memoryLines = args.memories.map(
    (m) => `- ${MEMORY_KIND_LABEL[m.kind]}: ${m.content}`,
  );
  const summaryLines = args.recentSummaries.map((s) => `- ${s.date}: ${s.summary}`);
  if (memoryLines.length > 0 || summaryLines.length > 0) {
    const block = [
      "What you remember about this person from earlier sessions. Use it to pick up threads and avoid repeating questions. Don't recite it back to them.",
    ];
    if (memoryLines.length > 0) block.push("Memories:", ...memoryLines);
    if (summaryLines.length > 0) block.push("Recent sessions:", ...summaryLines);
    parts.push(block.join("\n"));
  } else {
    parts.push("This is your first session with this person.");
  }

  const focus = args.focus?.trim();
  if (focus) parts.push(`Today's focus: ${focus}`);

  return parts.join("\n\n");
}
