---
project: NutriCalc
context_type: greenfield
updated: 2026-05-19
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 10
  quality_check_status: accepted
---

## Vision & Problem Statement

**Domain rule:** The app calculates nutritional values from pasted recipe text by parsing ingredients via AI, fetching per-ingredient data from a nutrition API, summing totals, and explicitly flagging any nutrient values absent from the source database.

**Pain:** Manual ingredient entry into dietary apps is tedious and time-consuming. Existing apps have incomplete ingredient databases and silently treat missing micronutrient data (fiber, iron, etc.) as 0 — users receive wrong totals without realizing it.

**Moment:** When a health-conscious home cook finds a recipe online and wants an accurate full nutritional breakdown before cooking it.

**Cost today:** Time wasted on manual entry, plus false confidence from inaccurate totals caused by silent zero-fill for missing data.

**Insight:** Existing apps hide their own database gaps. NutriCalc surfaces them transparently so the user knows exactly what to trust.

## User & Persona

**Primary persona:** Health-conscious home cook who tracks macro and micronutrients and cooks from online recipes. Cares about the accuracy of specific nutrients (fiber, iron) — not just calories and macros.

**Core pain driver:** Both complaints are equally load-bearing — the tedium of manual entry AND the inaccuracy from silent missing data. Neither alone is sufficient reason to build.

## Access Control

**Auth method:** OAuth only (Google / GitHub / etc.) — no password management.

**Rationale:** OAuth enables persistent cross-device access, which is the core purpose of having accounts at all.

**Role model:** Flat — every authenticated user sees only their own recipes. No admin role for MVP.

## Success Criteria

### Primary
≥75% of recipes are created via the AI path (paste text → AI parses → user accepts). This is the signal that the AI parsing is good enough and users trust it over manual entry.

### Secondary
≥75% of AI-parsed recipes are accepted by the user without major correction (ingredient list is trusted as-is or with minor edits).

### Guardrails
- Missing nutrient data must be shown explicitly as absent — never silently treated as 0. This is the core differentiator and must hold under all conditions.
- No recipe data loss — saved recipes must persist reliably.
- User data isolation — user A cannot access user B's recipes under any path, including URL manipulation or API parameter tampering.

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
- FR-005: User can view the full nutritional summary of a recipe (all nutrients returned by the API). Priority: must-have
  > Socrates: "'Full' is undefined — 50+ fields could overwhelm." Resolution: kept as-is — display everything the API returns; don't pre-filter. Let the user decide what matters.

- FR-006: App displays missing nutrient values as explicitly absent, never as 0. Priority: must-have
  > Socrates: "Showing 'missing' widely could make the app look broken to new users." Resolution: kept — transparency is the core differentiator. Users who want false confidence can use other apps.

### Recipe Management
- FR-007: User can save a recipe to their account. Priority: must-have
  > Socrates: "Server-side save requires persistent backend — localStorage could cut scope." Resolution: kept — cross-device persistence is the reason OAuth accounts exist. Cutting server-side save means cutting accounts.

- FR-008: User can view a list of their saved recipes (chronological order, no search or filter). Priority: must-have
  > Socrates: "'Browse' implies search/filter." Resolution: scoped explicitly to chronological list only — no search, no filter for MVP.

- FR-009: User can edit the ingredient list of a saved recipe (direct field edits only, no AI re-parse). Priority: must-have
  > Socrates: "Edit = same complexity as creation if it triggers re-parse." Resolution: scoped down — direct field edits only, consistent with FR-003. No AI re-parse on edit.

- FR-010: User can delete a saved recipe. Priority: must-have
  > Socrates: No meaningful counter-argument. Delete is table stakes for user-owned data.

## User Stories

### US-01: AI recipe parsing (primary path)
```
Given: a health-conscious home cook is signed in
When:  they paste raw recipe text and submit it
Then:  the app displays an editable ingredient list with quantities,
       and a full nutritional summary where each nutrient either shows
       a value or is explicitly flagged as missing
```

## Business Logic

**One-sentence rule:** The app calculates nutritional values from pasted recipe text by parsing ingredients via AI, fetching per-ingredient data from a nutrition API, summing totals, and explicitly flagging any nutrient values absent from the source database.

**Inputs (user-facing):** Raw recipe text (copy-pasted from any source). Optionally: manually entered ingredient corrections.

**Output:** A per-ingredient nutritional breakdown plus a recipe-level total. Every nutrient field is either a numeric value or an explicit "missing" marker — no silent zeros.

**How the user encounters it:** Paste text → submit → review parsed ingredient list → optionally correct → see nutritional summary with transparent missing-data flags.

**Note on nutrition API:** The specific API is not decided at this stage. The choice affects the completeness and naming conventions of the nutrient data. Open question for downstream stack selection.

## Non-Functional Requirements

- **Response time:** Perceived response < 5 seconds for the combined AI parse + nutrition API lookup. Applies to the recipe submission flow (FR-002 + FR-005).
- **Reproducibility:** Nutritional totals are deterministic — same ingredient list always produces the same result. No randomness in calculation.
- **Data isolation:** User A cannot access User B's recipes under any path, including URL manipulation or API parameter tampering.
- **Browser support:** App must work correctly on modern desktop browsers: Chrome, Firefox, Safari, Edge. No mobile browser requirement for MVP.

## Non-Goals

- **Recipe serving scaling:** Nutritional totals are for the recipe as written. No per-serving adjustment in MVP.
- **Custom ingredient database or mapping algorithm:** Use an existing nutrition API — do not build a proprietary ingredient DB or custom mapping logic.
- **Languages other than English:** Recipes, ingredient names, and UI are English-only for v1.
- **Recipe sharing between users:** Recipes are private to their owner — no sharing, public links, or collaboration features.
- **Mobile apps:** Web-only for v1. No native iOS or Android application.

## Forward: tech-stack
*(informational — not part of PRD schema; for downstream stack selection)*

- Nutrition API choice undecided — candidates: Open Food Facts, USDA FoodData Central, Edamam. Decision affects micronutrient coverage and missing-data frequency.
- At 10,000+ users, ingredient-level nutrition results should be cached (same ingredient lookup should not trigger a fresh API call). Not a v1 concern at dozens-to-hundreds scale, but worth noting for the stack selector.
- AI parsing: likely an LLM call (e.g. Claude / GPT) with a structured output schema for ingredient + quantity + unit. Prompt design is a key implementation risk.
