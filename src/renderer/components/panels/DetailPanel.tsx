import { useState, useEffect } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store';
import { AgentNode, RoleDefinition, WyvernConfig } from '../../../types';
import { formatRoleName } from '../../../format-role-name';
import { FilePath } from '../shared/FilePath';
import { ProjectData } from '../screens/Workspace';
import { useYamlEditor } from '../../hooks/useYamlEditor';
import newRoleTemplate from '../../../main/templates/new-role.yaml';

type Tab = 'artifacts' | 'config';

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

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`text-xs transition-colors ${active ? 'text-white underline underline-offset-4' : 'text-gray-500 hover:text-gray-300'}`}
      onClick={onClick}
    >[{label}]</button>
  );
}

function ArtifactsTab({ agent }: { agent: AgentNode }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allFiles = [...agent.inputArtifacts, ...agent.outputArtifacts];

  useEffect(() => {
    setSelectedFile(null);
    setFileContent(null);
  }, [agent.id]);

  function handleFileClick(path: string) {
    setSelectedFile(path);
    setLoading(true);
    window.wyvern.getArtifact(path).then((content) => {
      setFileContent(content);
      setLoading(false);
    }).catch(() => {
      setFileContent('Error loading file');
      setLoading(false);
    });
  }

  return (
    <div className="flex flex-col gap-2 flex-1 overflow-hidden">
      <p className="text-xs text-gray-500 truncate">{agent.role}-{agent.id}</p>
      <div className="text-xs">
        {allFiles.map((f) => {
          const fileName = f.split(/[/\\]/).pop() ?? f;
          const isSelected = selectedFile === f;
          return (
            <div
              key={f}
              className={`cursor-pointer ${isSelected ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
              onClick={() => handleFileClick(f)}
            >
              {fileName}
            </div>
          );
        })}
      </div>
      {selectedFile && (
        <div className="flex-1 overflow-y-auto border border-gray-700 bg-gray-950 mt-2">
          {loading ? (
            <p className="text-xs text-gray-500 p-2">Loading...</p>
          ) : (
            <pre className="text-xs text-gray-300 p-2 whitespace-pre-wrap">
              {fileContent?.split('\n').map((line, i) => (
                <div key={i} className="flex">
                  <span className="text-gray-600 select-none w-8 text-right pr-2 shrink-0">{i + 1}</span>
                  <span>{line}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function ConfigTab({ agent }: { agent: AgentNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <pre className="text-xs text-gray-400 whitespace-pre-wrap">
{`role: ${agent.role}
status: ${agent.status}
depth: ${agent.depth}
pipelineId: ${agent.pipelineId}
children: ${agent.spawnedChildren.length}`}
      </pre>
    </div>
  );
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ');
}

function renderValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).map(([k, v]) => `${formatLabel(k)}: ${v}`).join('\n');
  }
  return '';
}

function YamlEditor({ content, saving, error, onSave, onCancel }: {
  content: string;
  saving: boolean;
  error: string | null;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(content);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <textarea
        className="flex-1 bg-gray-950 border border-gray-700 text-xs text-gray-300 p-2 resize-none focus:outline-none focus:border-gray-500 font-mono"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      {error && (
        <p className="text-xs text-red-400 px-1 py-1 break-words">{error}</p>
      )}
      <div className="flex gap-3 pt-2">
        <button
          className="text-xs text-gray-300 hover:text-white transition-colors disabled:text-gray-600"
          onClick={() => onSave(value)}
          disabled={saving}
        >{saving ? '[Saving...]' : '[Save]'}</button>
        <button
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          onClick={onCancel}
          disabled={saving}
        >[Cancel]</button>
      </div>
    </div>
  );
}

function InlineConfirm({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-amber-400">{message}</span>
      <button className="text-red-400 hover:text-red-300 transition-colors" onClick={onConfirm}>[Confirm]</button>
      <button className="text-gray-500 hover:text-gray-300 transition-colors" onClick={onCancel}>[Cancel]</button>
    </div>
  );
}

function ReadOnlyFields({ entries }: { entries: [string, unknown][] }) {
  return (
    <>
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{formatLabel(key)}</span>
          <span className="text-xs text-gray-300 whitespace-pre-wrap">{renderValue(value)}</span>
        </div>
      ))}
    </>
  );
}

function RoleDetailView({ slug, role, filePath, projectPath, onProjectUpdate }: {
  slug: string;
  role: RoleDefinition;
  filePath: string;
  projectPath: string;
  onProjectUpdate: (data: ProjectData) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const selectRole = usePipelineStore((s) => s.selectRole);

  const editor = useYamlEditor({
    filePath,
    saveFn: (content) => window.wyvern.saveRole(projectPath, slug, content),
    onSuccess: ({ config, roles }) => onProjectUpdate({ projectPath, config, roles }),
  });

  useEffect(() => {
    setConfirmingDelete(false);
  }, [slug]);

  function handleDelete() {
    window.wyvern.deleteRole(projectPath, slug).then((result) => {
      if (!result.ok || !result.config || !result.roles) {
        editor.setError(result.error || 'Unknown error');
        setConfirmingDelete(false);
        return;
      }
      selectRole(null);
      onProjectUpdate({ projectPath, config: result.config, roles: result.roles });
    });
  }

  const entries = Object.entries(role).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  if (editor.editing) {
    return (
      <YamlEditor
        content={editor.yamlContent}
        saving={editor.saving}
        error={editor.error}
        onSave={editor.handleSave}
        onCancel={editor.handleCancel}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button className="text-xs text-gray-500 hover:text-cyan-400 transition-colors" onClick={editor.handleEdit}>[Edit]</button>
        {confirmingDelete ? (
          <InlineConfirm message={`Delete '${slug}'?`} onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
        ) : (
          <button className="text-xs text-gray-500 hover:text-red-400 transition-colors" onClick={() => setConfirmingDelete(true)}>[Delete]</button>
        )}
      </div>
      {editor.error && <p className="text-xs text-red-400 break-words">{editor.error}</p>}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">source</span>
        <FilePath path={filePath} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">slug</span>
        <span className="text-xs text-gray-400">{slug}</span>
      </div>
      <ReadOnlyFields entries={entries} />
    </div>
  );
}

function AgentDetailView({ agent }: { agent: AgentNode }) {
  const [activeTab, setActiveTab] = useState<Tab>('artifacts');
  const roleName = formatRoleName(agent.role);

  return (
    <>
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100">Detail Panel</h2>
        <p className="text-xs text-gray-400 mt-0.5">&apos;{roleName}&apos;</p>
      </div>
      <div className="flex gap-3 px-3 py-2 border-b border-gray-700">
        <TabButton label="Artifacts" active={activeTab === 'artifacts'} onClick={() => setActiveTab('artifacts')} />
        <TabButton label="Config" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col">
        {activeTab === 'artifacts' && <ArtifactsTab agent={agent} />}
        {activeTab === 'config' && <ConfigTab agent={agent} />}
      </div>
      <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
        <span>Model: {agent.role}</span>
        <span>Depth: {agent.depth}</span>
      </div>
    </>
  );
}

function ProjectDetailView({ config, filePath, projectPath, onProjectUpdate }: {
  config: WyvernConfig;
  filePath: string;
  projectPath: string;
  onProjectUpdate: (data: ProjectData) => void;
}) {
  const editor = useYamlEditor({
    filePath,
    saveFn: (content) => window.wyvern.saveConfig(projectPath, content),
    onSuccess: ({ config, roles }) => onProjectUpdate({ projectPath, config, roles }),
  });

  const entries = Object.entries(config).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    return true;
  });

  if (editor.editing) {
    return (
      <YamlEditor
        content={editor.yamlContent}
        saving={editor.saving}
        error={editor.error}
        onSave={editor.handleSave}
        onCancel={editor.handleCancel}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button className="text-xs text-gray-500 hover:text-cyan-400 transition-colors" onClick={editor.handleEdit}>[Edit]</button>
      </div>
      {editor.error && <p className="text-xs text-red-400 break-words">{editor.error}</p>}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">source</span>
        <FilePath path={filePath} />
      </div>
      <ReadOnlyFields entries={entries} />
    </div>
  );
}

function CreateRoleView({ projectPath, onProjectUpdate }: {
  projectPath: string;
  onProjectUpdate: (data: ProjectData) => void;
}) {
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setCreatingRole = usePipelineStore((s) => s.setCreatingRole);
  const selectRole = usePipelineStore((s) => s.selectRole);

  function handleCreate(content: string) {
    const trimmedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!trimmedSlug) {
      setError('Slug is required');
      return;
    }
    setSaving(true);
    setError(null);
    window.wyvern.createRole(projectPath, trimmedSlug, content).then((result) => {
      setSaving(false);
      if (!result.ok || !result.config || !result.roles) {
        setError(result.error || 'Unknown error');
        return;
      }
      setCreatingRole(false);
      onProjectUpdate({ projectPath, config: result.config, roles: result.roles });
      selectRole(trimmedSlug);
    });
  }

  return (
    <div className="flex flex-col gap-2 flex-1 overflow-hidden">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">slug (filename)</span>
        <input
          type="text"
          className="bg-gray-800 border border-gray-600 text-gray-100 text-sm px-2 py-1 focus:border-cyan-400 focus:outline-none"
          placeholder="my-role"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>
      <YamlEditor
        content={newRoleTemplate}
        saving={saving}
        error={error}
        onSave={handleCreate}
        onCancel={() => setCreatingRole(false)}
      />
    </div>
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
      <div className="bg-gray-900 shrink-0 flex flex-col overflow-hidden" style={style}>
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
    <div className="bg-gray-900 shrink-0 flex flex-col overflow-hidden" style={style}>
      <PanelShell subtitle={subtitle} footer={footer}>
        {content}
      </PanelShell>
    </div>
  );
}
