// --- Role definition (parsed from .wyvern/roles/*.yaml) ---

export interface RoleModel {
  provider: string;
  variant: string;
}

export interface RoleDefinition {
  description: string;
  model: RoleModel;
  can_spawn: string[];
  max_depth: number;
  system_prompt: string;
  repo?: string;
  entry_point?: boolean;
}

// --- Project config (wyvern.yaml) ---

export interface WyvernConfig {
  project: { name: string };
  repos: Record<string, string>;
  context_files: string[];
  execution: {
    max_parallel_agents: number;
    timeout_per_agent_minutes: number;
    auto_close_terminals: boolean;
  };
}

// --- Agent runtime state ---

export type AgentStatus = 'pending' | 'running' | 'done' | 'failed';

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
}

// --- Parsed structured commands from agent output ---

export type AgentCommand =
  | { type: 'SPAWN'; role: string; input: string }
  | { type: 'DONE' };

// --- Config update result (returned by save/create/delete operations) ---

export interface ConfigUpdateResult {
  ok: boolean;
  config?: WyvernConfig;
  roles?: Record<string, RoleDefinition>;
  error?: string;
}

// --- IPC channel names (used in preload + main) ---

export const IPC_CHANNELS = {
  // Renderer -> Main (request/response)
  START_PIPELINE: 'wyvern:start-pipeline',
  GET_PIPELINES: 'wyvern:get-pipelines',
  GET_PIPELINE_STATE: 'wyvern:get-pipeline-state',
  GET_ARTIFACT: 'wyvern:get-artifact',
  LIST_AGENT_FILES: 'wyvern:list-agent-files',
  OPEN_PROJECT: 'wyvern:open-project',
  CREATE_PROJECT: 'wyvern:create-project',
  CHECK_CLI_TOOLS: 'wyvern:check-cli-tools',
  OPEN_IN_EDITOR: 'wyvern:open-in-editor',
  SAVE_CONFIG: 'wyvern:save-config',
  SAVE_ROLE: 'wyvern:save-role',
  CREATE_ROLE: 'wyvern:create-role',
  DELETE_ROLE: 'wyvern:delete-role',
  // Main -> Renderer (push events)
  PIPELINE_UPDATE: 'wyvern:pipeline-update',
} as const;

// --- IPC API shape exposed via contextBridge ---

export interface WyvernAPI {
  startPipeline: (directive: string, projectPath: string) => Promise<string>;
  getPipelines: () => Promise<PipelineState[]>;
  getPipelineState: (id: string) => Promise<PipelineState>;
  getArtifact: (filePath: string) => Promise<string>;
  listAgentFiles: (agentDir: string) => Promise<string[]>;
  openProject: () => Promise<{ config: WyvernConfig; roles: Record<string, RoleDefinition>; projectPath: string } | null>;
  createProject: (projectName: string) => Promise<{ config: WyvernConfig; roles: Record<string, RoleDefinition>; projectPath: string } | null>;
  checkCliTools: () => Promise<{ missing: string[] }>;
  openInEditor: (filePath: string) => Promise<string>;
  saveConfig: (projectPath: string, content: string) => Promise<ConfigUpdateResult>;
  saveRole: (projectPath: string, slug: string, content: string) => Promise<ConfigUpdateResult>;
  createRole: (projectPath: string, slug: string, content: string) => Promise<ConfigUpdateResult>;
  deleteRole: (projectPath: string, slug: string) => Promise<ConfigUpdateResult>;
  onPipelineUpdate: (cb: (state: PipelineState) => void) => () => void;
}
