import { z } from 'zod';

export const ingredientSchema = z.object({
  name: z.string().min(1).describe('Ingredient name, e.g. "chicken breast"'),
  quantity: z.number().positive().describe('Numeric amount, e.g. 2. Default to 1 if not stated.'),
  unit: z.string().describe('Unit of measure, e.g. "cups", "g", "tbsp". Empty string if not stated.'),
});

// Permissive variant used only for AI SDK streaming — partial objects during
// streaming may temporarily violate domain constraints. filterValidIngredients
// enforces domain validity before any nutrition API call fires.
const streamingIngredientSchema = z.object({
  name: z.string().describe('Ingredient name, e.g. "chicken breast"'),
  quantity: z.number().describe('Numeric amount, e.g. 2. Default to 1 if not stated.'),
  unit: z.string().describe('Unit of measure, e.g. "cups", "g", "tbsp". Empty string if not stated.'),
});

export const parseResultSchema = z.object({
  ingredients: z.array(streamingIngredientSchema),
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type ParseResult = z.infer<typeof parseResultSchema>;

/** Drop rows that would produce wrong or meaningless nutrition results. */
export function filterValidIngredients(rows: Ingredient[]): Ingredient[] {
  return rows.filter(r => r.name.trim().length > 0 && r.quantity > 0);
}
