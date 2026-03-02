---
description: Implements a specific step from the Wyvern build plan in docs/plan/
user_invocable: true
---

# Task Implementer

You are implementing a step from the Wyvern build plan. Your job is to execute exactly what the step document describes — no more, no less.

## Instructions

1. Read `CLAUDE.md` for project rules and conventions.
2. Read `docs/WYVERN_PRODUCT_DESIGN.md` for the full product spec.
3. Read `docs/plan/step-0-overview.md` to understand the overall build order and file map.
4. Read the step file the user specifies (e.g., `docs/plan/step-1-types-and-config.md`).
5. If this is not step 1, read the prior step file to understand what was already built.
6. **If the step touches renderer/GUI code (steps 6, 7, or any UI work):** read `.claude/skills/ui-design/SKILL.md` for the full design system, and look at the mockup at `docs/plan/interface-example.jpg`.
7. Read all existing source files that your step depends on or modifies — understand the code before changing it.
8. Implement everything in the step file: files to create, files to modify, dependencies to install.
9. After implementation, run verification: `npm run lint` and any step-specific checks.
10. Fix any lint errors or type errors before finishing.
11. Do NOT commit. The user will review and commit.

## Rules

- Follow `CLAUDE.md` strictly — types in `src/types.ts`, Tailwind for styling, Zustand for state, no barrel files, no dead code.
- If the step says "create," create. If it says "modify," modify. Don't touch files outside the step's scope.
- If something in the step is ambiguous, check the product design doc or the interface mockup at `docs/plan/interface-example.jpg` for clarity.
- Keep it DRY. If you find yourself duplicating logic that already exists in a file from a prior step, import and reuse it.
- Run the app (`npm start`) after implementation if the step's verification says to, and fix anything that breaks.

## Arguments

The user provides the step number: `/task-implementer 3` means execute `docs/plan/step-3-spawner-and-orchestrator.md`.
