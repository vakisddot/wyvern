import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { RoleDefinition } from '../types';

export interface AgentProcess {
  pid: number;
  stdout: EventEmitter;  // emits 'data' (raw chunks) and 'line' (complete lines)
  stderr: EventEmitter;  // emits 'line' (complete lines)
  onExit: Promise<{ code: number | null }>;
  kill: () => void;
}

export function buildCommand(role: RoleDefinition): { cmd: string; args: string[] } {
  const provider = role.model.provider;

  switch (provider) {
    case 'claude': {
      const args = ['--output-format', 'text', '-p'];
      if (role.auto_approve) {
        args.push('--dangerously-skip-permissions');
      }
      return { cmd: 'claude', args };
    }
    case 'gemini':
      return { cmd: 'gemini', args: [] };
    default:
      return { cmd: provider, args: [] };
  }
}

export function spawnAgent(role: RoleDefinition, cwd: string, prompt: string): AgentProcess {
  const { cmd, args } = buildCommand(role);
  const child = spawn(cmd, args, { cwd, shell: true });

  const stdoutEmitter = new EventEmitter();
  const stderrEmitter = new EventEmitter();

  if (child.stdin) {
    child.stdin.on('error', (err: Error) => {
      stderrEmitter.emit('line', 'stdin error: ' + err.message);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  }

  let stdoutBuf = '';
  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stdoutEmitter.emit('data', text);
    stdoutBuf += text;
    const parts = stdoutBuf.split('\n');
    stdoutBuf = parts.pop() ?? '';
    for (const line of parts) {
      stdoutEmitter.emit('line', line);
    }
  });
  child.stdout.on('end', () => {
    if (stdoutBuf) {
      stdoutEmitter.emit('line', stdoutBuf);
      stdoutBuf = '';
    }
  });

  let stderrBuf = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderrBuf += chunk.toString();
    const parts = stderrBuf.split('\n');
    stderrBuf = parts.pop() ?? '';
    for (const line of parts) {
      stderrEmitter.emit('line', line);
    }
  });
  child.stderr.on('end', () => {
    if (stderrBuf) {
      stderrEmitter.emit('line', stderrBuf);
      stderrBuf = '';
    }
  });

  const onExit = new Promise<{ code: number | null }>((resolve) => {
    child.on('error', (err: Error) => {
      stderrEmitter.emit('line', 'Spawn error: ' + err.message);
      resolve({ code: -1 });
    });
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
