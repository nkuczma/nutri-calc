import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/unit-conversion");
vi.mock("@/lib/nutrition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/nutrition")>();
  return { ...actual, fetchNutrients: vi.fn() };
});

import { updateRecipe } from "@/app/actions/recipes";
import { createClient } from "@/lib/supabase/server";
import { convertToGrams } from "@/lib/unit-conversion";
import { fetchNutrients } from "@/lib/nutrition";

const mockCreateClient = vi.mocked(createClient);
const mockConvertToGrams = vi.mocked(convertToGrams);
const mockFetchNutrients = vi.mocked(fetchNutrients);

const TEST_INGREDIENT = { name: "flour", quantity: 100, unit: "g" };
const TEST_USER_ID = "user-123";
const TEST_RECIPE_ID = "recipe-456";

describe("updateRecipe — swallowed fetchNutrients error (Risk: silent nutrient failure)", () => {
  let rpcSpy: ReturnType<typeof vi.fn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rpcSpy = vi.fn().mockResolvedValue({ error: null });

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: TEST_USER_ID } } }),
      },
      rpc: rpcSpy,
    } as never);

    mockConvertToGrams.mockResolvedValue(100);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it("logs a warning when fetchNutrients throws, instead of silently swallowing the error", async () => {
    const apiError = new Error("Open Food Facts timeout");
    mockFetchNutrients.mockRejectedValue(apiError);

    await updateRecipe(TEST_RECIPE_ID, "My Recipe", [TEST_INGREDIENT]);

    // This assertion FAILS right now — the catch block has no console.warn
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("flour"),
      expect.stringContaining("Open Food Facts timeout"),
    );
  });

  it("still completes the update when fetchNutrients throws (graceful degradation)", async () => {
    mockFetchNutrients.mockRejectedValue(new Error("API unavailable"));

    const result = await updateRecipe(TEST_RECIPE_ID, "My Recipe", [TEST_INGREDIENT]);

    // Save should still succeed — error is per-ingredient, not fatal
    expect(result).toEqual({});
    expect(rpcSpy).toHaveBeenCalledOnce();
  });
});
