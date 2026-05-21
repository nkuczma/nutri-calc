# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Always place style imports after TS/JS imports

- **Context**: Any component or module file that imports both TS/JS modules and stylesheets (CSS/SCSS)
- **Problem**: When styles are imported before TS/JS modules, CSS modules load in the wrong order, causing style overrides to fail and producing style specificity bugs.
- **Rule**: Always place stylesheet imports (CSS/SCSS/CSS Modules) after all TS/JS imports in a file. Never mix or hoist style imports above module imports.
- **Applies to**: implement, impl-review
