import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, ArrowUp, Square } from 'lucide-react';
import { cn } from '@/utils';
import { ModelSelector } from './ModelSelector';
import type { ModelInfo } from '@/types';

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  models: ModelInfo[];
  selectedModelId: string | null;
  onModelChange: (modelId: string) => void;
  modelsLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  models,
  selectedModelId,
  onModelChange,
  modelsLoading,
  disabled,
  placeholder = 'Ask, think aloud, or paste a passage...',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="border border-zinc-200 rounded-xl bg-white shadow-sm focus-within:border-zinc-300 focus-within:shadow-md transition-all relative">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full px-4 pt-3.5 pb-2 text-sm text-zinc-800 placeholder:text-zinc-400 bg-transparent outline-none resize-none min-h-[44px] max-h-40"
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            {/* Attachment button */}
            <button
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
              aria-label="Attach file"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Model selector */}
            <ModelSelector
              models={models}
              selectedModelId={selectedModelId}
              onSelect={onModelChange}
              loading={modelsLoading}
            />
          </div>

          {/* Send / Stop button */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex items-center justify-center h-7 w-7 rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
              aria-label="Stop generation"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!value.trim() || disabled}
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-full transition-all',
                value.trim() && !disabled
                  ? 'bg-zinc-900 text-white hover:bg-zinc-700'
                  : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
              )}
              aria-label="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
