import { execSync } from 'child_process';
import { WyvernConfig, RoleDefinition } from '../types';
import { loadConfig, loadRoles, validateRoles } from './config-loader';

export function openProject(dirPath: string): { config: WyvernConfig; roles: Record<string, RoleDefinition> } {
  const config = loadConfig(dirPath);
  const roles = loadRoles(dirPath);
  validateRoles(roles);
  return { config, roles };
}

export function checkCliTools(roles: Record<string, RoleDefinition>): { missing: string[] } {
  const providers = new Set<string>();
  for (const role of Object.values(roles)) {
    providers.add(role.model.provider);
  }

  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const missing: string[] = [];

  for (const provider of providers) {
    try {
      execSync(`${cmd} ${provider}`, { stdio: 'pipe' });
    } catch {
      missing.push(provider);
    }
  }

  return { missing };
}
