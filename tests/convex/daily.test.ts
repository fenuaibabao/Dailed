import { describe, expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { VALID_DAILY_SETUP } from "../fixtures/dailySetup";
import { newTest, signedInAs } from "./helpers";

describe("Daily family setup", () => {
  test("nothing is set up at first", async () => {
    const t = newTest();
    const { client } = await signedInAs(t);
    expect(await client.query(api.daily.mySetup, {})).toBeNull();
  });

  test("saving stores the parent, schedule and family, cleaned", async () => {
    const t = newTest();
    const { client } = await signedInAs(t);
    await client.mutation(api.daily.saveSetup, VALID_DAILY_SETUP);

    expect(await client.query(api.daily.mySetup, {})).toEqual({
      parentName: "Mom",
      parentPhone: "+15551234567",
      timezone: "America/Chicago",
      callConsent: "not_asked",
      days: [1, 2, 3, 4, 5],
      windowStart: "09:00",
      windowEnd: "10:00",
      paused: false,
      talkAbout: ["the garden", "grandkids"],
      avoid: ["politics"],
      checkItems: ["meds", "sleep"],
      ownerEmail: "ada@example.com",
      familyMembers: [{ name: "Sam", email: "sam@example.com" }],
      emergencyName: "Linda (neighbor)",
      emergencyPhone: "+15559876543",
    });
  });

  test("saving again edits the same setup instead of adding another", async () => {
    const t = newTest();
    const { client } = await signedInAs(t);
    await client.mutation(api.daily.saveSetup, VALID_DAILY_SETUP);
    await client.mutation(api.daily.saveSetup, {
      ...VALID_DAILY_SETUP,
      windowStart: "18:00",
      windowEnd: "19:30",
      familyMembers: [{ name: "Jo", email: "jo@example.com" }],
    });

    const setup = await client.query(api.daily.mySetup, {});
    expect(setup).toMatchObject({ windowStart: "18:00", windowEnd: "19:30" });
    expect(setup?.familyMembers).toEqual([{ name: "Jo", email: "jo@example.com" }]);
    const counts = await t.run(async (ctx) => ({
      circles: (await ctx.db.query("careCircles").collect()).length,
      recipients: (await ctx.db.query("careRecipients").collect()).length,
      schedules: (await ctx.db.query("checkInSchedules").collect()).length,
      owners: (await ctx.db.query("circleMembers").collect()).filter((m) => m.role === "owner").length,
    }));
    expect(counts).toEqual({ circles: 1, recipients: 1, schedules: 1, owners: 1 });
  });

  test("a new phone number means the parent has to be asked again", async () => {
    const t = newTest();
    const { client } = await signedInAs(t);
    await client.mutation(api.daily.saveSetup, VALID_DAILY_SETUP);
    await t.run(async (ctx) => {
      const recipient = (await ctx.db.query("careRecipients").first())!;
      await ctx.db.patch(recipient._id, { callConsent: "granted" });
    });

    await client.mutation(api.daily.saveSetup, { ...VALID_DAILY_SETUP, parentName: "Mother" });
    expect((await client.query(api.daily.mySetup, {}))?.callConsent).toBe("granted");

    await client.mutation(api.daily.saveSetup, { ...VALID_DAILY_SETUP, parentPhone: "555 222 3333" });
    expect((await client.query(api.daily.mySetup, {}))?.callConsent).toBe("not_asked");
  });

  test("the owner's own email isn't added twice", async () => {
    const t = newTest();
    const { client } = await signedInAs(t);
    await client.mutation(api.daily.saveSetup, {
      ...VALID_DAILY_SETUP,
      familyMembers: [{ name: "Me", email: "ada@example.com" }],
    });
    expect((await client.query(api.daily.mySetup, {}))?.familyMembers).toEqual([]);
  });

  test("an invalid setup is refused with the problem fields", async () => {
    const t = newTest();
    const { client } = await signedInAs(t);
    const error = await client
      .mutation(api.daily.saveSetup, { ...VALID_DAILY_SETUP, parentPhone: "12", windowStart: "06:00" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<{ code: string; fields: Record<string, string> }>).data).toMatchObject({
      code: "INVALID_SETUP",
      fields: { parentPhone: expect.any(String), window: expect.any(String) },
    });
    expect(await client.query(api.daily.mySetup, {})).toBeNull();
  });

  test("each person only sees their own setup", async () => {
    const t = newTest();
    const ada = await signedInAs(t, "Ada");
    const bob = await signedInAs(t, "Bob");
    await ada.client.mutation(api.daily.saveSetup, VALID_DAILY_SETUP);
    expect(await bob.client.query(api.daily.mySetup, {})).toBeNull();
  });

  test("saving is logged without the parent's details, and the export includes the setup", async () => {
    const t = newTest();
    const { client, userId } = await signedInAs(t);
    await client.mutation(api.daily.saveSetup, VALID_DAILY_SETUP);
    await client.mutation(api.daily.saveSetup, VALID_DAILY_SETUP);

    const log = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(log.map((e) => [e.action, e.userId, e.details])).toEqual([
      ["daily.setup", userId, { created: true }],
      ["daily.setup", userId, { created: false }],
    ]);

    const exported = await client.mutation(api.privacy.exportMine, {});
    expect(exported.daily).toMatchObject({ parentName: "Mom", parentPhone: "+15551234567" });
  });

  test("calls can be paused and resumed, and that's logged", async () => {
    const t = newTest();
    const { client } = await signedInAs(t);
    await expect(client.mutation(api.daily.setPaused, { paused: true })).rejects.toThrow("NOT_SET_UP");

    await client.mutation(api.daily.saveSetup, VALID_DAILY_SETUP);
    await client.mutation(api.daily.setPaused, { paused: true });
    expect((await client.query(api.daily.mySetup, {}))?.paused).toBe(true);

    // Editing the setup keeps it paused.
    await client.mutation(api.daily.saveSetup, VALID_DAILY_SETUP);
    expect((await client.query(api.daily.mySetup, {}))?.paused).toBe(true);

    await client.mutation(api.daily.setPaused, { paused: true }); // no change, no log entry
    await client.mutation(api.daily.setPaused, { paused: false });
    expect((await client.query(api.daily.mySetup, {}))?.paused).toBe(false);
    const log = await t.run((ctx) => ctx.db.query("auditLog").collect());
    expect(log.filter((e) => e.action === "daily.pause").map((e) => e.details)).toEqual([{ paused: true }, { paused: false }]);
  });
});
