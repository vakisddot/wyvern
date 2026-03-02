import { RoleDefinition } from '../types';

function buildWyvernInstructions(canSpawn: string[]): string {
  const lines: string[] = [
    'You are operating within the Wyvern orchestration system. You MUST use these commands to communicate:',
    '',
  ];

  if (canSpawn.length > 0) {
    lines.push('To delegate work to another agent:');
    lines.push('[WYVERN:SPAWN] role=<role-slug> input=<filename>');
    lines.push('Write the input file content before spawning.');
    lines.push('');
  }

  lines.push('To pause and ask the CEO for approval or input:');
  lines.push('[WYVERN:CHECKPOINT] message=<your message to the CEO>');
  lines.push('');
  lines.push('When you are completely done with your task:');
  lines.push('[WYVERN:DONE] output=<filename>');
  lines.push('Write your output/results to the file before emitting DONE.');
  lines.push('');
  lines.push('You MUST emit exactly one [WYVERN:DONE] command when your work is complete.');

  return lines.join('\n');
}

function buildAvailableRoles(canSpawn: string[], allRoles: Record<string, RoleDefinition>): string {
  if (canSpawn.length === 0) return '';

  const lines = ['Available roles you can spawn:'];
  for (const slug of canSpawn) {
    const r = allRoles[slug];
    if (r) {
      lines.push(`- ${slug}: ${r.name} — ${r.description}`);
    }
  }
  return lines.join('\n');
}

export function buildPrompt(
  role: RoleDefinition,
  allRoles: Record<string, RoleDefinition>,
  inputContent: string,
  pipelineContext: string
): string {
  const sections: string[] = [];

  sections.push(role.system_prompt);
  sections.push(buildWyvernInstructions(role.can_spawn));

  const rolesSection = buildAvailableRoles(role.can_spawn, allRoles);
  if (rolesSection) {
    sections.push(rolesSection);
  }

  if (pipelineContext) {
    sections.push('--- Pipeline Context ---\n' + pipelineContext);
  }

  if (inputContent) {
    sections.push('--- Input ---\n' + inputContent);
  }

  return sections.join('\n\n');
}
