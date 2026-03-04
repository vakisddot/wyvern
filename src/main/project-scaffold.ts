import fs from 'fs';
import path from 'path';
import wyvernTemplate from './templates/wyvern.yaml';
import pmTemplate from './templates/roles/product-manager.yaml';
import workerTemplate from './templates/roles/worker.yaml';
import roleDesignerSkill from './templates/skills/role-designer.md';

export function scaffoldProject(dirPath: string, projectName: string): void {
  const configPath = path.join(dirPath, 'wyvern.yaml');
  if (fs.existsSync(configPath)) {
    throw new Error(`Directory already contains a Wyvern project: ${configPath}`);
  }

  const configYaml = wyvernTemplate.replace('{{PROJECT_NAME}}', projectName);
  fs.writeFileSync(configPath, configYaml, 'utf-8');

  const rolesDir = path.join(dirPath, 'roles');
  fs.mkdirSync(rolesDir, { recursive: true });
  fs.writeFileSync(path.join(rolesDir, 'product-manager.yaml'), pmTemplate, 'utf-8');
  fs.writeFileSync(path.join(rolesDir, 'worker.yaml'), workerTemplate, 'utf-8');

  const skillDir = path.join(dirPath, '.claude', 'skills', 'role-designer');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), roleDesignerSkill, 'utf-8');
}
