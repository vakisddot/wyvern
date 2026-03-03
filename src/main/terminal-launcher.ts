import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { RoleDefinition } from '../types';

export function openAgentTerminal(role: RoleDefinition, cwd: string, inputFilePath: string): ChildProcess {
  const winCwd = cwd.replace(/\//g, '\\');
  const winInput = inputFilePath.replace(/\//g, '\\');

  let cmd: string;
  switch (role.model.provider) {
    case 'claude': {
      const extra = role.auto_approve ? ' --dangerously-skip-permissions' : '';
      cmd = 'claude' + extra + ' "Read your full directive from ' + winInput + ' and follow all instructions within."';
      break;
    }
    case 'gemini':
      cmd = 'gemini "Read your full directive from ' + winInput + ' and follow all instructions within."';
      break;
    default:
      cmd = role.model.provider + ' "Read your full directive from ' + winInput + ' and follow all instructions within."';
      break;
  }

  const batDir = path.join(os.tmpdir(), 'wyvern-launches');
  if (!fs.existsSync(batDir)) {
    fs.mkdirSync(batDir, { recursive: true });
  }

  const batPath = path.join(batDir, 'launch-' + Date.now() + '.bat');
  fs.writeFileSync(batPath, 'cd /d "' + winCwd + '"\r\n' + cmd + '\r\n', 'utf-8');

  const child = spawn('cmd', ['/k', batPath.replace(/\//g, '\\')], {
    detached: true,
    stdio: 'ignore',
    cwd: winCwd,
  });
  child.unref();
  return child;
}
