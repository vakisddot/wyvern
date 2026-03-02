import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { PipelineState, AgentNode } from '../types';
import { generateId, timestamp } from './utils';
import { initPipeline } from './artifact-manager';

function stateFilePath(projectPath: string, pipelineId: string): string {
  return path.join(projectPath, '.wyvern', 'pipelines', pipelineId, 'pipeline-state.json');
}

export class PipelineManager extends EventEmitter {
  createPipeline(projectPath: string, directive: string, useWorktrees: boolean): PipelineState {
    const id = generateId();
    initPipeline(projectPath, id, directive);

    const now = timestamp();
    const state: PipelineState = {
      id,
      directive,
      status: 'active',
      entryAgentId: '',
      agents: {},
      createdAt: now,
      updatedAt: now,
      totalCostUsd: 0,
      featureBranch: useWorktrees ? `wyvern/${id}/main` : '',
    };

    this.savePipeline(projectPath, state);
    return state;
  }

  loadPipeline(projectPath: string, pipelineId: string): PipelineState {
    const raw = fs.readFileSync(stateFilePath(projectPath, pipelineId), 'utf-8');
    return JSON.parse(raw) as PipelineState;
  }

  savePipeline(projectPath: string, state: PipelineState): void {
    state.updatedAt = timestamp();
    fs.writeFileSync(
      stateFilePath(projectPath, state.id),
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

  listPipelines(projectPath: string): PipelineState[] {
    const pipelinesDir = path.join(projectPath, '.wyvern', 'pipelines');
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
