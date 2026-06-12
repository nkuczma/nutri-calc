---
change_id: testing-parse-pipeline-validation
title: Parse pipeline validation — prove malformed AI-parsed data is caught before nutrition lookup
status: implementing
created: 2026-06-12
updated: 2026-06-12
archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Parse pipeline validation".
Risks covered: #6 — Parse pipeline validation too weak (zero/negative/null ingredient data passes the AI parse step and reaches nutrition lookup unchecked, producing wrong totals silently).
Test types planned: unit + integration.
Risk response intent: An ingredient with zero quantity, negative quantity, empty unit, or null name must be rejected or sanitized before reaching the nutrition lookup; the pipeline must catch schema-conformant but semantically invalid AI-parsed output.
