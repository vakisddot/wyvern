# Step 2: Artifact Manager + Pipeline State Manager

## Goal

Build the file-based artifact system and pipeline state persistence. This is the "filesystem as database" layer that the orchestrator depends on.

## Prerequisites

Step 1 must be complete. You'll import types from `src/types.ts`.

## Files to Create

### `src/main/utils.ts`

Small shared utilities:

- `generateId(): string` — returns a short random ID. Use `crypto.randomUUID().slice(0, 8)`.
- `timestamp(): number` — returns `Date.now()`.

### `src/main/artifact-manager.ts`

Manages the `.wyvern/pipelines/{id}/` directory structure. All operations use `fs` sync methods (simple, called from async orchestrator context).

**`initPipeline(projectPath: string, pipelineId: string, directive: string): void`**
- Creates directory tree: `.wyvern/pipelines/{pipelineId}/`
- Writes `directive.md` with the directive text
- Writes initial empty `pipeline-state.json`

**`ensureAgentDirs(projectPath: string, pipelineId: string, roleSlug: string): { inputDir: string; outputDir: string; tasksDir: string }`**
- Creates `{roleSlug}/input/`, `{roleSlug}/output/`, `{roleSlug}/tasks/` if they don't exist
- Returns the three directory paths

**`writeArtifact(dir: string, filename: string, content: string): string`**
- Writes content to `{dir}/{filename}`
- Returns full path

**`readArtifact(filePath: string): string`**
- Reads and returns file content as string

**`listArtifacts(dir: string): string[]`**
- Returns array of filenames in the directory
- Returns empty array if directory doesn't exist

The directory structure produced should match the design doc:

```
.wyvern/
└── pipelines/
    └── {pipeline-id}/
        ├── directive.md
        ├── pipeline-state.json
        └── {role-name}/
            ├── input/
            ├── output/
            └── tasks/
```

### `src/main/pipeline-manager.ts`

CRUD operations on pipeline state. Extends `EventEmitter` so it can notify listeners (IPC handlers later) of state changes.

**`createPipeline(projectPath: string, directive: string): PipelineState`**
- Generates a pipeline ID via `generateId()`
- Calls `artifactManager.initPipeline()`
- Creates initial `PipelineState` object (status: 'active', empty agents map, timestamps, featureBranch: `wyvern/{id}`)
- Saves to disk via `savePipeline()`
- Returns the state

**`loadPipeline(projectPath: string, pipelineId: string): PipelineState`**
- Reads `.wyvern/pipelines/{pipelineId}/pipeline-state.json`
- Parses and returns

**`savePipeline(projectPath: string, state: PipelineState): void`**
- Writes `pipeline-state.json` to the pipeline directory
- Updates `state.updatedAt` timestamp
- Emits `'pipeline-update'` event with the state

**`addAgent(state: PipelineState, agent: AgentNode): PipelineState`**
- Returns a new PipelineState with the agent added to `state.agents`
- Immutable — does not mutate the input

**`updateAgent(state: PipelineState, agentId: string, updates: Partial<AgentNode>): PipelineState`**
- Returns a new PipelineState with the specified agent's fields merged
- Immutable

**`listPipelines(projectPath: string): PipelineState[]`**
- Reads `.wyvern/pipelines/` directory
- For each subdirectory, loads its `pipeline-state.json`
- Returns array of all pipeline states
- Handles missing/corrupt files gracefully (skip them, log warning)

## Verification

1. `npm run lint` passes
2. Write a quick test script or verify manually:
   - Call `createPipeline()` → check directory structure on disk
   - Call `addAgent()` and `savePipeline()` → check `pipeline-state.json` has the agent
   - Call `updateAgent()` → verify immutability (original state unchanged)
   - Call `listPipelines()` → returns the pipeline you created
   - Call `readArtifact()` on `directive.md` → returns the directive text
