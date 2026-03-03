import { RoleDefinition } from '../types';
import { formatRoleName } from '../format-role-name';

function buildWyvernInstructions(canSpawn: string[], agentDir: string): string {
  const outputPath = agentDir.replace(/\\/g, '/') + '/output.md';
  const agentDirFwd = agentDir.replace(/\\/g, '/');
  const lines: string[] = [
    '=== WYVERN PROTOCOL (mandatory) ===',
    '',
    'You MUST write a file to this exact absolute path (the directory already exists):',
    outputPath,
    '',
    'Do NOT mkdir or create directories. Do NOT write to your current working directory.',
    'Just write the file directly to the path above. This is how the orchestrator detects your work is complete.',
    '',
  ];

  if (canSpawn.length > 0) {
    lines.push('SPAWNING: To delegate work to another agent:');
    lines.push('1. Write each task brief as a separate .md file in: ' + agentDirFwd);
    lines.push('2. Add a SPAWN line to output.md for each task:');
    lines.push('   [WYVERN:SPAWN] role=<role-slug> input=<task-filename.md>');
    lines.push('3. Do NOT add a DONE line when you include SPAWN lines.');
    lines.push('   You will be re-invoked with results and can emit DONE then.');
    lines.push('');
    lines.push('CHECKPOINT: To pause and ask the CEO for input:');
    lines.push('   [WYVERN:CHECKPOINT] message=<your question>');
    lines.push('');
    lines.push('Example output.md with spawns:');
    lines.push('```');
    lines.push('Your analysis and reasoning here...');
    lines.push('');
    lines.push('[WYVERN:SPAWN] role=worker input=task-brief.md');
    lines.push('```');
  } else {
    lines.push('COMPLETION: When your work is done, the LAST line of output.md must be:');
    lines.push('   [WYVERN:DONE] output=output.md');
    lines.push('');
    lines.push('CHECKPOINT: To pause and ask the CEO for input:');
    lines.push('   [WYVERN:CHECKPOINT] message=<your question>');
    lines.push('');
    lines.push('Example output.md:');
    lines.push('```');
    lines.push('Your research, analysis, or deliverable here...');
    lines.push('');
    lines.push('[WYVERN:DONE] output=output.md');
    lines.push('```');
  }

  lines.push('');
  lines.push('The [WYVERN:...] lines must appear EXACTLY as shown - brackets, colons, and spacing included.');
  lines.push('Write the file to: ' + outputPath);

  return lines.join('\n');
}

function buildAvailableRoles(canSpawn: string[], allRoles: Record<string, RoleDefinition>): string {
  if (canSpawn.length === 0) return '';

  const lines = ['Available roles you can spawn:'];
  for (const slug of canSpawn) {
    const r = allRoles[slug];
    if (r) {
      lines.push(`- ${slug}: ${formatRoleName(slug)} - ${r.description}`);
    }
  }
  return lines.join('\n');
}

export function buildPrompt(
  role: RoleDefinition,
  allRoles: Record<string, RoleDefinition>,
  inputContent: string,
  pipelineContext: string,
  agentDir: string
): string {
  const sections: string[] = [];

  sections.push(role.system_prompt);
  sections.push(buildWyvernInstructions(role.can_spawn, agentDir));

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
