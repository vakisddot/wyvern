import { useEffect } from 'react';
import { usePipelineStore } from '../stores/pipeline-store';

export function useIpcListeners(): void {
  useEffect(() => {
    const unsub = window.wyvern.onPipelineUpdate((state) => {
      usePipelineStore.getState().updatePipeline(state);
    });
    return () => { unsub(); };
  }, []);
}
