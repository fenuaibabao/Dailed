import { expect, test } from "@playwright/test";
import { watchForMicAndVapi } from "./helpers";

// Needs a real Convex deployment with this code pushed (`npx convex dev`) and
// NEXT_PUBLIC_CONVEX_URL pointing at it. Set E2E_LIVE_CONVEX=1 to run.
test.skip(!process.env.E2E_LIVE_CONVEX, "needs a live Convex deployment");

const password = "correct1horse";

function uniqueEmail() {
  return `e2e+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signUp(page: import("@playwright/test").Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Test Creator");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("sign up lands on /app/session and the session survives reloads and protected navigation", async ({ page }) => {
  const watch = await watchForMicAndVapi(page);
  await signUp(page, uniqueEmail());
  await expect(page).toHaveURL(/\/app\/session$/);
  await expect(page.getByTestId("session-heading")).toHaveText("Welcome, Test Creator");

  // The bug in the previous build: a full page load bounced back to sign-in.
  await page.reload();
  await expect(page).toHaveURL(/\/app\/session$/);
  await page.goto("/app/session");
  await expect(page).toHaveURL(/\/app\/session$/);

  // Signed-in users are sent away from the auth pages.
  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/app\/session$/);

  expect(await watch.micRequests()).toBe(0);
  expect(watch.vapiRequests).toEqual([]);
});

test("sign out, then sign back in", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page).toHaveURL(/\/app\/session$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/app/session");
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/session$/);
});

test("duplicate sign-up says the account exists and links to sign in", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page).toHaveURL(/\/app\/session$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await signUp(page, email);
  await expect(page.getByRole("alert")).toContainText("already exists");
  await expect(page.getByRole("alert").getByRole("link", { name: "Sign in instead" })).toBeVisible();
});

test("sign-in with an unknown email offers sign-up", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("couldn't find an account");
  await page.getByRole("alert").getByRole("link", { name: "Create an account instead" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
});

test("double-clicking submit sends one sign-up request", async ({ page }) => {
  const signInCalls: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/api/auth") && r.method() === "POST") signInCalls.push(r.url());
  });
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Test Creator");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).dblclick();
  await expect(page).toHaveURL(/\/app\/session$/);
  expect(signInCalls).toHaveLength(1);
});
