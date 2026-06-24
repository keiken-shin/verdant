import React, { useEffect, useState } from 'react';
import { PageHeader, SectionLabel } from '@/components/ui/PageHeader';
import { Toggle } from '@/components/ui/Toggle';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProviderStore } from '@/stores/providerStore';
import { providerRegistry } from '@/providers/registry';
import type { ModelInfo } from '@/types';
import { cn } from '@/utils';

interface SettingSectionProps {
  label: string;
  children: React.ReactNode;
}

function SettingSection({ label, children }: SettingSectionProps) {
  return (
    <div className="mb-10">
      <SectionLabel className="mb-4 block">{label}</SectionLabel>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

interface ToggleSettingProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
  disabled?: boolean;
}

function ToggleSetting({ title, description, checked, onChange, id, disabled }: ToggleSettingProps) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-zinc-100 last:border-0">
      <div className={cn("flex-1 pr-8", disabled && "opacity-50")}>
        <label htmlFor={id} className={cn("block text-sm font-medium text-zinc-800 mb-0.5", disabled ? "cursor-default" : "cursor-pointer")}>
          {title}
        </label>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-md">{description}</p>
      </div>
      <div className="shrink-0 mt-0.5">
        <Toggle id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

interface InputSettingProps {
  title: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
}

function InputSetting({ title, description, value, onChange, placeholder, id }: InputSettingProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => { setLocal(value); }, [value]);

  return (
    <div className="flex items-start justify-between py-2 border-b border-zinc-100 last:border-0">
      <div className="flex-1 pr-8">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-800 mb-0.5">
          {title}
        </label>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-md">{description}</p>
      </div>
      <div className="shrink-0">
        <input
          id={id}
          type="text"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(local)}
          onKeyDown={(e) => e.key === 'Enter' && onChange(local)}
          placeholder={placeholder}
          className="px-3 py-1.5 text-sm font-mono border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] transition-colors text-zinc-700 w-52"
        />
      </div>
    </div>
  );
}

interface SelectSettingProps {
  title: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
  children: React.ReactNode;
}

function SelectSetting({ title, description, value, onChange, id, children }: SelectSettingProps) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-zinc-100 last:border-0">
      <div className="flex-1 pr-8">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-800 mb-0.5">
          {title}
        </label>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-md">{description}</p>
      </div>
      <div className="shrink-0">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] transition-colors text-zinc-700 w-52 bg-white cursor-pointer"
        >
          {children}
        </select>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { settings, updateSetting } = useSettingsStore();
  const { providers, setIsConnected } = useProviderStore();
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const testConnection = async () => {
    const defaultProvider = providers.find((p) => p.is_default) || providers[0];
    if (!defaultProvider) return;
    const provider = providerRegistry.createOllama(defaultProvider.id, settings.ollama_host);

    // Explicitly clear error and status before fetching
    setConnectionStatus('unknown');
    setConnectionError(null);

    const result = await provider.healthCheck();
    setConnectionStatus(result.connected ? 'connected' : 'disconnected');
    setIsConnected(result.connected);
    if (!result.connected) {
      setConnectionError(result.error || 'Unknown error');
      console.error('Ollama connection error:', result.error);
    }
  };

  useEffect(() => {
    if (providers.length > 0) testConnection();
  }, [providers, settings.ollama_host]);

  useEffect(() => {
    const loadModels = async () => {
      const defaultProvider = providers.find((p) => p.is_default) || providers[0];
      if (!defaultProvider) return;

      const endpoint = settings.ollama_host || defaultProvider.endpoint;
      const provider = providerRegistry.createOllama(defaultProvider.id, endpoint);

      setModelsLoading(true);
      try {
        const health = await provider.healthCheck();
        if (health.connected) {
          const fetchedModels = await provider.listModels();
          setModels(fetchedModels);
        }
      } catch (e) {
        console.error('Failed to load models for settings:', e);
      } finally {
        setModelsLoading(false);
      }
    };

    if (providers.length > 0) {
      loadModels();
    }
  }, [providers, settings.ollama_host]);

  // Group display models by provider
  const displayModels = [...models];
  if (settings.extraction_model && !models.some((m) => m.id === settings.extraction_model)) {
    displayModels.push({
      id: settings.extraction_model,
      name: settings.extraction_model,
      displayName: settings.extraction_model,
      provider: 'Ollama',
      providerId: 'custom',
      isLocal: true,
    });
  }

  const groupedModels = displayModels.reduce<Record<string, ModelInfo[]>>((acc, model) => {
    const provider = model.provider || 'Ollama';
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(model);
    return acc;
  }, {});

  return (
    <div className="px-12 py-12 max-w-3xl">
      <PageHeader
        label="PREFERENCES"
        title="Settings"
        description="Verdant runs on your machine. The only things that leave it are the ones you choose to send."
      />

      {/* Privacy Section */}
      <SettingSection label="PRIVACY">
        <ToggleSetting
          id="setting-telemetry"
          title="Anonymous telemetry"
          description="Off by default. We don't read your conversations — we just count whether the app crashed."
          checked={settings.anonymous_telemetry}
          onChange={(v) => updateSetting('anonymous_telemetry', v)}
          disabled={true}
        />
        <ToggleSetting
          id="setting-auto-remember"
          title="Auto-remember"
          description="Let Verdant keep small notes about your preferences and ongoing work. You can review and forget them at any time."
          checked={settings.auto_remember}
          onChange={(v) => updateSetting('auto_remember', v)}
        />
      </SettingSection>

      {/* Workspace Section */}
      <SettingSection label="WORKSPACE">
        <ToggleSetting
          id="setting-graph-panel"
          title="Show knowledge graph panel"
          description="A small live view of how your ideas connect, on the right side of the conversation."
          checked={settings.show_graph_panel}
          onChange={(v) => updateSetting('show_graph_panel', v)}
        />
        <div className="flex items-start justify-between py-2 border-b border-zinc-100">
          <div className="flex-1 pr-8">
            <span className="block text-sm font-medium text-zinc-800 mb-0.5">Theme</span>
            <p className="text-sm text-zinc-500">A warm-white paper finish, designed to be readable for long sessions.</p>
          </div>
          <div className="shrink-0 text-sm text-zinc-400 font-mono mt-0.5">
            paper · light
          </div>
        </div>
      </SettingSection>

      {/* Local Runtime Section */}
      <SettingSection label="LOCAL RUNTIME">
        <div className="py-2 border-b border-zinc-100">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-8">
              <label htmlFor="setting-ollama-host" className="block text-sm font-medium text-zinc-800 mb-0.5">
                Ollama host
              </label>
              <p className="text-sm text-zinc-500">Where Verdant talks to your local model runner.</p>
            </div>
            <div className="shrink-0">
              <input
                id="setting-ollama-host"
                type="text"
                value={settings.ollama_host}
                onChange={(e) => updateSetting('ollama_host', e.target.value)}
                className="px-3 py-1.5 text-sm font-mono border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] transition-colors text-zinc-700 w-52"
              />
            </div>
          </div>
          
          {/* Context Window Setting */}
          <div className="flex items-start justify-between mt-4">
            <div className="flex-1 pr-8">
              <label htmlFor="setting-ollama-num-ctx" className="block text-sm font-medium text-zinc-800 mb-0.5">
                Ollama context window
              </label>
              <p className="text-sm text-zinc-500">Maximum context length for local models (default: 32768).</p>
            </div>
            <div className="shrink-0">
              <input
                id="setting-ollama-num-ctx"
                type="number"
                value={settings.ollama_num_ctx || ''}
                onChange={(e) => updateSetting('ollama_num_ctx', parseInt(e.target.value) || 32768)}
                className="px-3 py-1.5 text-sm font-mono border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] transition-colors text-zinc-700 w-52"
              />
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={testConnection}
              className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2"
            >
              Test connection
            </button>
            {connectionStatus !== 'unknown' && (
              <span className={cn(
                'flex items-center gap-1 text-xs',
                connectionStatus === 'connected' ? 'text-emerald-600' : 'text-red-500'
              )}>
                <span className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-400'
                )} />
                {connectionStatus === 'connected' ? 'Connected' : 'Not reachable'}
              </span>
            )}
          </div>
          {connectionError && (
            <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded max-w-md break-words font-mono">
              {connectionError}
            </div>
          )}
        </div>

        <SelectSetting
          id="setting-extraction-model"
          title="Graph extraction model"
          description="Lightweight model used to extract knowledge graph nodes from conversations. Choose 'Use active model' to use the active chat model."
          value={settings.extraction_model}
          onChange={(v) => updateSetting('extraction_model', v)}
        >
          <option value="">Use active model</option>
          {Object.entries(groupedModels).map(([providerName, providerModels]) => (
            <optgroup key={providerName} label={providerName}>
              {providerModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.size ? `(${m.size})` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectSetting>
      </SettingSection>

      {/* Quote */}
      <div className="mt-16 text-sm italic text-zinc-400">
        &ldquo;Software that asks nothing of you, only that you think with it.&rdquo;
      </div>
    </div>
  );
}
