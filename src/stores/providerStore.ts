import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Provider, ModelInfo } from '@/types';

interface ProviderStore {
  providers: Provider[];
  models: ModelInfo[];
  activeModelId: string | null;
  isConnected: boolean;
  loading: boolean;
  modelsLoading: boolean;

  fetchProviders: () => Promise<void>;
  updateProvider: (id: string, data: Partial<Provider>) => Promise<void>;
  fetchModels: () => Promise<void>;
  setActiveModel: (modelId: string) => void;
  setIsConnected: (v: boolean) => void;
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  models: [],
  activeModelId: null,
  isConnected: false,
  loading: false,
  modelsLoading: false,

  fetchProviders: async () => {
    set({ loading: true });
    try {
      const providers = await invoke<Provider[]>('get_providers');
      set({ providers, loading: false });
    } catch (e) {
      console.error('Failed to fetch providers:', e);
      set({ loading: false });
    }
  },

  updateProvider: async (id, data) => {
    await invoke('update_provider', { id, input: data });
    set((state) => ({
      providers: state.providers.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    }));
  },

  fetchModels: async () => {
    set({ modelsLoading: true });
    const { providers } = get();
    const defaultProvider = providers.find((p) => p.is_default) || providers[0];
    if (!defaultProvider) {
      set({ modelsLoading: false });
      return;
    }
    // Models are fetched via OllamaProvider in the component
    set({ modelsLoading: false });
  },

  setActiveModel: (modelId) => set({ activeModelId: modelId }),
  setIsConnected: (v) => set({ isConnected: v }),
}));
