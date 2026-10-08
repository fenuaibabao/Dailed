import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  MEMORY_LIMIT,
  RECENT_SUMMARY_LIMIT,
  type PromptMemory,
  type PromptSummary,
} from "./sessionPrompt";

/** The user's top non-sensitive memories for this app, most important first. */
export async function selectPromptMemories(
  ctx: QueryCtx,
  userId: Id<"users">,
  appId: Id<"apps">,
  limit = MEMORY_LIMIT,
): Promise<PromptMemory[]> {
  const rows = await ctx.db
    .query("memories")
    .withIndex("by_user_app_sensitive_importance", (q) =>
      q.eq("userId", userId).eq("appId", appId).eq("sensitive", false),
    )
    .order("desc")
    .take(limit);
  return rows.map(({ kind, content, importance }) => ({ kind, content, importance }));
}

/** Summaries of the user's last few non-sensitive sessions in this app. */
export async function selectRecentSummaries(
  ctx: QueryCtx,
  userId: Id<"users">,
  appId: Id<"apps">,
  timezone: string,
  limit = RECENT_SUMMARY_LIMIT,
): Promise<PromptSummary[]> {
  const found: PromptSummary[] = [];
  const summaries = ctx.db
    .query("outputs")
    .withIndex("by_user_kind", (q) => q.eq("userId", userId).eq("kind", "session_summary"))
    .order("desc");
  for await (const output of summaries) {
    const call = await ctx.db.get(output.callId);
    if (call === null || call.sensitive || call.appId !== appId) continue;
    found.push({
      date: formatDate(call.startedAt ?? call._creationTime, timezone),
      summary: output.body,
    });
    if (found.length >= limit) break;
  }
  return found;
}

function formatDate(ms: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeZone: timezone,
    }).format(ms);
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}
