# recipes + recipe_ingredients Schema with RLS — Implementation Plan

## Overview

Create the two-table persistence foundation for NutriCalc recipes: `recipes` (one row per recipe, with title, optional raw text, and a pre-computed nutrient totals snapshot) and `recipe_ingredients` (one row per ingredient, with name, quantity, unit, and 16 per-ingredient nutrient values). Both tables are protected by CRUD RLS policies keyed to `auth.uid()`. The schema encodes the missing-flag invariant at the column level so no write path can silently zero-fill a nutrient. A TypeScript boundary adapter maps null ↔ `"missing"` at the DB edge so the rest of the app speaks `IngredientNutrients` natively.

## Current State Analysis

- No migrations directory and no recipe tables exist. The Supabase project is live (auth, Google OAuth wired), but the schema is empty beyond Supabase's built-in `auth` tables.
- `src/lib/nutrition.ts` defines `IngredientNutrients` (16 fields, `number | "missing"`) and `NutrientValue = number | "missing"`. This is the canonical application type — the DB schema and boundary adapter must round-trip it faithfully.
- `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts` are in place with `@supabase/ssr`. Auth middleware sets `auth.uid()` on every authenticated request.
- Supabase CLI is not installed. No `supabase/` directory exists.

## Desired End State

After this change:

1. `recipes` and `recipe_ingredients` tables exist in Supabase with the schema defined below.
2. CRUD RLS policies are active on both tables. An unauthenticated client gets zero rows on any SELECT; an authenticated user can only read/write their own recipes and ingredients.
3. `src/lib/database.types.ts` is generated from the live schema and committed.
4. `src/lib/db/recipes.ts` exports four mapping functions that translate between nullable DB columns and the `IngredientNutrients` type. Every downstream slice (S-03 through S-06) imports these functions rather than re-implementing the null ↔ "missing" mapping.

### Key Discoveries

- `recipe_ingredients` has no `user_id` column — it inherits ownership through `recipe_id → recipes.user_id`. RLS policies on `recipe_ingredients` must therefore use an EXISTS subquery into `recipes`, not a direct column check. This is a non-obvious security requirement.
- The 16 nutrient field names in `IngredientNutrients` are camelCase (`vitaminC`, `vitaminB12`, `vitaminD`); the DB columns are snake_case (`vitamin_c`, `vitamin_b12`, `vitamin_d`). The boundary adapter handles this mapping in one place.
- `supabase db push` applies only the delta — idempotent if a migration file has already been applied. Running it again after a schema edit requires a new migration file, not editing the existing one.

## What We're NOT Doing

- No query helper functions for CRUD operations (insert recipe, list recipes, delete, etc.) — those belong to S-03, S-04, S-05, S-06 respectively.
- No `updated_at` column in the initial schema — S-05 (edit) can add it via a follow-on migration if needed.
- No seed data, no test fixtures, no local Supabase Docker setup (remote project only for MVP).
- No full-text search, tags, or any metadata beyond title, raw_text, and nutrient fields.
- No per-ingredient nutrition caching layer — parked per roadmap.

## Implementation Approach

Three sequential phases. Phase 1 installs and links the Supabase CLI against the existing remote project. Phase 2 writes the migration SQL and applies it, then generates TypeScript types from the live schema. Phase 3 writes the boundary adapter using the generated types. Each phase gates the next: the adapter depends on the generated types, the types depend on the migration being applied.

## Critical Implementation Details

**RLS on `recipe_ingredients` uses a subquery, not a column check.** The table has no `user_id` column — ownership is asserted by joining through `recipes`. Both the `USING` clause (for SELECT/UPDATE/DELETE) and the `WITH CHECK` clause (for INSERT/UPDATE) must use `EXISTS (SELECT 1 FROM recipes WHERE id = recipe_id AND user_id = auth.uid())`. Omitting the EXISTS and checking a non-existent `user_id` column will silently allow all rows through (no RLS error; just a policy that always returns false, blocking all access). Verify after apply by checking the Supabase dashboard Policies tab.

---

## Phase 1: Supabase CLI setup

### Overview

Install the Supabase CLI as a devDependency, initialise the `supabase/` directory structure, link to the existing remote project, and add convenience scripts to `package.json`.

### Changes Required

#### 1. Install Supabase CLI

**File**: `package.json`

**Intent**: Add `supabase` as a devDependency so the CLI is available via `npx supabase` without a global install.

**Contract**: Run `npm install supabase --save-dev`, which adds `"supabase": "^x.y.z"` to `devDependencies`. Add these scripts:
```json
"supabase:link": "supabase link --project-ref zdflqcdikfpxdihrpcrx",
"supabase:push": "supabase db push",
"supabase:types": "supabase gen types typescript --linked --schema public > src/lib/database.types.ts"
```

#### 2. Initialise Supabase directory

**File**: `supabase/config.toml` (created by CLI)

**Intent**: Run `npx supabase init` to scaffold the `supabase/` directory. This creates `supabase/config.toml` and `supabase/migrations/`. No manual editing of `config.toml` is needed for this plan — the defaults are correct for remote-only usage.

**Contract**: After `npx supabase init`, the directory `supabase/migrations/` exists (empty). Commit the `supabase/` directory including `config.toml`.

#### 3. Link to remote project

**Intent**: Run `npx supabase login` (interactive; requires browser) then `npx supabase link --project-ref zdflqcdikfpxdihrpcrx`. The link step writes the project ref into the local Supabase config so subsequent `db push` and `gen types` commands target the correct project without repeating the ref.

**Contract**: `npx supabase status` returns the linked project URL after this step. The `supabase/` directory is the only output — no application source files change.

### Success Criteria

#### Automated Verification

- `npx supabase --version` prints a version string without error
- `supabase/migrations/` directory exists in the repo

#### Manual Verification

- `npx supabase status` shows the linked project `zdflqcdikfpxdihrpcrx`

**Implementation Note**: Pause after Phase 1 manual verification before proceeding to Phase 2.

---

## Phase 2: Schema migration + type generation

### Overview

Write the full migration SQL defining both tables, their indexes, and all RLS policies. Apply it to the remote project via `supabase db push`. Generate `src/lib/database.types.ts` from the live schema.

### Changes Required

#### 1. Migration SQL file

**File**: `supabase/migrations/20260530000000_recipes_schema.sql`

**Intent**: Define `recipes` and `recipe_ingredients` tables with all constraints, indexes, RLS enablement, and CRUD policies. This is the authoritative schema contract that the type generator and boundary adapter are built from.

**Contract**:

```sql
-- recipes: one row per saved recipe, owned by a user
CREATE TABLE recipes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  raw_text       TEXT,
  -- Nutrient totals snapshot (NULL = missing)
  total_energy      NUMERIC, total_protein     NUMERIC, total_fat         NUMERIC,
  total_carbs       NUMERIC, total_fiber       NUMERIC, total_sodium      NUMERIC,
  total_calcium     NUMERIC, total_iron        NUMERIC, total_vitamin_c   NUMERIC,
  total_vitamin_d   NUMERIC, total_zinc        NUMERIC, total_potassium   NUMERIC,
  total_vitamin_b12 NUMERIC, total_folate      NUMERIC, total_magnesium   NUMERIC,
  total_phosphorus  NUMERIC,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- recipe_ingredients: one row per ingredient, child of a recipe
CREATE TABLE recipe_ingredients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  UUID        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  quantity   NUMERIC     NOT NULL,
  unit       TEXT        NOT NULL,
  -- Per-ingredient nutrient values (NULL = missing)
  energy      NUMERIC, protein     NUMERIC, fat         NUMERIC,
  carbs       NUMERIC, fiber       NUMERIC, sodium      NUMERIC,
  calcium     NUMERIC, iron        NUMERIC, vitamin_c   NUMERIC,
  vitamin_d   NUMERIC, zinc        NUMERIC, potassium   NUMERIC,
  vitamin_b12 NUMERIC, folate      NUMERIC, magnesium   NUMERIC,
  phosphorus  NUMERIC,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX recipes_user_id_created_at_idx  ON recipes(user_id, created_at DESC);
CREATE INDEX recipe_ingredients_recipe_id_idx ON recipe_ingredients(recipe_id);

-- Enable RLS on both tables
ALTER TABLE recipes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS: recipes — direct user_id check
CREATE POLICY "recipes_select" ON recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recipes_insert" ON recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_update" ON recipes FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_delete" ON recipes FOR DELETE USING (auth.uid() = user_id);

-- RLS: recipe_ingredients — ownership via parent recipes row
CREATE POLICY "ri_select" ON recipe_ingredients FOR SELECT
  USING   (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY "ri_insert" ON recipe_ingredients FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY "ri_update" ON recipe_ingredients FOR UPDATE
  USING     (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
CREATE POLICY "ri_delete" ON recipe_ingredients FOR DELETE
  USING   (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));
```

#### 2. Apply migration

**Intent**: Run `npm run supabase:push` (or `npx supabase db push`) to apply the migration file to the remote project. This creates both tables and all policies in the live Supabase instance.

**Contract**: `supabase db push` reports the migration as applied. No rollback mechanism is built in at this stage — if the migration needs to be re-run, drop the tables manually via the Supabase dashboard and re-apply.

#### 3. Generate TypeScript types

**File**: `src/lib/database.types.ts`

**Intent**: Run `npm run supabase:types` to generate authoritative TypeScript types from the live schema. This file is the single source of truth for DB row types — it must be committed and re-generated whenever the schema changes.

**Contract**: The generated file exports a `Database` interface with `public.Tables.recipes.Row`, `public.Tables.recipes.Insert`, `public.Tables.recipe_ingredients.Row`, and `public.Tables.recipe_ingredients.Insert`. Do not hand-edit this file — it is fully regenerated on each `supabase:types` run.

### Success Criteria

#### Automated Verification

- `npx supabase db push` exits 0 with "Applied 1 migration"
- `src/lib/database.types.ts` exists and is non-empty
- `npm run typecheck` passes with the generated types in place
- `npm run lint` passes

#### Manual Verification

- Supabase dashboard → Table Editor: both `recipes` and `recipe_ingredients` tables are visible
- Supabase dashboard → Authentication → Policies: 4 policies on `recipes`, 4 on `recipe_ingredients`
- Perform a SELECT on `recipes` as an unauthenticated client (e.g., via the Supabase SQL editor with `SET LOCAL role = anon`): returns 0 rows, not an error

**Implementation Note**: Pause after manual RLS verification before proceeding to Phase 3.

---

## Phase 3: TypeScript boundary adapter

### Overview

Write `src/lib/db/recipes.ts` — the single module that translates between DB row types (nullable NUMERIC columns, snake_case) and the application type `IngredientNutrients` (camelCase, `number | "missing"`). Every downstream slice imports from this module; no other file re-implements the null ↔ "missing" mapping.

### Changes Required

#### 1. Boundary adapter module

**File**: `src/lib/db/recipes.ts`

**Intent**: Export four mapping functions covering the two tables × two directions (DB → app, app → DB). Centralises the null ↔ "missing" conversion and the snake_case ↔ camelCase rename so it happens in one place.

**Contract**: The module exports these four functions:

```typescript
// DB row → IngredientNutrients (for recipe_ingredients rows)
ingredientRowToNutrients(row: Database['public']['Tables']['recipe_ingredients']['Row']): IngredientNutrients

// IngredientNutrients → DB insert columns (for recipe_ingredients inserts)
nutrientsToIngredientColumns(nutrients: IngredientNutrients): NutrientInsertColumns

// DB row → IngredientNutrients representing recipe-level totals (for recipes rows)
recipeRowToTotals(row: Database['public']['Tables']['recipes']['Row']): IngredientNutrients

// IngredientNutrients → DB insert columns for recipe totals (for recipes inserts/updates)
totalsToRecipeColumns(totals: IngredientNutrients): TotalInsertColumns
```

Where `NutrientInsertColumns` and `TotalInsertColumns` are local helper types (Pick of the relevant Insert type). Each function maps `null → "missing"` on the way out and `"missing" → null` on the way in. The three fields with name mismatches (`vitamin_c` ↔ `vitaminC`, `vitamin_d` ↔ `vitaminD`, `vitamin_b12` ↔ `vitaminB12`) are handled inside these functions.

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes — the adapter types are consistent with `IngredientNutrients` from `src/lib/nutrition.ts` and the generated `Database` type from `src/lib/database.types.ts`
- `npm run lint` passes

#### Manual Verification

- Import `ingredientRowToNutrients` in a scratch Server Component or a quick Node script and pass a mock row where `vitamin_c = null` and `protein = 25.4` — verify the output has `vitaminC: "missing"` and `protein: 25.4`
- Pass a mock row where all 16 fields are non-null — verify no `"missing"` values appear in the output

**Implementation Note**: After Phase 3 automated and manual verification pass, this change is complete. The schema + types + adapter are the complete deliverable for F-03. Downstream slices (S-03, S-04, etc.) build on top.

---

## Testing Strategy

### Unit Tests

No test runner is configured yet (noted in CLAUDE.md). When one is added, the boundary adapter functions are the highest-priority unit test targets:
- `ingredientRowToNutrients`: all-null row → all "missing", all-non-null row → all numeric, mixed row
- `nutrientsToIngredientColumns`: all "missing" → all null, mixed → correct nulls

### Integration Tests

- Regression: user-A cannot SELECT a recipe row created by user-B under URL manipulation (Supabase dashboard SQL editor test or a dedicated server-side script)

### Manual Testing Steps

1. Apply migration; confirm tables + policies in Supabase dashboard
2. Verify unauthenticated SELECT returns 0 rows (not a permission error that leaks schema info)
3. Verify authenticated SELECT as a fresh user returns 0 rows (correct isolation baseline)
4. Import and smoke-test the boundary adapter with a null-and-non-null mixed row

## Performance Considerations

The `recipes_user_id_created_at_idx` index supports the chronological list query for S-04 at MVP scale (dozens to hundreds of recipes per user). The `recipe_ingredients_recipe_id_idx` supports per-recipe ingredient fetches. Both are sufficient for the `target_scale: small` defined in the PRD.

## Migration Notes

No existing recipe data to migrate — this is the first schema. If the migration needs to be re-applied (e.g., after a failed push), drop both tables via the Supabase dashboard SQL editor (`DROP TABLE IF EXISTS recipe_ingredients; DROP TABLE IF EXISTS recipes;`) and re-run `npm run supabase:push`. Do not edit the applied migration file — write a new one.

## References

- PRD: `context/foundation/prd.md` — FR-007, NFR data isolation
- Roadmap: `context/foundation/roadmap.md` — F-03 entry, S-06 cascade delete note
- Nutrition types: `src/lib/nutrition.ts:1-22` — `IngredientNutrients`, `NutrientValue`
- Supabase server client: `src/lib/supabase/server.ts`
- Auth middleware: `src/middleware.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Supabase CLI setup

#### Automated

- [x] 1.1 `npx supabase --version` prints a version string without error — 5fdf3f7
- [x] 1.2 `supabase/migrations/` directory exists in the repo — 5fdf3f7

#### Manual

- [x] 1.3 `npx supabase status` shows the linked project `zdflqcdikfpxdihrpcrx` — 5fdf3f7

### Phase 2: Schema migration + type generation

#### Automated

- [x] 2.1 `npx supabase db push` exits 0 with "Applied 1 migration" — 955a06d
- [x] 2.2 `src/lib/database.types.ts` exists and is non-empty — 955a06d
- [x] 2.3 `npm run typecheck` passes with generated types in place — 955a06d
- [x] 2.4 `npm run lint` passes — 955a06d

#### Manual

- [x] 2.5 Supabase dashboard — both `recipes` and `recipe_ingredients` tables are visible — 955a06d
- [x] 2.6 Supabase dashboard — 4 policies on `recipes`, 4 on `recipe_ingredients` — 955a06d
- [x] 2.7 Unauthenticated SELECT on `recipes` returns 0 rows — 955a06d

### Phase 3: TypeScript boundary adapter

#### Automated

- [x] 3.1 `npm run typecheck` passes with adapter types consistent with `IngredientNutrients` and `Database` — 22e2a57
- [x] 3.2 `npm run lint` passes — 22e2a57

#### Manual

- [x] 3.3 Smoke test: `ingredientRowToNutrients` with `vitamin_c = null, protein = 25.4` → `vitaminC: "missing", protein: 25.4` — 22e2a57
- [x] 3.4 Smoke test: all-non-null row produces no `"missing"` values — 22e2a57
