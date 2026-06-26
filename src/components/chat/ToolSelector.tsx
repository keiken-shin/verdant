import React, { useState, useRef, useEffect } from 'react';
import { Wrench, Check } from 'lucide-react';
import { cn } from '@/utils';
import { availableTools } from '@/services/toolExecution';

interface ToolSelectorProps {
  selectedTools: string[];
  onChange: (tools: string[]) => void;
  direction?: 'up' | 'down';
}

export function ToolSelector({ selectedTools, onChange, direction = 'up' }: ToolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleTool = (toolName: string) => {
    if (selectedTools.includes(toolName)) {
      onChange(selectedTools.filter(t => t !== toolName));
    } else {
      onChange([...selectedTools, toolName]);
    }
  };

  const isActive = selectedTools.length > 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
          isActive 
            ? "text-[var(--color-verdant-primary)] bg-[var(--color-verdant-primary)]/10 hover:bg-[var(--color-verdant-primary)]/20" 
            : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100"
        )}
        title="Select Tools"
      >
        <Wrench className="h-3.5 w-3.5" />
        {selectedTools.length > 0 && <span>{selectedTools.length}</span>}
      </button>

      {isOpen && (
        <div 
          className={cn(
            "absolute left-0 z-50 w-56 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 flex flex-col",
            direction === 'up' ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          <div className="px-3 py-2 border-b border-zinc-100">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Available Tools</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {availableTools.map(t => {
              const name = t.function.name;
              const isSelected = selectedTools.includes(name);
              return (
                <button
                  key={name}
                  onClick={() => toggleTool(name)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-start gap-2 transition-colors"
                >
                  <div className={cn(
                    "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                    isSelected ? "bg-[var(--color-verdant-primary)] border-[var(--color-verdant-primary)]" : "border-zinc-300"
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <div className={cn("font-medium", isSelected ? "text-zinc-900" : "text-zinc-700")}>{name}</div>
                    <div className="text-xs text-zinc-500 line-clamp-2 mt-0.5">{t.function.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
