# Delete Saved Recipe — Plan Brief

> Full plan: `context/changes/delete-saved-recipe/plan.md`

## What & Why

Allow users to permanently delete a saved recipe from its detail page. The feature is missing despite the DB-level RLS delete policy already being in place — the application layer simply never exposes it.

## Starting Point

`saveRecipe` server action and a read-only detail page exist. The `recipes` table has an RLS delete policy scoped to the owning user, and `recipe_ingredients` rows cascade-delete via FK. No schema changes needed.

## Desired End State

A "Delete recipe" button appears on `/recipes/[id]` for authenticated users. A browser `confirm()` dialog prevents accidental deletion. Confirming calls a server action that removes the recipe (and its ingredients via cascade), then redirects the user to `/recipes`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Entry point | Detail page only | Simpler — one UI location; user naturally navigates in before deleting. |
| Confirmation UX | Browser `confirm()` | Zero extra components; the native dialog is sufficient for low-frequency destructive action. |
| Post-delete redirect | `/recipes` list | Consistent regardless of entry point; list refreshes automatically. |
| Auth guard | Hide button server-side; RLS enforces ownership | Defense in depth — matches existing `saveRecipe` pattern. |

## Scope

**In scope:** `deleteRecipe` server action, `DeleteRecipeButton` Client Component, mounting on detail page.

**Out of scope:** Delete from list page, soft-delete/undo, batch deletion, custom modal.

## Architecture / Approach

The detail page (`src/app/recipes/[id]/page.tsx`) is a Server Component. `window.confirm()` requires the browser, so the button lives in a thin `DeleteRecipeButton` Client Component co-located in `src/app/recipes/[id]/`. The server action in `src/app/actions/recipes.ts` does auth + delete + redirect — same pattern as `saveRecipe`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Server Action | `deleteRecipe(id)` with auth + cascade + redirect | None — straightforward Supabase delete |
| 2. Delete UI | Button + confirm dialog on detail page | Minimal — thin Client Component wrapping the action |

**Prerequisites:** User must be authenticated (detail page already enforces this).  
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- `recipe_ingredients` FK cascade is assumed to be `ON DELETE CASCADE` — verify in the schema migration before shipping.

## Success Criteria (Summary)

- Confirming deletion removes the recipe and redirects to `/recipes` with the recipe absent from the list.
- Cancelling leaves data and page state untouched.
- Direct URL to a deleted recipe returns 404.
