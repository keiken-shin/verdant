import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, RotateCcw, Edit2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils';
import type { Message } from '@/types';

interface UserMessageProps {
  message: Message;
  onEdit?: (id: string, content: string) => void;
}

export function UserMessage({ message, onEdit }: UserMessageProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);

  const handleSave = () => {
    if (onEdit && editValue.trim()) {
      onEdit(message.id, editValue.trim());
    }
    setEditing(false);
  };

  return (
    <div className="flex justify-end mb-6">
      <div className="max-w-[70%] group">
        {editing ? (
          <div className="border border-zinc-200 rounded-xl overflow-hidden">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 text-sm text-zinc-800 outline-none resize-none min-h-[80px] bg-white"
            />
            <div className="flex gap-2 px-3 pb-3">
              <button
                onClick={handleSave}
                className="px-3 py-1 text-xs rounded-md bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { setEditing(false); setEditValue(message.content); }}
                className="px-3 py-1 text-xs rounded-md text-zinc-500 hover:bg-zinc-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="bg-zinc-100 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-zinc-800 leading-relaxed whitespace-pre-wrap">
              {message.content}
            </div>
            {onEdit && (
              <button
                onClick={() => setEditing(true)}
                className="absolute -bottom-5 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600"
                aria-label="Edit message"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface AssistantMessageProps {
  message: Message;
  onCopy?: () => void;
  onRegenerate?: () => void;
  isLast?: boolean;
}

export function AssistantMessage({ message, onCopy, onRegenerate, isLast }: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  return (
    <div className="mb-6 group">
      <div className="prose prose-sm max-w-none text-zinc-700">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code: ({ className, children, ...props }) => {
              const isBlock = className?.includes('language-');
              return isBlock ? (
                <div className="relative my-3">
                  <pre className="bg-zinc-950 text-zinc-100 rounded-lg px-4 py-3 overflow-x-auto text-xs font-mono leading-relaxed">
                    <code>{children}</code>
                  </pre>
                  <button
                    onClick={() => navigator.clipboard.writeText(String(children))}
                    className="absolute top-2 right-2 p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                    aria-label="Copy code"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <code className="px-1.5 py-0.5 bg-zinc-100 text-zinc-800 rounded text-xs font-mono" {...props}>
                  {children}
                </code>
              );
            },
            p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            h1: ({ children }) => <h1 className="text-xl font-bold mb-3 text-zinc-900">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 text-zinc-900">{children}</h2>,
            h3: ({ children }) => <h3 className="text-base font-semibold mb-2 text-zinc-900">{children}</h3>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-zinc-200 pl-4 my-3 text-zinc-500 italic">{children}</blockquote>
            ),
            a: ({ href, children }) => (
              <a href={href} className="text-[var(--color-verdant-primary)] underline underline-offset-2 hover:opacity-80" target="_blank" rel="noreferrer">{children}</a>
            ),
            hr: () => <hr className="border-zinc-100 my-4" />,
            table: ({ children }) => (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full text-xs border-collapse border border-zinc-200 rounded">{children}</table>
              </div>
            ),
            th: ({ children }) => <th className="px-3 py-2 bg-zinc-50 border border-zinc-200 font-medium text-left">{children}</th>,
            td: ({ children }) => <td className="px-3 py-2 border border-zinc-200">{children}</td>,
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
          aria-label="Copy response"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
        {isLast && onRegenerate && (
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
            aria-label="Regenerate response"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Regenerate</span>
          </button>
        )}
      </div>
    </div>
  );
}

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="mb-6">
      <div className="prose prose-sm max-w-none text-zinc-700">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
        {!content && (
          <div className="flex gap-1 items-center h-5">
            <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}
