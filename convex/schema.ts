import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const outputKind = v.union(
  v.literal("session_summary"),
  v.literal("theme"),
  v.literal("post"),
  v.literal("script"),
  v.literal("newsletter"),
  v.literal("idea"),
);

// "open" is the single Start talking session: Remi asks how much time they
// have. "quick" and "deep" remain for sessions started before that.
export const callMode = v.union(v.literal("quick"), v.literal("deep"), v.literal("open"));

export const callStatus = v.union(
  v.literal("queued"),
  v.literal("connecting"),
  v.literal("in_session"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("missed"),
  v.literal("failed"),
);

export const memoryKind = v.union(
  v.literal("fact"),
  v.literal("goal"),
  v.literal("open_thread"),
  v.literal("idea"),
  v.literal("theme"),
);

export const orgRole = v.union(v.literal("owner"), v.literal("admin"), v.literal("member"));

export const auditAction = v.union(
  v.literal("org.create"),
  v.literal("org.rename"),
  v.literal("org.join"),
  v.literal("org.role_change"),
  v.literal("org.member_remove"),
  v.literal("org.leave"),
  v.literal("org.phi_mode"),
  v.literal("org.invite_reset"),
  v.literal("org.retention"),
  v.literal("org.redaction"),
  v.literal("user.retention"),
  v.literal("user.redaction"),
  v.literal("data.export"),
  v.literal("session.delete"),
  v.literal("retention.purge"),
);

export const llmProvider = v.union(
  v.literal("openai"),
  v.literal("anthropic"),
  v.literal("xai"),
);

export default defineSchema({
  ...authTables,

  // Replaces authTables.users: keeps Convex Auth's fields and adds ours.
  // Creation time is the built-in _creationTime.
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    phoneE164: v.optional(v.string()),
    timezone: v.optional(v.string()), // IANA name, captured at sign-up
    dateOfBirth: v.optional(v.string()), // YYYY-MM-DD
    activeOrgId: v.optional(v.id("orgs")), // the workspace new sessions belong to; none = personal
    retentionDays: v.optional(v.number()), // delete session content after this many days; none = keep
    redactTranscripts: v.optional(v.boolean()), // hide emails, phone and ID numbers in transcripts
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_retention", ["retentionDays"]),

  // Proof of opt-in. Never deleted, including on account deletion.
  consents: defineTable({
    userId: v.id("users"),
    kind: v.union(
      v.literal("recording"),
      v.literal("ai_calls"),
      v.literal("open_mode_18plus"),
    ),
    consentText: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    grantedAt: v.number(),
    revokedAt: v.optional(v.number()),
  }).index("by_user_kind", ["userId", "kind"]),

  apps: defineTable({
    slug: v.string(), // "create" now; "coach", "daily", ... later as data
    name: v.string(),
    defaultPersonaId: v.optional(v.id("personas")),
    outputTemplates: v.array(
      v.object({
        kind: outputKind,
        label: v.string(),
        instructions: v.string(),
        maxCount: v.number(),
      }),
    ),
  }).index("by_slug", ["slug"]),

  personas: defineTable({
    appId: v.id("apps"),
    name: v.string(),
    vapiAssistantId: v.string(),
    llmProvider,
    llmModel: v.string(),
    voiceId: v.optional(v.string()),
    systemPrompt: v.string(),
    firstMessage: v.string(),
    maxCallSeconds: v.number(),
    isSensitive: v.boolean(),
  }).index("by_app_name", ["appId", "name"]),

  // Milestone 5. Table only for now.
  subscriptions: defineTable({
    userId: v.id("users"),
    appId: v.id("apps"),
    plan: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("past_due"),
      v.literal("paused"),
      v.literal("canceled"),
    ),
    minutesIncluded: v.number(),
    periodStart: v.number(),
    periodEnd: v.number(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  })
    .index("by_user_app", ["userId", "appId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),

  // Milestone 6. Table only for now.
  schedules: defineTable({
    userId: v.id("users"),
    appId: v.id("apps"),
    cadence: v.union(v.literal("daily"), v.literal("weekly")),
    daysOfWeek: v.array(v.number()), // 0 = Sunday
    localTime: v.string(), // "HH:mm" in the user's timezone
    nextCallAt: v.number(), // UTC ms
    active: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_active_next", ["active", "nextCallAt"]),

  calls: defineTable({
    userId: v.id("users"),
    orgId: v.optional(v.id("orgs")), // the workspace the session ran in; none = personal
    appId: v.id("apps"),
    personaId: v.id("personas"),
    mode: callMode,
    channel: v.union(v.literal("web"), v.literal("phone")),
    status: callStatus,
    focus: v.optional(v.string()),
    vapiCallId: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    transcript: v.optional(v.string()),
    recordingUrl: v.optional(v.string()),
    endReason: v.optional(v.string()),
    reportReceivedAt: v.optional(v.number()), // set once by the Vapi webhook
    processingError: v.optional(v.string()),
    // What the quote check did to this session's posts and scripts.
    grounding: v.optional(
      v.object({
        drafts: v.number(),
        quotesKept: v.number(),
        quotesFixed: v.number(),
        quotesDropped: v.number(),
      }),
    ),
    noDraftsReason: v.optional(v.string()), // set when a long enough session got no post or no script
    wovenAt: v.optional(v.number()), // set once the session has been grouped into Weaves
    purgedAt: v.optional(v.number()), // content deleted (retention or by the user); the row stays as a record
    sensitive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_app", ["userId", "appId"])
    .index("by_vapi_call_id", ["vapiCallId"])
    .index("by_status", ["status"])
    .index("by_org", ["orgId"]),

  memories: defineTable({
    userId: v.id("users"),
    appId: v.id("apps"),
    callId: v.optional(v.id("calls")),
    kind: memoryKind,
    content: v.string(),
    importance: v.number(), // 1–5
    sensitive: v.boolean(),
  })
    .index("by_user_app_sensitive_importance", [
      "userId",
      "appId",
      "sensitive",
      "importance",
    ])
    .index("by_call", ["callId"]),

  outputs: defineTable({
    callId: v.id("calls"),
    userId: v.id("users"),
    kind: outputKind,
    platform: v.optional(v.string()),
    title: v.optional(v.string()),
    body: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("exported"),
    ),
    sourceExcerpt: v.optional(v.string()),
  })
    .index("by_call", ["callId"])
    .index("by_user_kind", ["userId", "kind"])
    .index("by_user_status", ["userId", "status"]),

  // Weaves: ongoing topics that come up across a person's sessions in one
  // product, like "Launching the podcast". Grouped automatically after each
  // session. Sensitive sessions only join sensitive weaves.
  weaves: defineTable({
    userId: v.id("users"),
    appId: v.id("apps"),
    title: v.string(),
    summary: v.string(),
    sessionCount: v.number(),
    lastCallId: v.id("calls"),
    updatedAt: v.number(),
    sensitive: v.boolean(),
  })
    .index("by_user_app_updated", ["userId", "appId", "updatedAt"])
    .index("by_user_app_sensitive_updated", ["userId", "appId", "sensitive", "updatedAt"]),

  // Which sessions belong to which weave, with what each session added.
  weaveLinks: defineTable({
    weaveId: v.id("weaves"),
    callId: v.id("calls"),
    userId: v.id("users"),
    note: v.string(),
  })
    .index("by_weave", ["weaveId"])
    .index("by_call", ["callId"]),

  // Workspaces for teams (a company, a clinic). Personal use needs none.
  orgs: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    // Health-data mode: stricter handling for protected health information.
    // Sessions are blocked until every vendor in the path is covered by a BAA
    // (see convex/lib/phi.ts).
    phiMode: v.boolean(),
    inviteCode: v.string(), // shared by admins; joining needs no email
    retentionDays: v.optional(v.number()), // applies to sessions in this workspace; the stricter limit wins
    redactTranscripts: v.optional(v.boolean()), // always on while phiMode is on
  })
    .index("by_invite_code", ["inviteCode"])
    .index("by_retention", ["retentionDays"]),

  memberships: defineTable({
    orgId: v.id("orgs"),
    userId: v.id("users"),
    role: orgRole,
    joinedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"]),

  // Append-only record of who did what. Never holds session content.
  // Nothing updates or deletes these rows.
  auditLog: defineTable({
    action: auditAction,
    actorId: v.optional(v.id("users")), // none = the system (e.g. retention)
    userId: v.optional(v.id("users")), // whose account or data it concerns
    orgId: v.optional(v.id("orgs")),
    targetId: v.optional(v.string()),
    details: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))),
    at: v.number(),
  })
    .index("by_org_at", ["orgId", "at"])
    .index("by_user_at", ["userId", "at"]),
});
