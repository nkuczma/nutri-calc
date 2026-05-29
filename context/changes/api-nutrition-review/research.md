---
date: 2026-05-29T12:00:00+02:00
researcher: nkuczma
git_commit: 2402f2a062c564868e0cac80de00bcd4be91107e
branch: main
repository: nutri-calc
topic: "Codebase compatibility check for api-nutrition-review — F-02 implementation readiness"
tags: [research, codebase, nutrition, f-02, usda, typescript, cloudflare-workers]
status: complete
last_updated: 2026-05-29
last_updated_by: nkuczma
---

# Research: Codebase Compatibility — api-nutrition-review (F-02)

**Date**: 2026-05-29  
**Researcher**: nkuczma  
**Git Commit**: [2402f2a](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/)  
**Branch**: main  
**Repository**: nutri-calc

## Research Question

Is the material in `context/changes/api-nutrition-review/` (USDA FoodData Central, two-step fetch flow, `value | "missing"` TypeScript contract) compatible with the existing codebase? What does the F-02 plan need to account for?

## Summary

**Verdict: Fully compatible. No blockers. Three minor adjustments to note.**

The USDA FoodData Central selection from `api-review.md`, the two-step lookup flow, and the `NutrientValue = number | "missing"` TypeScript contract map cleanly onto the existing codebase patterns. The Workers runtime already proves outbound `fetch()` calls work (Supabase OAuth flow). The `NUTRITION_API_KEY` env var is pre-documented in CLAUDE.md. TypeScript strict mode fully supports the proposed union type. The only adjustments the F-02 plan needs to make are about placement, env var prefix, and NEXT_PUBLIC_omission — all minor.

## Detailed Findings

### 1. Cloudflare Workers — fetch() compatibility

`wrangler.jsonc` is configured with:
- `compatibility_date: "2025-04-01"` — the minimum required for `process.env` to surface Cloudflare env variables
- `compatibility_flags: ["nodejs_compat"]` — Web API `fetch()` is globally available

The Workers runtime **already makes outbound HTTP calls** to Supabase's external API in every auth flow:
- [`src/middleware.ts:14-44`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/src/middleware.ts#L14) — `supabase.auth.getUser()` → external HTTP call on every request
- [`src/app/auth/callback/route.ts:12-13`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/src/app/auth/callback/route.ts#L12) — OAuth code exchange → external HTTP

Two sequential `fetch()` calls to `api.nal.usda.gov` are safe. CPU time for JSON deserialization is in microseconds; the 30ms CPU limit (Workers paid tier) is not a risk for I/O-bound fetch calls.

**No `export const runtime = 'edge'` directive is needed** in the nutrition client or its consumers — the Workers runtime is the default for this deployment via @opennextjs/cloudflare.

### 2. src/lib/ structure — where nutrition.ts lives

The existing lib directory uses a subdirectory pattern:

```
src/lib/
  supabase/
    client.ts   — browser client (sync createClient())
    server.ts   — server client (async createClient() with Next.js cookies())
```

**The nutrition client only needs a server-side variant** — all USDA calls are made from Server Actions or API route handlers, never from the browser (API key must stay server-side). A single file is appropriate:

```
src/lib/
  supabase/
    client.ts
    server.ts
  nutrition.ts    ← new file (server-side only, no subdirectory needed)
```

`api-docs.md`'s proposed path `src/lib/nutrition.ts` is correct.

### 3. Export pattern — follow supabase/server.ts

[`src/lib/supabase/server.ts:4`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/src/lib/supabase/server.ts#L4) exports a named async factory function:

```ts
export async function createClient() { ... }
```

The nutrition client should follow the same shape:

```ts
export function createNutritionClient() { ... }
```

Or, since the USDA client has no async initialization (just a configured fetch wrapper), it can be a plain exported object or set of exported functions. No default export.

### 4. TypeScript type contract

`tsconfig.json` has `"strict": true`, which includes `strictNullChecks`. This means:

- `type NutrientValue = number | "missing"` is fully type-safe — TypeScript will reject `undefined` or `null` assignments at compile time
- The `interface IngredientNutrients` with all `NutrientValue` fields is idiomatic for this codebase

Naming conventions confirmed from existing code:
- `type` keyword for discriminated unions: `type NutrientValue = ...` ✓
- `interface` for structural shapes: `interface IngredientNutrients { ... }` ✓
- PascalCase for both type aliases and interfaces ✓
- camelCase for exported functions ✓

No existing `| "missing"` patterns in the codebase — this is the first explicit missing-flag union type. It introduces the critical invariant from CLAUDE.md at the type level, which is correct.

### 5. Environment variable — NUTRITION_API_KEY

**`NUTRITION_API_KEY` is already pre-documented** in [`CLAUDE.md:62`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/CLAUDE.md#L62):

```
# Nutrition API (source TBD — see context/foundation/prd.md open questions)
NUTRITION_API_KEY=
```

**Important:** This is a server-side API key and must **NOT** use the `NEXT_PUBLIC_` prefix. Unlike `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to expose to the browser), `NUTRITION_API_KEY` should stay server-only. Accessed in code as:

```ts
process.env.NUTRITION_API_KEY!
```

For deployment: add to Cloudflare Workers dashboard as an encrypted secret and declare in `wrangler.jsonc` under `[vars]`.

`.env.local` does not yet contain `NUTRITION_API_KEY` — needs to be added with a real key from https://api.nal.usda.gov/api-key-signup.

### 6. Missing-flag contract alignment

The USDA API semantics map cleanly to the CLAUDE.md critical invariant:

> "Nutrients are **only present in the array if the value exists in the database**. An absent entry means genuinely missing data — never a zero."

The `resolveNutrient()` function from `api-docs.md` correctly enforces this:

```ts
function resolveNutrient(nutrients: ApiNutrient[], targetId: number): NutrientValue {
  const found = nutrients.find(n => n.id === targetId);
  return found ? found.amount : "missing";
}
```

No silent zero-fills anywhere in the chain. This is the right shape for the invariant.

## Code References

- [`src/lib/supabase/server.ts`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/src/lib/supabase/server.ts) — model for export pattern and factory function shape
- [`src/lib/supabase/client.ts`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/src/lib/supabase/client.ts) — named export convention
- [`src/middleware.ts`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/src/middleware.ts) — proof that Workers runtime supports external HTTP
- [`src/app/auth/callback/route.ts`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/src/app/auth/callback/route.ts) — App Router route handler pattern (no runtime directive needed)
- [`tsconfig.json`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/tsconfig.json) — strict: true, path alias @/* → ./src/*
- [`CLAUDE.md:62`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/CLAUDE.md#L62) — NUTRITION_API_KEY pre-documented
- [`wrangler.jsonc`](https://github.com/nkuczma/nutri-calc/blob/2402f2a062c564868e0cac80de00bcd4be91107e/wrangler.jsonc) — compatibility_date + nodejs_compat flag

## Architecture Insights

**Server-only constraint is clean.** The nutrition client never runs in the browser — all recipe parsing happens in Server Actions, and the nutrition lookup is a pure server-side operation. This means no `src/lib/nutrition/client.ts` variant is needed, simplifying the lib structure.

**Caching maps to Supabase.** The api-review.md recommendation to cache nutrient snapshots in Supabase on first lookup is architecturally correct — it satisfies the reproducibility NFR and avoids hammering the USDA rate limit (1,000 req/hr). This caching lives in F-03 (recipes schema), not in the F-02 client itself. The F-02 client contract is: fetch-from-USDA → return typed `IngredientNutrients`. F-03's schema and S-01's Server Action handle the snapshot persistence.

**Ingredient matching is name-based.** The AI parse (S-01) produces ingredient names like `"chicken breast"`, `"all-purpose flour"`. The USDA search endpoint accepts these as `query` strings and returns the closest Foundation/SR Legacy match. The `dataType=Foundation,SR Legacy` filter (from `api-docs.md`) skips Branded foods and is the right default for recipe ingredients.

## Historical Context

- `context/changes/api-nutrition-review/api-review.md` — API candidate comparison; USDA selected over Open Food Facts, Edamam, and NutrientAPI. Decision is sound and aligns with codebase architecture.
- `context/changes/api-nutrition-review/api-docs.md` — USDA FoodData Central API reference with two-step lookup flow and TypeScript client contract. All patterns verified as compatible.
- `context/changes/auth-supabase-oauth/` — F-01 implementation (done). Established the lib/supabase/ subdirectory pattern, factory function exports, and Workers-compatible async patterns that F-02 should mirror.

## Adjustments the F-02 Plan Must Make

1. **No `NEXT_PUBLIC_` prefix on `NUTRITION_API_KEY`** — `api-docs.md` correctly omits it, but the plan should explicitly document that this is a server-only variable. The supabase pattern for public keys (`NEXT_PUBLIC_`) does not apply here.

2. **Single-file lib structure** — `src/lib/nutrition.ts` (flat, not subdirectory) is correct since only one variant (server) is needed. Plan should state this explicitly so the implementer doesn't mirror the supabase two-file pattern unnecessarily.

3. **Env var setup step** — The implementer needs to obtain a free USDA API key from `https://api.nal.usda.gov/api-key-signup` and add it to `.env.local` as `NUTRITION_API_KEY=<key>`. This is a manual prerequisite not covered by the plan unless called out.

4. **No caching in F-02 itself** — The api-review.md recommends Supabase snapshot caching, but that belongs to F-03 schema design and S-01/S-02 Server Actions. F-02's client boundary stops at: fetch → return typed result. The plan should scope this clearly to avoid scope creep.

## Open Questions

None blocking F-02. The three adjustments above are plan-writing guidance, not unresolved decisions.

The roadmap open question #1 (which nutrition source?) is now resolved: **USDA FoodData Central**.
