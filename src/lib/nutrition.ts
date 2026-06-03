import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

export type NutrientValue = number | "missing";

// Nutrients available from Open Food Facts per 100g.
// Micronutrients (vitamins, minerals) are not provided by OFF
// and have been removed from the data model.
export interface IngredientNutrients {
  // macros (absent → 0, not "missing")
  energy: NutrientValue; // kcal
  protein: NutrientValue; // g
  fat: NutrientValue; // g
  saturatedFat: NutrientValue; // g
  carbs: NutrientValue; // g
  fiber: NutrientValue; // g
  sugars: NutrientValue; // g
  salt: NutrientValue; // g
  sodium: NutrientValue; // mg
}

export class NutritionApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "NutritionApiError";
    this.status = status;
  }
}

// Open Food Facts nutriments object (values per 100g)
interface OFFNutriments {
  "energy-kcal_100g"?: number;
  proteins_100g?: number;
  fat_100g?: number;
  "saturated-fat_100g"?: number;
  carbohydrates_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  salt_100g?: number;
  // sodium in grams (OFF convention); sodium = salt / 2.5
  sodium_100g?: number;
}

interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  nutriments?: OFFNutriments;
}

interface OFFSearchResponse {
  hits?: OFFProduct[];
  products?: OFFProduct[]; // legacy endpoint fallback shape
  count?: number;
}

const OFF_SEARCH = "https://search.openfoodfacts.org/search";

function num(v: number | undefined): NutrientValue {
  return typeof v === "number" && isFinite(v) ? v : "missing";
}

function extractNutrients(p: OFFProduct): IngredientNutrients {
  const n = p.nutriments ?? {};
  // OFF stores sodium in grams; derive from salt if sodium absent
  const sodiumG = n.sodium_100g ?? (n.salt_100g != null ? n.salt_100g / 2.5 : undefined);
  const sodiumMg = sodiumG != null ? sodiumG * 1000 : undefined;

  return {
    energy:       num(n["energy-kcal_100g"]),
    protein:      num(n.proteins_100g),
    fat:          num(n.fat_100g),
    saturatedFat: num(n["saturated-fat_100g"]),
    carbs:        num(n.carbohydrates_100g),
    fiber:        num(n.fiber_100g),
    sugars:       num(n.sugars_100g),
    salt:         num(n.salt_100g),
    sodium:       num(sodiumMg),
  };
}

const EMPTY_NUTRIENTS: IngredientNutrients = {
  energy: 0,
  protein: 0,
  fat: 0,
  saturatedFat: "missing",
  carbs: 0,
  fiber: "missing",
  sugars: "missing",
  salt: "missing",
  sodium: "missing",
};

export async function fetchNutrients(
  ingredientValue: string,
  weightGrams?: number,
): Promise<IngredientNutrients> {
  // Step 1: search Open Food Facts — fetch top 10 candidates.
  const searchUrl = `${OFF_SEARCH}?q=${encodeURIComponent(ingredientValue)}&page_size=10&fields=code,product_name,brands,nutriments&json=1`;

  let searchRes: Response;
  try {
    searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "NutriCalc/1.0 (natalia.kuczma@noaignite.com)" },
    });
  } catch (err) {
    throw new NutritionApiError(
      `Open Food Facts search request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!searchRes.ok) {
    throw new NutritionApiError(
      `Open Food Facts search returned ${searchRes.status}`,
      searchRes.status,
    );
  }

  const searchData = (await searchRes.json()) as OFFSearchResponse;
  const products = searchData.hits ?? searchData.products ?? [];
  if (products.length === 0) {
    return EMPTY_NUTRIENTS;
  }

  // Step 2: use AI to pick the best-matching product from the candidate list.
  const candidateList = products
    .map((p, i) => {
      const label = [p.product_name, p.brands].filter(Boolean).join(" — ") || "(no name)";
      return `${i}: ${label} [code: ${p.code}]`;
    })
    .join("\n");

  let chosenCode = products[0].code;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    try {
      const openrouter = createOpenRouter({ apiKey: openrouterKey });
      const { text } = await generateText({
        model: openrouter("anthropic/claude-sonnet-4.6"),
        prompt: `You are selecting the best Open Food Facts product match for a recipe ingredient.
Ingredient: "${ingredientValue}"
Candidates (index: name [code]):
${candidateList}
Reply with only a JSON object: {"code": "<product_code>"}`,
      });
      const match = text.match(/"code"\s*:\s*"([^"]+)"/);
      if (match) {
        const picked = match[1];
        if (products.some((p) => p.code === picked)) {
          chosenCode = picked;
        }
      }
    } catch (err) {
      console.warn(
        `[nutrition] AI food selection failed for "${ingredientValue}", falling back to first result:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Step 3: extract nutrients from the chosen product.
  const chosenProduct =
    products.find((p) => p.code === chosenCode) ?? products[0];
  const label = [chosenProduct.product_name, chosenProduct.brands].filter(Boolean).join(" — ");
  console.log(`[nutrition] chosen product: ${label} (${chosenProduct.code})`);

  const raw = extractNutrients(chosenProduct);

  const scale =
    typeof weightGrams === "number" && weightGrams > 0
      ? weightGrams / 100
      : null;

  function scaled(value: NutrientValue): NutrientValue {
    if (scale === null || value === "missing") return value;
    return value * scale;
  }

  // For core macros absent from OFF, fall back to 0 rather than "missing".
  function scaledMacro(value: NutrientValue): NutrientValue {
    if (value === "missing") return 0;
    return scaled(value);
  }

  return {
    energy:       scaledMacro(raw.energy),
    protein:      scaledMacro(raw.protein),
    fat:          scaledMacro(raw.fat),
    saturatedFat: scaled(raw.saturatedFat),
    carbs:        scaledMacro(raw.carbs),
    fiber:        scaled(raw.fiber),
    sugars:       scaled(raw.sugars),
    salt:         scaled(raw.salt),
    sodium:       scaled(raw.sodium),
  };
}
