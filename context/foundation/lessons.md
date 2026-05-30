# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## USDA FDC API: use 1000-series nutrient IDs; verify via smoke test

- **Context**: `src/lib/nutrition.ts` USDA FoodData Central client (`NUTRIENT_IDS` constant)
- **Problem**: api-docs.md (sourced from USDA documentation) listed 2000-series IDs for macros (energy=2000, protein=2057, fat=2058, carbs=2059, fiber=2067). These are wrong — real Foundation and SR Legacy foods use 1000-series IDs (energy=1008, protein=1003, fat=1004, carbs=1005, fiber=1079). Also, the food detail field is `foodNutrients` (not `nutrients`) with `nutrient.id` nested inside each entry.
- **Rule**: Always verify nutrient IDs against a real API response before shipping. The smoke-test `nutrientMap` output (id, name, amount) is the canonical reference. Foundation foods can be partial analyses — confirm key macros are present before trusting any single result.
- **Applies to**: implement, impl-review

## Always place style imports after TS/JS imports

- **Context**: Any component or module file that imports both TS/JS modules and stylesheets (CSS/SCSS)
- **Problem**: When styles are imported before TS/JS modules, CSS modules load in the wrong order, causing style overrides to fail and producing style specificity bugs.
- **Rule**: Always place stylesheet imports (CSS/SCSS/CSS Modules) after all TS/JS imports in a file. Never mix or hoist style imports above module imports.
- **Applies to**: implement, impl-review
