import { describe, it, expect } from "vitest";
import { ingredientSchema } from "@/lib/schemas/ingredient";

const valid = { name: "chicken breast", quantity: 2, unit: "g" };

describe("ingredientSchema — domain constraints", () => {
  it("accepts a valid ingredient", () => {
    expect(ingredientSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an empty unit string (intentional: no unit stated)", () => {
    expect(ingredientSchema.safeParse({ ...valid, unit: "" }).success).toBe(true);
  });

  it("rejects quantity = 0", () => {
    expect(ingredientSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
  });

  it("rejects quantity = -1", () => {
    expect(ingredientSchema.safeParse({ ...valid, quantity: -1 }).success).toBe(false);
  });

  it("rejects quantity = -0.5", () => {
    expect(ingredientSchema.safeParse({ ...valid, quantity: -0.5 }).success).toBe(false);
  });

  it("rejects name = empty string", () => {
    expect(ingredientSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });
});
