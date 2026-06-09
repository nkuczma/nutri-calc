# Critical-Path Integration Coverage — Plan Brief

> Full plan: `context/changes/testing-critical-path-coverage/plan.md`
> Research: `context/changes/testing-critical-path-coverage/research.md`

## What & Why

Bootstrap Vitest + MSW and write the tests that protect the four highest-risk
code paths identified in the test plan (Risks #1, #2, #3, #5). The core risk
is that a change to nutrition logic could cause a nutrient that should display
as "missing" to silently become 0 — a value that looks valid to users. No test
runner currently exists, so this plan installs one and immediately puts it to
work.

## Starting Point

No Vitest, no MSW, no `test` script in `package.json`. The key business logic
(`NutrientValue = number | "missing"`, DB adapters, the `num()` extraction
guard) is well-structured but the aggregation rule is inlined and duplicated in
two places, making it untestable as a pure function without mocking Supabase.

## Desired End State

`npm test` runs a suite that protects:
- The DB null ↔ "missing" round-trip for all nine nutrient fields
- The aggregation rule: any ingredient missing a nutrient → total is "missing"
- The nutrition mapping: known OFF fixture → known numeric totals
- Non-macro absent from API → "missing"; macro absent → 0 (accepted policy)

All tests pass on Node without Docker or a live Supabase connection.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Macro absent from API | `0` (not `"missing"`) | Accepted policy; CLAUDE.md invariant applies to non-macros only | Research (confirmed) |
| Supabase for risks #3/#5 | Test pure functions only | Skip server-action tests; real Supabase integration deferred | Plan |
| MSW scope | Mock OFF only; omit OpenRouter key | AI selection is optional + has its own fallback; simpler and deterministic | Plan |
| OFF fixture source | Handcraft minimal JSON | Self-contained, version-controlled, no network dependency | Plan |
| CI gate | Defer to test-plan Phase 4 | Keep scope clean; gate added when it can pass | Plan |
| Aggregation extraction | Extract to `aggregateNutrients()` | Remove duplication and make the rule unit-testable as a pure function | Plan |

## Scope

**In scope:**
- Vitest + MSW bootstrap (config, setup file, npm script)
- Unit tests: `aggregateNutrients`, DB boundary adapters (all four functions)
- MSW integration tests: `fetchNutrients` with handcrafted OFF fixture
- Aggregation logic extracted to `src/lib/nutrition.ts` (small refactor)
- test-plan §3 status update + §6 cookbook

**Out of scope:**
- `saveRecipe` / `updateRecipe` server-action end-to-end tests (needs Supabase)
- OpenRouter AI selection testing
- UI rendering of "missing" as "—" (no e2e)
- CI gate wiring (test-plan Phase 4)

## Architecture / Approach

MSW intercepts HTTP at the network edge; `fetchNutrients` is called with real
function imports, no internal mocking. Pure functions (`aggregateNutrients`, DB
adapters) are tested with inline fixture objects, no framework needed. The
`vite-tsconfig-paths` plugin resolves `@/*` aliases; ESM packages from the AI
SDK are inlined via `server.deps.inline` to prevent import errors in Node.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Bootstrap | Green `npm test` with smoke test; Vitest + MSW wired | ESM/Node compat with `ai` package |
| 2. Aggregation | Extracted `aggregateNutrients()`; unit tests for the any-missing rule | Caller sites must be updated without breaking behaviour |
| 3. DB adapters | Unit tests for null ↔ "missing" round-trip | None — pure functions, zero deps |
| 4. fetchNutrients | MSW-driven tests covering mapping contract + invariant | OFF fixture must match real response shape exactly |
| 5. Cookbook sync | test-plan stamped complete; §6 filled in | None |

**Prerequisites:** Node + npm installed; `supabase` CLI not required for this plan.
**Estimated effort:** ~2 sessions across 5 phases.

## Open Risks & Assumptions

- The `ai` / `@openrouter/ai-sdk-provider` packages may require additional
  entries in `server.deps.inline` beyond those listed; adjust on first red run.
- Skipping server-action tests leaves risks #3/#5 partially unprotected at the
  DB write layer — accepted trade-off; revisit if data-loss incidents occur.

## Success Criteria (Summary)

- `npm test` exits 0, covering aggregation, DB adapters, and nutrition mapping
- A non-macro field absent from the OFF API response produces `"missing"` in
  the test output — never `0`
- The test suite runs in under 30 seconds without network access or Docker
