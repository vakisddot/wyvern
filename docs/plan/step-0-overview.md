# Wyvern Build Plan — Overview

## What We're Building

Wyvern is an Electron desktop app. The user ("CEO") types a directive, Wyvern spawns a tree of AI CLI agents (`claude`, `gemini`) that research, plan, and execute it. Agents communicate via file artifacts. There's a recursive orchestration loop, YAML-based roles, git worktree isolation, and a React three-panel GUI.

Read `docs/WYVERN_PRODUCT_DESIGN.md` for the full product spec.

## Tech Decisions

- **CLI tools:** Claude CLI + Gemini CLI (both from day one)
- **Styling:** Tailwind CSS
- **State management:** Zustand
- **Scope:** Core functionality only (no distribution/packaging polish)

## Build Order (7 Steps)

| Step | Name | Key Deliverables |
|------|------|------------------|
| 1 | Foundation: Types + Config/Role Loader | `types.ts`, `config-loader.ts` |
| 2 | Artifact Manager + Pipeline State | `artifact-manager.ts`, `pipeline-manager.ts`, `utils.ts` |
| 3 | Agent Spawner + Orchestration Loop | `output-parser.ts`, `agent-spawner.ts`, `prompt-builder.ts`, `orchestrator.ts` |
| 4 | Git Integration | `git-manager.ts`, orchestrator updates |
| 5 | IPC Bridge (Preload + Main Handlers) | `preload.ts`, `ipc-handlers.ts`, `index.ts` rewrites |
| 6 | React GUI (Three-Panel Layout) | App, components, stores, hooks |
| 7 | Integration Wiring + Project Selection | `project-manager.ts`, `ProjectSelector.tsx`, end-to-end |

Each step is self-contained. An agent reads its step file, executes it, and the next agent picks up the result.

## Dependency Chain

```
Step 1 → Step 2 → Step 3 → Step 4 → Step 5 → Step 6 → Step 7
types    artifacts  spawner   git      IPC      GUI      glue
```

## Final File Map

```
src/
├── types.ts                          # Step 1
├── global.d.ts                       # Step 5
├── index.ts                          # Step 5 (rewrite)
├── preload.ts                        # Step 5 (rewrite)
├── index.html                        # Step 6 (modify)
├── index.css                         # Step 6 (replace)
├── renderer.ts                       # Step 6 (replace)
├── main/
│   ├── config-loader.ts             # Step 1
│   ├── utils.ts                     # Step 2
│   ├── artifact-manager.ts          # Step 2
│   ├── pipeline-manager.ts          # Step 2
│   ├── output-parser.ts            # Step 3
│   ├── agent-spawner.ts            # Step 3
│   ├── prompt-builder.ts           # Step 3
│   ├── orchestrator.ts             # Step 3 (modified in 4, 7)
│   ├── git-manager.ts              # Step 4
│   ├── ipc-handlers.ts             # Step 5 (modified in 7)
│   └── project-manager.ts          # Step 7
└── renderer/
    ├── App.tsx                      # Step 6 (modified in 7)
    ├── stores/
    │   ├── pipeline-store.ts        # Step 6
    │   └── chat-store.ts           # Step 6
    ├── hooks/
    │   └── useIpcListeners.ts      # Step 6
    └── components/
        ├── PipelineTree.tsx         # Step 6
        ├── ChatPanel.tsx            # Step 6 (modified in 7)
        ├── DetailPanel.tsx          # Step 6
        └── ProjectSelector.tsx      # Step 7
```
