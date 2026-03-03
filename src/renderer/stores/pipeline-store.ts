import { create } from 'zustand';
import { PipelineState, AgentNode } from '../../types';

interface PipelineStore {
  pipelines: PipelineState[];
  activePipelineId: string | null;
  selectedAgentId: string | null;
  selectedRoleSlug: string | null;
  creatingRole: boolean;

  setActivePipeline: (id: string) => void;
  selectAgent: (id: string | null) => void;
  selectRole: (slug: string | null) => void;
  setCreatingRole: (v: boolean) => void;
  updatePipeline: (state: PipelineState) => void;
  addPipeline: (state: PipelineState) => void;
  setPipelines: (pipelines: PipelineState[]) => void;

  getActivePipeline: () => PipelineState | null;
  getSelectedAgent: () => AgentNode | null;
}

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  pipelines: [],
  activePipelineId: null,
  selectedAgentId: null,
  selectedRoleSlug: null,
  creatingRole: false,

  setActivePipeline: (id) => set({ activePipelineId: id }),

  selectAgent: (id) => set({ selectedAgentId: id, selectedRoleSlug: null, creatingRole: false }),

  selectRole: (slug) => set({ selectedRoleSlug: slug, selectedAgentId: null, creatingRole: false }),

  setCreatingRole: (v) => set(v ? { creatingRole: true, selectedAgentId: null, selectedRoleSlug: null } : { creatingRole: false }),

  updatePipeline: (state) => set((prev) => {
    const idx = prev.pipelines.findIndex((p) => p.id === state.id);
    let pipelines: PipelineState[];
    if (idx === -1) {
      pipelines = [...prev.pipelines, state];
    } else {
      pipelines = [...prev.pipelines];
      pipelines[idx] = state;
    }
    const activePipelineId = state.status === 'active'
      ? state.id
      : prev.activePipelineId;
    return { pipelines, activePipelineId };
  }),

  addPipeline: (state) => set((prev) => ({
    pipelines: [...prev.pipelines, state],
  })),

  setPipelines: (pipelines) => set({ pipelines }),

  getActivePipeline: () => {
    const { pipelines, activePipelineId } = get();
    if (!activePipelineId) return null;
    return pipelines.find((p) => p.id === activePipelineId) ?? null;
  },

  getSelectedAgent: () => {
    const { selectedAgentId } = get();
    const pipeline = get().getActivePipeline();
    if (!pipeline || !selectedAgentId) return null;
    return pipeline.agents[selectedAgentId] ?? null;
  },
}));
