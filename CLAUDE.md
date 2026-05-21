# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical invariant

Every nutrient field must be a numeric value or an explicit "missing" indicator. No silent zeros, no defaulting absent data to 0. This holds across all code paths: AI parsing, manual entry, edits, recalculations.

## Next.js 16 warning

Significant breaking changes from versions covered by most training data. Before writing any Next.js-specific code, check `node_modules/next/dist/docs/` for current API conventions. Heed deprecation notices.

## Project

**NutriCalc** — parses pasted recipe text via AI, extracts ingredients, fetches nutritional data, and displays a macro/micronutrient summary.

PRD and stack decisions: `context/foundation/` — read before adding features.

## Architecture

**Framework:** Next.js 16 App Router (`src/app/`). Server Components by default; Client Components only when browser APIs or interactivity require it. Use Server Actions for the AI parsing flow.

**Path alias:** `@/*` → `./src/*`

**Styling:** Tailwind CSS v4 — syntax differs significantly from v3. Use v4 docs, not v3 examples.

**Deployment:** Cloudflare Pages via `@cloudflare/next-on-pages`. Avoid Node.js-only APIs; use Web API equivalents throughout.

**Planned integrations (not yet implemented):**
- Supabase — OAuth (Google/GitHub) + PostgreSQL for recipe storage
- Claude API — parse unstructured recipe text into structured ingredient lists
- External nutrition API (source TBD — see `context/foundation/prd.md`)

## Commands

```bash
npm run dev      # Dev server (Next.js 16, Turbopack on by default)
npm run build    # Production build
npm run start    # Run production server
npm run lint     # ESLint (flat config — eslint.config.mjs)
```

No test runner configured yet. Add one before writing tests.

## ESLint config

Uses ESLint 9 flat config format (`eslint.config.mjs`). Do not create `.eslintrc.*` files — they are ignored in ESLint 9.

## Environment variables

Create `.env.local` with:

```
# AI parsing (key name TBD — check context/foundation/tech-stack.md when decided)
AI_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Nutrition API (source TBD — see context/foundation/prd.md open questions)
NUTRITION_API_KEY=

# Cloudflare deployment
CLOUDFLARE_ACCOUNT_ID=
```
