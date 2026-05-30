# paste-parse-summary Implementation Plan

## Overview

S-01 end-to-end feature: user pastes raw recipe text, AI streams back a parsed ingredient list, user edits it inline, then confirms to receive a 16-nutrient summary with every field shown as either a number or an explicit "missing" indicator.

## Current State Analysis

Auth middleware, Supabase SSR, and `fetchNutrients` are all in place. The four AI packages are missing. No parse page, no AI parse route, and no nutrition summary route exist yet. The env var name established in `CLAUDE.md` (`AI_API_KEY`) conflicts with `@ai-sdk/anthropic`'s auto-read default (`ANTHROPIC_API_KEY`) — must be handled explicitly.

## Desired End State

A user at `/parse` (auth-gated by middleware) can:
1. Paste recipe text and watch ingredients stream in line by line
2. Edit, remove, or add ingredient rows inline
3. Click "Get nutritional summary" and see a 16-nutrient table — each field either a formatted value or a greyed "—" that unambiguously signals missing USDA data

Under 5s perceived response time: streaming parse delivers first ingredient within ~1–2s; parallel `fetchNutrients` calls keep nutrition fetch to ~1–2s regardless of ingredient count.

### Key Discoveries

- `src/lib/nutrition.ts:80–82` — `fetchNutrients(ingredientName: string)` accepts any plain string; pass `"${quantity} ${unit} ${name}"` directly (e.g. `"1 tsp salt"`) — USDA `/foods/search` handles natural-language queries, no post-processing scaling needed
- `src/lib/nutrition.ts:1` — `NutrientValue = number | "missing"`; `IngredientNutrients` has 16 fields — this is also the correct shape for the aggregated summary
- `src/middleware.ts:48–51` — protects all routes except `/`, `/sign-in`, `/auth/*`; middleware returns HTML redirect (not JSON), so API routes need explicit `createClient` + 401 guards
- `wrangler.jsonc` — `nodejs_compat` ✅, `compatibility_date: "2025-04-01"` ✅; no changes needed
- `tsconfig.json:21–23` — `"@/*": ["./src/*"]` confirmed; all `@/lib/...` imports are valid

## What We're NOT Doing

- Recipe persistence (Supabase save) — out of scope for S-01
- Unit normalization / gram conversion — USDA handles it via natural-language query strings
- Rate limiting on the AI endpoint — future concern
- Streaming the nutrition fetch step — JSON response is fast enough given `Promise.all`

## Implementation Approach

Three server/client interactions with clear ownership:

```
1. POST /api/parse-recipe  (streaming)
   Client → server; server streams partial IngredientList via useObject

2. Local editing
   Client-only; no server call

3. POST /api/nutrition-summary  (JSON)
   Client sends confirmed Ingredient[]; server calls fetchNutrients in parallel;
   returns aggregated IngredientNutrients; any failure → 502 + retry
```

## Critical Implementation Details

**`submit()` must not pre-serialize**: `useObject` calls `JSON.stringify` internally. Passing `submit(JSON.stringify({ recipeText: text }))` double-serializes — pass the object directly: `submit({ recipeText: text })`.

**Env var name**: Both API routes must use `createAnthropic({ apiKey: process.env.AI_API_KEY })`. Do NOT use the bare `anthropic` import shorthand — it reads `ANTHROPIC_API_KEY`, which is not set.

**`streamText + Output.object`, not `streamObject`**: `streamObject` has a known RegExp CPU spike on Cloudflare Workers (vercel/ai#6492). The impl-docs already use the correct pattern; do not deviate.

**Model ID**: Use the full versioned ID `claude-haiku-4-5-20251001`. The short alias `claude-haiku-4-5` is unverified.

**Style imports after TS/JS imports**: Any new component file importing both modules and Tailwind classes must place CSS/style imports last (from `context/foundation/lessons.md`).

---

## Phase 1: Prerequisites

### Overview

Install the four AI packages and add the missing API key to `.env.local`. No source files change.

### Changes Required

#### 1. Package install

**File**: `package.json` (via npm install)

**Intent**: Add all four AI SDK packages. Pin `zod@^4` explicitly — the schema file uses v4 API.

**Contract**: `npm install ai @ai-sdk/anthropic @ai-sdk/react zod@^4`

#### 2. AI_API_KEY env var

**File**: `.env.local`

**Intent**: Add the Anthropic key under the name established in `CLAUDE.md`. Do not add `ANTHROPIC_API_KEY` — that creates a second source of truth for the same secret.

**Contract**: Append `AI_API_KEY=sk-ant-...` to `.env.local`.

### Success Criteria

#### Automated Verification

- Install completes without errors: `npm install ai @ai-sdk/anthropic @ai-sdk/react zod@^4`
- Dev server starts without fatal error: `npm run dev`
- Lint passes: `npm run lint`

#### Manual Verification

- Dev server is reachable at localhost:3000
- No TypeScript errors in IDE for `import { z } from 'zod'` or `import { createAnthropic } from '@ai-sdk/anthropic'`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 2.

---

## Phase 2: Zod Schema and AI Parse Route

### Overview

Define the `Ingredient` schema shared by client and server, then build the streaming parse endpoint with auth guard and the correct Vercel AI SDK pattern.

### Changes Required

#### 1. Ingredient schema

**File**: `src/lib/schemas/ingredient.ts`

**Intent**: Single source of truth for the ingredient shape. Both the API route and the client component import from here — no duplication.

**Contract**:
- `ingredientSchema`: `{ name: string, quantity: number, unit: string }` with `.describe()` hints for the AI model
- `parseResultSchema`: `{ ingredients: z.array(ingredientSchema) }`
- Exports: `Ingredient` and `ParseResult` (inferred types via `z.infer`)
- Import: `import { z } from 'zod'`

#### 2. AI parse API route

**File**: `src/app/api/parse-recipe/route.ts`

**Intent**: POST endpoint that guards with 401 for unauthenticated callers (middleware returns HTML redirect — not usable by client components), then streams a structured ingredient list.

**Contract**:
```typescript
// Auth guard — must come before any AI logic
const supabase = await createClient();   // from '@/lib/supabase/server'
const { data: { user } } = await supabase.auth.getUser();
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

// Provider — reads AI_API_KEY, NOT ANTHROPIC_API_KEY
const anthropic = createAnthropic({ apiKey: process.env.AI_API_KEY });

// Streaming pattern — use streamText + Output.object, NOT streamObject
const result = streamText({
  model: anthropic('claude-haiku-4-5-20251001'),
  output: Output.object({ schema: parseResultSchema }),
  system: `...`,
  prompt: recipeText,
});
return result.toTextStreamResponse();
```
`export const maxDuration = 30`.

System prompt must instruct: extract only explicitly stated ingredients; never invent quantities (default to 1 if missing); unit as `""` if not stated.

### Success Criteria

#### Automated Verification

- `npm run build` passes (TypeScript + route compilation)
- `npm run lint` passes

#### Manual Verification

- `curl -X POST http://localhost:3000/api/parse-recipe -H "Content-Type: application/json" -d '{"recipeText":"test"}'` without auth cookie returns JSON `{ "error": "Unauthorized" }` with HTTP 401
- Signed-in user: POST with `{ "recipeText": "2 cups flour, 1 tsp salt, 3 eggs" }` returns an event stream; partial ingredient objects arrive and the stream closes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 3.

---

## Phase 3: Nutrition Summary Route

### Overview

POST endpoint that accepts the confirmed ingredient list, runs `fetchNutrients` for each ingredient in parallel using the natural-language query string, and returns the aggregated 16-nutrient summary. Any individual failure blocks the response.

### Changes Required

#### 1. Nutrition summary API route

**File**: `src/app/api/nutrition-summary/route.ts`

**Intent**: Aggregate nutrition data for the confirmed ingredient list. Applies the missing-flag invariant in the server layer — not the display layer.

**Contract**:

Request body: `{ ingredients: Ingredient[] }`

Auth guard: same `createClient` + 401 pattern as Phase 2.

Empty list: if `ingredients.length === 0`, return `Response.json({ nutrients: null })` — client renders the friendly empty state.

Query construction per ingredient:
```typescript
const query = (i: Ingredient) =>
  i.unit ? `${i.quantity} ${i.unit} ${i.name}` : `${i.quantity} ${i.name}`;
```

Parallel fetch:
```typescript
const results = await Promise.all(
  ingredients.map(i => fetchNutrients(query(i)))
);
```
If `Promise.all` rejects (any `NutritionApiError`), catch and return `Response.json({ error: err.message }, { status: 502 })`.

Aggregation — missing-flag invariant: for each of the 16 `IngredientNutrients` keys, if any result has `"missing"` for that key the total is `"missing"`; otherwise sum the numeric values.

Return: `Response.json({ nutrients: aggregated })` where `aggregated` has type `IngredientNutrients`.

### Success Criteria

#### Automated Verification

- `npm run build` passes
- `npm run lint` passes

#### Manual Verification

- Signed-in: POST `{ "ingredients": [{ "name": "sugar", "quantity": 1, "unit": "tsp" }] }` returns a JSON object with all 16 fields, each a number or `"missing"`
- POST with `{ "ingredients": [] }` returns `{ "nutrients": null }` (no 4xx/5xx)
- POST without auth cookie returns 401 JSON

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to Phase 4.

---

## Phase 4: Parse Page UI

### Overview

The full three-stage interactive page at `/parse`. Single page, progressive reveal: each stage appears below the previous as it completes. Five files: page wrapper, flow orchestrator, ingredient editor, nutritional summary display, and a homepage navigation link.

### Changes Required

#### 1. Parse page wrapper

**File**: `src/app/parse/page.tsx`

**Intent**: Minimal Server Component. The middleware handles auth redirect for unauthenticated users — no server-side auth check needed here.

**Contract**: Renders `<ParseFlow />` (a Client Component in the same directory).

#### 2. ParseFlow client component

**File**: `src/app/parse/ParseFlow.tsx`

**Intent**: Orchestrates all three stages via local state. Owns the transitions between stages and the nutrition fetch call.

**Contract**:
- `'use client'`
- Uses `useObject({ api: '/api/parse-recipe', schema: parseResultSchema })` from `@ai-sdk/react`
- `submit` call: `submit({ recipeText: text })` — NOT `submit(JSON.stringify(...))`
- Stage 1 always visible: textarea + "Parse recipe" button (disabled while `isLoading`)
- Empty parse detection: after `!isLoading && object`, if `object.ingredients?.length === 0` show inline "No ingredients found — try rephrasing" below textarea; textarea stays populated
- Stream error: if `error` from `useObject` is set, freeze any partial `object?.ingredients` list and show an inline error message beneath it; textarea stays populated
- Stage 2 (`IngredientEditor`) appears when `!isLoading && (object?.ingredients?.length ?? 0) > 0`
- Nutrition fetch: `onConfirm` handler POSTs confirmed rows to `/api/nutrition-summary`; sets a loading flag; on failure shows error message + "Try again" button that re-enables the confirm button; on `{ nutrients: null }` sets an empty-state flag
- Stage 3 (`NutritionalSummary` or empty state or error+retry) appears after confirm is clicked

#### 3. IngredientEditor component

**File**: `src/app/parse/IngredientEditor.tsx`

**Intent**: Editable table with full CRUD. Syncs from AI-parsed list via `useEffect`. Filters blank-name rows before calling `onConfirm`.

**Contract**:
- Props: `parsed: Ingredient[]`, `onConfirm: (rows: Ingredient[]) => void`
- Local state: `rows: Ingredient[]`
- `useEffect(() => setRows(parsed), [parsed])`
- `update(i, field, value)`: replaces that field in row `i`
- `remove(i)`: removes row `i`
- `add()`: appends `{ name: '', quantity: 1, unit: '' }`
- Confirm click: filters rows where `name.trim() !== ''`, then calls `onConfirm(filtered)` — passing the filtered list (possibly empty) so `ParseFlow` handles empty-state logic

#### 4. NutritionalSummary component

**File**: `src/app/parse/NutritionalSummary.tsx`

**Intent**: Display the 16-nutrient result. Every field must show either a formatted value or an unambiguous "missing" indicator — never silently omit or zero-fill.

**Contract**:
- Props: `nutrients: IngredientNutrients | null`
- If `nutrients` is `null`: render "No ingredients to summarize."
- For each of the 16 fields: if the value is `"missing"`, render a greyed "—" (e.g. Tailwind `text-muted` or `text-gray-400`); otherwise render the numeric value with its unit (kcal, g, mg, µg as defined in `nutrition.ts` comments)
- Import `IngredientNutrients` from `@/lib/nutrition`

#### 5. Homepage navigation link

**File**: `src/app/page.tsx`

**Intent**: Make the feature reachable from the homepage without requiring users to know the URL.

**Contract**: Add `<Link href="/parse">Parse a recipe</Link>` using `next/link`. Existing layout (email, sign-in/out) stays unchanged.

### Success Criteria

#### Automated Verification

- `npm run build` passes (full production build including all new files)
- `npm run lint` passes

#### Manual Verification

- Sign in, click "Parse a recipe" from homepage, land on `/parse`
- Paste "2 cups flour, 1 tsp salt, 3 eggs" → click "Parse recipe" → ingredient rows stream in progressively
- Edit a row (change quantity), remove a row, add a blank row and fill it in
- Click "Get nutritional summary" → spinner appears → table renders with numeric values and any "—" for missing nutrients
- Delete all rows, click "Get nutritional summary" → "No ingredients to summarize" message
- Submit empty textarea → "No ingredients found — try rephrasing" appears; textarea remains populated; re-typing and re-parsing produces results
- Unauthenticated: direct `curl` to `/api/parse-recipe` returns 401 JSON (not HTML redirect)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Manual Testing Steps

1. Happy path: paste a 5+ ingredient recipe, parse, confirm without editing, verify all 16 nutrients shown
2. Correction path: parse, edit names/quantities, remove one row, confirm — verify summary reflects edits
3. Add row: after parsing, add a custom ingredient and confirm — appears in summary
4. Empty confirm: delete all rows, confirm — "No ingredients to summarize" shown, no server call with 0 items
5. Empty parse: submit empty or gibberish text — "No ingredients found" message, textarea unchanged
6. Re-parse: after empty-parse message, update text and re-parse — new results replace error state
7. Auth guard: sign out, visit `/parse` — middleware redirects to sign-in; `curl` to API routes returns 401 JSON

### Performance Notes

- Streaming parse: first ingredient row should appear within ~1–2s
- `Promise.all` for nutrition: N ingredients = same wall-clock latency as 1 call
- Under-5s perceived time: ~2s parse stream + ~1–2s nutrition fetch ≈ 3–4s total

## References

- Related research: `context/changes/paste-parse-summary/research.md`
- impl-docs (library patterns): `context/changes/llm-review/impl-docs.md`
- `src/lib/nutrition.ts` — `fetchNutrients` interface and `IngredientNutrients` type
- `src/lib/supabase/server.ts` — `createClient()` pattern for auth guard
- `context/foundation/lessons.md` — missing-flag invariant, style import order

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Prerequisites

#### Automated

- [ ] 1.1 Install completes without errors: `npm install ai @ai-sdk/anthropic @ai-sdk/react zod@^4`
- [ ] 1.2 Dev server starts without fatal error: `npm run dev`
- [ ] 1.3 Lint passes: `npm run lint`

#### Manual

- [ ] 1.4 Dev server reachable at localhost:3000
- [ ] 1.5 No TypeScript errors in IDE for new AI SDK imports

### Phase 2: Zod Schema and AI Parse Route

#### Automated

- [ ] 2.1 `npm run build` passes
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 Unauthenticated POST to `/api/parse-recipe` returns 401 JSON
- [ ] 2.4 Signed-in POST with recipe text returns event stream; partial ingredients arrive and stream closes

### Phase 3: Nutrition Summary Route

#### Automated

- [ ] 3.1 `npm run build` passes
- [ ] 3.2 `npm run lint` passes

#### Manual

- [ ] 3.3 POST with one ingredient returns JSON with all 16 fields (number or "missing")
- [ ] 3.4 POST with empty ingredients array returns `{ "nutrients": null }` (no error)
- [ ] 3.5 POST without auth returns 401 JSON

### Phase 4: Parse Page UI

#### Automated

- [ ] 4.1 `npm run build` passes (full production build including all new files)
- [ ] 4.2 `npm run lint` passes

#### Manual

- [ ] 4.3 Homepage "Parse a recipe" link navigates to `/parse`
- [ ] 4.4 Streaming parse: ingredient rows appear progressively
- [ ] 4.5 Editor: edit, remove, and add rows all work
- [ ] 4.6 Nutritional summary renders with values and "—" for missing
- [ ] 4.7 Empty confirm → "No ingredients to summarize" message
- [ ] 4.8 Empty parse → inline retry message; textarea preserved
- [ ] 4.9 Unauthenticated API call returns 401 JSON (not redirect)
