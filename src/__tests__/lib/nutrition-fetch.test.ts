import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup";
import { fetchNutrients } from "@/lib/nutrition";
import chickenFixture from "../fixtures/off-chicken-breast.json";

const OFF_URL = "https://search.openfoodfacts.org/search";

describe("fetchNutrients", () => {
  beforeEach(() => {
    server.use(
      http.get(OFF_URL, () => HttpResponse.json(chickenFixture)),
    );
  });

  it("Risk #2 — returns correct numeric values for known fixture at 100g", async () => {
    // scale = 100/100 = 1, so values equal fixture values directly
    const result = await fetchNutrients("chicken breast", 100);
    expect(result.energy).toBe(165);
    expect(result.protein).toBe(31);
    expect(result.fat).toBe(3.6);
    expect(result.saturatedFat).toBe(1.1);
    expect(result.carbs).toBe(0);
    expect(result.fiber).toBe(0);
    expect(result.salt).toBe(0.2);
    // sodium: fixture has sodium_100g: 0.08 g → 0.08 * 1000 = 80 mg
    expect(result.sodium).toBe(80);
  });

  it("Risk #1 — non-macro absent in fixture produces \"missing\"", async () => {
    // fixture omits sugars_100g → sugars uses scaled() not scaledMacro() → "missing"
    const result = await fetchNutrients("chicken breast", 100);
    expect(result.sugars).toBe("missing");
  });

  it("accepted policy — absent macro field produces 0", async () => {
    const fixtureNoEnergy = {
      hits: [
        {
          ...chickenFixture.hits[0],
          nutriments: {
            ...chickenFixture.hits[0].nutriments,
            "energy-kcal_100g": undefined,
          },
        },
      ],
    };
    server.use(
      http.get(OFF_URL, () => HttpResponse.json(fixtureNoEnergy)),
    );
    const result = await fetchNutrients("chicken breast", 100);
    expect(result.energy).toBe(0);
  });

  it("Risk #2 — scaling — returns correct values for 200g", async () => {
    const result = await fetchNutrients("chicken breast", 200);
    expect(result.energy).toBe(330);
    expect(result.protein).toBe(62);
    expect(result.fat).toBe(7.2);
  });

  it("non-macro absent in fixture produces \"missing\" — fiber and salt", async () => {
    server.use(
      http.get(OFF_URL, () =>
        HttpResponse.json({
          hits: [
            {
              ...chickenFixture.hits[0],
              nutriments: {
                "energy-kcal_100g": 165,
                "proteins_100g": 31,
                "fat_100g": 3.6,
              },
            },
          ],
        }),
      ),
    );
    const result = await fetchNutrients("chicken breast", 100);
    expect(result.fiber).toBe("missing");
    expect(result.salt).toBe("missing");
  });

  it("zero products — returns EMPTY_NUTRIENTS shape", async () => {
    server.use(
      http.get(OFF_URL, () => HttpResponse.json({ hits: [] })),
    );
    const result = await fetchNutrients("chicken breast", 100);
    // EMPTY_NUTRIENTS: energy=0, saturatedFat="missing"
    expect(result.energy).toBe(0);
    expect(result.saturatedFat).toBe("missing");
  });
});
