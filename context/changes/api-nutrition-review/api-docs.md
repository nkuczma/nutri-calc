# USDA FoodData Central — API Reference for F-02

> Fetched via Context7 MCP on 2026-05-29. Source: https://usda-fdc.readthedocs.io/en/latest/

## Base URL and auth

```
Base URL:  https://api.nal.usda.gov/fdc/v1/
Auth:      ?api_key=<key>  OR  X-Api-Key header
Cost:      free, no credit card required
Register:  https://api.nal.usda.gov
Env var:   NUTRITION_API_KEY  (already in CLAUDE.md .env.local template)
```

## Two-step lookup flow (per ingredient)

```
1. GET /foods/search?query=<ingredient_name>&dataType=Foundation,SR Legacy&pageSize=1
   → pick fdcId from foods[0]

2. GET /food/{fdcId}
   → returns full nutrient array
```

Filter by `dataType=Foundation,SR Legacy` — skips Branded foods whose micronutrient coverage is inconsistent.

## Endpoints

### Search — `GET /foods/search`

| Parameter    | Type     | Required | Notes |
| ------------ | -------- | -------- | ----- |
| `query`      | string   | yes      | ingredient name |
| `dataType`   | string[] | no       | `Foundation`, `SR Legacy`, `Branded`, `Survey (FNDDS)` |
| `pageSize`   | int      | no       | 1–200, default 50 |
| `pageNumber` | int      | no       | default 1 |
| `sortBy`     | string   | no       | `lowercaseDescription`, `score`, `fdcId` |
| `sortOrder`  | string   | no       | `asc` or `desc` |

**Response shape:**

```json
{
  "totalHits": 500,
  "currentPage": 1,
  "totalPages": 50,
  "foods": [
    {
      "fdcId": 170074,
      "description": "Apple, raw, with skin",
      "dataType": "SR Legacy",
      "foodCategory": "Fruits and Fruit Products",
      "publicationDate": "2019-04-01"
    }
  ]
}
```

### Get food — `GET /food/{fdcId}`

Returns full detail including the nutrient array.

**Response shape:**

```json
{
  "fdcId": 170074,
  "description": "Apple, raw, with skin",
  "dataType": "SR Legacy",
  "foodCategory": "Fruits and Fruit Products",
  "servingSize": 100.0,
  "servingSizeUnit": "g",
  "nutrients": [
    {
      "id": 2000,
      "name": "Energy",
      "amount": 52.0,
      "unitName": "kcal",
      "nutrientnbr": 208,
      "rank": 300
    },
    {
      "id": 2057,
      "name": "Protein",
      "amount": 0.3,
      "unitName": "g",
      "nutrientnbr": 203,
      "rank": 700
    }
  ],
  "foodPortions": [
    {
      "id": 1000000,
      "amount": 1,
      "gramWeight": 182,
      "portionDescription": "medium, raw (2-1/4\" dia)"
    }
  ]
}
```

### Batch fetch — `GET /foods?fdcIds=id1,id2,...`

Returns an array of full Food objects. Use to resolve multiple ingredients in one round-trip.

## Missing-data contract (critical invariant)

Nutrients are **only present in the array if the value exists in the database**. An absent entry means genuinely missing data — never a zero.

This maps directly to CLAUDE.md's critical invariant. The typed client must:
- For each expected nutrient ID, check presence in `food.nutrients`
- Return the `amount` if found, `"missing"` if absent
- Never default to `0` for an absent nutrient

## Data types — coverage trade-offs

| Data type       | Coverage                              | Use for |
| --------------- | ------------------------------------- | ------- |
| `Foundation`    | Whole foods, comprehensive micros     | Best first choice for raw ingredients |
| `SR Legacy`     | Scientific reference, good coverage   | Fallback for foods not in Foundation |
| `Survey (FNDDS)` | Mixed-preparation foods               | Prepared dishes |
| `Branded`       | Processed/packaged, inconsistent micros | Avoid for micronutrient accuracy |

Recommended search filter: `dataType=Foundation,SR Legacy`

## TypeScript client contract (F-02 target)

```ts
type NutrientValue = number | "missing";

interface IngredientNutrients {
  // macros
  energy:  NutrientValue;  // kcal  — nutrient id 2000
  protein: NutrientValue;  // g     — nutrient id 2057 / nbr 203
  fat:     NutrientValue;  // g     — nutrient id 2058 / nbr 204
  carbs:   NutrientValue;  // g     — nutrient id 2059 / nbr 205
  fiber:   NutrientValue;  // g     — nutrient id 2067 / nbr 291
  // extend with micronutrients as needed
}

// resolution: check presence in nutrients[], not value === 0
function resolveNutrient(
  nutrients: ApiNutrient[],
  targetId: number
): NutrientValue {
  const found = nutrients.find(n => n.id === targetId);
  return found ? found.amount : "missing";
}
```

## Rate limits

Free tier is permissive for MVP scale (hundreds of requests/day). No published hard cap in the docs — monitor for `429` responses and add retry-with-backoff at the client boundary.

## Next steps

- Run `/10x-new nutrition-data-source` to create the change folder
- Run `/10x-plan nutrition-data-source` — plan should cover:
  - `src/lib/nutrition.ts` typed client
  - Two-step search+fetch flow
  - `value | "missing"` enforcement at the API boundary
  - Smoke test against a real ingredient (e.g. "chicken breast")
