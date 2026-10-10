import { expect, test } from "@playwright/test";
import { hasNoHorizontalScroll, watchForMicAndVapi } from "./helpers";

// These run against the built app without a live Convex backend.

test("signed-out visits to /app pages redirect to sign-in", async ({ page }) => {
  for (const path of ["/app", "/app/session", "/app/workspaces", "/app/privacy", "/app/anything"]) {
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
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText(/Enter a valid email address/)).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  expect(authCalls).toEqual([]);
});

for (const path of ["/sign-in", "/sign-up"]) {
  test(`${path} password fields have a show/hide toggle that doesn't submit`, async ({ page }) => {
    const authCalls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/auth")) authCalls.push(r.url());
    });
    await page.goto(path);
    const fields = path === "/sign-up" ? ["Password", "Confirm password"] : ["Password"];
    await expect(page.getByRole("button", { name: "Show password" })).toHaveCount(fields.length);

    for (const label of fields) {
      const input = page.getByLabel(label, { exact: true });
      await input.fill("secret123");
      await expect(input).toHaveAttribute("type", "password");

      const toggle = page.locator(`button[aria-controls="${await input.getAttribute("id")}"]`);
      await expect(toggle).toHaveAttribute("type", "button");
      await expect(toggle).toHaveAccessibleName("Show password");
      await expect(toggle.locator("[data-icon=eye]")).toHaveCount(1);

      await toggle.click();
      await expect(input).toHaveAttribute("type", "text");
      await expect(input).toHaveValue("secret123");
      await expect(toggle).toHaveAccessibleName("Hide password");
      await expect(toggle.locator("[data-icon=eye-off]")).toHaveCount(1);

      // Keyboard: focus the toggle and press Enter, then Space.
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(input).toHaveAttribute("type", "password");
      await page.keyboard.press("Space");
      await expect(input).toHaveAttribute("type", "text");
      await page.keyboard.press("Space");
      await expect(input).toHaveAttribute("type", "password");
    }
    expect(authCalls).toEqual([]);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  });
}

test("sign-up flags mismatched passwords on blur and keeps submit disabled until they match", async ({ page }) => {
  await page.goto("/sign-up");
  const submit = page.getByRole("button", { name: "Create account" });
  const confirm = page.getByLabel("Confirm password");

  await page.getByLabel("Password", { exact: true }).fill("correct1horse");
  await confirm.fill("correct1hors");
  await expect(page.getByText("Passwords don't match.")).toHaveCount(0);
  await expect(submit).toBeDisabled();

  await confirm.blur();
  await expect(page.getByText("Passwords don't match.")).toBeVisible();
  await expect(confirm).toHaveAttribute("aria-invalid", "true");
  await expect(confirm).toHaveAttribute("aria-describedby", "confirm-password-error");

  await confirm.fill("correct1horse");
  await expect(page.getByText("Passwords don't match.")).toHaveCount(0);
  await expect(submit).toBeEnabled();
});

test("sign-up sends only the first password, never the confirmation", async ({ page }) => {
  const bodies: string[] = [];
  await page.route("**/api/auth", async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({ status: 500, body: "stubbed" });
  });
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Test Creator");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password", { exact: true }).fill("correct1horse");
  await page.getByLabel("Confirm password").fill("correct1horse");
  await page.getByRole("button", { name: "Create account" }).click();

  // The stubbed failure surfaces as the existing form-level error.
  await expect(page.getByText("Something went wrong on our side.")).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toContain("correct1horse");
  expect(bodies[0].split("correct1horse")).toHaveLength(2);
  expect(bodies[0]).not.toMatch(/confirm/i);
});

test("sign-in links to sign-up and back", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("each enabled product has a landing page whose Start talking carries the product to sign-up", async ({ page }) => {
  await page.goto("/clarity");
  await expect(page.getByText("Warpwork Clarity")).toBeVisible();
  await page.getByRole("link", { name: "Start talking" }).click();
  await expect(page).toHaveURL(/\/sign-up\?product=clarity$/);
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in\?product=clarity$/);
});

test("the home page is Create, and products that aren't ready say coming soon", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Warpwork Create")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start talking" })).toHaveAttribute("href", "/sign-up?product=create");
  await page.goto("/founder");
  await expect(page.getByTestId("coming-soon")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start talking" })).toHaveCount(0);
  expect((await page.goto("/not-a-product"))?.status()).toBe(404);
});

test("signed-out visitors to a product's session page keep the product through sign-in", async ({ page }) => {
  await page.goto("/app/session?product=clarity");
  await expect(page).toHaveURL(/\/sign-in\?product=clarity$/);
});

for (const path of ["/", "/clarity", "/sign-in", "/sign-up"]) {
  test(`${path} never loads Vapi or asks for the microphone, and fits the viewport`, async ({ page }) => {
    const watch = await watchForMicAndVapi(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await watch.micRequests()).toBe(0);
    expect(watch.vapiRequests).toEqual([]);
    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });
}
