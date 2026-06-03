# Edit Saved Recipe — Plan Brief

> Full plan: `context/changes/edit-saved-recipe/plan.md`

## What & Why

Add inline editing to the `/recipes/[id]` detail page so users can update a saved recipe's title and ingredient list without re-parsing via AI. This is roadmap slice S-05 (FR-009) — the natural next step after the list view (S-04) is live. Direct field edits keep the interaction simple while preserving the core trust contract: nutrition totals always reflect the displayed ingredient list.

## Starting Point

`/recipes/[id]/page.tsx` exists as a read-only Server Component. It fetches recipe + ingredient rows and renders them with `NutritionalSummary`, but has no edit controls. `IngredientEditor` (used in ParseFlow and ManualEntryFlow) is already a full-featured inline editor with name/qty/unit inputs — it just hasn't been wired to saved recipes.

## Desired End State

An **Edit** button on the detail page toggles the ingredient list and title into editable form. The user changes any fields, clicks **Save**, and the app normalizes units → re-fetches nutrition for all ingredients → atomically replaces the recipe in the DB → returns to view mode with updated totals. Partial nutrition failures surface as `"missing"` values rather than blocking the save.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Edit mode location | Inline toggle on detail page | No extra route; consistent with single-page edit pattern | Plan |
| Nutrition refetch scope | All ingredients on every save | Simpler than diffing; roadmap Q #2 resolved this as correct semantics | Roadmap |
| Title editable | Yes | Title is part of a recipe; FR-009 doesn't exclude it | Plan |
| Failed nutrition lookup | Save with "missing" | Consistent with missing-flag contract; doesn't destroy user's edit | Plan |
| DB update strategy | New `update_recipe` RPC | Atomic transaction; mirrors existing `save_recipe` pattern | Plan |
| Summary in view mode | Always visible | No regression in current read-only view | Plan |
| Save UX | Disable + spinner, inline error | Matches existing save button patterns | Plan |
| Unauthorized access | 404 via RLS | No new auth logic needed; RLS filters out other users' rows | Plan |

## Scope

**In scope:** Title editing, ingredient list editing (name/qty/unit), add/remove ingredient rows, nutrition recompute on save, atomic DB update, missing-flag handling for failed lookups, 404 for unauthorized access.

**Out of scope:** AI re-parse on edit, per-ingredient partial save, optimistic UI, draft persistence, undo, separate edit route, search/filter on ingredient list.

## Architecture / Approach

Page stays a Server Component (data fetch). A new `RecipeDetailView` Client Component owns edit-mode state and is rendered by the page with typed props. In edit mode it composes `IngredientEditor`. The `updateRecipe` server action calls `convertToGrams` and `fetchNutrients` directly (no HTTP hop), aggregates totals, then calls an `update_recipe` Postgres RPC for an atomic DB write.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB — update_recipe RPC | Atomic recipe + ingredient update function in Postgres | Ownership check must be airtight; follow save_recipe pattern exactly |
| 2. Server Action — updateRecipe | Full update pipeline: normalize → nutrition → DB write | Nutrition API failures must not block save |
| 3. Edit UI — RecipeDetailView | Inline edit toggle, IngredientEditor wired, Save/Cancel | Client state must not bleed between view/edit mode or across navigations |

**Prerequisites:** S-04 (list-saved-recipes) shipped — done.
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks & Assumptions

- `updated_at` column may not exist on the `recipes` table — migration must check before adding it
- `IngredientEditor` currently receives `weightGrams` as a display-only prop; in edit mode weights are not pre-computed, so this prop should be omitted (it accepts `null`)

## Success Criteria (Summary)

- User can edit and save a recipe's title and ingredients from `/recipes/[id]` without navigating away
- Nutritional summary reflects the updated ingredient list after save
- A failed nutrition lookup for one ingredient does not block saving the rest
