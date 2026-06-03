# API Research: Ingredient Unit Conversion (cups, teaspoons → grams)

## Problem

Converting volume units (cup, tsp, tbsp) to grams is **ingredient-dependent** — 1 cup of flour ≠ 1 cup of sugar. A pure volume→weight conversion without knowing the ingredient's density is not possible. An API must be ingredient-aware.

---

## Option 1 — Spoonacular: `Convert Amounts`

**Endpoint:** `GET /recipes/convert`

```
GET api.spoonacular.com/recipes/convert
  ?ingredientName=flour
  &sourceAmount=2
  &sourceUnit=cups
  &targetUnit=grams
```

- Returns weight in grams **per ingredient** — has density data built in
- Supports: cups, tsp, tbsp, oz, ml, grams, and many others
- `GET /recipes/{id}/ingredientWidget.json` also returns both unit systems (US + metric) for every ingredient in a recipe
- **Pricing:** Free plan — **9,000 req/month, 150 req/day, no credit card required**. Paid from $29/month.
- **Docs:** https://spoonacular.com/food-api/docs

---

## Option 2 — Edamam: Nutrition Analysis API

**Endpoint:** `POST /api/nutrition-details` or `GET /api/nutrition-data`

```
GET https://api.edamam.com/api/nutrition-data
  ?app_id=YOUR_APP_ID
  &app_key=YOUR_APP_KEY
  &ingr=1+cup+flour
```

- Accepts free-text ingredient lines — NLP parses "1 cup flour" and returns `weight` in grams
- Each parsed ingredient includes a `weight: float` field (total weight in grams)
- Supports: cup, tablespoon, teaspoon, pinch, drop, liter, ml, oz, pint, quart, gallon + ingredient-specific units (e.g. "slice", "whole apple")
- **Single request returns both weight AND full nutrition data**
- **Pricing: NO genuinely free tier.** Nutrition Analysis API starts at **$29/month** (10-day free trial, credit card required). A "Minimum Service" downgrade plan exists but is heavily limited and intended for account downgrades only. Free tier also **prohibits commercial use** per ToS.
- **Docs:** https://developer.edamam.com/edamam-docs-nutrition-api

### Supported measure URIs (Edamam standard measures)

| Name        | URI                                                               |
|-------------|-------------------------------------------------------------------|
| Cup         | `http://www.edamam.com/ontologies/edamam.owl#Measure_cup`         |
| Tablespoon  | `http://www.edamam.com/ontologies/edamam.owl#Measure_tablespoon`  |
| Teaspoon    | `http://www.edamam.com/ontologies/edamam.owl#Measure_teaspoon`    |
| Gram        | `http://www.edamam.com/ontologies/edamam.owl#Measure_gram`        |
| Ounce       | `http://www.edamam.com/ontologies/edamam.owl#Measure_ounce`       |
| Milliliter  | `http://www.edamam.com/ontologies/edamam.owl#Measure_milliliter`  |
| Pinch       | `http://www.edamam.com/ontologies/edamam.owl#Measure_pinch`       |
| Drop        | `http://www.edamam.com/ontologies/edamam.owl#Measure_drop`        |

---

## Option 3 — API Ninjas: Nutrition API

**Endpoint:** `GET /v1/nutritionitem`

```
GET https://api.api-ninjas.com/v1/nutritionitem
  ?query=1 cup flour
```

- `query` parameter accepts quantity + unit + food name in free text
- Supports: "1 cup", "2 lbs", "100g", "2 tbsp" and other common units
- Returns scaled nutrition data per the specified quantity
- **Pricing:** Free tier available (no credit card required for basic access)
- **Docs:** https://api-ninjas.com/api/nutrition

---

## Option 4 — NutrientAPI

**Endpoint:** `POST /v1/analyze`

```json
{
  "ingredients": ["1 cup brown rice", "2 tbsp olive oil"],
  "servings": 2
}
```

- AI-powered NLP parses quantities, units, and ingredient names automatically
- Returns nutrition data per ingredient with match and conversion confidence scores
- **Pricing: 25 recipes/month free, no credit card required.** Then $0.05/recipe pay-as-you-go or $149/month Pro.
- **Docs:** https://nutrientapi.com/

---

## Option 5 — OpenRouter (LLM-based conversion)

NutriCalc already uses OpenRouter for AI parsing (see `context/foundation/`). The same integration can handle unit conversion without adding a new external dependency.

**Approach:** send a structured prompt to any Claude model via OpenRouter asking for the gram equivalent of a volume quantity for a specific ingredient.

```
POST https://openrouter.ai/api/v1/chat/completions

{
  "model": "anthropic/claude-haiku-4-5",
  "messages": [
    {
      "role": "user",
      "content": "How many grams is 1 cup of sugar? Reply with only a JSON object: {\"grams\": <number>}"
    }
  ]
}
```

- No extra API key or account — reuses the existing `OPENROUTER_API_KEY`
- Works for any ingredient and any common cooking unit (cup, tbsp, tsp, handful, pinch, etc.)
- Can handle ambiguous units (e.g. "a heaped tablespoon") that rule-based APIs reject
- **Accuracy caveat:** LLMs return reasonable approximations, not lab-measured densities. Suitable for home-cooking nutrition estimates; not for clinical or regulatory use.
- **Pricing:** pay-per-token via OpenRouter. Claude Haiku is the cheapest option (~$0.001 per conversion call at typical prompt sizes). No free tier, but costs are negligible at low volume.
- **Latency:** adds an LLM round-trip (~0.5–2s). Can be parallelised per ingredient.
- **No new dependency** — fits directly into the existing OpenRouter server action.

### When to prefer this over a dedicated API

| Scenario | Prefer |
|---|---|
| Standard units (cup, tbsp, tsp, oz) for common ingredients | Spoonacular or API Ninjas |
| Unusual units ("handful", "pinch", "a knob of butter") | OpenRouter |
| Ingredient not found in nutrition DB | OpenRouter |
| Already at OpenRouter quota/cost limit | Spoonacular free tier |

---

## Option 6 — LogMeal API

- Every unit (cup, tsp, slice…) has a `grams_conversion` field — a multiplier to get grams
- `GET /dataset/weightMeasures/ingredients` returns all applicable units for an ingredient, each with a `grams_conversion` value
- Primarily designed for food photo recognition (image-based food logging); unit conversion is a secondary capability
- **Docs:** https://docs.logmeal.com/docs/guides-use-cases-units-and-preferred-measurements

---

## Option 7 — Whisk API

- `GET /recipe/v2/{id}?fields=RECIPE_FIELD_NORMALIZED_INGREDIENTS`
- Returns `alternative_measurements` array per ingredient, e.g. `0.5 cup` ↔ `120g`
- Focused on full recipe management; API access requires B2B registration
- **Docs:** https://docs.whisk.com/api/unit-conversion

---

## Comparison

| Criterion                        | Spoonacular                  | Edamam                        | API Ninjas          | NutrientAPI             | OpenRouter (LLM)              |
|----------------------------------|------------------------------|-------------------------------|---------------------|-------------------------|-------------------------------|
| Free tier                        | 9k req/month, no CC required | **No** (paid from $29/mo)     | yes, no CC required | 25 recipes/month, no CC | no (pay-per-token)            |
| Commercial use on free tier      | yes                          | **prohibited**                | yes                 | yes                     | n/a                           |
| New dependency needed            | yes                          | yes                           | yes                 | yes                     | **no** (already in stack)     |
| Free-text / unusual units        | limited                      | full NLP                      | yes                 | yes (AI-powered)        | **yes** (any unit, any food)  |
| cup → grams conversion           | dedicated endpoint            | inline in nutrition-data      | inline              | inline                  | prompt-based                  |
| Returns nutrients in same call   | no (separate endpoint)       | yes                           | yes                 | yes                     | no (conversion only)          |
| Accuracy                         | high (measured data)         | high (measured data)          | high                | high                    | approximate                   |

---

## Recommendation

**Spoonacular** is the best fit for NutriCalc at the development/MVP stage:

- Genuinely free (9,000 req/month, 150/day), no credit card, commercial use allowed
- Dedicated `Convert Amounts` endpoint handles cup/tsp/tbsp → grams per ingredient
- Nutrition data available in the same API ecosystem (separate endpoints)

**NutrientAPI** is worth considering as a fallback or upgrade path — its pay-per-recipe model ($0.05/recipe) is cost-predictable and the 25 free recipes/month are enough for prototyping.

**OpenRouter** is a strong option for handling edge cases (unusual units, obscure ingredients) since it requires no new dependency or API key. The recommended hybrid strategy:
1. Use Spoonacular's `Convert Amounts` for standard units (cup, tbsp, tsp, oz) — high accuracy, generous free tier
2. Fall back to OpenRouter (Claude Haiku) when Spoonacular returns no result — handles "handful of spinach", "a knob of butter", etc.

**Edamam should be dropped from consideration** for now: no real free tier, credit card required, and commercial use prohibited on the minimal free plan.
