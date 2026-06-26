import React, { useState, useEffect } from 'react';
import { Copy, RotateCcw, Edit2, Check, ChevronDown, ChevronRight, Brain, GitBranch, Wrench, Clock, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn, parseThinking } from '@/utils';
import type { Message } from '@/types';

// Using the same MarkdownRenderer from MessageBubbles for consistency
import { MarkdownRenderer } from './MessageBubbles';

const ToolResultCard = ({ content, name }: { content: string, name?: string }) => {
  try {
    const parsed = JSON.parse(content);
    if (name === 'web_search') {
      if (parsed.status || (parsed.results && parsed.results.length === 0)) {
        return (
          <div className="space-y-2 mt-2">
            {parsed.query && <div className="text-xs text-zinc-500 mb-1">Searched for: <span className="font-medium text-zinc-700">"{parsed.query}"</span></div>}
            <div className="bg-white p-3 rounded-md border border-zinc-200 shadow-sm text-xs text-zinc-600 italic">
              {parsed.status || "No results found."}
            </div>
          </div>
        );
      }
      
      if (parsed.results && Array.isArray(parsed.results)) {
        return (
          <div className="space-y-2 mt-2">
            {parsed.query && <div className="text-xs text-zinc-500 mb-1">Searched for: <span className="font-medium text-zinc-700">"{parsed.query}"</span></div>}
            <div className="flex flex-col gap-2">
              {parsed.results.map((res: any, idx: number) => (
                <div key={idx} className="flex flex-col gap-0.5 bg-white p-2.5 rounded-md border border-zinc-200 shadow-sm">
                  <a href={res.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline line-clamp-1">
                    {res.title || res.url}
                  </a>
                  <div className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mt-0.5">{res.snippet}</div>
                  <div className="text-[10px] text-zinc-400 truncate mt-1">{res.url}</div>
                </div>
              ))}
            </div>
          </div>
        );
      }
    }
    
    // Generic JSON -> formatted nicely
    return (
      <div className="bg-white p-3 rounded-md border border-zinc-200 shadow-sm max-h-60 overflow-y-auto custom-scrollbar mt-2">
        <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-600 m-0 break-words">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      </div>
    );
  } catch (e) {
    return (
      <div className="bg-white p-3 rounded-md border border-zinc-200 shadow-sm max-h-60 overflow-y-auto custom-scrollbar mt-2">
        <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-600 m-0 break-words">
          {content}
        </pre>
      </div>
    );
  }
};

const ToolCallNode = ({ calls, results }: { calls: any[], results: any[] }) => {
  const [expanded, setExpanded] = useState(false);
  const toolNames = calls.map((tc: any) => tc.function.name).join(', ');
  
  return (
    <div className="flex flex-col">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-orange-700 font-medium hover:text-orange-800 transition-colors text-left"
      >
        <div className="flex items-center justify-center w-4 h-4">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
        Used tools: {toolNames}
      </button>
      
      {expanded && results && results.length > 0 && (
        <div className="mt-1 ml-2 pl-4 border-l-2 border-orange-200/50 flex flex-col gap-3">
          {results.map((res: any, idx: number) => {
            const call = calls.find((tc: any) => tc.id === res.tool_call_id);
            const actualName = call?.function?.name || res.name || toolNames;
            return <ToolResultCard key={idx} content={res.content} name={actualName} />;
          })}
        </div>
      )}
    </div>
  );
};

const ThoughtNode = ({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      if (contentRef.current.scrollHeight > 100) {
        setIsClamped(true);
      }
    }
  }, [content]);

  return (
    <div className="relative">
      <div 
        ref={contentRef}
        className={cn(
          "text-zinc-500 leading-relaxed prose prose-sm max-w-none prose-p:my-1 transition-all duration-200",
          !expanded && "max-h-[96px] overflow-hidden relative"
        )}
      >
        <MarkdownRenderer content={content} />
        {!expanded && isClamped && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--color-verdant-bg)] to-transparent pointer-events-none" />
        )}
      </div>
      {isClamped && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-semibold text-zinc-800 hover:text-black mt-2 transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};

interface AssistantMessageGroupProps {
  messages: Message[];
  streamingContent?: string;
  onCopy?: (content: string) => void;
  onRegenerate?: () => void;
  onFork?: (id: string) => void;
  isLast?: boolean;
  variantIndex?: number;
  totalVariants?: number;
  onSwitchVariant?: (direction: 'prev' | 'next') => void;
}

export function AssistantMessageGroup({ 
  messages, 
  streamingContent, 
  onCopy, 
  onRegenerate, 
  onFork, 
  isLast, 
  variantIndex, 
  totalVariants, 
  onSwitchVariant 
}: AssistantMessageGroupProps) {
  const [copied, setCopied] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  if (!messages || messages.length === 0) return null;

  // Compile timeline events
  const events: any[] = [];
  let finalContent = '';
  let finalMessage: Message | null = null;
  
  messages.forEach(msg => {
    if (msg.role === 'tool') {
      const anyMsg = msg as any;
      const parentCall = events.find(e => e.type === 'tool_call' && e.calls.some((tc: any) => tc.id === msg.tool_call_id));
      if (parentCall) {
        if (!parentCall.results) parentCall.results = [];
        parentCall.results.push({ content: msg.content, tool_call_id: msg.tool_call_id, name: anyMsg.name });
      } else {
        events.push({ type: 'tool_result', content: msg.content, id: msg.id, name: anyMsg.name || msg.tool_call_id });
      }
    } else if (msg.role === 'assistant') {
      const { thinking, content, isThinking } = parseThinking(msg.content);
      if (thinking) {
        events.push({ type: 'thought', content: thinking, id: msg.id + '-think' });
      }
      let toolCalls = [];
      try { if (msg.tool_calls) toolCalls = JSON.parse(msg.tool_calls); } catch (e) {}
      if (toolCalls.length > 0) {
        events.push({ type: 'tool_call', calls: toolCalls, id: msg.id + '-calls', results: [] });
      }
      if (content) {
        finalContent = content;
        finalMessage = msg;
      }
    }
  });

  // Handle streaming
  let isStreamThinking = false;
  if (streamingContent !== undefined) {
    const { thinking: streamThink, content: streamContent, isThinking } = parseThinking(streamingContent);
    isStreamThinking = isThinking;
    if (streamThink) {
      events.push({ 
        type: 'thought', 
        content: streamThink + (isThinking ? ' █' : ''), 
        id: 'stream-think', 
        streaming: isThinking 
      });
    }
    if (streamContent) {
      finalContent = streamContent;
    }
  }

  // Auto-expand timeline if currently thinking and not explicitly collapsed
  // We'll manage this with a simple effect:
  useEffect(() => {
    if (isStreamThinking) {
      setTimelineExpanded(true);
    }
  }, [isStreamThinking]);

  // Determine the title for the collapsed state
  let timelineTitle = 'Thought Process';
  const firstThought = events.find(e => e.type === 'thought');
  if (firstThought && firstThought.content) {
    // Extract first sentence or first 60 chars
    const firstLine = firstThought.content.split('\n')[0].replace(/<[^>]*>?/gm, '').trim();
    if (firstLine.length > 0) {
      timelineTitle = firstLine.length > 60 ? firstLine.substring(0, 60) + '...' : firstLine;
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(finalContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.(finalContent);
  };

  const firstMsg = messages[0];

  return (
    <div className="group mb-6">
      {events.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setTimelineExpanded(!timelineExpanded)}
            className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors select-none w-full text-left"
          >
            <div className="flex items-center justify-center w-5 h-5">
              {timelineExpanded ? (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              )}
            </div>
            <span className="font-medium truncate">{timelineTitle}</span>
            {isStreamThinking && (
              <div className="flex gap-1 items-center h-4 ml-2">
                <div className="h-1 w-1 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-1 w-1 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-1 w-1 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </button>
          
          {timelineExpanded && (
            <div className="mt-3 ml-2 pl-4 border-l-2 border-zinc-200/60 flex flex-col gap-4">
              {events.map((ev, idx) => (
                <div key={ev.id || idx} className="relative">
                  {/* Timeline node icon */}
                  {ev.type !== 'tool_result' && (
                    <div className="absolute -left-[25px] top-1 bg-[var(--color-verdant-bg)] rounded-full p-0.5">
                      {ev.type === 'thought' && <Clock className="h-4 w-4 text-zinc-400" />}
                      {ev.type === 'tool_call' && <Wrench className="h-4 w-4 text-orange-400" />}
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="text-sm pl-2">
                    {ev.type === 'thought' && <ThoughtNode content={ev.content} />}
                    {ev.type === 'tool_call' && (
                      <ToolCallNode calls={ev.calls} results={ev.results} />
                    )}
                    {ev.type === 'tool_result' && (
                      <ToolResultCard content={ev.content} name={ev.name} />
                    )}
                  </div>
                </div>
              ))}

              {/* Done Marker */}
              {finalContent && !isStreamThinking && (
                <div className="relative mt-2">
                  <div className="absolute -left-[25px] top-1 bg-[var(--color-verdant-bg)] rounded-full p-0.5">
                    <CheckCircle2 className="h-4 w-4 text-zinc-500" />
                  </div>
                  <div className="text-sm pl-2 text-zinc-800 font-medium pt-0.5">
                    Done
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {finalContent ? (
        <div className="prose prose-sm max-w-none text-zinc-700 mt-2">
          <MarkdownRenderer content={finalContent} />
        </div>
      ) : (
        !isStreamThinking && (
           <div className="flex gap-1 items-center h-5 mt-2">
             <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '0ms' }} />
             <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '150ms' }} />
             <div className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: '300ms' }} />
           </div>
        )
      )}

      {/* Action buttons */}
      {finalMessage && (
        <div className="flex items-center justify-between mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
              aria-label="Copy response"
              title="Copy response"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center justify-center p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
                aria-label="Regenerate response"
                title="Regenerate response"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            {onFork && (
              <button
                onClick={() => onFork(firstMsg.id)} // Fork from the first message in the group to include the whole chain
                className="flex items-center justify-center p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
                aria-label="Branch to new session"
                title="Branch to new session"
              >
                <GitBranch className="h-4 w-4" />
              </button>
            )}
            
            {totalVariants !== undefined && totalVariants > 1 && variantIndex !== undefined && (
              <div className="flex items-center gap-2 ml-2 text-xs text-zinc-500 font-mono select-none">
                <button
                  onClick={() => onSwitchVariant?.('prev')}
                  disabled={variantIndex === 0}
                  className="p-1 hover:text-zinc-800 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
                >
                  {'<'}
                </button>
                <span>{variantIndex + 1} / {totalVariants}</span>
                <button
                  onClick={() => onSwitchVariant?.('next')}
                  disabled={variantIndex === totalVariants - 1}
                  className="p-1 hover:text-zinc-800 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
                >
                  {'>'}
                </button>
              </div>
            )}
          </div>
          <div className="text-[10px] text-zinc-400 font-mono select-none pr-2">
            {new Intl.DateTimeFormat('default', { hour: 'numeric', minute: '2-digit' }).format(new Date((finalMessage as Message).created_at))}
          </div>
        </div>
      )}
    </div>
  );
}
