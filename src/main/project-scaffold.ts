import fs from 'fs';
import path from 'path';
import wyvernTemplate from './templates/wyvern.yaml';
import pmTemplate from './templates/roles/pm.yaml';
import workerTemplate from './templates/roles/worker.yaml';

export function scaffoldProject(dirPath: string, projectName: string): void {
  const configPath = path.join(dirPath, 'wyvern.yaml');
  if (fs.existsSync(configPath)) {
    throw new Error(`Directory already contains a Wyvern project: ${configPath}`);
  }

  const configYaml = wyvernTemplate.replace('{{PROJECT_NAME}}', projectName);
  fs.writeFileSync(configPath, configYaml, 'utf-8');

  const rolesDir = path.join(dirPath, '.wyvern', 'roles');
  fs.mkdirSync(rolesDir, { recursive: true });

  fs.writeFileSync(path.join(rolesDir, 'pm.yaml'), pmTemplate, 'utf-8');
  fs.writeFileSync(path.join(rolesDir, 'worker.yaml'), workerTemplate, 'utf-8');
}
