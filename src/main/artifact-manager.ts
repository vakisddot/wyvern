import fs from 'fs';
import path from 'path';

function pipelineDir(dataDir: string, pipelineId: string): string {
  return path.join(dataDir, 'pipelines', pipelineId);
}

export function initPipeline(dataDir: string, pipelineId: string, directive: string): void {
  const dir = pipelineDir(dataDir, pipelineId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'directive.md'), directive, 'utf-8');
  fs.writeFileSync(path.join(dir, 'pipeline-state.json'), '{}', 'utf-8');
}

export function ensureAgentDir(
  dataDir: string,
  pipelineId: string,
  roleSlug: string,
  agentId: string
): string {
  const dir = path.join(pipelineDir(dataDir, pipelineId), roleSlug + '-' + agentId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeArtifact(dir: string, filename: string, content: string): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

export function readArtifact(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

export function listArtifacts(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir);
}
