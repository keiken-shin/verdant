import React, { useEffect, useState, useRef } from 'react';
import { Toggle } from '@/components/ui/Toggle';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProviderStore } from '@/stores/providerStore';
import { useUiStore } from '@/stores/uiStore';
import { providerRegistry } from '@/providers/registry';
import { usePersonaStore } from '@/stores/personaStore';
import type { ModelInfo } from '@/types';
import { cn } from '@/utils';
import { X, Shield, Cpu, Settings, Users, Plus, Trash2, Edit2, Check } from 'lucide-react';

interface SettingSectionProps {
  label?: string;
  children: React.ReactNode;
}

function SettingSection({ label, children }: SettingSectionProps) {
  return (
    <div className="mb-10">
      {label && <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase mb-4">{label}</h3>}
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
    <div className="flex items-start justify-between py-3 border-b border-zinc-100 last:border-0">
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
    <div className="flex items-start justify-between py-3 border-b border-zinc-100 last:border-0">
      <div className="flex-1 pr-8">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-800 mb-0.5">
          {title}
        </label>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-md">{description}</p>
      </div>
      <div className="shrink-0 mt-0.5">
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
    <div className="flex items-start justify-between py-3 border-b border-zinc-100 last:border-0">
      <div className="flex-1 pr-8">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-800 mb-0.5">
          {title}
        </label>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-md">{description}</p>
      </div>
      <div className="shrink-0 mt-0.5">
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

type TabType = 'general' | 'privacy' | 'providers' | 'personas';

export function SettingsModal() {
  const { settingsOpen, closeSettings } = useUiStore();
  const { settings, updateSetting } = useSettingsStore();
  const { providers, setIsConnected } = useProviderStore();
  const { personas, fetchPersonas, createPersona, updatePersona, deletePersona } = usePersonaStore();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  
  // Persona editor state
  const [isEditingPersona, setIsEditingPersona] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [editPersonaName, setEditPersonaName] = useState('');
  const [editPersonaDesc, setEditPersonaDesc] = useState('');
  const [editPersonaPrompt, setEditPersonaPrompt] = useState('');
  
  const modalRef = useRef<HTMLDivElement>(null);

  const startEditPersona = (p?: typeof personas[0]) => {
    setIsEditingPersona(true);
    if (p) {
      setEditingPersonaId(p.id);
      setEditPersonaName(p.name);
      setEditPersonaDesc(p.description || '');
      setEditPersonaPrompt(p.prompt);
    } else {
      setEditingPersonaId(null);
      setEditPersonaName('');
      setEditPersonaDesc('');
      setEditPersonaPrompt('');
    }
  };

  const cancelEditPersona = () => {
    setIsEditingPersona(false);
    setEditingPersonaId(null);
  };

  const savePersona = async () => {
    if (!editPersonaName.trim() || !editPersonaPrompt.trim()) return;
    if (editingPersonaId) {
      await updatePersona(editingPersonaId, {
        name: editPersonaName.trim(),
        description: editPersonaDesc.trim() || undefined,
        prompt: editPersonaPrompt.trim(),
      });
    } else {
      await createPersona(
        editPersonaName.trim(),
        editPersonaPrompt.trim(),
        editPersonaDesc.trim() || undefined
      );
    }
    cancelEditPersona();
  };

  const testConnection = async () => {
    const defaultProvider = providers.find((p) => p.is_default) || providers[0];
    if (!defaultProvider) return;
    const provider = providerRegistry.createOllama(defaultProvider.id, settings.ollama_host);

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
    if (providers.length > 0 && settingsOpen && activeTab === 'providers') {
      testConnection();
    }
  }, [providers, settings.ollama_host, settingsOpen, activeTab]);

  useEffect(() => {
    if (settingsOpen && personas.length === 0) {
      fetchPersonas();
    }
  }, [settingsOpen, personas.length, fetchPersonas]);

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

    if (providers.length > 0 && settingsOpen) {
      loadModels();
    }
  }, [providers, settings.ollama_host, settingsOpen]);

  // Handle escape key and click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && settingsOpen) {
        closeSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, closeSettings]);

  if (!settingsOpen) return null;

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            <h2 className="text-xl font-semibold text-zinc-800 mb-6 border-b border-zinc-100 pb-4">General</h2>
            <SettingSection label="Workspace">
              <ToggleSetting
                id="setting-graph-panel"
                title="Show knowledge graph panel"
                description="A small live view of how your ideas connect, on the right side of the conversation."
                checked={settings.show_graph_panel}
                onChange={(v) => updateSetting('show_graph_panel', v)}
              />
              <SelectSetting
                id="setting-theme"
                title="Theme"
                description="A warm-white paper finish, designed to be readable for long sessions."
                value="paper-light"
                onChange={() => {}}
              >
                <option value="paper-light">paper · light</option>
              </SelectSetting>
            </SettingSection>

            <SettingSection label="About">
              <div className="flex items-start justify-between py-3 border-b border-zinc-100 last:border-0">
                <div className="flex-1 pr-8">
                  <span className="block text-sm font-medium text-zinc-800 mb-0.5">Version</span>
                  <p className="text-sm text-zinc-500 leading-relaxed max-w-md">The current version of Verdant you are running.</p>
                </div>
                <div className="shrink-0 text-sm text-zinc-400 font-mono mt-0.5">
                  v0.1.0
                </div>
              </div>
            </SettingSection>
          </div>
        );
      case 'privacy':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            <h2 className="text-xl font-semibold text-zinc-800 mb-6 border-b border-zinc-100 pb-4">Privacy</h2>
            <SettingSection>
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
          </div>
        );
      case 'providers':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            <h2 className="text-xl font-semibold text-zinc-800 mb-6 border-b border-zinc-100 pb-4">Providers</h2>
            <SettingSection>
              <div className="py-3 border-b border-zinc-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-8">
                    <label htmlFor="setting-ollama-host" className="block text-sm font-medium text-zinc-800 mb-0.5">
                      Ollama host
                    </label>
                    <p className="text-sm text-zinc-500">Where Verdant talks to your local model runner.</p>
                  </div>
                  <div className="shrink-0 mt-0.5">
                    <input
                      id="setting-ollama-host"
                      type="text"
                      value={settings.ollama_host}
                      onChange={(e) => updateSetting('ollama_host', e.target.value)}
                      className="px-3 py-1.5 text-sm font-mono border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] transition-colors text-zinc-700 w-52"
                    />
                  </div>
                </div>
                
                <div className="flex items-start justify-between mt-6">
                  <div className="flex-1 pr-8">
                    <label htmlFor="setting-ollama-num-ctx" className="block text-sm font-medium text-zinc-800 mb-0.5">
                      Ollama context window
                    </label>
                    <p className="text-sm text-zinc-500">Maximum context length for local models (default: 32768).</p>
                  </div>
                  <div className="shrink-0 mt-0.5">
                    <input
                      id="setting-ollama-num-ctx"
                      type="number"
                      value={settings.ollama_num_ctx || ''}
                      onChange={(e) => updateSetting('ollama_num_ctx', parseInt(e.target.value) || 32768)}
                      className="px-3 py-1.5 text-sm font-mono border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] transition-colors text-zinc-700 w-52"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 bg-zinc-50/50 p-3 rounded-lg">
                  <button
                    onClick={testConnection}
                    className="text-xs font-medium text-[var(--color-verdant-primary)] hover:text-[var(--color-verdant-secondary)] px-3 py-1.5 rounded-md bg-white border border-zinc-200 shadow-sm transition-colors cursor-pointer"
                  >
                    Test connection
                  </button>
                  {connectionStatus !== 'unknown' && (
                    <span className={cn(
                      'flex items-center gap-1.5 text-xs font-medium ml-2',
                      connectionStatus === 'connected' ? 'text-emerald-600' : 'text-red-500'
                    )}>
                      <span className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                      )} />
                      {connectionStatus === 'connected' ? 'Connected successfully' : 'Not reachable'}
                    </span>
                  )}
                </div>
                {connectionError && (
                  <div className="mt-3 text-xs text-red-600 bg-red-50/50 p-3 rounded-lg border border-red-100 max-w-md break-words font-mono">
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
          </div>
        );
      case 'personas':
        if (isEditingPersona) {
          return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-200 h-full flex flex-col">
              <div className="flex items-center gap-3 mb-6 border-b border-zinc-100 pb-4">
                <button 
                  onClick={cancelEditPersona}
                  className="p-1 -ml-1 text-zinc-400 hover:text-zinc-600 rounded hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
                <h2 className="text-xl font-semibold text-zinc-800">
                  {editingPersonaId ? 'Edit Persona' : 'New Persona'}
                </h2>
              </div>
              
              <div className="space-y-5 flex-1 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-zinc-800 mb-1">Name</label>
                  <input
                    type="text"
                    value={editPersonaName}
                    onChange={(e) => setEditPersonaName(e.target.value)}
                    placeholder="e.g. Yoda, Code Reviewer"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] transition-colors text-zinc-700 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-800 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={editPersonaDesc}
                    onChange={(e) => setEditPersonaDesc(e.target.value)}
                    placeholder="A brief explanation of what this persona does."
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] transition-colors text-zinc-700 bg-white"
                  />
                </div>
                <div className="flex flex-col flex-1 h-[200px] min-h-[200px]">
                  <label className="block text-sm font-medium text-zinc-800 mb-1">System Prompt</label>
                  <textarea
                    value={editPersonaPrompt}
                    onChange={(e) => setEditPersonaPrompt(e.target.value)}
                    placeholder="You are a helpful assistant..."
                    className="w-full flex-1 px-3 py-2 text-sm font-mono border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] transition-colors text-zinc-700 bg-white resize-none"
                  />
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-zinc-100 flex justify-end gap-3">
                <button
                  onClick={cancelEditPersona}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={savePersona}
                  disabled={!editPersonaName.trim() || !editPersonaPrompt.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-verdant-primary)] hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Save
                </button>
              </div>
            </div>
          );
        }

        return (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            <h2 className="text-xl font-semibold text-zinc-800 mb-6 border-b border-zinc-100 pb-4">Personas</h2>
            <SettingSection>
              <SelectSetting
                id="setting-default-persona"
                title="Global Default Persona"
                description="The persona that Verdant will use for new global chat sessions."
                value={settings.default_persona_id || ''}
                onChange={(v) => updateSetting('default_persona_id', v)}
              >
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </SelectSetting>
            </SettingSection>

            <SettingSection label="Manage Personas">
              <div className="space-y-4">
                {personas.map(p => (
                  <div key={p.id} className="p-4 border border-zinc-200 rounded-xl bg-zinc-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-zinc-800">{p.name}</h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditPersona(p)}
                          className="p-1.5 text-zinc-400 hover:text-[var(--color-verdant-primary)] hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                          title="Edit persona"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {p.id !== 'default-assistant' && (
                          <button
                            onClick={() => {
                              if (confirm('Delete this persona?')) {
                                deletePersona(p.id);
                                if (settings.default_persona_id === p.id) {
                                  updateSetting('default_persona_id', 'default-assistant');
                                }
                              }
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            title="Delete persona"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {p.description && <div className="text-sm text-zinc-500">{p.description}</div>}
                  </div>
                ))}
                
                <button
                  onClick={() => startEditPersona()}
                  className="w-full py-3 flex items-center justify-center gap-2 border border-dashed border-zinc-300 rounded-xl text-sm font-medium text-zinc-500 hover:text-[var(--color-verdant-primary)] hover:border-[var(--color-verdant-primary)] hover:bg-emerald-50/50 transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Create New Persona
                </button>
              </div>
            </SettingSection>
          </div>
        );
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSettings();
      }}
    >
      <div 
        ref={modalRef}
        className="w-full max-w-4xl h-[85vh] bg-white rounded-2xl shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-200/50 relative"
      >
        <button
          onClick={closeSettings}
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors z-10 cursor-pointer"
          aria-label="Close settings"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Sidebar */}
        <div className="w-64 bg-zinc-50/50 border-r border-zinc-100 flex flex-col pt-12 pb-6 px-4 shrink-0">
          <h1 className="text-xl font-bold text-zinc-900 mb-6 px-3">Settings</h1>
          
          <nav className="flex-1 space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
                activeTab === 'general'
                  ? "bg-white text-[var(--color-verdant-primary)] shadow-sm border border-zinc-200/50"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent"
              )}
            >
              <Settings className="h-4 w-4" />
              General
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
                activeTab === 'privacy'
                  ? "bg-white text-[var(--color-verdant-primary)] shadow-sm border border-zinc-200/50"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent"
              )}
            >
              <Shield className="h-4 w-4" />
              Privacy
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
                activeTab === 'providers'
                  ? "bg-white text-[var(--color-verdant-primary)] shadow-sm border border-zinc-200/50"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent"
              )}
            >
              <Cpu className="h-4 w-4" />
              Providers
            </button>
            <button
              onClick={() => setActiveTab('personas')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
                activeTab === 'personas'
                  ? "bg-white text-[var(--color-verdant-primary)] shadow-sm border border-zinc-200/50"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent"
              )}
            >
              <Users className="h-4 w-4" />
              Personas
            </button>
          </nav>
          
          <div className="px-3 mt-auto">
            <div className="text-[10px] italic text-zinc-400 leading-relaxed opacity-70 border-t border-zinc-200/50 pt-4">
              &ldquo;Software that asks nothing of you, only that you think with it.&rdquo;
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-10 py-12 relative bg-white">
          <div className="max-w-2xl">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
