import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Message } from '@/types';

interface MessageStore {
  messagesBySession: Record<string, Message[]>;
  activeVariantIds: Record<string, Record<string, string>>; // session_id -> { parent_id -> selected_child_id }
  lastContextUsage: { used: number; total: number } | null;
  streamingContent: string;
  isStreaming: boolean;
  streamingSessionId: string | null;
  abortController: AbortController | null;

  setLastContextUsage: (usage: { used: number; total: number } | null) => void;
  fetchMessages: (sessionId: string) => Promise<void>;
  addMessage: (sessionId: string, role: 'user' | 'assistant' | 'system', content: string, modelId?: string, parentId?: string | null, attachments?: string) => Promise<Message>;
  setActiveVariant: (sessionId: string, parentId: string, childId: string) => void;
  updateMessage: (id: string, content: string) => Promise<void>;
  deleteMessage: (id: string, sessionId: string) => Promise<void>;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  setIsStreaming: (v: boolean) => void;
  setStreamingSessionId: (id: string | null) => void;
  setAbortController: (ctrl: AbortController | null) => void;
  stopStreaming: () => void;
  clearMessages: (sessionId: string) => void;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messagesBySession: {},
  activeVariantIds: {},
  lastContextUsage: null,
  streamingContent: '',
  isStreaming: false,
  streamingSessionId: null,
  abortController: null,

  setLastContextUsage: (usage) => set({ lastContextUsage: usage }),

  fetchMessages: async (sessionId) => {
    const messages = await invoke<Message[]>('get_messages', { sessionId });
    set((state) => ({
      messagesBySession: { ...state.messagesBySession, [sessionId]: messages },
    }));
  },

  addMessage: async (sessionId, role, content, modelId, parentId, attachments) => {
    const msg = await invoke<Message>('create_message', {
      input: { session_id: sessionId, role, content, model_id: modelId, parent_id: parentId, attachments },
    });
    set((state) => {
      // If we are adding a variant (it shares a parent with existing messages),
      // we auto-select the newly added message as the active variant.
      let newActiveVariants = state.activeVariantIds;
      if (parentId) {
        newActiveVariants = {
          ...state.activeVariantIds,
          [sessionId]: {
            ...(state.activeVariantIds[sessionId] || {}),
            [parentId]: msg.id,
          },
        };
      }
      return {
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: [...(state.messagesBySession[sessionId] || []), msg],
        },
        activeVariantIds: newActiveVariants,
      };
    });
    return msg;
  },

  setActiveVariant: (sessionId, parentId, childId) => {
    set((state) => ({
      activeVariantIds: {
        ...state.activeVariantIds,
        [sessionId]: {
          ...(state.activeVariantIds[sessionId] || {}),
          [parentId]: childId,
        },
      },
    }));
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
  setStreamingSessionId: (id) => set({ streamingSessionId: id }),
  setAbortController: (ctrl) => set({ abortController: ctrl }),

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) abortController.abort();
    set({ isStreaming: false, streamingSessionId: null, abortController: null });
  },

  clearMessages: (sessionId) => {
    set((state) => {
      const updated = { ...state.messagesBySession };
      delete updated[sessionId];
      return { messagesBySession: updated };
    });
  },
}));
