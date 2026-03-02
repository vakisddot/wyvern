import { create } from 'zustand';
import { PipelineState, AgentNode } from '../../types';

interface PipelineStore {
  pipelines: PipelineState[];
  activePipelineId: string | null;
  selectedAgentId: string | null;

  setActivePipeline: (id: string) => void;
  selectAgent: (id: string | null) => void;
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

  setActivePipeline: (id) => set({ activePipelineId: id }),

  selectAgent: (id) => set({ selectedAgentId: id }),

  updatePipeline: (state) => set((prev) => {
    const idx = prev.pipelines.findIndex((p) => p.id === state.id);
    if (idx === -1) {
      return { pipelines: [...prev.pipelines, state] };
    }
    const next = [...prev.pipelines];
    next[idx] = state;
    return { pipelines: next };
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
