import React, { useEffect, useState } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useProviderStore } from '@/stores/providerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { providerRegistry } from '@/providers/registry';
import type { ModelInfo } from '@/types';
import { cn } from '@/utils';

function ModelRow({ model, isActive, onUse }: { model: ModelInfo; isActive: boolean; onUse: (id: string) => void }) {
  return (
    <tr
      className={cn(
        'border-b border-zinc-100 transition-colors',
        isActive ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'
      )}
    >
      <td className="py-4 pl-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-7 w-7 rounded-md flex items-center justify-center shrink-0',
            isActive ? 'bg-[var(--color-wollama-primary)]/10' : 'bg-zinc-100'
          )}>
            <Cpu className={cn('h-3.5 w-3.5', isActive ? 'text-[var(--color-wollama-primary)]' : 'text-zinc-400')} />
          </div>
          <div>
            <div className="font-mono text-sm text-zinc-800 font-medium">{model.name}</div>
            <div className="text-xs text-zinc-400">
              {model.vendor && `${model.vendor}`}
              {model.pulledAt && ` · pulled ${new Date(model.pulledAt).toLocaleDateString()}`}
            </div>
          </div>
        </div>
      </td>
      <td className="py-4 text-right pr-6 font-mono text-sm text-zinc-500">
        {model.size || '—'}
      </td>
      <td className="py-4 text-right pr-6 font-mono text-sm text-zinc-500">
        {model.contextLength ? `${model.contextLength >= 1000 ? `${model.contextLength / 1000}k` : model.contextLength}` : '—'}
      </td>
      <td className="py-4 text-right pr-4">
        {isActive ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--color-wollama-primary)] text-xs text-[var(--color-wollama-primary)] font-medium">
            ✓ active
          </span>
        ) : (
          <button
            onClick={() => onUse(model.id)}
            className="px-3 py-1 rounded-full border border-zinc-200 text-xs text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
          >
            use
          </button>
        )}
      </td>
    </tr>
  );
}

export function ModelsPage() {
  const { providers, activeModelId, setActiveModel, setIsConnected } = useProviderStore();
  const { settings } = useSettingsStore();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const loadModels = async () => {
    const defaultProvider = providers.find((p) => p.is_default) || providers[0];
    if (!defaultProvider) return;
    const endpoint = settings.ollama_host || defaultProvider.endpoint;
    const provider = providerRegistry.createOllama(defaultProvider.id, endpoint);

    setLoading(true);
    try {
      const health = await provider.healthCheck();
      setConnected(health.connected);
      setIsConnected(health.connected);
      if (health.connected) {
        const fetchedModels = await provider.listModels();
        setModels(fetchedModels);
        if (!activeModelId && fetchedModels.length > 0) {
          setActiveModel(fetchedModels[0].id);
        }
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (providers.length > 0) loadModels();
  }, [providers, settings.ollama_host]);

  return (
    <div className="px-12 py-12 max-w-4xl">
      <PageHeader
        label="ON THIS MACHINE"
        title="Models"
        description="Open-weight language models, running locally through Ollama. Pull what you want, keep what you use, forget the rest."
        actions={
          <button
            onClick={loadModels}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      {!connected && !loading && (
        <div className="mb-6 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-700">
          Ollama is not connected. Make sure Ollama is running at{' '}
          <code className="font-mono text-xs">{settings.ollama_host}</code>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">Loading models...</div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-[11px] uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
              <th className="text-left py-3 pl-4 font-medium">Name</th>
              <th className="text-right py-3 pr-6 font-medium">Size</th>
              <th className="text-right py-3 pr-6 font-medium">Context</th>
              <th className="text-right py-3 pr-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-zinc-400 text-sm">
                  {connected ? 'No models found. Run `ollama pull llama3.2` to get started.' : 'Connect to Ollama to see models.'}
                </td>
              </tr>
            )}
            {models.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                isActive={model.id === activeModelId}
                onUse={setActiveModel}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
