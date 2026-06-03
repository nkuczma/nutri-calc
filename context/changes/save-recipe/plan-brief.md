# Save Recipe (S-03) — Plan Brief

> Full plan: `context/changes/save-recipe/plan.md`

## What & Why

Complete FR-007 by adding a Save button to the AI parse flow (`ParseFlow`) so users can persist recipes from either entry path. The `manual-recipe-entry` change built the infrastructure (action, list page) but left the parse flow without a way to save.

## Starting Point

`saveRecipe()` is fully implemented and works from `ManualEntryFlow`. `ParseFlow` ignores the `perIngredient` data already returned by `/api/nutrition-summary` and captures neither confirmed rows nor a title — so it cannot call `saveRecipe()`. The two-step insert in `saveRecipe()` is also non-atomic: a failure between inserts leaves an orphaned recipe row.

## Desired End State

After parsing a recipe and reviewing the nutritional summary, the user can enter a title and click "Save recipe." The recipe and all ingredients are written to Supabase atomically. The user lands on `/recipes` where the new entry appears. Manual entry save is unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Post-save destination | `/recipes` list | Already exists; no new UI needed | Plan |
| Atomicity strategy | Postgres RPC (`save_recipe`) | Supabase JS has no multi-table transaction API | Plan |
| Title input placement | Below nutritional summary, with Save button | Keeps parse UX uncluttered; title only relevant at save time | Plan |
| Return type of `saveRecipe()` | Unchanged (`{ error?: string }`) | No ID needed when redirecting to the list | Plan |

## Scope

**In scope:**
- `supabase/migrations/20260603130000_save_recipe_rpc.sql` — atomic `save_recipe` function
- `src/app/actions/recipes.ts` — call RPC instead of two-step insert
- `src/app/parse/ParseFlow.tsx` — title input + Save button + perIngredient capture

**Out of scope:**
- `/recipes/[id]` detail page — note: recipe list items now link there (user-added); that route will 404 until built separately
- Edit, delete (FR-009, FR-010)
- Any changes to `NutritionalSummary` or `IngredientEditor`

## Architecture / Approach

`ParseFlow` (Client Component) gains title/save state and wires `handleSave()` to the existing `saveRecipe()` Server Action. The action calls `supabase.rpc('save_recipe', { p_totals, p_ingredients })` where both arguments are plain JS objects serialised to JSONB — the existing `totalsToRecipeColumns()` and `nutrientsToIngredientColumns()` helpers produce the right key names. The RPC function runs both inserts in an implicit PL/pgSQL transaction.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Atomic save RPC | Migration + updated `saveRecipe()` | Requires `npx supabase db push` or manual SQL editor apply |
| 2. Save in ParseFlow | Title input + Save button in `ParseFlow` | `perIngredientNutrients` capture must be reset on re-parse |

**Prerequisites:** Supabase project linked locally for migration apply; `manual-recipe-entry` merged  
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- `SECURITY DEFINER` bypasses RLS inside the function — safe because `p_user_id` is always sourced from `supabase.auth.getUser()` in the Server Action
- Recipe list items now link to `/recipes/[id]` (user modification); those links will 404 until a detail page is built

## Success Criteria (Summary)

- Saving from `/parse` writes recipe + ingredients atomically and redirects to `/recipes`
- A DB failure mid-save leaves no orphaned rows
- Re-parsing a recipe clears the title and save state
