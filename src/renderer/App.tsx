import { useIpcListeners } from './hooks/useIpcListeners';
import { PipelineTree } from './components/PipelineTree';
import { ChatPanel } from './components/ChatPanel';
import { DetailPanel } from './components/DetailPanel';

export default function App() {
  useIpcListeners();

  return (
    <div className="flex h-screen">
      <PipelineTree />
      <ChatPanel />
      <DetailPanel />
    </div>
  );
}
