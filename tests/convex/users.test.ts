import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newTest, signedInAs } from "./helpers";

test("viewer returns only the signed-in user's own profile", async () => {
  const t = newTest();
  const ada = await signedInAs(t, "Ada");
  const grace = await signedInAs(t, "Grace");

  expect(await ada.client.query(api.users.viewer, {})).toMatchObject({
    _id: ada.userId,
    name: "Ada",
  });
  expect(await grace.client.query(api.users.viewer, {})).toMatchObject({
    _id: grace.userId,
    name: "Grace",
  });
});
