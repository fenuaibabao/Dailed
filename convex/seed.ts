import type { Infer } from "convex/values";
import { internalMutation } from "./_generated/server";
import { APPS } from "../src/config/brand";
import type { outputKind } from "./schema";
import {
  REMI_FIRST_MESSAGE,
  REMI_MAX_CALL_SECONDS,
  REMI_NAME,
  REMI_SYSTEM_PROMPT,
} from "./lib/remi";

type OutputTemplate = {
  kind: Infer<typeof outputKind>;
  label: string;
  instructions: string;
  maxCount: number;
};

const CREATE_OUTPUT_TEMPLATES: OutputTemplate[] = [
  {
    kind: "session_summary",
    label: "Session summary",
    instructions: "A bird's-eye summary of the session in 5 to 8 sentences.",
    maxCount: 1,
  },
  {
    kind: "theme",
    label: "Themes",
    instructions: "3 to 5 big-picture through-lines across what they said.",
    maxCount: 5,
  },
  {
    kind: "post",
    label: "Posts",
    instructions:
      "Short social posts, each built on something specific the user said, with the source excerpt.",
    maxCount: 5,
  },
  {
    kind: "script",
    label: "Short-video scripts",
    instructions: "Hook, 3 beats, close. Under 60 seconds spoken.",
    maxCount: 2,
  },
  {
    kind: "newsletter",
    label: "Newsletter",
    instructions: "Only when the session has enough material for one.",
    maxCount: 1,
  },
  {
    kind: "idea",
    label: "Ideas",
    instructions: "Seeds for future sessions.",
    maxCount: 10,
  },
];

/**
 * Idempotent: upserts the Create app by slug and Remi by (app, name).
 * Run with `npx convex run seed:run`. Internal, so browsers can't call it.
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const assistantId = process.env.REMI_ASSISTANT_ID;
    if (assistantId === undefined || assistantId.trim() === "") {
      throw new Error(
        "REMI_ASSISTANT_ID is not set on this Convex deployment. Run `npx convex env set REMI_ASSISTANT_ID <id>` first.",
      );
    }

    const appFields = {
      slug: APPS.create.slug,
      name: APPS.create.name,
      outputTemplates: CREATE_OUTPUT_TEMPLATES,
    };
    const existingApp = await ctx.db
      .query("apps")
      .withIndex("by_slug", (q) => q.eq("slug", appFields.slug))
      .unique();
    const appId =
      existingApp?._id ?? (await ctx.db.insert("apps", appFields));
    if (existingApp !== null) {
      await ctx.db.patch(appId, appFields);
    }

    const personaFields = {
      appId,
      name: REMI_NAME,
      vapiAssistantId: assistantId.trim(),
      llmProvider: "openai" as const,
      llmModel: "gpt-4.1-mini",
      systemPrompt: REMI_SYSTEM_PROMPT,
      firstMessage: REMI_FIRST_MESSAGE,
      maxCallSeconds: REMI_MAX_CALL_SECONDS,
      isSensitive: false,
    };
    const existingPersona = await ctx.db
      .query("personas")
      .withIndex("by_app_name", (q) =>
        q.eq("appId", appId).eq("name", REMI_NAME),
      )
      .unique();
    const personaId =
      existingPersona?._id ?? (await ctx.db.insert("personas", personaFields));
    if (existingPersona !== null) {
      await ctx.db.patch(personaId, personaFields);
    }

    await ctx.db.patch(appId, { defaultPersonaId: personaId });
    return { appId, personaId };
  },
});
