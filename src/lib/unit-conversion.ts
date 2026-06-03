import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const MASS_MULTIPLIERS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

function isMassUnit(unit: string): boolean {
  return unit.toLowerCase().trim() in MASS_MULTIPLIERS;
}

async function convertViaSpoonacular(
  name: string,
  quantity: number,
  unit: string
): Promise<number | null> {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) return null;

  const url = new URL("https://api.spoonacular.com/recipes/convert");
  url.searchParams.set("ingredientName", name);
  url.searchParams.set("sourceAmount", String(quantity));
  url.searchParams.set("sourceUnit", unit);
  url.searchParams.set("targetUnit", "grams");
  url.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const grams = typeof data.targetAmount === "number" ? data.targetAmount : null;
    if (grams === null || grams <= 0) return null;
    return grams;
  } catch {
    return null;
  }
}

async function convertViaOpenRouter(
  name: string,
  quantity: number,
  unit: string
): Promise<number | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const openrouter = createOpenRouter({ apiKey });
    const { text } = await generateText({
      model: openrouter("anthropic/claude-haiku-4-5"),
      prompt: `How many grams is 1 ${unit} of ${name}? Reply with only a JSON object: {"gramsPerUnit": <number>}`,
    });
    const match = text.match(/\{[^}]*"gramsPerUnit"\s*:\s*(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const gramsPerUnit = parseFloat(match[1]);
    if (!isFinite(gramsPerUnit) || gramsPerUnit <= 0) return null;
    return gramsPerUnit * quantity;
  } catch {
    return null;
  }
}

export async function convertToGrams(
  name: string,
  quantity: number,
  unit: string
): Promise<number | "missing"> {
  const normalizedUnit = unit.toLowerCase().trim();

  if (isMassUnit(normalizedUnit)) {
    return quantity * MASS_MULTIPLIERS[normalizedUnit];
  }

  const spoonacularResult = await convertViaSpoonacular(name, quantity, unit);
  if (spoonacularResult !== null) return spoonacularResult;

  const openrouterResult = await convertViaOpenRouter(name, quantity, unit);
  if (openrouterResult !== null) return openrouterResult;

  return "missing";
}
