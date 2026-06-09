---
date: 2026-06-09T00:00:00+00:00
researcher: nkuczma
git_commit: 80bfc587c2e08219f5daede4c3e9ff01cca59ce0
branch: main
repository: nutri-calc
topic: "Risk #1 — Missing-flag invariant: where enforcement lives and what can break it"
tags: [research, missing-flag, nutrition, invariant, testing]
status: complete
last_updated: 2026-06-09
last_updated_by: nkuczma
last_updated_note: "Resolved open question — macro zero-default is accepted policy"
---

# Research: Risk #1 — Missing-flag invariant

**Date**: 2026-06-09
**Researcher**: nkuczma
**Git Commit**: 80bfc587c2e08219f5daede4c3e9ff01cca59ce0
**Branch**: main
**Repository**: nutri-calc

## Research Question

Where does missing-flag enforcement live in the data flow (nutrition client → summary computation)? Is it enforced at multiple layers? What could cause a nutrient that should show "missing" to be silently displayed as 0?

## Summary

The missing-flag invariant is expressed through a union type `NutrientValue = number | "missing"` that flows from the nutrition client through aggregation, DB persistence, and display. Enforcement is present at four explicit layers (extraction, DB boundary, aggregation, UI).

**Accepted policy (confirmed):** The four macro fields — energy, protein, fat, carbs — treat absent API data as `0`, not `"missing"`. This is a deliberate UX exception. `scaledMacro()` at `src/lib/nutrition.ts:180–183` is correct as-is.

**The invariant applies to the remaining five nutrients:** saturatedFat, fiber, sugars, salt, sodium. These must never silently zero — any absent API field must propagate as `"missing"` through extraction, aggregation, DB round-trip, and display.

The oracle for tests: given an ingredient where a non-macro nutrient is absent from the API response, the displayed summary must show `"missing"` (rendered as `—`), never `0`.

## Detailed Findings

### Layer 1 — Type contract (`src/lib/nutrition.ts:4–20`)

```typescript
export type NutrientValue = number | "missing";

export interface IngredientNutrients {
  energy: NutrientValue;
  protein: NutrientValue;
  fat: NutrientValue;
  saturatedFat: NutrientValue;
  carbs: NutrientValue;
  fiber: NutrientValue;
  sugars: NutrientValue;
  salt: NutrientValue;
  sodium: NutrientValue;
}
```

Every nutrient field is `number | "missing"` — the type system prohibits bare `null` or `undefined`. This is correct.

### Layer 2 — API extraction (`src/lib/nutrition.ts:60–82`)

`num()` helper (line 60–62):
```typescript
function num(v: number | undefined): NutrientValue {
  return typeof v === "number" && isFinite(v) ? v : "missing";
}
```

`extractNutrients()` calls `num()` for every field, correctly mapping absent or non-finite API values to `"missing"`. Sodium has special derivation logic (line 74–79) but still routes through `num()`.

**Correct at this layer for normal responses.**

### Layer 3 — EMPTY_NUTRIENTS bug (`src/lib/nutrition.ts:83–93`, triggered at line 122`)

When `products.length === 0` (API found nothing for an ingredient), the function returns:

```typescript
const EMPTY_NUTRIENTS: IngredientNutrients = {
  energy: 0,           // BUG: should be "missing"
  protein: 0,          // BUG: should be "missing"
  fat: 0,              // BUG: should be "missing"
  saturatedFat: "missing",
  carbs: 0,            // BUG: should be "missing"
  fiber: "missing",
  sugars: "missing",
  salt: "missing",
  sodium: "missing",
};
```

Energy, protein, fat, and carbs silently display as 0 for any ingredient the API cannot find. This is a direct invariant violation.

**Oracle says:** all nine fields should be `"missing"` when no product is found.

### Layer 4 — scaledMacro conversion (`src/lib/nutrition.ts:180–183`, applied at lines 186–190`)

After extraction (for normal responses), scaling converts macros:

```typescript
function scaledMacro(value: NutrientValue): NutrientValue {
  if (value === "missing") return 0;  // converts "missing" → 0
  return scaled(value);
}
```

Applied to: `energy`, `protein`, `fat`, `carbs`. Non-macros use `scaled()` which preserves `"missing"`.

This means even if `extractNutrients()` correctly marks a macro as `"missing"` (e.g. the API product has no energy field), `scaledMacro` converts it to `0` before it reaches the summary. The comment at line 10 (`// macros (absent → 0, not "missing")`) documents this as intentional, but it directly contradicts CLAUDE.md and FR-006.

**This is the primary code path the test must challenge.**

### Layer 5 — Aggregation (`src/app/api/nutrition-summary/route.ts:42–51`)

```typescript
const total: NutrientValue = values.some((v) => v === "missing")
  ? "missing"
  : (values as number[]).reduce((sum, v) => sum + v, 0);
```

If **any** ingredient contributes `"missing"` for a nutrient, the total is `"missing"`. Correct rule — but upstream bugs (EMPTY_NUTRIENTS, scaledMacro) mean macros rarely arrive as `"missing"` here.

### Layer 6 — DB boundary (`src/lib/db/recipes.ts:20–26`)

```typescript
function nullToMissing(v: number | null): number | "missing" {
  return v === null ? "missing" : v;
}
function missingToNull(v: number | "missing"): number | null {
  return v === "missing" ? null : v;
}
```

Correct bidirectional mapping. If `"missing"` reaches this layer it is stored as SQL `NULL` and correctly restored on read. No coercion to 0 here.

### Layer 7 — UI display (`src/app/parse/NutritionalSummary.tsx:41–42`)

```typescript
{value === 'missing' ? (
  <span className="text-gray-400">—</span>
) : (
  <span>{typeof value === 'number' ? value.toFixed(1) : value} {unit}</span>
)}
```

Correctly renders `"missing"` as `—`. Same pattern in `src/app/recipes/[id]/RecipeDetailView.tsx:120`.

## Code References

- [`src/lib/nutrition.ts:4–20`](https://github.com/nkuczma/nutri-calc/blob/80bfc587c2e08219f5daede4c3e9ff01cca59ce0/src/lib/nutrition.ts#L4) — `NutrientValue` type and `IngredientNutrients` interface
- [`src/lib/nutrition.ts:60–62`](https://github.com/nkuczma/nutri-calc/blob/80bfc587c2e08219f5daede4c3e9ff01cca59ce0/src/lib/nutrition.ts#L60) — `num()` helper (undefined → "missing")
- [`src/lib/nutrition.ts:83–93`](https://github.com/nkuczma/nutri-calc/blob/80bfc587c2e08219f5daede4c3e9ff01cca59ce0/src/lib/nutrition.ts#L83) — **`EMPTY_NUTRIENTS` with silent zeros** (invariant violation)
- [`src/lib/nutrition.ts:122`](https://github.com/nkuczma/nutri-calc/blob/80bfc587c2e08219f5daede4c3e9ff01cca59ce0/src/lib/nutrition.ts#L122) — `if (products.length === 0) return EMPTY_NUTRIENTS`
- [`src/lib/nutrition.ts:180–183`](https://github.com/nkuczma/nutri-calc/blob/80bfc587c2e08219f5daede4c3e9ff01cca59ce0/src/lib/nutrition.ts#L180) — **`scaledMacro()` converts "missing" → 0** (invariant violation)
- [`src/lib/nutrition.ts:186–190`](https://github.com/nkuczma/nutri-calc/blob/80bfc587c2e08219f5daede4c3e9ff01cca59ce0/src/lib/nutrition.ts#L186) — `scaledMacro` applied to energy, protein, fat, carbs
- [`src/lib/nutrition.ts:191–194`](https://github.com/nkuczma/nutri-calc/blob/80bfc587c2e08219f5daede4c3e9ff01cca59ce0/src/lib/nutrition.ts#L191) — `scaled()` preserves "missing" for non-macros
- [`src/app/api/nutrition-summary/route.ts:42–51`](https://github.com/nkuczma/nutri-calc/blob/80bfc587c2e08219f5daede4c3e9ff01cca59ce0/src/app/api/nutrition-summary/route.ts#L42) — aggregation rule (any "missing" → total "missing")
- [`src/lib/db/recipes.ts:20–26`](https://github.com/nkuczma/nutri-calc/blob/80bfc587c2e08219f5daede4c3e9ff01cca59ce0/src/lib/db/recipes.ts#L20) — `nullToMissing` / `missingToNull` adapters
- [`src/app/parse/NutritionalSummary.tsx:41–42`](https://github.com/nkuczma/nutri-calc/blob/80bfc587c2e08219f5daede4c3e9ff01cca59ce0/src/app/parse/NutritionalSummary.tsx#L41) — UI renders "missing" as "—"

## Architecture Insights

**The invariant is structurally sound but broken in two specific code paths:**

The type system (`NutrientValue = number | "missing"`) and DB boundary (null ↔ "missing") correctly model the invariant. The failure modes are both in `src/lib/nutrition.ts` and both affect the same four macro nutrients: energy, protein, fat, carbs.

**Enforcement layers summary:**

| Layer | File | Status |
|---|---|---|
| Type contract | `src/lib/nutrition.ts:4–20` | ✓ Correct |
| API extraction (`num()`) | `src/lib/nutrition.ts:60–62` | ✓ Correct |
| No-product fallback | `src/lib/nutrition.ts:83–93` | ✗ Silently zeros macros |
| Macro scaling | `src/lib/nutrition.ts:180–183` | ✗ Converts "missing" → 0 for macros |
| Non-macro scaling | `src/lib/nutrition.ts:191–194` | ✓ Preserves "missing" |
| Aggregation | `src/app/api/nutrition-summary/route.ts:46` | ✓ Correct |
| DB write | `src/lib/db/recipes.ts:42–54` | ✓ Correct |
| DB read | `src/lib/db/recipes.ts:28–40` | ✓ Correct |
| UI render | `src/app/parse/NutritionalSummary.tsx:41–42` | ✓ Correct |

## Historical Context (from prior changes)

- `context/changes/paste-parse-summary/plan.md:207–209` — Aggregation missing-flag invariant contract documented: "if any result has 'missing' for that key the total is 'missing'"
- `context/changes/api-nutrition-review/research.md:125–136` — Prior API research established that absent API entries mean genuinely missing data, never zero; `resolveNutrient()` approach described
- `context/changes/recipes-schema-rls/change.md` — Schema design decision: 16 nullable NUMERIC columns; NULL = absent; TypeScript boundary adapter maps null ↔ "missing"

## Resolved Decisions

**`scaledMacro()` is accepted policy (confirmed 2026-06-09):**
Energy, protein, fat, and carbs absent from the API response are treated as `0`, not `"missing"`. This is a deliberate UX exception — these four macros are considered too central to show as absent; a zero is acceptable when data is unavailable. The CLAUDE.md invariant applies to all other nutrients (saturatedFat, fiber, sugars, salt, sodium), which must never silently zero.

This means the invariant is correctly stated as:
> **Non-macro nutrients (saturatedFat, fiber, sugars, salt, sodium): absent from API → MUST be `"missing"`, never `0`.**
> **Macro nutrients (energy, protein, fat, carbs): absent from API → `0` is acceptable.**

## Open Questions

1. **Should `EMPTY_NUTRIENTS` macros stay `0`?** With the macro exception confirmed, `EMPTY_NUTRIENTS` returning `energy: 0`, `protein: 0`, `fat: 0`, `carbs: 0` when no product is found is now consistent with the accepted policy. The four `"missing"` fields (saturatedFat, fiber, sugars, salt, sodium) in `EMPTY_NUTRIENTS` are correct. No code change needed here.

2. **Is there a Zod validation layer for nutrition API responses?** Currently `num()` is the only guard. A Zod schema would make the extraction contract explicit and testable in isolation — worth considering in the plan phase but not a blocker.
