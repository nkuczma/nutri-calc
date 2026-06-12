# Parse Pipeline Validation — Implementation Plan

## Overview

Add semantic constraints to `ingredientSchema` so the Zod type carries the domain invariant (name non-empty, quantity positive), then add a runtime filter guard in `ParseFlow.handleConfirm` so user-edited rows with invalid values are silently dropped before any nutrition API call fires. Prove both layers with unit and integration tests.

## Current State Analysis

`src/lib/schemas/ingredient.ts` declares `ingredientSchema` with `z.number()` for quantity (allows 0, negative) and `z.string()` for name (allows empty string). The schema is used by both the AI SDK structured-output call (`parseResultSchema`) and the `Ingredient` TypeScript type.

`ParseFlow.tsx:34-36` filters streaming ingredients by `i?.name` (drops falsy name) but does not check `quantity`. `handleConfirm` passes the user-confirmed `rows` array to `/api/normalize-units` and `/api/nutrition-summary` with no further filtering. A user who edits an ingredient's quantity to `0` in `IngredientEditor` will reach the nutrition lookup unchecked.

`convertToGrams` in `src/lib/unit-conversion.ts:83` performs `quantity * MASS_MULTIPLIERS[unit]` with no guard — `0g` and `-5g` both pass through. `fetchNutrients` in `src/lib/nutrition.ts:188` does guard `weightGrams > 0` for the scaling step, but on failure it falls back to unscaled per-100g values rather than a missing indicator, producing silently wrong totals.

No existing tests cover adversarial ingredient inputs.

## Desired End State

`ingredientSchema` carries domain constraints: `name` must be non-empty, `quantity` must be positive. The `Ingredient` type reflects these constraints. `handleConfirm` silently drops any row that violates them before calling nutrition APIs. Tests prove both layers with adversarial fixtures.

### Key Discoveries

- `src/lib/schemas/ingredient.ts` — schema shared by AI SDK output and TypeScript type; two consumers (`ParseFlow.tsx` and `route.ts`)
- `unit: z.string()` should remain unconstrained — empty string is intentional per AI instruction "set unit to empty string if no unit stated"
- `handleConfirm` at `ParseFlow.tsx:55` is the single entry point into the nutrition fetch chain; filter belongs here
- Existing test patterns: unit tests in `src/__tests__/lib/`, integration tests in `src/__tests__/integration/` following MSW and Supabase mock patterns from §6.2/§6.3 cookbook

## What We're NOT Doing

- Not adding server-side validation in the parse-recipe route handler — the schema tightening via AI SDK covers AI output there
- Not validating `unit` — empty string is a valid, intentional value
- Not modifying `convertToGrams` or `fetchNutrients` — fixing the source is preferable to patching downstream
- Not surfacing a user-facing error for dropped ingredients — silent drop matches the existing empty-name behavior

## Implementation Approach

Two layers, smallest first:

1. **Schema constraints** — tighten `ingredientSchema` at `src/lib/schemas/ingredient.ts`. No other files change in Phase 1.
2. **Runtime guard + tests** — add a filter in `handleConfirm` and write tests for both layers.

---

## Phase 1: Schema constraints + unit tests

### Overview

Tighten `ingredientSchema` so `name` and `quantity` carry their domain invariants as Zod constraints. Write a unit test file that proves the schema rejects adversarial inputs and accepts valid ones.

### Changes Required

#### 1. Ingredient schema

**File:** `src/lib/schemas/ingredient.ts`

**Intent:** Add `.min(1)` to `name` and `.positive()` to `quantity` so the schema itself enforces domain validity. `unit` stays as `z.string()` — empty string is valid.

**Contract:** After this change `z.number().positive()` means `n > 0`; `z.string().min(1)` means at least one character. The `Ingredient` type updates automatically via `z.infer`. No other files need changes.

#### 2. Unit test for ingredient schema

**File:** `src/__tests__/lib/ingredient-schema.test.ts`

**Intent:** Prove the schema rejects every adversarial input class (zero quantity, negative quantity, empty name) and accepts a valid ingredient. Oracles come from the domain rule, not from the implementation.

**Contract:** Use `ingredientSchema.safeParse(input)` and assert `success: false` for each invalid case, `success: true` for the valid case. Cover: `{ quantity: 0 }`, `{ quantity: -1 }`, `{ quantity: -0.5 }`, `{ name: "" }`, and one fully valid baseline. Assert `unit: ""` is accepted (verifies the constraint is not over-broad).

### Success Criteria

#### Automated Verification

- Unit tests pass: `npx vitest run src/__tests__/lib/ingredient-schema.test.ts`
- Type checking passes: `npx tsc --noEmit`
- Existing tests still pass: `npx vitest run`

#### Manual Verification

- None required for this phase — schema and unit tests are fully deterministic.

---

## Phase 2: Runtime filter guard + integration test

### Overview

Add a filter in `ParseFlow.handleConfirm` that silently drops rows with `quantity <= 0` or empty `name` before the nutrition API calls. Write an integration test that proves filtered-out ingredients never reach the normalize-units or nutrition-summary fetch.

### Changes Required

#### 1. handleConfirm guard

**File:** `src/app/parse/ParseFlow.tsx`

**Intent:** Before the `/api/normalize-units` fetch at line 62, filter `rows` to only those where `name.trim()` is non-empty and `quantity > 0`. Assign the filtered array to a local variable and use it for both subsequent API calls.

**Contract:** The filter runs before any `fetch`. If all rows are invalid, the fetch calls are not made (both `weights` and `nutrients` remain in their pre-call state; `setFetchingNutrients(false)` and `setNutritionDone(false)` should be called). The `rows` parameter is not mutated.

#### 2. Integration test

**File:** `src/__tests__/integration/parse-pipeline-validation.test.ts`

**Intent:** Verify that when `handleConfirm` is called with ingredients that have `quantity <= 0` or empty `name`, the nutrition pipeline fetch calls are either not made (all-invalid case) or do not include the invalid rows (mixed case).

**Contract:** This is a unit test of `handleConfirm`'s filtering behavior, not an e2e browser test. Use `vi.fn()` to spy on `fetch` (or mock it globally) and assert the request body. Two test cases:

1. **All-invalid** — call with `[{ name: "flour", quantity: 0, unit: "g" }]`; assert `fetch` is never called for `/api/normalize-units`.
2. **Mixed** — call with `[{ name: "", quantity: 1, unit: "g" }, { name: "salt", quantity: 2, unit: "g" }]`; assert the body sent to `/api/normalize-units` contains only `{ name: "salt", quantity: 2, unit: "g" }`.

Follow the existing `parse-auth.test.ts` pattern for mocking Next.js internals if needed. Keep the test scoped to `handleConfirm`'s behavior — do not re-test the schema constraints here.

### Success Criteria

#### Automated Verification

- Integration tests pass: `npx vitest run src/__tests__/integration/parse-pipeline-validation.test.ts`
- Full suite still passes: `npx vitest run`
- Type checking passes: `npx tsc --noEmit`
- Lint passes: `npm run lint`

#### Manual Verification

- Edit an ingredient's quantity to `0` in the IngredientEditor after parsing a recipe; click Confirm. Confirm that no nutrition fetch fires (network tab shows no request to `/api/normalize-units`).
- Verify that a valid ingredient alongside the zero-quantity one still fetches correctly (mixed case).

---

## Testing Strategy

### Unit Tests

- `src/__tests__/lib/ingredient-schema.test.ts` — schema rejection for quantity=0, quantity<0, name=""; acceptance for valid ingredient and unit=""

### Integration Tests

- `src/__tests__/integration/parse-pipeline-validation.test.ts` — fetch not called for all-invalid input; fetch body contains only valid rows for mixed input

### Manual Testing

1. Parse a recipe normally; confirm results unchanged.
2. Manually set an ingredient quantity to 0 in the editor; confirm no fetch fires.
3. Mix valid and zero-quantity ingredients; confirm only valid ones appear in the nutrition results.

## References

- Risk #6 in `context/foundation/test-plan.md`
- `src/lib/schemas/ingredient.ts` — schema to tighten
- `src/app/parse/ParseFlow.tsx:55-88` — handleConfirm filter location
- `src/__tests__/integration/parse-auth.test.ts` — integration test pattern
- `src/__tests__/lib/nutrition-aggregate.test.ts` — unit test pattern

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema constraints + unit tests

#### Automated

- [x] 1.1 Unit tests pass: `npx vitest run src/__tests__/lib/ingredient-schema.test.ts` — 7c340a1
- [x] 1.2 Type checking passes: `npx tsc --noEmit` — 7c340a1
- [x] 1.3 Existing tests still pass: `npx vitest run` — 7c340a1

### Phase 2: Runtime filter guard + integration test

#### Automated

- [x] 2.1 Integration tests pass: `npx vitest run src/__tests__/integration/parse-pipeline-validation.test.ts` — c6fc48d
- [x] 2.2 Full suite still passes: `npx vitest run` — c6fc48d
- [x] 2.3 Type checking passes: `npx tsc --noEmit` — c6fc48d
- [x] 2.4 Lint passes: `npm run lint` — c6fc48d

#### Manual

- [x] 2.5 Zero-quantity ingredient after parse: no fetch fires in network tab — c6fc48d
- [x] 2.6 Mixed valid/invalid: only valid ingredients reach nutrition fetch — c6fc48d
