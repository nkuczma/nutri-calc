import { z } from 'zod';

export const ingredientSchema = z.object({
  name: z.string().describe('Ingredient name, e.g. "chicken breast"'),
  quantity: z.number().describe('Numeric amount, e.g. 2. Default to 1 if not stated.'),
  unit: z.string().describe('Unit of measure, e.g. "cups", "g", "tbsp". Empty string if not stated.'),
});

export const parseResultSchema = z.object({
  ingredients: z.array(ingredientSchema),
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type ParseResult = z.infer<typeof parseResultSchema>;
