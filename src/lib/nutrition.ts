export type NutrientValue = number | "missing";

export interface IngredientNutrients {
  // macros
  energy: NutrientValue; // kcal
  protein: NutrientValue; // g
  fat: NutrientValue; // g
  carbs: NutrientValue; // g
  fiber: NutrientValue; // g
  // micros
  sodium: NutrientValue; // mg
  calcium: NutrientValue; // mg
  iron: NutrientValue; // mg
  vitaminC: NutrientValue; // mg
  vitaminD: NutrientValue; // µg
  zinc: NutrientValue; // mg
  potassium: NutrientValue; // mg
  vitaminB12: NutrientValue; // µg
  folate: NutrientValue; // µg
  magnesium: NutrientValue; // mg
  phosphorus: NutrientValue; // mg
}

export class NutritionApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "NutritionApiError";
    this.status = status;
  }
}

interface ApiNutrient {
  nutrient: { id: number; name: string; unitName: string };
  amount: number;
}

interface SearchFood {
  fdcId: number;
  description: string;
  dataType?: string;
}

interface SearchResponse {
  foods?: SearchFood[];
}

interface FoodDetailResponse {
  fdcId: number;
  foodNutrients?: ApiNutrient[];
}

const NUTRIENT_IDS: Record<keyof IngredientNutrients, number> = {
  // macros — standard USDA 1000-series (verified via smoke test; api-docs.md 2000-series were wrong)
  energy: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
  // micros — USDA FDC 1000-series IDs
  sodium: 1093,
  calcium: 1087,
  iron: 1089,
  vitaminC: 1162,
  vitaminD: 1114,
  zinc: 1095,
  potassium: 1092,
  vitaminB12: 1178,
  folate: 1186,
  magnesium: 1090,
  phosphorus: 1091,
};

function resolveNutrient(nutrients: ApiNutrient[], id: number): NutrientValue {
  const found = nutrients.find((n) => n.nutrient.id === id);
  return found !== undefined ? found.amount : "missing";
}

const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";

export async function fetchNutrients(
  ingredientValue: string,
  weightGrams?: number,
): Promise<IngredientNutrients> {
  const apiKey = process.env.NUTRITION_API_KEY;
  if (!apiKey) {
    throw new NutritionApiError("NUTRITION_API_KEY is not set");
  }

  // Step 1: search for the ingredient — fetch up to 5 candidates to survive 404 detail misses.
  const searchUrl = `${FDC_BASE}/foods/search?query=${encodeURIComponent(ingredientValue)}&pageSize=5&api_key=${apiKey}`;
  console.log(searchUrl);
  let searchRes: Response;
  try {
    searchRes = await fetch(searchUrl);
  } catch (err) {
    throw new NutritionApiError(
      `USDA search request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!searchRes.ok) {
    throw new NutritionApiError(
      `USDA search returned ${searchRes.status}`,
      searchRes.status,
    );
  }

  const searchData = (await searchRes.json()) as SearchResponse;
  if (!searchData.foods || searchData.foods.length === 0) {
    const missing = "missing" as const;
    return {
      energy: missing,
      protein: missing,
      fat: missing,
      carbs: missing,
      fiber: missing,
      sodium: missing,
      calcium: missing,
      iron: missing,
      vitaminC: missing,
      vitaminD: missing,
      zinc: missing,
      potassium: missing,
      vitaminB12: missing,
      folate: missing,
      magnesium: missing,
      phosphorus: missing,
    };
  }

  // Step 2: try each candidate until a detail call succeeds (some fdcIds return 404).
  // Prefer SR Legacy (most complete micronutrient data) for stable, consistent results.
  const DATA_TYPE_RANK: Record<string, number> = {
    "SR Legacy": 0,
    Foundation: 1,
  };
  const candidates = [...searchData.foods].sort(
    (a, b) =>
      (DATA_TYPE_RANK[a.dataType ?? ""] ?? 2) -
      (DATA_TYPE_RANK[b.dataType ?? ""] ?? 2),
  );
  let nutrients: ApiNutrient[] = [];
  let detailFetched = false;
  for (const candidate of candidates) {
    const detailUrl = `${FDC_BASE}/food/${candidate.fdcId}?api_key=${apiKey}`;
    let detailRes: Response;
    try {
      detailRes = await fetch(detailUrl);
    } catch (err) {
      throw new NutritionApiError(
        `USDA food detail request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!detailRes.ok) {
      if (detailRes.status === 404) continue;
      throw new NutritionApiError(
        `USDA food detail returned ${detailRes.status}`,
        detailRes.status,
      );
    }
    const food = (await detailRes.json()) as FoodDetailResponse;
    nutrients = food.foodNutrients ?? [];
    detailFetched = true;
    break;
  }

  if (!detailFetched) {
    const missing = "missing" as const;
    return {
      energy: missing,
      protein: missing,
      fat: missing,
      carbs: missing,
      fiber: missing,
      sodium: missing,
      calcium: missing,
      iron: missing,
      vitaminC: missing,
      vitaminD: missing,
      zinc: missing,
      potassium: missing,
      vitaminB12: missing,
      folate: missing,
      magnesium: missing,
      phosphorus: missing,
    };
  }

  const scale =
    typeof weightGrams === "number" && weightGrams > 0
      ? weightGrams / 100
      : null;

  function scaled(value: NutrientValue): NutrientValue {
    if (scale === null || value === "missing") return value;
    return value * scale;
  }

  return {
    energy: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.energy)),
    protein: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.protein)),
    fat: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.fat)),
    carbs: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.carbs)),
    fiber: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.fiber)),
    sodium: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.sodium)),
    calcium: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.calcium)),
    iron: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.iron)),
    vitaminC: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.vitaminC)),
    vitaminD: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.vitaminD)),
    zinc: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.zinc)),
    potassium: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.potassium)),
    vitaminB12: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.vitaminB12)),
    folate: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.folate)),
    magnesium: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.magnesium)),
    phosphorus: scaled(resolveNutrient(nutrients, NUTRIENT_IDS.phosphorus)),
  };
}
