'use server';

import { createClient } from '@/lib/supabase/server';
import { nutrientsToIngredientColumns, totalsToRecipeColumns } from '@/lib/db/recipes';
import type { Ingredient } from '@/lib/schemas/ingredient';
import type { IngredientNutrients } from '@/lib/nutrition';

export async function saveRecipe(
  title: string,
  ingredients: Ingredient[],
  perIngredientNutrients: (IngredientNutrients | null)[],
  totals: IngredientNutrients | null,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: recipeRows, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      title,
      raw_text: null,
      ...(totals ? totalsToRecipeColumns(totals) : {}),
    })
    .select('id')
    .single();

  if (recipeError) return { error: recipeError.message };

  const ingredientInserts = ingredients.map((ing, i) => ({
    recipe_id: recipeRows.id,
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    ...(perIngredientNutrients[i] ? nutrientsToIngredientColumns(perIngredientNutrients[i]!) : {}),
  }));

  const { error: ingredientsError } = await supabase
    .from('recipe_ingredients')
    .insert(ingredientInserts);

  if (ingredientsError) return { error: ingredientsError.message };

  return {};
}
