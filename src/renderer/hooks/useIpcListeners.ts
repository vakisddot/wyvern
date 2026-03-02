import { useEffect } from 'react';
import { usePipelineStore } from '../stores/pipeline-store';
import { useChatStore } from '../stores/chat-store';

export function useIpcListeners(): void {
  useEffect(() => {
    const unsub1 = window.wyvern.onPipelineUpdate((state) => {
      usePipelineStore.getState().updatePipeline(state);
    });
    const unsub2 = window.wyvern.onAgentOutput((data) => {
      useChatStore.getState().addMessage({
        type: 'agent-output',
        content: data.chunk,
        agentId: data.agentId,
        pipelineId: data.pipelineId,
      });
    });
    const unsub3 = window.wyvern.onCheckpointRequest((data) => {
      useChatStore.getState().addMessage({
        type: 'checkpoint',
        content: data.message,
        agentId: data.agentId,
        pipelineId: data.pipelineId,
      });
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);
}
