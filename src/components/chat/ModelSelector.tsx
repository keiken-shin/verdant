import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Eye } from 'lucide-react';
import { cn } from '@/utils';
import type { ModelInfo } from '@/types';

interface ModelSelectorProps {
  models: ModelInfo[];
  selectedModelId: string | null;
  onSelect: (modelId: string) => void;
  loading?: boolean;
  direction?: 'up' | 'down';
}

export function ModelSelector({ models, selectedModelId, onSelect, loading, direction = 'up' }: ModelSelectorProps) {
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
          'text-[var(--color-verdant-primary)] hover:bg-[var(--color-verdant-hover)] transition-colors',
          loading && 'opacity-50 pointer-events-none'
        )}
        disabled={loading}
      >
        <span className="font-mono">{loading ? 'Loading...' : displayName}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className={cn(
          "absolute left-0 w-52 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-50 max-h-56 overflow-y-auto",
          direction === 'up' ? "bottom-full mb-1" : "top-full mt-1"
        )}>
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
                  model.id === selectedModelId && 'text-[var(--color-verdant-primary)] font-medium bg-zinc-50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono font-medium truncate pr-2">{model.name}</div>
                  {model.capabilities?.includes('vision') && (
                    <div className="flex items-center gap-0.5 text-blue-500 bg-blue-50 px-1 py-0.5 rounded text-[9px] uppercase tracking-wider shrink-0" title="Supports Image Attachments">
                      <Eye className="h-2.5 w-2.5" />
                      Vision
                    </div>
                  )}
                </div>
                {model.vendor && (
                  <div className="text-zinc-400 text-[11px] mt-0.5">{model.vendor}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
