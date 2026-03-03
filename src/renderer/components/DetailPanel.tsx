import { useState, useEffect } from 'react';
import { usePipelineStore } from '../stores/pipeline-store';
import { AgentNode, RoleDefinition, WyvernConfig } from '../../types';
import { FilePath } from './FilePath';

type Tab = 'artifacts' | 'config';

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

function RoleDetailView({ slug, role, filePath }: { slug: string; role: RoleDefinition; filePath: string }) {
  const entries = Object.entries(role).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">source</span>
        <FilePath path={filePath} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">slug</span>
        <span className="text-xs text-gray-400">{slug}</span>
      </div>
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{formatLabel(key)}</span>
          <span className="text-xs text-gray-300 whitespace-pre-wrap">{renderValue(value)}</span>
        </div>
      ))}
    </div>
  );
}

function AgentDetailView({ agent }: { agent: AgentNode }) {
  const [activeTab, setActiveTab] = useState<Tab>('artifacts');
  const roleName = agent.role.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

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

function ProjectDetailView({ config, filePath }: { config: WyvernConfig; filePath: string }) {
  const entries = Object.entries(config).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">source</span>
        <FilePath path={filePath} />
      </div>
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{formatLabel(key)}</span>
          <span className="text-xs text-gray-300 whitespace-pre-wrap">{renderValue(value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DetailPanel({ roles, config, projectPath, style }: { roles: Record<string, RoleDefinition>; config: WyvernConfig; projectPath: string; style?: React.CSSProperties }) {
  const agent = usePipelineStore((s) => s.getSelectedAgent());
  const selectedRoleSlug = usePipelineStore((s) => s.selectedRoleSlug);
  const selectedRole = selectedRoleSlug ? roles[selectedRoleSlug] ?? null : null;

  return (
    <div className="bg-gray-900 shrink-0 flex flex-col overflow-hidden" style={style}>
      {agent ? (
        <AgentDetailView agent={agent} />
      ) : selectedRole && selectedRoleSlug ? (
        <>
          <div className="p-3 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-100">Detail Panel</h2>
            <p className="text-xs text-gray-400 mt-0.5">&apos;{selectedRole.name}&apos;</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <RoleDetailView slug={selectedRoleSlug} role={selectedRole} filePath={`${projectPath}/.wyvern/roles/${selectedRoleSlug}.yaml`} />
          </div>
          <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
            <span>Model: {selectedRole.model.provider}/{selectedRole.model.variant}</span>
            <span>Depth: {selectedRole.max_depth}</span>
          </div>
        </>
      ) : (
        <>
          <div className="p-3 border-b border-gray-700">
            <h2 className="text-sm font-semibold text-gray-100">Detail Panel</h2>
            <p className="text-xs text-gray-400 mt-0.5">&apos;{config.project.name}&apos;</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ProjectDetailView config={config} filePath={`${projectPath}/wyvern.yaml`} />
          </div>
        </>
      )}
    </div>
  );
}
