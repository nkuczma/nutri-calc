export type NutrientValue = number | "missing";

export interface IngredientNutrients {
  // macros
  energy: NutrientValue;     // kcal
  protein: NutrientValue;    // g
  fat: NutrientValue;        // g
  carbs: NutrientValue;      // g
  fiber: NutrientValue;      // g
  // micros
  sodium: NutrientValue;     // mg
  calcium: NutrientValue;    // mg
  iron: NutrientValue;       // mg
  vitaminC: NutrientValue;   // mg
  vitaminD: NutrientValue;   // µg
  zinc: NutrientValue;       // mg
  potassium: NutrientValue;  // mg
  vitaminB12: NutrientValue; // µg
  folate: NutrientValue;     // µg
  magnesium: NutrientValue;  // mg
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
  id: number;
  amount: number;
  unitName: string;
}

interface SearchFood {
  fdcId: number;
  description: string;
}

interface SearchResponse {
  foods?: SearchFood[];
}

interface FoodDetailResponse {
  fdcId: number;
  nutrients?: ApiNutrient[];
}

const NUTRIENT_IDS: Record<keyof IngredientNutrients, number> = {
  // macros — from api-docs.md (verified against USDA FDC example response)
  energy: 2000,
  protein: 2057,
  fat: 2058,
  carbs: 2059,
  fiber: 2067,
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
  const found = nutrients.find((n) => n.id === id);
  return found !== undefined ? found.amount : "missing";
}

const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";

export async function fetchNutrients(
  ingredientName: string
): Promise<IngredientNutrients> {
  const apiKey = process.env.NUTRITION_API_KEY;
  if (!apiKey) {
    throw new NutritionApiError("NUTRITION_API_KEY is not set");
  }

  // Step 1: search for the ingredient
  const searchUrl = `${FDC_BASE}/foods/search?query=${encodeURIComponent(ingredientName)}&dataType=Foundation,SR%20Legacy&pageSize=1&api_key=${apiKey}`;
  let searchRes: Response;
  try {
    searchRes = await fetch(searchUrl);
  } catch (err) {
    throw new NutritionApiError(
      `USDA search request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!searchRes.ok) {
    throw new NutritionApiError(
      `USDA search returned ${searchRes.status}`,
      searchRes.status
    );
  }

  const searchData = (await searchRes.json()) as SearchResponse;
  if (!searchData.foods || searchData.foods.length === 0) {
    const missing = "missing" as const;
    return {
      energy: missing, protein: missing, fat: missing, carbs: missing, fiber: missing,
      sodium: missing, calcium: missing, iron: missing, vitaminC: missing, vitaminD: missing,
      zinc: missing, potassium: missing, vitaminB12: missing, folate: missing,
      magnesium: missing, phosphorus: missing,
    };
  }

  const fdcId = searchData.foods[0].fdcId;

  // Step 2: fetch full nutrient detail
  const detailUrl = `${FDC_BASE}/food/${fdcId}?api_key=${apiKey}`;
  let detailRes: Response;
  try {
    detailRes = await fetch(detailUrl);
  } catch (err) {
    throw new NutritionApiError(
      `USDA food detail request failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!detailRes.ok) {
    throw new NutritionApiError(
      `USDA food detail returned ${detailRes.status}`,
      detailRes.status
    );
  }

  const food = (await detailRes.json()) as FoodDetailResponse;
  const nutrients: ApiNutrient[] = food.nutrients ?? [];

  return {
    energy: resolveNutrient(nutrients, NUTRIENT_IDS.energy),
    protein: resolveNutrient(nutrients, NUTRIENT_IDS.protein),
    fat: resolveNutrient(nutrients, NUTRIENT_IDS.fat),
    carbs: resolveNutrient(nutrients, NUTRIENT_IDS.carbs),
    fiber: resolveNutrient(nutrients, NUTRIENT_IDS.fiber),
    sodium: resolveNutrient(nutrients, NUTRIENT_IDS.sodium),
    calcium: resolveNutrient(nutrients, NUTRIENT_IDS.calcium),
    iron: resolveNutrient(nutrients, NUTRIENT_IDS.iron),
    vitaminC: resolveNutrient(nutrients, NUTRIENT_IDS.vitaminC),
    vitaminD: resolveNutrient(nutrients, NUTRIENT_IDS.vitaminD),
    zinc: resolveNutrient(nutrients, NUTRIENT_IDS.zinc),
    potassium: resolveNutrient(nutrients, NUTRIENT_IDS.potassium),
    vitaminB12: resolveNutrient(nutrients, NUTRIENT_IDS.vitaminB12),
    folate: resolveNutrient(nutrients, NUTRIENT_IDS.folate),
    magnesium: resolveNutrient(nutrients, NUTRIENT_IDS.magnesium),
    phosphorus: resolveNutrient(nutrients, NUTRIENT_IDS.phosphorus),
  };
}
