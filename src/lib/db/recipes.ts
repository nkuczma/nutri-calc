import type { Database } from "@/lib/database.types";
import type { IngredientNutrients } from "@/lib/nutrition";

type IngredientRow = Database["public"]["Tables"]["recipe_ingredients"]["Row"];
type IngredientInsert = Database["public"]["Tables"]["recipe_ingredients"]["Insert"];
type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"];
type RecipeInsert = Database["public"]["Tables"]["recipes"]["Insert"];

export type NutrientInsertColumns = Pick<
  IngredientInsert,
  | "energy" | "protein" | "fat" | "carbs" | "fiber" | "sodium"
  | "calcium" | "iron" | "vitamin_c" | "vitamin_d" | "zinc" | "potassium"
  | "vitamin_b12" | "folate" | "magnesium" | "phosphorus"
>;

export type TotalInsertColumns = Pick<
  RecipeInsert,
  | "total_energy" | "total_protein" | "total_fat" | "total_carbs" | "total_fiber" | "total_sodium"
  | "total_calcium" | "total_iron" | "total_vitamin_c" | "total_vitamin_d" | "total_zinc" | "total_potassium"
  | "total_vitamin_b12" | "total_folate" | "total_magnesium" | "total_phosphorus"
>;

function nullToMissing(v: number | null): number | "missing" {
  return v === null ? "missing" : v;
}

function missingToNull(v: number | "missing"): number | null {
  return v === "missing" ? null : v;
}

export function ingredientRowToNutrients(row: IngredientRow): IngredientNutrients {
  return {
    energy:     nullToMissing(row.energy),
    protein:    nullToMissing(row.protein),
    fat:        nullToMissing(row.fat),
    carbs:      nullToMissing(row.carbs),
    fiber:      nullToMissing(row.fiber),
    sodium:     nullToMissing(row.sodium),
    calcium:    nullToMissing(row.calcium),
    iron:       nullToMissing(row.iron),
    vitaminC:   nullToMissing(row.vitamin_c),
    vitaminD:   nullToMissing(row.vitamin_d),
    zinc:       nullToMissing(row.zinc),
    potassium:  nullToMissing(row.potassium),
    vitaminB12: nullToMissing(row.vitamin_b12),
    folate:     nullToMissing(row.folate),
    magnesium:  nullToMissing(row.magnesium),
    phosphorus: nullToMissing(row.phosphorus),
  };
}

export function nutrientsToIngredientColumns(nutrients: IngredientNutrients): NutrientInsertColumns {
  return {
    energy:     missingToNull(nutrients.energy),
    protein:    missingToNull(nutrients.protein),
    fat:        missingToNull(nutrients.fat),
    carbs:      missingToNull(nutrients.carbs),
    fiber:      missingToNull(nutrients.fiber),
    sodium:     missingToNull(nutrients.sodium),
    calcium:    missingToNull(nutrients.calcium),
    iron:       missingToNull(nutrients.iron),
    vitamin_c:  missingToNull(nutrients.vitaminC),
    vitamin_d:  missingToNull(nutrients.vitaminD),
    zinc:       missingToNull(nutrients.zinc),
    potassium:  missingToNull(nutrients.potassium),
    vitamin_b12: missingToNull(nutrients.vitaminB12),
    folate:     missingToNull(nutrients.folate),
    magnesium:  missingToNull(nutrients.magnesium),
    phosphorus: missingToNull(nutrients.phosphorus),
  };
}

export function recipeRowToTotals(row: RecipeRow): IngredientNutrients {
  return {
    energy:     nullToMissing(row.total_energy),
    protein:    nullToMissing(row.total_protein),
    fat:        nullToMissing(row.total_fat),
    carbs:      nullToMissing(row.total_carbs),
    fiber:      nullToMissing(row.total_fiber),
    sodium:     nullToMissing(row.total_sodium),
    calcium:    nullToMissing(row.total_calcium),
    iron:       nullToMissing(row.total_iron),
    vitaminC:   nullToMissing(row.total_vitamin_c),
    vitaminD:   nullToMissing(row.total_vitamin_d),
    zinc:       nullToMissing(row.total_zinc),
    potassium:  nullToMissing(row.total_potassium),
    vitaminB12: nullToMissing(row.total_vitamin_b12),
    folate:     nullToMissing(row.total_folate),
    magnesium:  nullToMissing(row.total_magnesium),
    phosphorus: nullToMissing(row.total_phosphorus),
  };
}

export function totalsToRecipeColumns(totals: IngredientNutrients): TotalInsertColumns {
  return {
    total_energy:     missingToNull(totals.energy),
    total_protein:    missingToNull(totals.protein),
    total_fat:        missingToNull(totals.fat),
    total_carbs:      missingToNull(totals.carbs),
    total_fiber:      missingToNull(totals.fiber),
    total_sodium:     missingToNull(totals.sodium),
    total_calcium:    missingToNull(totals.calcium),
    total_iron:       missingToNull(totals.iron),
    total_vitamin_c:  missingToNull(totals.vitaminC),
    total_vitamin_d:  missingToNull(totals.vitaminD),
    total_zinc:       missingToNull(totals.zinc),
    total_potassium:  missingToNull(totals.potassium),
    total_vitamin_b12: missingToNull(totals.vitaminB12),
    total_folate:     missingToNull(totals.folate),
    total_magnesium:  missingToNull(totals.magnesium),
    total_phosphorus: missingToNull(totals.phosphorus),
  };
}
