import fs from 'fs';
import path from 'path';
import os from 'os';
import { load as yamlLoad } from 'js-yaml';
import { WyvernConfig, RoleDefinition } from '../types';

function resolveTilde(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

export function loadConfig(projectPath: string): WyvernConfig {
  const configPath = path.join(projectPath, 'wyvern.yaml');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = yamlLoad(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid config file: ${configPath} — expected a YAML object`);
  }

  const project = raw.project as Record<string, unknown> | undefined;
  if (!project || typeof project.name !== 'string') {
    throw new Error('Config missing required field: project.name');
  }

  const repos = raw.repos as Record<string, string> | undefined;
  if (!repos || typeof repos !== 'object') {
    throw new Error('Config missing required field: repos');
  }

  const execution = raw.execution as Record<string, unknown> | undefined;
  if (!execution || typeof execution.max_parallel_agents !== 'number' || typeof execution.timeout_per_agent_minutes !== 'number') {
    throw new Error('Config missing required fields: execution.max_parallel_agents, execution.timeout_per_agent_minutes');
  }

  const cost = raw.cost as Record<string, unknown> | undefined;
  if (!cost || typeof cost.warn_threshold_usd !== 'number' || typeof cost.hard_limit_usd !== 'number') {
    throw new Error('Config missing required fields: cost.warn_threshold_usd, cost.hard_limit_usd');
  }

  const resolvedRepos: Record<string, string> = {};
  for (const [alias, repoPath] of Object.entries(repos)) {
    resolvedRepos[alias] = resolveTilde(repoPath);
  }

  return {
    project: { name: project.name as string },
    repos: resolvedRepos,
    execution: {
      max_parallel_agents: execution.max_parallel_agents as number,
      timeout_per_agent_minutes: execution.timeout_per_agent_minutes as number,
    },
    cost: {
      warn_threshold_usd: cost.warn_threshold_usd as number,
      hard_limit_usd: cost.hard_limit_usd as number,
    },
  };
}

function validateRoleFields(slug: string, role: Record<string, unknown>): RoleDefinition {
  if (typeof role.name !== 'string') {
    throw new Error(`Role "${slug}" missing required field: name`);
  }
  if (typeof role.description !== 'string') {
    throw new Error(`Role "${slug}" missing required field: description`);
  }

  const model = role.model as Record<string, unknown> | undefined;
  if (!model || typeof model.provider !== 'string' || typeof model.variant !== 'string') {
    throw new Error(`Role "${slug}" missing required fields: model.provider, model.variant`);
  }

  if (!Array.isArray(role.can_spawn)) {
    throw new Error(`Role "${slug}" missing required field: can_spawn (must be an array)`);
  }

  if (typeof role.max_depth !== 'number') {
    throw new Error(`Role "${slug}" missing required field: max_depth (must be a number)`);
  }

  if (typeof role.auto_approve !== 'boolean') {
    throw new Error(`Role "${slug}" missing required field: auto_approve (must be a boolean)`);
  }

  if (typeof role.system_prompt !== 'string') {
    throw new Error(`Role "${slug}" missing required field: system_prompt`);
  }

  return {
    name: role.name as string,
    description: role.description as string,
    model: { provider: model.provider as string, variant: model.variant as string },
    can_spawn: role.can_spawn as string[],
    max_depth: role.max_depth as number,
    auto_approve: role.auto_approve as boolean,
    system_prompt: role.system_prompt as string,
    ...(typeof role.repo === 'string' ? { repo: role.repo } : {}),
    ...(typeof role.entry_point === 'boolean' ? { entry_point: role.entry_point } : {}),
  };
}

export function loadRoles(projectPath: string): Record<string, RoleDefinition> {
  const rolesDir = path.join(projectPath, '.wyvern', 'roles');

  if (!fs.existsSync(rolesDir)) {
    throw new Error(`Roles directory not found: ${rolesDir}`);
  }

  const files = fs.readdirSync(rolesDir).filter(f => f.endsWith('.yaml'));

  if (files.length === 0) {
    throw new Error(`No role files found in ${rolesDir}`);
  }

  const roles: Record<string, RoleDefinition> = {};

  for (const file of files) {
    const slug = file.replace(/\.yaml$/, '');
    const filePath = path.join(rolesDir, file);
    const raw = yamlLoad(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;

    if (!raw || typeof raw !== 'object') {
      throw new Error(`Invalid role file: ${filePath} — expected a YAML object`);
    }

    roles[slug] = validateRoleFields(slug, raw);
  }

  return roles;
}

export function validateRoles(roles: Record<string, RoleDefinition>): void {
  const slugs = Object.keys(roles);

  // Exactly one entry point
  const entryPoints = slugs.filter(s => roles[s].entry_point === true);
  if (entryPoints.length === 0) {
    throw new Error('No role has entry_point: true — exactly one is required');
  }
  if (entryPoints.length > 1) {
    throw new Error(`Multiple roles have entry_point: true: ${entryPoints.join(', ')} — exactly one is required`);
  }

  // All can_spawn references must exist
  for (const slug of slugs) {
    for (const ref of roles[slug].can_spawn) {
      if (!roles[ref]) {
        throw new Error(`Role "${slug}" references unknown role "${ref}" in can_spawn`);
      }
    }
  }

  // Roles with non-empty can_spawn must have max_depth >= 1
  for (const slug of slugs) {
    if (roles[slug].can_spawn.length > 0 && roles[slug].max_depth < 1) {
      throw new Error(`Role "${slug}" has can_spawn entries but max_depth is ${roles[slug].max_depth} (must be >= 1)`);
    }
  }

  // Cycle detection via DFS
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(slug: string, chain: string[]): void {
    if (inStack.has(slug)) {
      throw new Error(`Circular spawn chain detected: ${[...chain, slug].join(' → ')}`);
    }
    if (visited.has(slug)) return;

    inStack.add(slug);
    for (const child of roles[slug].can_spawn) {
      dfs(child, [...chain, slug]);
    }
    inStack.delete(slug);
    visited.add(slug);
  }

  for (const slug of slugs) {
    dfs(slug, []);
  }
}
