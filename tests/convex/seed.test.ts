import { afterEach, beforeEach, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { REMI_FIRST_MESSAGE, REMI_SYSTEM_PROMPT } from "../../convex/lib/remi";
import { BRAND } from "../../src/config/brand";
import { ENABLED_PRODUCTS, PRODUCTS } from "../../src/config/products";
import { newTest, signedInAs } from "./helpers";

beforeEach(() => {
  process.env.REMI_ASSISTANT_ID = "asst_test_123";
});
afterEach(() => {
  delete process.env.REMI_ASSISTANT_ID;
});

test("seed creates an app and Remi for each enabled product, and running it again changes nothing", async () => {
  const t = newTest();
  const first = await t.mutation(internal.seed.run, {});
  const second = await t.mutation(internal.seed.run, {});
  expect(second).toEqual(first);

  const { apps, personas } = await t.run(async (ctx) => ({
    apps: await ctx.db.query("apps").collect(),
    personas: await ctx.db.query("personas").collect(),
  }));
  expect(apps.map((a) => a.slug).sort()).toEqual(ENABLED_PRODUCTS.map((p) => p.slug).sort());
  expect(personas).toHaveLength(apps.length);
  const create = apps.find((a) => a.slug === "create")!;
  expect(create).toMatchObject({ name: PRODUCTS.create.name, _id: first.appId, defaultPersonaId: first.personaId });
  const clarity = apps.find((a) => a.slug === "clarity")!;
  expect(clarity.outputTemplates.map((o) => o.kind)).not.toContain("post");
  expect(personas.find((p) => p._id === first.personaId)).toMatchObject({
    name: "Remi",
    vapiAssistantId: "asst_test_123",
    maxCallSeconds: 5400,
    isSensitive: false,
    llmProvider: "openai",
    systemPrompt: REMI_SYSTEM_PROMPT,
    firstMessage: REMI_FIRST_MESSAGE,
  });
});

test("re-running the seed picks up a changed assistant id without duplicating", async () => {
  const t = newTest();
  await t.mutation(internal.seed.run, {});
  process.env.REMI_ASSISTANT_ID = "asst_new_456";
  await t.mutation(internal.seed.run, {});
  const personas = await t.run((ctx) => ctx.db.query("personas").collect());
  expect(personas).toHaveLength(ENABLED_PRODUCTS.length);
  expect(personas.every((p) => p.vapiAssistantId === "asst_new_456")).toBe(true);
});

test("seed refuses to run without REMI_ASSISTANT_ID", async () => {
  delete process.env.REMI_ASSISTANT_ID;
  const t = newTest();
  await expect(t.mutation(internal.seed.run, {})).rejects.toThrow("REMI_ASSISTANT_ID");
});

test("Remi's prompt and first message use the brand constant", () => {
  expect(REMI_SYSTEM_PROMPT.startsWith(`You are Remi, ${BRAND.name}'s AI interviewer.`)).toBe(true);
  expect(REMI_FIRST_MESSAGE).toContain(`from ${BRAND.name}.`);
});

test("the default persona query never sends the system prompt to the browser", async () => {
  const t = newTest();
  await t.mutation(internal.seed.run, {});
  const { client } = await signedInAs(t);
  const persona = await client.query(api.personas.getDefaultForApp, { slug: "create" });
  expect(persona).toMatchObject({ name: "Remi", maxCallSeconds: 5400 });
  expect(persona).not.toHaveProperty("systemPrompt");
});
