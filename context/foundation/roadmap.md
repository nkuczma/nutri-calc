---
project: NutriCalc
version: 1
status: draft
created: 2026-05-25
updated: 2026-06-04
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: NutriCalc

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline (2026-05-25).
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

NutriCalc parses pasted recipe text via AI, fetches per-ingredient nutritional data from an external source, and shows a recipe-level summary where every nutrient is either a value or an explicit "missing" flag. The core differentiator is transparency: where competing dietary apps silently fill missing micronutrient data with zeros, NutriCalc surfaces the gap so users know exactly what their totals are based on. Solo 3-week MVP, after-hours, hard deadline 2026-07-05.

## North star

**S-01: paste-parse-summary** — A signed-in cook pastes recipe text, gets an editable AI-parsed ingredient list, and sees the full nutritional summary with explicit missing-data flags.

> North star — the smallest end-to-end slice whose successful delivery would prove the core product premise. Placed as early as Prerequisites allow because everything else (save, list, edit, delete) only matters once this loop works. The core product premise here: that an AI parse of pasted recipe text plus a nutritional summary with transparent missing-data flags solves the home cook's pain better than manual entry into apps that silently zero-fill missing micronutrients.

Why this slice is the first end-to-end proof: it hits the primary Success Criterion (≥75% of recipes submitted via AI path), the secondary (≥75% accepted without major correction), and the differentiator guardrail (missing flags shown explicitly). Sequenced immediately after F-01 (auth) and F-02 (nutrition source); save and the rest of the recipe lifecycle follow once this loop is trusted.

## At a glance

| ID   | Change ID                | Outcome (user can …)                                                                                                | Prerequisites | PRD refs                                                 | Status |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------- | ------ |
| F-01 | auth-supabase-oauth      | (foundation) OAuth sign-in landed; session + route protection wired                                                 | —             | FR-001, NFR data isolation, Access Control               | done   |
| F-02 | nutrition-data-source    | (foundation) nutrition data source chosen and client wired; missing-flag contract enforced                          | —             | FR-005, FR-006, Open Q #1, NFR reproducibility           | done   |
| F-03 | recipes-schema-rls       | (foundation) `recipes` + `recipe_ingredients` tables with RLS gating by `auth.uid()`                                | F-01          | FR-007, NFR data isolation                               | done   |
| S-01 | paste-parse-summary      | paste recipe text, get AI-parsed editable ingredient list, see full nutritional summary with missing flags          | F-01, F-02    | US-01, FR-002, FR-003, FR-005, FR-006, NFR response time | done   |
| S-02 | manual-recipe-entry      | create a recipe from scratch by entering ingredients manually and see its nutritional summary                       | F-01, F-02    | FR-004, FR-005, FR-006                                   | done   |
| S-03 | save-recipe              | save a parsed or manually-created recipe to their account                                                           | S-01, F-03    | FR-007, NFR data isolation                               | done   |
| S-04 | list-saved-recipes       | view their saved recipes in chronological order                                                                     | S-03          | FR-008, NFR data isolation                               | done   |
| S-05 | edit-saved-recipe        | edit the ingredient list of a saved recipe (direct field edits, no AI re-parse)                                     | S-04          | FR-009                                                   | done   |
| S-06 | delete-saved-recipe      | delete a saved recipe                                                                                               | S-04          | FR-010                                                   | done   |
| S-07 | ingredient-unit-handling | AI-parsed and manually-entered ingredients resolve units (e.g. "slice", "cup") before nutrition lookup              | S-01          | FR-003, FR-005                                           | done   |
| S-08 | landing-page             | visit the app unauthenticated and see a landing page explaining what the app does, before being prompted to sign in | —             | —                                                        | done   |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme              | Chain                                      | Note                                                                                                                                        |
| ------ | ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Gated AI loop      | `F-01` → `S-01` → `S-02`                   | Critical path under `main_goal: speed`. F-01 unblocks every signed-in slice; S-01 is the north star; S-02 is the fallback creation path.    |
| B      | Nutrition pipeline | `F-02`                                     | Standalone foundation. Joins Stream A at `S-01` and `S-02`. Blocked on Open Q #1 (nutrition source).                                        |
| C      | Recipe lifecycle   | `F-03` → `S-03` → `S-04` → `S-05` / `S-06` | Persistence + management. `S-05` and `S-06` run in parallel after `S-04`. Joins Stream A at `S-03` (recipe payload comes from S-01 / S-02). |

## Baseline

What's already in place in the codebase as of 2026-05-25 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js 16 App Router + Tailwind 4 scaffold; `src/app/layout.tsx`, `src/app/page.tsx` placeholder. No component library wired.
- **Backend / API:** partial — single demo `src/app/api/messages/route.ts` exists; no Server Actions, no recipe handlers.
- **Data:** partial — Supabase JS client wired (`src/lib/supabase.ts`); only a demo `messages` table referenced. No migrations, no recipe schema.
- **Auth:** partial — `@supabase/supabase-js` installed; no `@supabase/ssr`, no OAuth flow, no callback route, no middleware, no sign-in UI.
- **Deploy / infra:** present — `wrangler.jsonc` + `@opennextjs/cloudflare` v1.19.11 + `build:worker` / `deploy` scripts + `.github/workflows/deploy.yml` auto-deploy on push to main.
- **Observability:** absent — no logger, no Sentry/Datadog/OTel, no structured logs.
- **AI parsing:** absent — no LLM SDK, no prompt, no parse Server Action.
- **Nutrition API:** present — `src/lib/nutrition.ts`, USDA FoodData Central (`fetchNutrients`, `number | "missing"` contract).

## Foundations

### F-01: Auth scaffold (Supabase OAuth)

- **Outcome:** (foundation) OAuth sign-in via Google / GitHub landed; session issued and verified in the Workers runtime; route protection middleware in place; `auth.uid()` available for RLS downstream.
- **Change ID:** auth-supabase-oauth
- **PRD refs:** FR-001, NFR data isolation, Access Control section
- **Unlocks:** S-01 (north star), S-02, S-03, S-04, S-05, S-06; also enables RLS policies authored in F-03.
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Critical-path foundation for the north star. Per `infrastructure.md` risk register, Supabase Auth in the Workers runtime requires `@supabase/ssr` with an edge-compatible cookie handler; the default `@supabase/auth-helpers-nextjs` will silently fail. Wrong package choice burns days debugging cookie/session round-trips.
- **Status:** done

### F-02: Nutrition data source decision + client

- **Outcome:** (foundation) external nutrition data source chosen (Open Food Facts, USDA FoodData Central, or Edamam), client wired with a typed interface, and missing-flag contract enforced at the integration boundary — values returned as `value | "missing"`, never silently zeroed.
- **Change ID:** nutrition-data-source
- **PRD refs:** FR-005, FR-006, Open Q #1, NFR reproducibility, Critical Invariant (CLAUDE.md)
- **Unlocks:** S-01 (north star), S-02; transitively the summary recompute path used by S-04 and S-05.
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:**
  - Which external nutrition data source will the product use? Candidates: Open Food Facts (free, broadest), USDA FoodData Central (free, US-centric), Edamam (freemium, ingredient-matching). The choice changes micronutrient coverage breadth, missing-data frequency, and the ingredient-matching contract. Owner: user. Block: yes.
- **Risk:** This foundation gates two slices (S-01 and S-02). Picking late means parsed ingredients have nowhere to send. Picking the wrong source means re-implementing the client mid-MVP — under `main_goal: speed`, that re-work costs more than the missing-coverage trade-off.
- **Status:** done

### F-03: Recipes schema + RLS

- **Outcome:** (foundation) `recipes` and `recipe_ingredients` tables in Supabase with RLS policies gating every row by `auth.uid()`; schema models a per-ingredient nutrient snapshot that distinguishes `value` from `missing`.
- **Change ID:** recipes-schema-rls
- **PRD refs:** FR-007, NFR data isolation, Critical Invariant (missing-flag preservation)
- **Unlocks:** S-03 (save), S-04 (list), S-05 (edit), S-06 (delete); also the verification path for the data-isolation NFR (a regression test that user-A cannot read user-B's recipe under any URL).
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02 (the persistence layer can be designed while the ephemeral flow ships)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** RLS policies enforce the data-isolation NFR under every code path — a weak policy is a security incident in production. Schema must encode the missing-flag invariant at the column level (e.g., nullable nutrient columns + a `missing_nutrients text[]` column, or a JSONB blob with explicit `null` semantics) so neither the ORM nor the application code can silently default to zero.
- **Status:** done

## Slices

### S-01: paste-parse-summary (north star)

- **Outcome:** user can paste raw recipe text, see an editable AI-parsed ingredient list with name / quantity / unit, correct any line inline, and see the full nutritional summary with every nutrient either shown as a value or explicitly flagged missing — all under 5 seconds perceived response time.
- **Change ID:** paste-parse-summary
- **PRD refs:** US-01, FR-002, FR-003, FR-005, FR-006, NFR response time
- **Prerequisites:** F-01, F-02
- **Parallel with:** F-03
- **Blockers:** —
- **Unknowns:**
  - Will the AI parse + nutrition lookup combined fit inside the Workers CPU time limit (30 ms paid tier)? `infrastructure.md` pre-mortem calls this out — large JSON deserialization from OpenRouter can push CPU above the cap. Owner: implementer (verify during planning of S-01). Block: no — surfaces during /10x-plan, mitigated by streaming the response.
- **Risk:** Riskiest slice in the project. Failure of either the AI parse or the nutrition lookup invalidates the primary Success Criterion. Both must hit the < 5 s NFR together. Prompt design (structured output schema for ingredient + quantity + unit) is the load-bearing piece — a hallucinated quantity is worse than a manual entry.
- **Status:** done

### S-02: manual-recipe-entry

- **Outcome:** user can create a recipe from scratch by entering ingredients (name, quantity, unit) into a form without the AI path, and see the same nutritional summary with explicit missing flags.
- **Change ID:** manual-recipe-entry
- **PRD refs:** FR-004, FR-005, FR-006
- **Prerequisites:** F-01, F-02
- **Parallel with:** S-01, F-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Lower-risk fallback path. Reuses the nutritional summary rendering from S-01 and the F-02 nutrition client. Primary failure mode is divergence — if S-01 and S-02 render the summary differently, the missing-flag contract becomes a code-path question rather than an invariant. Mitigation: share the summary component between both creation paths.
- **Status:** done

### S-03: save-recipe

- **Outcome:** user can save a recipe (parsed or manually entered) to their account; the saved recipe persists across sessions and devices.
- **Change ID:** save-recipe
- **PRD refs:** FR-007, NFR data isolation, NFR no recipe data loss
- **Prerequisites:** S-01, F-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** First non-demo DB write in the codebase. Verification gate: a regression test must confirm user-A cannot read or modify user-B's saved recipe under URL manipulation or request-parameter tampering (NFR + PRD Success Criteria Guardrail). The missing-flag contract must round-trip — load(save(recipe)) must preserve every "missing" marker.
- **Status:** done

### S-04: list-saved-recipes

- **Outcome:** user can view their saved recipes in chronological order, scoped to their own account.
- **Change ID:** list-saved-recipes
- **PRD refs:** FR-008, NFR data isolation
- **Prerequisites:** S-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Scoped explicitly — chronological list only, no search and no filter for MVP (PRD §FR-008 carve-out). RLS scope: the list query must be filtered by `auth.uid()` and validated against the same data-isolation regression suite as S-03.
- **Status:** done

### S-05: edit-saved-recipe

- **Outcome:** user can edit the ingredient list of a saved recipe — direct field edits to name, quantity, or unit — with the nutritional summary recomputing accordingly. No AI re-parse on edit.
- **Change ID:** edit-saved-recipe
- **PRD refs:** FR-009, FR-005, FR-006
- **Prerequisites:** S-04
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:**
  - ~~When the user edits an ingredient (e.g., changes "salmon" to "tuna"), does the per-ingredient nutritional snapshot re-fetch from F-02's client at view-time, or stay frozen at save-time?~~ Resolved: re-fetch from F-02 when the user saves an edit. A frozen snapshot that diverges from the displayed ingredient list violates the trust contract. No re-fetch on view-only load.
- **Risk:** Edit semantics are scoped down (no AI re-parse), but the nutrition recompute question is load-bearing — get it wrong and the summary drifts from the displayed ingredient list, violating the core trust contract.
- **Status:** done

### S-06: delete-saved-recipe

- **Outcome:** user can delete a saved recipe; the deletion cascades to all per-ingredient rows.
- **Change ID:** delete-saved-recipe
- **PRD refs:** FR-010
- **Prerequisites:** S-04
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Table-stakes for user-owned data. The only sequencing concern: cascade rule at the DB level (`recipe_ingredients` rows deleted when parent `recipes` row is deleted) — handled in F-03's schema, not deferred to application code.
- **Status:** done

### S-07: ingredient-unit-handling

- **Outcome:** units on AI-parsed and manually-entered ingredients (e.g. "slice", "cup", "tbsp", "g") are resolved to a quantity in grams (or other base unit the nutrition API accepts) before the nutrition lookup runs; unrecognised units surface as an explicit warning rather than silently passing the raw string through.
- **Change ID:** ingredient-unit-handling
- **PRD refs:** FR-003 (structured parse output must include unit), FR-005 (nutrition lookup receives correct quantity)
- **Prerequisites:** S-01
- **Parallel with:** S-02 (unit resolution is shared logic; wire into manual entry path at the same time)
- **Blockers:** —
- **Unknowns:**
  - Does USDA FoodData Central accept a `portionCode` / `gramWeight` parameter that can absorb a resolved gram-weight directly, or must the unit normalisation happen entirely client-side? Owner: implementer (check `src/lib/nutrition.ts` + USDA API docs during planning). Block: no.
- **Risk:** Observed gap during S-01 implementation — units were parsed as strings but never converted, so a "1 slice" ingredient and a "100 g" ingredient both hit the nutrition API with quantity `1`. Silent incorrect totals break the core trust contract more badly than a missing-flag would. Fix must not silently zero: an unresolvable unit must propagate as `"missing"` for that ingredient's nutrients.
- **Status:** done

### S-08: landing-page

- **Outcome:** a visitor who arrives at the app root unauthenticated sees a landing page that explains what NutriCalc does — core value prop, transparent missing-flag differentiator — and a clear call-to-action to sign in. Authenticated users are redirected past it.
- **Change ID:** landing-page
- **PRD refs:** —
- **Prerequisites:** —
- **Parallel with:** any other slice
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low — purely presentational, no data dependencies. Main failure mode is letting the current placeholder leak to a real user and undermining trust before they even sign in.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID                | Suggested issue title                                                    | Ready for `/10x-plan` | Notes                                                                                    |
| ---------- | ------------------------ | ------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------- |
| F-01       | auth-supabase-oauth      | Wire Supabase OAuth (Google / GitHub) for Workers runtime                | done                  | Shipped. PR #10 merged.                                                                  |
| F-02       | nutrition-data-source    | Choose nutrition data source and wire the client                         | done                  | Shipped. USDA FoodData Central, `src/lib/nutrition.ts`.                                  |
| F-03       | recipes-schema-rls       | Design `recipes` + `recipe_ingredients` schema with RLS                  | done                  | Shipped.                                                                                 |
| S-01       | paste-parse-summary      | North star — paste → AI parse → nutritional summary with missing flags   | done                  | Shipped. PR #13 merged.                                                                  |
| S-02       | manual-recipe-entry      | Manual recipe creation path (fallback when AI fails)                     | done                  | Shipped. PR merged.                                                                      |
| S-03       | save-recipe              | Save parsed / manual recipe to account                                   | done                  | Shipped. Atomic RPC + Save button on both Manual and AI parse flows.                     |
| S-04       | list-saved-recipes       | List saved recipes chronologically                                       | done                  | Shipped as part of manual-recipe-entry.                                                  |
| S-05       | edit-saved-recipe        | Edit a saved recipe's ingredient list (direct edits only)                | done                  | Shipped. PR #19 merged. Inline edit UI + updateRecipe server action + update_recipe RPC. |
| S-06       | delete-saved-recipe      | Delete a saved recipe (cascade delete recipe ingredients)                | done                  | Shipped.                                                                                 |
| S-07       | ingredient-unit-handling | Resolve ingredient units (slice, cup, tbsp, g …) before nutrition lookup | done                  | Shipped. PR #14 merged.                                                                  |
| S-08       | landing-page             | Marketing/explainer landing page for unauthenticated visitors            | done                  | Shipped. No prerequisites. Purely presentational; authenticated users redirect past it.  |

## Open Roadmap Questions

1. ~~**Which external nutrition data source will the product use?**~~ — Resolved: USDA FoodData Central. Client shipped in `src/lib/nutrition.ts` (F-02 done).
2. ~~**On editing a saved recipe ingredient, does the nutritional summary re-fetch nutrition data from F-02 or stay frozen at save-time?**~~ — Resolved: re-fetch from F-02 on every edit save. A frozen snapshot diverges from the displayed ingredient list when the ingredient changes, violating the core trust contract. Rule: when the user saves a name/quantity/unit change, re-run the F-02 lookup for that ingredient, update the stored snapshot, and recompute recipe totals. No re-fetch on view-only load. Unresolvable lookups propagate as `"missing"`. S-05 is now unblocked.

## Parked

- **Per-serving scaling** — Why parked: PRD §Non-Goals. Totals are for the recipe as written; serving math is post-MVP.
- **Custom ingredient database or mapping algorithm** — Why parked: PRD §Non-Goals. Use an existing external source; do not build proprietary matching.
- **Languages other than English** — Why parked: PRD §Non-Goals. English-only for v1.
- **Recipe sharing between users** — Why parked: PRD §Non-Goals. Recipes are private to their owner.
- **Mobile apps** — Why parked: PRD §Non-Goals. Web-only for v1 (desktop browsers only per NFR).
- **Search and filter on recipe list** — Why parked: PRD §FR-008 carve-out. Chronological list only for MVP.
- **AI re-parse on edit** — Why parked: PRD §FR-009 carve-out. Direct field edits only on saved recipes.
- **Observability / structured logging** — Why parked: not in PRD NFRs and `main_goal: speed` defers it. Worth revisiting before launch if the missing-flag invariant needs production-side verification.
- **Per-ingredient nutrition cache** — Why parked: `shape-notes.md` Forward note flags this as a 10k-user concern; not a v1 issue at dozens-to-hundreds scale.

## Done

| ID   | Change ID                | Outcome                                                                                           | Merged     |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------- | ---------- |
| F-01 | auth-supabase-oauth      | OAuth sign-in (Google/GitHub) + session middleware + route guard shipped                          | 2026-05-29 |
| F-02 | nutrition-data-source    | USDA FoodData Central client — `fetchNutrients` shipped                                           | 2026-05-29 |
| S-01 | paste-parse-summary      | Paste → AI parse → editable ingredient list → nutritional summary with missing flags              | 2026-06-01 |
| F-03 | recipes-schema-rls       | `recipes` + `recipe_ingredients` tables with RLS gating by `auth.uid()`                           | 2026-06-01 |
| S-07 | ingredient-unit-handling | Unit resolution (slice/cup/tbsp/g → grams) before nutrition lookup; unresolvable → `"missing"`    | 2026-06-03 |
| S-02 | manual-recipe-entry      | Manual entry `/recipes/new`, save to Supabase, `/recipes` list — FR-004, FR-007, FR-008           | 2026-06-03 |
| S-03 | save-recipe              | Shipped as part of manual-recipe-entry                                                            | 2026-06-03 |
| S-04 | list-saved-recipes       | Shipped as part of manual-recipe-entry                                                            | 2026-06-03 |
| S-03 | save-recipe              | Atomic RPC save + Save button on AI parse and manual entry flows                                  | 2026-06-03 |
| S-06 | delete-saved-recipe      | Delete a saved recipe; cascade to `recipe_ingredients` via FK in F-03 schema                      | 2026-06-03 |
| S-05 | edit-saved-recipe        | Inline edit UI on `/recipes/[id]`; unit normalize → nutrition re-fetch → atomic update_recipe RPC | 2026-06-04 |
| S-08 | landing-page             | Unauthenticated landing page with value prop + sign-in CTA; authenticated users redirected        | 2026-06-03 |
