import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { WyvernConfig } from '../types';

const MAX_TREE_ENTRIES = 50;
const MAX_FILE_LINES = 200;

function gitFileList(repoDir: string): string[] | null {
  try {
    const output = execSync('git ls-files --cached --others --exclude-standard', {
      cwd: repoDir,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

function buildTreeFromPaths(files: string[]): string[] {
  const tree: Map<string, Set<string>> = new Map();
  const topFiles: string[] = [];

  for (const file of files) {
    const parts = file.split('/');
    if (parts.length === 1) {
      topFiles.push(parts[0]);
    } else {
      const dir = parts[0];
      const sub = parts.length === 2 ? parts[1] : parts[1] + '/';
      const existing = tree.get(dir);
      if (existing) {
        existing.add(sub);
      } else {
        tree.set(dir, new Set([sub]));
      }
    }
  }

  const entries: string[] = [];

  const sortedDirs = [...tree.keys()].sort();
  for (const dir of sortedDirs) {
    if (entries.length >= MAX_TREE_ENTRIES) break;
    entries.push(dir + '/');
    const dirEntries = tree.get(dir);
    if (!dirEntries) continue;
    const children = [...dirEntries].sort();
    for (const child of children) {
      if (entries.length >= MAX_TREE_ENTRIES) break;
      entries.push('  ' + child);
    }
  }

  for (const file of topFiles.sort()) {
    if (entries.length >= MAX_TREE_ENTRIES) break;
    entries.push(file);
  }

  return entries;
}

function fallbackTree(dir: string, depth: number, maxEntries: number): string[] {
  if (depth < 0 || !fs.existsSync(dir)) return [];

  const entries: string[] = [];
  let items: string[];
  try {
    items = fs.readdirSync(dir);
  } catch {
    return [];
  }

  for (const item of items) {
    if (entries.length >= maxEntries) break;
    if (item === '.git') continue;

    const full = path.join(dir, item);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      entries.push(item + '/');
      if (depth > 0) {
        const children = fallbackTree(full, depth - 1, maxEntries - entries.length);
        for (const child of children) {
          if (entries.length >= maxEntries) break;
          entries.push('  ' + child);
        }
      }
    } else {
      entries.push(item);
    }
  }

  return entries;
}

function buildRepoTree(repoDir: string): string[] {
  const files = gitFileList(repoDir);
  if (files) return buildTreeFromPaths(files);
  return fallbackTree(repoDir, 2, MAX_TREE_ENTRIES);
}

function readCapped(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length > MAX_FILE_LINES) {
      return lines.slice(0, MAX_FILE_LINES).join('\n') + '\n...(truncated)';
    }
    return content;
  } catch {
    return null;
  }
}

function resolveContextFile(
  entry: string,
  repos: Record<string, string>,
  projectPath: string
): { label: string; absPath: string } | null {
  const colonIdx = entry.indexOf(':');
  if (colonIdx > 0) {
    const alias = entry.slice(0, colonIdx);
    const relPath = entry.slice(colonIdx + 1);
    const repoDir = repos[alias];
    if (!repoDir) return null;
    return { label: alias + ':' + relPath, absPath: path.join(repoDir, relPath) };
  }
  return { label: entry, absPath: path.join(projectPath, entry) };
}

function readContextFiles(
  contextFiles: string[],
  repos: Record<string, string>,
  projectPath: string
): string[] {
  const sections: string[] = [];

  for (const entry of contextFiles) {
    const resolved = resolveContextFile(entry, repos, projectPath);
    if (!resolved) continue;

    const content = readCapped(resolved.absPath);
    if (content) {
      sections.push(resolved.label + ':\n' + content);
    }
  }

  return sections;
}

export function buildRepoSummary(config: WyvernConfig, projectPath: string): string {
  const parts: string[] = [];

  for (const [alias, repoDir] of Object.entries(config.repos)) {
    if (!fs.existsSync(repoDir)) continue;

    const tree = buildRepoTree(repoDir);
    if (tree.length > 0) {
      parts.push('Repository "' + alias + '":\n' + tree.map(l => '  ' + l).join('\n'));
    }
  }

  const fileSections = readContextFiles(config.context_files, config.repos, projectPath);
  for (const section of fileSections) {
    parts.push(section);
  }

  if (parts.length === 0) return '';
  return '--- Project Context ---\n\n' + parts.join('\n\n');
}
