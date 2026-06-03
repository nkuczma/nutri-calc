# Manual Recipe Entry (S-02) Implementation Plan

## Overview

Implement FR-004, FR-007, and FR-008: a user can build a recipe from scratch by entering ingredients manually, get the full nutritional summary (with transparent missing-data flags), save it to their account, and browse their saved recipes in a chronological list.

## Current State Analysis

The AI parse flow (S-01) is complete at `src/app/parse/`. It has established the core building blocks this feature will reuse:

- `src/app/parse/IngredientEditor.tsx` — editable ingredient table (add/remove/edit rows, blank-name filter on confirm)
- `src/app/parse/NutritionalSummary.tsx` — summary display with "—" for missing nutrients
- `POST /api/normalize-units` — converts ingredient quantities to gram weights
- `POST /api/nutrition-summary` — fetches and aggregates nutrition for a confirmed ingredient list; currently returns only the aggregate total
- `src/lib/db/recipes.ts` — boundary adapters (`nutrientsToIngredientColumns`, `totalsToRecipeColumns`, etc.)
- Supabase schema: `recipes` (title, raw_text nullable, 9 total_* columns) and `recipe_ingredients` (name, quantity, unit, 9 nutrient columns) with RLS policies keyed to `auth.uid()`

**What is missing:**
- A `/recipes/new` route and its manual-entry client component
- The `POST /api/nutrition-summary` response does not include per-ingredient nutrient data (only the aggregate) — needed to persist nutrients per row to `recipe_ingredients`
- A `saveRecipe` server action
- A `/recipes` list page
- Navigation from the home page to `/recipes`

## Desired End State

A signed-in user can:
1. Visit `/recipes/new`, enter a recipe title and any number of ingredients (name, quantity, unit)
2. Click "Get nutritional summary" to see the full 9-nutrient breakdown (missing values shown as "—")
3. Click "Save recipe" (only active when a title is entered and a summary has been fetched) and be redirected to `/recipes`
4. On `/recipes`, see a chronological list of their saved recipes (title + created date), plus buttons to create a new recipe manually (`/recipes/new`) or via AI parse (`/parse`)

The home page for authenticated users gains a "My recipes" link alongside "Parse a recipe".

### Key Discoveries:

- `IngredientEditor` already filters blank-name rows in `handleConfirm` (line 26) — no change needed for the blank-row requirement
- `raw_text` in the `recipes` table is nullable — manual entries insert `null` here without schema changes
- `nutrientsToIngredientColumns` and `totalsToRecipeColumns` in `src/lib/db/recipes.ts` handle the `number | "missing"` → `number | null` mapping; both accept `IngredientNutrients`, not null — the save action must handle a null totals case explicitly (all nutrient columns omitted, defaulting to NULL in DB)
- The nutrition-summary route's per-ingredient `results` array (line 27) is computed but not returned — returning it alongside the aggregate is a non-breaking additive change

## What We're NOT Doing

- No AI re-parse on the manual entry page
- No recipe detail page (recipe titles in the list are non-interactive)
- No recipe editing (FR-009 — separate change)
- No recipe deletion (FR-010 — separate change)
- No search or filter on the recipe list (FR-008 scoped to chronological list only)
- No serving-size adjustment
- No unauthenticated access to `/recipes/new` or `/recipes` — both redirect to `/sign-in`

## Implementation Approach

Three phases proceeding from the user-facing entry point inward to persistence, then outward to the list and navigation. Phase 1 builds the full UI flow but wires the save button to a stub; Phase 2 completes the API extension and real save logic; Phase 3 adds the list page and updates navigation.

## Critical Implementation Details

**`IngredientEditor` import path**: import from `@/app/parse/IngredientEditor` (not a shared location). This is intentional for now.

**Per-ingredient nutrients in the save action**: `perIngredientNutrients[i]` can be `null` when `fetchNutrients` returns all-missing for an ingredient. Spread `nutrientsToIngredientColumns(perIngredientNutrients[i])` only when non-null; otherwise omit nutrient columns (they default to NULL in DB).

**Server action navigation**: `saveRecipe` returns `{ error?: string }`. The client calls `router.push('/recipes')` on success. Do not use `redirect()` inside the server action — it throws a special error that behaves differently when called from a client component.

---

## Phase 1: Manual Entry Page and Client Flow

### Overview

Create the `/recipes/new` route: a server-component auth guard wrapping a client-component `ManualEntryFlow` that hosts the title input, `IngredientEditor`, the normalize+fetch pipeline, `NutritionalSummary`, and the Save button.

### Changes Required:

#### 1. Page server component

**File**: `src/app/recipes/new/page.tsx`

**Intent**: Auth-guard the route and render `ManualEntryFlow`. Follows the same pattern as `src/app/parse/page.tsx` — get user from Supabase server client; redirect to `/sign-in` if null.

**Contract**: Default export async function `NewRecipePage`. No props. Renders `<ManualEntryFlow />`.

#### 2. ManualEntryFlow client component

**File**: `src/app/recipes/new/ManualEntryFlow.tsx`

**Intent**: Orchestrates the manual-entry journey — title input → ingredient editing → normalize units → fetch nutrition → display summary → save.

**Contract**:

State managed by this component:
- `title: string` — controlled input; required before save is enabled
- `confirmedRows: Ingredient[] | null` — rows passed to the last nutrition fetch; held so the save action can read them
- `weightGrams: (number | 'missing' | null)[] | null`
- `nutrients: IngredientNutrients | null | undefined` — `undefined` = not yet fetched
- `perIngredientNutrients: (IngredientNutrients | null)[] | null`
- `fetchingNutrients: boolean`
- `nutritionError: string | null`
- `saving: boolean`
- `saveError: string | null`

`handleConfirm(rows)`: same two-step fetch as `ParseFlow.handleConfirm` — POST `/api/normalize-units`, then POST `/api/nutrition-summary`; store `weights`, `nutrients`, and `perIngredient` from the response; store `rows` as `confirmedRows`.

`handleSave()`: disabled guard (`!title.trim() || !nutrients || saving`); calls `saveRecipe` (Phase 2 stub returns `{}`); on success calls `router.push('/recipes')`; on error sets `saveError`.

Initial `IngredientEditor` `parsed` prop: `[{ name: '', quantity: 1, unit: '' }]`. Do NOT key the editor to force-remount between confirm calls — the user's edits must persist.

Save button renders below `NutritionalSummary` only when `nutrients !== undefined`. It is `disabled` when `!title.trim() || saving`.

### Success Criteria:

#### Automated Verification:

- TypeScript build passes: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification:

- Visiting `/recipes/new` without a session redirects to `/sign-in`
- `/recipes/new` loads with a title field and one empty ingredient row
- Adding ingredients and clicking "Get nutritional summary" shows the summary with "—" for any missing nutrient
- Save button is disabled until a title is entered
- Save button is disabled before a summary has been fetched
- Clicking Save (stub) triggers navigation to `/recipes` (404 until Phase 3 — acceptable)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Nutrition API Extension and Save Server Action

### Overview

Extend `/api/nutrition-summary` to return per-ingredient nutrient data alongside the aggregate. Add the `saveRecipe` server action that writes the recipe and its ingredients to Supabase.

### Changes Required:

#### 1. Extend nutrition-summary route response

**File**: `src/app/api/nutrition-summary/route.ts`

**Intent**: Return per-ingredient results alongside the aggregate so the client can pass them to the save action.

**Contract**: Change the success response from `{ nutrients: aggregated }` to `{ nutrients: aggregated, perIngredient: results }`. The empty-ingredients early-return changes from `{ nutrients: null }` to `{ nutrients: null, perIngredient: [] }`. The `results` array is already computed at line 27 — no new logic needed. `ParseFlow` ignores the new field; no changes needed there.

#### 2. Save server action

**File**: `src/app/actions/recipes.ts`

**Intent**: Write a confirmed recipe (title, ingredient list, per-ingredient nutrients, aggregate totals) to Supabase.

**Contract**:

```ts
export async function saveRecipe(
  title: string,
  ingredients: Ingredient[],
  perIngredientNutrients: (IngredientNutrients | null)[],
  totals: IngredientNutrients | null,
): Promise<{ error?: string }>
```

Steps:
1. Create server Supabase client; get user; return `{ error: 'Unauthorized' }` if null
2. Insert recipe row: `{ user_id: user.id, title, raw_text: null, ...(totals ? totalsToRecipeColumns(totals) : {}) }`; on DB error return `{ error: dbError.message }`; extract `id` from the returned row
3. For each ingredient, build insert: `{ recipe_id: id, name, quantity, unit, ...(perIngredientNutrients[i] ? nutrientsToIngredientColumns(perIngredientNutrients[i]) : {}) }`
4. Bulk-insert ingredient rows; on DB error return `{ error: dbError.message }`
5. Return `{}`

### Success Criteria:

#### Automated Verification:

- TypeScript build passes: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification:

- Create a recipe with 2–3 ingredients; click Save; verify redirect to `/recipes`
- Supabase dashboard: `recipes` row has correct title, `raw_text = NULL`, non-null total nutrient columns
- `recipe_ingredients` rows have correct name/quantity/unit and nutrient values
- Missing-flag invariant: ingredient with missing nutrition has NULL in DB, not 0
- Unauthenticated POST to `/api/nutrition-summary` still returns 401

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Recipe List Page and Navigation

### Overview

Add the `/recipes` list page and update the home page to link authenticated users to their recipe hub.

### Changes Required:

#### 1. Recipe list page

**File**: `src/app/recipes/page.tsx`

**Intent**: Server component that fetches the authenticated user's recipes ordered newest-first and renders a minimal list. Auth-guards identically to other pages.

**Contract**:

Query: `supabase.from('recipes').select('id, title, created_at').eq('user_id', user.id).order('created_at', { ascending: false })`

Render:
- Page heading "My recipes"
- Two action buttons: "New recipe" → `/recipes/new`, "Parse with AI" → `/parse`
- Empty state: "No recipes yet." when list is empty
- For each recipe: title text + formatted date (`new Date(r.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })`). Titles are plain text — no detail page exists yet.

#### 2. Home page navigation update

**File**: `src/app/page.tsx`

**Intent**: Give authenticated users a clear path to their recipe hub.

**Contract**: In the authenticated branch, replace the single "Parse a recipe" `<Link>` with two links: "My recipes" → `/recipes` (primary button style, same classes as existing CTA) and "Parse a recipe" → `/parse` (secondary/outline style). Preserve the Sign out form unchanged.

### Success Criteria:

#### Automated Verification:

- TypeScript build passes: `npm run build`
- ESLint passes: `npm run lint`

#### Manual Verification:

- Authenticated home page shows both "My recipes" and "Parse a recipe" links
- `/recipes` redirects unauthenticated users to `/sign-in`
- `/recipes` shows "No recipes yet." for a fresh account
- Saved recipe appears in list with correct title and date
- Multiple saved recipes appear in reverse-chronological order
- "New recipe" and "Parse with AI" buttons on `/recipes` navigate correctly
- End-to-end flow works: home → /recipes → /recipes/new → fill form → save → back on /recipes with new entry

**Implementation Note**: After completing this phase and all automated verification passes, pause here for final manual confirmation of the complete flow.

---

## Testing Strategy

### Manual Testing Steps:

1. Sign in; visit `/recipes` — confirm empty state
2. Visit `/recipes/new` without session — confirm redirect to `/sign-in`
3. Enter title "Test Pasta", add "200g pasta" and "1 tbsp olive oil"; click "Get nutritional summary"
4. Verify summary shows values and "—" for any missing nutrients
5. Clear title; confirm Save button is disabled; re-enter title
6. Click Save; confirm redirect to `/recipes`; confirm entry appears with today's date
7. Open Supabase dashboard; verify DB rows match (see Phase 2 manual verification)
8. Confirm AI parse flow (`/parse`) is unaffected

## Performance Considerations

The `/recipes` list query selects only `id, title, created_at` — no nutrient columns — and is bounded by the user's own recipe count, which is small for MVP.

## Migration Notes

No schema migrations required. The existing `recipes` and `recipe_ingredients` tables fully support this feature.

## References

- PRD: `context/foundation/prd.md` (FR-004, FR-007, FR-008)
- Roadmap: `context/foundation/roadmap.md` (S-02)
- Prior plan (parse flow): `context/changes/paste-parse-summary/plan.md`
- Prior plan (schema + RLS): `context/changes/recipes-schema-rls/plan.md`
- DB boundary adapters: `src/lib/db/recipes.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Manual Entry Page and Client Flow

#### Automated

- [x] 1.1 TypeScript build passes: `npm run build` — cc36212
- [x] 1.2 ESLint passes: `npm run lint` — cc36212

#### Manual

- [x] 1.3 `/recipes/new` without session redirects to `/sign-in`
- [x] 1.4 `/recipes/new` loads with title field and one empty ingredient row
- [x] 1.5 Summary shows with "—" for missing nutrients after confirm
- [x] 1.6 Save button disabled until title entered
- [x] 1.7 Save button disabled before summary fetched
- [x] 1.8 Clicking Save (stub) triggers navigation to `/recipes`

### Phase 2: Nutrition API Extension and Save Server Action

#### Automated

- [x] 2.1 TypeScript build passes: `npm run build` — 0cefcd6
- [x] 2.2 ESLint passes: `npm run lint` — 0cefcd6

#### Manual

- [x] 2.3 Recipe + ingredients written to Supabase after Save
- [x] 2.4 `raw_text` is NULL in DB for manually created recipe
- [x] 2.5 Missing-flag invariant: missing nutrient stored as NULL, not 0
- [x] 2.6 Unauthenticated POST to `/api/nutrition-summary` returns 401

### Phase 3: Recipe List Page and Navigation

#### Automated

- [x] 3.1 TypeScript build passes: `npm run build` — d1bc71c
- [x] 3.2 ESLint passes: `npm run lint` — d1bc71c

#### Manual

- [x] 3.3 Authenticated home shows "My recipes" and "Parse a recipe" links
- [x] 3.4 `/recipes` redirects unauthenticated users to `/sign-in`
- [x] 3.5 `/recipes` shows "No recipes yet." for fresh account
- [x] 3.6 Saved recipe appears in list with title and date
- [x] 3.7 Multiple recipes in reverse-chronological order
- [x] 3.8 "New recipe" and "Parse with AI" buttons navigate correctly
- [x] 3.9 End-to-end flow: home → /recipes → /recipes/new → save → list shows new entry
