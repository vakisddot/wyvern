import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  type: 'directive' | 'checkpoint' | 'approval' | 'rejection' | 'status';
  content: string;
  agentId?: string;
  roleName?: string;
  pipelineId?: string;
  timestamp: number;
}

interface ChatStore {
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
}

let nextId = 0;

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],

  addMessage: (msg) => set((prev) => ({
    messages: [...prev.messages, {
      ...msg,
      id: String(nextId++),
      timestamp: Date.now(),
    }],
  })),

  clearMessages: () => set({ messages: [] }),
}));
