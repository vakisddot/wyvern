import { useState, useEffect } from 'react';
import { usePipelineStore } from '../stores/pipeline-store';
import { useChatStore } from '../stores/chat-store';
import { AgentNode } from '../../types';

type Tab = 'artifacts' | 'logs' | 'config';

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

  const roleName = agent.role;
  const basePath = `.wyvern/pipelines/${agent.pipelineId}/${roleName}`;

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
      <p className="text-xs text-gray-500 truncate">{basePath}/</p>
      <div className="text-xs">
        <FileFolder name="input" files={agent.inputArtifacts} onFileClick={handleFileClick} selectedFile={selectedFile} />
        <FileFolder name="output" files={agent.outputArtifacts} onFileClick={handleFileClick} selectedFile={selectedFile} />
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

function FileFolder({ name, files, onFileClick, selectedFile }: {
  name: string;
  files: string[];
  onFileClick: (path: string) => void;
  selectedFile: string | null;
}) {
  if (files.length === 0) return null;
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1 text-gray-400">
        <span className="text-gray-600">&#9660;</span>
        <span>{name}/</span>
      </div>
      {files.map((f) => {
        const fileName = f.split('/').pop() ?? f;
        const isSelected = selectedFile === f;
        return (
          <div
            key={f}
            className={`ml-4 cursor-pointer ${isSelected ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
            onClick={() => onFileClick(f)}
          >
            {fileName}
          </div>
        );
      })}
    </div>
  );
}

function LogsTab({ agent }: { agent: AgentNode }) {
  const messages = useChatStore((s) => s.messages);
  const agentMessages = messages.filter((m) => m.type === 'agent-output' && m.agentId === agent.id);

  return (
    <div className="flex-1 overflow-y-auto">
      {agentMessages.length === 0 ? (
        <p className="text-xs text-gray-500 text-center mt-4">No output yet</p>
      ) : (
        <pre className="text-xs text-gray-400 whitespace-pre-wrap">
          {agentMessages.map((m) => m.content).join('')}
        </pre>
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

export function DetailPanel() {
  const agent = usePipelineStore((s) => s.getSelectedAgent());
  const [activeTab, setActiveTab] = useState<Tab>('artifacts');

  const roleName = agent
    ? agent.role.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
    : '';

  return (
    <div className="w-[350px] min-w-[350px] bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100">Detail Panel</h2>
        {agent && (
          <p className="text-xs text-gray-400 mt-0.5">&apos;{roleName}&apos;</p>
        )}
      </div>
      {agent && (
        <div className="flex gap-3 px-3 py-2 border-b border-gray-700">
          <TabButton label="Artifacts" active={activeTab === 'artifacts'} onClick={() => setActiveTab('artifacts')} />
          <TabButton label="Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <TabButton label="Config" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col">
        {!agent ? (
          <p className="text-xs text-gray-500 text-center mt-8">Select an agent to view details</p>
        ) : (
          <>
            {activeTab === 'artifacts' && <ArtifactsTab agent={agent} />}
            {activeTab === 'logs' && <LogsTab agent={agent} />}
            {activeTab === 'config' && <ConfigTab agent={agent} />}
          </>
        )}
      </div>
      {agent && (
        <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-500 flex justify-between">
          <span>Model: {agent.role}</span>
          <span>Depth: {agent.depth}</span>
        </div>
      )}
    </div>
  );
}
