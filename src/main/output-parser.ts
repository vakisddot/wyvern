import { AgentCommand } from '../types';

const COMMAND_REGEX = /\[WYVERN:(SPAWN|CHECKPOINT|DONE)\]\s*(.*)/;

function parseKeyValue(remainder: string): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;

  while (i < remainder.length) {
    while (i < remainder.length && remainder[i] === ' ') i++;

    const eqIdx = remainder.indexOf('=', i);
    if (eqIdx === -1) break;

    const key = remainder.slice(i, eqIdx);
    i = eqIdx + 1;

    if (remainder[i] === '"') {
      i++;
      const closeIdx = remainder.indexOf('"', i);
      if (closeIdx === -1) {
        result[key] = remainder.slice(i);
        break;
      }
      result[key] = remainder.slice(i, closeIdx);
      i = closeIdx + 1;
    } else {
      const spaceIdx = remainder.indexOf(' ', i);
      if (spaceIdx === -1) {
        result[key] = remainder.slice(i);
        i = remainder.length;
      } else {
        result[key] = remainder.slice(i, spaceIdx);
        i = spaceIdx;
      }
    }
  }

  return result;
}

export function parseOutputLine(line: string): AgentCommand | null {
  const match = COMMAND_REGEX.exec(line);
  if (!match) return null;

  const commandType = match[1];
  const remainder = match[2];

  switch (commandType) {
    case 'SPAWN': {
      const kv = parseKeyValue(remainder);
      const role = kv['role'];
      const input = kv['input'];
      if (!role || !input) return null;
      return { type: 'SPAWN', role, input };
    }
    case 'CHECKPOINT': {
      const prefix = 'message=';
      if (!remainder.startsWith(prefix)) return null;
      const raw = remainder.slice(prefix.length);
      const message = (raw.startsWith('"') && raw.endsWith('"'))
        ? raw.slice(1, -1)
        : raw;
      return message ? { type: 'CHECKPOINT', message } : null;
    }
    case 'DONE': {
      const kv = parseKeyValue(remainder);
      const output = kv['output'];
      if (!output) return null;
      return { type: 'DONE', output };
    }
    default:
      return null;
  }
}
