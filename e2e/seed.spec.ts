import { test, expect } from "@playwright/test";

const NUTRIENT_FIXTURE = {
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
};

test("saved recipe persists in list after navigation — Risk #3 recipe data loss", async ({
  page,
}) => {
  const title = `Seed Recipe ${Date.now()}`;

  await page.route("**/api/normalize-units", (route) =>
    route.fulfill({ json: { weights: [100] } }),
  );
  await page.route("**/api/nutrition-summary", (route) =>
    route.fulfill({ json: NUTRIENT_FIXTURE }),
  );

  await page.goto("/recipes/new");

  await page.getByLabel("Recipe title").fill(title);

  await page.getByLabel("Ingredient").fill("chicken breast");

  await page
    .getByRole("button", { name: "Get nutritional summary" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Nutritional summary" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save recipe" }).click();

  await page.waitForURL("/");
  await expect(page.getByText(title)).toBeVisible();

  // Register before navigation — window.confirm fires synchronously on click
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByText(title).click();
  await page.getByRole("button", { name: "Delete recipe" }).click();
  await page.waitForURL("/");
  await expect(page.getByText(title)).not.toBeVisible();
});
