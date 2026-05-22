---
starter_id: next
package_manager: npm
project_name: nutri-calc
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

Next.js with TypeScript is the right fit for NutriCalc: a solo-built, 3-week MVP web app requiring OAuth auth, AI-driven recipe parsing, and persistent user data. The App Router provides server components for fast initial renders and server actions for the AI parsing flow, while Supabase + PostgreSQL covers auth and recipe storage without a separate backend service. Deploying to Cloudflare Pages via the `@cloudflare/next-on-pages` adapter keeps hosting costs low with global edge distribution. The stack passes all four agent-friendly quality gates — TypeScript throughout, strong App Router conventions, massive training-data presence, and authoritative docs — making AI assistance reliable across the full build surface.
