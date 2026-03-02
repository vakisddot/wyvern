# Wyvern

AI Agent Orchestrator — Electron desktop app (TypeScript + React).

Read `docs/WYVERN_PRODUCT_DESIGN.md` for the full product spec.
Read `docs/plan/step-0-overview.md` for the build plan and file map.

## Architecture

- **Main process** (`src/main/`): Node.js — orchestrator, agent spawner, git manager, config loader, IPC handlers
- **Preload** (`src/preload.ts`): contextBridge exposing `window.wyvern` API
- **Renderer** (`src/renderer/`): React + Tailwind + Zustand — three-panel GUI

Agents are stateless CLI processes (`claude`, `gemini`) spawned via `child_process.spawn`. They communicate through file artifacts in `.wyvern/pipelines/`. The orchestration loop is recursive — one pattern at every depth.

## Code Rules

- TypeScript everywhere. No `any` unless interfacing with untyped externals. Prefer `unknown` + type guards.
- All shared types live in `src/types.ts`. One source of truth.
- IPC channel names come from `IPC_CHANNELS` const in `src/types.ts`. Never hardcode channel strings.
- Main process modules are classes or plain exported functions — no singletons, no globals. Dependencies injected via constructors.
- Renderer uses functional React components with hooks. No class components.
- State management: Zustand stores in `src/renderer/stores/`. Access stores via hooks in components, via `getState()` in non-React code (IPC listeners).
- Styling: Tailwind utility classes. No CSS modules, no styled-components, no inline style objects unless dynamic.
- File operations in main process use `fs` sync methods (simple, orchestrator is already async at the spawn level).
- Git operations use `child_process.execSync` with explicit `cwd`.

## Conventions

- Naming: files are `kebab-case.ts`. Types/interfaces are `PascalCase`. Functions/variables are `camelCase`.
- Imports: relative paths within `src/`. No path aliases.
- No barrel files (`index.ts` re-exports). Import directly from the source file.
- Keep functions small. If a function needs a comment explaining what a block does, extract that block into a named function.
- No dead code. No commented-out code. No TODO comments — track work in `docs/plan/`.

## UI Design

Full design system: `.claude/skills/ui-design/SKILL.md`
Reference mockup: `docs/plan/interface-example.jpg`

Quick summary: dark theme, JetBrains Mono everywhere, CLI/ImGui aesthetic with `[bracketed]` buttons/tabs, hexagonal agent nodes with colored borders + glow, no gradients (except body background), no pill buttons.

## Don'ts

- Don't add features not in the design doc or current step's plan.
- Don't create wrapper utilities for one-time operations.
- Don't add error handling for impossible states.
- Don't introduce abstractions "for the future."
- Don't add comments that restate what the code does.
- Don't install packages without checking if an existing dependency already covers the need.
