import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { DEFAULT_PRODUCT, SEEDED_PRODUCTS, type ProductConfig } from "../src/config/products";
import { DAILY_BASE_PROMPT, DAILY_MAX_CALL_SECONDS, dailyOpening } from "./lib/dailyPrompt";
import { REMI_NAME, remiFirstMessage, remiSystemPrompt } from "./lib/remi";

/** Upserts one product's app row (by slug) and its Remi persona (by app and name). */
async function seedProduct(ctx: MutationCtx, product: ProductConfig, assistantId: string) {
  const appFields = { slug: product.slug, name: product.name, outputTemplates: product.outputs };
  const existingApp = await ctx.db
    .query("apps")
    .withIndex("by_slug", (q) => q.eq("slug", product.slug))
    .unique();
  const appId = existingApp?._id ?? (await ctx.db.insert("apps", appFields));
  if (existingApp !== null) await ctx.db.patch(appId, appFields);

  const personaFields = {
    appId,
    name: REMI_NAME,
    vapiAssistantId: assistantId,
    llmProvider: "openai" as const,
    llmModel: "gpt-4.1-mini",
    // Daily calls build their prompt and opening per call (convex/dailyCalls.ts);
    // these stored copies are the base they start from.
    systemPrompt: product.slug === "daily" ? DAILY_BASE_PROMPT : remiSystemPrompt(product),
    firstMessage: product.slug === "daily" ? dailyOpening("there") : remiFirstMessage(product),
    maxCallSeconds: product.slug === "daily" ? DAILY_MAX_CALL_SECONDS : product.maxSessionSeconds,
    isSensitive: false,
  };
  const existingPersona = await ctx.db
    .query("personas")
    .withIndex("by_app_name", (q) => q.eq("appId", appId).eq("name", REMI_NAME))
    .unique();
  const personaId = existingPersona?._id ?? (await ctx.db.insert("personas", personaFields));
  if (existingPersona !== null) await ctx.db.patch(personaId, personaFields);

  await ctx.db.patch(appId, { defaultPersonaId: personaId });
  return { appId, personaId };
}

/**
 * Idempotent: upserts an app and a Remi persona for every enabled product in
 * src/config/products.ts, plus Daily, which runs scheduled test calls before launch. Production deploys run it automatically. Products
 * that get disabled keep their rows (and their users' sessions); start()
 * refuses them. Returns the default product's ids.
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
    let defaultIds: { appId: Id<"apps">; personaId: Id<"personas"> } | null = null;
    for (const product of SEEDED_PRODUCTS) {
      const ids = await seedProduct(ctx, product, assistantId.trim());
      if (product.slug === DEFAULT_PRODUCT) defaultIds = ids;
    }
    if (defaultIds === null) throw new Error(`The default product "${DEFAULT_PRODUCT}" must be enabled.`);
    return defaultIds;
  },
});
