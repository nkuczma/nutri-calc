---
change_id: nutrition-data-source
roadmap_id: F-02
title: Nutrition data source client (USDA FoodData Central)
status: implementing
created: 2026-05-29
updated: 2026-05-29
plan: 2026-05-29
---

## Summary

Implement `src/lib/nutrition.ts` — the F-02 USDA FoodData Central client. Takes an ingredient name, runs the two-step search→detail fetch, and returns a fully-typed `IngredientNutrients` object (5 macros + 11 micros) where every field is `number | "missing"`. Verified via a temporary smoke-test route, then cleaned up.

## PRD refs

FR-005, FR-006, Open Q #1 (resolved: USDA FoodData Central), NFR reproducibility, Critical Invariant (CLAUDE.md)

## Unlocks

S-01 (paste-parse-summary), S-02 (manual-recipe-entry); transitively S-03–S-06 since saved recipes carry nutrition snapshots.
