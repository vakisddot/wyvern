# Wyvern

**AI Agent Orchestrator — Product Design Document**

---

## What Is Wyvern

Wyvern lets you be the CEO of a virtual software company. You give a directive in plain language, and Wyvern coordinates a team of AI agents to research, plan, and execute it. You define the roles, the agents decide the workflow.

## Core Architecture

Wyvern is an Electron desktop app. The main process (Node.js/TypeScript) is the orchestrator — it spawns CLI agents via `child_process`, parses their structured output, and executes their commands. The renderer process (React/TypeScript) is the GUI. One language, one runtime, no bridges.

### The Loop

All of Wyvern's orchestration logic is a single recursive loop:

```
loop:
  1. Invoke agent (spawn CLI process with role prompt + input artifacts)
  2. Stream and parse structured output for commands
  3. Execute commands:
     SPAWN role, input     → recurse: invoke another agent, collect result
     CHECKPOINT message    → pause, show CEO in GUI, wait for input
     DONE output           → return result to parent agent
  4. Feed results back to the invoking agent (re-invoke with updated context)
  5. Repeat until DONE bubbles up to the top
```

This loop is recursive. If the entry point agent spawns a lead, and the lead spawns 3 engineers, Wyvern follows the same pattern at every level. The agent tree grows organically — a trivial task might involve one agent, a complex feature might involve a dozen.

### Agents Are Stateless

No agent runs persistently. Wyvern invokes an agent, gets a response, and the process exits. When Wyvern needs that agent again (e.g., the PM after research completes), it re-invokes with updated context. An agent's "memory" is the artifact files on disk.

## Roles

Every role is a YAML file in `.wyvern/roles/`. There are no built-in roles. You create whatever your project needs — a product manager, a graphics designer, a security auditor, anything.

```yaml
# .wyvern/roles/backend-lead.yaml
name: Backend Lead
description: Senior architect who designs systems and delegates implementation
model:
  provider: claude              # any CLI tool: claude, gemini, ollama, etc.
  variant: opus-4-6
can_spawn: [backend-engineer, database-specialist]
max_depth: 1                    # can spawn, but its children can't spawn further
auto_approve: false             # CEO sees this agent's permission requests in GUI
system_prompt: |
  You are a senior backend architect. You receive requirements,
  design the technical approach, and decompose work into tasks.
  Output SPAWN commands for each task you need an engineer to do.
```

```yaml
# .wyvern/roles/backend-engineer.yaml
name: Backend Engineer
description: Implements scoped coding tasks with tests
model:
  provider: claude
  variant: sonnet-4-5
can_spawn: []                   # leaf node — does work, doesn't delegate
max_depth: 0
auto_approve: true              # runs freely in sandboxed worktree
repo: backend                   # which repo this role works in
system_prompt: |
  You are a backend engineer. You receive a task brief and implement it.
  Write code, write tests, produce a completion report.
```

On startup, Wyvern scans `.wyvern/roles/`, validates that spawn references exist, checks for circular chains, and verifies CLI tools are installed. One role must be marked `entry_point: true` — this is the agent the CEO talks to.

The entry point agent receives the list of all available roles and their descriptions as part of its context, so it dynamically decides who to involve for any given directive.

## Multi-Provider Support

Agents can use any CLI-based LLM tool (`claude`, `gemini`, `ollama`, etc.). Wyvern doesn't care what model powers an agent — it spawns a process and collects output. Swapping a role from Claude to Gemini is a one-line YAML change. Each CLI tool's own config (`CLAUDE.md`, `GEMINI.md`, etc.) is picked up automatically from the repo.

## Multi-Repo Projects

Projects can span multiple repositories. Define them in `wyvern.yaml`:

```yaml
repos:
  backend: ~/projects/homeswipe-api
  frontend: ~/projects/homeswipe-web
```

Each role specifies which repo it works in via the `repo` field. When Wyvern spawns that agent, it sets the working directory to a worktree of the correct repo. Artifacts that bridge repos (like migration guides) live in the pipeline directory, not in either repo.

Each repo keeps its own `CLAUDE.md` / `GEMINI.md` with project-specific knowledge and conventions. The role's system prompt defines the *job*, the repo's config defines the *codebase* — they stack naturally.

## Artifact System

Agents communicate through files. Each agent reads input artifacts and produces output artifacts. No shared memory, no message queues.

```
.wyvern/
├── wyvern.yaml
├── roles/
│   └── *.yaml
└── pipelines/
    └── {pipeline-id}/
        ├── directive.md
        ├── pipeline-state.json
        └── {role-name}/
            ├── input/
            ├── output/
            └── tasks/
                ├── task-1-brief.md
                ├── task-1-completion.md
                └── ...
```

## Code Integration

Agents don't write directly into your repos. Wyvern manages git:

1. Creates a feature branch for the pipeline: `wyvern/{pipeline-id}`
2. Each engineer works in an isolated git worktree of their assigned repo
3. Completed work is committed to task branches
4. After lead review, task branches merge into the feature branch
5. CEO reviews and merges the final feature branch into main

If parallel tasks create merge conflicts, Wyvern detects this and re-invokes the lead to resolve.

## Spawning Safety

Recursive spawning is capped by `max_depth` per role. Typical setup:

| Role type    | max_depth | Behavior                              |
|--------------|-----------|---------------------------------------|
| Entry point  | 2         | Spawns leads who spawn engineers      |
| Leads        | 1         | Spawns engineers only                 |
| Engineers    | 0         | Leaf node — works, never delegates    |

If an engineer thinks its task is too big, it reports back to the lead rather than spawning sub-agents.

## Permissions & Approval

CLI agents (Claude Code, Gemini CLI) ask for permissions before certain actions. Wyvern routes these based on the role's `auto_approve` setting:

- **`auto_approve: false`** — permission requests appear in the GUI chat panel. CEO approves from one place. Used for leads and architects making important decisions.
- **`auto_approve: true`** — agent runs with auto-accept flags, sandboxed to its worktree. Used for engineers doing scoped implementation work.

## GUI

Wyvern is a desktop app (Electron) with three panels:

- **Pipeline tree** — live visualization of the agent hierarchy. Nodes appear as agents are spawned. Color-coded: green (done), yellow (running), red (failed), blue (waiting on CEO). Click any node to inspect artifacts, logs, and cost.
- **Chat panel** — the CEO's interface. Checkpoints, permission requests, and status updates appear here. You type directives and approvals here.
- **Detail panel** — shows the selected agent's input/output artifacts, streaming logs, and token usage.

System notifications alert you when a checkpoint needs attention.

## Config

```yaml
# wyvern.yaml
project:
  name: "HomeSwipe"

repos:
  backend: ~/projects/homeswipe-api
  frontend: ~/projects/homeswipe-web

execution:
  max_parallel_agents: 6
  timeout_per_agent_minutes: 30

cost:
  warn_threshold_usd: 5.00
  hard_limit_usd: 20.00
```

## Tech Stack

| Component        | Technology                                      |
|------------------|-------------------------------------------------|
| App shell        | Electron                                        |
| Language         | TypeScript (everywhere — main + renderer)       |
| UI               | React                                           |
| Agent spawning   | Node.js `child_process.spawn`                   |
| Agent backends   | CLI tools (claude, gemini, ollama, etc.)         |
| Communication    | File system artifacts + structured CLI output    |
| Code management  | Git branches + worktrees                         |
| Config           | YAML                                             |
| State            | JSON files (pipeline-state.json)                 |

---

*Wyvern — you lead, agents execute.*
