# Wyvern

AI Agent Orchestrator - a desktop app that lets you coordinate teams of AI agents to execute complex tasks.

You give a directive in plain language. Wyvern breaks it down, spawns AI agents (Claude, Gemini, or any CLI LLM), and orchestrates them in a recursive tree. You stay in the loop as CEO — approving plans, reviewing checkpoints, and watching agents work in real time.

## Prerequisites

- **Node.js** 18+
- **npm**
- At least one AI CLI tool installed and on your PATH:
  - [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude`)
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) (`gemini`)
  - Or any LLM CLI that reads from stdin and writes to stdout

## Install & Run

```bash
git clone <repo-url>
cd wyvern
npm install
npm run start
```

## Project Setup

A Wyvern project is any directory with a `wyvern.yaml` config and a `.wyvern/roles/` folder containing role definitions.

```
my-project/
├── wyvern.yaml
└── .wyvern/
    └── roles/
        ├── pm.yaml
        ├── backend.yaml
        └── frontend.yaml
```

### wyvern.yaml

The main config file. Lives at the project root.

```yaml
project:
  name: "My App"

# Map of repo aliases to local paths (tilde-expanded).
# Leave empty if agents work in the project directory itself.
repos:
  api: ~/code/my-api
  web: ~/code/my-web

# Optional. Omit this section to disable worktrees.
git:
  use_worktrees: true

execution:
  max_parallel_agents: 4
  timeout_per_agent_minutes: 10

cost:
  warn_threshold_usd: 5.00
  hard_limit_usd: 20.00
```

| Field | Required | Description |
|-------|----------|-------------|
| `project.name` | yes | Display name shown in the title bar |
| `repos` | yes | Alias-to-path map. Use `{}` if no repos needed |
| `git.use_worktrees` | no | Give each agent an isolated git worktree. Default: `true` |
| `execution.max_parallel_agents` | yes | Max agents running concurrently |
| `execution.timeout_per_agent_minutes` | yes | Kill an agent after this many minutes |
| `cost.warn_threshold_usd` | yes | Show a warning when pipeline cost exceeds this |
| `cost.hard_limit_usd` | yes | Abort the pipeline when cost exceeds this |

### Role Definitions

Each `.yaml` file in `.wyvern/roles/` defines one agent role. The filename (without extension) becomes the role's **slug** — used in spawn commands and config references.

```yaml
# .wyvern/roles/pm.yaml
name: Project Manager
description: Breaks down directives and coordinates the team
model:
  provider: claude
  variant: sonnet-4-5
can_spawn: [backend, frontend]
max_depth: 2
auto_approve: false
entry_point: true
system_prompt: |
  You are a project manager. Analyze the directive, break it into
  tasks, and spawn the appropriate agents. Review their output
  before marking your work as done.
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Display name in the GUI |
| `description` | yes | One-line description (shown to parent agents) |
| `model.provider` | yes | CLI command name: `claude`, `gemini`, etc. |
| `model.variant` | yes | Model variant hint (e.g. `sonnet-4-5`, `haiku-4-5`) |
| `can_spawn` | yes | List of role slugs this agent can delegate to. `[]` for leaf agents |
| `max_depth` | yes | Max spawning recursion depth. Must be `>= 1` if `can_spawn` is non-empty, `0` for leaf agents |
| `auto_approve` | yes | If `true`, agent runs with `--dangerously-skip-permissions` (Claude) |
| `entry_point` | no | Exactly one role must set this to `true`. This is the first agent spawned |
| `repo` | no | Repo alias from `wyvern.yaml` `repos` map. Agent's working directory |
| `system_prompt` | yes | Instructions given to the agent. Describe its role, goals, and constraints |

**Validation rules:**
- Exactly one role must have `entry_point: true`
- Every slug in `can_spawn` must correspond to an existing role file
- No circular spawn chains (A spawns B spawns A)
- If `can_spawn` is non-empty, `max_depth` must be >= 1

## How Agents Communicate

Agents are stateless CLI processes. They don't share memory — they communicate through file artifacts and three structured commands in their stdout:

### DONE — Complete your task

```
[WYVERN:DONE] output=results.md
```

Write your output to a file, then emit this command. Every agent must emit exactly one DONE. The output file bubbles up to the parent agent.

### SPAWN — Delegate to a child agent

```
[WYVERN:SPAWN] role=backend input=backend-task.md
```

Write the task description to a file, then emit SPAWN. Wyvern creates a child agent with the given role and passes it the input file. The parent is re-invoked with the child's results in its context.

### CHECKPOINT — Ask the CEO

```
[WYVERN:CHECKPOINT] message="Should we use PostgreSQL or SQLite?"
```

Pauses the agent and shows the message in the GUI chat. The CEO (you) can approve, reject, or provide instructions. The agent is re-invoked with your response.

## Writing System Prompts

Wyvern automatically injects instructions about SPAWN, CHECKPOINT, and DONE into every agent's prompt. Your `system_prompt` should focus on:

1. **What the agent does** — its role and responsibilities
2. **How it should approach work** — coding style, review standards, etc.
3. **When to checkpoint** — what decisions need CEO approval

You don't need to explain the Wyvern command format — that's handled automatically.

### Example: Two-tier setup

**pm.yaml** — Manager that delegates:
```yaml
name: Project Manager
description: Coordinates the team
model:
  provider: claude
  variant: sonnet-4-5
can_spawn: [worker]
max_depth: 1
auto_approve: false
entry_point: true
system_prompt: |
  You are a project manager. Break the directive into tasks.
  Spawn a worker for each task. Review their results and
  compile a final summary. Checkpoint before starting if
  the directive is ambiguous.
```

**worker.yaml** — Leaf agent that does the work:
```yaml
name: Worker
description: Implements individual tasks
model:
  provider: claude
  variant: haiku-4-5
can_spawn: []
max_depth: 0
auto_approve: true
system_prompt: |
  You are a worker. Complete the assigned task and write
  your results to an output file. Be thorough but concise.
```

### Example: Multi-repo with specialization

```yaml
# .wyvern/roles/architect.yaml
name: Architect
description: Designs system architecture and coordinates implementation
model:
  provider: claude
  variant: opus-4-6
can_spawn: [backend-dev, frontend-dev]
max_depth: 2
auto_approve: false
entry_point: true
system_prompt: |
  You are the architect. Design the solution, then spawn
  backend-dev and frontend-dev to implement it. Review
  their code before finalizing.
```

```yaml
# .wyvern/roles/backend-dev.yaml
name: Backend Developer
description: Implements API endpoints and server logic
model:
  provider: claude
  variant: sonnet-4-5
can_spawn: []
max_depth: 0
auto_approve: true
repo: api
system_prompt: |
  You are a backend developer working in a Node.js API.
  Implement the task described in your input. Write clean,
  tested code. Output a summary of changes.
```

```yaml
# .wyvern/roles/frontend-dev.yaml
name: Frontend Developer
description: Implements UI components and pages
model:
  provider: claude
  variant: sonnet-4-5
can_spawn: []
max_depth: 0
auto_approve: true
repo: web
system_prompt: |
  You are a frontend developer working in a React app.
  Implement the UI described in your input. Follow existing
  component patterns. Output a summary of changes.
```

## Using the App

1. **Start Wyvern** — `npm run start`
2. **Open a project** — Click `[Change Project]` and select your project directory
3. **Check CLI tools** — Wyvern verifies all providers referenced by roles are installed
4. **Enter a directive** — Type your goal in the chat panel and press Enter
5. **Monitor progress** — The Pipeline Tree shows the agent hierarchy. Click an agent to see its logs, artifacts, and config in the Detail Panel
6. **Respond to checkpoints** — When an agent asks a question, it appears in the chat. Approve, reject, or type a response
7. **Review results** — When the pipeline completes, check the output artifacts in the Detail Panel

## Git Worktrees

When `git.use_worktrees` is enabled and a role has a `repo` set, each agent gets its own git worktree — an isolated copy of the repo on a dedicated branch. This means:

- Agents can make changes without stepping on each other
- Each agent's work is on a branch named `wyvern/{pipeline-id}/{role}-{agent-id}`
- When an agent finishes, its branch is merged back to the pipeline's feature branch
- Merge conflicts pause the pipeline for CEO review

Disable worktrees by setting `git.use_worktrees: false` or by omitting the `git` section and not assigning `repo` to roles.

## Cost Tracking

Wyvern parses cost information from agent CLI output (e.g. the `$X.XX` line Claude prints). Costs accumulate across all agents in a pipeline.

- **Warn threshold** — A warning appears in the chat when crossed
- **Hard limit** — The pipeline aborts immediately when crossed

## Troubleshooting

**"No output yet" in logs**
- Verify the CLI tool works manually: `echo "hello" | claude -p`
- Check that the provider is on your PATH (Wyvern runs `where`/`which` to check)
- Look at the chat panel for `[stderr]` messages

**Pipeline stuck in Running**
- Check `execution.timeout_per_agent_minutes` — agents are killed after this
- An agent may be waiting for a checkpoint response in the chat panel

**Agent exits without DONE**
- The agent's system prompt should emphasize emitting `[WYVERN:DONE]`
- Check the agent's logs for errors or unexpected output
