---
id: ingredient-unit-handling
title: Ingredient Unit Normalization & Weight-Based Nutrition
status: implementing
updated: 2026-06-03
---

Add a unit normalization step between recipe parse and nutrition summary. Converts volume units (cups, tbsp, tsp) to grams via Spoonacular (with OpenRouter fallback), displays gram weight per ingredient, and scales USDA per-100g nutrient data by the resolved weight.
