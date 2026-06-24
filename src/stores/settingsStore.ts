import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '@/types';

const DEFAULT_SETTINGS: AppSettings = {
  ollama_host: 'http://127.0.0.1:11434',
  ollama_num_ctx: 32768,
  auto_remember: true,
  show_graph_panel: true,
  anonymous_telemetry: false,
  theme: 'paper-light',
  extraction_model: '',
};

interface SettingsStore {
  settings: AppSettings;
  loading: boolean;

  fetchSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });
    try {
      const rawSettings = await invoke<{ key: string; value: string }[]>('get_settings');
      const settings = { ...DEFAULT_SETTINGS };
      for (const s of rawSettings) {
        const key = s.key as keyof AppSettings;
        if (key in settings) {
          const val = s.value;
          // Parse booleans and numbers
          if (typeof settings[key] === 'boolean') {
            (settings as Record<string, unknown>)[key] = val === 'true';
          } else if (typeof settings[key] === 'number') {
            (settings as Record<string, unknown>)[key] = Number(val);
          } else {
            (settings as Record<string, unknown>)[key] = val;
          }
        }
      }
      set({ settings, loading: false });
    } catch (e) {
      console.error('Failed to fetch settings:', e);
      set({ loading: false });
    }
  },

  updateSetting: async (key, value) => {
    const stringValue = typeof value === 'boolean' ? String(value) : String(value);
    await invoke('set_setting', { key, value: stringValue });
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));
  },
}));
