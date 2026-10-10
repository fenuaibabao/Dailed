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
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

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
    sensitive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_app", ["userId", "appId"])
    .index("by_vapi_call_id", ["vapiCallId"])
    .index("by_status", ["status"]),

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
});
