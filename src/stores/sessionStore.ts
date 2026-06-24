import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Session } from '@/types';

interface SessionStore {
  sessions: Session[];
  activeSessionId: string | null;
  loading: boolean;

  fetchSessions: () => Promise<void>;
  fetchProjectSessions: (projectId: string) => Promise<Session[]>;
  setActiveSession: (id: string | null) => void;
  createSession: (title?: string, modelId?: string, projectId?: string) => Promise<Session>;
  updateSession: (id: string, data: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  searchSessions: (query: string) => Promise<Session[]>;
  forkSession: (sessionId: string, messageIds: string[]) => Promise<string>;
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

  fetchProjectSessions: async (projectId) => {
    const sessions = await invoke<Session[]>('get_project_sessions', { projectId });
    // Merge into the global list so the rest of the app sees them too.
    set((state) => {
      const others = state.sessions.filter((s) => s.project_id !== projectId);
      return { sessions: [...sessions, ...others] };
    });
    return sessions;
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  createSession: async (title = 'Untitled', modelId?: string, projectId?: string) => {
    const session = await invoke<Session>('create_session', {
      input: { title, model_id: modelId, project_id: projectId },
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

  forkSession: async (sessionId, messageIds) => {
    const newSession = await invoke<Session>('fork_session', {
      input: { session_id: sessionId, message_ids: messageIds },
    });
    set((state) => ({ sessions: [newSession, ...state.sessions] }));
    return newSession.id;
  },
}));
