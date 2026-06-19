import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Message } from '@/types';

interface MessageStore {
  messagesBySession: Record<string, Message[]>;
  streamingContent: string;
  isStreaming: boolean;
  abortController: AbortController | null;

  fetchMessages: (sessionId: string) => Promise<void>;
  addMessage: (sessionId: string, role: 'user' | 'assistant' | 'system', content: string, modelId?: string) => Promise<Message>;
  updateMessage: (id: string, content: string) => Promise<void>;
  deleteMessage: (id: string, sessionId: string) => Promise<void>;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  setIsStreaming: (v: boolean) => void;
  setAbortController: (ctrl: AbortController | null) => void;
  stopStreaming: () => void;
  clearMessages: (sessionId: string) => void;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messagesBySession: {},
  streamingContent: '',
  isStreaming: false,
  abortController: null,

  fetchMessages: async (sessionId) => {
    const messages = await invoke<Message[]>('get_messages', { sessionId });
    set((state) => ({
      messagesBySession: { ...state.messagesBySession, [sessionId]: messages },
    }));
  },

  addMessage: async (sessionId, role, content, modelId) => {
    const msg = await invoke<Message>('create_message', {
      input: { session_id: sessionId, role, content, model_id: modelId },
    });
    set((state) => ({
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: [...(state.messagesBySession[sessionId] || []), msg],
      },
    }));
    return msg;
  },

  updateMessage: async (id, content) => {
    await invoke('update_message', { id, content });
    set((state) => {
      const updated: Record<string, Message[]> = {};
      for (const [sid, msgs] of Object.entries(state.messagesBySession)) {
        updated[sid] = msgs.map((m) => m.id === id ? { ...m, content } : m);
      }
      return { messagesBySession: updated };
    });
  },

  deleteMessage: async (id, sessionId) => {
    await invoke('delete_message', { id });
    set((state) => ({
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: (state.messagesBySession[sessionId] || []).filter((m) => m.id !== id),
      },
    }));
  },

  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (chunk) => set((state) => ({ streamingContent: state.streamingContent + chunk })),
  setIsStreaming: (v) => set({ isStreaming: v }),
  setAbortController: (ctrl) => set({ abortController: ctrl }),

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) abortController.abort();
    set({ isStreaming: false, abortController: null });
  },

  clearMessages: (sessionId) => {
    set((state) => {
      const updated = { ...state.messagesBySession };
      delete updated[sessionId];
      return { messagesBySession: updated };
    });
  },
}));
