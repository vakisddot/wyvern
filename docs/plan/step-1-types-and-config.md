# Step 1: Foundation — Types, Config Loader, Role Loader

## Goal

Establish all shared TypeScript types and build the config/role YAML loading system. This is the foundation every other module imports from.

## Prerequisites

Read `docs/WYVERN_PRODUCT_DESIGN.md` to understand the product.

## Dependencies to Install

```bash
npm install js-yaml
npm install -D @types/js-yaml
```

## Files to Create

### `src/types.ts`

All shared TypeScript interfaces and types for the entire app. Everything else imports from here.

```typescript
// --- Role definition (parsed from .wyvern/roles/*.yaml) ---
interface RoleModel {
  provider: string;   // 'claude' | 'gemini' | 'ollama' | etc.
  variant: string;    // 'opus-4-6' | 'sonnet-4-5' | etc.
}

interface RoleDefinition {
  name: string;
  description: string;
  model: RoleModel;
  can_spawn: string[];       // role slugs this role may spawn
  max_depth: number;
  auto_approve: boolean;
  system_prompt: string;
  repo?: string;             // key into wyvern.yaml repos map
  entry_point?: boolean;
}

// --- Project config (wyvern.yaml) ---
interface WyvernConfig {
  project: { name: string };
  repos: Record<string, string>;   // alias -> absolute path
  execution: {
    max_parallel_agents: number;
    timeout_per_agent_minutes: number;
  };
  cost: {
    warn_threshold_usd: number;
    hard_limit_usd: number;
  };
}

// --- Agent runtime state ---
type AgentStatus = 'pending' | 'running' | 'done' | 'failed' | 'waiting_ceo';

interface AgentNode {
  id: string;
  role: string;              // role slug (filename without .yaml)
  parentId: string | null;
  status: AgentStatus;
  depth: number;
  pipelineId: string;
  inputArtifacts: string[];  // file paths
  outputArtifacts: string[];
  spawnedChildren: string[]; // child agent IDs
  startedAt: number;
  finishedAt?: number;
  costUsd?: number;
}

// --- Pipeline state ---
type PipelineStatus = 'active' | 'completed' | 'failed' | 'paused';

interface PipelineState {
  id: string;
  directive: string;
  status: PipelineStatus;
  entryAgentId: string;
  agents: Record<string, AgentNode>;
  createdAt: number;
  updatedAt: number;
  totalCostUsd: number;
  featureBranch: string;     // 'wyvern/{pipeline-id}'
}

// --- Parsed structured commands from agent output ---
type AgentCommand =
  | { type: 'SPAWN'; role: string; input: string }
  | { type: 'CHECKPOINT'; message: string }
  | { type: 'DONE'; output: string };

// --- IPC channel names (used in preload + main) ---
// Single source of truth for all channel strings
const IPC_CHANNELS = {
  // Renderer -> Main (request/response)
  START_PIPELINE: 'wyvern:start-pipeline',
  APPROVE_CHECKPOINT: 'wyvern:approve-checkpoint',
  REJECT_CHECKPOINT: 'wyvern:reject-checkpoint',
  GET_PIPELINES: 'wyvern:get-pipelines',
  GET_PIPELINE_STATE: 'wyvern:get-pipeline-state',
  GET_ARTIFACT: 'wyvern:get-artifact',
  OPEN_PROJECT: 'wyvern:open-project',
  CHECK_CLI_TOOLS: 'wyvern:check-cli-tools',
  // Main -> Renderer (push events)
  PIPELINE_UPDATE: 'wyvern:pipeline-update',
  AGENT_OUTPUT: 'wyvern:agent-output',
  CHECKPOINT_REQUEST: 'wyvern:checkpoint-request',
} as const;

// --- IPC API shape exposed via contextBridge ---
interface WyvernAPI {
  startPipeline: (directive: string, projectPath: string) => Promise<string>;
  approveCheckpoint: (pipelineId: string, agentId: string, response: string) => void;
  rejectCheckpoint: (pipelineId: string, agentId: string, reason: string) => void;
  getPipelines: () => Promise<PipelineState[]>;
  getPipelineState: (id: string) => Promise<PipelineState>;
  getArtifact: (filePath: string) => Promise<string>;
  openProject: () => Promise<{ config: WyvernConfig; roles: Record<string, RoleDefinition> } | null>;
  checkCliTools: () => Promise<{ missing: string[] }>;
  onPipelineUpdate: (cb: (state: PipelineState) => void) => () => void;
  onAgentOutput: (cb: (data: { pipelineId: string; agentId: string; chunk: string }) => void) => () => void;
  onCheckpointRequest: (cb: (data: { pipelineId: string; agentId: string; message: string }) => void) => () => void;
}
```

Export everything. All types and the `IPC_CHANNELS` const.

### `src/main/config-loader.ts`

Three exported functions:

**`loadConfig(projectPath: string): WyvernConfig`**
- Reads `{projectPath}/wyvern.yaml` with `fs.readFileSync`
- Parses with `js-yaml`
- Validates required fields exist: `project.name`, `repos`, `execution`, `cost`
- Resolves `~` in repo paths to absolute paths using `os.homedir()`
- Returns typed `WyvernConfig`
- Throws descriptive errors on missing/invalid fields

**`loadRoles(projectPath: string): Record<string, RoleDefinition>`**
- Scans `{projectPath}/.wyvern/roles/*.yaml` using `fs.readdirSync`
- Parses each YAML file
- Builds a map keyed by slug (filename without `.yaml` extension)
- Validates each role has required fields: name, description, model (with provider + variant), can_spawn (array), max_depth (number), auto_approve (boolean), system_prompt (string)
- Returns the map

**`validateRoles(roles: Record<string, RoleDefinition>): void`**
- Checks exactly one role has `entry_point: true` — throws if zero or more than one
- Checks all `can_spawn` references point to existing role slugs — throws with the bad reference
- Checks for circular spawn chains via DFS — throws if cycle found
- Checks consistency: roles with non-empty `can_spawn` should have `max_depth >= 1`

## Verification

After building, verify by:

1. `npm run lint` passes
2. Create a temp test structure:
   ```
   test-project/
   ├── wyvern.yaml
   └── .wyvern/
       └── roles/
           ├── pm.yaml          (entry_point: true, can_spawn: [engineer])
           └── engineer.yaml    (can_spawn: [], max_depth: 0)
   ```
3. Import and call `loadConfig()`, `loadRoles()`, `validateRoles()` — should succeed
4. Test circular detection: create roles A → B → A, confirm `validateRoles` throws
5. Test missing entry point: remove `entry_point` from all roles, confirm it throws
