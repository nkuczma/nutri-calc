# Quality Gates Wiring Implementation Plan

## Overview

Add a `ci.yml` GitHub Actions workflow that runs lint, typecheck, and the Vitest integration suite as three parallel required checks on every PR to `main` and every push to `main`. All three must pass before the deploy workflow runs. This is the final phase of the test rollout: it makes the floor set by Phases 1–3 mandatory, not advisory.

## Current State Analysis

- `deploy.yml` exists with `push: branches: [main]` trigger. It runs e2e → deploy. There is no PR check workflow.
- `npm run lint` (`eslint`), `npm run typecheck` (`tsc --noEmit`), and `npm test` (`vitest run`) are all defined in `package.json` and work locally.
- Vitest tests use MSW for HTTP mocking (`src/__tests__/setup.ts`). No environment secrets are needed to run the unit/integration suite.
- `@vitest/coverage-v8` is in the stack but coverage upload is out of scope per user decision.
- Node version in use across the project: 24 (matches `deploy.yml`).

## Desired End State

Every PR to `main` shows three required status checks: `lint`, `typecheck`, and `test`. All three run in parallel. A red check on any one blocks the PR visually. Push to `main` triggers the same workflow, so a direct push also runs the gates (deploy can optionally depend on them).

### Key Discoveries

- `deploy.yml:4` — triggers on `push: branches: [main]` only; no `pull_request` trigger exists anywhere.
- `deploy.yml:8` — deploy job declares `needs: e2e`; we can add a similar `needs: [lint, typecheck, test]` guard to the deploy job in Phase 1.
- `package.json` scripts: `lint`, `typecheck`, `test` — all runnable with no env vars.
- Vitest config (`vitest.config.ts`) excludes `e2e/**` — unit/integration suite is self-contained.

## What We're NOT Doing

- Branch protection rules in GitHub settings — user opted out; gates are visible but not enforced at the repo level.
- Coverage artifact upload — out of scope.
- E2e in the new workflow — e2e already runs in `deploy.yml` before deploy.
- Caching `node_modules` beyond `npm ci` with `cache: "npm"` — the setup-node cache is sufficient.

## Implementation Approach

Add a single new workflow file `.github/workflows/ci.yml`. Three jobs run in parallel on the same trigger (`pull_request` targeting `main` + `push` to `main`). Then update `deploy.yml` so its deploy job also gates on these three checks passing, closing the loop. Finally, document the local pre-push command sequence in `context/foundation/test-plan.md` §6.5.

## Phase 1: Add ci.yml and gate deploy on it

### Overview

Create `.github/workflows/ci.yml` with three parallel jobs. Update `deploy.yml` so the deploy job waits for all three to pass on push to main.

### Changes Required

#### 1. New CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Three parallel jobs — `lint`, `typecheck`, `test` — triggered on `pull_request` (targeting `main`) and `push` to `main`. Each job: checkout → setup Node 24 with npm cache → `npm ci` → run its command.

**Contract**:

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:      # runs: npm run lint
  typecheck: # runs: npm run typecheck
  test:      # runs: npm test
```

Each job uses `actions/checkout@v4`, `actions/setup-node@v4` (node `24`, cache `npm`), then `npm ci`, then the relevant script. No env vars required.

#### 2. Gate deploy on CI jobs

**File**: `.github/workflows/deploy.yml`

**Intent**: Add `lint`, `typecheck`, and `test` to the deploy job's `needs` array so a direct push to `main` cannot deploy if any gate fails.

**Contract**: Change `needs: e2e` to `needs: [lint, typecheck, test, e2e]` on the `deploy` job. The `e2e` job has no `needs` and keeps running in parallel with the CI jobs; deploy waits for all four.

### Success Criteria

#### Automated Verification

- Workflow file is valid YAML and passes `actions/checkout` schema: `npx js-yaml .github/workflows/ci.yml`
- Lint job command matches script: `grep -q '"lint"' .github/workflows/ci.yml`
- Typecheck job command matches script: `grep -q '"typecheck"' .github/workflows/ci.yml`
- Test job command matches script: `grep -q '"test"' .github/workflows/ci.yml`
- Deploy job needs updated: `grep -q 'lint' .github/workflows/deploy.yml`

#### Manual Verification

- Open a test PR to `main`; confirm three status checks appear and pass.
- Break a test locally (`npm test` fails), push to branch; confirm the `test` check turns red on the PR.
- Confirm `deploy` job does not start until all four `needs` pass.

**Implementation Note**: After Phase 1, the workflow must be pushed to a branch and a PR opened to verify the checks actually appear. Local YAML validation is necessary but not sufficient — GitHub Actions schema validation happens server-side.

---

## Phase 2: Update test-plan.md §6.5 cookbook

### Overview

Document the local gate-check sequence in `context/foundation/test-plan.md` §6.5 so developers know exactly which commands to run before pushing.

### Changes Required

#### 1. §6.5 Per-rollout-phase notes

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `(Fills in as phases ship.)` placeholder in §6.5 with the local pre-push command sequence and a note about what CI enforces.

**Contract**: Add under `### 6.5 Per-rollout-phase notes`:

```
**Local pre-push gate sequence (mirrors CI):**
npm run lint && npm run typecheck && npm test

**What CI enforces (Phase 4):** `.github/workflows/ci.yml` runs the three
commands above as parallel required checks on every PR to `main` and every
push to `main`. The deploy job in `deploy.yml` also gates on all three passing.
```

Also update the header timestamp and §8 freshness date.

### Success Criteria

#### Automated Verification

- §6.5 placeholder replaced: `grep -q 'pre-push' context/foundation/test-plan.md`
- Freshness date updated: `grep -q '2026-06-12' context/foundation/test-plan.md`

#### Manual Verification

- Read §6.5 and confirm the three commands are correct for the current `package.json` scripts.

---

## Testing Strategy

### Automated

- YAML lint on the new workflow file.
- Grep assertions on key fields in both workflow files.

### Manual Testing Steps

1. Push the branch, open a PR to `main`.
2. Confirm three status checks appear: `lint`, `typecheck`, `test`.
3. Intentionally break a test; confirm the check turns red and PR is visually blocked.
4. Fix and re-push; confirm all three go green.
5. Confirm the `deploy` job in the existing workflow now lists `lint`, `typecheck`, `test`, `e2e` in its `needs`.

## References

- Test plan: `context/foundation/test-plan.md` §3 Phase 4
- Existing workflow: `.github/workflows/deploy.yml`
- Vitest config: `vitest.config.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Add ci.yml and gate deploy on it

#### Automated

- [x] 1.1 YAML is valid: `npx js-yaml .github/workflows/ci.yml`
- [x] 1.2 Lint job present: `grep -q '"lint"' .github/workflows/ci.yml`
- [x] 1.3 Typecheck job present: `grep -q '"typecheck"' .github/workflows/ci.yml`
- [x] 1.4 Test job present: `grep -q '"test"' .github/workflows/ci.yml`
- [x] 1.5 Deploy gates updated: `grep -q 'lint' .github/workflows/deploy.yml`

#### Manual

- [ ] 1.6 Three status checks appear on test PR and all pass
- [ ] 1.7 Broken test turns check red on PR
- [ ] 1.8 Deploy job does not start until all four needs pass

### Phase 2: Update test-plan.md §6.5 cookbook

#### Automated

- [ ] 2.1 §6.5 placeholder replaced: `grep -q 'pre-push' context/foundation/test-plan.md`
- [ ] 2.2 Freshness date updated: `grep -q '2026-06-12' context/foundation/test-plan.md`

#### Manual

- [ ] 2.3 §6.5 commands match current package.json scripts
