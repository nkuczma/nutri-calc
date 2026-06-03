import { createClient } from "@/lib/supabase/server";
import {
  fetchNutrients,
  NutritionApiError,
  type IngredientNutrients,
  type NutrientValue,
} from "@/lib/nutrition";
import type { Ingredient } from "@/lib/schemas/ingredient";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    ingredients,
    weights,
  }: { ingredients: Ingredient[]; weights?: (number | "missing")[] } =
    await req.json();

  if (ingredients.length === 0) {
    return Response.json({ nutrients: null });
  }

  let results: IngredientNutrients[];
  try {
    results = await Promise.all(
      ingredients.map((i, idx) => {
        const w = weights?.[idx];
        const weightGrams = typeof w === "number" ? w : undefined;
        return fetchNutrients(i.name, weightGrams);
      }),
    );
  } catch (err) {
    const message =
      err instanceof NutritionApiError ? err.message : "Nutrition fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }

  const keys = Object.keys(results[0]) as (keyof IngredientNutrients)[];
  const aggregated = Object.fromEntries(
    keys.map((key) => {
      const values = results.map((r) => r[key]);
      const total: NutrientValue = values.some((v) => v === "missing")
        ? "missing"
        : (values as number[]).reduce((sum, v) => sum + v, 0);
      return [key, total];
    }),
  ) as unknown as IngredientNutrients;

  return Response.json({ nutrients: aggregated });
}
