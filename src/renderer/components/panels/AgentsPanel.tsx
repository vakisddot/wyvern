import { useState, useRef, useCallback } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store';
import { AgentNode, AgentStatus, PipelineState, PipelineStatus, RoleDefinition } from '../../../types';
import { formatRoleName } from '../../../format-role-name';
import claudeLogo from '../../assets/claude-color.png';
import geminiLogo from '../../assets/gemini-color.png';

const PROVIDER_LOGOS: Record<string, string> = {
  claude: claudeLogo,
  gemini: geminiLogo,
};

const STATUS_COLORS: Record<AgentStatus, { stroke: string; glow: string; text: string }> = {
  running:     { stroke: '#fbbf24', glow: '0 0 12px rgba(251,191,36,0.5)',  text: 'text-amber-400' },
  done:        { stroke: '#34d399', glow: '0 0 12px rgba(52,211,153,0.5)',  text: 'text-emerald-400' },
  failed:      { stroke: '#f87171', glow: '0 0 12px rgba(248,113,113,0.5)', text: 'text-red-400' },
  pending:     { stroke: '#60a5fa', glow: '0 0 12px rgba(96,165,250,0.5)',  text: 'text-blue-400' },
};

const HEX_POINTS = '20,2 37,11 37,29 20,38 3,29 3,11';

function statusLabel(status: AgentStatus): string {
  return status.toUpperCase();
}

// --- Shared hex row used by both pipeline agents and role roster ---

function HexRow({ letter, strokeColor, glowStyle, logo, name, modelLabel, badge, isSelected, onClick }: {
  letter: string;
  strokeColor: string;
  glowStyle: string;
  logo?: string;
  name: string;
  modelLabel: string;
  badge?: { text: string; className: string };
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 cursor-pointer group" onClick={onClick}>
      <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0" style={{ filter: `drop-shadow(${glowStyle})` }}>
        <polygon
          points={HEX_POINTS}
          fill="#1f2937"
          stroke={strokeColor}
          strokeWidth={isSelected ? 3 : 2}
        />
        <text x="20" y="24" textAnchor="middle" fill="white" fontSize="12" fontWeight="600">{letter}</text>
      </svg>
      <div className="flex flex-col">
        <span className="flex items-center gap-1.5 text-gray-100 text-xs group-hover:text-white">
          {logo && <img src={logo} alt="" className="w-3.5 h-3.5" />}
          {name}
        </span>
        <span className="text-[10px] text-gray-500">{modelLabel}</span>
        {badge && <span className={`text-xs ${badge.className}`}>[{badge.text}]</span>}
      </div>
    </div>
  );
}

function modelLabel(role: RoleDefinition): string {
  return `${role.model.provider}/${role.model.variant}`;
}

// --- Pipeline agent nodes ---

function AgentHexNode({ agent, role, isSelected, onClick }: {
  agent: AgentNode;
  role: RoleDefinition | undefined;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colors = STATUS_COLORS[agent.status];
  const name = formatRoleName(agent.role);
  const logo = role ? PROVIDER_LOGOS[role.model.provider] : undefined;

  return (
    <HexRow
      letter={name[0]}
      strokeColor={colors.stroke}
      glowStyle={colors.glow}
      logo={logo}
      name={name}
      modelLabel={role ? modelLabel(role) : agent.role}
      badge={{ text: statusLabel(agent.status), className: colors.text }}
      isSelected={isSelected}
      onClick={onClick}
    />
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
        <AgentHexNode
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

// --- Role roster ---

function RoleRoster({ roles, selectedSlug, onSelect }: {
  roles: Record<string, RoleDefinition>;
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const slugs = Object.keys(roles);
  if (slugs.length === 0) {
    return <p className="text-xs text-gray-500 text-center mt-8">No roles configured</p>;
  }

  const sorted = [...slugs].sort((a, b) => {
    if (roles[a].entry_point) return -1;
    if (roles[b].entry_point) return 1;
    return 0;
  });

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((slug) => {
        const role = roles[slug];
        const isEntry = role.entry_point === true;
        return (
          <HexRow
            key={slug}
            letter={formatRoleName(slug).charAt(0).toUpperCase()}
            strokeColor={isEntry ? '#22d3ee' : '#4b5563'}
            glowStyle={isEntry ? '0 0 8px rgba(34,211,238,0.3)' : 'none'}
            logo={PROVIDER_LOGOS[role.model.provider]}
            name={formatRoleName(slug)}
            modelLabel={modelLabel(role)}
            badge={isEntry ? { text: 'ENTRY', className: 'text-cyan-400' } : undefined}
            isSelected={selectedSlug === slug}
            onClick={() => onSelect(slug)}
          />
        );
      })}
    </div>
  );
}

// --- Pipeline history list ---

const PIPELINE_STATUS_COLORS: Record<PipelineStatus, string> = {
  active:    'text-amber-400',
  completed: 'text-emerald-400',
  failed:    'text-red-400',
  paused:    'text-blue-400',
};

function relativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function PipelineList({ pipelines, selectedId, activePipelineId, onSelect }: {
  pipelines: PipelineState[];
  selectedId: string | null;
  activePipelineId: string | null;
  onSelect: (id: string) => void;
}) {
  if (pipelines.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-2">No pipelines</p>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {pipelines.map((p) => {
        const isSelected = p.id === selectedId;
        const isActive = p.id === activePipelineId;
        return (
          <div
            key={p.id}
            className={`px-2 py-1.5 cursor-pointer border-l-2 ${
              isSelected
                ? 'border-cyan-400 bg-gray-800/60'
                : 'border-transparent hover:bg-gray-800/30'
            }`}
            onClick={() => onSelect(p.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs truncate ${isSelected ? 'text-gray-100' : 'text-gray-400'}`}>
                {p.directive.length > 30 ? p.directive.slice(0, 27) + '...' : p.directive}
              </span>
              <span className={`text-[10px] shrink-0 ${PIPELINE_STATUS_COLORS[p.status]}`}>
                [{p.status.toUpperCase()}]
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-gray-600">{relativeTime(p.updatedAt)}</span>
              {isActive && <span className="text-[10px] text-amber-400">*</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Vertical resize handle ---

function VerticalResizeHandle({ onDrag }: { onDrag: (delta: number) => void }) {
  const dragging = useRef(false);
  const lastY = useRef(0);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const delta = e.clientY - lastY.current;
    lastY.current = e.clientY;
    onDrag(delta);
  }, [onDrag]);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    lastY.current = e.clientY;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  return (
    <div
      className="h-1 shrink-0 cursor-row-resize bg-gray-700 hover:bg-gray-500 transition-colors"
      onMouseDown={onMouseDown}
    />
  );
}

// --- Main exported component ---

type LeftTab = 'pipeline' | 'roles';

const TREE_MIN = 80;
const HISTORY_MIN = 60;

export function AgentsPanel({ roles, style }: { roles: Record<string, RoleDefinition>; style?: React.CSSProperties }) {
  const pipelines = usePipelineStore((s) => s.pipelines);
  const activePipelineId = usePipelineStore((s) => s.activePipelineId);
  const selectedPipelineId = usePipelineStore((s) => s.selectedPipelineId);
  const setSelectedPipeline = usePipelineStore((s) => s.setSelectedPipeline);
  const selectedPipeline = usePipelineStore((s) => s.getSelectedPipeline());
  const selectedAgentId = usePipelineStore((s) => s.selectedAgentId);
  const selectedRoleSlug = usePipelineStore((s) => s.selectedRoleSlug);
  const selectAgent = usePipelineStore((s) => s.selectAgent);
  const selectRole = usePipelineStore((s) => s.selectRole);
  const setCreatingRole = usePipelineStore((s) => s.setCreatingRole);
  const [tab, setTab] = useState<LeftTab>('pipeline');
  const [treeHeight, setTreeHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onSplitDrag = useCallback((delta: number) => {
    setTreeHeight((prev) => {
      const container = containerRef.current;
      if (!container) return prev;
      const total = container.offsetHeight;
      const current = prev ?? Math.floor(total * 0.6);
      const next = current + delta;
      return Math.max(TREE_MIN, Math.min(next, total - HISTORY_MIN));
    });
  }, []);

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm shrink-0 flex flex-col overflow-hidden" style={style}>
      <div className="flex items-center gap-3 px-3 pt-3 pb-2 border-b border-gray-700">
        {(['pipeline', 'roles'] as const).map((t) => (
          <button
            key={t}
            className={`text-xs transition-colors ${tab === t ? 'text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
            onClick={() => setTab(t)}
          >[{t === 'pipeline' ? 'Pipeline' : 'Roles'}]</button>
        ))}
        {tab === 'pipeline' && (
          <button
            className="text-xs text-gray-500 hover:text-cyan-400 transition-colors ml-auto"
            onClick={() => setSelectedPipeline(null)}
          >[+ New]</button>
        )}
        {tab === 'roles' && (
          <button
            className="text-xs text-gray-500 hover:text-cyan-400 transition-colors ml-auto"
            onClick={() => setCreatingRole(true)}
          >[+ Add]</button>
        )}
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden flex flex-col">
        {tab === 'pipeline' ? (
          <>
            <div className="overflow-y-auto p-3" style={{ height: treeHeight ?? '60%', minHeight: TREE_MIN }}>
              {selectedPipeline ? (
                <AgentTreeRoot pipeline={selectedPipeline} roles={roles} selectedAgentId={selectedAgentId} onSelect={selectAgent} />
              ) : (
                <p className="text-xs text-gray-500 text-center mt-8">Type a directive in the chat to start a new pipeline</p>
              )}
            </div>
            <VerticalResizeHandle onDrag={onSplitDrag} />
            <div className="flex-1 overflow-y-auto py-1">
              <PipelineList
                pipelines={pipelines}
                selectedId={selectedPipelineId}
                activePipelineId={activePipelineId}
                onSelect={setSelectedPipeline}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-3">
            <RoleRoster roles={roles} selectedSlug={selectedRoleSlug} onSelect={selectRole} />
          </div>
        )}
      </div>
    </div>
  );
}
