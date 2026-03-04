import { AgentCommand } from '../types';

const COMMAND_REGEX = /\[WYVERN:(SPAWN|DONE)\]\s*(.*)/;

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
    case 'DONE':
      return { type: 'DONE' };
    default:
      return null;
  }
}
