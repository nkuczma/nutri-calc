// Risk #1 (browser layer) — missing nutrient renders as "—" not "0"
// Proves that NutritionalSummary.tsx correctly displays the missing indicator
// for a nutrient absent from the API response, never a silent zero.
//
// The unit tests in src/__tests__/lib/ cover the mapping logic; this test
// covers the rendered output — the only layer that can catch a UI regression
// where the component renders 0 instead of "—".
//
// Boundary: /api/normalize-units and /api/nutrition-summary are mocked
// (they call external services). NutritionalSummary receives the mocked
// nutrients and renders; no DB write in this test.

import { test, expect } from "@playwright/test";

test("missing nutrient renders as — not 0 in the nutritional summary", async ({
  page,
}) => {
  // /api/nutrition-summary returns a response with sugars: "missing"
  // and sodium: "missing" (two non-macro absent fields)
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
          sodium: "missing",
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
            sodium: "missing",
          },
        ],
      },
    }),
  );

  await page.goto("/recipes/new");

  await page.getByLabel("Ingredient name 1").fill("chicken breast");

  await page
    .getByRole("button", { name: "Get nutritional summary" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Nutritional summary" }),
  ).toBeVisible();

  // Locate the Sugars row and assert the cell shows "—", not a number
  const sugarsRow = page.getByRole("row", { name: /Sugars/i });
  await expect(sugarsRow).toBeVisible();
  // The missing indicator is rendered as "—" in a <span class="text-gray-400">
  // Assert it contains the dash and NOT a numeric value
  await expect(sugarsRow).toContainText("—");
  await expect(sugarsRow).not.toContainText("0");

  // Same for Sodium
  const sodiumRow = page.getByRole("row", { name: /Sodium/i });
  await expect(sodiumRow).toContainText("—");
  await expect(sodiumRow).not.toContainText("0");

  // Numeric fields render their value, confirming the component is not broken overall
  const proteinRow = page.getByRole("row", { name: /Protein/i });
  await expect(proteinRow).toContainText("31");
});
