import { execSync } from 'child_process';
import path from 'path';

const EXEC_OPTS = { stdio: 'pipe' as const };

export class GitManager {
  createFeatureBranch(repoPath: string, pipelineId: string): string {
    const branchName = `wyvern/${pipelineId}/main`;
    try {
      execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { ...EXEC_OPTS, cwd: repoPath });
    } catch {
      execSync(`git checkout -b ${branchName}`, { ...EXEC_OPTS, cwd: repoPath });
    }
    return branchName;
  }

  createWorktree(repoPath: string, pipelineId: string, agentId: string, roleSlug: string): string {
    const worktreePath = path.join(repoPath, '.wyvern-worktrees', agentId);
    const taskBranch = `wyvern/${pipelineId}/${roleSlug}-${agentId}`;
    const featureBranch = `wyvern/${pipelineId}/main`;
    execSync(
      `git worktree add -b ${taskBranch} "${worktreePath}" ${featureBranch}`,
      { ...EXEC_OPTS, cwd: repoPath }
    );
    return worktreePath;
  }

  removeWorktree(repoPath: string, worktreePath: string): void {
    execSync(`git worktree remove "${worktreePath}" --force`, { ...EXEC_OPTS, cwd: repoPath });
  }

  mergeTaskBranch(repoPath: string, featureBranch: string, taskBranch: string): { success: boolean; conflict: boolean } {
    execSync(`git checkout ${featureBranch}`, { ...EXEC_OPTS, cwd: repoPath });
    try {
      execSync(`git merge --no-ff ${taskBranch}`, { ...EXEC_OPTS, cwd: repoPath });
      return { success: true, conflict: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('CONFLICT') || msg.includes('Automatic merge failed')) {
        return { success: false, conflict: true };
      }
      throw err;
    }
  }

  listWorktrees(repoPath: string): string[] {
    const output = execSync('git worktree list --porcelain', { ...EXEC_OPTS, cwd: repoPath }).toString();
    return output
      .split('\n')
      .filter(line => line.startsWith('worktree '))
      .map(line => line.slice('worktree '.length).trim());
  }

  cleanupPipeline(repoPath: string, pipelineId: string): void {
    const output = execSync('git worktree list --porcelain', { ...EXEC_OPTS, cwd: repoPath }).toString();
    const blocks = output.split('\n\n').filter(b => b.trim());

    for (const block of blocks) {
      const lines = block.split('\n');
      const pathLine = lines.find(l => l.startsWith('worktree '));
      const branchLine = lines.find(l => l.startsWith('branch '));
      if (!pathLine || !branchLine) continue;

      const worktreePath = pathLine.slice('worktree '.length).trim();
      const branchRef = branchLine.slice('branch '.length).trim();

      if (branchRef.startsWith(`refs/heads/wyvern/${pipelineId}/`)) {
        this.removeWorktree(repoPath, worktreePath);
      }
    }
  }
}
