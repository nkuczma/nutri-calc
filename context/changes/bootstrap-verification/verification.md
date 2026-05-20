---
bootstrapped_at: 2026-05-20T00:00:00Z
starter_id: next
starter_name: "Next.js"
project_name: nutri-calc
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: next
package_manager: npm
project_name: nutri-calc
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
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
```

**Why this stack**: Next.js with TypeScript is the right fit for NutriCalc: a solo-built, 3-week MVP web app requiring OAuth auth, AI-driven recipe parsing, and persistent user data. The App Router provides server components for fast initial renders and server actions for the AI parsing flow, while Supabase + PostgreSQL covers auth and recipe storage without a separate backend service. Deploying to Cloudflare Pages via the `@cloudflare/next-on-pages` adapter keeps hosting costs low with global edge distribution. The stack passes all four agent-friendly quality gates — TypeScript throughout, strong App Router conventions, massive training-data presence, and authoritative docs — making AI assistance reliable across the full build surface.

## Pre-scaffold verification

| Signal      | Value                                          | Severity | Notes                                          |
| ----------- | ---------------------------------------------- | -------- | ---------------------------------------------- |
| npm package | create-next-app v16.2.6 published 2026-05-20   | fresh    | resolved from cmd_template                     |
| GitHub repo | not run                                        | —        | docs_url (https://nextjs.org/docs) is not a GitHub URL |

## Scaffold log

**Resolved invocation**: `npx create-next-app@latest bootstrap-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`

> Note: `create-next-app` rejects names starting with `.`, so the temp directory was named `bootstrap-scaffold` instead of `.bootstrap-scaffold`. The subdir-then-move mechanic was otherwise unchanged.

**Strategy**: subdir-then-move (scaffold into temp directory, then move files up)
**Exit code**: 0
**Files moved**: 14 (`.git`, `.next`, `node_modules`, `public`, `src`, `AGENTS.md`, `eslint.config.mjs`, `next-env.d.ts`, `next.config.ts`, `package-lock.json`, `package.json`, `postcss.config.mjs`, `README.md`, `tsconfig.json`)
**Conflicts (.scaffold siblings)**: `CLAUDE.md` → `CLAUDE.md.scaffold`
**.gitignore handling**: append-merged — cwd's 3 existing lines kept; 28 scaffold lines appended under `# from next` separator
**bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 0 HIGH, 2 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/1/0 direct of total 0/0/2/0 (next is a directly-installed package affected through a transitive dep; postcss is the transitively-vulnerable package)

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

**postcss** (transitive — `node_modules/next/node_modules/postcss`)
- Advisory: GHSA-qx2v-qp2m-jg93
- Title: PostCSS has XSS via Unescaped `</style>` in its CSS Stringify Output
- Affected range: `< 8.5.10`
- CVSS: 6.1 (AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N)
- Fix: update `next` to a version that vendors postcss ≥ 8.5.10. The `fixAvailable` field names `next@9.3.3` (major version change — breaking). Practical action: monitor for a next patch that resolves the vendored postcss version without a major bump.

**next** (direct — `node_modules/next`)
- Severity: moderate (propagated from postcss advisory above)
- Affected range: `9.3.4-canary.0 – 16.3.0-canary.5`
- This entry reflects that next is the direct dependency exposed to the postcss advisory via its vendored copy.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                                                          |
| ----------------------- | -------------------------------------------------------------- |
| bootstrapper_confidence | verified                                                       |
| quality_override        | false                                                          |
| path_taken              | custom                                                         |
| self_check_answers      | typed: true, from_official_starter: true, conventions: true, docs_current: true, can_judge_agent: true |
| team_size               | solo                                                           |
| deployment_target       | cloudflare-pages                                               |
| ci_provider             | github-actions                                                 |
| ci_default_flow         | auto-deploy-on-merge                                           |
| has_auth                | true                                                           |
| has_payments            | false                                                          |
| has_realtime            | false                                                          |
| has_ai                  | true                                                           |
| has_background_jobs     | false                                                          |

These hints were carried verbatim from the hand-off. A future M1L4 skill ("Memory Architecture") will consume them to generate CLAUDE.md, AGENTS.md, and CI workflow files tailored to this project's feature flags and deployment target.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- Review `CLAUDE.md.scaffold` — it contains `@AGENTS.md` (the scaffold's CLAUDE.md) alongside your existing CLAUDE.md. Decide whether to merge any content.
- Review `AGENTS.md` — the scaffold shipped an AGENTS.md warning note about Next.js API changes. Read it.
- Address the 2 MODERATE postcss/next audit findings per your project's risk tolerance — monitor for a next version that resolves the vendored postcss without a major-version change.
- The project has a `.git/` initialized by `create-next-app`. Review the initial commit or start fresh with `git init` if preferred.
