import type { Database } from "@/lib/database.types";
import type { IngredientNutrients } from "@/lib/nutrition";

type IngredientRow = Database["public"]["Tables"]["recipe_ingredients"]["Row"];
type IngredientInsert = Database["public"]["Tables"]["recipe_ingredients"]["Insert"];
type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"];
type RecipeInsert = Database["public"]["Tables"]["recipes"]["Insert"];

export type NutrientInsertColumns = Pick<
  IngredientInsert,
  "energy" | "protein" | "fat" | "saturated_fat" | "carbs" | "fiber" | "sugars" | "salt" | "sodium"
>;

export type TotalInsertColumns = Pick<
  RecipeInsert,
  | "total_energy" | "total_protein" | "total_fat" | "total_saturated_fat"
  | "total_carbs" | "total_fiber" | "total_sugars" | "total_salt" | "total_sodium"
>;

function nullToMissing(v: number | null): number | "missing" {
  return v === null ? "missing" : v;
}

function missingToNull(v: number | "missing"): number | null {
  return v === "missing" ? null : v;
}

export function ingredientRowToNutrients(row: IngredientRow): IngredientNutrients {
  return {
    energy:       nullToMissing(row.energy),
    protein:      nullToMissing(row.protein),
    fat:          nullToMissing(row.fat),
    saturatedFat: nullToMissing(row.saturated_fat),
    carbs:        nullToMissing(row.carbs),
    fiber:        nullToMissing(row.fiber),
    sugars:       nullToMissing(row.sugars),
    salt:         nullToMissing(row.salt),
    sodium:       nullToMissing(row.sodium),
  };
}

export function nutrientsToIngredientColumns(nutrients: IngredientNutrients): NutrientInsertColumns {
  return {
    energy:        missingToNull(nutrients.energy),
    protein:       missingToNull(nutrients.protein),
    fat:           missingToNull(nutrients.fat),
    saturated_fat: missingToNull(nutrients.saturatedFat),
    carbs:         missingToNull(nutrients.carbs),
    fiber:         missingToNull(nutrients.fiber),
    sugars:        missingToNull(nutrients.sugars),
    salt:          missingToNull(nutrients.salt),
    sodium:        missingToNull(nutrients.sodium),
  };
}

export function recipeRowToTotals(row: RecipeRow): IngredientNutrients {
  return {
    energy:       nullToMissing(row.total_energy),
    protein:      nullToMissing(row.total_protein),
    fat:          nullToMissing(row.total_fat),
    saturatedFat: nullToMissing(row.total_saturated_fat),
    carbs:        nullToMissing(row.total_carbs),
    fiber:        nullToMissing(row.total_fiber),
    sugars:       nullToMissing(row.total_sugars),
    salt:         nullToMissing(row.total_salt),
    sodium:       nullToMissing(row.total_sodium),
  };
}

export function totalsToRecipeColumns(totals: IngredientNutrients): TotalInsertColumns {
  return {
    total_energy:        missingToNull(totals.energy),
    total_protein:       missingToNull(totals.protein),
    total_fat:           missingToNull(totals.fat),
    total_saturated_fat: missingToNull(totals.saturatedFat),
    total_carbs:         missingToNull(totals.carbs),
    total_fiber:         missingToNull(totals.fiber),
    total_sugars:        missingToNull(totals.sugars),
    total_salt:          missingToNull(totals.salt),
    total_sodium:        missingToNull(totals.sodium),
  };
}
