# Delete Saved Recipe — Implementation Plan

## Overview

Add the ability for an authenticated user to delete one of their saved recipes from the recipe detail page. Deletion is permanent; a native `confirm()` dialog guards against accidental clicks. On success the user is redirected to `/recipes`.

## Current State Analysis

- `src/app/actions/recipes.ts` — has `saveRecipe` only; no delete action exists.
- `src/app/recipes/[id]/page.tsx` — Server Component; renders recipe detail with no delete UI.
- Database: `recipes` table has an RLS delete policy (`recipes_delete`) scoped to `user_id = auth.uid()`. `recipe_ingredients` rows cascade-delete via FK constraint. No migration is needed.

## Desired End State

A "Delete recipe" button is visible on the recipe detail page for authenticated users. Clicking it shows a browser `confirm()` dialog. Confirming calls the server action, which deletes the recipe (cascade removes its ingredients), then redirects the user to `/recipes`. The list page reflects the deletion immediately.

### Key Discoveries

- `src/app/actions/recipes.ts:14-16` — pattern for auth check: `supabase.auth.getUser()`, return `{ error: 'Unauthorized' }` if no user.
- `src/app/recipes/[id]/page.tsx:18` — detail page already redirects unauthenticated users to `/sign-in`; delete UI only needs to be rendered when user exists (which is always the case by that point).
- RLS enforces ownership at the DB level — the server action only needs to delete by `id`; RLS rejects rows the user doesn't own.
- The detail page is a Server Component; the delete button requires a Client Component wrapper for `window.confirm()` interactivity.

## What We're NOT Doing

- No delete from the recipes list page (detail page only).
- No soft-delete / undo / trash mechanism.
- No custom modal — native `confirm()` dialog.
- No batch deletion.

## Implementation Approach

1. Add `deleteRecipe(id)` server action — auth check, Supabase delete by id, redirect to `/recipes`.
2. Create a `DeleteRecipeButton` Client Component — renders a button, calls `window.confirm()`, then calls the server action.
3. Mount `DeleteRecipeButton` in the detail page Server Component (already authenticated at that point).

---

## Phase 1: Server Action

### Overview

Add `deleteRecipe` to the existing server actions file. The action authenticates the caller, deletes the recipe row (RLS + cascade handle the rest), and redirects to `/recipes`.

### Changes Required

#### 1. `src/app/actions/recipes.ts`

**File**: `src/app/actions/recipes.ts`

**Intent**: Add a `deleteRecipe(id: string)` export that authenticates the user, deletes the recipe, and redirects to `/recipes`. If the user is unauthenticated or the delete fails, return `{ error: string }`.

**Contract**: Function signature `deleteRecipe(id: string): Promise<{ error?: string }>`. Uses the same `createClient` + `supabase.auth.getUser()` pattern as `saveRecipe`. Calls `supabase.from('recipes').delete().eq('id', id).eq('user_id', user.id)` — the `user_id` filter is belt-and-suspenders on top of RLS. On success, calls `redirect('/recipes')` from `next/navigation`.

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run lint`

#### Manual Verification

- Calling `deleteRecipe` with a valid recipe id (owned by the authenticated user) removes the recipe and its ingredients from the database.
- Calling with an id owned by a different user (or unauthenticated) returns `{ error: ... }` and leaves data untouched.

**Implementation Note**: After completing this phase and verifying, proceed to Phase 2.

---

## Phase 2: Delete UI on Detail Page

### Overview

Add a `DeleteRecipeButton` Client Component that shows a `confirm()` dialog and invokes the server action. Mount it on the recipe detail page.

### Changes Required

#### 1. `src/app/recipes/[id]/DeleteRecipeButton.tsx` (new file)

**File**: `src/app/recipes/[id]/DeleteRecipeButton.tsx`

**Intent**: Client Component that renders a "Delete recipe" button. On click, it calls `window.confirm('Delete this recipe? This cannot be undone.')`. If the user confirms, it calls `deleteRecipe(id)` and handles any returned error (e.g., `alert(error)`).

**Contract**: Accepts `id: string` prop. Marked `'use client'`. Imports `deleteRecipe` from `@/app/actions/recipes`. Button styled consistently with existing destructive-action patterns in the codebase (red or zinc/muted tone — follow whatever Tailwind classes are used elsewhere for secondary/danger actions).

#### 2. `src/app/recipes/[id]/page.tsx`

**File**: `src/app/recipes/[id]/page.tsx`

**Intent**: Import and render `DeleteRecipeButton` below the back link (or below the title), passing `id` as the prop. The user is already authenticated at this point in the page (redirect guard on line 18), so no additional auth check is needed in the UI.

**Contract**: `<DeleteRecipeButton id={id} />` placed after the `← My recipes` link and before or after the `<h1>` — pick whichever reads naturally. No other changes to the page structure.

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run lint`
- No TypeScript errors: `npx tsc --noEmit`

#### Manual Verification

- "Delete recipe" button is visible on the detail page when authenticated.
- Clicking shows a browser confirm dialog with an appropriate message.
- Cancelling the dialog leaves the recipe intact and the user stays on the page.
- Confirming deletes the recipe and redirects to `/recipes`; the deleted recipe no longer appears in the list.
- Navigating to `/recipes/[deleted-id]` after deletion returns a 404.

**Implementation Note**: After completing this phase and manual testing passes, the feature is done.

---

## Testing Strategy

### Manual Testing Steps

1. Log in, save a recipe, navigate to its detail page.
2. Click "Delete recipe" → cancel in the confirm dialog → recipe still exists, page unchanged.
3. Click "Delete recipe" → confirm → redirected to `/recipes` → recipe absent from list.
4. Attempt direct URL `/recipes/[deleted-id]` → 404.
5. (Optional) Try deleting a recipe id that belongs to a different test account — server action should return an error.

## References

- Similar action pattern: `src/app/actions/recipes.ts` (`saveRecipe`)
- Detail page host: `src/app/recipes/[id]/page.tsx`
- RLS policy: `supabase/migrations/20260530000000_recipes_schema.sql`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Server Action

#### Automated

- [ ] 1.1 Type checking passes: `npm run lint`

#### Manual

- [ ] 1.2 `deleteRecipe` removes an owned recipe and its ingredients from the database
- [ ] 1.3 `deleteRecipe` with an unowned id returns `{ error: ... }` and leaves data untouched

### Phase 2: Delete UI on Detail Page

#### Automated

- [ ] 2.1 Type checking passes: `npm run lint`
- [ ] 2.2 No TypeScript errors: `npx tsc --noEmit`

#### Manual

- [ ] 2.3 Delete button visible on detail page when authenticated
- [ ] 2.4 Cancelling confirm dialog leaves recipe intact
- [ ] 2.5 Confirming deletes recipe and redirects to `/recipes`
- [ ] 2.6 Deleted recipe absent from list; direct URL returns 404
