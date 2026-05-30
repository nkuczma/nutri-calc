---
change_id: recipes-schema-rls
roadmap_id: F-03
title: Design `recipes` + `recipe_ingredients` schema with RLS
status: implemented
created: 2026-05-30
updated: 2026-05-30
---

## Summary

Create `recipes` and `recipe_ingredients` tables in Supabase with CRUD RLS policies gating every row by `auth.uid()`. Schema encodes the missing-flag invariant at the column level (16 nullable NUMERIC nutrient columns; NULL = absent). Includes a TypeScript boundary adapter mapping null ↔ "missing" at the DB edge.

## PRD refs

FR-007, NFR data isolation, Critical Invariant (CLAUDE.md)

## Unlocks

S-03 (save-recipe), S-04 (list-saved-recipes), S-05 (edit-saved-recipe), S-06 (delete-saved-recipe)
