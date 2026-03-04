import { useState, useRef, useEffect } from 'react';
import { useChatStore, ChatMessage } from '../../stores/chat-store';
import { usePipelineStore } from '../../stores/pipeline-store';

function DirectiveMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 p-3">
      <span className="text-xs text-cyan-400 font-semibold">CEO (You):</span>
      <p className="text-sm text-gray-200 mt-1 whitespace-pre-wrap">{msg.content}</p>
    </div>
  );
}

function StatusMessage({ msg }: { msg: ChatMessage }) {
  return (
    <p className="text-xs text-gray-500 px-1">{msg.content}</p>
  );
}

function MessageRenderer({ msg }: { msg: ChatMessage }) {
  switch (msg.type) {
    case 'directive':   return <DirectiveMessage msg={msg} />;
    case 'status':      return <StatusMessage msg={msg} />;
    default:            return null;
  }
}

export function ChatPanel({ projectPath }: { projectPath: string }) {
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const activePipeline = usePipelineStore((s) => s.getActivePipeline());
  const selectedPipelineId = usePipelineStore((s) => s.selectedPipelineId);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const currentStatus = activePipeline?.status ?? null;
  useEffect(() => {
    if (prevStatus === 'active' && currentStatus && currentStatus !== 'active' && activePipeline) {
      const agentCount = Object.keys(activePipeline.agents).length;
      const elapsed = ((activePipeline.updatedAt - activePipeline.createdAt) / 1000).toFixed(0);
      addMessage({
        type: 'status',
        content: `Pipeline ${currentStatus}. ${agentCount} agent(s), ${elapsed}s elapsed.`,
        pipelineId: activePipeline.id,
      });
    }
    setPrevStatus(currentStatus);
  }, [currentStatus]);

  const isNewPipeline = selectedPipelineId === null;
  const isActive = activePipeline?.status === 'active';
  const canType = isNewPipeline && !isActive;

  function handleSubmit() {
    const text = input.trim();
    if (!text || !canType) return;

    addMessage({ type: 'directive', content: text });
    window.wyvern.startPipeline(text, projectPath).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      addMessage({ type: 'status', content: 'Failed to start pipeline: ' + msg });
    });

    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex-1 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100">Chat Panel</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-500 text-center mt-8">Type a directive to get started. Wyvern will coordinate your AI team to execute it.</p>
        )}
        {messages.map((msg) => (
          <MessageRenderer key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-gray-700 flex flex-col gap-2">
        <textarea
          className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-100 p-2 resize-none focus:outline-none focus:border-gray-500 placeholder-gray-600"
          rows={3}
          placeholder={!isNewPipeline ? 'Select [+ New] to start a pipeline' : isActive ? 'Pipeline running...' : 'Type a directive...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!canType}
        />
        <div className="flex justify-end">
          <button
            className="text-xs text-gray-400 hover:text-gray-100 transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={!canType || !input.trim()}
          >[Send]</button>
        </div>
      </div>
    </div>
  );
}
