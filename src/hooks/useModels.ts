import { useEffect, useState } from 'react';
import { useProviderStore } from '@/stores/providerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { providerRegistry } from '@/providers/registry';
import { isChatModel } from '@/utils';
import type { ModelInfo } from '@/types';

// Loads chat models from the default provider (health check + list) and seeds the
// active model. Filters out System-1 decision models and embedding models.
// Shared by ChatPage and the project workspace chat box.
export function useModels() {
  const { providers, activeModelId, setActiveModel, setIsConnected } = useProviderStore();
  const { settings } = useSettingsStore();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const defaultProvider = providers.find((p) => p.is_default) || providers[0];
      if (!defaultProvider) return;
      const endpoint = settings.ollama_host || defaultProvider.endpoint;
      const provider = providerRegistry.createOllama(defaultProvider.id, endpoint);

      setModelsLoading(true);
      try {
        const health = await provider.healthCheck();
        setIsConnected(health.connected);
        if (health.connected) {
          const fetched = await provider.listModels();
          const chatModels = fetched.filter((m) => isChatModel(m, settings.system_one_model));
          setModels(chatModels);

          const currentActive = useProviderStore.getState().activeModelId;
          const isCurrentActiveValid = currentActive && chatModels.some(m => m.id === currentActive);
          if ((!currentActive || !isCurrentActiveValid) && chatModels.length > 0) {
            setActiveModel(chatModels[0].id);
          }
        }
      } catch {
        setIsConnected(false);
      } finally {
        setModelsLoading(false);
      }
    };
    if (providers.length > 0) load();
  }, [providers, settings.ollama_host, settings.system_one_model]);

  return { models, modelsLoading, activeModelId, setActiveModel };
}
