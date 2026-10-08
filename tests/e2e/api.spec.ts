import { expect, test } from "@playwright/test";

test("the Vapi webhook rejects requests without the shared secret", async ({ request }) => {
  const response = await request.post("/api/vapi/webhook", {
    data: { message: { type: "end-of-call-report", call: { id: "x" } } },
  });
  expect(response.status()).toBe(401);
  const wrong = await request.post("/api/vapi/webhook", {
    headers: { "x-vapi-secret": "wrong" },
    data: { message: { type: "end-of-call-report" } },
  });
  expect(wrong.status()).toBe(401);
});

test("the public Vapi config needs a signed-in user", async ({ request }) => {
  const response = await request.get("/api/vapi/public-config");
  expect(response.status()).toBe(401);
  expect(await response.text()).not.toContain("publicKey");
});
