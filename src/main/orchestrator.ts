import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { WyvernConfig, RoleDefinition, PipelineState, AgentNode, AgentCommand } from '../types';
import { PipelineManager } from './pipeline-manager';
import { ensureAgentDirs, writeArtifact, readArtifact } from './artifact-manager';
import { generateId, timestamp } from './utils';
import { spawnAgent } from './agent-spawner';
import { buildPrompt } from './prompt-builder';
import { parseOutputLine } from './output-parser';
import { GitManager } from './git-manager';

function resolveOutputFile(filename: string, outputDir: string, projectPath: string): string {
  const inOutputDir = path.join(outputDir, filename);
  if (fs.existsSync(inOutputDir)) return inOutputDir;

  const inProject = path.join(projectPath, filename);
  if (fs.existsSync(inProject)) return inProject;

  return '';
}

export class Orchestrator extends EventEmitter {
  private config: WyvernConfig;
  private roles: Record<string, RoleDefinition>;
  private projectPath: string;
  private pipelineManager: PipelineManager;
  private gitManager: GitManager;
  private state: PipelineState | null;
  private checkpointResolvers: Map<string, { resolve: (response: string) => void; reject: (reason: string) => void }>;

  constructor(
    config: WyvernConfig,
    roles: Record<string, RoleDefinition>,
    projectPath: string,
    pipelineManager: PipelineManager,
    gitManager: GitManager
  ) {
    super();
    this.config = config;
    this.roles = roles;
    this.projectPath = projectPath;
    this.pipelineManager = pipelineManager;
    this.gitManager = gitManager;
    this.state = null;
    this.checkpointResolvers = new Map();
  }

  private getState(): PipelineState {
    if (!this.state) throw new Error('No active pipeline');
    return this.state;
  }

  private saveState(): void {
    const s = this.getState();
    this.pipelineManager.savePipeline(this.projectPath, s);
    this.emit('pipeline-update', s);
  }

  private updateAgentInState(agentId: string, updates: Partial<AgentNode>): void {
    this.state = this.pipelineManager.updateAgent(this.getState(), agentId, updates);
    this.saveState();
  }

  private waitForCheckpoint(agentId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.checkpointResolvers.set(agentId, { resolve, reject });
    });
  }

  resolveCheckpoint(agentId: string, response: string): void {
    const resolver = this.checkpointResolvers.get(agentId);
    if (resolver) {
      resolver.resolve(response);
      this.checkpointResolvers.delete(agentId);
    }
  }

  rejectCheckpoint(agentId: string, reason: string): void {
    const resolver = this.checkpointResolvers.get(agentId);
    if (resolver) {
      resolver.reject(reason);
      this.checkpointResolvers.delete(agentId);
    }
  }

  async runPipeline(directive: string): Promise<PipelineState> {
    this.state = this.pipelineManager.createPipeline(this.projectPath, directive);

    const repoKeys = new Set<string>();
    for (const role of Object.values(this.roles)) {
      if (role.repo) repoKeys.add(role.repo);
    }
    for (const repoKey of repoKeys) {
      const repoPath = this.config.repos[repoKey];
      if (repoPath) {
        this.gitManager.createFeatureBranch(repoPath, this.getState().id);
      }
    }

    const entrySlug = Object.keys(this.roles).find(
      slug => this.roles[slug].entry_point === true
    );
    if (!entrySlug) {
      throw new Error('No entry point role defined');
    }

    const dirs = ensureAgentDirs(this.projectPath, this.state.id, entrySlug);
    const directivePath = writeArtifact(dirs.inputDir, 'directive.md', directive);

    try {
      await this.invokeAgent(entrySlug, [directivePath], null, 0);
      this.state = { ...this.getState(), status: 'completed' };
      this.saveState();
    } catch (err) {
      this.state = { ...this.getState(), status: 'failed' };
      this.saveState();
      throw err;
    }

    const finalState = this.getState();
    this.state = null;
    return finalState;
  }

  private async invokeAgent(
    roleSlug: string,
    inputArtifacts: string[],
    parentId: string | null,
    depth: number
  ): Promise<string> {
    const role = this.roles[roleSlug];
    if (!role) {
      throw new Error(`Unknown role: ${roleSlug}`);
    }

    const s = this.getState();
    const agentId = generateId();
    const node: AgentNode = {
      id: agentId,
      role: roleSlug,
      parentId,
      status: 'running',
      depth,
      pipelineId: s.id,
      inputArtifacts,
      outputArtifacts: [],
      spawnedChildren: [],
      startedAt: timestamp(),
    };

    this.state = this.pipelineManager.addAgent(s, node);
    if (parentId === null) {
      this.state = { ...this.state, entryAgentId: agentId };
    }
    this.saveState();

    const dirs = ensureAgentDirs(this.projectPath, this.getState().id, roleSlug);
    const inputContent = inputArtifacts.map(p => readArtifact(p)).join('\n\n');
    const pipelineContext = 'Directive: ' + this.getState().directive;
    let accumulatedContext = '';

    const repoPath = role.repo ? (this.config.repos[role.repo] || null) : null;
    let worktreePath: string | null = null;
    let taskBranch: string | null = null;
    if (repoPath) {
      worktreePath = this.gitManager.createWorktree(repoPath, s.id, agentId, roleSlug);
      taskBranch = `wyvern/${s.id}/${roleSlug}-${agentId}`;
    }

    for (;;) {
      const fullInput = accumulatedContext
        ? inputContent + '\n\n--- Previous Context ---\n' + accumulatedContext
        : inputContent;

      const prompt = buildPrompt(role, this.roles, fullInput, pipelineContext);
      const cwd = worktreePath || this.projectPath;
      const proc = spawnAgent(role, cwd, prompt);

      const outputLines: string[] = [];
      const commands: AgentCommand[] = [];

      proc.stdout.on('line', (line: string) => {
        outputLines.push(line);
        this.emit('agent-output', {
          pipelineId: this.getState().id,
          agentId,
          chunk: line,
        });

        const cmd = parseOutputLine(line);
        if (cmd) {
          commands.push(cmd);
        }
      });

      proc.stderr.on('line', (line: string) => {
        this.emit('agent-output', {
          pipelineId: this.getState().id,
          agentId,
          chunk: '[stderr] ' + line,
        });
      });

      const { code } = await proc.onExit;

      const doneCmd = commands.find(c => c.type === 'DONE') as Extract<AgentCommand, { type: 'DONE' }> | undefined;
      const spawnCmds = commands.filter(c => c.type === 'SPAWN') as Extract<AgentCommand, { type: 'SPAWN' }>[];
      const checkpointCmd = commands.find(c => c.type === 'CHECKPOINT') as Extract<AgentCommand, { type: 'CHECKPOINT' }> | undefined;

      if (doneCmd) {
        const resolved = resolveOutputFile(doneCmd.output, dirs.outputDir, this.projectPath);
        let artifactPath: string;

        if (resolved) {
          const content = readArtifact(resolved);
          artifactPath = writeArtifact(dirs.outputDir, doneCmd.output, content);
        } else {
          artifactPath = writeArtifact(dirs.outputDir, doneCmd.output, outputLines.join('\n'));
        }

        this.updateAgentInState(agentId, {
          status: 'done',
          outputArtifacts: [...this.getState().agents[agentId].outputArtifacts, artifactPath],
          finishedAt: timestamp(),
        });

        if (worktreePath && taskBranch && repoPath) {
          const featureBranch = this.getState().featureBranch;
          const mergeResult = this.gitManager.mergeTaskBranch(repoPath, featureBranch, taskBranch);
          if (mergeResult.conflict) {
            this.state = { ...this.getState(), status: 'paused' };
            this.saveState();
          }
          this.gitManager.removeWorktree(repoPath, worktreePath);
        }

        return artifactPath;
      }

      if (spawnCmds.length > 0) {
        if (role.max_depth < 1) {
          accumulatedContext += '\nSPAWN REJECTED: Role "' + roleSlug + '" has max_depth ' + role.max_depth + ' and cannot spawn.';
          continue;
        }

        const childResults: string[] = [];

        for (const spawnCmd of spawnCmds) {
          if (!role.can_spawn.includes(spawnCmd.role)) {
            accumulatedContext += '\nSPAWN REJECTED: Role "' + roleSlug + '" cannot spawn "' + spawnCmd.role + '".';
            continue;
          }

          const childRole = this.roles[spawnCmd.role];
          if (!childRole) {
            accumulatedContext += '\nSPAWN REJECTED: Unknown role "' + spawnCmd.role + '".';
            continue;
          }

          const inputPath = path.join(this.projectPath, spawnCmd.input);
          let childInputContent: string;
          try {
            childInputContent = readArtifact(inputPath);
          } catch {
            accumulatedContext += '\nSPAWN FAILED: Input file "' + spawnCmd.input + '" not found.';
            continue;
          }

          const childDirs = ensureAgentDirs(this.projectPath, this.getState().id, spawnCmd.role);
          const childInputPath = writeArtifact(childDirs.inputDir, spawnCmd.input, childInputContent);

          this.updateAgentInState(agentId, {
            spawnedChildren: [...this.getState().agents[agentId].spawnedChildren, spawnCmd.role],
          });

          const childOutputPath = await this.invokeAgent(
            spawnCmd.role,
            [childInputPath],
            agentId,
            depth + 1
          );

          const childOutput = readArtifact(childOutputPath);
          childResults.push('Result from ' + spawnCmd.role + ':\n' + childOutput);
        }

        if (childResults.length > 0) {
          accumulatedContext += '\n' + childResults.join('\n\n');
        }
        continue;
      }

      if (checkpointCmd) {
        this.updateAgentInState(agentId, { status: 'waiting_ceo' });

        this.emit('checkpoint-request', {
          pipelineId: this.getState().id,
          agentId,
          message: checkpointCmd.message,
        });

        const response = await this.waitForCheckpoint(agentId);
        this.updateAgentInState(agentId, { status: 'running' });

        accumulatedContext += '\nCEO Response: ' + response;
        continue;
      }

      this.updateAgentInState(agentId, {
        status: 'failed',
        finishedAt: timestamp(),
      });

      if (code !== 0) {
        throw new Error('Agent "' + roleSlug + '" (' + agentId + ') exited with code ' + code);
      }
      throw new Error('Agent "' + roleSlug + '" (' + agentId + ') exited without emitting [WYVERN:DONE]');
    }
  }
}
