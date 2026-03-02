# Step 4: Git Integration

## Goal

Build the git worktree manager and branch strategy for pipeline code isolation. Agents that write code do so in isolated worktrees, never directly in the user's repos.

## Prerequisites

Steps 1-3 must be complete. You'll integrate with the orchestrator from `src/main/orchestrator.ts`.

## Files to Create

### `src/main/git-manager.ts`

All git operations via `child_process.execSync` with `cwd` set to the appropriate repo path. Each method runs git commands and returns results.

**`createFeatureBranch(repoPath: string, pipelineId: string): string`**
- Creates branch `wyvern/{pipelineId}` from current HEAD
- Returns the branch name
- If branch already exists, just return it (idempotent)

**`createWorktree(repoPath: string, pipelineId: string, agentId: string, roleSlug: string): string`**
- Creates worktree at `{repoPath}/.wyvern-worktrees/{agentId}/`
- On new branch: `wyvern/{pipelineId}/{roleSlug}-{agentId}`
- Based off the feature branch `wyvern/{pipelineId}`
- Returns the worktree path

**`removeWorktree(repoPath: string, worktreePath: string): void`**
- Runs `git worktree remove {worktreePath} --force`
- Cleans up the branch if desired

**`mergeTaskBranch(repoPath: string, featureBranch: string, taskBranch: string): { success: boolean; conflict: boolean }`**
- Checks out the feature branch
- Runs `git merge --no-ff {taskBranch}`
- Detects conflicts from exit code
- Returns result object

**`listWorktrees(repoPath: string): string[]`**
- Runs `git worktree list --porcelain`
- Parses and returns worktree paths

**`cleanupPipeline(repoPath: string, pipelineId: string): void`**
- Lists all worktrees, finds ones matching this pipeline
- Removes each worktree
- Optionally cleans up task branches

## Files to Modify

### `src/main/orchestrator.ts`

Integrate `GitManager` into the orchestrator:

1. Accept `GitManager` as a constructor dependency
2. In `runPipeline()`: before starting, call `gitManager.createFeatureBranch()` for each repo referenced by roles in the pipeline
3. In `invokeAgent()`: if the role has a `repo` field:
   - Look up the repo path from `config.repos[role.repo]`
   - Call `gitManager.createWorktree()` to get an isolated working directory
   - Use the worktree path as `cwd` when spawning the agent process
   - After agent completes successfully, call `gitManager.mergeTaskBranch()` to merge work into the feature branch
   - Call `gitManager.removeWorktree()` to clean up
4. If merge returns `{ conflict: true }`, update pipeline state to reflect the conflict (this will be handled more fully in Step 7)

## Verification

1. `npm run lint` passes
2. Create a test git repo with some content:
   ```bash
   mkdir /tmp/test-repo && cd /tmp/test-repo && git init && echo "hello" > file.txt && git add . && git commit -m "init"
   ```
3. Test `createFeatureBranch()` — verify branch exists
4. Test `createWorktree()` — verify worktree directory exists, is on correct branch
5. Make a change in the worktree, commit it, test `mergeTaskBranch()` — verify change appears on feature branch
6. Test `removeWorktree()` — verify worktree directory is gone
7. Test conflict detection: create two worktrees, make conflicting changes to the same file, merge both — verify second merge returns `{ conflict: true }`
