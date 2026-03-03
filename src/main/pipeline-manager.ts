import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { PipelineState, AgentNode } from '../types';
import { generateId, timestamp } from './utils';
import { initPipeline } from './artifact-manager';

export class PipelineManager extends EventEmitter {
  private dataDir: string;

  constructor(dataDir: string) {
    super();
    this.dataDir = dataDir;
  }

  private stateFilePath(pipelineId: string): string {
    return path.join(this.dataDir, 'pipelines', pipelineId, 'pipeline-state.json');
  }

  createPipeline(directive: string): PipelineState {
    const id = generateId();
    initPipeline(this.dataDir, id, directive);

    const now = timestamp();
    const state: PipelineState = {
      id,
      directive,
      status: 'active',
      entryAgentId: '',
      agents: {},
      createdAt: now,
      updatedAt: now,
    };

    this.savePipeline(state);
    return state;
  }

  loadPipeline(pipelineId: string): PipelineState {
    const raw = fs.readFileSync(this.stateFilePath(pipelineId), 'utf-8');
    return JSON.parse(raw) as PipelineState;
  }

  savePipeline(state: PipelineState): void {
    state.updatedAt = timestamp();
    fs.writeFileSync(
      this.stateFilePath(state.id),
      JSON.stringify(state, null, 2),
      'utf-8'
    );
    this.emit('pipeline-update', state);
  }

  addAgent(state: PipelineState, agent: AgentNode): PipelineState {
    return {
      ...state,
      agents: { ...state.agents, [agent.id]: agent },
    };
  }

  updateAgent(state: PipelineState, agentId: string, updates: Partial<AgentNode>): PipelineState {
    return {
      ...state,
      agents: {
        ...state.agents,
        [agentId]: { ...state.agents[agentId], ...updates },
      },
    };
  }

  listPipelines(): PipelineState[] {
    const pipelinesDir = path.join(this.dataDir, 'pipelines');
    if (!fs.existsSync(pipelinesDir)) return [];

    const entries = fs.readdirSync(pipelinesDir, { withFileTypes: true });
    const results: PipelineState[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const raw = fs.readFileSync(
          path.join(pipelinesDir, entry.name, 'pipeline-state.json'),
          'utf-8'
        );
        results.push(JSON.parse(raw) as PipelineState);
      } catch (err) {
        console.warn(`Skipping pipeline ${entry.name}: failed to load state`, err);
      }
    }

    return results;
  }
}
