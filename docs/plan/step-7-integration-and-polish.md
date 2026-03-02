# Step 7: Integration Wiring + Project Selection + End-to-End

## Goal

Connect everything into a working end-to-end flow. Add project selection (Wyvern needs to know which directory to work in). Wire up remaining orchestrator features. Make the full loop work.

## Prerequisites

Steps 1-6 must be complete.

## Files to Create

### `src/main/project-manager.ts`

Manages the current project context:

**`openProject(dirPath: string): { config: WyvernConfig; roles: Record<string, RoleDefinition> }`**
- Validates `dirPath` contains `wyvern.yaml`
- Validates `dirPath` contains `.wyvern/roles/` with at least one role
- Calls `loadConfig()` and `loadRoles()` from config-loader
- Calls `validateRoles()` — throws if invalid
- Returns config + roles

**`checkCliTools(roles: Record<string, RoleDefinition>): { missing: string[] }`**
- Collects unique providers from all roles (e.g., `claude`, `gemini`)
- For each provider, runs `where <provider>` (Windows) or `which <provider>` (Unix) via `child_process.execSync`
- Returns list of providers that aren't installed
- Handle cross-platform: use `process.platform === 'win32'` to pick `where` vs `which`

### `src/renderer/components/ProjectSelector.tsx`

Overlay/dialog shown on launch when no project is loaded:

- Centered card on dark backdrop
- App name/logo at top: "Wyvern"
- Brief description: "AI Agent Orchestrator"
- "Open Project" button that calls `window.wyvern.openProject()`
  - This triggers a native Electron file dialog (directory picker) in the main process
  - On success: receives config + roles, stores in a Zustand store or local state
  - On failure: shows error message (e.g., "No wyvern.yaml found in selected directory")
- After project opens, run CLI tool check and show warnings for missing tools
- Transition to main three-panel layout once project is loaded

## Files to Modify

### `src/types.ts`

Add `OPEN_PROJECT` and `CHECK_CLI_TOOLS` to `IPC_CHANNELS` if not already there (they should be from Step 1 if the types were set up correctly, but verify).

### `src/preload.ts`

Add `openProject` and `checkCliTools` to the exposed API:
- `openProject` → `ipcRenderer.invoke(IPC_CHANNELS.OPEN_PROJECT)`
- `checkCliTools` → `ipcRenderer.invoke(IPC_CHANNELS.CHECK_CLI_TOOLS)`

### `src/main/ipc-handlers.ts`

Add handlers:

**`OPEN_PROJECT`**:
- Show native directory dialog via `dialog.showOpenDialog({ properties: ['openDirectory'] })`
- If user cancels, return null
- Call `projectManager.openProject(selectedPath)`
- On success: instantiate/reinitialize the Orchestrator with the loaded config + roles
- Store the project path for other handlers to use
- Return `{ config, roles }`

**`CHECK_CLI_TOOLS`**:
- Call `projectManager.checkCliTools(roles)`
- Return `{ missing: [...] }`

Update existing handlers (`START_PIPELINE`, `GET_PIPELINES`, etc.) to check that a project is loaded and return an error if not.

### `src/main/orchestrator.ts`

Wire up remaining features:

1. **Agent re-invocation after SPAWN**: When a child agent completes, the parent agent process has already exited (agents are stateless). To "continue" the parent:
   - Accumulate all context so far (original input + all output + child's result)
   - Re-spawn the parent agent with the accumulated context
   - Continue parsing output from the new invocation
   - This is the core of the "stateless agent" pattern from the design doc

2. **Agent timeout**: Use `config.execution.timeout_per_agent_minutes`:
   - Set a `setTimeout` per agent spawn
   - If timeout fires, `kill()` the agent process and mark it as `failed`
   - Clear the timeout when agent completes normally

3. **Parallel spawns**: If an agent emits multiple SPAWN commands before DONE:
   - Collect all SPAWN commands
   - Run them concurrently (up to `config.execution.max_parallel_agents`) using `Promise.all` with a simple semaphore/counter
   - After all children complete, re-invoke the parent with all results

4. **Cost tracking**:
   - After each agent completes, try to extract token/cost info from its output (format depends on CLI tool)
   - Update `AgentNode.costUsd`
   - Accumulate in `PipelineState.totalCostUsd`
   - If `totalCostUsd >= config.cost.warn_threshold_usd`, emit a warning event
   - If `totalCostUsd >= config.cost.hard_limit_usd`, stop the pipeline

### `src/renderer/App.tsx`

Add project selection flow:

- Track `projectLoaded` state (or use a Zustand store)
- On mount: show `ProjectSelector` overlay
- After project is selected and loaded: hide overlay, show three-panel layout
- Add a top bar above the three panels:
  - Project name (from config)
  - "Change Project" button
  - Pipeline status indicator

### `src/renderer/components/ChatPanel.tsx`

Polish:

- Show a welcome message on first load: "Type a directive to get started. Wyvern will coordinate your AI team to execute it."
- When a pipeline completes, show a summary message (total agents, total cost, time elapsed)
- Show cost warnings when thresholds are approached
- Better formatting for checkpoint messages with clear approve/reject UI

### `src/index.ts`

Update main process initialization:
- The orchestrator is now lazily created when a project is opened (via `OPEN_PROJECT` handler)
- Keep the IPC handler registration at startup, but handlers that need a project should check for it

## End-to-End Test Setup

Create a test project directory for verification:

```
test-project/
├── wyvern.yaml
└── .wyvern/
    └── roles/
        ├── pm.yaml
        └── worker.yaml
```

**`wyvern.yaml`:**
```yaml
project:
  name: "Test Project"
repos: {}
execution:
  max_parallel_agents: 4
  timeout_per_agent_minutes: 5
cost:
  warn_threshold_usd: 1.00
  hard_limit_usd: 5.00
```

**`pm.yaml`:**
```yaml
name: Project Manager
description: Receives directives and coordinates work
model:
  provider: claude
  variant: sonnet-4-5
can_spawn: [worker]
max_depth: 1
auto_approve: false
entry_point: true
system_prompt: |
  You are a project manager. Break down the directive into tasks
  and spawn workers for each one.
```

**`worker.yaml`:**
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
  You are a worker. Complete the assigned task and report results.
```

## Full Verification Checklist

1. `npm run lint` passes
2. `npm start` → project selector appears (centered, dark theme)
3. Click "Open Project" → native directory picker opens
4. Select the test project → config loads, roles validated
5. CLI tool check runs → shows warning if `claude`/`gemini` not installed
6. Three-panel layout appears with project name in top bar
7. Chat panel shows welcome message
8. Type a directive → pipeline starts
9. Pipeline tree shows entry agent node (yellow = running)
10. Agent output streams in detail panel (click the agent node first)
11. If agent emits SPAWN → child node appears in tree
12. If agent emits CHECKPOINT → message appears in chat with approve/reject buttons
13. Click Approve → agent continues
14. When all agents DONE → all nodes green, completion message in chat
15. Artifacts browsable in detail panel
