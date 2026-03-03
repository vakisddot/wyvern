import { useState, useRef, useEffect } from 'react';
import { useChatStore, ChatMessage } from '../stores/chat-store';
import { usePipelineStore } from '../stores/pipeline-store';

function DirectiveMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 p-3">
      <span className="text-xs text-cyan-400 font-semibold">CEO (You):</span>
      <p className="text-sm text-gray-200 mt-1 whitespace-pre-wrap">{msg.content}</p>
    </div>
  );
}

function CheckpointMessage({ msg, onApprove, onReject, onAbort }: {
  msg: ChatMessage;
  onApprove: () => void;
  onReject: () => void;
  onAbort: () => void;
}) {
  return (
    <div className="border border-cyan-800/50 bg-gray-800/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-gray-900 bg-cyan-400 px-1.5 py-0.5">CHECKPOINT</span>
        <span className="text-xs text-gray-300">{msg.roleName ?? msg.agentId}</span>
      </div>
      <div className="text-sm text-gray-200 whitespace-pre-wrap">{msg.content}</div>
      <div className="flex gap-4 mt-3">
        <button
          className="text-xs text-gray-400 hover:text-white transition-colors"
          onClick={onApprove}
        >[Approve Plan]</button>
        <button
          className="text-xs text-gray-400 hover:text-white transition-colors"
          onClick={onReject}
        >[Request Changes]</button>
        <button
          className="text-xs text-red-400/70 hover:text-red-300 transition-colors"
          onClick={onAbort}
        >[Abort]</button>
      </div>
    </div>
  );
}

function StatusMessage({ msg }: { msg: ChatMessage }) {
  return (
    <p className="text-xs text-gray-500 px-1">{msg.content}</p>
  );
}

function AgentOutputMessage({ msg }: { msg: ChatMessage }) {
  return (
    <details className="text-xs">
      <summary className="text-gray-500 cursor-pointer hover:text-gray-400">
        Agent output ({msg.agentId})
      </summary>
      <pre className="text-gray-400 whitespace-pre-wrap mt-1 pl-2 border-l border-gray-700">{msg.content}</pre>
    </details>
  );
}

function ApprovalMessage({ msg }: { msg: ChatMessage }) {
  return (
    <p className="text-xs text-emerald-400/70 px-1">{msg.content}</p>
  );
}

function RejectionMessage({ msg }: { msg: ChatMessage }) {
  return (
    <p className="text-xs text-amber-400/70 px-1">{msg.content}</p>
  );
}

function MessageRenderer({ msg, onApprove, onReject, onAbort }: {
  msg: ChatMessage;
  onApprove: () => void;
  onReject: () => void;
  onAbort: () => void;
}) {
  switch (msg.type) {
    case 'directive':   return <DirectiveMessage msg={msg} />;
    case 'checkpoint':  return <CheckpointMessage msg={msg} onApprove={onApprove} onReject={onReject} onAbort={onAbort} />;
    case 'status':      return <StatusMessage msg={msg} />;
    case 'agent-output': return <AgentOutputMessage msg={msg} />;
    case 'approval':    return <ApprovalMessage msg={msg} />;
    case 'rejection':   return <RejectionMessage msg={msg} />;
    default:            return null;
  }
}

export function ChatPanel({ projectPath }: { projectPath: string }) {
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const pipeline = usePipelineStore((s) => s.getActivePipeline());
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const currentStatus = pipeline?.status ?? null;
  useEffect(() => {
    if (prevStatus === 'active' && currentStatus && currentStatus !== 'active' && pipeline) {
      const agentCount = Object.keys(pipeline.agents).length;
      const elapsed = ((pipeline.updatedAt - pipeline.createdAt) / 1000).toFixed(0);
      addMessage({
        type: 'status',
        content: `Pipeline ${currentStatus}. ${agentCount} agent(s), ${elapsed}s elapsed.`,
        pipelineId: pipeline.id,
      });
    }
    setPrevStatus(currentStatus);
  }, [currentStatus]);

  let pendingCheckpoint: ChatMessage | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'checkpoint') { pendingCheckpoint = messages[i]; break; }
  }
  const isActive = pipeline?.status === 'active';

  function handleSubmit() {
    const text = input.trim();
    if (!text) return;

    if (pendingCheckpoint && isActive) {
      addMessage({ type: 'approval', content: `CEO approved: ${text}` });
      if (pendingCheckpoint.pipelineId && pendingCheckpoint.agentId) {
        window.wyvern.approveCheckpoint(pendingCheckpoint.pipelineId, pendingCheckpoint.agentId, text);
      }
    } else if (!isActive) {
      addMessage({ type: 'directive', content: text });
      window.wyvern.startPipeline(text, projectPath).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        addMessage({ type: 'status', content: 'Failed to start pipeline: ' + msg });
      });
    }

    setInput('');
  }

  function handleApprove() {
    if (!pendingCheckpoint) return;
    addMessage({ type: 'approval', content: 'CEO approved the plan.' });
    if (pendingCheckpoint.pipelineId && pendingCheckpoint.agentId) {
      window.wyvern.approveCheckpoint(pendingCheckpoint.pipelineId, pendingCheckpoint.agentId, 'approved');
    }
  }

  function handleReject() {
    if (!pendingCheckpoint) return;
    addMessage({ type: 'rejection', content: 'CEO requested changes.' });
    if (pendingCheckpoint.pipelineId && pendingCheckpoint.agentId) {
      window.wyvern.rejectCheckpoint(pendingCheckpoint.pipelineId, pendingCheckpoint.agentId, 'changes requested');
    }
  }

  function handleAbort() {
    if (!pendingCheckpoint) return;
    addMessage({ type: 'rejection', content: 'CEO aborted the operation.' });
    if (pendingCheckpoint.pipelineId && pendingCheckpoint.agentId) {
      window.wyvern.rejectCheckpoint(pendingCheckpoint.pipelineId, pendingCheckpoint.agentId, 'aborted');
    }
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
          <MessageRenderer
            key={msg.id}
            msg={msg}
            onApprove={handleApprove}
            onReject={handleReject}
            onAbort={handleAbort}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-gray-700">
        <textarea
          className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-100 p-2 resize-none focus:outline-none focus:border-gray-500 placeholder-gray-600"
          rows={3}
          placeholder={isActive && !pendingCheckpoint ? 'Pipeline running...' : 'Type a directive...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isActive && !pendingCheckpoint}
        />
      </div>
    </div>
  );
}
