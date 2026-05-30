# paste-parse-summary — Plan Brief

> Full plan: `context/changes/paste-parse-summary/plan.md`
> Research: `context/changes/paste-parse-summary/research.md`

## What & Why

S-01, the north-star slice of NutriCalc: a user pastes raw recipe text, watches an AI-parsed editable ingredient list stream in, corrects it inline, and gets a full 16-nutrient summary with every missing value explicitly flagged. This closes the core loop that the auth and nutrition-data-source changes were prerequisites for.

## Starting Point

Auth middleware, Supabase SSR, and `fetchNutrients` (with its `number | "missing"` contract) are all working. No AI packages are installed, no `/parse` page exists, and no API routes for AI parsing or nutrition aggregation have been built.

## Desired End State

A signed-in user at `/parse` can paste a recipe, see ingredient rows stream in within ~1–2s, edit the list, and receive a 16-nutrient table in ~3–4s total — each field shown as a number with unit or an unambiguous greyed "—" that cannot be mistaken for zero.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Env var for Anthropic key | `AI_API_KEY` via `createAnthropic({ apiKey: ... })` | CLAUDE.md establishes `AI_API_KEY`; auto-read shorthand reads `ANTHROPIC_API_KEY` — different name | Research |
| AI SDK streaming pattern | `streamText + Output.object`, not `streamObject` | Known RegExp CPU spike bug in `streamObject` on Cloudflare Workers | Research |
| Model ID | `claude-haiku-4-5-20251001` (full versioned) | Short alias unverified with `@ai-sdk/anthropic` | Research |
| Quantity scaling | Pass `"${qty} ${unit} ${name}"` to `fetchNutrients` directly | USDA `/foods/search` handles natural-language queries; no unit-conversion math needed | Plan |
| Page layout | Single page, progressive reveal | Streaming UX fits naturally; no navigation adds complexity without benefit | Plan |
| Missing nutrient display | Greyed "—" badge | Satisfies CLAUDE.md invariant — users must never mistake absent data for zero | Plan |
| Empty parse result | Inline retry message; textarea stays populated | Non-destructive; user keeps their input | Plan |
| Nutrition failure mode | Block on any `fetchNutrients` failure — global error + retry | Simpler error state; consistent with missing-flag invariant (partial sums could mislead) | Plan |
| Empty ingredient confirm | Allow confirm; show friendly empty state | No server guard needed when client checks and routes to message | Plan |

## Scope

**In scope:**
- `/parse` page with 3-stage progressive reveal
- `POST /api/parse-recipe` — streaming AI parse with auth guard
- `POST /api/nutrition-summary` — parallel fetch + aggregation with auth guard
- Ingredient editor: add, edit, remove rows
- Nutritional summary table: 16 nutrients, missing-flag display
- Homepage link to `/parse`

**Out of scope:**
- Recipe persistence (Supabase save)
- Unit normalization / gram conversion (USDA handles via query string)
- Rate limiting on AI endpoint
- Streaming the nutrition fetch step

## Architecture / Approach

Three server/client interactions in sequence:

```
Textarea → POST /api/parse-recipe (streaming)
         → useObject streams partial Ingredient[] to client

Client edits rows locally (no server call)

Confirm button → POST /api/nutrition-summary (JSON)
               → Promise.all(fetchNutrients("qty unit name") per ingredient)
               → aggregated IngredientNutrients returned
               → NutritionalSummary renders
```

The `fetchNutrients` function signature (`ingredientName: string`) is unchanged — natural-language queries are passed through to USDA as-is.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Prerequisites | Packages installed, `AI_API_KEY` added | None — clean slate install |
| 2. Schema + AI parse route | Zod types + streaming endpoint with auth guard | `submit()` double-serialization bug (mitigated: documented in Critical Implementation Details) |
| 3. Nutrition summary route | Parallel fetch + missing-flag aggregation | `fetchNutrients` network timeout blocking `Promise.all` |
| 4. Parse page UI | Full 3-stage interactive page | useObject partial-state edge cases during stream |

**Prerequisites:** Auth and Supabase SSR working (done); `NUTRITION_API_KEY` in `.env.local` (confirmed present); `AI_API_KEY` added in Phase 1.  
**Estimated effort:** ~3–4 sessions across 4 phases; Phase 4 is the largest.

## Open Risks & Assumptions

- USDA natural-language queries ("1 tsp salt") return relevant food matches — assumed based on user confirmation; smoke-test with real queries during Phase 3 manual verification
- `claude-haiku-4-5-20251001` full ID accepted by `@ai-sdk/anthropic` — verify in Phase 2 manual test

## Success Criteria (Summary)

- User can paste a recipe and receive a nutritional summary end-to-end, all under 5s perceived time
- Every nutrient field in the summary is either a number or an explicit "—" — no silent zeros
- Unauthenticated API calls return 401 JSON (not HTML redirects)
