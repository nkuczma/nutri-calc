'use server';

import type { Ingredient } from '@/lib/schemas/ingredient';
import type { IngredientNutrients } from '@/lib/nutrition';

// Phase 1 stub — full implementation in Phase 2
export async function saveRecipe(
  /* eslint-disable @typescript-eslint/no-unused-vars */
  title: string,
  ingredients: Ingredient[],
  perIngredientNutrients: (IngredientNutrients | null)[],
  totals: IngredientNutrients | null,
  /* eslint-enable @typescript-eslint/no-unused-vars */
): Promise<{ error?: string }> {
  return {};
}
