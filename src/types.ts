// --- Role definition (parsed from .wyvern/roles/*.yaml) ---

export interface RoleModel {
  provider: string;
  variant: string;
}

export interface RoleDefinition {
  name: string;
  description: string;
  model: RoleModel;
  can_spawn: string[];
  max_depth: number;
  auto_approve: boolean;
  system_prompt: string;
  repo?: string;
  entry_point?: boolean;
}

// --- Project config (wyvern.yaml) ---

export interface WyvernConfig {
  project: { name: string };
  repos: Record<string, string>;
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

export type AgentStatus = 'pending' | 'running' | 'done' | 'failed' | 'waiting_ceo';

export interface AgentNode {
  id: string;
  role: string;
  parentId: string | null;
  status: AgentStatus;
  depth: number;
  pipelineId: string;
  inputArtifacts: string[];
  outputArtifacts: string[];
  spawnedChildren: string[];
  startedAt: number;
  finishedAt?: number;
  costUsd?: number;
}

// --- Pipeline state ---

export type PipelineStatus = 'active' | 'completed' | 'failed' | 'paused';

export interface PipelineState {
  id: string;
  directive: string;
  status: PipelineStatus;
  entryAgentId: string;
  agents: Record<string, AgentNode>;
  createdAt: number;
  updatedAt: number;
  totalCostUsd: number;
  featureBranch: string;
}

// --- Parsed structured commands from agent output ---

export type AgentCommand =
  | { type: 'SPAWN'; role: string; input: string }
  | { type: 'CHECKPOINT'; message: string }
  | { type: 'DONE'; output: string };

// --- IPC channel names (used in preload + main) ---

export const IPC_CHANNELS = {
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

export interface WyvernAPI {
  startPipeline: (directive: string, projectPath: string) => Promise<string>;
  approveCheckpoint: (pipelineId: string, agentId: string, response: string) => void;
  rejectCheckpoint: (pipelineId: string, agentId: string, reason: string) => void;
  getPipelines: () => Promise<PipelineState[]>;
  getPipelineState: (id: string) => Promise<PipelineState>;
  getArtifact: (filePath: string) => Promise<string>;
  openProject: () => Promise<{ config: WyvernConfig; roles: Record<string, RoleDefinition>; projectPath: string } | null>;
  checkCliTools: () => Promise<{ missing: string[] }>;
  onPipelineUpdate: (cb: (state: PipelineState) => void) => () => void;
  onAgentOutput: (cb: (data: { pipelineId: string; agentId: string; chunk: string }) => void) => () => void;
  onCheckpointRequest: (cb: (data: { pipelineId: string; agentId: string; message: string }) => void) => () => void;
}
