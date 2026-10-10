// Plain-language labels for audit log entries.

type Details = Record<string, string | number | boolean | null> | null;

const RETENTION = (days: unknown) => (typeof days === "number" ? `${days} days` : "keep everything");
const ON_OFF = (on: unknown) => (on ? "on" : "off");

export function describeActivity(action: string, details: Details): string {
  const d = details ?? {};
  switch (action) {
    case "org.create":
      return "Created the workspace";
    case "org.rename":
      return "Renamed the workspace";
    case "org.join":
      return "Joined the workspace";
    case "org.role_change":
      return `Role changed from ${d.from} to ${d.to}`;
    case "org.member_remove":
      return "Removed from the workspace";
    case "org.leave":
      return "Left the workspace";
    case "org.phi_mode":
      return `Health-data mode turned ${ON_OFF(d.on)}`;
    case "org.invite_reset":
      return "Invite code replaced";
    case "org.retention":
    case "user.retention":
      return `Keep sessions: ${RETENTION(d.days)}`;
    case "org.redaction":
    case "user.redaction":
      return `Hide numbers and emails in transcripts: ${ON_OFF(d.on)}`;
    case "data.export":
      return "Downloaded a copy of the data";
    case "session.delete":
      return "Deleted a session";
    case "retention.purge":
      return `Deleted ${d.sessions} expired ${d.sessions === 1 ? "session" : "sessions"}`;
    default:
      return action;
  }
}

export function formatWhen(ms: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(ms);
}

export const RETENTION_OPTIONS = [
  { value: "", label: "Keep everything" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
] as const;
