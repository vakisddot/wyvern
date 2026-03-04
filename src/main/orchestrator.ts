import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { WyvernConfig, RoleDefinition, PipelineState, AgentNode, AgentCommand } from '../types';
import { PipelineManager } from './pipeline-manager';
import { ensureAgentDir, writeArtifact, readArtifact } from './artifact-manager';
import { generateId, timestamp } from './utils';
import { buildPrompt } from './prompt-builder';
import { parseOutputLine } from './output-parser';
import { openAgentTerminal, killTerminal } from './terminal-launcher';
import { watchForOutput } from './file-watcher';
import { buildRepoSummary } from './repo-scanner';

const OUTPUT_FILE = 'output.md';

export class Orchestrator extends EventEmitter {
  private config: WyvernConfig;
  private roles: Record<string, RoleDefinition>;
  private projectPath: string;
  private dataDir: string;
  private pipelineManager: PipelineManager;
  private state: PipelineState | null;
  private repoSummary = '';

  constructor(
    config: WyvernConfig,
    roles: Record<string, RoleDefinition>,
    projectPath: string,
    dataDir: string,
    pipelineManager: PipelineManager
  ) {
    super();
    this.config = config;
    this.roles = roles;
    this.projectPath = projectPath;
    this.dataDir = dataDir;
    this.pipelineManager = pipelineManager;
    this.state = null;
  }

  private getState(): PipelineState {
    if (!this.state) throw new Error('No active pipeline');
    return this.state;
  }

  private saveState(): void {
    const s = this.getState();
    this.pipelineManager.savePipeline(s);
    this.emit('pipeline-update', s);
  }

  private updateAgentInState(agentId: string, updates: Partial<AgentNode>): void {
    this.state = this.pipelineManager.updateAgent(this.getState(), agentId, updates);
    this.saveState();
  }

  async runPipeline(directive: string): Promise<PipelineState> {
    this.repoSummary = buildRepoSummary(this.config, this.projectPath);
    this.state = this.pipelineManager.createPipeline(directive);

    const entrySlug = Object.keys(this.roles).find(
      slug => this.roles[slug].entry_point === true
    );
    if (!entrySlug) {
      throw new Error('No entry point role defined');
    }

    const entryAgentId = generateId();
    const entryDir = ensureAgentDir(this.dataDir, this.state.id, entrySlug, entryAgentId);
    const directivePath = writeArtifact(entryDir, 'directive.md', directive);

    try {
      await this.invokeAgent(entrySlug, [directivePath], null, 0, entryAgentId);
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
    depth: number,
    preGeneratedId?: string
  ): Promise<string> {
    const role = this.roles[roleSlug];
    if (!role) {
      throw new Error('Unknown role: ' + roleSlug);
    }

    const s = this.getState();
    const agentId = preGeneratedId || generateId();
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

    const agentDir = ensureAgentDir(this.dataDir, this.getState().id, roleSlug, agentId);
    const inputContent = inputArtifacts.map(p => readArtifact(p)).join('\n\n');
    const pipelineContext = 'Directive: ' + this.getState().directive
      + (this.repoSummary ? '\n\n' + this.repoSummary : '');
    let accumulatedContext = '';

    const repoPath = role.repo ? (this.config.repos[role.repo] || null) : null;
    const cwd = repoPath || this.projectPath;
    const timeoutMs = this.config.execution.timeout_per_agent_minutes * 60_000;

    for (;;) {
      const fullInput = accumulatedContext
        ? inputContent + '\n\n--- Previous Context ---\n' + accumulatedContext
        : inputContent;

      const prompt = buildPrompt(role, this.roles, fullInput, pipelineContext, agentDir);

      const promptPath = writeArtifact(agentDir, 'directive.md', prompt);

      // Open terminal and track the process
      const proc = openAgentTerminal(role, cwd, promptPath);

      // Promise that rejects if the terminal is closed before output arrives
      const processExited = new Promise<never>((_resolve, reject) => {
        proc.on('exit', () => {
          reject(new Error('Terminal closed before agent produced output'));
        });
      });

      // Race: output file appears vs terminal closed vs timeout
      let outputFilePath: string;
      try {
        outputFilePath = await Promise.race([
          watchForOutput(agentDir, OUTPUT_FILE, timeoutMs),
          processExited,
        ]);
      } catch {
        // Check if output appeared despite the process exiting
        const possiblePath = path.join(agentDir, OUTPUT_FILE);
        if (fs.existsSync(possiblePath)) {
          outputFilePath = possiblePath;
        } else {
          this.updateAgentInState(agentId, { status: 'failed', finishedAt: timestamp() });
          throw new Error('Agent "' + roleSlug + '" (' + agentId + ') terminated before producing output');
        }
      }

      // Read the output before killing - agent may still be flushing
      const outputContent = readArtifact(outputFilePath);

      // Terminal's job is done - kill it if configured
      processExited.catch(() => { /* expected after kill or natural exit */ });
      if (this.config.execution.auto_close_terminals) {
        killTerminal(proc);
      }
      const outputLines = outputContent.split('\n');
      const commands: AgentCommand[] = [];
      for (const line of outputLines) {
        const cmd = parseOutputLine(line);
        if (cmd) commands.push(cmd);
      }

      // Delete output file so next iteration can watch for a fresh one
      try { fs.unlinkSync(outputFilePath); } catch { /* ignore */ }

      const hasDone = commands.some(c => c.type === 'DONE');
      const spawnCmds = commands.filter(c => c.type === 'SPAWN') as Extract<AgentCommand, { type: 'SPAWN' }>[];

      if (spawnCmds.length > 0) {
        if (role.max_depth < 1) {
          accumulatedContext += '\nSPAWN REJECTED: Role "' + roleSlug + '" has max_depth ' + role.max_depth + ' and cannot spawn.';
          continue;
        }

        const validSpawns: Array<{ spawnCmd: Extract<AgentCommand, { type: 'SPAWN' }>; childInputPaths: string[]; childAgentId: string }> = [];

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

          const inputPath = path.join(agentDir, spawnCmd.input);
          let childInputContent: string;
          try {
            childInputContent = readArtifact(inputPath);
          } catch {
            accumulatedContext += '\nSPAWN FAILED: Input file "' + spawnCmd.input + '" not found.';
            continue;
          }

          const childAgentId = generateId();
          const childDir = ensureAgentDir(this.dataDir, this.getState().id, spawnCmd.role, childAgentId);
          const childInputPaths = [writeArtifact(childDir, spawnCmd.input, childInputContent)];

          if (accumulatedContext) {
            childInputPaths.push(writeArtifact(childDir, 'context.md', accumulatedContext));
          }

          this.updateAgentInState(agentId, {
            spawnedChildren: [...this.getState().agents[agentId].spawnedChildren, spawnCmd.role],
          });

          validSpawns.push({ spawnCmd, childInputPaths, childAgentId });
        }

        if (validSpawns.length > 0) {
          const maxParallel = this.config.execution.max_parallel_agents;
          const childResults: string[] = [];
          let running = 0;
          let idx = 0;

          await new Promise<void>((resolveAll) => {
            const results: Array<{ index: number; text: string }> = [];

            const launchNext = (): void => {
              if (idx >= validSpawns.length && running === 0) {
                for (const r of results.sort((a, b) => a.index - b.index)) {
                  childResults.push(r.text);
                }
                resolveAll();
                return;
              }

              while (running < maxParallel && idx < validSpawns.length) {
                const currentIdx = idx;
                const { spawnCmd, childInputPaths, childAgentId } = validSpawns[currentIdx];
                idx++;
                running++;

                this.invokeAgent(spawnCmd.role, childInputPaths, agentId, depth + 1, childAgentId)
                  .then((childOutputPath) => {
                    const childOutput = readArtifact(childOutputPath);
                    results.push({ index: currentIdx, text: 'Result from ' + spawnCmd.role + ':\n' + childOutput });
                  })
                  .catch((err: unknown) => {
                    const msg = err instanceof Error ? err.message : String(err);
                    results.push({ index: currentIdx, text: 'SPAWN FAILED for ' + spawnCmd.role + ': ' + msg });
                  })
                  .finally(() => {
                    running--;
                    launchNext();
                  });
              }
            };

            launchNext();
          });

          if (childResults.length > 0) {
            accumulatedContext += '\n' + childResults.join('\n\n');
          }
        }
        continue;
      }

      if (hasDone) {
        const artifactPath = writeArtifact(agentDir, OUTPUT_FILE, outputContent);

        this.updateAgentInState(agentId, {
          status: 'done',
          outputArtifacts: [...this.getState().agents[agentId].outputArtifacts, artifactPath],
          finishedAt: timestamp(),
        });

        return artifactPath;
      }

      this.updateAgentInState(agentId, {
        status: 'failed',
        finishedAt: timestamp(),
      });
      throw new Error('Agent "' + roleSlug + '" (' + agentId + ') output contains no valid commands');
    }
  }
}
