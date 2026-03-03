import { usePipelineStore } from '../stores/pipeline-store';
import { AgentNode, AgentStatus, RoleDefinition } from '../../types';
import claudeLogo from '../assets/claude-color.png';
import geminiLogo from '../assets/gemini-color.png';

const PROVIDER_LOGOS: Record<string, string> = {
  claude: claudeLogo,
  gemini: geminiLogo,
};

const STATUS_COLORS: Record<AgentStatus, { stroke: string; glow: string; text: string }> = {
  running:     { stroke: '#fbbf24', glow: '0 0 12px rgba(251,191,36,0.5)',  text: 'text-amber-400' },
  done:        { stroke: '#34d399', glow: '0 0 12px rgba(52,211,153,0.5)',  text: 'text-emerald-400' },
  failed:      { stroke: '#f87171', glow: '0 0 12px rgba(248,113,113,0.5)', text: 'text-red-400' },
  waiting_ceo: { stroke: '#22d3ee', glow: '0 0 12px rgba(34,211,238,0.5)',  text: 'text-cyan-400' },
  pending:     { stroke: '#60a5fa', glow: '0 0 12px rgba(96,165,250,0.5)',  text: 'text-blue-400' },
};

const HEX_POINTS = '20,2 37,11 37,29 20,38 3,29 3,11';

function statusLabel(status: AgentStatus): string {
  return status === 'waiting_ceo' ? 'WAITING CEO' : status.toUpperCase();
}

function HexNode({ agent, role, isSelected, onClick }: {
  agent: AgentNode;
  role: RoleDefinition | undefined;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colors = STATUS_COLORS[agent.status];
  const roleName = agent.role.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  const logo = role ? PROVIDER_LOGOS[role.model.provider] : undefined;
  const modelName = role ? role.model.variant : undefined;

  return (
    <div className="flex items-center gap-3 cursor-pointer group" onClick={onClick}>
      <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0" style={{ filter: `drop-shadow(${colors.glow})` }}>
        <polygon
          points={HEX_POINTS}
          fill="#1f2937"
          stroke={colors.stroke}
          strokeWidth={isSelected ? 3 : 2}
        />
        <text x="20" y="24" textAnchor="middle" fill="white" fontSize="12" fontWeight="600">{roleName[0]}</text>
      </svg>
      <div className="flex flex-col">
        <span className="flex items-center gap-1.5 text-gray-100 text-xs group-hover:text-white">
          {logo && <img src={logo} alt="" className="w-3.5 h-3.5" />}
          {roleName}
        </span>
        {modelName && <span className="text-[10px] text-gray-500">{modelName}</span>}
        <span className={`text-xs ${colors.text}`}>[{statusLabel(agent.status)}]</span>
      </div>
    </div>
  );
}

function AgentTreeNode({ agentId, agents, roles, depth, selectedAgentId, onSelect }: {
  agentId: string;
  agents: Record<string, AgentNode>;
  roles: Record<string, RoleDefinition>;
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
          role={roles[agent.role]}
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
              roles={roles}
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

export function PipelineTree({ roles, style }: { roles: Record<string, RoleDefinition>; style?: React.CSSProperties }) {
  const pipeline = usePipelineStore((s) => s.getActivePipeline());
  const selectedAgentId = usePipelineStore((s) => s.selectedAgentId);
  const selectAgent = usePipelineStore((s) => s.selectAgent);

  return (
    <div className="bg-gray-900 shrink-0 flex flex-col overflow-hidden" style={style}>
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100">Pipeline Tree</h2>
        <p className="text-xs text-gray-400 mt-0.5">Active agent hierarchy</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!pipeline ? (
          <p className="text-xs text-gray-500 text-center mt-8">No active pipeline</p>
        ) : (
          <AgentTreeRoot pipeline={pipeline} roles={roles} selectedAgentId={selectedAgentId} onSelect={selectAgent} />
        )}
      </div>
    </div>
  );
}

function AgentTreeRoot({ pipeline, roles, selectedAgentId, onSelect }: {
  pipeline: { agents: Record<string, AgentNode>; entryAgentId: string };
  roles: Record<string, RoleDefinition>;
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
      roles={roles}
      depth={0}
      selectedAgentId={selectedAgentId}
      onSelect={onSelect}
    />
  );
}
