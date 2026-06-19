import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Session } from '@/types';

interface SessionStore {
  sessions: Session[];
  activeSessionId: string | null;
  loading: boolean;

  fetchSessions: () => Promise<void>;
  setActiveSession: (id: string | null) => void;
  createSession: (title?: string, modelId?: string) => Promise<Session>;
  updateSession: (id: string, data: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  searchSessions: (query: string) => Promise<Session[]>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  loading: false,

  fetchSessions: async () => {
    set({ loading: true });
    try {
      const sessions = await invoke<Session[]>('get_sessions');
      set({ sessions, loading: false });
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
      set({ loading: false });
    }
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  createSession: async (title = 'Untitled', modelId?: string) => {
    const session = await invoke<Session>('create_session', {
      input: { title, model_id: modelId },
    });
    set((state) => ({ sessions: [session, ...state.sessions] }));
    return session;
  },

  updateSession: async (id, data) => {
    await invoke('update_session', { id, input: data });
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...data } : s
      ),
    }));
  },

  deleteSession: async (id) => {
    await invoke('delete_session', { id });
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
    }));
  },

  searchSessions: async (query) => {
    if (!query.trim()) return get().sessions;
    return await invoke<Session[]>('search_sessions', { query });
  },
}));
