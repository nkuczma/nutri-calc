# Manual Recipe Entry (S-02) — Plan Brief

> Full plan: `context/changes/manual-recipe-entry/plan.md`

## What & Why

NutriCalc's primary flow parses recipes via AI, but FR-004 requires a manual fallback for when AI parsing fails entirely. This change builds that fallback: a form-based recipe creation flow at `/recipes/new`, plus a recipe list at `/recipes` so users can find what they've saved (FR-007, FR-008).

## Starting Point

The AI parse flow (S-01) is fully implemented. `IngredientEditor`, `NutritionalSummary`, `/api/normalize-units`, and `/api/nutrition-summary` all exist and work. The Supabase schema for `recipes` and `recipe_ingredients` is in place with RLS. Nothing has been saved to the DB yet — there is no save action and no list page.

## Desired End State

A signed-in user visits `/recipes`, sees their saved recipes (title + date) and buttons to create new ones. They click "New recipe", enter a title and ingredients, get the nutritional summary, and save — landing back on the list with their new recipe visible. The home page links authenticated users to `/recipes` as the hub.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Entry point | New route `/recipes/new` | Keeps `/parse` AI-only; routes clearly signal intent | Plan |
| Save in scope | Yes | FR-004 without save delivers a half-finished feature | Plan |
| Recipe list | Minimal list in same change | Closes the save loop; FR-008 is minimal scope anyway | Plan |
| Post-save navigation | Redirect to `/recipes` | Natural next action — user sees their saved recipe in context | Plan |
| Empty rows | Silently filter blank-name rows | Matches existing `IngredientEditor` behavior (line 26) | Plan |
| Title | Required before save | Unnamed recipes make the list useless | Plan |
| Auth | Gate both routes; redirect to `/sign-in` | Consistent with `/parse`; no partial-save UX to design | Plan |
| List display | Title + created date only | FR-008 scoped to chronological list, no search/filter | Plan |

## Scope

**In scope:**
- `/recipes/new` — manual entry form (title + ingredients + nutrition fetch + save)
- `saveRecipe` server action — writes recipe + ingredients to Supabase
- Extend `/api/nutrition-summary` to return per-ingredient nutrient data
- `/recipes` — chronological recipe list (title + date)
- Home page: add "My recipes" link

**Out of scope:**
- Recipe detail page
- Recipe editing (FR-009)
- Recipe deletion (FR-010)
- Search or filter on the list
- Unauthenticated access to any recipe route

## Architecture / Approach

Reuse-heavy: `IngredientEditor` and `NutritionalSummary` are imported unchanged from `src/app/parse/`. `ManualEntryFlow` mirrors `ParseFlow` but skips the AI textarea step — it starts directly with the editor. The only new API logic is adding `perIngredient: results` to the nutrition-summary response (one line change). The save action uses the existing `nutrientsToIngredientColumns` / `totalsToRecipeColumns` adapters from `src/lib/db/recipes.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Manual Entry Page | `/recipes/new` with full UI flow (save is a stub) | `ManualEntryFlow` state management for the confirm→save handoff |
| 2. API Extension + Save | Real save to Supabase; per-ingredient nutrients in API response | Null totals / null per-ingredient nutrients must not write 0 to DB |
| 3. List + Navigation | `/recipes` page; home page update | Minimal — mostly read query and link wiring |

**Prerequisites:** S-01 complete (done), Supabase schema migrated (done)
**Estimated effort:** ~2 sessions across 3 phases

## Open Risks & Assumptions

- `IngredientEditor` is imported from `src/app/parse/` — if that path moves in a future refactor, the import breaks
- The save action performs two sequential inserts (recipe, then ingredients) without a transaction; a failure between them leaves an orphaned recipe row. Acceptable for MVP given low volume.

## Success Criteria (Summary)

- User can create a recipe manually, save it, and see it on `/recipes` — end to end, no errors
- Missing nutrients are stored as NULL in the DB and displayed as "—" in the UI — never as 0
- The existing AI parse flow at `/parse` is unaffected
