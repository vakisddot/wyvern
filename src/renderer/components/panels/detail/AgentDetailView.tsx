import { useState, useEffect } from 'react';
import { AgentNode } from '../../../../types';
import { formatRoleName } from '../../../../format-role-name';

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

export function AgentDetailView({ agent }: { agent: AgentNode }) {
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
