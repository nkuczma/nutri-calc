---
project: NutriCalc
version: 1
status: draft
created: 2026-05-19
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-07-05
  after_hours_only: true
---

## Vision & Problem Statement

Manual ingredient entry into dietary apps is tedious and time-consuming. Existing apps have incomplete ingredient databases and silently treat missing micronutrient data (fiber, iron, etc.) as 0 — users receive inaccurate totals without realizing it. The moment this pain lands hardest: a health-conscious home cook finds a recipe online and wants its full nutritional breakdown before cooking it. Their only option today is to enter each ingredient by hand into an app that will quietly report "0 fiber" instead of "fiber: unknown."

The insight that makes NutriCalc worth building: existing apps hide their own database gaps. They report 0 when data is missing, giving users false confidence in their totals. NutriCalc surfaces those gaps transparently — every nutrient is either a value or an explicit "missing" flag — so users know exactly what their summary is based on.

## User & Persona

**Primary persona:** Health-conscious home cook who tracks macro and micronutrients and cooks from online recipes. Cares about the accuracy of specific nutrients — particularly micronutrients like fiber and iron — not just headline macros.

**Reach for this product:** When they copy a recipe from the web and want its full nutritional breakdown without typing each ingredient individually into a tool that will produce false totals due to silent data gaps.

**Core pain driver:** Both the tedium of manual entry AND the inaccuracy from silent missing data are equally load-bearing. Neither alone is sufficient to justify the product; the combination is the pain.

## Success Criteria

### Primary
≥75% of recipes created by users are submitted via the AI path (paste text → AI parses → user accepts or makes minor corrections). This is the signal that AI parsing is reliable enough that users trust it over manual entry.

### Secondary
≥75% of AI-parsed recipes are accepted by the user without major corrections — the ingredient list is trusted as-is or with minor field edits.

### Guardrails
- Missing nutrient data must be shown explicitly as absent — never silently treated as 0. This is the core differentiator and must hold under all conditions.
- No recipe data loss — saved recipes must persist reliably under normal operation.
- User data isolation — user A cannot access user B's recipes under any path, including URL manipulation or request parameter tampering.

## User Stories

### US-01: AI recipe parsing (primary path)

- **Given** a signed-in health-conscious home cook
- **When** they paste raw recipe text and submit it
- **Then** the app displays an editable ingredient list with quantities, and a full nutritional summary where each nutrient either shows a value or is explicitly flagged as missing

#### Acceptance Criteria
- Every nutrient field in the summary is either a numeric value or an explicit "missing" indicator — no silent zeros
- The ingredient list is editable before the nutritional summary is finalized
- The flow from text paste to nutritional summary is complete without requiring the user to look up or enter any nutritional data manually

## Functional Requirements

### Authentication
- FR-001: User can sign in via OAuth (Google / GitHub). Priority: must-have
  > Socrates: "OAuth dependency creates provider risk; anonymous local storage is simpler." Resolution: kept — cross-device persistence is the reason accounts exist. Without server-side save, OAuth has no purpose.

### Recipe Creation
- FR-002: User can paste raw recipe text and receive an AI-parsed ingredient list with quantities. Priority: must-have
  > Socrates: "AI parsing is the highest-risk piece — hallucinated quantities could be worse than manual entry." Resolution: kept — AI handles the unstructured variety of real-world recipe formats; rules-based parsing would fail on edge cases.

- FR-003: User can manually edit any AI-parsed ingredient (name, quantity, unit). Priority: must-have
  > Socrates: "If 75% acceptance is the goal, full inline editing may be over-engineering." Resolution: kept — flagging alone doesn't fix a wrong gram value; editing is the correction path when AI fails on specific ingredients.

- FR-004: User can create a recipe from scratch by entering ingredients manually (without AI). Priority: must-have
  > Socrates: "Manual creation doubles the build surface; your metric prioritises AI usage." Resolution: kept — manual path is the fallback when AI parsing fails entirely; without it, a bad parse has no recovery path.

### Nutritional Display
- FR-005: User can view the full nutritional summary of a recipe (all nutrients returned by the nutritional data source). Priority: must-have
  > Socrates: "'Full' is undefined — 50+ fields could overwhelm." Resolution: kept as-is — display everything the source returns; don't pre-filter. Let the user decide what matters.

- FR-006: App displays missing nutrient values as explicitly absent, never as 0. Priority: must-have
  > Socrates: "Showing 'missing' widely could make the app look broken to new users." Resolution: kept — transparency is the core differentiator. Users who want false confidence can use other apps.

### Recipe Management
- FR-007: User can save a recipe to their account. Priority: must-have
  > Socrates: "Server-side save requires persistent backend — localStorage could cut scope." Resolution: kept — cross-device persistence is the reason OAuth accounts exist. Cutting server-side save means cutting accounts.

- FR-008: User can view a list of their saved recipes (chronological order, no search or filter). Priority: must-have
  > Socrates: "'Browse' implies search/filter." Resolution: scoped explicitly to chronological list only — no search, no filter for MVP.

- FR-009: User can edit the ingredient list of a saved recipe (direct field edits only, no re-parse). Priority: must-have
  > Socrates: "Edit = same complexity as creation if it triggers re-parse." Resolution: scoped down — direct field edits only, consistent with FR-003. No re-parse on edit.

- FR-010: User can delete a saved recipe. Priority: must-have
  > Socrates: No meaningful counter-argument. Delete is table stakes for user-owned data.

## Non-Functional Requirements

- **Response time:** Perceived response time from recipe text submission to nutritional summary display is < 5 seconds.
- **Reproducibility:** Nutritional totals are deterministic — the same ingredient list always produces the same result. No randomness in the calculation.
- **Data isolation:** User A cannot read or modify User B's recipes under any path or request parameter combination.
- **Browser support:** The product works correctly on the latest two major versions of Chrome, Firefox, Safari, and Edge on desktop. No mobile browser requirement for MVP.

## Business Logic

The app calculates nutritional values from pasted recipe text by parsing ingredients, fetching per-ingredient nutritional data from an external nutritional data source, summing totals across all ingredients, and explicitly flagging any nutrient values absent from that source.

**Inputs:** Raw recipe text (copy-pasted from any source). Optionally: manually entered ingredient corrections after the initial parse.

**Output:** A per-ingredient nutritional breakdown plus a recipe-level total. Every nutrient field is either a numeric value or an explicit "missing" marker — no silent zeros.

**How the user encounters it:** Paste text → submit → review parsed ingredient list → optionally correct → see nutritional summary with transparent missing-data flags.

## Access Control

Authentication via OAuth (Google / GitHub). No password management.

Every authenticated user has access to exactly their own recipes. The role model is flat — no distinctions between users. Unauthenticated users cannot access any recipe data. User A cannot read or modify User B's recipes under any path.

## Non-Goals

- **Recipe serving scaling:** Nutritional totals are for the recipe as written. No per-serving quantity adjustment in MVP.
- **Custom ingredient database or mapping algorithm:** The product uses an existing external nutritional data source — it does not build a proprietary ingredient database or a custom ingredient-matching algorithm.
- **Languages other than English:** Recipes, ingredient names, and the product UI are English-only for v1.
- **Recipe sharing between users:** Recipes are private to their owner — no sharing links, public recipe pages, or collaborative editing.
- **Mobile apps:** Web-only for v1. No native iOS or Android application.

## Open Questions

1. **Which external nutritional data source will the product use?** — Candidates identified during shaping: Open Food Facts (free, open-source), USDA FoodData Central (free, US government), Edamam (freemium). The choice affects micronutrient coverage breadth, missing-data frequency, and ingredient-matching behavior. Owner: user. By: before tech-stack selection.
