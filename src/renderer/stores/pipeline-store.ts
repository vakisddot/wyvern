import { create } from 'zustand';
import { PipelineState, AgentNode } from '../../types';

interface PipelineStore {
  pipelines: PipelineState[];
  activePipelineId: string | null;
  selectedPipelineId: string | null;
  selectedAgentId: string | null;
  selectedRoleSlug: string | null;
  creatingRole: boolean;

  setActivePipeline: (id: string) => void;
  setSelectedPipeline: (id: string | null) => void;
  selectAgent: (id: string | null) => void;
  selectRole: (slug: string | null) => void;
  setCreatingRole: (v: boolean) => void;
  updatePipeline: (state: PipelineState) => void;
  addPipeline: (state: PipelineState) => void;
  setPipelines: (pipelines: PipelineState[]) => void;
  loadHistory: () => Promise<void>;

  getActivePipeline: () => PipelineState | null;
  getSelectedPipeline: () => PipelineState | null;
  getSelectedAgent: () => AgentNode | null;
}

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  pipelines: [],
  activePipelineId: null,
  selectedPipelineId: null,
  selectedAgentId: null,
  selectedRoleSlug: null,
  creatingRole: false,

  setActivePipeline: (id) => set({ activePipelineId: id }),

  setSelectedPipeline: (id) => set({ selectedPipelineId: id, selectedAgentId: null, selectedRoleSlug: null, creatingRole: false }),

  selectAgent: (id) => set({ selectedAgentId: id, selectedRoleSlug: null, creatingRole: false }),

  selectRole: (slug) => set({ selectedRoleSlug: slug, selectedAgentId: null, creatingRole: false }),

  setCreatingRole: (v) => set(v ? { creatingRole: true, selectedAgentId: null, selectedRoleSlug: null } : { creatingRole: false }),

  updatePipeline: (state) => set((prev) => {
    const idx = prev.pipelines.findIndex((p) => p.id === state.id);
    let pipelines: PipelineState[];
    if (idx === -1) {
      pipelines = [state, ...prev.pipelines];
    } else {
      pipelines = [...prev.pipelines];
      pipelines[idx] = state;
    }
    const isNewActive = state.status === 'active';
    return {
      pipelines,
      activePipelineId: isNewActive ? state.id : prev.activePipelineId,
      selectedPipelineId: isNewActive ? state.id : prev.selectedPipelineId,
    };
  }),

  addPipeline: (state) => set((prev) => ({
    pipelines: [...prev.pipelines, state],
  })),

  setPipelines: (pipelines) => set({ pipelines }),

  loadHistory: async () => {
    const pipelines = await window.wyvern.getPipelines();
    pipelines.sort((a: PipelineState, b: PipelineState) => b.createdAt - a.createdAt);
    set({
      pipelines,
      activePipelineId: null,
      selectedPipelineId: null,
    });
  },

  getActivePipeline: () => {
    const { pipelines, activePipelineId } = get();
    if (!activePipelineId) return null;
    return pipelines.find((p) => p.id === activePipelineId) ?? null;
  },

  getSelectedPipeline: () => {
    const { pipelines, selectedPipelineId } = get();
    if (!selectedPipelineId) return null;
    return pipelines.find((p) => p.id === selectedPipelineId) ?? null;
  },

  getSelectedAgent: () => {
    const { selectedAgentId } = get();
    const pipeline = get().getSelectedPipeline();
    if (!pipeline || !selectedAgentId) return null;
    return pipeline.agents[selectedAgentId] ?? null;
  },
}));
