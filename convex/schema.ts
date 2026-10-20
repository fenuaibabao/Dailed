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
  // Founder
  v.literal("investor_update"),
  v.literal("decision"),
  v.literal("pitch"),
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
  v.literal("daily.setup"),
  v.literal("daily.pause"),
  v.literal("daily.call_placed"),
  v.literal("daily.consent"),
  v.literal("daily.alert"),
);

// Why the family is being told something right away.
export const alertKind = v.union(
  v.literal("no_answer_twice"), // two calls in a row went unanswered
  v.literal("concern"), // the parent said something worrying (a fall, pain, "help")
  v.literal("declined"), // the parent said no to the calls on the first call
  v.literal("unclear"), // the first call ended without a clear yes; calls are paused
  v.literal("stopped"), // the parent asked Remi to stop calling
);

export const checkItem = v.union(v.literal("meds"), v.literal("sleep"), v.literal("meals"));

// Whether the parent has agreed to Daily calls. Only the parent can say yes,
// on the first call; the adult child can't consent for them.
export const callConsent = v.union(
  v.literal("not_asked"),
  v.literal("granted"),
  v.literal("declined"),
  v.literal("revoked"),
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
    // Daily phone calls only. The row belongs to the adult child who set Daily
    // up, but the words are the parent's: their transcript stays out of the
    // child's session list and data export.
    recipientId: v.optional(v.id("careRecipients")),
    localDate: v.optional(v.string()), // "YYYY-MM-DD" in the parent's timezone
    attempt: v.optional(v.number()), // 1 = first try that day, 2 = the retry
    isConsentCall: v.optional(v.boolean()), // opened by asking the parent's permission
    dialedE164: v.optional(v.string()), // the number called; a yes only counts for that number
  })
    .index("by_user", ["userId"])
    .index("by_user_app", ["userId", "appId"])
    .index("by_vapi_call_id", ["vapiCallId"])
    .index("by_status", ["status"])
    .index("by_org", ["orgId"])
    .index("by_recipient_date", ["recipientId", "localDate"]),

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

  // Daily: a family group around one parent. The adult child who set it up
  // owns it. One circle per owner for now.
  careCircles: defineTable({
    ownerId: v.id("users"),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // The parent Daily calls. Phone numbers are E.164.
  careRecipients: defineTable({
    circleId: v.id("careCircles"),
    name: v.string(), // what Remi calls them, e.g. "Mom" or "Margaret"
    phoneE164: v.string(),
    timezone: v.string(), // IANA name
    callConsent,
    talkAbout: v.array(v.string()),
    avoid: v.array(v.string()),
    checkItems: v.array(checkItem), // asked naturally, recorded as self-reported
    emergencyContact: v.object({ name: v.string(), phoneE164: v.string() }),
    updatedAt: v.number(),
  }).index("by_circle", ["circleId"]),

  // Who gets the summary after each call and the alerts. The owner always
  // does; other family members are added by email and need no account.
  circleMembers: defineTable({
    circleId: v.id("careCircles"),
    userId: v.optional(v.id("users")),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("member")),
    getsSummaries: v.boolean(),
    getsAlerts: v.boolean(),
  }).index("by_circle", ["circleId"]),

  // When to call: a window in the parent's own timezone, within 8am to 9pm.
  checkInSchedules: defineTable({
    circleId: v.id("careCircles"),
    recipientId: v.id("careRecipients"),
    daysOfWeek: v.array(v.number()), // 0 = Sunday
    windowStart: v.string(), // "HH:mm"
    windowEnd: v.string(), // "HH:mm"
    paused: v.boolean(),
  })
    .index("by_circle", ["circleId"])
    .index("by_recipient", ["recipientId"])
    .index("by_paused", ["paused"]),

  // The parent's own answer about the calls, as heard on a call. Never
  // deleted: it's the proof a call was allowed (or the record that it wasn't).
  callConsentRecords: defineTable({
    recipientId: v.id("careRecipients"),
    circleId: v.id("careCircles"),
    phoneE164: v.string(), // consent belongs to whoever answers this number
    decision: v.union(v.literal("granted"), v.literal("declined"), v.literal("revoked")),
    consentText: v.string(), // what Remi said when asking
    parentWords: v.optional(v.string()), // the parent's answer, from the transcript
    callId: v.id("calls"),
    at: v.number(),
  }).index("by_recipient", ["recipientId"]),

  // What the family sees after each answered call. Everything the parent said
  // is reported as they said it. Anything they asked to keep private is left out.
  callSummaries: defineTable({
    callId: v.id("calls"),
    circleId: v.id("careCircles"),
    recipientId: v.id("careRecipients"),
    at: v.number(), // when the call was placed
    durationSeconds: v.optional(v.number()),
    mood: v.optional(v.string()),
    highlights: v.array(v.string()),
    checkIns: v.array(v.string()),
    passOn: v.optional(v.string()),
  })
    .index("by_call", ["callId"])
    .index("by_circle", ["circleId"]),

  // Things the family should hear about right away. Emailed once email is
  // set up; until then they show on the dashboard. sentAt marks delivery.
  alerts: defineTable({
    circleId: v.id("careCircles"),
    recipientId: v.id("careRecipients"),
    callId: v.optional(v.id("calls")),
    kind: alertKind,
    message: v.string(),
    at: v.number(),
    sentAt: v.optional(v.number()),
  }).index("by_circle", ["circleId"]),

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
