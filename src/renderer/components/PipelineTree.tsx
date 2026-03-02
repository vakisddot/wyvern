import { usePipelineStore } from '../stores/pipeline-store';
import { AgentNode, AgentStatus } from '../../types';

const STATUS_COLORS: Record<AgentStatus, { border: string; glow: string; text: string }> = {
  running:     { border: 'border-amber-400',   glow: '0 0 12px rgba(251,191,36,0.5)',  text: 'text-amber-400' },
  done:        { border: 'border-emerald-400', glow: '0 0 12px rgba(52,211,153,0.5)',  text: 'text-emerald-400' },
  failed:      { border: 'border-red-400',     glow: '0 0 12px rgba(248,113,113,0.5)', text: 'text-red-400' },
  waiting_ceo: { border: 'border-cyan-400',    glow: '0 0 12px rgba(34,211,238,0.5)',  text: 'text-cyan-400' },
  pending:     { border: 'border-blue-400',    glow: '0 0 12px rgba(96,165,250,0.5)',  text: 'text-blue-400' },
};

function statusLabel(status: AgentStatus): string {
  return status === 'waiting_ceo' ? 'WAITING CEO' : status.toUpperCase();
}

function HexNode({ agent, isSelected, onClick }: {
  agent: AgentNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colors = STATUS_COLORS[agent.status];
  const roleName = agent.role.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  const letter = roleName[0];

  return (
    <div className="flex items-center gap-3 cursor-pointer group" onClick={onClick}>
      <div
        className={`w-10 h-10 flex items-center justify-center border-2 ${colors.border} bg-gray-800 text-sm font-semibold ${isSelected ? 'ring-1 ring-white/30' : ''}`}
        style={{
          clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
          boxShadow: colors.glow,
        }}
      >
        {letter}
      </div>
      <div className="flex flex-col">
        <span className="text-gray-100 text-xs group-hover:text-white">{roleName}</span>
        <span className={`text-xs ${colors.text}`}>[{statusLabel(agent.status)}]</span>
      </div>
    </div>
  );
}

function AgentTreeNode({ agentId, agents, depth, selectedAgentId, onSelect }: {
  agentId: string;
  agents: Record<string, AgentNode>;
  depth: number;
  selectedAgentId: string | null;
  onSelect: (id: string) => void;
}) {
  const agent = agents[agentId];
  if (!agent) return null;

  const children = Object.values(agents).filter((a) => a.parentId === agentId);

  return (
    <div className="flex flex-col">
      <div className={depth > 0 ? 'ml-5' : ''}>
        {depth > 0 && (
          <div className="ml-[19px] h-4 border-l border-gray-600" />
        )}
        <HexNode
          agent={agent}
          isSelected={selectedAgentId === agentId}
          onClick={() => onSelect(agentId)}
        />
      </div>
      {children.length > 0 && (
        <div className="flex flex-col">
          {children.map((child) => (
            <AgentTreeNode
              key={child.id}
              agentId={child.id}
              agents={agents}
              depth={depth + 1}
              selectedAgentId={selectedAgentId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PipelineTree() {
  const pipeline = usePipelineStore((s) => s.getActivePipeline());
  const selectedAgentId = usePipelineStore((s) => s.selectedAgentId);
  const selectAgent = usePipelineStore((s) => s.selectAgent);

  const totalCost = pipeline?.totalCostUsd ?? 0;

  return (
    <div className="w-[280px] min-w-[280px] bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100">Pipeline Tree</h2>
        <p className="text-xs text-gray-400 mt-0.5">Active agent hierarchy</p>
        <p className="text-xs text-gray-500 mt-0.5">[Total pipeline cost: ${totalCost.toFixed(2)}]</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!pipeline ? (
          <p className="text-xs text-gray-500 text-center mt-8">No active pipeline</p>
        ) : (
          <AgentTreeRoot pipeline={pipeline} selectedAgentId={selectedAgentId} onSelect={selectAgent} />
        )}
      </div>
    </div>
  );
}

function AgentTreeRoot({ pipeline, selectedAgentId, onSelect }: {
  pipeline: { agents: Record<string, AgentNode>; entryAgentId: string };
  selectedAgentId: string | null;
  onSelect: (id: string) => void;
}) {
  const rootId = pipeline.entryAgentId;
  const agents = pipeline.agents;

  if (!agents[rootId]) {
    return <p className="text-xs text-gray-500 text-center mt-8">No agents</p>;
  }

  return (
    <AgentTreeNode
      agentId={rootId}
      agents={agents}
      depth={0}
      selectedAgentId={selectedAgentId}
      onSelect={onSelect}
    />
  );
}
