import { ASSISTANT_NAME, BRAND_NAME } from "../../src/config/brand";
import { PRODUCTS } from "../../src/config/products";
import { describeDuration, formatCallTime } from "../../src/lib/dailyDashboard";

// The emails Daily sends the family: a summary after each answered call and
// an alert when something needs attention. Pure, so the wording is tested
// without sending anything. Never includes the transcript.

export type Email = { subject: string; text: string; html: string };

export type SummaryEmailInput = {
  parentName: string;
  timezone: string;
  at: number;
  durationSeconds: number | null;
  mood: string | null;
  highlights: string[];
  checkIns: string[];
  passOn: string | null;
};

export type EmailContext = {
  /** Who set Daily up; named in the footer so other family members know why they get this. */
  ownerName: string;
  /** True for the person who set it up: their footer links to the settings. */
  isOwner: boolean;
  /** The app's address, for the dashboard link. */
  siteUrl: string | null;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dashboardUrl(siteUrl: string | null): string | null {
  return siteUrl ? `${siteUrl.replace(/\/+$/, "")}/app/daily` : null;
}

function footer(parentName: string, ctx: EmailContext): string[] {
  const lines = [PRODUCTS.daily.disclaimer ?? ""];
  const url = dashboardUrl(ctx.siteUrl);
  if (ctx.isOwner) {
    lines.push(url ? `See every call and change who gets these emails: ${url}` : "Change who gets these emails on your Daily page.");
  } else {
    const who = ctx.ownerName.trim() || "A family member";
    lines.push(`${who} added you to ${BRAND_NAME} Daily for ${parentName}. To stop getting these, ask them to remove you.`);
  }
  return lines.filter((l) => l !== "");
}

/** Plain text and simple HTML from the same sections, so both say exactly the same thing. */
function render(subject: string, intro: string, sections: { label: string; body: string }[], foot: string[]): Email {
  const text = [
    intro,
    "",
    ...sections.flatMap((s) => [`${s.label}:`, s.body, ""]),
    "—",
    ...foot,
  ].join("\n");
  const p = (body: string, style = "") => `<p style="margin:0 0 16px;${style}">${escapeHtml(body)}</p>`;
  const html = [
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:17px;line-height:1.55;color:#1d1d1b;max-width:560px">`,
    p(intro),
    ...sections.map(
      (s) =>
        `<p style="margin:0 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#6b6a65">${escapeHtml(s.label)}</p>` +
        p(s.body),
    ),
    `<hr style="border:none;border-top:1px solid #e3e1db;margin:24px 0 16px">`,
    ...foot.map((line) => p(line, "font-size:14px;color:#6b6a65")),
    `</div>`,
  ].join("");
  return { subject, text, html };
}

export function summaryEmail(input: SummaryEmailInput, ctx: EmailContext): Email {
  const name = input.parentName;
  const when = formatCallTime(input.at, input.timezone);
  const talk = [`${name} talked with ${ASSISTANT_NAME} for ${describeDuration(input.durationSeconds)}.`];
  if (input.mood) talk.push(`Sounded ${input.mood}.`);
  const sections = [{ label: "The call", body: talk.join(" ") }];
  if (input.highlights.length > 0) sections.push({ label: "Highlights", body: input.highlights.join(" ") });
  if (input.checkIns.length > 0) sections.push({ label: `${name} said`, body: input.checkIns.join(" ") });
  if (input.passOn) sections.push({ label: "Passing on", body: input.passOn });
  return render(
    input.passOn ? `${name} has a message for you` : `Today's call with ${name}`,
    `Here's how ${ASSISTANT_NAME}'s call with ${name} went (${when}). What ${name} says about medicine, sleep or meals is passed on as they said it.`,
    sections,
    footer(name, ctx),
  );
}

export type AlertEmailInput = {
  parentName: string;
  kind: "no_answer_twice" | "concern" | "declined" | "unclear" | "stopped";
  message: string;
};

const ALERT_SUBJECT: Record<AlertEmailInput["kind"], (name: string) => string> = {
  concern: (name) => `Please check in with ${name}`,
  no_answer_twice: (name) => `${name} missed two calls`,
  declined: (name) => `${name} said no to Daily calls`,
  unclear: (name) => `Daily calls to ${name} are paused`,
  stopped: (name) => `${name} asked to stop Daily calls`,
};

export function alertEmail(input: AlertEmailInput, ctx: EmailContext): Email {
  const sections =
    input.kind === "concern"
      ? [{ label: "If it's an emergency", body: `Call 911. ${ASSISTANT_NAME} can't send help and doesn't watch over ${input.parentName}'s health.` }]
      : [];
  return render(ALERT_SUBJECT[input.kind](input.parentName), input.message, sections, footer(input.parentName, ctx));
}
