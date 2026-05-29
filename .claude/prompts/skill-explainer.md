# Skill Explainer

Analyze a skill to understand its mechanics, design rationale, and how to build something similar. When invoked, read the target skill's source files and produce a structured report that demystifies how the skill works and why it's built that way.

## Input

The user provides a skill name (e.g., `10x-plan`, `10x-shape`, `10x-new`). Accept it as:
- A bare name: `10x-plan`
- A slash-prefixed name: `/10x-plan`
- A path to a SKILL.md file: `~/.claude/skills/10x-plan/SKILL.md`

If no skill name was provided, ask:

```
Which skill would you like me to explain? Provide a skill name (e.g., `10x-plan`) or a path to its SKILL.md file.
```

Then wait.

## Discovery

Find the skill's source files:

1. **Locate the SKILL.md.** Try these paths in order, stop at first hit:
   - `~/.claude/skills/<name>/SKILL.md`
   - `.claude/skills/<name>/SKILL.md` (project-local)
   - `.agents/skills/<name>/SKILL.md` (Codex)
   - `.cursor/skills/<name>/SKILL.md` (Cursor)
   - User-provided path (if a full path was given)

   If none found, tell the user:
   ```
   I couldn't find the SKILL.md for "<name>". Please provide the full path to the skill file.
   ```
   Then wait.

2. **Read the SKILL.md fully** — no truncation, no limit/offset.

3. **Check for a `references/` directory** next to the SKILL.md. If it exists, list its contents and read every `.md` file in it fully. These are companion documents (schemas, templates, registries) that define contracts the skill enforces.

## Analysis

After reading all source files, produce the report below. Adapt the depth to the skill's complexity:

| Skill size | Depth |
|-----------|-------|
| Under 150 lines (simple) | Concise — each section is 3-5 sentences. Skip sections that don't apply (e.g., simple skills rarely have sub-agent orchestration or self-review gates). |
| 150-400 lines (medium) | Standard — each section is a short paragraph. Cover all 7 sections. |
| Over 400 lines (complex/orchestrator) | Detailed — anatomy table, specific line references, extended mechanics analysis. All 7 sections in full. |

Do not pad simple skills with generic filler. A 95-line skill gets a tight, focused report. An 831-line orchestrator gets deep coverage.

## Report Structure

Before the detailed sections, open with a short overview block that orients the reader. Print it exactly once, at the top of the report:

```
## Sections in this report

1. **Problem & Purpose** — Why this skill exists and what pain it removes
2. **Chain Position** — Where it sits in the workflow: what feeds in, what comes after
3. **Anatomy Walkthrough** — Section-by-section map of the SKILL.md file
4. **Key Mechanics** — The behavioral drivers that make this skill tick, with high-leverage parts flagged
5. **Design Decisions** — Why it's built this way and not another — the rejected alternatives
6. **Adaptation Guide** — What you can tweak (easy / medium / hard) with concrete examples
7. **Building Something Similar** — Step-by-step path from blank file to a working skill like this one
```

Then proceed with each section in full:

### 1. Problem & Purpose

Answer: **"Why does this skill exist?"**

Extract from the role statement and the "When to use / when to skip" section:
- What problem does this skill solve? What was happening before it existed?
- When should a user reach for it? What are the trigger signals?
- When should they NOT use it? What's the wrong context?
- What would happen if the user tried to do this task manually without the skill?

Do not just describe what the skill does — explain what pain it removes.

### 2. Chain Position

Answer: **"Where does this skill sit in the workflow?"**

Extract from the "Relationship to other skills" section:
- **Upstream**: What files or artifacts does this skill expect as input? Which skill produces them? (e.g., `/10x-shape` produces `shape-notes.md` which `/10x-prd` consumes)
- **Downstream**: What does this skill output? Which skill consumes it next? What file does it write to disk?
- **The handoff model**: Skills communicate through files on disk, not through memory. Each skill writes an artifact, halts, and defers to the human before the next skill runs. Explain how this skill fits in that chain.

Show the chain position visually when useful:
```
[upstream skill] → input artifact → THIS SKILL → output artifact → [downstream skill]
```

### 3. Anatomy Walkthrough

Answer: **"What are the sections of this SKILL.md and what does each do?"**

Break the SKILL.md into its sections and for each one, report:
- **Section name** and approximate line range
- **What it does** — one sentence
- **Why it's there** — what would break or degrade if this section were removed

Present as a table for medium and complex skills:

| Section | Lines | Purpose | Why it matters |
|---------|-------|---------|----------------|
| YAML frontmatter | 1-8 | Name, description, allowed-tools | `description` controls when the skill activates; `allowed-tools` is a hard security boundary |
| Role statement | 10-15 | One-sentence philosophy | Sets the skill's behavioral personality |
| ... | ... | ... | ... |

The goal: demystify the "thousands of lines." Show the learner that a long skill is really N sections, each with a clear job. The whole is less intimidating than the parts.

### 4. Key Mechanics

Answer: **"What are the 3-5 behavioral drivers that make THIS skill tick, and which parts have the highest leverage?"**

This section must be specific to the skill being analyzed — not a generic list of skill patterns. Read the process steps and identify what drives THIS skill's behavior. For each mechanic:

1. **Name it** — give the pattern a short, descriptive name
2. **Explain how it works** — 2-3 sentences on the mechanism
3. **Point to where** — which lines or sections of the SKILL.md implement it
4. **Flag leverage** — mark parts where a small change produces a large behavior change. Typical high-leverage patterns include:
   - `description` field (controls activation), `allowed-tools` (security boundary)
   - Critical guardrails (hard behavioral rules)
   - Templates/schemas (output shape that downstream skills may depend on)
   - Self-review gates (embedded tests before output is committed)

Examples of mechanics found in real skills (use as reference, not checklist):

- **Complexity-scaled questioning** (`10x-plan`): assesses task as LOW/MEDIUM/HIGH, scales question count, skips diagnostic questions when upstream artifacts exist
- **Sub-agent orchestration** (`10x-research`): spawns parallel agents, each with a focused prompt, synthesizes findings
- **Progress-driven state machine** (`10x-implement`): `## Progress` checkboxes are the single source of truth, no state sidecar
- **Socratic discovery loop** (`10x-shape`): open question → surface gray areas → recommend → challenge → lock decision
- **Anti-bias mechanisms** (`10x-infra-research`): devil's advocate, pre-mortem, unknown-unknowns cross-checks

### 5. Design Decisions

Answer: **"Why is this skill built THIS way and not another?"**

This is the section that answers "czemu skill jest tak a nie inaczej budowany." For each major structural choice in the skill, explain:

1. **The choice that was made** — what the skill does
2. **The alternative that was rejected** — what it could have done instead
3. **Why this way wins** — the specific tradeoff that made this choice better

Look for decisions in these areas (not all will apply):

- **Tool selection**: Why these `allowed-tools` and not others? (e.g., why no `Agent` in a skill that could theoretically use sub-agents?)
- **State management**: Why state-in-file vs state-in-memory vs external sidecar?
- **Chain behavior**: Why "STOP, do not chain" instead of auto-continuing? Why files on disk instead of passing state in-memory?
- **Validation strategy**: Why validate at this point and not earlier/later? Why these specific checks?
- **Output format**: Why this template structure? Why YAML frontmatter vs plain markdown? Why inline templates vs reference files?
- **Interaction model**: Why AskUserQuestion at this step? Why not just decide automatically?

The goal is to surface the engineering thinking behind the skill. A learner who understands the rejected alternatives understands the design space — and can make their own choices when building something similar.

### 6. Adaptation Guide

Answer: **"What can I tweak, and how risky is each change?"**

Organize by difficulty tier with 1-2 concrete examples per tier, specific to the skill being analyzed:

**Easy (low risk, immediate effect):**
- What to change: e.g., trigger phrases in `description`, template section headings, question option labels, report formatting
- Example: "To add Polish trigger phrases, edit the `description` field and add 'stwórz plan' alongside 'create plan'"
- What breaks if you get it wrong: nothing critical — worst case, the skill activates at wrong times or output formatting looks different

**Medium (requires understanding the chain):**
- What to change: e.g., self-review gate criteria, scoring dimensions, question categories, number of sub-agents
- Example: "To add a 'Security' dimension to the review scorecard, add it to the dimensions list in the process steps and update the report template"
- What breaks if you get it wrong: the skill may produce incomplete or inconsistent output, but it won't break other skills in the chain

**Hard (structural, risk of breaking chain contracts):**
- What to change: e.g., `allowed-tools` list, output file format, artifact naming, status lifecycle values
- Example: "Changing the output filename from `plan.md` to `implementation-plan.md` would break `/10x-implement` which greps for `plan.md`"
- What breaks if you get it wrong: downstream skills that depend on exact file names, section headers, or status values will fail silently or produce wrong output

### 7. Building Something Similar

Answer: **"If I wanted to build my own version of this skill, how would I start?"**

Provide a practical, step-by-step construction path. Start simple and build up — this is the progressive journey from "blank file" to "working skill."

Before diving into manual steps, note two shortcuts:
- **Conversational approach**: Just tell your agent "let's build a skill that does X" and iterate on the SKILL.md together in 3-4 rounds. This is the fastest path for personal skills.
- **`/skill-creator`**: Anthropic's meta-skill for building skills with structured evals. Available at `github.com/anthropics/skills/tree/main/skills/skill-creator`. Better for shared or chain-integrated skills where you want automated verification.

Both shortcuts produce the same SKILL.md — the steps below explain what they're generating, so you understand the output and can refine it:

**Step 1: Start with a prompt.** Before creating a skill file, write the core instruction as a plain prompt. Test it in a conversation. Does it produce roughly the right output? Iterate until the core behavior works.

**Step 2: Create the skill file.** Create `<skill-name>/SKILL.md` in your skills directory. Add the minimal frontmatter:
```yaml
---
name: <skill-name>
description: <one-line description with trigger phrases>
allowed-tools:
  - Read
  - Bash
---
```

**Step 3: Add structure.** Translate your prompt into sections: role statement, when-to-use/skip, initial response, and process steps. The role statement sets the personality; the when-to-use section prevents misuse.

**Step 4: Add guardrails.** What must this skill NEVER do? Write 3-5 critical guardrails. These are the highest-leverage lines — they prevent the most damaging failure modes.

**Step 5: Add scope boundaries.** Write a "What this skill does NOT do" section. Explicit boundaries prevent scope creep and make the skill predictable.

**Step 6: (If needed) Add references.** If the skill enforces a schema, template, or registry, put those in a `references/` directory. Keep the SKILL.md focused on behavior; put data contracts in reference files.

**Step 7: (If needed) Add chain integration.** If this skill is part of a chain, define the upstream input (what file it reads) and downstream output (what file it writes). Add the "Relationship to other skills" section. Add "STOP, do not chain" to guardrails.

**Step 8: (If needed) Add advanced patterns.** Based on what this skill demonstrates, mention which advanced patterns the learner could add:
- Sub-agent orchestration (if the skill spawns agents)
- Complexity scaling (if the skill adapts to input size)
- Self-review gates (if the skill validates its own output)
- Checkpoint-based resume (if the skill supports multi-session work)
- AskUserQuestion for interactive decisions

For each step, note what the skill being analyzed does at that level, so the learner can see the correspondence between the construction steps and the finished product.

**Common mistakes to avoid:**
- Starting with the advanced patterns before the core behavior works
- Writing guardrails that are too vague ("be careful") instead of specific ("NEVER auto-chain to the next skill")
- Forgetting the "What this skill does NOT do" section — scope creep is the #1 skill failure mode
- Making `description` too broad (activates on everything) or too narrow (never activates)

## Edge Cases

- **Skill has no references/ directory**: skip the references analysis. Don't mention that references are missing — most simple skills don't have them, and that's fine.
- **Skill is a prompt file, not a SKILL.md**: if the user points to a `.claude/prompts/*.md` file, explain that prompts are simpler than skills (no frontmatter, no allowed-tools, no chain position) and analyze what's there. Adjust the report to skip sections that don't apply.
- **Skill is very short (under 50 lines)**: produce a minimal report — Problem & Purpose + Anatomy + Building Something Similar. Skip chain position, key mechanics, and adaptation guide if there's nothing meaningful to say.
- **Skill uses patterns not listed above**: analyze what you see. The mechanics list in section 5 is illustrative, not exhaustive. If the skill has a unique pattern, explain it.

## Tone

Write for a developer who can USE the skill but wants to understand HOW and WHY it works. Don't explain what Claude Code is or how slash commands work — the reader already uses these daily. Focus on the design decisions, the load-bearing parts, and the practical path to building their own.
