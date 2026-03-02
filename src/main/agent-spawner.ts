import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';
import { RoleDefinition } from '../types';

export interface AgentProcess {
  pid: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
  onExit: Promise<{ code: number | null }>;
  kill: () => void;
}

export function buildCommand(role: RoleDefinition, prompt: string): { cmd: string; args: string[] } {
  const provider = role.model.provider;

  switch (provider) {
    case 'claude': {
      const args = ['-p', prompt, '--output-format', 'text'];
      if (role.auto_approve) {
        args.push('--dangerously-skip-permissions');
      }
      return { cmd: 'claude', args };
    }
    case 'gemini':
      return { cmd: 'gemini', args: ['-p', prompt] };
    default:
      return { cmd: provider, args: ['-p', prompt] };
  }
}

export function spawnAgent(role: RoleDefinition, cwd: string, prompt: string): AgentProcess {
  const { cmd, args } = buildCommand(role, prompt);
  const child = spawn(cmd, args, { cwd, shell: true });

  const stdoutEmitter = new EventEmitter();
  const stderrEmitter = new EventEmitter();

  const stdoutRl = createInterface({ input: child.stdout });
  stdoutRl.on('line', (line: string) => {
    stdoutEmitter.emit('line', line);
  });

  const stderrRl = createInterface({ input: child.stderr });
  stderrRl.on('line', (line: string) => {
    stderrEmitter.emit('line', line);
  });

  const onExit = new Promise<{ code: number | null }>((resolve) => {
    child.on('close', (code: number | null) => {
      resolve({ code });
    });
  });

  return {
    pid: child.pid ?? 0,
    stdout: stdoutEmitter,
    stderr: stderrEmitter,
    onExit,
    kill: () => { child.kill(); },
  };
}
