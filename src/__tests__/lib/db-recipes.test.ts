import { describe, it, expect } from "vitest";
import {
  ingredientRowToNutrients,
  nutrientsToIngredientColumns,
  recipeRowToTotals,
  totalsToRecipeColumns,
} from "@/lib/db/recipes";
import type { Database } from "@/lib/database.types";

type IngredientRow = Database["public"]["Tables"]["recipe_ingredients"]["Row"];
type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"];

const baseIngredientRow: IngredientRow = {
  id: "ing-1",
  recipe_id: "rec-1",
  name: "chicken breast",
  quantity: 100,
  unit: "g",
  created_at: "2024-01-01T00:00:00Z",
  energy: null,
  protein: null,
  fat: null,
  saturated_fat: null,
  carbs: null,
  fiber: null,
  sugars: null,
  salt: null,
  sodium: null,
};

const baseRecipeRow: RecipeRow = {
  id: "rec-1",
  user_id: "user-1",
  title: "Test Recipe",
  raw_text: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
  total_energy: null,
  total_protein: null,
  total_fat: null,
  total_saturated_fat: null,
  total_carbs: null,
  total_fiber: null,
  total_sugars: null,
  total_salt: null,
  total_sodium: null,
};

describe("ingredientRowToNutrients", () => {
  it('maps all null fields to "missing"', () => {
    const result = ingredientRowToNutrients(baseIngredientRow);
    expect(result.energy).toBe("missing");
    expect(result.protein).toBe("missing");
    expect(result.fat).toBe("missing");
    expect(result.saturatedFat).toBe("missing");
    expect(result.carbs).toBe("missing");
    expect(result.fiber).toBe("missing");
    expect(result.sugars).toBe("missing");
    expect(result.salt).toBe("missing");
    expect(result.sodium).toBe("missing");
  });

  it("passes through numeric values unchanged", () => {
    const row: IngredientRow = {
      ...baseIngredientRow,
      energy: 165,
      protein: 31,
      fat: 3.6,
      saturated_fat: 1.1,
      carbs: 0,
      fiber: 0,
      sugars: 0,
      salt: 0.2,
      sodium: 74,
    };
    const result = ingredientRowToNutrients(row);
    expect(result.energy).toBe(165);
    expect(result.protein).toBe(31);
    expect(result.fat).toBe(3.6);
    expect(result.saturatedFat).toBe(1.1);
    expect(result.carbs).toBe(0);
    expect(result.fiber).toBe(0);
    expect(result.sugars).toBe(0);
    expect(result.salt).toBe(0.2);
    expect(result.sodium).toBe(74);
  });

  it("handles mixed null and numeric fields", () => {
    const row: IngredientRow = { ...baseIngredientRow, energy: 165, protein: null };
    const result = ingredientRowToNutrients(row);
    expect(result.energy).toBe(165);
    expect(result.protein).toBe("missing");
  });
});

describe("nutrientsToIngredientColumns", () => {
  it('maps "missing" to null for all fields', () => {
    const result = nutrientsToIngredientColumns({
      energy: "missing",
      protein: "missing",
      fat: "missing",
      saturatedFat: "missing",
      carbs: "missing",
      fiber: "missing",
      sugars: "missing",
      salt: "missing",
      sodium: "missing",
    });
    expect(result.energy).toBeNull();
    expect(result.protein).toBeNull();
    expect(result.fat).toBeNull();
    expect(result.saturated_fat).toBeNull();
    expect(result.carbs).toBeNull();
    expect(result.fiber).toBeNull();
    expect(result.sugars).toBeNull();
    expect(result.salt).toBeNull();
    expect(result.sodium).toBeNull();
  });

  it("passes through numeric values unchanged", () => {
    const result = nutrientsToIngredientColumns({
      energy: 165,
      protein: 31,
      fat: 3.6,
      saturatedFat: 1.1,
      carbs: 0,
      fiber: 0,
      sugars: 0,
      salt: 0.2,
      sodium: 74,
    });
    expect(result.energy).toBe(165);
    expect(result.protein).toBe(31);
    expect(result.fat).toBe(3.6);
    expect(result.saturated_fat).toBe(1.1);
    expect(result.carbs).toBe(0);
    expect(result.sodium).toBe(74);
  });
});

describe("recipeRowToTotals", () => {
  it('maps all null total fields to "missing"', () => {
    const result = recipeRowToTotals(baseRecipeRow);
    expect(result.energy).toBe("missing");
    expect(result.protein).toBe("missing");
    expect(result.fat).toBe("missing");
    expect(result.saturatedFat).toBe("missing");
    expect(result.carbs).toBe("missing");
    expect(result.fiber).toBe("missing");
    expect(result.sugars).toBe("missing");
    expect(result.salt).toBe("missing");
    expect(result.sodium).toBe("missing");
  });

  it("passes through numeric total values unchanged", () => {
    const row: RecipeRow = {
      ...baseRecipeRow,
      total_energy: 330,
      total_protein: 62,
      total_fat: 7.2,
      total_saturated_fat: 2.2,
      total_carbs: 0,
      total_fiber: 0,
      total_sugars: 0,
      total_salt: 0.4,
      total_sodium: 148,
    };
    const result = recipeRowToTotals(row);
    expect(result.energy).toBe(330);
    expect(result.protein).toBe(62);
    expect(result.fat).toBe(7.2);
    expect(result.saturatedFat).toBe(2.2);
    expect(result.sodium).toBe(148);
  });
});

describe("totalsToRecipeColumns", () => {
  it('maps "missing" to null for all total fields', () => {
    const result = totalsToRecipeColumns({
      energy: "missing",
      protein: "missing",
      fat: "missing",
      saturatedFat: "missing",
      carbs: "missing",
      fiber: "missing",
      sugars: "missing",
      salt: "missing",
      sodium: "missing",
    });
    expect(result.total_energy).toBeNull();
    expect(result.total_protein).toBeNull();
    expect(result.total_fat).toBeNull();
    expect(result.total_saturated_fat).toBeNull();
    expect(result.total_carbs).toBeNull();
    expect(result.total_fiber).toBeNull();
    expect(result.total_sugars).toBeNull();
    expect(result.total_salt).toBeNull();
    expect(result.total_sodium).toBeNull();
  });

  it("passes through numeric total values unchanged", () => {
    const result = totalsToRecipeColumns({
      energy: 330,
      protein: 62,
      fat: 7.2,
      saturatedFat: 2.2,
      carbs: 0,
      fiber: 0,
      sugars: 0,
      salt: 0.4,
      sodium: 148,
    });
    expect(result.total_energy).toBe(330);
    expect(result.total_protein).toBe(62);
    expect(result.total_fat).toBe(7.2);
    expect(result.total_saturated_fat).toBe(2.2);
    expect(result.total_sodium).toBe(148);
  });
});
