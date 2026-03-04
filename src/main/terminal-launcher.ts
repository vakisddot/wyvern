import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { RoleDefinition } from '../types';

export function openAgentTerminal(role: RoleDefinition, cwd: string, inputFilePath: string): ChildProcess {
  const winCwd = cwd.replace(/\//g, '\\');
  const winInput = inputFilePath.replace(/\//g, '\\');

  const prompt = '"Read your full directive from ' + winInput + ' and follow all instructions within."';
  const provider = role.model.provider;
  const variant = role.model.variant;

  let cmd: string;
  switch (provider) {
    case 'claude':
      cmd = 'claude --model ' + provider + '-' + variant + ' ' + prompt;
      break;
    case 'gemini':
      cmd = 'gemini --model ' + provider + '-' + variant + ' ' + prompt;
      break;
    default:
      throw new Error('Unsupported provider: ' + provider); 
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
  return child;
}

export function killTerminal(proc: ChildProcess): void {
  if (!proc.pid) return;
  try {
    spawn('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { stdio: 'ignore' });
  } catch { /* process already gone */ }
}
