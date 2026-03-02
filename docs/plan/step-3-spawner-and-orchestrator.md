# Step 3: Agent Spawner + Output Parser + Orchestration Loop

## Goal

Build the core engine — spawning CLI processes, parsing their structured output, and the recursive orchestration loop. This is the heart of Wyvern.

## Prerequisites

Steps 1-2 must be complete. You'll use types from `src/types.ts`, artifact manager from `src/main/artifact-manager.ts`, and pipeline manager from `src/main/pipeline-manager.ts`.

## Files to Create

### `src/main/output-parser.ts`

Parses `[WYVERN:*]` commands from agent output lines.

**`parseOutputLine(line: string): AgentCommand | null`**
- Regex match against `\[WYVERN:(SPAWN|CHECKPOINT|DONE)\]\s*(.*)`
- For SPAWN: parse `role=<slug> input=<filename>` from the remainder
- For CHECKPOINT: parse `message=<text>` (text may be quoted for multi-word)
- For DONE: parse `output=<filename>`
- Lines that don't match return `null` — they're plain agent output (streamed to GUI but not acted on)

Command formats agents will emit:
```
[WYVERN:SPAWN] role=backend-engineer input=task-brief.md
[WYVERN:CHECKPOINT] message=Need CEO approval for database schema
[WYVERN:DONE] output=completion-report.md
```

Keep the parser simple. Key-value pairs separated by spaces, values without spaces are bare, values with spaces are quoted.

### `src/main/agent-spawner.ts`

Spawns CLI agent processes.

**`buildCommand(role: RoleDefinition, prompt: string): { cmd: string; args: string[] }`**

Constructs CLI command based on `role.model.provider`:

- **`claude`**: `claude` with args `['-p', prompt, '--output-format', 'text']`. If `role.auto_approve` is true, add `'--dangerously-skip-permissions'`.
- **`gemini`**: `gemini` with args `['-p', prompt]`. Add appropriate auto-approve flags if available.
- For unknown providers, just use the provider name as the command with `['-p', prompt]` as a reasonable default.

**`spawnAgent(role: RoleDefinition, cwd: string, prompt: string): AgentProcess`**

```typescript
interface AgentProcess {
  pid: number;
  stdout: EventEmitter;    // emits 'line' events
  stderr: EventEmitter;    // emits 'line' events
  onExit: Promise<{ code: number | null }>;
  kill: () => void;
}
```

- Uses `child_process.spawn` with `{ cwd, shell: true }`
- Creates `readline.createInterface` on `child.stdout` and `child.stderr` for line-by-line emission
- Wraps exit in a promise
- Returns the `AgentProcess` object

### `src/main/prompt-builder.ts`

Constructs the full prompt for an agent invocation.

**`buildPrompt(role: RoleDefinition, allRoles: Record<string, RoleDefinition>, inputContent: string, pipelineContext: string): string`**

Combines these sections into one prompt string:

1. **Role system prompt** — the `system_prompt` from the role's YAML
2. **Structured output instructions** — tells the agent how to emit `[WYVERN:SPAWN]`, `[WYVERN:CHECKPOINT]`, `[WYVERN:DONE]` commands. Be explicit about the format. Tell the agent it MUST emit exactly one `[WYVERN:DONE]` when finished.
3. **Available roles** — if `can_spawn` is non-empty, list each spawnable role with its name and description so the agent knows who it can delegate to
4. **Pipeline context** — the directive, any prior results from other agents
5. **Input** — the actual input content/artifacts for this invocation

The structured output instruction block should be something like:

```
You are operating within the Wyvern orchestration system. You MUST use these commands to communicate:

To delegate work to another agent:
[WYVERN:SPAWN] role=<role-slug> input=<filename>
Write the input file content before spawning.

To pause and ask the CEO for approval or input:
[WYVERN:CHECKPOINT] message=<your message to the CEO>

When you are completely done with your task:
[WYVERN:DONE] output=<filename>
Write your output/results to the file before emitting DONE.

You MUST emit exactly one [WYVERN:DONE] command when your work is complete.
```

### `src/main/orchestrator.ts`

The recursive orchestration loop. Extends `EventEmitter`.

```typescript
class Orchestrator extends EventEmitter {
  private checkpointResolvers = new Map<string, (response: string) => void>();

  constructor(
    private config: WyvernConfig,
    private roles: Record<string, RoleDefinition>,
    private projectPath: string,
    private pipelineManager: PipelineManager,
    private artifactManager: ArtifactManager,
  ) { super(); }

  async runPipeline(directive: string): Promise<PipelineState> { ... }

  private async invokeAgent(
    state: PipelineState,
    roleSlug: string,
    inputArtifacts: string[],
    parentId: string | null,
    depth: number,
  ): Promise<string> { ... }  // returns output artifact path

  resolveCheckpoint(agentId: string, response: string): void { ... }
  rejectCheckpoint(agentId: string, reason: string): void { ... }
}
```

**`runPipeline(directive: string)`**:
1. Create pipeline via `pipelineManager.createPipeline()`
2. Find the entry point role (the one with `entry_point: true`)
3. Write directive as an input artifact
4. Call `invokeAgent()` with the entry role, depth 0
5. When it returns, mark pipeline as completed
6. Return final pipeline state

**`invokeAgent(state, roleSlug, inputArtifacts, parentId, depth)`**:
1. Create `AgentNode` (status: `running`), add to state via `pipelineManager.addAgent()`
2. Ensure agent dirs via `artifactManager.ensureAgentDirs()`
3. Read input artifacts content
4. Build prompt via `prompt-builder.ts`
5. Spawn agent via `agent-spawner.ts` (cwd = project path, or repo worktree if git integration is wired)
6. Stream stdout line by line:
   - Pass each line through `output-parser.ts`
   - Emit `'agent-output'` event with the raw line (for GUI streaming)
   - If `null` (plain text): accumulate as context, continue
   - If `SPAWN`:
     a. Validate the role is in this agent's `can_spawn` list
     b. Validate `depth + 1 <= target role's max_depth` appropriately
     c. Recursively call `invokeAgent()` for the child
     d. After child completes, re-invoke the current agent with updated context (child's output appended)
   - If `CHECKPOINT`:
     a. Update agent status to `waiting_ceo`
     b. Emit `'checkpoint-request'` event
     c. Await response: `const response = await this.waitForCheckpointApproval(agentId)`
     d. Resume by re-invoking the agent with the CEO's response appended to context
   - If `DONE`:
     a. Read the output file the agent referenced
     b. Store as output artifact
     c. Update agent status to `done`
     d. Return the output artifact path
7. On process exit with non-zero code: mark agent as `failed`, throw or return error

**Checkpoint wait pattern:**

```typescript
private waitForCheckpointApproval(agentId: string): Promise<string> {
  return new Promise(resolve => {
    this.checkpointResolvers.set(agentId, resolve);
  });
}

resolveCheckpoint(agentId: string, response: string): void {
  const resolver = this.checkpointResolvers.get(agentId);
  if (resolver) {
    resolver(response);
    this.checkpointResolvers.delete(agentId);
  }
}
```

**Re-invocation pattern for SPAWN and CHECKPOINT:**
After a SPAWN child completes or a CHECKPOINT is approved, the current agent process has already exited. To "continue" the agent, re-invoke it with accumulated context:
- Original input + all output so far + child results (for SPAWN) or CEO response (for CHECKPOINT)
- This matches the design doc: "agents are stateless, re-invoked with updated context"

## Events Emitted

The orchestrator should emit these events (consumed by IPC handlers in Step 5):

- `'pipeline-update'` — `(state: PipelineState)` — whenever pipeline state changes
- `'agent-output'` — `(data: { pipelineId: string; agentId: string; chunk: string })` — each line of agent stdout
- `'checkpoint-request'` — `(data: { pipelineId: string; agentId: string; message: string })` — when agent hits checkpoint

## Verification

1. `npm run lint` passes
2. Create a mock CLI script (`test-mock-agent.sh` or `.js`) that outputs:
   ```
   Thinking about the task...
   [WYVERN:DONE] output=result.md
   ```
   And writes `result.md` with some content.
3. Test the output parser: feed it various lines, verify correct parsing of SPAWN/CHECKPOINT/DONE and null for plain text
4. Test a simple orchestration run: create a role that uses the mock script as its "provider", run `runPipeline()`, verify it completes with status `done`
5. Test SPAWN chaining: mock entry agent emits `[WYVERN:SPAWN] role=worker input=task.md`, mock worker emits `[WYVERN:DONE] output=result.md`. Verify both agents complete.
