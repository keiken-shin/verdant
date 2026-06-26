import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, ArrowUp, Square, FileText, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { cn } from '@/utils';
import { ModelSelector } from './ModelSelector';
import { ActionMenu } from './ActionMenu';
import { AttachmentThumbnail } from './AttachmentThumbnail';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { ModelInfo, Attachment } from '@/types';

interface ChatInputProps {
  sessionId: string;
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
  baseContextTokens?: number;
}

export function ChatInput({
  sessionId,
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
  baseContextTokens = 0,
}: ChatInputProps) {
  const { settings } = useSettingsStore();
  const { activeToolsBySession, toggleTool } = useSessionStore();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedTools = activeToolsBySession[sessionId] || [];

  const activeModelInfo = models.find(m => m.id === selectedModelId);
  // Default to true if capabilities are unknown, to be safe/permissive
  const supportsVision = activeModelInfo?.capabilities?.includes('vision') ?? true;
  const hasImageAttachments = attachments.some(a => a.type === 'image');
  const preventSubmit = hasImageAttachments && !supportsVision;

  const maxContextTokens = settings.ollama_num_ctx || activeModelInfo?.contextLength || 8192;
  const estimatedTokens = baseContextTokens + Math.ceil(value.length / 4) + (attachments.length * 1000);
  const contextRatio = estimatedTokens / maxContextTokens;
  const isContextWarning = contextRatio > 0.8;
  const isContextCritical = contextRatio > 1.0;
  
  const reallyPreventSubmit = preventSubmit || isContextCritical;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming || reallyPreventSubmit) return;
    
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
    const extensions = supportsVision 
      ? ['png', 'jpg', 'jpeg', 'webp', 'txt', 'md', 'csv', 'json']
      : ['txt', 'md', 'csv', 'json'];

    const selected = await open({
      multiple: true,
      filters: [{ name: 'Allowed Files', extensions }],
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
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-2">
      {isContextWarning && (
        <div className={cn(
          "px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2",
          isContextCritical ? "bg-red-50 text-red-600 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"
        )}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {isContextCritical 
              ? `Estimated context exceeds limits (${Math.round(estimatedTokens).toLocaleString()} / ${maxContextTokens.toLocaleString()} tokens). Please remove attachments or start a new chat.` 
              : `Context nearing limit (${Math.round(estimatedTokens).toLocaleString()} / ${maxContextTokens.toLocaleString()} tokens).`}
          </span>
        </div>
      )}
      <div className={cn(
        "border rounded-xl bg-white shadow-sm transition-all relative",
        isContextCritical ? "border-red-300 focus-within:border-red-400" : "border-zinc-200 focus-within:border-zinc-300 focus-within:shadow-md"
      )}>
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="px-4 pt-3 flex flex-wrap gap-2">

            {attachments.map((att) => (
              <div 
                key={att.id} 
                className={cn(
                  "relative group/att inline-block transition-all",
                  preventSubmit && att.type === 'image' ? "after:absolute after:inset-0 after:border-2 after:border-red-500 after:rounded-xl after:pointer-events-none" : ""
                )}
              >
                <div className={cn("transition-all", preventSubmit && att.type === 'image' ? "grayscale opacity-50" : "")}>
                  <AttachmentThumbnail attachment={att} />
                </div>
                
                {preventSubmit && att.type === 'image' && (
                  <div 
                    className="absolute -top-1.5 -left-1.5 p-[1px] bg-white rounded-full shadow-sm z-20 cursor-help"
                    title="The selected model does not support image attachments. Please remove images or switch to a vision model."
                  >
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </div>
                )}

                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1 -right-1 p-0.5 rounded-full bg-zinc-800 text-white opacity-0 group-hover/att:opacity-100 transition-opacity shadow-sm z-20"
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
            <ActionMenu
              sessionId={sessionId}
              onAttach={handleAttach}
              selectedTools={selectedTools}
              onToggleTool={(tool) => toggleTool(sessionId, tool)}
              direction={dropdownDirection}
            />

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
          <button
            onClick={isStreaming ? onStop : handleSubmit}
            disabled={(!value.trim() && attachments.length === 0 && !isStreaming) || (!isStreaming && reallyPreventSubmit)}
            className={cn(
              "flex items-center justify-center h-7 w-7 rounded-full transition-all",
              isStreaming
                ? "bg-zinc-900 text-white hover:bg-zinc-700"
                : (!value.trim() && attachments.length === 0) || reallyPreventSubmit
                  ? "bg-zinc-100 text-zinc-300 cursor-not-allowed"
                  : "bg-zinc-900 text-white hover:bg-zinc-700 shadow-sm"
            )}
            aria-label={isStreaming ? "Stop generation" : "Send message"}
          >
            {isStreaming ? <Square className="h-3 w-3 fill-current" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
