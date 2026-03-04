import { usePipelineStore } from '../../stores/pipeline-store';
import { RoleDefinition, WyvernConfig } from '../../../types';
import { formatRoleName } from '../../../format-role-name';
import { ProjectData } from '../screens/Workspace';
import { AgentDetailView } from './detail/AgentDetailView';
import { RoleDetailView } from './detail/RoleDetailView';
import { ProjectDetailView } from './detail/ProjectDetailView';
import { CreateRoleView } from './detail/CreateRoleView';

function PanelShell({ subtitle, footer, children }: {
  subtitle: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100">Detail Panel</h2>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col">
        {children}
      </div>
      {footer && (
        <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
          {footer}
        </div>
      )}
    </>
  );
}

interface DetailPanelProps {
  roles: Record<string, RoleDefinition>;
  config: WyvernConfig;
  projectPath: string;
  onProjectUpdate: (data: ProjectData) => void;
  style?: React.CSSProperties;
}

export function DetailPanel({ roles, config, projectPath, onProjectUpdate, style }: DetailPanelProps) {
  const agent = usePipelineStore((s) => s.getSelectedAgent());
  const selectedRoleSlug = usePipelineStore((s) => s.selectedRoleSlug);
  const creatingRole = usePipelineStore((s) => s.creatingRole);
  const selectedRole = selectedRoleSlug ? roles[selectedRoleSlug] ?? null : null;

  if (agent) {
    return (
      <div className="bg-gray-900/80 backdrop-blur-sm shrink-0 flex flex-col overflow-hidden" style={style}>
        <AgentDetailView agent={agent} />
      </div>
    );
  }

  let subtitle = `\u0027${config.project.name}\u0027`;
  let footer: React.ReactNode = null;
  let content: React.ReactNode;

  if (creatingRole) {
    subtitle = 'New Role';
    content = <CreateRoleView projectPath={projectPath} onProjectUpdate={onProjectUpdate} />;
  } else if (selectedRole && selectedRoleSlug) {
    subtitle = `\u0027${formatRoleName(selectedRoleSlug)}\u0027`;
    footer = (
      <>
        <span>Model: {selectedRole.model.provider}/{selectedRole.model.variant}</span>
        <span>Depth: {selectedRole.max_depth}</span>
      </>
    );
    content = (
      <RoleDetailView
        slug={selectedRoleSlug}
        role={selectedRole}
        filePath={`${projectPath}/.wyvern/roles/${selectedRoleSlug}.yaml`}
        projectPath={projectPath}
        onProjectUpdate={onProjectUpdate}
      />
    );
  } else {
    content = (
      <ProjectDetailView
        config={config}
        filePath={`${projectPath}/wyvern.yaml`}
        projectPath={projectPath}
        onProjectUpdate={onProjectUpdate}
      />
    );
  }

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm shrink-0 flex flex-col overflow-hidden" style={style}>
      <PanelShell subtitle={subtitle} footer={footer}>
        {content}
      </PanelShell>
    </div>
  );
}
