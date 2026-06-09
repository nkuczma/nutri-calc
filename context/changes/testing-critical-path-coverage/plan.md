# Critical-Path Integration Coverage — Implementation Plan

## Overview

Bootstrap Vitest + MSW and write the tests that protect the four highest-risk
code paths: the missing-flag invariant (Risk #1), the nutrition lookup contract
(Risk #2), the DB boundary adapters that guard save/retrieve (Risk #3), and the
aggregation logic that must stay consistent across edit+recompute (Risk #5).

## Current State Analysis

- No test runner exists. `package.json` has no `test` script and no Vitest/MSW
  in devDependencies.
- `NutrientValue = number | "missing"` is the core type; all nine nutrient
  fields carry this union.
- The aggregation rule (`any "missing" → total "missing"`) is **inlined and
  duplicated** in two places:
  - `src/app/api/nutrition-summary/route.ts:42–51`
  - `src/app/actions/recipes.ts:93–104`
  Neither is exported as a pure function, making the rule untestable without
  mocking Supabase auth. This plan extracts it.
- `fetchNutrients` calls Open Food Facts over HTTP and — when
  `OPENROUTER_API_KEY` is set — calls OpenRouter for AI product selection. Key
  absence skips the AI step and falls back to the first product.
- `src/lib/db/recipes.ts` exposes four pure boundary-adapter functions
  (`ingredientRowToNutrients`, `nutrientsToIngredientColumns`,
  `recipeRowToTotals`, `totalsToRecipeColumns`) that are directly unit-testable.
- Server actions (`saveRecipe`, `updateRecipe`) call Supabase RPCs — not tested
  in this plan; their business logic is tested through extracted pure functions.

## Desired End State

Running `npm test` exercises:
1. The missing-flag invariant across the full pipeline (extraction →
   aggregation → DB boundary).
2. The nutrition mapping contract: a known OFF fixture produces known numeric
   totals.
3. The DB null ↔ "missing" round-trip is lossless for all nine fields.
4. The aggregation rule is a named, exported function tested in isolation.

All tests pass in CI on Node without Docker or a live Supabase instance.

### Key Discoveries

- `src/lib/nutrition.ts:60–62` — `num()` is the extraction guard; it is not
  exported. Tests reach it indirectly through `fetchNutrients` with MSW.
- `src/lib/nutrition.ts:180–183` — `scaledMacro` converts `"missing"` → `0`
  for macros; this is **accepted policy** (confirmed). Tests must assert `0`,
  not `"missing"`, for absent macro fields.
- `src/lib/nutrition.ts:83–93` — `EMPTY_NUTRIENTS` returns `0` for macros when
  the API finds no products. Also accepted policy.
- `src/app/api/nutrition-summary/route.ts:42–51` and
  `src/app/actions/recipes.ts:93–104` — identical aggregation logic; Phase 2
  extracts it.
- No `server-only` imports in the files under test; no special Next.js RSC
  wiring needed in the Vitest config for this plan's test scope.

## What We're NOT Doing

- Testing `saveRecipe` or `updateRecipe` server actions end-to-end (requires
  Supabase; deferred).
- Testing the OpenRouter AI selection step (mocked by omitting the key).
- Testing UI rendering of `"missing"` as `—` (no e2e in scope for Phase 1).
- Wiring a CI gate on PRs (deferred to test-plan Phase 4).
- Testing `src/app/api/nutrition-summary/route.ts` as an HTTP handler (Supabase
  auth mock complexity; aggregation is covered by the extracted function).

## Implementation Approach

**Phase 1** installs Vitest + MSW and produces a passing smoke test — proving
the runner is wired before any real tests are written.

**Phase 2** extracts the inlined aggregation logic to `aggregateNutrients()` in
`src/lib/nutrition.ts`, updates the two call sites, and writes unit tests for
the function. This is the cheapest path to covering the core of Risks #1 and
#5.

**Phase 3** unit-tests the four DB boundary adapter functions in
`src/lib/db/recipes.ts`. These are pure functions with no imports beyond types;
zero setup required.

**Phase 4** adds a handcrafted OFF fixture and uses MSW to drive `fetchNutrients`
through its full HTTP → extraction → scaling pipeline, covering Risks #1
(non-macro absent → `"missing"`) and #2 (known values → correct numerics).

**Phase 5** stamps the test-plan rollout row and fills the §6 cookbook so future
test authors know the patterns used here.

## Critical Implementation Details

**`ai` package and ESM in Vitest:** `src/lib/nutrition.ts` imports from `ai`
and `@openrouter/ai-sdk-provider`, both of which ship ESM. Add
`server.deps.inline: ['ai', '@openrouter/ai-sdk-provider', '@ai-sdk/provider']`
(or equivalent) to `vitest.config.ts` to prevent "Cannot use import statement"
errors in a Node test environment. Verify the list against the actual error
messages from the first smoke test run.

**MSW for Node:** Use `msw/node` (`setupServer`) not `msw/browser`
(`setupWorker`). Register handlers in a `src/__tests__/setup.ts` file that
Vitest loads via `setupFiles`. Call `server.resetHandlers()` in `afterEach` so
test-specific overrides don't leak between tests.

**Path aliases:** Add `vite-tsconfig-paths` to devDependencies and include it
as a plugin in `vitest.config.ts`. This resolves `@/*` imports without
duplicating the mapping.

---

## Phase 1: Bootstrap Test Runner

### Overview

Install Vitest and MSW, write a `vitest.config.ts` that handles the project's
path aliases and ESM dependencies, add a `test` script, and verify with a
trivial smoke test. The goal is a green `npm test` before any real tests exist.

### Changes Required

#### 1. Install devDependencies

**File**: `package.json` (via shell — `npm install --save-dev`)

**Intent**: Add Vitest, the coverage provider, MSW, and the tsconfig-paths
Vite plugin as devDependencies.

**Contract**: Packages to install:
`vitest @vitest/coverage-v8 msw vite-tsconfig-paths`

#### 2. Vitest configuration

**File**: `vitest.config.ts` (new file at project root)

**Intent**: Configure Vitest to run in the Node environment, resolve `@/*`
path aliases from `tsconfig.json`, inline ESM packages from the AI SDK, and
load the global MSW setup file before each test suite.

**Contract**:
```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    server: {
      deps: {
        inline: ['ai', '@openrouter/ai-sdk-provider', '@ai-sdk/provider-utils'],
      },
    },
  },
})
```

Adjust the `inline` list if additional ESM errors surface on first run.

#### 3. MSW global setup

**File**: `src/__tests__/setup.ts` (new file)

**Intent**: Create the MSW Node server, start it before all tests, reset
handlers between tests, and close it after all tests. Tests that need specific
handlers add them inline with `server.use(...)`.

**Contract**: Export `server` from this file so individual test files can
add per-test handlers via `server.use(handler)`. Use
`{ onUnhandledRequest: 'error' }` so a missing handler fails loudly rather
than silently passing through to the real network.

#### 4. npm test script

**File**: `package.json`

**Intent**: Add `"test": "vitest run"` so `npm test` runs all tests once
(CI-compatible). Optionally add `"test:watch": "vitest"` for local dev.

**Contract**: `"test": "vitest run"` in `"scripts"`.

#### 5. Smoke test

**File**: `src/__tests__/smoke.test.ts` (new file)

**Intent**: A trivial assertion that Vitest is wired correctly. Deleted or
replaced once real tests exist in later phases — or kept as a canary.

**Contract**: `expect(1 + 1).toBe(2)` or equivalent. No imports beyond
`vitest`.

### Success Criteria

#### Automated Verification

- `npm test` exits 0 and reports at least 1 passing test
- `npm run typecheck` still passes (no type errors from new files)
- `npm run lint` still passes

#### Manual Verification

- Running `npm test` locally produces a Vitest summary with a green result in
  under 10 seconds on a cold start

---

## Phase 2: Extract and Test `aggregateNutrients`

### Overview

Extract the identical aggregation loop from `nutrition-summary/route.ts` and
`actions/recipes.ts` into an exported `aggregateNutrients()` function in
`src/lib/nutrition.ts`. Update both call sites. Write unit tests that cover the
aggregation rule from the oracle: "if any ingredient contributes `'missing'` for
a nutrient, the total is `'missing'`; otherwise sum the numeric values."

### Changes Required

#### 1. Extract `aggregateNutrients` to `src/lib/nutrition.ts`

**File**: `src/lib/nutrition.ts`

**Intent**: Add an exported pure function that accepts an array of
`IngredientNutrients` and returns the aggregated totals. This removes the
duplication and makes the rule testable without any HTTP or Supabase mocking.

**Contract**: Signature:
```ts
export function aggregateNutrients(
  results: IngredientNutrients[],
): IngredientNutrients
```
Same logic as the existing inline loop: iterate all keys, return `"missing"`
if any value is `"missing"`, otherwise sum. Throw or return a sensible default
if `results` is empty — decide based on the existing callers (both guard
`ingredients.length === 0` before calling, so an empty array is a programmer
error; throw is fine).

#### 2. Update `nutrition-summary/route.ts`

**File**: `src/app/api/nutrition-summary/route.ts`

**Intent**: Replace the inline aggregation block (lines 42–51) with a call to
`aggregateNutrients(results)`.

**Contract**: The response shape (`{ nutrients: aggregated, perIngredient: results }`) is unchanged.

#### 3. Update `actions/recipes.ts`

**File**: `src/app/actions/recipes.ts`

**Intent**: Replace the inline aggregation block (lines 93–104) with a call to
`aggregateNutrients(perIngredient)`.

**Contract**: The rest of `updateRecipe` is unchanged.

#### 4. Unit tests for `aggregateNutrients`

**File**: `src/__tests__/lib/nutrition-aggregate.test.ts` (new file)

**Intent**: Cover the aggregation oracle with four cases: all-numeric sums
correctly; one `"missing"` in any field makes that field's total `"missing"`;
all `"missing"` stays `"missing"`; single-item array passes through unchanged.

**Contract**: Import `aggregateNutrients` from `@/lib/nutrition`. Construct
`IngredientNutrients` objects inline as fixtures. Do **not** derive expected
values from the implementation — calculate them by hand from the oracle rule
and hard-code them.

### Success Criteria

#### Automated Verification

- `npm test` passes with the new aggregate tests contributing to the suite
- `npm run typecheck` passes (both updated call sites type-check correctly)
- `npm run lint` passes

#### Manual Verification

- The `/api/nutrition-summary` endpoint and recipe save/update flows behave
  identically to before the refactor (no functional change — the extracted
  function is identical logic)

---

## Phase 3: Unit Tests — DB Boundary Adapters

### Overview

Write unit tests for the four pure functions in `src/lib/db/recipes.ts` that
convert between `null` (DB) and `"missing"` (application). These tests directly
protect the DB round-trip contract for Risks #1 and #3.

### Changes Required

#### 1. DB boundary adapter tests

**File**: `src/__tests__/lib/db-recipes.test.ts` (new file)

**Intent**: Assert that each adapter function preserves `null ↔ "missing"`
losslessly for all nine nutrient fields, and that numeric values pass through
unchanged. Cover both directions: read path (null → "missing") and write path
("missing" → null).

**Contract**: Import all four functions from `@/lib/db/recipes`. The test must
construct realistic row objects — use the `Database["public"]["Tables"]` types
as the shape. Key cases per function:

- `ingredientRowToNutrients`: row with all nine fields null → all nine
  `"missing"`; row with mixed values → correct mapping; row with all numeric
  values → all numbers preserved.
- `nutrientsToIngredientColumns`: inverse of the above; `"missing"` → null;
  numbers pass through.
- `recipeRowToTotals` / `totalsToRecipeColumns`: same pattern against the
  `total_*` column names.

Do **not** import from `@supabase/supabase-js` or start a client. These
functions take plain objects.

### Success Criteria

#### Automated Verification

- `npm test` passes with new DB adapter tests green
- Each of the four functions is exercised by at least one test per boundary direction

---

## Phase 4: MSW Fixture + `fetchNutrients` Tests

### Overview

Write a minimal handcrafted OFF response fixture and use MSW to intercept the
HTTP call inside `fetchNutrients`. Tests cover: correct numeric values are
returned for known inputs (Risk #2); a non-macro field absent from the fixture
produces `"missing"` in the output (Risk #1); an absent macro field produces
`0` (accepted policy); zero products returns `EMPTY_NUTRIENTS` shape.

### Changes Required

#### 1. OFF response fixture

**File**: `src/__tests__/fixtures/off-chicken-breast.json` (new file)

**Intent**: A handcrafted JSON object shaped exactly like an Open Food Facts
`/search` response, containing one product with known, round-number nutrient
values for all nine fields except one non-macro (omit `sugars_100g` to drive
the "missing" assertion).

**Contract**: Shape must match `OFFSearchResponse` in `src/lib/nutrition.ts`
(fields: `hits` array of `OFFProduct` with `code`, `product_name`, `brands`,
`nutriments`). Use round numbers (e.g. `energy-kcal_100g: 165`,
`proteins_100g: 31`, `fat_100g: 3.6`, etc.) so expected values after scaling
are easy to compute by hand. Omit `sugars_100g` to trigger the non-macro
missing path. `OPENROUTER_API_KEY` is absent in tests, so only the first
product in `hits` is used — include exactly one product.

#### 2. `fetchNutrients` tests

**File**: `src/__tests__/lib/nutrition-fetch.test.ts` (new file)

**Intent**: Drive `fetchNutrients` through the full extraction + scaling
pipeline using the handcrafted fixture, without hitting the real OFF API.

**Contract**: In `beforeEach`, register an MSW handler that returns the fixture
for any request to `https://search.openfoodfacts.org/search*`. Test cases:

- **Risk #2 — correct numeric totals**: call `fetchNutrients('chicken breast', 100)` (100 g so scale = 1). Assert each numeric field equals the fixture value. Derive expected values by hand from the fixture — do not read the implementation to compute them.
- **Risk #1 — non-macro absent → `"missing"`**: the fixture omits `sugars_100g`; assert `result.sugars === "missing"`.
- **Accepted policy — macro absent → `0`**: add a variant fixture (or a per-test handler override) that omits `energy-kcal_100g`; assert `result.energy === 0`.
- **Zero products → EMPTY_NUTRIENTS shape**: return `{ hits: [] }` from the handler; assert `result.saturatedFat === "missing"` and `result.energy === 0`.

### Success Criteria

#### Automated Verification

- `npm test` passes with all four `fetchNutrients` test cases green
- No real HTTP requests escape to the OFF API (MSW `onUnhandledRequest: 'error'` catches any escape)
- `npm run typecheck` passes
- `npm run lint` passes

---

## Phase 5: Sync Test-Plan and Cookbook

### Overview

Stamp the test-plan rollout record and fill in the cookbook patterns so future
authors know how to add tests in this project.

### Changes Required

#### 1. Update test-plan §3 rollout status

**File**: `context/foundation/test-plan.md`

**Intent**: Advance Phase 1 row status from `change opened` to `complete` and
record the change folder reference.

**Contract**: Change the status cell in the Phase 1 row of the §3 table. No
other rows change.

#### 2. Fill §6 cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `TBD` stubs in §6.1 (adding a unit test) and §6.2
(adding an integration test) with the patterns established in this change.

**Contract**:

- §6.1 — unit test pattern: pure function import → construct fixture inline →
  assert against hand-computed expected value. Reference
  `src/__tests__/lib/db-recipes.test.ts` and
  `src/__tests__/lib/nutrition-aggregate.test.ts` as examples.
- §6.2 — MSW integration pattern: import `server` from `setup.ts` → register
  a per-test handler with `server.use(...)` → call the function under test →
  assert. Reference `src/__tests__/lib/nutrition-fetch.test.ts` as example.

### Success Criteria

#### Automated Verification

- `npm run lint` passes (markdown lint if configured; otherwise skip)

#### Manual Verification

- §3 Phase 1 row reads `complete` in `test-plan.md`
- §6.1 and §6.2 contain concrete patterns, not `TBD`

---

## Testing Strategy

### Unit Tests

- `aggregateNutrients` — all-numeric sum, any-missing propagation, single-item
  passthrough
- `ingredientRowToNutrients` — null→missing, number passthrough
- `nutrientsToIngredientColumns` — missing→null, number passthrough
- `recipeRowToTotals` / `totalsToRecipeColumns` — same pattern for recipe-level
  columns
- Edge case: all nine fields null (→ all "missing") and all nine fields numeric

### Integration Tests (MSW layer)

- `fetchNutrients` with full OFF fixture: correct scaled numerics
- `fetchNutrients` with omitted non-macro field: `"missing"` in output
- `fetchNutrients` with omitted macro field: `0` in output (policy)
- `fetchNutrients` with empty `hits`: EMPTY_NUTRIENTS shape

## References

- Research: `context/changes/testing-critical-path-coverage/research.md`
- Test plan: `context/foundation/test-plan.md`
- Aggregation logic (pre-extract): `src/app/api/nutrition-summary/route.ts:42–51`
- Aggregation logic (pre-extract): `src/app/actions/recipes.ts:93–104`
- DB adapters: `src/lib/db/recipes.ts:20–82`
- Nutrition mapping: `src/lib/nutrition.ts:60–81`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Bootstrap Test Runner

#### Automated

- [x] 1.1 `npm test` exits 0 with at least 1 passing test — 55f41dd
- [x] 1.2 `npm run typecheck` passes after adding new files — 55f41dd
- [x] 1.3 `npm run lint` passes after adding new files — 55f41dd

#### Manual

- [x] 1.4 `npm test` completes in under 10 seconds locally on a cold start — 55f41dd

### Phase 2: Extract and Test `aggregateNutrients`

#### Automated

- [x] 2.1 `npm test` passes with aggregate unit tests green — 620b041
- [x] 2.2 `npm run typecheck` passes for both updated call sites — 620b041
- [x] 2.3 `npm run lint` passes — 620b041

#### Manual

- [x] 2.4 `/api/nutrition-summary` and recipe update flows behave identically to before the refactor — 620b041

### Phase 3: Unit Tests — DB Boundary Adapters

#### Automated

- [x] 3.1 `npm test` passes with DB adapter tests green — b085598
- [x] 3.2 All four adapter functions covered in both boundary directions — b085598

### Phase 4: MSW Fixture + `fetchNutrients` Tests

#### Automated

- [x] 4.1 `npm test` passes with all four `fetchNutrients` cases green — d167cf0
- [x] 4.2 No real HTTP escapes MSW (`onUnhandledRequest: 'error'`) — d167cf0
- [x] 4.3 `npm run typecheck` passes — d167cf0
- [x] 4.4 `npm run lint` passes — d167cf0

### Phase 5: Sync Test-Plan and Cookbook

#### Automated

- [x] 5.1 `npm run lint` passes — 33c9ea1

#### Manual

- [x] 5.2 §3 Phase 1 row reads `complete` in `test-plan.md` — 33c9ea1
- [x] 5.3 §6.1 and §6.2 contain concrete patterns (not `TBD`) — 33c9ea1
