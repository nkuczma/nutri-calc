# Nutrition Data Source Client — Plan Brief

> Full plan: `context/changes/nutrition-data-source/plan.md`
> Research: `context/changes/api-nutrition-review/research.md`

## What & Why

F-02 gates the north star (S-01) and the manual entry path (S-02). This plan implements `src/lib/nutrition.ts` — the USDA FoodData Central client that all recipe nutrition lookups flow through. The deliverable is a strict TypeScript contract where every nutrient is either a number or an explicit `"missing"` flag — never a silent zero. That invariant is the product's core differentiator and must be enforced at the API boundary.

## Starting Point

`src/lib/nutrition.ts` does not exist. `NUTRITION_API_KEY` is documented in CLAUDE.md but not yet populated in `.env.local`. The Workers runtime already handles outbound `fetch()` (proven by the OAuth flow in `src/middleware.ts`), and the API source was selected in `api-nutrition-review/api-review.md`: USDA FoodData Central, free, CC0, caching allowed.

## Desired End State

`fetchNutrients('chicken breast')` returns a typed `IngredientNutrients` with 16 fields — 5 macros (energy, protein, fat, carbs, fiber) + 11 micros (sodium, calcium, iron, vitaminC, vitaminD, zinc, potassium, vitaminB12, folate, magnesium, phosphorus). Absent nutrients are `"missing"`, never `0`. Unknown ingredients return all-missing. API failures throw `NutritionApiError`. S-01 and S-02 can depend on this contract directly.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Nutrition API | USDA FoodData Central | Free, CC0, excellent whole-food micronutrient coverage, caching allowed | Research |
| Nutrient scope | Macros + common micros (16 fields) | Covers health-tracking essentials from day 1 without guessing which micros are reliably present | Plan |
| No-match behavior | Return all-missing object | Preserves the typed contract at every call site — callers never handle null or exceptions for the expected no-match case | Plan |
| API failure behavior | Wrap + re-throw `NutritionApiError` | Recovery policy belongs at the S-01/S-02 caller layer, not the client | Plan |
| API surface | Single `fetchNutrients()` only | USDA batch endpoint still requires per-ingredient step 1; no real saving at MVP scale | Plan |
| Testing | Smoke test via temporary route | No test runner configured (CLAUDE.md); real round-trip proves env var + fetch + types in one pass | Plan |
| File structure | `src/lib/nutrition.ts` (flat) | Only one variant (server) needed — no browser client, no subdirectory | Research |

## Scope

**In scope:**
- `src/lib/nutrition.ts` — typed client with `fetchNutrients()`, `NutrientValue`, `IngredientNutrients`, `NutritionApiError`
- `.env.local` — `NUTRITION_API_KEY` for local dev (manual step: register at USDA API portal)
- Smoke-test route (temporary, deleted after verification)
- Roadmap status update (F-02 → done)

**Out of scope:**
- Supabase nutrient snapshot caching (F-03)
- Batch ingredient fetch export
- Retry-with-backoff logic
- Test runner setup
- `wrangler.jsonc` `vars` change (secrets use `wrangler secret put` separately)

## Architecture / Approach

`src/lib/nutrition.ts` is a pure server-side fetch wrapper with no Next.js or framework coupling. Internal types (`ApiNutrient`, response shapes) and the `NUTRIENT_IDS` constant map are unexported. `NUTRIENT_IDS` is the single source of truth for the macro/micro ID mapping — the only thing that may need correction after the smoke test confirms actual IDs against the API response.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Client + env wiring | `src/lib/nutrition.ts` with full typed contract + `.env.local` API key | Nutrient IDs (2000-series macros from api-docs.md vs 1000-series micros from USDA FDC docs) may not match the actual API response |
| 2. Smoke test + cleanup | Verified round-trip, corrected IDs, route deleted, roadmap updated | If macro IDs are wrong, common fields like energy and protein silently return "missing" |

**Prerequisites:** USDA API key from https://fdc.nal.usda.gov/api-key-signup (free, immediate)
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- **Nutrient ID mismatch**: `api-docs.md` uses 2000-series for macros; USDA FDC documentation gives 1000-series for most nutrients. The smoke test is the resolution gate — without inspecting `rawNutrients`, silent `"missing"` results for real data are undetectable.
- **USDA search relevance**: `foods[0]` may not always be the best match for unusual ingredient names. MVP scope is English ingredient names from standard recipes — acceptable at this stage.

## Success Criteria (Summary)

- `fetchNutrients('chicken breast')` returns numeric macros and no silent zeros
- `fetchNutrients('xyzabc123')` returns all-`"missing"` (never `0`)
- `NutritionApiError` is thrown — not swallowed — when the API is unreachable
