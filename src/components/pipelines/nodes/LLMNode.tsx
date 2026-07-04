import React, { useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { PipelineNodeData, usePipelineStore } from '@/stores/pipelineStore';
import { Brain, Settings2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProviderStore } from '@/stores/providerStore';
import { providerRegistry } from '@/providers/registry';
import type { ModelInfo } from '@/types';

export function LLMNode({ id, data }: { id: string; data: PipelineNodeData }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    const fetchModels = async () => {
      const providers = useProviderStore.getState().providers;
      const settings = useSettingsStore.getState().settings;
      const defaultProvider = providers.find((p) => p.is_default) || providers[0];
      if (!defaultProvider) return;
      const endpoint = settings.ollama_host || defaultProvider.endpoint;
      const provider = providerRegistry.createOllama(defaultProvider.id, endpoint);
      try {
        const fetchedModels = await provider.listModels();
        setModels(fetchedModels);
      } catch (e) {}
    };
    fetchModels();
  }, []);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm min-w-[280px] overflow-hidden">
      <div className="bg-zinc-50 border-b border-zinc-200 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold text-xs text-zinc-700">LLM Processing</span>
        </div>
        {data.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
        {data.status === 'success' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
        {data.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
      </div>
      
      <div className="p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-semibold text-zinc-500 flex items-center gap-1">
            <Settings2 className="h-3 w-3" /> Model
          </label>
          <select 
            className="w-full text-xs p-1.5 border border-zinc-200 rounded-md outline-none bg-zinc-50 focus:border-emerald-500"
            value={data.modelId || ''}
            onChange={(e) => updateNodeData(id, { modelId: e.target.value })}
          >
            <option value="" disabled>Select a model...</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
            {models.length === 0 && <option value="llama3">llama3 (Default)</option>}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-semibold text-zinc-500">System Prompt</label>
          <textarea
            className="w-full text-xs p-2 border border-zinc-200 rounded-md outline-none focus:border-emerald-500 resize-none h-20"
            placeholder="E.g., You are a helpful assistant..."
            value={data.systemPrompt || ''}
            onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })}
          />
        </div>
        
        {data.result && (
          <div className="flex flex-col gap-1 mt-1">
            <label className="text-[10px] uppercase font-semibold text-zinc-500">Result Preview</label>
            <div className="w-full text-xs p-2 bg-zinc-50 border border-zinc-100 rounded-md h-20 overflow-y-auto text-zinc-600 whitespace-pre-wrap">
              {data.result}
            </div>
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-zinc-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-emerald-500 border-2 border-white"
      />
    </div>
  );
}
