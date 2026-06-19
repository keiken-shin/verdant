import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';
import type { ModelInfo } from '@/types';

interface ModelSelectorProps {
  models: ModelInfo[];
  selectedModelId: string | null;
  onSelect: (modelId: string) => void;
  loading?: boolean;
}

export function ModelSelector({ models, selectedModelId, onSelect, loading }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const displayName = selectedModel?.displayName || selectedModel?.name || 'Select model';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
          'text-[var(--color-wollama-primary)] hover:bg-[var(--color-wollama-hover)] transition-colors',
          loading && 'opacity-50 pointer-events-none'
        )}
        disabled={loading}
      >
        <span className="font-mono">{loading ? 'Loading...' : displayName}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-52 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-50 max-h-56 overflow-y-auto">
          {models.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-400">
              No models available. Start Ollama and pull a model.
            </div>
          ) : (
            models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onSelect(model.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 transition-colors',
                  model.id === selectedModelId && 'text-[var(--color-wollama-primary)] font-medium bg-zinc-50'
                )}
              >
                <div className="font-mono font-medium">{model.name}</div>
                {model.vendor && (
                  <div className="text-zinc-400 text-[11px]">{model.vendor}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
