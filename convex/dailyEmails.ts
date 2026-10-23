import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { alertEmail, summaryEmail, type Email } from "./lib/dailyEmail";

// Emails the family: a summary after each answered call and alerts right away
// (docs/PRIMER.md, "The family summary" and "Alerts"). Off by default:
// - DAILY_EMAILS_ENABLED=1 turns sending on.
// - RESEND_API_KEY and DAILY_EMAIL_FROM (e.g. "Daily <daily@yourdomain.com>",
//   a domain verified in Resend) are needed to send.
// Until then everything still shows on the family dashboard, and nothing is
// marked as sent.

export const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";

type Recipient = { email: string; isOwner: boolean };

async function familyFor(
  ctx: QueryCtx,
  circleId: Id<"careCircles">,
  want: "getsSummaries" | "getsAlerts",
): Promise<{ recipients: Recipient[]; ownerName: string; parent: Doc<"careRecipients"> | null }> {
  const circle = await ctx.db.get(circleId);
  const owner = circle ? await ctx.db.get(circle.ownerId) : null;
  const members = await ctx.db
    .query("circleMembers")
    .withIndex("by_circle", (q) => q.eq("circleId", circleId))
    .collect();
  const parent = await ctx.db
    .query("careRecipients")
    .withIndex("by_circle", (q) => q.eq("circleId", circleId))
    .first();
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  for (const m of members) {
    const email = m.email.trim().toLowerCase();
    if (!m[want] || email === "" || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ email, isOwner: m.role === "owner" });
  }
  return { recipients, ownerName: owner?.name ?? "", parent };
}

export type Outgoing = { to: string; email: Email };

/** The emails for one alert, one per family member, or null if it's already sent or gone. */
export const loadAlertEmails = internalQuery({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, { alertId }): Promise<Outgoing[] | null> => {
    const alert = await ctx.db.get(alertId);
    if (alert === null || alert.sentAt !== undefined) return null;
    const { recipients, ownerName, parent } = await familyFor(ctx, alert.circleId, "getsAlerts");
    if (parent === null) return null;
    const siteUrl = process.env.SITE_URL ?? null;
    return recipients.map((r) => ({
      to: r.email,
      email: alertEmail(
        { parentName: parent.name, kind: alert.kind, message: alert.message },
        { ownerName, isOwner: r.isOwner, siteUrl },
      ),
    }));
  },
});

/** The emails for one call summary, one per family member, or null if it's already sent or gone. */
export const loadSummaryEmails = internalQuery({
  args: { summaryId: v.id("callSummaries") },
  handler: async (ctx, { summaryId }): Promise<Outgoing[] | null> => {
    const summary = await ctx.db.get(summaryId);
    if (summary === null || summary.emailedAt !== undefined) return null;
    const { recipients, ownerName, parent } = await familyFor(ctx, summary.circleId, "getsSummaries");
    if (parent === null) return null;
    const siteUrl = process.env.SITE_URL ?? null;
    return recipients.map((r) => ({
      to: r.email,
      email: summaryEmail(
        {
          parentName: parent.name,
          timezone: parent.timezone,
          at: summary.at,
          durationSeconds: summary.durationSeconds ?? null,
          mood: summary.mood ?? null,
          highlights: summary.highlights,
          checkIns: summary.checkIns,
          passOn: summary.passOn ?? null,
        },
        { ownerName, isOwner: r.isOwner, siteUrl },
      ),
    }));
  },
});

export const markAlertSent = internalMutation({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, { alertId }) => {
    const alert = await ctx.db.get(alertId);
    if (alert !== null && alert.sentAt === undefined) await ctx.db.patch(alertId, { sentAt: Date.now() });
  },
});

export const markSummarySent = internalMutation({
  args: { summaryId: v.id("callSummaries") },
  handler: async (ctx, { summaryId }) => {
    const summary = await ctx.db.get(summaryId);
    if (summary !== null && summary.emailedAt === undefined) await ctx.db.patch(summaryId, { emailedAt: Date.now() });
  },
});

function emailConfig() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DAILY_EMAIL_FROM;
  if (process.env.DAILY_EMAILS_ENABLED !== "1" || !key || !from) return null;
  return { key, from };
}

/**
 * Sends a batch through Resend. The idempotency key makes a retried send a
 * no-op on Resend's side. Returns true when Resend accepted it.
 */
async function send(outgoing: Outgoing[], idempotencyKey: string): Promise<boolean> {
  const config = emailConfig();
  if (config === null || outgoing.length === 0) return false;
  try {
    const response = await fetch(RESEND_BATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(
        outgoing.map((o) => ({ from: config.from, to: [o.to], subject: o.email.subject, html: o.email.html, text: o.email.text })),
      ),
    });
    if (!response.ok) {
      // Log the status only: the body can echo addresses.
      console.error(`Daily emails: Resend refused a batch (${response.status}).`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Daily emails: couldn't reach Resend: ${error instanceof Error ? error.message : ""}`);
    return false;
  }
}

/** Emails one alert to the family. Scheduled when the alert is created. */
export const sendAlert = internalAction({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, { alertId }) => {
    if (emailConfig() === null) return;
    const outgoing = await ctx.runQuery(internal.dailyEmails.loadAlertEmails, { alertId });
    if (outgoing === null || outgoing.length === 0) return;
    if (await send(outgoing, `daily-alert-${alertId}`)) {
      await ctx.runMutation(internal.dailyEmails.markAlertSent, { alertId });
    }
  },
});

/** Emails one call summary to the family. Scheduled when the summary is saved. */
export const sendSummary = internalAction({
  args: { summaryId: v.id("callSummaries") },
  handler: async (ctx, { summaryId }) => {
    if (emailConfig() === null) return;
    const outgoing = await ctx.runQuery(internal.dailyEmails.loadSummaryEmails, { summaryId });
    if (outgoing === null || outgoing.length === 0) return;
    if (await send(outgoing, `daily-summary-${summaryId}`)) {
      await ctx.runMutation(internal.dailyEmails.markSummarySent, { summaryId });
    }
  },
});
