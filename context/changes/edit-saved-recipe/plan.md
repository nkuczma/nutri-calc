# Edit Saved Recipe — Implementation Plan

## Overview

Add the ability for a signed-in user to edit the title and ingredient list of a saved recipe. Editing toggles inline on the existing `/recipes/[id]` detail page; on save, the full ingredient list is re-normalized and nutrition re-fetched, then the recipe is atomically updated in the DB. No AI re-parse on edit (PRD FR-009 carve-out).

## Current State Analysis

- `/recipes/[id]/page.tsx` — Server Component that fetches recipe + ingredients and renders them as a **read-only** list with `NutritionalSummary`. No edit controls exist.
- `src/app/parse/IngredientEditor.tsx` — fully-built inline editor (name / qty / unit inputs, add/remove rows). Currently used in ParseFlow and ManualEntryFlow; reusable here.
- `src/app/actions/recipes.ts` — has `saveRecipe` (create only). No update action.
- `supabase/migrations/20260603130000_save_recipe_rpc.sql` — `save_recipe` RPC (create only). Pattern to mirror for update.
- `src/lib/db/recipes.ts` — conversion utilities (`ingredientRowToNutrients`, `nutrientsToIngredientColumns`, `totalsToRecipeColumns`) all reusable.
- `src/lib/nutrition.ts` — `fetchNutrients(name, weightGrams)` importable directly in a server action.
- `src/lib/unit-conversion.ts` — `convertToGrams(name, quantity, unit)` importable directly.
- RLS policies on `recipe_ingredients` allow the owner to update/delete their own rows. Supabase `.update()` respects RLS.

### Key Discoveries

- `IngredientEditor` takes `parsed: Ingredient[]` (name, quantity, unit) — matches `src/lib/schemas/ingredient.ts`. DB rows must be mapped to this shape before passing in.
- `save_recipe` RPC uses `SECURITY DEFINER` + an explicit `p_user_id` param — the `update_recipe` RPC must follow the same pattern and verify `p_recipe_id` ownership before mutating.
- The nutrition-summary and normalize-units routes are POST API handlers; a Server Action can call `convertToGrams` and `fetchNutrients` directly instead of going through HTTP.
- `NutritionalSummary` at `src/app/parse/NutritionalSummary.tsx` takes `nutrients: IngredientNutrients | null` — already imported on the detail page, reuse without change.

## Desired End State

The `/recipes/[id]` page shows an **Edit** button in view mode. Clicking it switches the ingredient table and title into an inline editable form (using `IngredientEditor`). The user edits name/qty/unit fields and the title, then clicks **Save**. The app normalizes units, re-fetches nutrition for all ingredients, atomically updates the DB, and returns to view mode showing updated totals. Partial nutrition failures persist as `"missing"` rather than blocking the save. Navigating to another user's recipe shows a 404 (unchanged from current RLS behavior).

### Key Discoveries

- `recipeRowToTotals` and `ingredientRowToNutrients` exist in `src/lib/db/recipes.ts` — use them to seed edit state from the fetched DB rows.
- Aggregating totals: sum numeric values across all ingredients; mark a field `"missing"` if any ingredient has `"missing"` for that field. This is the same rule as `nutrition-summary` route (`src/app/api/nutrition-summary/route.ts:43-50`).

## What We're NOT Doing

- No AI re-parse on edit (PRD FR-009 carve-out — parked in roadmap)
- No per-ingredient partial save (all-or-nothing per save action)
- No optimistic UI update before the server round-trip completes
- No separate `/recipes/[id]/edit` route — inline toggle only
- No "undo" or draft persistence across page refreshes
- No pagination or filtering on the ingredient list

## Implementation Approach

**Three phases in dependency order:** DB migration first (unblocks server action), server action second (unblocks UI), UI third.

The detail page stays a Server Component that fetches initial data; it renders a new `RecipeDetailView` Client Component that owns all edit-mode state. `IngredientEditor` (already client-side) is composed inside `RecipeDetailView` during edit mode. The server action calls `convertToGrams` and `fetchNutrients` directly (no HTTP hop) then calls the `update_recipe` RPC.

---

## Phase 1: DB — `update_recipe` RPC

### Overview

Add a Postgres function that atomically updates a recipe row (title + totals) and replaces its ingredient rows (delete-all + insert-new), verifying ownership before mutating. Mirrors the `save_recipe` RPC pattern.

### Changes Required

#### 1. New migration file

**File:** `supabase/migrations/20260603200000_update_recipe_rpc.sql`

**Intent:** Define the `update_recipe` function so the server action has a single atomic call to update a saved recipe without the risk of partial state from multi-statement updates.

**Contract:** Function signature:

```sql
CREATE OR REPLACE FUNCTION public.update_recipe(
  p_user_id     uuid,
  p_recipe_id   uuid,
  p_title       text,
  p_totals      jsonb,
  p_ingredients jsonb   -- same shape as save_recipe: array of {name, quantity, unit, ...nutrient columns}
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

Body must:
1. Verify the recipe exists and belongs to `p_user_id` — raise exception if not.
2. `UPDATE recipes SET title = p_title, <total columns from p_totals>, updated_at = now() WHERE id = p_recipe_id`.
3. `DELETE FROM recipe_ingredients WHERE recipe_id = p_recipe_id`.
4. `INSERT INTO recipe_ingredients` via `jsonb_array_elements(p_ingredients)` — same pattern as `save_recipe` lines 33-52.

Note: `recipes` table currently has no `updated_at` column. The migration must add it (`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`), or omit the update if the column doesn't fit the schema. Check against `20260530000000_recipes_schema.sql` — if absent, skip the column update in the RPC body and in the `UPDATE` statement.

### Success Criteria

#### Automated Verification

- Migration applies cleanly with `npx supabase db push` (or local `supabase migration up`)
- Calling `update_recipe` with a valid recipe owned by the user updates rows correctly
- Calling `update_recipe` with a recipe owned by a different user raises an exception (ownership guard)

#### Manual Verification

- Apply migration to local Supabase; verify function appears in Supabase Studio under `public` functions
- Test via Supabase SQL editor: update a recipe, confirm `recipe_ingredients` rows replaced

**Implementation Note:** Pause after Phase 1 for manual confirmation before proceeding.

---

## Phase 2: Server Action — `updateRecipe`

### Overview

Add an `updateRecipe` server action that: maps ingredients → grams → nutrients, aggregates totals, then calls the `update_recipe` RPC. Partial nutrition failures persist as `"missing"` and never block the save.

### Changes Required

#### 1. `updateRecipe` server action

**File:** `src/app/actions/recipes.ts`

**Intent:** Provide the client with a single call that handles the full update pipeline (normalize → nutrition fetch → DB write) so the UI doesn't need to orchestrate API calls.

**Contract:** Signature:

```ts
export async function updateRecipe(
  recipeId: string,
  title: string,
  ingredients: Ingredient[]   // {name, quantity, unit} — from IngredientEditor output
): Promise<{ error?: string }>
```

Body steps:
1. Get `user` from Supabase auth — return `{ error: "Unauthorized" }` if none.
2. For each ingredient, call `convertToGrams(name, quantity, unit)` — collect `weights: (number | "missing")[]`.
3. For each ingredient, call `fetchNutrients(name, weightGrams)` where `weightGrams` is the resolved number or `undefined` if `"missing"`. Wrap each in try/catch; on catch, substitute `{ energy: "missing", protein: "missing", ... }` (all fields `"missing"`) — do not throw.
4. Aggregate totals across per-ingredient results using the same rule as `nutrition-summary` route: sum numeric fields; mark field `"missing"` if any ingredient has `"missing"` for it.
5. Convert per-ingredient nutrients with `nutrientsToIngredientColumns` and totals with `totalsToRecipeColumns` (both from `src/lib/db/recipes.ts`).
6. Call the `update_recipe` Supabase RPC with `p_user_id`, `p_recipe_id`, `p_title`, `p_totals`, `p_ingredients`.
7. Return `{}` on success, `{ error: string }` on RPC error.

### Success Criteria

#### Automated Verification

- TypeScript compiles without errors: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification

- Invoke from browser: edit a recipe, save, confirm DB rows updated in Supabase Studio
- Edit a recipe with an ingredient that can't be unit-normalized — confirm save succeeds with `"missing"` nutrients

**Implementation Note:** Pause after Phase 2 for manual confirmation before proceeding.

---

## Phase 3: Edit UI — `RecipeDetailView` Client Component

### Overview

Extract the read-only recipe detail view into a `RecipeDetailView` Client Component that adds an edit mode toggle. In edit mode, the title becomes a text input and the ingredient list becomes an `IngredientEditor`. Save calls `updateRecipe`, Cancel discards changes.

### Changes Required

#### 1. New `RecipeDetailView` Client Component

**File:** `src/app/recipes/[id]/RecipeDetailView.tsx`

**Intent:** Own all edit-mode state so the Server Component page stays a pure data-fetcher. This component renders differently in view mode vs edit mode.

**Contract:** Props:

```ts
type Props = {
  recipe: {
    id: string
    title: string
    totals: IngredientNutrients   // from recipeRowToTotals()
  }
  ingredients: Array<{
    name: string
    quantity: number
    unit: string
    nutrients: IngredientNutrients  // from ingredientRowToNutrients()
  }>
}
```

**View mode:** renders the existing read-only ingredient table + `NutritionalSummary` with `recipe.totals` + an **Edit** button.

**Edit mode:** renders a title `<input>` (seeded from `recipe.title`), `IngredientEditor` (seeded from `ingredients` mapped to `Ingredient[]`), **Save** and **Cancel** buttons. No `NutritionalSummary` in edit mode (totals are stale until save completes).

**Save handler:** calls `updateRecipe(recipe.id, editedTitle, editedIngredients)`. During the call, Save button is disabled with a spinner. On success, call `router.refresh()` to re-fetch updated data from the server and exit edit mode. On error, stay in edit mode, show error message inline below the Save button.

**Cancel handler:** reset edit state back to original values, exit edit mode without calling the server.

#### 2. Update `/recipes/[id]/page.tsx`

**File:** `src/app/recipes/[id]/page.tsx`

**Intent:** Delegate rendering to `RecipeDetailView` after fetching, keeping the page as a Server Component.

**Contract:** After fetching `recipe` and `ingredients` rows (lines 20-33), convert them with `recipeRowToTotals` and `ingredientRowToNutrients`, then pass the typed data to `<RecipeDetailView recipe={...} ingredients={...} />`. Remove the inline read-only ingredient table and `NutritionalSummary` JSX that currently lives in the page (lines 52-81) — those move into `RecipeDetailView`.

### Success Criteria

#### Automated Verification

- TypeScript compiles: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification

- Navigate to `/recipes/[id]` for a saved recipe — see read-only view with Edit button and NutritionalSummary
- Click Edit — title and ingredients become editable; NutritionalSummary disappears; Save and Cancel buttons appear
- Edit an ingredient name/qty/unit; click Save — spinner shows, then view mode returns with updated totals
- Click Edit, make changes, click Cancel — changes discarded, original values restored
- Edit ingredient to an unusual unit that can't be resolved — save succeeds, affected nutrients show as missing
- Navigate to `/recipes/[id]` for another user's recipe — 404 (unchanged)
- No regressions on `/recipes` list page

**Implementation Note:** Pause after Phase 3 for manual confirmation before considering the feature complete.

---

## Testing Strategy

### Manual Testing Steps

1. Create a recipe (via AI parse or manual entry), save it
2. Open it at `/recipes/[id]` — verify read-only view, Edit button visible, NutritionalSummary present
3. Click Edit — verify title input, IngredientEditor, Save/Cancel
4. Change an ingredient name (e.g., "chicken" → "tofu"), change a quantity, click Save
5. Verify updated ingredient list and recomputed nutritional summary in view mode
6. Open Supabase Studio — confirm `recipe_ingredients` rows replaced, `recipes.title` updated if changed
7. Edit with a bad unit (e.g., "handful") — confirm save succeeds, relevant nutrients marked missing
8. Edit then Cancel — confirm no DB writes occurred and original data shows

## Migration Notes

`updated_at` column on `recipes` table: check `20260530000000_recipes_schema.sql`. If absent, add it in the Phase 1 migration. If adding it, also update `src/lib/database.types.ts` Row type for `recipes` (add `updated_at: string | null`).

## References

- Roadmap entry: `context/foundation/roadmap.md` §S-05
- Existing save RPC: `supabase/migrations/20260603130000_save_recipe_rpc.sql`
- IngredientEditor: `src/app/parse/IngredientEditor.tsx`
- Conversion utils: `src/lib/db/recipes.ts`
- Nutrition fetch: `src/lib/nutrition.ts`
- Unit conversion: `src/lib/unit-conversion.ts`
- NutritionalSummary: `src/app/parse/NutritionalSummary.tsx`
- DB types: `src/lib/database.types.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: DB — update_recipe RPC

#### Automated

- [x] 1.1 Migration applies cleanly (supabase db push / migration up)
- [x] 1.2 update_recipe with valid owned recipe updates rows correctly
- [x] 1.3 update_recipe with unowned recipe raises exception

#### Manual

- [x] 1.4 Function visible in Supabase Studio under public functions
- [x] 1.5 SQL editor test: update a recipe, confirm recipe_ingredients rows replaced

### Phase 2: Server Action — updateRecipe

#### Automated

- [ ] 2.1 TypeScript compiles without errors (npm run build)
- [ ] 2.2 ESLint passes (npm run lint)

#### Manual

- [ ] 2.3 Edit a recipe in browser, save, confirm DB rows updated in Supabase Studio
- [ ] 2.4 Edit recipe with unresolvable unit, confirm save succeeds with missing nutrients

### Phase 3: Edit UI — RecipeDetailView Client Component

#### Automated

- [ ] 3.1 TypeScript compiles (npm run build)
- [ ] 3.2 ESLint passes (npm run lint)

#### Manual

- [ ] 3.3 /recipes/[id] shows read-only view with Edit button and NutritionalSummary
- [ ] 3.4 Edit mode shows title input, IngredientEditor, Save and Cancel buttons
- [ ] 3.5 Save updates ingredient list and nutritional summary in view mode
- [ ] 3.6 Cancel discards changes without DB writes
- [ ] 3.7 Bad unit save succeeds with missing nutrients for affected ingredient
- [ ] 3.8 Other user's recipe returns 404
- [ ] 3.9 /recipes list page shows no regressions
