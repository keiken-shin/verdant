import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useConfirmStore } from '@/stores/confirmStore';
import { Edit2, Trash2, Check, X, FolderKanban, ArrowDown } from 'lucide-react';

import { ContextIndicator } from '@/components/chat/ContextIndicator';
import { ChatInput } from '@/components/chat/ChatInput';
import { UserMessage } from '@/components/chat/MessageBubbles';
import { AssistantMessageGroup } from '@/components/chat/AssistantMessageGroup';
import { AssistantMessage, ToolMessage, StreamingMessage } from '@/components/chat/MessageBubbles';
import { SectionLabel } from '@/components/ui/PageHeader';
import { useSessionStore } from '@/stores/sessionStore';
import { useMessageStore } from '@/stores/messageStore';
import { usePersonaStore } from '@/stores/personaStore';
import { executeToolCall, availableTools } from '@/services/toolExecution';
import { useProviderStore } from '@/stores/providerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import { buildProjectContext } from '@/services/sessionContext';
import { useModels } from '@/hooks/useModels';
import type { Message, ChatMessage } from '@/types';
import { cn } from '@/utils';

import { providerRegistry } from '@/providers/registry';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasPanel } from '@/components/canvas/CanvasPanel';

const PROMPT_SUGGESTIONS = [
  "Explain pattern languages in your own words.",
  "What does 'local-first' really mean?",
  "Help me outline an essay on quiet computing.",
  "Sketch a knowledge graph schema for research notes.",
];

function ChatWelcome({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col justify-center px-8 max-w-2xl">
      <SectionLabel className="mb-4">A QUIET PLACE TO THINK</SectionLabel>
      <h1 className="page-title mb-5">
        Let&apos;s get<br />started.
      </h1>
      <p className="text-base text-zinc-500 leading-relaxed mb-10 max-w-lg">
        Verdant is a local-first workspace for thinking with language models. Your conversations, memories, and the connections between them stay on your machine — a small, slow, private notebook with a graph for a mind.
      </p>

      <div>
        <SectionLabel className="mb-3 block">BEGIN WITH</SectionLabel>
        <div className="flex flex-col gap-2">
          {PROMPT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion(s)}
              className="text-left px-4 py-2.5 border border-zinc-200 rounded-lg text-sm text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const EMPTY_MESSAGES: any[] = [];

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const { sessions, createSession, updateSession, deleteSession } = useSessionStore();
  const { messagesBySession, activeVariantIds, setActiveVariant, streamingContent, isStreaming, streamingSessionId, fetchMessages, addMessage, setIsStreaming, setStreamingSessionId, setStreamingContent, appendStreamingContent, setAbortController, stopStreaming } = useMessageStore();
  const { providers, activeModelId, setActiveModel } = useProviderStore();
  const { settings } = useSettingsStore();
  const { projects, filesByProject, fetchProjectFiles } = useProjectStore();
  const { models, modelsLoading } = useModels();
  const { isOpen: isCanvasOpen } = useCanvasStore();

  const [streamingParentId, setStreamingParentId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentInitialRef = useRef<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollButton(isScrolledUp);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const currentSession = sessions.find((s) => s.id === sessionId);
  const project = currentSession?.project_id
    ? projects.find((p) => p.id === currentSession.project_id)
    : undefined;
  const messages = sessionId ? (messagesBySession[sessionId] || EMPTY_MESSAGES) : EMPTY_MESSAGES;

  const baseContextTokens = React.useMemo(() => {
    let tokens = messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);
    if (project) {
      const files = filesByProject[project.id] || [];
      const filesTokens = files.reduce((acc, f) => {
        if (f.include_mode === 'reference') return acc;
        if (f.include_mode === 'summary' && f.summary) {
          return acc + Math.ceil(f.summary.length / 4);
        }
        return acc + Math.ceil((f.size || 0) / 4);
      }, 0);
      tokens += filesTokens;
    }
    return tokens;
  }, [messages, project, filesByProject]);

  // Load messages when session changes
  useEffect(() => {
    if (sessionId && !messagesBySession[sessionId]) {
      fetchMessages(sessionId);
    }
  }, [sessionId, fetchMessages, messagesBySession]);

  useEffect(() => {
    useCanvasStore.getState().closeCanvas();
  }, [sessionId]);

  // Build tree and active path
  const sessionVariants = sessionId ? (activeVariantIds[sessionId] || {}) : {};
  const { activePath, variantsMap } = React.useMemo(() => {
    if (!messages.length) return { activePath: [], variantsMap: {} };

    const vMap: Record<string, Message[]> = {};
    const roots: Message[] = [];
    const sorted = [...messages].sort((a, b) => a.sort_order - b.sort_order);
    
    for (let i = 0; i < sorted.length; i++) {
      const msg = sorted[i];
      let parentId = msg.parent_id;
      if (!parentId && i > 0) parentId = sorted[i - 1].id;

      if (!parentId) {
        roots.push(msg);
      } else {
        if (!vMap[parentId]) vMap[parentId] = [];
        vMap[parentId].push(msg);
      }
    }

    const path: Message[] = [];
    let currentId: string | null = roots.length > 0 ? roots[roots.length - 1].id : null;

    while (currentId) {
      const currentMsg = sorted.find(m => m.id === currentId);
      if (!currentMsg) break;
      path.push(currentMsg);

      const children = vMap[currentId];
      if (!children || children.length === 0) break;

      const selectedId = sessionVariants[currentId];
      if (selectedId && children.some(c => c.id === selectedId)) {
        currentId = selectedId;
      } else {
        currentId = children[children.length - 1].id;
      }
    }

    return { activePath: path, variantsMap: vMap };
  }, [messages, sessionVariants]);

  // Scroll to bottom when messages change
  const prevPathLengthRef = useRef(activePath.length);
  
  useEffect(() => {
    const isNewMessage = activePath.length > prevPathLengthRef.current;
    prevPathLengthRef.current = activePath.length;

    if (isNewMessage || !showScrollButton) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activePath.length, streamingContent, showScrollButton]);

  const handleSend = useCallback(async (content: string, attachmentsStr?: string, overrideParentId?: string) => {
    if (!activeModelId) return;

    let sid = sessionId;

    // Create session if none exists
    if (!sid) {
      const session = await createSession('Untitled', activeModelId);
      sid = session.id;
      navigate(`/chat/${sid}`, { replace: true });
    }

    // Add user message. Parent is either the override, or the last active message
    let parentId = overrideParentId;
    if (!parentId) {
      const state = useMessageStore.getState();
      const currentMsgs = state.messagesBySession[sid] || [];
      // Re-compute active path to get the absolute latest leaf
      let lastId: string | undefined;
      if (currentMsgs.length > 0) {
        const sorted = [...currentMsgs].sort((a, b) => a.sort_order - b.sort_order);
        let curr = sorted[0].id;
        while (curr) {
          lastId = curr;
          const children = sorted.filter(m => (m.parent_id || null) === curr || (!m.parent_id && sorted.indexOf(m) === sorted.findIndex(x=>x.id===curr)+1));
          if (children.length === 0) break;
          const variants = state.activeVariantIds[sid] || {};
          const selectedId = variants[curr];
          if (selectedId && children.some(c => c.id === selectedId)) curr = selectedId;
          else curr = children[children.length - 1].id;
        }
      }
      parentId = lastId;
    }
    const userMsg = await addMessage(sid, 'user', content, activeModelId || undefined, parentId, attachmentsStr);

    // Get the most up-to-date messages from the store
    const currentMessages = useMessageStore.getState().messagesBySession[sid] || [];

    // Update session title from first message
    if (currentMessages.length === 1) {
      const title = content.slice(0, 50).trim();
      await updateSession(sid, { title, model_id: activeModelId });
    }

    // Recompute path up to userMsg for context
    const sorted = [...currentMessages].sort((a, b) => a.sort_order - b.sort_order);
    const historyPath: Message[] = [];
    let tracer: string | null | undefined = userMsg.id;
    while (tracer) {
      const msg = sorted.find(m => m.id === tracer);
      if (!msg) break;
      historyPath.unshift(msg);
      tracer = msg.parent_id;
      if (!tracer && sorted.indexOf(msg) > 0) tracer = sorted[sorted.indexOf(msg) - 1].id; // legacy fallback
    }

    const history: ChatMessage[] = await Promise.all(historyPath.map(async (m) => {
      let content = m.content;
      let images: string[] = [];

      if (m.attachments) {
        try {
          const parsedAttachments: import('@/types').Attachment[] = JSON.parse(m.attachments);
          for (const att of parsedAttachments) {
            if (att.type === 'image') {
              const b64 = await invoke<string>('read_object_base64', { id: att.objectId });
              images.push(b64);
            } else if (att.type === 'text') {
              const txt = await invoke<string>('read_object_text', { id: att.objectId });
              content += `\n\n--- Attachment: ${att.name} ---\n${txt}`;
            }
          }
        } catch (e) {
          console.error('Failed to parse or load attachments for message', m.id, e);
        }
      }

      return {
        role: m.role as 'user' | 'assistant' | 'system' | 'tool',
        content,
        images: images.length > 0 ? images : undefined,
        tool_calls: m.tool_calls ? JSON.parse(m.tool_calls) : undefined,
      };
    }));

    // Stream response
    const defaultProvider = providers.find((p) => p.is_default) || providers[0];
    if (!defaultProvider) return;

    const ollamaEndpoint = settings.ollama_host || defaultProvider.endpoint;
    const provider = providerRegistry.createOllama(defaultProvider.id, ollamaEndpoint);

    // Project context: prepend a system message with project instructions,
    // knowledge base, and summaries of sibling sessions (only for project chats).
    const sessionProjectId = useSessionStore.getState().sessions.find((s) => s.id === sid)?.project_id;
    if (sessionProjectId) {
      const proj = useProjectStore.getState().projects.find((p) => p.id === sessionProjectId);
      if (proj) {
        try {
          await fetchProjectFiles(sessionProjectId);
          const files = useProjectStore.getState().filesByProject[sessionProjectId] || [];
          const systemMsg = await buildProjectContext({
            project: proj,
            files,
            currentSessionId: sid,
            provider,
            modelId: settings.extraction_model || activeModelId || 'llama3',
            budgetTokens: Math.floor((settings.ollama_num_ctx || 32768) * 0.8), // Leave 20% for history and response
          });
          if (systemMsg) history.unshift({ role: 'system', content: systemMsg });
        } catch (e) {
          console.error('Failed to build project context:', e);
        }
      }
    }

    // Persona context: prepend the persona prompt as a system message.
    let personas = usePersonaStore.getState().personas;
    if (personas.length === 0) {
      await usePersonaStore.getState().fetchPersonas();
      personas = usePersonaStore.getState().personas;
    }
    
    let personaId = settings.default_persona_id;
    if (sessionProjectId) {
      const proj = useProjectStore.getState().projects.find((p) => p.id === sessionProjectId);
      if (proj && proj.persona_id) {
        personaId = proj.persona_id;
      }
    }
    
    const selectedPersona = personas.find(p => p.id === personaId) || personas.find(p => p.id === 'default-assistant');
    if (selectedPersona && selectedPersona.prompt) {
      history.unshift({ role: 'system', content: selectedPersona.prompt });
    }

    const abortCtrl = new AbortController();
    setAbortController(abortCtrl);

    const state = useSessionStore.getState();
    const selectedTools = state.activeToolsBySession[sid] || [];
    const activeTools = selectedTools.length > 0 
      ? availableTools.filter(t => selectedTools.includes(t.function.name))
      : undefined;

    if (selectedTools.includes('canvas')) {
      history.unshift({ role: 'system', content: 'You have access to an interactive Canvas panel. When asked to create an application, component, or document, you MUST provide the ENTIRE, completely self-contained code in a SINGLE markdown fenced code block (e.g. ```html or ```react). DO NOT break the code into multiple step-by-step snippets or provide partial updates. Output the final, working code all at once so it can be rendered as a single interactive Canvas.' });
    }

    const runStreamLoop = async (currentHistory: typeof history, parentMessageId: string) => {
      setIsStreaming(true);
      setStreamingSessionId(sid);
      setStreamingParentId(parentMessageId);
      setStreamingContent('');
      
      let receivedToolCalls: import('@/types').ToolCall[] | undefined = undefined;

      try {
        await provider.streamChat(
          { model: activeModelId, messages: currentHistory, stream: true, tools: activeTools },
          (chunk) => {
            if (chunk.content) appendStreamingContent(chunk.content);
            if (chunk.tool_calls) receivedToolCalls = chunk.tool_calls;
            if (chunk.done && typeof chunk.prompt_eval_count === 'number') {
               useMessageStore.getState().setLastContextUsage({
                 used: chunk.prompt_eval_count + (chunk.eval_count || 0),
                 total: settings.ollama_num_ctx || 32768,
               });
            }
          },
          abortCtrl.signal
        );

        const finalContent = useMessageStore.getState().streamingContent;
        let nextParentId = parentMessageId;
        
        if (finalContent || receivedToolCalls) {
          const msg = await addMessage(sid, 'assistant', finalContent, activeModelId || undefined, parentMessageId, undefined, receivedToolCalls ? JSON.stringify(receivedToolCalls) : undefined);
          nextParentId = msg.id;
        }

        const calls = receivedToolCalls as import('@/types').ToolCall[] | undefined;
        if (calls && calls.length > 0) {
          currentHistory.push({
            role: 'assistant',
            content: finalContent,
            tool_calls: calls
          });

          for (const tc of calls) {
            setStreamingContent(`Executing tool: ${tc.function.name}...`);
            const res = await executeToolCall(tc);
            const toolMsg = await addMessage(sid, 'tool', res, activeModelId || undefined, nextParentId, undefined, undefined, tc.id);
            nextParentId = toolMsg.id;
            
            currentHistory.push({
              role: 'tool',
              content: res
            });
          }
          
          await runStreamLoop(currentHistory, nextParentId);
        }
      } catch (e: unknown) {
        if (e instanceof Error ? e.name !== 'AbortError' : true) {
          const errorMsg = `Error: ${e instanceof Error ? e.message : (typeof e === 'string' ? e : 'Failed to get response')}`;
          await addMessage(sid, 'assistant', errorMsg, activeModelId || undefined, parentMessageId);
        }
      }
    };
    
    await runStreamLoop(history, userMsg.id);

    setIsStreaming(false);
    setStreamingSessionId(null);
    setStreamingParentId(null);
    setStreamingContent('');
    setAbortController(null);
  }, [activeModelId, sessionId, providers, settings.ollama_host, settings.extraction_model, createSession, updateSession, addMessage, fetchProjectFiles, setAbortController, setIsStreaming, setStreamingContent, appendStreamingContent, navigate, setStreamingSessionId]);

  // Auto-send an initial prompt passed from the project workspace (one-shot).
  // Gated on activeModelId: on a cold start models may still be loading, and
  // handleSend early-returns without one. handleSend's identity changes when
  // activeModelId is set, so this effect re-fires and sends once a model exists.
  useEffect(() => {
    const initialPrompt = (location.state as { initialPrompt?: string } | null)?.initialPrompt;
    if (sessionId && initialPrompt && activeModelId && sentInitialRef.current !== sessionId) {
      sentInitialRef.current = sessionId;
      navigate(location.pathname, { replace: true, state: {} }); // clear so it doesn't re-fire
      handleSend(initialPrompt);
    }
  }, [sessionId, location.state, location.pathname, activeModelId, navigate, handleSend]);

  const handleRegenerate = useCallback(async () => {
    if (!sessionId || activePath.length < 2) return;
    const lastMsg = activePath[activePath.length - 1];
    if (lastMsg.role !== 'assistant') return;
    
    // The parent of the assistant message is the user message
    const parentId = lastMsg.parent_id || (messages.length > 1 ? messages[messages.length - 2].id : undefined);
    const parentMsg = messages.find(m => m.id === parentId);
    
    if (parentMsg && parentMsg.role === 'user') {
      // Instead of sending a new prompt, we re-run the stream with the same history up to the parentMsg.
      // But handleSend currently adds a new user message. We need a way to just generate an assistant response for an existing user message.
      
      // Let's refactor handleSend slightly or just replicate the stream logic here for regenerating.
      // For now, let's call a new internal helper or inline the regenerate stream logic.
      
      // We know `handleSend` adds a user message. We don't want that.
      setIsStreaming(true);
      setStreamingSessionId(sessionId);
      setStreamingParentId(parentMsg.id);
      setStreamingContent('');
      const abortCtrl = new AbortController();
      setAbortController(abortCtrl);

      try {
        const sorted = [...messages].sort((a, b) => a.sort_order - b.sort_order);
        const historyPath: Message[] = [];
        let tracer: string | null | undefined = parentMsg.id;
        while (tracer) {
          const msg = sorted.find(m => m.id === tracer);
          if (!msg) break;
          historyPath.unshift(msg);
          tracer = msg.parent_id;
          if (!tracer && sorted.indexOf(msg) > 0) tracer = sorted[sorted.indexOf(msg) - 1].id;
        }

        const history = historyPath.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));

        const defaultProvider = providers.find((p) => p.is_default) || providers[0];
        if (!defaultProvider) throw new Error('No provider');
        const ollamaEndpoint = settings.ollama_host || defaultProvider.endpoint;
        const provider = providerRegistry.createOllama(defaultProvider.id, ollamaEndpoint);

        // Fetch project context if needed
        const currentSession = useSessionStore.getState().sessions.find(s => s.id === sessionId);
        if (currentSession?.project_id) {
          const proj = useProjectStore.getState().projects.find(p => p.id === currentSession.project_id);
          if (proj) {
            const files = useProjectStore.getState().filesByProject[proj.id] || [];
            const systemMsg = await buildProjectContext({
              project: proj, files, currentSessionId: sessionId, provider, modelId: settings.extraction_model || activeModelId || 'llama3',
              budgetTokens: Math.floor((settings.ollama_num_ctx || 32768) * 0.8),
            });
            if (systemMsg) history.unshift({ role: 'system', content: systemMsg });
          }
        }
        
        const state = useSessionStore.getState();
        const selectedTools = state.activeToolsBySession[sessionId] || [];
        const activeTools = selectedTools.length > 0 
          ? availableTools.filter(t => selectedTools.includes(t.function.name))
          : undefined;

        if (selectedTools.includes('canvas')) {
          history.unshift({ role: 'system', content: 'You have access to an interactive Canvas panel. When asked to create an application, component, or document, you MUST provide the ENTIRE, completely self-contained code in a SINGLE markdown fenced code block (e.g. ```html or ```react). DO NOT break the code into multiple step-by-step snippets or provide partial updates. Output the final, working code all at once so it can be rendered as a single interactive Canvas.' });
        }

        await provider.streamChat(
          { model: activeModelId || 'llama3', messages: history, stream: true, tools: activeTools },
          (chunk) => { if (chunk.content) appendStreamingContent(chunk.content); },
          abortCtrl.signal
        );

        const finalContent = useMessageStore.getState().streamingContent;
        if (finalContent) {
          await addMessage(sessionId, 'assistant', finalContent, activeModelId || undefined, parentMsg.id);
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') {
          await addMessage(sessionId, 'assistant', `Error: ${e.message}`, activeModelId || undefined, parentMsg.id);
        }
      } finally {
        setIsStreaming(false);
        setStreamingSessionId(null);
        setStreamingParentId(null);
        setStreamingContent('');
        setAbortController(null);
      }
    }
  }, [sessionId, activePath, messages, providers, settings.ollama_host, settings.extraction_model, activeModelId, setIsStreaming, setStreamingContent, setAbortController, appendStreamingContent, addMessage]);

  const handleEditMessage = useCallback(async (id: string, content: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    let parentId = msg.parent_id;
    if (!parentId) {
      // Fallback for legacy linear messages: the parent is the preceding message
      const sorted = [...messages].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex(m => m.id === id);
      if (idx > 0) parentId = sorted[idx - 1].id;
    }

    // Instead of overwriting, we branch out by sending a new prompt with the same parent
    await handleSend(content, undefined, parentId);
  }, [messages, handleSend]);

  const handleFork = useCallback(async (messageId: string) => {
    if (!sessionId) return;
    
    // Find the active path up to this message
    const msgIndex = activePath.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const messagesToFork = activePath.slice(0, msgIndex + 1).map(m => m.id);
    
    try {
      const newSessionId = await useSessionStore.getState().forkSession(sessionId, messagesToFork);
      navigate(`/chat/${newSessionId}`);
    } catch (e) {
      console.error('Failed to fork session:', e);
    }
  }, [sessionId, activePath, navigate]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  useEffect(() => {
    if (currentSession) {
      setTempTitle(currentSession.title);
    }
  }, [currentSession]);

  const handleRenameSave = async () => {
    if (sessionId && tempTitle.trim() && tempTitle !== currentSession?.title) {
      await updateSession(sessionId, { title: tempTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleRenameCancel = () => {
    if (currentSession) {
      setTempTitle(currentSession.title);
    }
    setIsEditingTitle(false);
  };

  const handleDeleteSession = async () => {
    if (sessionId) {
      const yes = await useConfirmStore.getState().confirm({
        title: 'Delete Session',
        message: 'Are you sure you want to delete this session? This action cannot be undone.',
        kind: 'warning',
      });
      if (yes) {
        await deleteSession(sessionId);
        navigate('/');
      }
    }
  };

  const hasMessages = messages.length > 0;
  const modelName = activeModelId?.split(':')[0] || 'model';

  return (
    <div className="flex w-full h-full bg-white relative overflow-hidden">
      {/* Main Chat Column */}
      <div className={cn(
        "flex flex-col h-full bg-white/50 relative transition-all duration-300 ease-in-out",
        isCanvasOpen ? "w-1/2 min-w-[400px] border-r border-zinc-200" : "w-full flex-1"
      )}>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          {project && (
            <>
              <button
                onClick={() => navigate(`/projects/${project.id}`)}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-800 transition-colors"
                title="Open project workspace"
              >
                <FolderKanban className="h-3.5 w-3.5" />
                <span className="font-medium">{project.name}</span>
              </button>
              <span className="text-zinc-300">/</span>
            </>
          )}
          {isEditingTitle ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSave();
                  if (e.key === 'Escape') handleRenameCancel();
                }}
                autoFocus
                className="px-2 py-0.5 text-sm border border-zinc-200 rounded outline-none focus:border-zinc-400 text-zinc-800"
              />
              <button
                onClick={handleRenameSave}
                className="p-1 rounded hover:bg-zinc-100 text-emerald-600"
                title="Save title"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleRenameCancel}
                className="p-1 rounded hover:bg-zinc-100 text-red-500"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/title">
              <span
                onClick={() => {
                  if (currentSession) {
                    setTempTitle(currentSession.title);
                    setIsEditingTitle(true);
                  }
                }}
                className="text-zinc-600 font-medium cursor-pointer hover:text-zinc-900 transition-colors"
                title="Click to rename"
              >
                {currentSession?.title || 'Untitled'}
              </span>
              <button
                onClick={() => {
                  if (currentSession) {
                    setTempTitle(currentSession.title);
                    setIsEditingTitle(true);
                  }
                }}
                className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 opacity-0 group-hover/title:opacity-100 transition-opacity"
                title="Rename session"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              {sessionId && (
                <button
                  onClick={handleDeleteSession}
                  className="p-0.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/title:opacity-100 transition-opacity"
                  title="Delete session"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {activeModelId && (
            <>
              <span className="text-zinc-300">·</span>
              <span className="font-mono text-xs text-zinc-400">{modelName}</span>
            </>
          )}
        </div>
        <ContextIndicator />
      </div>

      {/* Messages / Welcome */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative"
        onScroll={handleScroll}
      >
        {!hasMessages ? (
          <div className="flex h-full">
            <div className="flex-1 flex flex-col px-8 py-12">
              <ChatWelcome onSuggestion={(text) => handleSend(text)} />
            </div>
          </div>
        ) : (
          <div className="px-8 py-8 max-w-3xl mx-auto w-full">
            {(() => {
              const filteredPath = activePath.filter(msg => {
                if (isStreaming && streamingSessionId === sessionId && streamingParentId) {
                  const parentId = msg.parent_id || (messages.indexOf(msg) > 0 ? messages[messages.indexOf(msg) - 1].id : null);
                  if (parentId === streamingParentId && (msg.role === 'assistant' || msg.role === 'tool')) {
                    return false;
                  }
                }
                return true;
              });

              const groupedMessages: { type: 'user' | 'assistant_group', msg?: Message, messages?: Message[], index: number }[] = [];
              let currentGroup: { type: 'assistant_group', messages: Message[], index: number } | null = null;

              filteredPath.forEach((msg, i) => {
                if (msg.role === 'user') {
                  if (currentGroup) {
                    groupedMessages.push(currentGroup);
                    currentGroup = null;
                  }
                  groupedMessages.push({ type: 'user', msg, index: i });
                } else {
                  if (!currentGroup) {
                    currentGroup = { type: 'assistant_group', messages: [msg], index: i };
                  } else {
                    currentGroup.messages.push(msg);
                  }
                }
              });
              if (currentGroup) groupedMessages.push(currentGroup);

              return groupedMessages.map((group, groupIdx) => {
                if (group.type === 'user' && group.msg) {
                  const msg = group.msg;
                  const i = group.index;
                  const parentId = msg.parent_id || (i > 0 ? filteredPath[i - 1].id : null);
                  const siblings = parentId ? variantsMap[parentId] || [] : [];
                  const variantIndex = siblings.findIndex(s => s.id === msg.id);
                  const totalVariants = siblings.length;
                  const handleSwitchVariant = (direction: 'prev' | 'next') => {
                    if (!parentId || !sessionId) return;
                    const newIndex = direction === 'prev' ? variantIndex - 1 : variantIndex + 1;
                    if (newIndex >= 0 && newIndex < totalVariants) {
                      setActiveVariant(sessionId, parentId, siblings[newIndex].id);
                    }
                  };
                  return (
                    <UserMessage
                      key={msg.id}
                      message={msg}
                      onEdit={handleEditMessage}
                      variantIndex={variantIndex >= 0 ? variantIndex : undefined}
                      totalVariants={totalVariants > 0 ? totalVariants : undefined}
                      onSwitchVariant={handleSwitchVariant}
                    />
                  );
                } else if (group.type === 'assistant_group' && group.messages) {
                  const firstMsg = group.messages[0];
                  const i = group.index;
                  const parentId = firstMsg.parent_id || (i > 0 ? filteredPath[i - 1].id : null);
                  const siblings = parentId ? variantsMap[parentId] || [] : [];
                  const variantIndex = siblings.findIndex(s => s.id === firstMsg.id);
                  const totalVariants = siblings.length;
                  const handleSwitchVariant = (direction: 'prev' | 'next') => {
                    if (!parentId || !sessionId) return;
                    const newIndex = direction === 'prev' ? variantIndex - 1 : variantIndex + 1;
                    if (newIndex >= 0 && newIndex < totalVariants) {
                      setActiveVariant(sessionId, parentId, siblings[newIndex].id);
                    }
                  };
                  
                  // If this is the last group and we are streaming for it, pass the streaming content
                  const isLastGroup = groupIdx === groupedMessages.length - 1;
                  const isStreamingThis = isLastGroup && isStreaming && streamingSessionId === sessionId;

                  return (
                    <AssistantMessageGroup
                      key={firstMsg.id}
                      messages={group.messages}
                      streamingContent={isStreamingThis ? streamingContent : undefined}
                      isLast={isLastGroup && !isStreaming}
                      onRegenerate={handleRegenerate}
                      variantIndex={variantIndex >= 0 ? variantIndex : undefined}
                      totalVariants={totalVariants > 0 ? totalVariants : undefined}
                      onSwitchVariant={handleSwitchVariant}
                      onFork={handleFork}
                    />
                  );
                }
                return null;
              });
            })()}
            {isStreaming && streamingSessionId === sessionId && (!activePath.length || activePath[activePath.length - 1].role === 'user') && (
               <AssistantMessageGroup messages={[]} streamingContent={streamingContent} />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className={`relative px-8 pb-6 ${!hasMessages ? 'pt-4' : 'pt-4'}`}>
        {showScrollButton && hasMessages && (
          <button
            onClick={scrollToBottom}
            className="absolute -top-12 left-1/2 transform -translate-x-1/2 p-2 bg-[var(--color-verdant-muted)] text-white rounded-full shadow-sm hover:bg-[var(--color-verdant-primary)] transition-colors z-10 flex items-center justify-center opacity-80 hover:opacity-100"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
        <ChatInput
          sessionId={sessionId || ''}
          onSend={(c, a) => handleSend(c, a, undefined)}
          onStop={stopStreaming}
          isStreaming={isStreaming && streamingSessionId === sessionId}
          models={models}
          selectedModelId={activeModelId}
          onModelChange={setActiveModel}
          modelsLoading={modelsLoading}
          baseContextTokens={baseContextTokens}
        />
      </div>
      </div>

      {/* Artifact Canvas Column */}
      {isCanvasOpen && (
        <div className="w-1/2 min-w-[400px] flex-shrink-0 h-full bg-zinc-50 relative z-20">
          <CanvasPanel />
        </div>
      )}
    </div>
  );
}
