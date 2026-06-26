import React, { useState, useRef, useEffect } from 'react';
import { Plus, Paperclip, Globe, Check } from 'lucide-react';
import { cn } from '@/utils';
import { availableTools } from '@/services/toolExecution';

interface ActionMenuProps {
  sessionId: string;
  onAttach: () => void;
  selectedTools: string[];
  onToggleTool: (toolName: string) => void;
  direction?: 'up' | 'down';
}

export function ActionMenu({ sessionId, onAttach, selectedTools, onToggleTool, direction = 'up' }: ActionMenuProps) {
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

  const webSearchSelected = selectedTools.includes('web_search');

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
        aria-label="Add actions"
        title="Add files or tools"
      >
        <Plus className="h-5 w-5" />
      </button>

      {isOpen && (
        <div 
          className={cn(
            "absolute left-0 z-50 w-64 bg-white border border-zinc-200 rounded-xl shadow-xl py-2 flex flex-col",
            direction === 'up' ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {/* Actions */}
          <button
            onClick={() => {
              setIsOpen(false);
              onAttach();
            }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 flex items-center gap-3 transition-colors text-zinc-700 font-medium"
          >
            <Paperclip className="h-4 w-4 text-zinc-400" />
            Add files or photos
          </button>
          
          <div className="my-1.5 border-b border-zinc-100 mx-2"></div>
          
          <div className="px-4 py-1.5">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tools</span>
          </div>

          {availableTools.filter(t => t.function.name === 'web_search').map(t => (
            <button
              key={t.function.name}
              onClick={() => onToggleTool(t.function.name)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 flex items-center gap-3 transition-colors text-zinc-700 font-medium group"
            >
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="flex-1">Web search</span>
              {webSearchSelected && <Check className="h-4 w-4 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
