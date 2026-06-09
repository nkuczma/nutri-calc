import { describe, it, expect } from "vitest";
import { aggregateNutrients, type IngredientNutrients } from "@/lib/nutrition";

const allNumeric: IngredientNutrients = {
  energy: 100,
  protein: 10,
  fat: 5,
  saturatedFat: 2,
  carbs: 20,
  fiber: 3,
  sugars: 8,
  salt: 1,
  sodium: 400,
};

const allMissing: IngredientNutrients = {
  energy: "missing",
  protein: "missing",
  fat: "missing",
  saturatedFat: "missing",
  carbs: "missing",
  fiber: "missing",
  sugars: "missing",
  salt: "missing",
  sodium: "missing",
};

describe("aggregateNutrients", () => {
  it("sums all numeric fields across two ingredients", () => {
    const second: IngredientNutrients = {
      energy: 200,
      protein: 20,
      fat: 10,
      saturatedFat: 4,
      carbs: 40,
      fiber: 6,
      sugars: 16,
      salt: 2,
      sodium: 800,
    };
    const result = aggregateNutrients([allNumeric, second]);
    expect(result.energy).toBe(300);
    expect(result.protein).toBe(30);
    expect(result.fat).toBe(15);
    expect(result.saturatedFat).toBe(6);
    expect(result.carbs).toBe(60);
    expect(result.fiber).toBe(9);
    expect(result.sugars).toBe(24);
    expect(result.salt).toBe(3);
    expect(result.sodium).toBe(1200);
  });

  it('returns "missing" for a field when any ingredient has it missing', () => {
    const withMissingSugars: IngredientNutrients = {
      ...allNumeric,
      sugars: "missing",
    };
    const result = aggregateNutrients([allNumeric, withMissingSugars]);
    expect(result.sugars).toBe("missing");
    // other fields with no missing values still sum correctly
    expect(result.energy).toBe(200);
    expect(result.protein).toBe(20);
  });

  it('returns "missing" for all fields when all ingredients are missing', () => {
    const result = aggregateNutrients([allMissing, allMissing]);
    expect(result.energy).toBe("missing");
    expect(result.sugars).toBe("missing");
    expect(result.sodium).toBe("missing");
  });

  it("passes through a single-item array unchanged", () => {
    const result = aggregateNutrients([allNumeric]);
    expect(result).toEqual(allNumeric);
  });

  it("throws when called with an empty array", () => {
    expect(() => aggregateNutrients([])).toThrow();
  });
});
