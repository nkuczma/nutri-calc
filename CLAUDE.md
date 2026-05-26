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

**Deployment:** Cloudflare Workers via `@opennextjs/cloudflare`. Avoid Node.js-only APIs; use Web API equivalents throughout.

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

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 2, Lesson 2

Turn one roadmap item into the first implementation cycle with the **change planning chain**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review`, and `/10x-implement` are the lesson focus. `/10x-frame` and `/10x-research` are not required rituals here; they are escalation paths introduced in the next lesson.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Change setup (lesson focus)** | |
| `/10x-new <change-id>` | You selected a roadmap item and need a stable change folder. Creates `context/changes/<change-id>/change.md` so planning, implementation, progress, commits, and later review all share one identity. Use AFTER roadmap selection, BEFORE `/10x-plan`. |
| **Planning (lesson focus)** | |
| `/10x-plan <change-id>` | You have a change folder and need a reviewable implementation plan. Reads roadmap context, foundation docs, codebase evidence, and any existing change notes; writes `plan.md` and `plan-brief.md` with phases, file contracts, success criteria, and `## Progress`. |
| **Plan readiness (lesson focus)** | |
| `/10x-plan-review <change-id>` | You have `plan.md` and need a light pre-code readiness check. Use it to catch missing end state, weak contracts, malformed progress, scope drift, or blind spots before code changes begin. |
| **Implementation (lesson focus)** | |
| `/10x-implement <change-id> phase <n>` | You have an approved plan and want to execute one phase with verification, manual gate, commit ritual, and SHA write-back to `## Progress`. |
| **Lifecycle closure** | |
| `/10x-archive <change-id>` | A change is merged or intentionally closed. Move it out of active `context/changes/` into archive state. |

### How the chain hands off

- `/10x-new` creates the durable change identity.
- `/10x-plan` turns that identity into an implementation contract.
- `/10x-plan-review` checks the plan before the agent mutates code.
- `/10x-implement` executes one planned phase, verifies, asks for manual confirmation when needed, commits, and records progress.

### Lesson boundaries

- Plan is the default router after roadmap selection. Start with `/10x-plan` unless the problem is unclear or external evidence is blocking.
- Do not run `/10x-frame + /10x-research` as ceremony for every change.
- Do not turn this lesson into a full end-to-end product build. A checkpoint with a planned and partially or fully implemented stream is valid.
- Code review of the implemented diff belongs to Lesson 3 via `/10x-impl-review`.
- Lifecycle closure via `/10x-archive` after a change is merged or intentionally closed.

### Paths used by this lesson

- `context/foundation/roadmap.md` - upstream roadmap
- `context/changes/<change-id>/change.md` - change identity
- `context/changes/<change-id>/plan.md` - implementation contract
- `context/changes/<change-id>/plan-brief.md` - compressed handoff
- `context/foundation/lessons.md` - recurring rules and pitfalls
- `docs/reference/contract-surfaces.md` - load-bearing names registry

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
