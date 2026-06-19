import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Memory, MemoryCategory } from '@/types';

interface MemoryStore {
  memories: Memory[];
  loading: boolean;

  fetchMemories: () => Promise<void>;
  createMemory: (content: string, category?: MemoryCategory, sourceSession?: string) => Promise<Memory>;
  updateMemory: (id: string, content: string, category?: MemoryCategory) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  searchMemories: (query: string) => Promise<Memory[]>;
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  memories: [],
  loading: false,

  fetchMemories: async () => {
    set({ loading: true });
    try {
      const memories = await invoke<Memory[]>('get_memories');
      set({ memories, loading: false });
    } catch (e) {
      console.error('Failed to fetch memories:', e);
      set({ loading: false });
    }
  },

  createMemory: async (content, category = 'CONTEXT', sourceSession) => {
    const memory = await invoke<Memory>('create_memory', {
      input: { content, category, source_session: sourceSession },
    });
    set((state) => ({ memories: [memory, ...state.memories] }));
    return memory;
  },

  updateMemory: async (id, content, category) => {
    await invoke('update_memory', { id, content, category });
    set((state) => ({
      memories: state.memories.map((m) =>
        m.id === id ? { ...m, content, ...(category ? { category } : {}) } : m
      ),
    }));
  },

  deleteMemory: async (id) => {
    await invoke('delete_memory', { id });
    set((state) => ({ memories: state.memories.filter((m) => m.id !== id) }));
  },

  searchMemories: async (query) => {
    if (!query.trim()) return get().memories;
    return await invoke<Memory[]>('search_memories', { query });
  },
}));
