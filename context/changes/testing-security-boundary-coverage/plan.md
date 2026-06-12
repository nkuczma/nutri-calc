# Security Boundary Coverage — Implementation Plan

## Overview

Add integration tests that prove Risk #4 (cross-user data isolation) and Risk #7 (unauthenticated parse-route rejection) hold at the application layer. Phase 1 tested pure lib functions; Phase 2 is the first to exercise auth-gated server actions and API route handlers using `vi.mock` on `@/lib/supabase/server`.

## Current State Analysis

- Test runner (Vitest ^4.1.8), MSW (^2.14.6), and setup infrastructure are fully operational from Phase 1.
- Existing tests live under `src/__tests__/lib/` — no precedent yet for mocking `createClient` or testing server actions / route handlers.
- **Risk #4 — delete path:** `deleteRecipe` (`src/app/actions/recipes.ts:118`) applies `.eq("user_id", user.id)` as a query filter but **does not check row count** — a cross-user attempt silently deletes 0 rows with no error. Protection is RLS-enforced at the DB; the app-layer test must prove the authenticated user's ID is correctly threaded into the query filter.
- **Risk #4 — update path:** out of scope for this phase (per planning decision — `updateRecipe` ownership check lives inside the RPC, not a testable app-layer path).
- **Risk #7 — parse route:** `/api/parse-recipe` is excluded from middleware (`src/middleware.ts:52`), so the route handler's own `getUser()` check (line 12-13) is the sole auth gate.
- `deleteRecipe` calls `redirect("/recipes")` on success (line 133) — this throws a special Next.js error in test context; `next/navigation` must be mocked.

## Desired End State

Two integration test files under `src/__tests__/integration/`:

1. `recipes-isolation.test.ts` — Risk #4: proves `deleteRecipe` constructs its Supabase query with the authenticated user's `user_id` as a filter, and returns `{ error: "Unauthorized" }` when called without a session.
2. `parse-auth.test.ts` — Risk #7: proves the parse route handler returns HTTP 401 when called without an authenticated session.

Cookbook §6.3 filled in with the established pattern.

### Key Discoveries:

- `createClient` from `@/lib/supabase/server` is the single import to mock for all auth-gated code — both server actions and route handlers import it.
- Supabase query builder is fluent (`.from().delete().eq().eq()` returns a PromiseLike) — mock must be `thenable` so `await` resolves; spy on `eq` call arguments to assert the filter values.
- `next/navigation`'s `redirect()` must be mocked (`vi.mock('next/navigation', () => ({ redirect: vi.fn() }))`) to prevent test-context throws on successful delete.
- The parse route imports `streamObject` from `ai` — the `vi.mock` for `createClient` only needs to short-circuit before that code is reached (auth check is first), so no AI SDK mocking required for the unauth test.

## What We're NOT Doing

- Testing `updateRecipe` cross-user isolation — the ownership check is inside the Postgres RPC, not the app layer.
- Testing RLS policies directly — we trust the Supabase platform.
- Testing the authenticated happy path for parse or delete — Phase 1 and app-level smoke cover that.
- HTTP server-level testing (no `next-test-api-route-handler` or dev server) — direct handler invocation is sufficient given the scoped goal.

## Implementation Approach

Mock `@/lib/supabase/server` at the module level in each test file using `vi.mock`. Return a controlled fake client that exposes spies for the query-builder chain. Import and call server action functions / route handler POST functions directly. Assert on spy arguments (for the isolation test) and on the returned value/response status (for both tests).

## Phase 1: Delete Isolation Test + Supabase Mock Pattern

### Overview

Establish the `vi.mock` pattern for `createClient`, handle `redirect()` in test context, and cover Risk #4: a `deleteRecipe` call with an authenticated user must construct its Supabase query with `.eq("user_id", <authenticatedUserId>)`.

### Changes Required:

#### 1. Create the integration test directory

**File**: `src/__tests__/integration/` (new directory — create by placing a file in it)

**Intent**: Establish the `integration/` subdirectory so the cookbook pattern in §6.3 has a clear home.

#### 2. Delete isolation integration test

**File**: `src/__tests__/integration/recipes-isolation.test.ts`

**Intent**: Prove that `deleteRecipe` (a) returns `{ error: "Unauthorized" }` when no session exists and (b) applies the authenticated user's ID as the `user_id` filter on the Supabase delete query.

**Contract**: The test file must:
- `vi.mock('next/navigation', () => ({ redirect: vi.fn() }))` — declared before imports so Next.js's redirect doesn't throw.
- `vi.mock('@/lib/supabase/server')` — mock the module; in the mock factory, return a fake client whose `.from().delete()` chain is a PromiseLike spy. Capture the two `.eq()` calls so the test can assert the second call received `("user_id", USER_A_ID)`.
- Two `it` blocks:
  1. *Unauthenticated*: mock `getUser()` → `{ data: { user: null } }`; call `deleteRecipe("any-id")`; expect return value `{ error: "Unauthorized" }`; assert the Supabase `from` spy was never called.
  2. *Authenticated cross-user attempt*: mock `getUser()` → `{ data: { user: { id: "user-a" } } }`; mock the delete chain to resolve `{ error: null }`; call `deleteRecipe("recipe-owned-by-user-b")`; assert the `eq` spy was called with `("user_id", "user-a")` — proving the query filter is scoped to the requesting user regardless of the recipe ID passed in.

### Success Criteria:

#### Automated Verification:

- Tests pass: `npm test -- src/__tests__/integration/recipes-isolation.test.ts`
- Full suite still passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- Test output shows two passing cases with readable descriptions matching the two `it` block names.
- No other test files import or are affected by the new mock (confirm by running `npm test` and checking no regressions).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Parse-Route Auth Test + Cookbook Update

### Overview

Prove Risk #7: the `/api/parse-recipe` POST handler returns HTTP 401 when invoked without an authenticated session, using the same `vi.mock` pattern established in Phase 1. Then fill in cookbook §6.3 with the established integration test pattern.

### Changes Required:

#### 1. Parse-route auth integration test

**File**: `src/__tests__/integration/parse-auth.test.ts`

**Intent**: Prove that the `POST` handler from `@/app/api/parse-recipe/route` returns a 401 response when `getUser()` returns a null user — confirming the route's own auth check is the effective gate (since middleware skips `/api/` paths).

**Contract**: The test file must:
- `vi.mock('@/lib/supabase/server')` — factory returns a client whose `auth.getUser()` resolves `{ data: { user: null } }`.
- Import `POST` from `@/app/api/parse-recipe/route`.
- Construct a `new Request('http://localhost/api/parse-recipe', { method: 'POST', body: JSON.stringify({ recipeText: 'test' }), headers: { 'Content-Type': 'application/json' } })`.
- `const response = await POST(req)`.
- Assert `response.status === 401`.
- Assert the response JSON contains `{ error: "Unauthorized" }` (matching the literal string at route.ts line 13).

#### 2. Fill in cookbook §6.3

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the "TBD" placeholder in §6.3 with the concrete pattern established by this phase so future contributors can add security tests without re-deriving the mock setup.

**Contract**: Replace the `### 6.3 Adding a security integration test` section body with:
- Where to place the file: `src/__tests__/integration/<concern>.test.ts`
- How to mock the Supabase client: `vi.mock('@/lib/supabase/server')` with a fake client factory
- How to mock `next/navigation` redirect: `vi.mock('next/navigation', () => ({ redirect: vi.fn() }))`
- What to assert for auth failures: return value `{ error: "Unauthorized" }` for server actions; `response.status === 401` for route handlers
- How to spy on query-builder arguments for ownership assertions (reference `recipes-isolation.test.ts`)
- Examples: `src/__tests__/integration/recipes-isolation.test.ts`, `src/__tests__/integration/parse-auth.test.ts`

Also update the Phase 2 row in §3 Phased Rollout table: set `Status` to `complete`.

### Success Criteria:

#### Automated Verification:

- Both integration test files pass: `npm test -- src/__tests__/integration/`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- `npm test` output shows four passing tests across the two new files (two per file).
- §6.3 in `context/foundation/test-plan.md` no longer says "TBD" and provides a complete, copy-pasteable pattern.
- Phase 2 row in §3 shows `complete`.

---

## Testing Strategy

### Integration Tests:

- `src/__tests__/integration/recipes-isolation.test.ts` — unauthenticated deleteRecipe (returns Unauthorized), authenticated cross-user deleteRecipe (query filter asserted)
- `src/__tests__/integration/parse-auth.test.ts` — unauthenticated POST to parse handler (returns 401)

### Manual Testing Steps:

1. Run `npm test` and confirm all existing Phase 1 tests still pass alongside the new integration tests.
2. Confirm the two new test files are reported in test output with clear, readable test names.
3. Review §6.3 in `test-plan.md` for accuracy and clarity before marking complete.

## References

- Test plan: `context/foundation/test-plan.md` (Phase 2 row in §3, Risk Response Guidance for #4 and #7)
- Server actions under test: `src/app/actions/recipes.ts:118` (`deleteRecipe`)
- Parse route handler under test: `src/app/api/parse-recipe/route.ts:8`
- Middleware (explains why API routes self-check): `src/middleware.ts:52`
- Phase 1 integration pattern: `src/__tests__/lib/nutrition-fetch.test.ts` (MSW pattern — different but analogous)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Delete Isolation Test + Supabase Mock Pattern

#### Automated

- [x] 1.1 Tests pass: `npm test -- src/__tests__/integration/recipes-isolation.test.ts` — a413942
- [x] 1.2 Full suite still passes: `npm test` — a413942
- [x] 1.3 Lint passes: `npm run lint` — a413942

#### Manual

- [x] 1.4 Test output shows two passing cases with readable descriptions — a413942
- [x] 1.5 No regressions in other test files confirmed by full suite run — a413942

### Phase 2: Parse-Route Auth Test + Cookbook Update

#### Automated

- [x] 2.1 Both integration test files pass: `npm test -- src/__tests__/integration/` — 5e1ff62
- [x] 2.2 Full suite passes: `npm test` — 5e1ff62
- [x] 2.3 Lint passes: `npm run lint` — 5e1ff62

#### Manual

- [x] 2.4 Four passing tests across two new files visible in `npm test` output — 5e1ff62
- [x] 2.5 §6.3 in test-plan.md no longer says "TBD" and contains a complete pattern — 5e1ff62
- [x] 2.6 Phase 2 row in §3 shows `complete` — 5e1ff62
