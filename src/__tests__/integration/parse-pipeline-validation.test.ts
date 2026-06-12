import { describe, it, expect } from "vitest";
import { filterValidIngredients } from "@/lib/schemas/ingredient";

describe("filterValidIngredients — pipeline guard (Risk #6)", () => {
  it("drops an ingredient with quantity = 0 (all-invalid case: no fetch should fire)", () => {
    const rows = [{ name: "flour", quantity: 0, unit: "g" }];
    expect(filterValidIngredients(rows)).toHaveLength(0);
  });

  it("drops an ingredient with negative quantity", () => {
    const rows = [{ name: "flour", quantity: -1, unit: "g" }];
    expect(filterValidIngredients(rows)).toHaveLength(0);
  });

  it("drops an ingredient with empty name", () => {
    const rows = [{ name: "", quantity: 1, unit: "g" }];
    expect(filterValidIngredients(rows)).toHaveLength(0);
  });

  it("drops whitespace-only name", () => {
    const rows = [{ name: "   ", quantity: 1, unit: "g" }];
    expect(filterValidIngredients(rows)).toHaveLength(0);
  });

  it("keeps only the valid row in a mixed input (mixed case: fetch body must not include invalid ingredient)", () => {
    const rows = [
      { name: "", quantity: 1, unit: "g" },
      { name: "salt", quantity: 2, unit: "g" },
    ];
    const result = filterValidIngredients(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "salt", quantity: 2, unit: "g" });
  });

  it("passes through a fully valid ingredient unchanged", () => {
    const rows = [{ name: "chicken breast", quantity: 150, unit: "g" }];
    const result = filterValidIngredients(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(rows[0]);
  });

  it("accepts an empty unit string (intentional — no unit stated)", () => {
    const rows = [{ name: "egg", quantity: 1, unit: "" }];
    expect(filterValidIngredients(rows)).toHaveLength(1);
  });
});
