# Parse Pipeline Validation — Plan Brief

> Full plan: `context/changes/testing-parse-pipeline-validation/plan.md`

## What & Why

Tighten `ingredientSchema` so `quantity` must be positive and `name` must be non-empty, then add a runtime filter in `ParseFlow.handleConfirm` that silently drops invalid rows before any nutrition API call fires. Without these changes, a zero or negative quantity from the AI (or from a user editing the ingredient table) silently produces wrong nutritional totals — no error, no missing flag.

## Starting Point

`ingredientSchema` in `src/lib/schemas/ingredient.ts` uses bare `z.number()` and `z.string()` — type-correct but semantically open. `handleConfirm` in `ParseFlow.tsx` passes user-confirmed ingredient rows to the nutrition pipeline without checking `quantity > 0`. A quantity of `0` reaches `convertToGrams`, returns `0g`, and `fetchNutrients` falls back to unscaled per-100g values rather than a missing indicator.

## Desired End State

The Zod schema carries domain constraints (`quantity > 0`, `name.length >= 1`). Any row that violates those constraints — whether from the AI or from manual editing — is silently filtered out in `handleConfirm` before the normalize-units fetch. Unit and integration tests prove both layers with adversarial fixtures.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Where validation lives | Tighten the Zod schema | Catches bad AI output at the earliest point — schema parse time | Plan |
| unit constraint | No constraint added | Empty string is intentional per AI instruction ("no unit stated") | Plan |
| Invalid ingredient behavior | Drop silently | Matches the existing empty-name filter pattern; user sees valid ingredients proceed normally | Plan |
| Second guard location | `handleConfirm` before fetch | Schema guards AI output; this guard covers user-edited rows that bypass schema post-parse | Plan |

## Scope

**In scope:** `ingredientSchema` constraints; `handleConfirm` filter; unit test for schema; integration test for filter behavior.

**Out of scope:** Server-side validation in parse-recipe route; `unit` constraints; modifying `convertToGrams` or `fetchNutrients`; user-visible error for dropped ingredients.

## Architecture / Approach

Two sequential layers. Phase 1 tightens the schema (one file, one new test file). Phase 2 adds a pre-fetch filter in `ParseFlow.tsx` (one line change) and an integration test that spies on `fetch` to assert invalid rows never appear in the request body.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema constraints + unit tests | `ingredientSchema` rejects quantity≤0 and empty name; unit test proves it | Constraint on `quantity` could affect manual-entry flows that also use the `Ingredient` type |
| 2. Runtime filter guard + integration test | `handleConfirm` drops invalid rows before fetch; integration test proves the fetch body is clean | Testing `handleConfirm` in isolation requires mocking `fetch`; follow the parse-auth.test.ts pattern |

**Prerequisites:** Vitest configured (done in Phase 1 of the rollout).
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- `ingredientSchema` is also used as the AI SDK output schema via `parseResultSchema`; adding `.positive()` tells the model to return positive quantities but does not prevent a hallucinated 0 from the AI SDK — the Phase 2 filter is the real runtime guard.
- The `IngredientEditor` does not prevent a user from typing `0` into the quantity field; the filter in `handleConfirm` is the only enforcement point for user-edited values.

## Success Criteria (Summary)

- `npx vitest run` passes with no regressions after both phases.
- Zero-quantity ingredient after editing in `IngredientEditor`: no request fires to `/api/normalize-units` (verifiable in the browser network tab).
- Mixed valid/invalid rows: only valid rows appear in the fetch body.
