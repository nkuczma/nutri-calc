# Test Plan

> Phased test rollout for NutriCalc. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-09 (Phase 1 complete)

---

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic diff that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase signal (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the ground
   truth.

Hot-spot scope used for likelihood weighting: `src/app/`, `src/lib/` (last 30 days, 39 commits).

---

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. The Source column cites the evidence that
surfaced this risk — never a specific file as "where the failure lives"
(that is research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Missing-flag invariant broken — after a nutrition logic change, a nutrient that should show "missing" is silently displayed as 0 | High | High | CLAUDE.md critical invariant; PRD FR-006; user interview Q2+Q3; hot-spot dir `src/lib/` (nutrition.ts 6 commits/30d), `src/app/api/` (nutrition-summary 4 commits/30d) |
| 2 | Nutrition lookup regression — a change to the nutrition client returns wrong numeric totals that look valid (no error, no missing flag) | High | High | User interview Q2 (API swap burned them); user interview Q3 (changes feel unpredictable); hot-spot dir `src/lib/` (nutrition.ts 6 commits/30d) |
| 3 | Recipe data loss — save action silently fails or partially writes; user's recipe is gone on next visit | High | Medium | PRD NFR "no recipe data loss"; user interview Q1; hot-spot dir `src/app/actions/` (6 commits/30d), `src/lib/db/` (3 commits/30d) |
| 4 | Data isolation regression — user A reads or deletes user B's recipe by manipulating the recipe ID in the URL or request params | High | Low-Medium | PRD NFR "data isolation"; PRD guardrail; roadmap S-03/S-04 risk |
| 5 | Edit recompute stale — editing a saved ingredient does not correctly re-fetch nutrition, leaving displayed summary inconsistent with stored state | Medium | Medium | Roadmap S-05 resolved unknown (re-fetch rule); hot-spot dir `src/app/actions/` (6 commits/30d), `src/app/recipes/` (3 commits/30d) |
| 6 | Parse pipeline validation too weak — zero/negative/null ingredient data passes the AI parse step and reaches the nutrition lookup unchecked, producing wrong totals silently | High | Medium | PRD S-01 risk "hallucinated quantity worse than manual entry"; hot-spot dir `src/app/api/` (parse-recipe 4 commits/30d) |
| 7 | Unauthenticated request reaches the AI parse endpoint — expensive AI call triggered without a valid session; also leaks recipe data access to unauthenticated actors | Medium-High | Medium | PRD Access Control "unauthenticated users cannot access any recipe data"; abuse lens (resource abuse + authorization) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|---|---|---|---|---|---|
| #1 | Given an ingredient whose nutrient is absent from the API response, the summary shows the explicit missing indicator, never 0 | "The summary shows a value so the flag is working" — 0 looks like a valid value | Where missing-flag enforcement lives in the data flow (nutrition client → summary computation); whether it is enforced at multiple layers | Unit on the nutrition mapping function + integration on the summary computation | Asserting the current output value (oracle from implementation); must assert against a fixture with known-absent fields |
| #2 | A known ingredient with known nutrient values (fixture) always returns correct numeric totals through the full lookup pipeline | "Tests pass with a mocked API" — mock may not match real response shape; the real API swap is what burned the user | `src/lib/` nutrition client interface, how the API response maps to the internal nutrient model | Integration with a recorded or fixture response that matches real API response shape | Over-mocking the HTTP client; the mapping/parsing logic must be exercised with real response shape |
| #3 | Save completes and the recipe can be read back with all fields intact in a subsequent request | "Save button clicked = recipe saved" — action could swallow a DB error | App-layer save path, error handling in server action, whether partial writes are possible | Integration (server action → DB write → read-back); test the application's save behavior, not Supabase internals | Mocking the DB client away entirely; the write/read path must be exercised |
| #4 | A request for user B's recipe ID under user A's session returns 403 or 404, never user B's data | "RLS is configured so it's safe" — app-layer routes could use a service-role key or skip JWT forwarding | How the Supabase client is initialized in server actions/API routes (user client vs service client); which routes have which client | Integration (two user sessions, cross-user resource attempt) | Testing only the happy path (user A reads their own recipe) without the cross-user attempt |
| #5 | After editing an ingredient name/quantity/unit and saving, the stored nutritional summary reflects the new ingredient, not the old one | "Edit saved = summary updated" — re-fetch might fire but result may not be stored atomically | `update_recipe` RPC behavior, whether re-fetch and DB write are atomic | Integration (edit ingredient → read back recipe → assert summary matches new ingredient) | Testing only that the UI updates the displayed value without verifying the persisted state |
| #6 | An ingredient with zero quantity, negative quantity, empty unit, or null name is rejected or sanitized before reaching the nutrition lookup | "The AI always returns valid structured output" — schema-conformant but semantically invalid data is possible | Where parse output is validated (Zod schema? manual check?), what counts as invalid in the pipeline | Unit on the parse/validation step with adversarial fixture inputs | Testing only the happy-path AI response; must include boundary/invalid values |
| #7 | An unauthenticated POST to the parse route returns 401/403, not a parse result | "Middleware protects all routes" — Next.js middleware and route handlers can diverge | Middleware config (which paths are covered), whether API routes independently re-check the session | Integration (unauthenticated HTTP request to the parse route) | Testing only the authenticated happy path |

---

## 3. Phased Rollout

Each row is a discrete rollout phase that opens its own change folder via
`/10x-new`. Status moves left-to-right; the orchestrator updates Status and
Change-folder as artifacts appear on disk.

| # | Phase name | Goal | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Critical-path integration coverage | Prove missing-flag invariant, nutrition computation, and save/retrieve are regression-safe; bootstrap the test runner | #1, #2, #3, #5 | unit + integration | complete | context/changes/testing-critical-path-coverage/ |
| 2 | Security boundary coverage | Prove data isolation and auth enforcement hold under adversarial access attempts | #4, #7 | integration | not started | — |
| 3 | Parse pipeline validation | Prove malformed AI-parsed data is caught before reaching the nutrition lookup | #6 | unit + integration | not started | — |
| 4 | Quality gates wiring | Lock lint + typecheck + integration suite as required CI gates on PRs | cross-cutting | CI config | not started | — |

**Status vocabulary:** `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`

---

## 4. Stack

No test runner is configured yet. Phase 1 bootstraps the runner. All tool
recommendations below are grounded in the project manifest and current-session
MCP docs; see the grounding note at the end of this section.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| Unit + integration | Vitest | ^4.1.8 | Recommended for Next.js 16 + TypeScript; compatible with the App Router without the Jest transform setup overhead |
| HTTP mocking | MSW (Mock Service Worker) | ^2.14.6 | Mock at the network edge only; never mock internal modules |
| e2e | none yet | — | Not in scope for this rollout |
| Accessibility | none yet | — | Not in scope for this rollout |

**Stack grounding tools (current session):**
- Docs: Context7 MCP — available; not used for stack selection (Vitest + MSW are standard for the detected stack; Next.js 16 docs checked via CLAUDE.md note); checked: 2026-06-08
- Search: Exa.ai MCP — available; not used (no open question required search); checked: 2026-06-08
- Runtime/browser: none — no Playwright MCP in session; e2e not in scope for this rollout
- Provider/platform: Supabase client in manifest; Cloudflare Workers noted in tech-stack.md — neither platform's internals are in scope per §7

---

## 5. Quality Gates

| Gate | Where | Required? | Catches |
|---|---|---|---|
| Lint + typecheck | local + CI | required (already in CI) | syntactic / type drift |
| Unit + integration | local + CI | required after §3 Phase 1 | logic regressions, missing-flag violations, nutrition contract drift |
| Security integration | CI on PR | required after §3 Phase 2 | data isolation regressions, auth bypass |
| Parse validation unit | local + CI | required after §3 Phase 3 | malformed ingredient data reaching nutrition lookup |
| Pre-prod smoke | manual | optional | environment-specific failures in Cloudflare Workers runtime |

---

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section fills in once the
relevant rollout phase ships.

### 6.1 Adding a unit test

Pattern established in Phase 1. Use for pure functions with no I/O or framework dependencies.

1. Place the test file under `src/__tests__/lib/<module-name>.test.ts`.
2. Import the function directly: `import { myFn } from '@/lib/myModule'`.
3. Construct fixture objects inline — never read expected values from the implementation.
4. Derive expected values by hand from the oracle (PRD / domain rule), then hard-code them.
5. Cover both boundary directions for any null ↔ application-type mapping.

Examples:
- `src/__tests__/lib/nutrition-aggregate.test.ts` — `aggregateNutrients`: all-numeric sum, any-missing propagation, single-item passthrough, empty-array throw.
- `src/__tests__/lib/db-recipes.test.ts` — four DB adapter functions: null→"missing" (read path) and "missing"→null (write path) for all nine nutrient fields.

### 6.2 Adding an integration test

Pattern established in Phase 1. Use when the function under test makes real HTTP calls that must be intercepted.

1. Import `server` from `src/__tests__/setup.ts`.
2. In `beforeEach` (or a per-test block), register a handler: `server.use(http.get(URL, () => HttpResponse.json(fixture)))`.
3. Place fixture JSON under `src/__tests__/fixtures/`.
4. Call the function under test normally — MSW intercepts the HTTP call transparently.
5. Assert against values derived from the fixture by hand, not from the implementation.
6. To override the default handler for a single test, call `server.use(...)` inside that `it` block — `afterEach` resets handlers automatically.

Example:
- `src/__tests__/lib/nutrition-fetch.test.ts` — `fetchNutrients` driven through the full OFF HTTP → extraction → scaling pipeline using `src/__tests__/fixtures/off-chicken-breast.json`.

### 6.3 Adding a security integration test

TBD — see §3 Phase 2 (cross-user isolation and auth-boundary patterns).

### 6.4 Adding a parse validation test

TBD — see §3 Phase 3 (adversarial AI parse input patterns).

### 6.5 Per-rollout-phase notes

(Fills in as phases ship.)

---

## 7. What We Deliberately Don't Test

- **Supabase internals** — RLS engine, Supabase client library behavior. We trust the platform. Re-evaluate if we switch to a self-hosted Postgres setup. (Source: Phase 2 interview Q5.)
- **Cloudflare Workers runtime** — CPU limits, routing behavior, cold-start latency. We trust the platform. Re-evaluate if we move off Cloudflare. (Source: Phase 2 interview Q5.)
- **Landing page** — purely presentational, no data dependencies, low blast radius.
- **Generated TypeScript types** (`database.types.ts`) — the generator is the test; hand-testing generated types is noise.
- **UI snapshots for every component** — brittle, catch nothing meaningful at this scale.

---

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-08
- Stack versions last verified: 2026-06-08
- AI-native tool references last verified: 2026-06-08

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
