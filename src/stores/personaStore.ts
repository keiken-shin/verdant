import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Persona } from '@/types';

interface PersonaState {
  personas: Persona[];
  loading: boolean;
  
  fetchPersonas: () => Promise<void>;
  createPersona: (name: string, prompt: string, description?: string) => Promise<Persona>;
  updatePersona: (id: string, data: Partial<Persona>) => Promise<void>;
  deletePersona: (id: string) => Promise<void>;
}

export const usePersonaStore = create<PersonaState>((set, get) => ({
  personas: [],
  loading: false,

  fetchPersonas: async () => {
    set({ loading: true });
    try {
      const personas = await invoke<Persona[]>('get_personas');
      set({ personas, loading: false });
    } catch (e) {
      console.error('Failed to fetch personas:', e);
      set({ loading: false });
    }
  },

  createPersona: async (name, prompt, description) => {
    const persona = await invoke<Persona>('create_persona', {
      input: { name, prompt, description },
    });
    set((state) => ({ personas: [...state.personas, persona].sort((a, b) => a.name.localeCompare(b.name)) }));
    return persona;
  },

  updatePersona: async (id, data) => {
    await invoke('update_persona', { id, input: data });
    set((state) => ({
      personas: state.personas.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    }));
  },

  deletePersona: async (id) => {
    await invoke('delete_persona', { id });
    set((state) => ({
      personas: state.personas.filter((p) => p.id !== id),
    }));
  },
}));
