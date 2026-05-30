# recipes + recipe_ingredients Schema with RLS — Plan Brief

> Full plan: `context/changes/recipes-schema-rls/plan.md`

## What & Why

Create the two-table persistence foundation that all recipe CRUD slices (S-03 through S-06) depend on. The schema enforces the NutriCalc critical invariant — "no silent zeros" — at the database level by using nullable NUMERIC columns where NULL means absent, rather than relying on application-layer validation alone. Without this foundation, no recipe can be saved or retrieved.

## Starting Point

The Supabase project is live with Google OAuth working and `auth.uid()` available in RLS. No recipe tables, no migrations directory, and no Supabase CLI exist yet — this is the first DB schema in the project. `src/lib/nutrition.ts` already defines the `IngredientNutrients` type (16 fields, `number | "missing"`) that the schema must round-trip.

## Desired End State

Two tables in Supabase — `recipes` and `recipe_ingredients` — with full CRUD RLS keyed to `auth.uid()`. Any SELECT, INSERT, UPDATE, or DELETE from an unauthenticated client or a user who doesn't own the row is blocked at the database level, not just in application code. `src/lib/database.types.ts` is generated from the live schema and committed. `src/lib/db/recipes.ts` exports four mapping functions (null ↔ `"missing"`, snake_case ↔ camelCase) so downstream slices never re-implement the boundary conversion.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Nutrient storage format | 16 named nullable NUMERIC columns per table | DB-level type enforcement; maps 1-to-1 to `IngredientNutrients`; allows SQL aggregation | Plan |
| Missing-flag encoding | NULL = missing | DB type system enforces the invariant; no separate tracking column needed | Plan |
| Recipe totals | Stored snapshot in `recipes` (16 `total_*` columns) | Single-row fetch for list/detail views; avoids per-load SUM aggregation | Plan |
| Recipe fields | id, user_id, title (required), raw_text (nullable), created_at | Title required for list view; raw_text preserved for AI path debugging | Plan |
| RLS on recipe_ingredients | EXISTS subquery into `recipes` | The table has no `user_id` column — ownership is asserted through the parent row | Plan |
| Migration tooling | Supabase CLI (`supabase db push`) | Standard reproducible workflow; SQL file is reviewable in git | Plan |
| TypeScript types | `supabase gen types typescript --linked` | Authoritative types from the live schema; no hand-maintenance | Plan |

## Scope

**In scope:**
- `recipes` table with title, raw_text, 16 nullable NUMERIC total columns
- `recipe_ingredients` table with name, quantity, unit, 16 nullable NUMERIC nutrient columns
- CRUD RLS policies on both tables
- Supabase CLI install + project link
- `src/lib/database.types.ts` generated from live schema
- `src/lib/db/recipes.ts` boundary adapter (null ↔ "missing", snake_case ↔ camelCase)

**Out of scope:**
- CRUD query functions (insert, list, delete) — belong to S-03/S-04/S-06
- `updated_at` column — S-05 adds it via a follow-on migration if needed
- Local Supabase Docker setup
- Full-text search, tags, serving scaling, or any other metadata

## Architecture / Approach

Two normalized tables. `recipes` owns the user relationship (`user_id → auth.users`). `recipe_ingredients` cascades from `recipes` (`recipe_id → recipes.id ON DELETE CASCADE`). RLS on `recipes` uses a direct `user_id = auth.uid()` check. RLS on `recipe_ingredients` uses an EXISTS subquery through `recipes` since the ingredients table has no `user_id` of its own — this is the key non-obvious security requirement. A single adapter module (`src/lib/db/recipes.ts`) handles all null ↔ "missing" and snake_case ↔ camelCase conversions, keeping the invariant enforcement in one place.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Supabase CLI setup | CLI installed, project linked, `supabase/migrations/` scaffolded | Interactive `supabase login` step requires browser — can't be automated |
| 2. Schema migration + type generation | Tables + RLS applied to remote; `database.types.ts` generated | Incorrect EXISTS subquery in `recipe_ingredients` RLS silently breaks access |
| 3. TypeScript boundary adapter | `src/lib/db/recipes.ts` — null ↔ "missing" mapping for all 16 fields | Type drift between hand-written adapter and generated types if types are regenerated without updating adapter |

**Prerequisites:** F-01 (`auth-supabase-oauth`) must be merged — `auth.uid()` must be available in the Supabase project for RLS policies to function.
**Estimated effort:** ~1 session across 3 phases (schema design is the bulk; CLI setup and type gen are mechanical).

## Open Risks & Assumptions

- `supabase login` is an interactive step (browser-based) — the implementer must run it manually before `db push`
- `supabase gen types typescript` requires the project to be linked and the migration to be applied before running; running it against an empty schema produces useless types
- Adding a 17th nutrient field in the future requires a schema migration AND regenerating `database.types.ts` AND updating the boundary adapter — three coordinated steps

## Success Criteria (Summary)

- Unauthenticated SELECT on `recipes` returns 0 rows (RLS blocks access, not an error)
- Authenticated user can only see their own recipe rows — a second user's rows are invisible
- `ingredientRowToNutrients` correctly maps `null → "missing"` for absent nutrient columns and `number → number` for present ones
