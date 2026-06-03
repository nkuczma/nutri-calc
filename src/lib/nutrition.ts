import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

export type NutrientValue = number | "missing";

export interface IngredientNutrients {
  // macros (missing → 0, not "missing")
  energy: NutrientValue; // kcal
  protein: NutrientValue; // g
  fat: NutrientValue; // g
  carbs: NutrientValue; // g
  // other macros
  fiber: NutrientValue; // g
  sugars: NutrientValue; // g
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

// USDA Foundation detail can return two shapes; we handle both.
// Nested:  { nutrient: { name, unitName }, amount }
// Flat:    { nutrientName, unitName, value }
interface ApiNutrient {
  nutrient?: { id?: number; name?: string; unitName?: string };
  amount?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

interface SearchFood {
  fdcId: number;
  description: string;
  dataType?: string;
  foodCategory?: string;
  foodNutrients?: ApiNutrient[];
}

interface SearchResponse {
  foods?: SearchFood[];
}

// Macros that fall back to 0 when absent (rather than "missing").
const ZERO_FALLBACK_KEYS = new Set<keyof IngredientNutrients>([
  "energy",
  "protein",
  "fat",
  "carbs",
]);

interface NutrientAlias {
  id: number;
  name: string;
}
interface NutrientDef {
  canonical: { id: number; name: string; unit: string };
  aliases: NutrientAlias[];
}

const NUTRIENT_MAP: Record<keyof IngredientNutrients, NutrientDef> = {
  energy: {
    canonical: { id: 1008, name: "Energy", unit: "kcal" },
    aliases: [
      { id: 1008, name: "Energy" },
      { id: 2047, name: "Energy (Atwater General Factors)" },
      { id: 2048, name: "Energy (Atwater Specific Factors)" },
    ],
  },
  protein: {
    canonical: { id: 1003, name: "Protein", unit: "g" },
    aliases: [
      { id: 1003, name: "Protein" },
      { id: 957, name: "Total Protein" },
    ],
  },
  fat: {
    canonical: { id: 1004, name: "Total lipid (fat)", unit: "g" },
    aliases: [
      { id: 1004, name: "Total lipid (fat)" },
      { id: 958, name: "Total Fat" },
      { id: 1085, name: "Total Fat" },
    ],
  },
  carbs: {
    canonical: { id: 1005, name: "Carbohydrate, by difference", unit: "g" },
    aliases: [
      { id: 1005, name: "Carbohydrate, by difference" },
      { id: 2000, name: "Carbohydrates" },
      { id: 1050, name: "Carbohydrate, by summation" },
      { id: 956, name: "Total Carbohydrate" },
    ],
  },
  fiber: {
    canonical: { id: 1079, name: "Fiber, total dietary", unit: "g" },
    aliases: [
      { id: 1079, name: "Fiber, total dietary" },
      { id: 2033, name: "Total dietary fiber" },
    ],
  },
  sugars: {
    canonical: { id: 2000, name: "Total Sugars", unit: "g" },
    aliases: [
      { id: 2000, name: "Total Sugars" },
      { id: 1063, name: "Sugars, total including NLEA" },
      { id: 1235, name: "Added Sugars" },
    ],
  },
  sodium: {
    canonical: { id: 1093, name: "Sodium, Na", unit: "mg" },
    aliases: [
      { id: 1093, name: "Sodium, Na" },
      { id: 2047, name: "Sodium" },
    ],
  },
  calcium: {
    canonical: { id: 1087, name: "Calcium, Ca", unit: "mg" },
    aliases: [
      { id: 1087, name: "Calcium, Ca" },
      { id: 1087, name: "Calcium" },
    ],
  },
  iron: {
    canonical: { id: 1089, name: "Iron, Fe", unit: "mg" },
    aliases: [
      { id: 1089, name: "Iron, Fe" },
      { id: 1089, name: "Iron" },
    ],
  },
  vitaminC: {
    canonical: { id: 1162, name: "Vitamin C, total ascorbic acid", unit: "mg" },
    aliases: [
      { id: 1162, name: "Vitamin C, total ascorbic acid" },
      { id: 1162, name: "Vitamin C" },
    ],
  },
  vitaminD: {
    canonical: { id: 1114, name: "Vitamin D (D2 + D3)", unit: "µg" },
    aliases: [
      { id: 1114, name: "Vitamin D (D2 + D3)" },
      { id: 1114, name: "Vitamin D" },
    ],
  },
  zinc: {
    canonical: { id: 1095, name: "Zinc, Zn", unit: "mg" },
    aliases: [
      { id: 1095, name: "Zinc, Zn" },
      { id: 1095, name: "Zinc" },
    ],
  },
  potassium: {
    canonical: { id: 1092, name: "Potassium, K", unit: "mg" },
    aliases: [
      { id: 1092, name: "Potassium, K" },
      { id: 1092, name: "Potassium" },
    ],
  },
  vitaminB12: {
    canonical: { id: 1178, name: "Vitamin B-12", unit: "µg" },
    aliases: [
      { id: 1178, name: "Vitamin B-12" },
      { id: 1178, name: "Vitamin B12" },
    ],
  },
  folate: {
    canonical: { id: 1177, name: "Folate, total", unit: "µg" },
    aliases: [
      { id: 1177, name: "Folate, total" },
      { id: 1186, name: "Folate, DFE" },
    ],
  },
  magnesium: {
    canonical: { id: 1090, name: "Magnesium, Mg", unit: "mg" },
    aliases: [
      { id: 1090, name: "Magnesium, Mg" },
      { id: 1090, name: "Magnesium" },
    ],
  },
  phosphorus: {
    canonical: { id: 1091, name: "Phosphorus, P", unit: "mg" },
    aliases: [
      { id: 1091, name: "Phosphorus, P" },
      { id: 1091, name: "Phosphorus" },
    ],
  },
};

function nutrientAmount(n: ApiNutrient): number | undefined {
  const v = n.amount ?? n.value;
  return typeof v === "number" ? v : undefined;
}

function getNutrientId(n: ApiNutrient): number | undefined {
  return n.nutrient?.id;
}

function getNutrientName(n: ApiNutrient): string {
  return (n.nutrient?.name ?? n.nutrientName ?? "").toLowerCase();
}

function resolveNutrient(
  nutrients: ApiNutrient[],
  key: keyof IngredientNutrients,
): NutrientValue {
  const def = NUTRIENT_MAP[key];
  // Only consider entries with a real numeric amount.
  const valid = nutrients.filter((n) => typeof nutrientAmount(n) === "number");

  for (const alias of def.aliases) {
    // Try ID match first (most reliable), then fall back to exact name match.
    const found =
      valid.find((n) => getNutrientId(n) === alias.id) ??
      valid.find((n) => getNutrientName(n) === alias.name.toLowerCase());
    if (found !== undefined) {
      const amount = nutrientAmount(found);
      return typeof amount === "number" ? amount : "missing";
    }
  }

  // For key macros, absent data means 0 — not unknown.
  return ZERO_FALLBACK_KEYS.has(key) ? 0 : "missing";
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

  // Step 1: search USDA Foundation foods — fetch top 10 candidates.
  const searchUrl = `${FDC_BASE}/foods/search?query=${encodeURIComponent(ingredientValue)}&pageSize=10&dataType=Foundation,SR+Legacy&api_key=${apiKey}`;

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
    return {
      energy: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      fiber: "missing",
      sugars: "missing",
      sodium: "missing",
      calcium: "missing",
      iron: "missing",
      vitaminC: "missing",
      vitaminD: "missing",
      zinc: "missing",
      potassium: "missing",
      vitaminB12: "missing",
      folate: "missing",
      magnesium: "missing",
      phosphorus: "missing",
    };
  }

  // Step 2: use AI to pick the best-matching food from the candidate list.
  const candidateList = searchData.foods
    .map(
      (f) =>
        `${f.fdcId}: ${f.description}${f.foodCategory ? ` (${f.foodCategory})` : ""}`,
    )
    .join("\n");

  let chosenId = searchData.foods[0].fdcId; // default: first result
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    try {
      const openrouter = createOpenRouter({ apiKey: openrouterKey });
      const { text } = await generateText({
        model: openrouter("anthropic/claude-sonnet-4.6"),
        prompt: `You are selecting the best USDA food match for a recipe ingredient.
Ingredient: "${ingredientValue}"
Candidates (fdcId: description):
${candidateList}
Reply with only a JSON object: {"fdcId": <number>}`,
      });
      const match = text.match(/"fdcId"\s*:\s*(\d+)/);
      if (match) {
        const picked = parseInt(match[1], 10);
        if (searchData.foods.some((f) => f.fdcId === picked)) {
          chosenId = picked;
        }
      }
    } catch (err) {
      console.warn(
        `[nutrition] AI food selection failed for "${ingredientValue}", falling back to first result:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Step 3: use nutrient data already returned in the search response — no extra call needed.
  const chosenFood =
    searchData.foods.find((f) => f.fdcId === chosenId) ?? searchData.foods[0];
  const nutrients: ApiNutrient[] = chosenFood.foodNutrients ?? [];
  console.log(chosenFood.description);
  const scale =
    typeof weightGrams === "number" && weightGrams > 0
      ? weightGrams / 100
      : null;

  function scaled(value: NutrientValue): NutrientValue {
    if (scale === null || value === "missing") return value;
    return value * scale;
  }

  return {
    energy: scaled(resolveNutrient(nutrients, "energy")),
    protein: scaled(resolveNutrient(nutrients, "protein")),
    fat: scaled(resolveNutrient(nutrients, "fat")),
    carbs: scaled(resolveNutrient(nutrients, "carbs")),
    fiber: scaled(resolveNutrient(nutrients, "fiber")),
    sugars: scaled(resolveNutrient(nutrients, "sugars")),
    sodium: scaled(resolveNutrient(nutrients, "sodium")),
    calcium: scaled(resolveNutrient(nutrients, "calcium")),
    iron: scaled(resolveNutrient(nutrients, "iron")),
    vitaminC: scaled(resolveNutrient(nutrients, "vitaminC")),
    vitaminD: scaled(resolveNutrient(nutrients, "vitaminD")),
    zinc: scaled(resolveNutrient(nutrients, "zinc")),
    potassium: scaled(resolveNutrient(nutrients, "potassium")),
    vitaminB12: scaled(resolveNutrient(nutrients, "vitaminB12")),
    folate: scaled(resolveNutrient(nutrients, "folate")),
    magnesium: scaled(resolveNutrient(nutrients, "magnesium")),
    phosphorus: scaled(resolveNutrient(nutrients, "phosphorus")),
  };
}
