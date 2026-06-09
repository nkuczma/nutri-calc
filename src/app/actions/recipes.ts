"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  nutrientsToIngredientColumns,
  totalsToRecipeColumns,
} from "@/lib/db/recipes";
import {
  fetchNutrients,
  aggregateNutrients,
  type IngredientNutrients,
} from "@/lib/nutrition";
import { convertToGrams } from "@/lib/unit-conversion";
import type { Ingredient } from "@/lib/schemas/ingredient";

export async function saveRecipe(
  title: string,
  ingredients: Ingredient[],
  perIngredientNutrients: (IngredientNutrients | null)[],
  totals: IngredientNutrients | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const p_totals = totals ? totalsToRecipeColumns(totals) : {};
  const p_ingredients = ingredients.map((ing, i) => ({
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    ...(perIngredientNutrients[i]
      ? nutrientsToIngredientColumns(perIngredientNutrients[i]!)
      : {}),
  }));

  const { error: rpcError } = await supabase.rpc("save_recipe", {
    p_user_id: user.id,
    p_title: title,
    p_raw_text: null,
    p_totals,
    p_ingredients,
  });

  if (rpcError) return { error: rpcError.message };

  return {};
}

export async function updateRecipe(
  recipeId: string,
  title: string,
  ingredients: Ingredient[],
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Step 1: normalize units to grams for each ingredient
  const weights: (number | "missing")[] = await Promise.all(
    ingredients.map((ing) => convertToGrams(ing.name, ing.quantity, ing.unit)),
  );

  // Step 2: fetch nutrients per ingredient; failures become all-missing, never throw
  const allMissing: IngredientNutrients = {
    energy: "missing",
    protein: "missing",
    fat: "missing",
    saturatedFat: "missing",
    carbs: "missing",
    fiber: "missing",
    sugars: "missing",
    salt: "missing",
    sodium: "missing",
  };
  const perIngredient: IngredientNutrients[] = await Promise.all(
    ingredients.map(async (ing, i) => {
      const w = weights[i];
      const weightGrams = w === "missing" ? undefined : w;
      try {
        return await fetchNutrients(ing.name, weightGrams);
      } catch {
        return allMissing;
      }
    }),
  );

  // Step 3: aggregate totals — sum numerics, "missing" if any ingredient is missing for that field
  const totals = aggregateNutrients(perIngredient);

  // Step 4: convert to DB column shapes
  const p_totals = totalsToRecipeColumns(totals);
  const p_ingredients = ingredients.map((ing, i) => ({
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    ...nutrientsToIngredientColumns(perIngredient[i]),
  }));

  // Step 5: call the update_recipe RPC
  const { error: rpcError } = await supabase.rpc("update_recipe", {
    p_user_id: user.id,
    p_recipe_id: recipeId,
    p_title: title,
    p_totals,
    p_ingredients,
  });

  if (rpcError) return { error: rpcError.message };

  return {};
}

export async function deleteRecipe(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  redirect("/recipes");
}
