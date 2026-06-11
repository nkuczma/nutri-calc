// Risk #3 — saved recipe persists and appears in /recipes list after navigation
// Proves the full path: ManualEntryFlow → saveRecipe Server Action → Supabase
// write → /recipes SSR page reads it back and renders the title in the list.
//
// This is the browser-level complement to the DB adapter unit tests; it catches
// regressions where the save action succeeds but the list page fails to display
// the entry, or where the Server Action swallows an error silently.
//
// Boundary: /api/normalize-units and /api/nutrition-summary are mocked.
// saveRecipe (Server Action) and the /recipes read run against the real Supabase DB.

import { test, expect } from "@playwright/test";

test("saved recipe appears in recipe list after navigation", async ({
  page,
}) => {
  const title = `E2E Test Recipe ${Date.now()}`;

  await page.route("**/api/normalize-units", (route) =>
    route.fulfill({ json: { weights: [100] } }),
  );
  await page.route("**/api/nutrition-summary", (route) =>
    route.fulfill({
      json: {
        nutrients: {
          energy: 165,
          protein: 31,
          fat: 3.6,
          saturatedFat: 1.0,
          carbs: 0,
          fiber: 0,
          sugars: "missing",
          salt: 0.2,
          sodium: 74,
        },
        perIngredient: [
          {
            energy: 165,
            protein: 31,
            fat: 3.6,
            saturatedFat: 1.0,
            carbs: 0,
            fiber: 0,
            sugars: "missing",
            salt: 0.2,
            sodium: 74,
          },
        ],
      },
    }),
  );

  // --- Setup + action ---
  await page.goto("/recipes/new");

  await page.getByLabel("Recipe title").fill(title);

  await page.getByLabel("Ingredient name 1").fill("chicken breast");

  await page
    .getByRole("button", { name: "Get nutritional summary" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Nutritional summary" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save recipe" }).click();

  // --- Assertion: recipe appears in the list ---
  await page.waitForURL("**/recipes");
  await expect(
    page.getByRole("link", { name: new RegExp(title) }),
  ).toBeVisible();

  // --- Cleanup: open the recipe detail and delete it ---
  // Register the dialog handler before any action — window.confirm fires
  // synchronously on click so the handler must be in place before navigation.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Delete recipe" }).click();
  await page.waitForURL("**/recipes");
  await expect(
    page.getByRole("link", { name: new RegExp(title) }),
  ).not.toBeVisible();
});
