---
change_id: testing-quality-gates-wiring
title: Wire lint, typecheck, and integration suite as required CI gates on PRs
status: implementing
created: 2026-06-12
updated: 2026-06-12
archived_at: null
---

## Notes

Open a change folder for rollout Phase 4 of context/foundation/test-plan.md: "Quality gates wiring".
Risks covered: cross-cutting (all risks — this phase locks the floor). Test types planned: CI config.
Risk response intent: Prove that lint, typecheck, and the integration test suite (unit + integration + security) run automatically on every PR and block merge on failure. The floor set by Phases 1–3 must be enforced, not advisory.
