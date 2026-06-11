import { test, expect } from "@playwright/test";

test("is authenticated", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const url = page.url();
  console.log("landed on:", url);

  // If redirected to sign-in, auth failed
  expect(url).not.toContain("/sign-in");

  // Confirm something user-specific is visible
  await expect(page.locator("body")).not.toContainText("Sign in");
});
