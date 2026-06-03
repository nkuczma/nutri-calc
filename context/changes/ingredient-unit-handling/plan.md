# Ingredient Unit Normalization & Weight-Based Nutrition — Implementation Plan

## Overview

Add a unit normalization step between recipe parse and nutrition summary. The step converts each ingredient's volume unit (cups, tbsp, tsp, etc.) to grams using Spoonacular's `Convert Amounts` endpoint, with an OpenRouter/Claude Haiku fallback for unusual units or API failures. Once gram weights are resolved, USDA per-100g nutrient values are scaled by `weightGrams / 100` to give accurate totals. Gram weights appear as a new read-only column in the ingredient editor.

## Current State Analysis

- `src/lib/nutrition.ts:fetchNutrients` accepts an ingredient string (e.g. `"flour 2 cups"`) and searches USDA FDC. USDA returns nutrients **per 100g regardless of query** — the current code never scales by actual weight. All nutrition totals are therefore unscaled and inaccurate for any quantity ≠ 100g.
- `src/app/api/nutrition-summary/route.ts` calls `fetchNutrients` per ingredient and sums the raw results. No weight scaling anywhere in the path.
- `src/app/parse/ParseFlow.tsx:handleConfirm` calls `POST /api/nutrition-summary` directly — one hop from editor confirm to nutrition display.
- `src/app/parse/IngredientEditor.tsx` has three columns: Ingredient / Qty / Unit. No gram weight display.
- No unit conversion service exists. No Spoonacular integration anywhere.

## Desired End State

When the user clicks "Get nutritional summary":
1. Each ingredient is converted to grams (Spoonacular → OpenRouter fallback). Weight appears in a new "Weight (g)" column in the ingredient editor; failed conversions show "?".
2. USDA nutrients are fetched per ingredient name (not quantity string) and scaled by `weightGrams / 100`.
3. The final nutrition totals reflect actual quantities used in the recipe.

### Key Discoveries

- `src/lib/nutrition.ts:90` — search query currently includes quantity+unit; this will change to name-only after this plan.
- `src/app/api/nutrition-summary/route.ts:23` — `query(i)` helper that builds the USDA search string; this is the main change point for scaling.
- `src/lib/schemas/ingredient.ts` — base `Ingredient` type must stay unchanged (used by AI parse schema). A new `NormalizedIngredient` type extending it will carry `weightGrams`.
- OpenRouter is already integrated via `@openrouter/ai-sdk-provider` in `src/app/api/parse-recipe/route.ts`. The same pattern applies for the fallback.

## What We're NOT Doing

- No DB schema migration — gram weights are calculated on demand, not stored.
- No changes to the `Ingredient` Zod schema (AI parse output stays as-is).
- No UI for editing gram weights — the column is read-only.
- No re-normalization when the user edits ingredients after grams are displayed (grams are resolved once at confirm time).
- No support for mass units (g, kg, oz) that already are weights — those pass through as-is (see Phase 1 note).

## Implementation Approach

Split into four phases with a clear dependency chain:

1. **Unit conversion service** — the pure conversion logic, no route yet.
2. **Normalize-units API route** — thin HTTP wrapper over the service.
3. **USDA scaling** — update `fetchNutrients` + `nutrition-summary` to accept and use `weightGrams`.
4. **UI integration** — wire `ParseFlow` to call normalize first, pass weights to `IngredientEditor`.

## Critical Implementation Details

**Mass units bypass**: If the ingredient's unit is already a mass unit (`g`, `gram`, `grams`, `kg`, `oz`, `lb`, `lbs`), skip the conversion API and compute grams directly (multiply quantity by the known multiplier: g→1, kg→1000, oz→28.35, lb→453.59). This avoids unnecessary API calls and handles recipes that already specify grams.

**OpenRouter fallback contract**: The fallback prompt must ask for the number of grams in **1 unit** of the ingredient (not the full quantity). The caller multiplies the returned `gramsPerUnit` by `ingredient.quantity`. This makes the fallback robust to floating-point quantities: e.g., 2.5 cups flour = `gramsPerUnit(1 cup flour) × 2.5`.

**USDA search query change**: After this plan, `fetchNutrients` will receive just the ingredient **name** (e.g. `"flour"`), not `"flour 2 cups"`. The quantity+unit suffix was irrelevant to USDA (it ignores it) but makes the search noisier. This is a correctness improvement, not a behavior change for callers who already pass name-only.

---

## Phase 1: Unit Conversion Service

### Overview

Create `src/lib/unit-conversion.ts` with a single exported async function that converts one ingredient to grams. Handles: mass passthrough, Spoonacular call, OpenRouter fallback, and "missing" on total failure.

### Changes Required

#### 1. New file: unit conversion service

**File**: `src/lib/unit-conversion.ts`

**Intent**: Encapsulate all gram-conversion logic in one place so both the API route and any future callers use a single, testable function.

**Contract**: Export `convertToGrams(name: string, quantity: number, unit: string): Promise<number | "missing">`.

Logic order:
1. If unit is a mass unit, return `quantity × massMultiplier` directly.
2. Call `GET https://api.spoonacular.com/recipes/convert?ingredientName={name}&sourceAmount={quantity}&sourceUnit={unit}&targetUnit=grams&apiKey={SPOONACULAR_API_KEY}`. On success (HTTP 200, `answer` field contains the converted value as a number), return it.
3. On Spoonacular failure (non-200, network error, or missing `answer`): call OpenRouter with model `anthropic/claude-haiku-4-5`. Prompt: `"How many grams is 1 {unit} of {name}? Reply with only a JSON object: {\"gramsPerUnit\": <number>}"`. Multiply the returned `gramsPerUnit` by `quantity` and return.
4. On any unhandled error: return `"missing"`.

Spoonacular response shape: `{ answer: number, sourceAmount: number, targetAmount: number, ... }` — use `targetAmount` (the converted grams value).

#### 2. New env var

**File**: `.env.local` (documentation only — implementer adds the key)

**Intent**: Record that `SPOONACULAR_API_KEY` is required.

**Contract**: Add `SPOONACULAR_API_KEY=` to `.env.local` and to the `## Environment variables` section in `CLAUDE.md`.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- Call `convertToGrams("flour", 2, "cups")` in a test script — returns a number close to 240.
- Call `convertToGrams("salt", 1, "tsp")` — returns ~6.
- Call with a mass unit: `convertToGrams("butter", 100, "g")` — returns 100 without calling any API.
- With `SPOONACULAR_API_KEY` unset or returning 400: falls back to OpenRouter and still returns a number.

**Implementation Note**: Pause after this phase for manual confirmation before proceeding.

---

## Phase 2: Normalize-Units API Route

### Overview

Create `POST /api/normalize-units` — a thin route that accepts an ingredients array and returns an array of gram weights (one per ingredient, preserving index order).

### Changes Required

#### 1. New API route

**File**: `src/app/api/normalize-units/route.ts`

**Intent**: Expose the unit conversion service as an authenticated HTTP endpoint so `ParseFlow` can call it from the client.

**Contract**: `POST` with body `{ ingredients: Ingredient[] }`. Returns `{ weights: (number | "missing")[] }` — same length as `ingredients`, same index order. Calls `convertToGrams` for each ingredient in parallel (`Promise.all`). Auth check via Supabase (same pattern as `nutrition-summary/route.ts`).

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- `POST /api/normalize-units` with `[{name:"sugar", quantity:1, unit:"cup"}]` returns `{ weights: [~200] }`.
- Missing ingredient unit returns `{ weights: ["missing"] }` without crashing.

**Implementation Note**: Pause after this phase for manual confirmation before proceeding.

---

## Phase 3: USDA Scaling

### Overview

Update `fetchNutrients` to accept an optional `weightGrams` parameter and scale all numeric nutrient values by `weightGrams / 100`. Update `nutrition-summary` route to pass weights through.

### Changes Required

#### 1. Update `fetchNutrients` signature

**File**: `src/lib/nutrition.ts`

**Intent**: Enable callers to get weight-adjusted nutrient values instead of raw per-100g data.

**Contract**: Add optional second parameter `weightGrams?: number` to `fetchNutrients`. When provided and is a positive number, multiply every resolved numeric nutrient value by `weightGrams / 100` before returning. `"missing"` values remain `"missing"`. When `weightGrams` is absent or `undefined`, behavior is unchanged (raw per-100g — this preserves backwards compatibility).

Also change the USDA search query from `${name} ${quantity} ${unit}` to just `name` (the quantity+unit suffix was noise — USDA ignores it for nutrient lookups).

#### 2. Update `nutrition-summary` route to accept and pass weights

**File**: `src/app/api/nutrition-summary/route.ts`

**Intent**: Thread the resolved gram weights from the client through to `fetchNutrients` so scaling happens correctly.

**Contract**: Change request body type from `{ ingredients: Ingredient[] }` to `{ ingredients: Ingredient[], weights: (number | "missing")[] }`. The `query(i)` helper becomes name-only: `(i: Ingredient) => i.name`. Pass `typeof weights[idx] === "number" ? weights[idx] : undefined` as the second argument to `fetchNutrients`. Aggregation logic stays the same.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- `POST /api/nutrition-summary` with `[{name:"flour", qty:2, unit:"cups"}]` and `weights:[240]` returns energy ≈ `(flour_energy_per_100g × 240 / 100)` — verify against known flour energy (~364 kcal/100g → ~874 kcal for 240g).
- `weights:["missing"]` for an ingredient: nutrient values for that ingredient are all `"missing"`, which propagates to the aggregate total.

**Implementation Note**: Pause after this phase for manual confirmation before proceeding.

---

## Phase 4: UI Integration

### Overview

Wire `ParseFlow` to call `/api/normalize-units` before `/api/nutrition-summary`. Display resolved weights in a new read-only "Weight (g)" column in `IngredientEditor`.

### Changes Required

#### 1. Update `ParseFlow` confirm flow

**File**: `src/app/parse/ParseFlow.tsx`

**Intent**: Run normalization as the first step inside `handleConfirm`, hold the resolved weights in state, and pass them to both `IngredientEditor` (display) and `nutrition-summary` (calculation).

**Contract**: Add `weightGrams: (number | "missing" | null)[] | null` state (null = not yet normalized). In `handleConfirm`:
1. Set `fetchingNutrients(true)` as before.
2. Call `POST /api/normalize-units` with the current rows. On success, set `weightGrams` state.
3. Call `POST /api/nutrition-summary` with `{ ingredients: rows, weights }`.
4. Existing error handling and loading state unchanged.

Pass `weightGrams` down to `<IngredientEditor>` as a new optional prop.

#### 2. Add "Weight (g)" column to `IngredientEditor`

**File**: `src/app/parse/IngredientEditor.tsx`

**Intent**: Show the resolved gram weight for each ingredient row so the user can verify conversions before the nutrition summary appears.

**Contract**: Accept optional prop `weightGrams?: (number | "missing" | null)[] | null`. Add a "Weight (g)" `<th>` after the Unit column. In each row: if `weightGrams` is null (not yet resolved), show nothing; if `weightGrams[i]` is a number, show it rounded to 1 decimal; if `"missing"`, show `"?"`. The column is read-only (no input element). The remove button column stays last.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification

- Parse a recipe with "2 cups flour, 1 tsp salt". After clicking "Get nutritional summary": the Weight (g) column fills in with values (~240g for flour, ~6g for salt) before the nutrition summary appears.
- An ingredient with no matchable unit (e.g. "1 whole egg") shows "?" in the Weight column, and the nutrition summary still loads for the other ingredients.
- The nutrition total for flour (2 cups ≈ 240g) is visibly different from what it was before (which was an unscaled 100g value) — energy should be roughly 2.4× higher.
- No regressions: the parse flow still works end-to-end for a typical recipe.

**Implementation Note**: Pause after this phase for manual confirmation before proceeding.

---

## Testing Strategy

### Manual Testing Steps

1. Parse `"2 cups flour, 1 tbsp olive oil, 3 eggs"` — all three should normalize (eggs may fall back to OpenRouter).
2. Parse `"100g butter, 50g sugar"` — mass units bypass the conversion API; weight column shows 100 and 50 immediately.
3. Kill `SPOONACULAR_API_KEY` (set to empty string) — OpenRouter fallback should handle all conversions.
4. Use an unusual unit: `"a generous handful of spinach"` — expect OpenRouter to return a reasonable gram value.
5. Nutrition totals for `"2 cups flour"` should be approximately 874 kcal (240g × 364 kcal/100g), not 364 kcal (the old unscaled value).

## Performance Considerations

Normalization and nutrition-summary are sequential (normalize → then fetch), adding ~0.5–2s latency per LLM fallback call. Both internal API calls (`normalize-units` and `nutrition-summary`) already run per-ingredient in parallel with `Promise.all`, so overall latency is bounded by the slowest single ingredient, not the count.

## References

- API research: `context/changes/ingredient-unit-handling/api-documentation.md`
- Spoonacular Convert endpoint: `GET /recipes/convert` (see api-documentation.md, Option 1)
- OpenRouter integration pattern: `src/app/api/parse-recipe/route.ts`
- USDA nutrition service: `src/lib/nutrition.ts`
- Nutrition summary route: `src/app/api/nutrition-summary/route.ts`
- Ingredient editor: `src/app/parse/IngredientEditor.tsx`
- Parse flow: `src/app/parse/ParseFlow.tsx`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Unit Conversion Service

#### Automated

- [x] 1.1 TypeScript compilation passes: `npm run build`
- [x] 1.2 Linting passes: `npm run lint`

#### Manual

- [ ] 1.3 `convertToGrams("flour", 2, "cups")` returns ~240
- [ ] 1.4 `convertToGrams("salt", 1, "tsp")` returns ~6
- [ ] 1.5 Mass unit passthrough: `convertToGrams("butter", 100, "g")` returns 100
- [ ] 1.6 Spoonacular failure falls back to OpenRouter and returns a number

### Phase 2: Normalize-Units API Route

#### Automated

- [ ] 2.1 TypeScript compilation passes: `npm run build`
- [ ] 2.2 Linting passes: `npm run lint`

#### Manual

- [ ] 2.3 `POST /api/normalize-units` with sugar/1/cup returns `{ weights: [~200] }`
- [ ] 2.4 Unknown unit returns `{ weights: ["missing"] }` without crashing

### Phase 3: USDA Scaling

#### Automated

- [ ] 3.1 TypeScript compilation passes: `npm run build`
- [ ] 3.2 Linting passes: `npm run lint`

#### Manual

- [ ] 3.3 `nutrition-summary` with flour/2/cups + weight 240 returns energy ≈ 874 kcal
- [ ] 3.4 `weights:["missing"]` propagates to `"missing"` aggregate totals

### Phase 4: UI Integration

#### Automated

- [ ] 4.1 TypeScript compilation passes: `npm run build`
- [ ] 4.2 Linting passes: `npm run lint`

#### Manual

- [ ] 4.3 Weight (g) column fills in after clicking "Get nutritional summary"
- [ ] 4.4 Ingredient with unmatchable unit shows "?" and flow continues
- [ ] 4.5 Nutrition totals are visibly weight-scaled (flour ≈ 874 kcal for 2 cups)
- [ ] 4.6 No regressions in end-to-end parse flow
