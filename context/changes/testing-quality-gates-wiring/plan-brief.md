# Quality Gates Wiring — Plan Brief

> Full plan: `context/changes/testing-quality-gates-wiring/plan.md`

## What & Why

Add a GitHub Actions CI workflow that runs lint, typecheck, and the Vitest integration suite as required checks on every PR and push to `main`. The floor set by test rollout Phases 1–3 exists but is advisory — this phase makes it mandatory.

## Starting Point

A `deploy.yml` workflow runs e2e tests and deploys on push to `main`. No PR check workflow exists. All three gate commands (`npm run lint`, `npm run typecheck`, `npm test`) work locally with no environment secrets.

## Desired End State

Every PR to `main` shows three parallel status checks (lint / typecheck / test). All must be green before the PR can be merged. The deploy job also gates on all three, so a direct push to `main` cannot deploy if any gate fails.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Trigger | PRs to main + push to main | Catches regressions on direct pushes too | Plan |
| Job structure | Three parallel jobs | Faster feedback; each failure clearly labelled | Plan |
| Branch protection | Workflow only (no GitHub settings) | User opted out of repo-level enforcement | Plan |
| Coverage upload | No | Fastest job; @vitest/coverage-v8 available later if needed | Plan |

## Scope

**In scope:** `.github/workflows/ci.yml` (new), `deploy.yml` `needs` update, §6.5 cookbook entry in test-plan.md.

**Out of scope:** Branch protection rules, coverage artifacts, e2e in the new workflow, caching beyond setup-node's built-in npm cache.

## Architecture / Approach

One new workflow file. Three jobs run in parallel on the same trigger. `deploy.yml`'s deploy job gains `lint`, `typecheck`, and `test` in its `needs` array alongside the existing `e2e`. No secrets or environment variables required for the CI jobs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Add ci.yml + gate deploy | Three parallel checks on PRs and main; deploy blocked if any fail | YAML valid locally but Actions schema validation is server-side — must open a test PR to confirm |
| 2. Update test-plan.md §6.5 | Local pre-push command sequence documented; freshness date updated | Low risk |

**Prerequisites:** Phases 1–3 of the test rollout must be complete (they are).  
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- GitHub Actions minutes are assumed available; no quota concern for a small project.
- `npm test` runtime is assumed fast enough (~30s) not to bottleneck PRs.

## Success Criteria (Summary)

- Three status checks appear on a real PR and all pass green.
- A deliberately broken test turns the `test` check red and the PR is visually blocked.
- The deploy job in `deploy.yml` no longer starts until lint, typecheck, and test all pass.
