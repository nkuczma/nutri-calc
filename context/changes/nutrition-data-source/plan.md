# Nutrition Data Source Client — Implementation Plan

## Overview

Implement `src/lib/nutrition.ts` — the F-02 USDA FoodData Central client. Takes an ingredient name, runs the two-step USDA search→detail fetch, and returns a fully-typed `IngredientNutrients` object (5 macros + 11 micros = 16 fields) where every field is `number | "missing"`. Verified via a temporary smoke-test route that confirms real API round-trips and correct nutrient IDs, then cleaned up. Unblocks S-01 and S-02.

## Current State Analysis

- `src/lib/supabase/` exists with `client.ts` and `server.ts` — the named-export factory function pattern to follow.
- `src/lib/nutrition.ts` does not exist.
- `NUTRITION_API_KEY` is documented in `CLAUDE.md` `.env.local` template but not yet populated in `.env.local`.
- `wrangler.jsonc` has `compatibility_date: 2025-04-01` + `nodejs_compat` — outbound `fetch()` is proven via the OAuth flow in `src/middleware.ts`.
- `tsconfig.json` has `strict: true` — `NutrientValue = number | "missing"` is fully type-safe.
- No test runner is configured (CLAUDE.md); the smoke-test route is the verification path.

### Key Discoveries:

- `src/lib/supabase/server.ts:4` — model for named export pattern: `export async function createClient()`
- `src/middleware.ts:14-44` — proof that Workers runtime handles external HTTP calls
- `wrangler.jsonc` has no `vars` section; production secrets use `wrangler secret put`, not the config file
- `api-docs.md` defines macro IDs as 2000-series (energy=2000, protein=2057, fat=2058, carbs=2059, fiber=2067); USDA FDC documentation for micros uses 1000-series (calcium=1087, iron=1089, etc.) — the smoke test resolves any mismatch

## Desired End State

`src/lib/nutrition.ts` exports `fetchNutrients(ingredientName: string): Promise<IngredientNutrients>`, `NutrientValue`, `IngredientNutrients`, and `NutritionApiError`. Any S-01 or S-02 Server Action can call `fetchNutrients('chicken breast')` and receive a typed result where every field is `number | "missing"`, never `0` for absent data, and `NutritionApiError` propagates for API failures. The USDA API key is wired locally and a real round-trip has been confirmed.

**Verification**: `GET /api/nutrition-smoke-test` with a valid API key in `.env.local` must return numeric values for common macros of "chicken breast" and `"missing"` (not `0`) for any absent nutrient.

## What We're NOT Doing

- No Supabase nutrient snapshot caching — that belongs to F-03 (recipes-schema-rls)
- No batch ingredient export — callers use `Promise.all()` for multiple ingredients
- No retry-with-backoff — `NutritionApiError` propagates to callers for UX policy decisions
- No test runner setup — CLAUDE.md scopes that separately; smoke test is sufficient for F-02
- No `wrangler.jsonc` `vars` change — `NUTRITION_API_KEY` is a secret deployed via `wrangler secret put`

## Implementation Approach

Single server-side file (`src/lib/nutrition.ts`) that encapsulates the entire USDA integration. Internal API response types and the `NUTRIENT_IDS` constant map are unexported — only the typed public surface (`NutrientValue`, `IngredientNutrients`, `NutritionApiError`, `fetchNutrients`) is exported. The `NUTRIENT_IDS` constant is the single place to correct nutrient IDs after the smoke test.

## Critical Implementation Details

**Nutrient ID uncertainty**: `api-docs.md` (sourced from USDA documentation via Context7) gives 2000-series IDs for macros (energy=2000, protein=2057, fat=2058, carbs=2059, fiber=2067). USDA FDC documentation for micros uses 1000-series IDs (calcium=1087, iron=1089, etc.). These are from different sources and may reflect Foundation vs. SR Legacy differences. The smoke test MUST include `rawNutrients` (the raw `nutrients[]` array from the API response) and the implementer must cross-check every ID in `NUTRIENT_IDS` against what the real API returns for a Foundation/SR Legacy food. Correct any mismatches before deleting the route.

---

## Phase 1: Client implementation + env wiring

### Overview

Create `src/lib/nutrition.ts` with the full TypeScript contract and the two-step USDA fetch function. Wire `NUTRITION_API_KEY` into `.env.local` for local development.

### Changes Required:

#### 1. Nutrition client

**File**: `src/lib/nutrition.ts`

**Intent**: Define the typed USDA FoodData Central client for server-side use only. All USDA API calls in the codebase flow through this file. No Next.js-specific imports, no `export const runtime = 'edge'` directive needed.

**Contract**: Exports:
- `type NutrientValue = number | "missing"`
- `interface IngredientNutrients` — 16 fields (5 macros + 11 micros, all `NutrientValue`):
  - macros: `energy` (kcal), `protein` (g), `fat` (g), `carbs` (g), `fiber` (g)
  - micros: `sodium` (mg), `calcium` (mg), `iron` (mg), `vitaminC` (mg), `vitaminD` (µg), `zinc` (mg), `potassium` (mg), `vitaminB12` (µg), `folate` (µg), `magnesium` (mg), `phosphorus` (mg)
- `class NutritionApiError extends Error` — wraps fetch/HTTP failures; includes optional `status?: number`
- `async function fetchNutrients(ingredientName: string): Promise<IngredientNutrients>`

Unexported internals:
- `interface ApiNutrient { id: number; amount: number; unitName: string }` and minimal search/food response types
- `const NUTRIENT_IDS: Record<keyof IngredientNutrients, number>` — the single source of truth for the ID mapping; initial values from `api-docs.md` macros and USDA FDC micros documentation, to be verified via smoke test
- `function resolveNutrient(nutrients: ApiNutrient[], id: number): NutrientValue` — returns `found.amount` if present, `"missing"` if absent

`fetchNutrients` flow:
- Step 1: `GET https://api.nal.usda.gov/fdc/v1/foods/search?query={name}&dataType=Foundation,SR Legacy&pageSize=1&api_key={NUTRITION_API_KEY}`
- If `foods` array is empty → return `IngredientNutrients` with every field set to `"missing"`
- Step 2: `GET https://api.nal.usda.gov/fdc/v1/food/{fdcId}?api_key={NUTRITION_API_KEY}`
- Build `IngredientNutrients` by calling `resolveNutrient(food.nutrients, NUTRIENT_IDS[field])` for each field
- On `fetch()` rejection or non-2xx from either call: throw `new NutritionApiError(message, response?.status)`

#### 2. API key in `.env.local`

**File**: `.env.local`

**Intent**: Enable local development calls to USDA FoodData Central. This is a manual prerequisite — register at https://fdc.nal.usda.gov/api-key-signup (free, immediate) before the smoke test can run.

**Contract**: Add `NUTRITION_API_KEY=<your-key>` under the existing `# Nutrition API` comment block.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`

#### Manual Verification:

- `src/lib/nutrition.ts` exists with no TypeScript errors visible in the editor
- `.env.local` contains a real (non-empty) `NUTRITION_API_KEY` value

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Smoke test + cleanup

### Overview

Create a temporary route that exercises all three `fetchNutrients()` paths against the real USDA API. Inspect raw nutrient IDs, correct any mismatches in `NUTRIENT_IDS`. Delete the route. Update roadmap and change status.

### Changes Required:

#### 1. Temporary smoke-test route

**File**: `src/app/api/nutrition-smoke-test/route.ts`

**Intent**: Verify the full round-trip (env var → USDA search → fdcId → nutrient fetch → typed result) and expose the raw `nutrients[]` array so the implementer can confirm `NUTRIENT_IDS` values match what the real API returns.

**Contract**: `GET /api/nutrition-smoke-test` returns a JSON response with three keys:
- `knownIngredient` — `IngredientNutrients` for `"chicken breast"` (common macros must be numeric)
- `unknownIngredient` — `IngredientNutrients` for `"xyzabc123"` (all fields must be `"missing"`)
- `rawNutrients` — the raw `nutrients[]` array from step 2 of the `"chicken breast"` fetch, for ID verification

Catch `NutritionApiError` and return it as `{ error: err.message, status: err.status }` so the error path is testable without crashing the route.

#### 2. Corrections to `NUTRIENT_IDS` (if needed)

**File**: `src/lib/nutrition.ts`

**Intent**: After cross-checking `rawNutrients` in the smoke-test response against the `NUTRIENT_IDS` constant, correct any ID values that do not match the actual API `id` field. A mismatch causes `resolveNutrient()` to return `"missing"` for data that genuinely exists in the USDA database.

**Contract**: Every value in `NUTRIENT_IDS` must match an `id` that appears in the `rawNutrients` array for a real Foundation or SR Legacy food. After corrections, re-verify that `knownIngredient.energy`, `.protein`, `.fat`, and `.carbs` are all numeric.

#### 3. Delete the smoke-test route

**File**: `src/app/api/nutrition-smoke-test/route.ts`

**Intent**: Remove the temporary route before committing F-02 — it exposes the raw API response and internal ID mapping.

**Contract**: File is deleted. `npm run build` passes after deletion.

#### 4. Update change and roadmap status

**Files**: `context/changes/nutrition-data-source/change.md`, `context/foundation/roadmap.md`

**Intent**: Record F-02 as complete so S-01 and S-02 planning can proceed.

**Contract**: Set `status: done` in `change.md`. In `roadmap.md`: update the F-02 row in the At-a-Glance table and Backlog Handoff table to `done`. Update the Baseline section — change the Nutrition API entry from "absent" to "present — `src/lib/nutrition.ts`, USDA FoodData Central".

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `GET /api/nutrition-smoke-test` returns numeric macros for "chicken breast"
- `unknownIngredient` returns all-`"missing"` fields (string, not `0`)
- `rawNutrients` confirms `NUTRIENT_IDS` match actual API `id` values
- Error path: with `NUTRITION_API_KEY` temporarily removed, the route returns `{ error: ..., status: ... }` (not a crash)
- Smoke-test route is deleted from the filesystem
- `npm run build` passes after route deletion

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

No test runner configured (CLAUDE.md says "add one before writing tests"). When a runner is added, the primary targets are: `resolveNutrient()` with present and absent nutrient, `fetchNutrients()` no-match path (empty `foods[]`), and `NutritionApiError` propagation on non-2xx response.

### Manual Testing Steps:

1. Start dev server: `npm run dev`
2. Open `http://localhost:3000/api/nutrition-smoke-test`
3. Confirm `knownIngredient` has numeric `energy`, `protein`, `fat`, `carbs`
4. Confirm `unknownIngredient` has every field as the string `"missing"`, not `0`
5. Inspect `rawNutrients` and cross-check every ID against `NUTRIENT_IDS` in `nutrition.ts`
6. Correct any mismatched IDs, restart dev server, re-verify
7. Temporarily remove `NUTRITION_API_KEY` from `.env.local`, reload page, confirm error JSON is returned
8. Restore the API key
9. Delete `src/app/api/nutrition-smoke-test/route.ts`
10. Confirm `npm run build` passes

## Performance Considerations

Two sequential USDA HTTP calls per ingredient is acceptable at MVP scale (1,000 req/hr limit is generous for dozens of recipes). Per-ingredient Supabase caching (avoiding repeat calls for the same ingredient name) belongs to F-03 and is explicitly out of scope here.

## References

- Related research: `context/changes/api-nutrition-review/research.md`
- API documentation: `context/changes/api-nutrition-review/api-docs.md`
- API selection rationale: `context/changes/api-nutrition-review/api-review.md`
- Export pattern model: `src/lib/supabase/server.ts:4`
- Workers fetch proof: `src/middleware.ts:14-44`
- Macro nutrient IDs: `context/changes/api-nutrition-review/api-docs.md` (energy=2000, protein=2057, fat=2058, carbs=2059, fiber=2067 — verify via smoke test)
- Micro nutrient IDs: USDA FDC API (sodium=1093, calcium=1087, iron=1089, vitaminC=1162, vitaminD=1114, zinc=1095, potassium=1092, vitaminB12=1178, folate=1186, magnesium=1090, phosphorus=1091)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Client implementation + env wiring

#### Automated

- [x] 1.1 Type checking passes: `npx tsc --noEmit` — 4cd6f1d
- [x] 1.2 Linting passes: `npm run lint` — 4cd6f1d

#### Manual

- [x] 1.3 `src/lib/nutrition.ts` exists with no TypeScript errors — 4cd6f1d
- [x] 1.4 `.env.local` contains a real `NUTRITION_API_KEY` value — 4cd6f1d

### Phase 2: Smoke test + cleanup

#### Automated

- [x] 2.1 Type checking passes: `npx tsc --noEmit` — c694d5e
- [x] 2.2 Linting passes: `npm run lint` — c694d5e
- [x] 2.3 Build passes: `npm run build` — c694d5e

#### Manual

- [x] 2.4 `GET /api/nutrition-smoke-test` returns numeric macros for "chicken breast" — c694d5e
- [x] 2.5 "xyzabc123" returns all-`"missing"` fields (string, not `0`) — c694d5e
- [x] 2.6 `rawNutrients` confirms `NUTRIENT_IDS` match actual API `id` values — c694d5e
- [x] 2.7 Bad-key path returns error JSON (not a crash) — c694d5e
- [x] 2.8 Smoke-test route deleted from filesystem — c694d5e
- [x] 2.9 `npm run build` passes after route deletion — c694d5e
