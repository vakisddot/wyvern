import fs from 'fs';
import path from 'path';

function pipelineDir(projectPath: string, pipelineId: string): string {
  return path.join(projectPath, '.wyvern', 'pipelines', pipelineId);
}

export function initPipeline(projectPath: string, pipelineId: string, directive: string): void {
  const dir = pipelineDir(projectPath, pipelineId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'directive.md'), directive, 'utf-8');
  fs.writeFileSync(path.join(dir, 'pipeline-state.json'), '{}', 'utf-8');
}

export function ensureAgentDirs(
  projectPath: string,
  pipelineId: string,
  roleSlug: string
): { inputDir: string; outputDir: string; tasksDir: string } {
  const base = path.join(pipelineDir(projectPath, pipelineId), roleSlug);
  const inputDir = path.join(base, 'input');
  const outputDir = path.join(base, 'output');
  const tasksDir = path.join(base, 'tasks');

  fs.mkdirSync(inputDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tasksDir, { recursive: true });

  return { inputDir, outputDir, tasksDir };
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
