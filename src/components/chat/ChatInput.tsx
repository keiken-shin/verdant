import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, ArrowUp, Square, FileText, Image as ImageIcon, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { cn } from '@/utils';
import { ModelSelector } from './ModelSelector';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import type { ModelInfo, Attachment } from '@/types';

interface ChatInputProps {
  onSend: (content: string, attachments?: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  models: ModelInfo[];
  selectedModelId: string | null;
  onModelChange: (modelId: string) => void;
  modelsLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  dropdownDirection?: 'up' | 'down';
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
  dropdownDirection = 'up',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;
    
    const attStr = attachments.length > 0 ? JSON.stringify(attachments) : undefined;
    onSend(trimmed, attStr);
    
    setValue('');
    setAttachments([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleAttach = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: 'Allowed Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'txt', 'md', 'csv', 'json'] }],
    });
    if (!selected) return;
    const files = Array.isArray(selected) ? selected : [selected];

    for (const filePath of files) {
      try {
        const bytes = await readFile(filePath);
        const name = filePath.split(/[\\/]/).pop() || filePath;
        const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
        const type = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? 'image' : 'text';
        
        const objectId = await invoke<string>('store_object', { data: Array.from(bytes) });
        
        const newAtt: Attachment = {
          id: Math.random().toString(36).substring(7),
          type,
          name,
          objectId,
        };
        setAttachments((prev) => [...prev, newAtt]);
      } catch (e) {
        console.error('Failed to attach file:', e);
      }
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
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
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div key={att.id} className="relative group/att inline-block">
                <AttachmentThumbnail attachment={att} />
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1 -right-1 p-0.5 rounded-full bg-zinc-800 text-white opacity-0 group-hover/att:opacity-100 transition-opacity shadow-sm z-10"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

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
              onClick={handleAttach}
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
              direction={dropdownDirection}
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
              disabled={(!value.trim() && attachments.length === 0) || disabled}
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-full transition-all',
                (value.trim() || attachments.length > 0) && !disabled
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
