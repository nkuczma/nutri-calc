# Security Boundary Coverage — Plan Brief

> Full plan: `context/changes/testing-security-boundary-coverage/plan.md`

## What & Why

Add integration tests proving that the app's security boundaries hold: a user cannot delete another user's recipe (Risk #4), and the AI parse endpoint cannot be called without an authenticated session (Risk #7). These are the two risks designated for Phase 2 in the test plan — both have clear failure modes that bypass middleware and require app-layer verification.

## Starting Point

Phase 1 bootstrapped Vitest + MSW and added unit/integration tests for pure lib functions. No existing test mocks `createClient` from `@/lib/supabase/server` or tests server actions / route handlers directly. The test runner is operational; the patterns from Phase 1 inform but don't fully cover the new mock shape needed here.

## Desired End State

Two new test files under `src/__tests__/integration/` pass cleanly alongside the Phase 1 suite. `recipes-isolation.test.ts` proves `deleteRecipe` correctly scopes its Supabase query to the authenticated user's ID. `parse-auth.test.ts` proves the parse handler returns 401 with no session. Cookbook §6.3 documents the established `vi.mock` pattern for future security tests.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| How to test server actions / routes | `vi.mock('@/lib/supabase/server')` + direct import | No new deps, consistent with Vitest idioms, fast |
| What to assert for delete isolation | Spy on `.eq("user_id", authenticatedUserId)` call | Tests what the app layer owns (query params), not RLS internals |
| updateRecipe isolation | Out of scope | Ownership check lives inside the Postgres RPC, not app layer |
| Parse route test invocation | Import POST handler, pass mock Request | No HTTP server needed; handler's own check is the sole gate |
| Test file location | `src/__tests__/integration/` | Natural extension of Phase 1 directory structure |

## Scope

**In scope:**
- `deleteRecipe` — unauthenticated call returns Unauthorized; authenticated call applies user-scoped filter
- `POST /api/parse-recipe` — unauthenticated call returns 401
- Cookbook §6.3 filled in with `vi.mock` pattern

**Out of scope:**
- `updateRecipe` cross-user test (RPC-level protection)
- RLS policy verification
- Authenticated happy paths (covered elsewhere)
- HTTP-level / full-stack route testing

## Architecture / Approach

Both test files mock `@/lib/supabase/server` at the module level via `vi.mock`, returning a fake client with a controlled `auth.getUser()` and a spy-instrumented Supabase query builder chain. `next/navigation`'s `redirect` is also mocked to prevent test-context throws. Route handler `POST` is imported and called with a `new Request(...)` object — no dev server required.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Delete Isolation Test | Risk #4 covered; `vi.mock` pattern for server actions established | Fluent Supabase chain mock is fiddly to set up correctly |
| 2. Parse-Route Auth Test + Cookbook | Risk #7 covered; §6.3 documented | None — simpler than Phase 1; same mock shape |

**Prerequisites:** Phase 1 test infrastructure complete (Vitest, MSW, `src/__tests__/setup.ts`) ✓  
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- The Supabase query builder mock (fluent chain + `thenable`) needs careful construction — if the shape is wrong the test passes vacuously. The implementer should verify the spy was actually called (not just that the test didn't throw).
- `ai` SDK's `streamObject` is an indirect import in the parse route — confirmed it's unreachable when auth fails first, so no AI SDK mock needed. Verify this assumption holds if the import order in route.ts ever changes.

## Success Criteria (Summary)

- `npm test` shows four new passing tests across two files with no regressions in Phase 1 tests
- §6.3 in `context/foundation/test-plan.md` replaced with a concrete, copy-pasteable pattern
- Phase 2 row in the test plan's §3 table updated to `complete`
