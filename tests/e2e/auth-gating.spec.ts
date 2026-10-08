import { expect, test } from "@playwright/test";
import { hasNoHorizontalScroll, watchForMicAndVapi } from "./helpers";

// These run against the built app without a live Convex backend.

test("signed-out visits to /app pages redirect to sign-in", async ({ page }) => {
  for (const path of ["/app", "/app/session", "/app/anything"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
});

test("/apple-style paths are not treated as protected", async ({ page }) => {
  const response = await page.goto("/appendix");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL(/\/appendix$/);
});

test("sign-up shows inline errors for every bad field and doesn't submit", async ({ page }) => {
  const authCalls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/auth")) authCalls.push(r.url());
  });
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText(/Enter a valid email address/)).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  expect(authCalls).toEqual([]);
});

test("sign-in links to sign-up and back", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

for (const path of ["/", "/sign-in", "/sign-up"]) {
  test(`${path} never loads Vapi or asks for the microphone, and fits the viewport`, async ({ page }) => {
    const watch = await watchForMicAndVapi(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await watch.micRequests()).toBe(0);
    expect(watch.vapiRequests).toEqual([]);
    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });
}
