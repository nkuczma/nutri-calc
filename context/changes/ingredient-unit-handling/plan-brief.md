# Ingredient Unit Normalization & Weight-Based Nutrition — Plan Brief

> Full plan: `context/changes/ingredient-unit-handling/plan.md`
> Research: `context/changes/ingredient-unit-handling/api-documentation.md`

## What & Why

Between recipe parse and nutrition summary, NutriCalc currently passes a string like `"flour 2 cups"` to USDA, which returns nutrients per 100g and ignores the quantity entirely — all totals are unscaled and wrong. This plan adds a normalization step that converts volume units to grams, then scales USDA data by `weightGrams / 100` to produce accurate nutrient totals.

## Starting Point

`src/lib/nutrition.ts:fetchNutrients` searches USDA with the full ingredient string and returns raw per-100g values. `src/app/api/nutrition-summary/route.ts` sums those values directly with no weight scaling. No unit conversion service exists anywhere in the codebase.

## Desired End State

When the user clicks "Get nutritional summary", each ingredient shows a gram weight in the editor table (or "?" for unresolvable units). Nutrition totals reflect actual quantities: 2 cups of flour yields ~874 kcal, not 364.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Primary conversion API | Spoonacular Convert Amounts | Genuinely free (9k req/mo), dedicated cup→grams endpoint, measured density data | Research |
| Fallback | OpenRouter / Claude Haiku | No new API key; handles unusual units like "handful" | Research |
| Normalization trigger | On "Get nutritional summary" click | Avoids extra round-trip during parse; simpler state machine | Plan |
| Partial failure handling | Show "?" for failed, proceed with rest | Matches existing "missing" convention; doesn't block on one unusual ingredient | Plan |
| Grams display | New read-only column in IngredientEditor | User sees all ingredient data in one table | Plan |
| DB persistence | None — calculate on demand | No migration needed for MVP | Plan |

## Scope

**In scope:** Volume-to-gram conversion (Spoonacular + OpenRouter fallback), mass unit passthrough (g/kg/oz/lb), gram weight column in editor, USDA scaling by weight, new `SPOONACULAR_API_KEY` env var.

**Out of scope:** DB storage of gram weights, editing gram weights in the UI, re-normalization after user edits, serving-size concepts.

## Architecture / Approach

```
ParseFlow.handleConfirm(rows)
  → POST /api/normalize-units          ← new
      → convertToGrams() per ingredient  ← new (lib/unit-conversion.ts)
          → Spoonacular Convert Amounts
          → fallback: OpenRouter Claude Haiku
  → weightGrams[] passed to IngredientEditor (display column)  ← updated
  → POST /api/nutrition-summary { ingredients, weights }       ← updated
      → fetchNutrients(name, weightGrams) per ingredient       ← updated
          → USDA search by name only
          → nutrients × (weightGrams / 100)
  → NutritionalSummary (totals)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Unit Conversion Service | `convertToGrams()` in `src/lib/unit-conversion.ts` | OpenRouter prompt needs tight JSON contract to avoid parse failures |
| 2. Normalize-Units Route | `POST /api/normalize-units` HTTP endpoint | Auth pattern must match existing routes |
| 3. USDA Scaling | `fetchNutrients` accepts weightGrams, `nutrition-summary` threads weights | Backwards compat for callers without weight (raw per-100g) |
| 4. UI Integration | Weight column in editor, wired ParseFlow | State ordering: normalize must complete before nutrition-summary fires |

**Prerequisites:** Spoonacular API key obtained and added to `.env.local`  
**Estimated effort:** ~2 sessions across 4 phases

## Open Risks & Assumptions

- Spoonacular may not recognize every ingredient name (particularly non-English names or brand names) — OpenRouter fallback covers most cases.
- OpenRouter LLM gram estimates are approximations, not lab-measured. Acceptable for home-cooking context per research doc.
- Ingredients with no unit (e.g. "3 eggs") will rely on OpenRouter to return a reasonable per-egg gram value.

## Success Criteria (Summary)

- Parsing `"2 cups flour"` yields an energy total of ~874 kcal (was ~364 kcal unscaled).
- Every ingredient shows a gram weight (or "?") in the editor before the nutrition summary appears.
- A recipe with an unusual unit (e.g. "a knob of butter") still produces a nutrition summary via the OpenRouter fallback.
