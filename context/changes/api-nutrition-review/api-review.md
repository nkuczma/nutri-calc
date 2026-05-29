---
change_id: api-nutrition-review
created: 2026-05-29
---

# Nutrition API Review — F-02

**Context:** NutriCalc receives AI-parsed ingredient names (e.g. `"chicken breast"`, `"all-purpose flour"`) — not barcodes — and must return nutrients or an explicit `"missing"` flag. Micronutrient coverage breadth is the core differentiator of the whole product.

---

## Candidates evaluated

### 1. USDA FoodData Central — Recommended

| Dimension | Detail |
|---|---|
| Cost | Free — API key via free signup at `fdc.nal.usda.gov` |
| Rate limit | 1,000 req/hr per IP |
| Lookup model | Text search → FDC ID → nutrient detail (2 calls per ingredient) |
| Nutrient coverage | Excellent — Foundation Foods / SR Legacy track vitamins, minerals, amino acids down to trace levels |
| Missing-flag fit | Clean: absent nutrient = null in response, never a silent zero |
| Caching | Allowed (CC0 license) |
| Attribution | None required |
| Cloudflare Workers fit | Full `fetch()` REST API — no Node.js dependencies |
| Weakness | US-centric; non-English ingredient names may not match well |

**Why it wins for NutriCalc:** whole foods (the kind home cooks paste in recipes) are exactly what Foundation Foods covers best. CC0 + caching-allowed means nutrient snapshots can be stored in Supabase on first lookup, keeping the `recipes` schema self-contained and reproducible (PRD NFR reproducibility). No vendor lock-in. Free signup at https://fdc.nal.usda.gov/api-key-signup.

---

### 2. Open Food Facts

| Dimension | Detail |
|---|---|
| Cost | Free — no API key |
| Rate limit | 15 req/min (search), 10 req/min (product lookup) |
| Lookup model | Barcode-first; text search targets packaged product names |
| Nutrient coverage | Highly variable — community-curated, many missing micronutrients |
| Missing-flag fit | Inconsistent: community gaps mean many fields absent unpredictably |
| Caching | Allowed (ODbL) |
| Cloudflare Workers fit | Full `fetch()` REST API |
| Weakness | Not designed for raw ingredient lookup by name; `"salmon"` or `"butter"` will surface branded products, not canonical whole-food entries |

**Verdict:** Good complementary source for packaged products; wrong primary source for a recipe parser needing `"2 tbsp olive oil"` → micronutrients.

---

### 3. Edamam Nutrition Analysis API

| Dimension | Detail |
|---|---|
| Cost | Paid — starts $29/mo (10-day trial); per-recipe licensing fee compounds monthly |
| Lookup model | NLP-in: send `"2 cups flour"` directly, get nutrition back in one call |
| Nutrient coverage | 28 nutrients (macro + micro) |
| Missing-flag fit | Moderate — NLP matching sometimes silently substitutes a near-match |
| **Caching** | **Prohibited in ToS** — live call required every time, including saved recipes |
| **Data retention** | **Must delete all cached data if subscription ends** — severe vendor lock-in |
| Attribution | "Powered by Edamam" badge required on all UIs |
| Automated requests | Prohibited in ToS |
| Cloudflare Workers fit | Full `fetch()` REST API |

**Verdict:** Caching prohibition is incompatible with NutriCalc's Supabase snapshot architecture (F-03) and the reproducibility NFR. If subscription ends, all saved recipe nutrition data must be deleted — destroying the saved-recipe feature. Eliminated.

---

### 4. NutrientAPI

| Dimension | Detail |
|---|---|
| Cost | Free tier + PAYG $0.05/recipe; Pro $149/mo |
| Nutrient coverage | **14 nutrients only** — missing Vitamin B12, Folate, Zinc, Phosphorus, etc. |
| Lookup model | NLP ingredient parsing, confidence scores per match |
| Caching | Allowed |
| Attribution | None |
| Cloudflare Workers fit | Full `fetch()` REST API |

**Verdict:** Eliminated on nutrient coverage — 14-nutrient ceiling is a dealbreaker for a product whose core premise is surfacing missing micronutrients.

---

## Decision

**USDA FoodData Central** resolves Open Roadmap Question #1.

- Zero cost, no attribution, full caching freedom
- Best whole-food micronutrient depth of the free options
- REST API fully compatible with Cloudflare Workers `fetch()`
- Absent nutrient in response = genuine missing flag, no silent zeros
- PRD scopes English-only for v1 — US-centric database fits the MVP

**Implementation note for F-02 plan:** two-step lookup per ingredient (search by name → get FDC ID → fetch nutrient details). Results should be cached as nutrient snapshots in Supabase on first lookup to satisfy the reproducibility NFR and avoid repeated API calls for the same ingredient.
