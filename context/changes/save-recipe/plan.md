# Save Recipe (S-03) Implementation Plan

## Overview

Complete FR-007: both the AI parse flow and the manual entry flow can save a recipe to Supabase. Save is atomic (single Postgres transaction). After saving, the user lands on `/recipes`.

## Current State Analysis

The `manual-recipe-entry` change shipped a working `saveRecipe()` Server Action and a `/recipes` list page, but:
- `saveRecipe()` does two separate `.insert()` calls — not atomic; a mid-flight failure leaves an orphaned recipe row
- `ParseFlow` (`src/app/parse/ParseFlow.tsx`) has no title input, no `perIngredientNutrients` capture, and no Save button — AI-parsed recipes cannot be saved

What IS ready to reuse:
- `saveRecipe()` in `src/app/actions/recipes.ts` — signature is correct; only the internals need to change
- `/api/nutrition-summary` already returns `perIngredient` in its response; `ParseFlow` ignores it
- `totalsToRecipeColumns()` and `nutrientsToIngredientColumns()` in `src/lib/db/recipes.ts` — produce the exact JSON keys the RPC will consume
- `ManualEntryFlow` already redirects to `/recipes` on success — no change needed

## Desired End State

A signed-in user can save a recipe from either the AI parse flow or the manual entry flow. Both flows redirect to `/recipes` on success. The save is atomic: if the ingredient insert fails, no recipe row is created. `ManualEntryFlow` behaviour is unchanged from the user's perspective (it still redirects to `/recipes`).

### Key Discoveries

- `recipes` table: `id`, `user_id`, `title`, `raw_text` (nullable), nine `total_*` NUMERIC columns, `created_at` — `src/lib/db/recipes.ts:14-18`
- `recipe_ingredients` table: `id`, `recipe_id`, `name`, `quantity`, `unit`, nine nutrient NUMERIC columns (no `total_` prefix), `created_at` — `src/lib/db/recipes.ts:4-6`
- Latest migration is `supabase/migrations/20260603000000_off_nutrient_schema.sql` — new migration filename must sort after this
- `ParseFlow` state: has `nutrients` but not `perIngredientNutrients` or `confirmedRows`; `handleConfirm` never stores the rows it receives — `src/app/parse/ParseFlow.tsx:42-75`

## What We're NOT Doing

- No `/recipes/[id]` detail page — redirect target is the existing `/recipes` list
- No edit or delete (FR-009, FR-010)
- No per-serving adjustment
- No changes to `NutritionalSummary` or `IngredientEditor`

## Implementation Approach

Phase 1 adds a `SECURITY DEFINER` Postgres function `save_recipe` that wraps both inserts in one transaction and returns the new recipe UUID. The Server Action is updated to call this RPC instead of two separate inserts.

Phase 2 adds Save to `ParseFlow`: a title input and Save button appear below the nutritional summary, wired to the existing `saveRecipe()` action.

## Critical Implementation Details

**RPC SECURITY DEFINER:** The `save_recipe` Postgres function must be `SECURITY DEFINER` so it can insert rows while bypassing RLS. `p_user_id` must always be sourced from `supabase.auth.getUser()` in the Server Action — never from client input. Also set `search_path = public` on the function to prevent search-path injection.

**JSONB null handling in RPC:** `(p_totals->>'total_energy')::numeric` evaluates to SQL `NULL` when the key is absent or its value is JSON `null` — which is exactly what we want for missing nutrients. No special casing needed.

**ParseFlow does not need `key` reset:** The `IngredientEditor` is already keyed to `parseRound` in `ParseFlow`; do not add another key or force-remount. `confirmedRows` and `perIngredientNutrients` should be reset to `null` in `handleParse` (when a new parse starts) so stale data does not persist across re-parses.

---

## Phase 1: Atomic Save via Postgres RPC

### Overview

Replace the two-step insert in `saveRecipe()` with a single `supabase.rpc('save_recipe', …)` call backed by a new `SECURITY DEFINER` Postgres function. Both insert statements run in the same implicit transaction; a failure in either leaves no partial data.

### Changes Required

#### 1. Postgres migration

**File:** `supabase/migrations/20260603130000_save_recipe_rpc.sql`

**Intent:** Create the `save_recipe` Postgres function that atomically inserts a recipe row and all ingredient rows and returns the new recipe UUID.

**Contract:** Function signature and body — include as a snippet because the JSONB extraction syntax and SECURITY DEFINER setup are non-obvious:

```sql
CREATE OR REPLACE FUNCTION public.save_recipe(
  p_user_id     uuid,
  p_title       text,
  p_raw_text    text,
  p_totals      jsonb,
  p_ingredients jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO recipes (
    user_id, title, raw_text,
    total_energy, total_protein, total_fat, total_saturated_fat,
    total_carbs, total_fiber, total_sugars, total_salt, total_sodium
  ) VALUES (
    p_user_id, p_title, p_raw_text,
    (p_totals->>'total_energy')::numeric,
    (p_totals->>'total_protein')::numeric,
    (p_totals->>'total_fat')::numeric,
    (p_totals->>'total_saturated_fat')::numeric,
    (p_totals->>'total_carbs')::numeric,
    (p_totals->>'total_fiber')::numeric,
    (p_totals->>'total_sugars')::numeric,
    (p_totals->>'total_salt')::numeric,
    (p_totals->>'total_sodium')::numeric
  )
  RETURNING id INTO v_id;

  INSERT INTO recipe_ingredients (
    recipe_id, name, quantity, unit,
    energy, protein, fat, saturated_fat,
    carbs, fiber, sugars, salt, sodium
  )
  SELECT
    v_id,
    elem->>'name',
    (elem->>'quantity')::numeric,
    elem->>'unit',
    (elem->>'energy')::numeric,
    (elem->>'protein')::numeric,
    (elem->>'fat')::numeric,
    (elem->>'saturated_fat')::numeric,
    (elem->>'carbs')::numeric,
    (elem->>'fiber')::numeric,
    (elem->>'sugars')::numeric,
    (elem->>'salt')::numeric,
    (elem->>'sodium')::numeric
  FROM jsonb_array_elements(p_ingredients) AS elem;

  RETURN v_id;
END;
$$;
```

#### 2. Update `saveRecipe()` Server Action

**File:** `src/app/actions/recipes.ts`

**Intent:** Replace the two separate `.from('recipes').insert()` + `.from('recipe_ingredients').insert()` calls with a single `supabase.rpc('save_recipe', { … })` call. Return type and external signature stay the same (`Promise<{ error?: string }>`).

**Contract:** Build `p_totals` by passing `totals ? totalsToRecipeColumns(totals) : {}` (the helper already returns an object keyed to the `total_*` column names). Build `p_ingredients` as an array where each element merges `{ name, quantity, unit }` with `perIngredientNutrients[i] ? nutrientsToIngredientColumns(perIngredientNutrients[i]!) : {}`. Pass both as plain JS objects — `supabase.rpc` serialises them to JSONB automatically. On `rpcError`, return `{ error: rpcError.message }`.

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db push`
- TypeScript compiles: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification

- Save from `/recipes/new` still redirects to `/recipes` and writes correct rows to Supabase
- In Supabase dashboard: recipe row has correct title, `raw_text = NULL`; ingredient rows have correct name/quantity/unit and nutrient values
- Missing-flag invariant: ingredients with missing nutrition have `NULL` in DB, not `0`

**Implementation Note:** Pause here after automated checks pass; confirm manual DB verification before proceeding to Phase 2.

---

## Phase 2: Save Button in ParseFlow

### Overview

Add a title input and Save button to `ParseFlow`. They appear below the nutritional summary after a successful nutrition fetch. Wired to the existing `saveRecipe()` action; redirects to `/recipes` on success.

### Changes Required

#### 1. Update `ParseFlow`

**File:** `src/app/parse/ParseFlow.tsx`

**Intent:** Capture `perIngredientNutrients` and `confirmedRows` during `handleConfirm`; reset both in `handleParse`; show a title input and Save button below `NutritionalSummary` when the summary is visible.

**Contract:**

New state:
- `title: string` — controlled title input
- `confirmedRows: Ingredient[] | null` — rows passed to the last confirm call; reset to `null` in `handleParse`
- `perIngredientNutrients: (IngredientNutrients | null)[] | null` — captured from `data.perIngredient` in `handleConfirm`; reset to `null` in `handleParse`
- `saving: boolean`
- `saveError: string | null`

`handleConfirm` additions: store `rows` as `confirmedRows`, store `data.perIngredient ?? null` as `perIngredientNutrients`.

`handleSave()`: disabled guard (`!title.trim() || saving`); calls `saveRecipe(title.trim(), confirmedRows ?? [], perIngredientNutrients ?? [], nutrients ?? null)`; on success calls `router.push('/recipes')`; on error sets `saveError`.

The title input and Save button render inside the `!fetchingNutrients && !nutritionError` block, below `<NutritionalSummary />`. Save button is `disabled` when `!title.trim() || saving`. Style to match the Save button in `ManualEntryFlow`.

Add `useRouter` from `'next/navigation'` and `saveRecipe` from `'@/app/actions/recipes'` imports.

### Success Criteria

#### Automated Verification

- TypeScript compiles: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification

- After parsing and getting a summary, a title input and "Save recipe" button appear below the summary
- Save button is disabled until a title is entered
- Clicking Save writes recipe + ingredients to Supabase and redirects to `/recipes`
- New recipe appears in the `/recipes` list with correct title and date
- Re-parsing clears the title input and Save button (stale data does not persist)
- AI parse flow behaviour before the summary step is unchanged (no regressions)

**Implementation Note:** Pause here after automated checks pass; confirm the full manual flow before finalising.

---

## Testing Strategy

### Manual Testing Steps

1. Sign in; go to `/parse`; paste a recipe; parse; confirm ingredients; get summary
2. Verify title input and Save button appear below the summary
3. Enter a title; click Save; confirm redirect to `/recipes`; confirm entry in list with correct title and date
4. Open Supabase dashboard; verify `recipes` row (`raw_text = NULL`) and `recipe_ingredients` rows
5. Parse again with different text; confirm previous title/save state is cleared
6. Go to `/recipes/new`; confirm ManualEntryFlow save still works unchanged

## Migration Notes

`save_recipe` uses `SECURITY DEFINER` + `SET search_path = public`. RLS policies on `recipes` and `recipe_ingredients` are bypassed inside the function — safe because `p_user_id` is always set from `supabase.auth.getUser()` in the Server Action.

Apply with `npx supabase db push` (requires linked project) or paste into Supabase dashboard SQL editor.

## References

- DB boundary adapters: `src/lib/db/recipes.ts`
- Existing migrations: `supabase/migrations/20260530000000_recipes_schema.sql`, `supabase/migrations/20260603000000_off_nutrient_schema.sql`
- ManualEntryFlow save pattern: `src/app/recipes/new/ManualEntryFlow.tsx:58-74`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Atomic Save via Postgres RPC

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db push` — 1b5ee2a
- [x] 1.2 TypeScript compiles: `npm run build` — 1b5ee2a
- [x] 1.3 ESLint passes: `npm run lint` — 1b5ee2a

#### Manual

- [x] 1.4 Save from `/recipes/new` still works and writes correct rows to Supabase
- [x] 1.5 Missing nutrients stored as NULL not 0
- [x] 1.6 `raw_text` is NULL in DB

### Phase 2: Save Button in ParseFlow

#### Automated

- [x] 2.1 TypeScript compiles: `npm run build` — 201d2e2
- [x] 2.2 ESLint passes: `npm run lint` — 201d2e2

#### Manual

- [x] 2.3 Title input and Save button appear below summary after parse
- [x] 2.4 Save button disabled until title entered
- [x] 2.5 Save redirects to `/recipes` and entry appears in list
- [x] 2.6 Re-parsing clears title and save state
- [x] 2.7 ManualEntryFlow save is unaffected
