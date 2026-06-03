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

  const p_totals = totals ? totalsToRecipeColumns(totals) : {};
  const p_ingredients = ingredients.map((ing, i) => ({
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    ...(perIngredientNutrients[i] ? nutrientsToIngredientColumns(perIngredientNutrients[i]!) : {}),
  }));

  const { error: rpcError } = await supabase.rpc('save_recipe', {
    p_user_id: user.id,
    p_title: title,
    p_raw_text: null,
    p_totals,
    p_ingredients,
  });

  if (rpcError) return { error: rpcError.message };

  return {};
}
