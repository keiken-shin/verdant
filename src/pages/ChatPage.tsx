import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PanelRight } from 'lucide-react';
import { ChatInput } from '@/components/chat/ChatInput';
import { UserMessage, AssistantMessage, StreamingMessage } from '@/components/chat/MessageBubbles';
import { SectionLabel } from '@/components/ui/PageHeader';
import { useSessionStore } from '@/stores/sessionStore';
import { useMessageStore } from '@/stores/messageStore';
import { useProviderStore } from '@/stores/providerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';
import { providerRegistry } from '@/providers/registry';
import type { ModelInfo } from '@/types';

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
        Wollama is a local-first workspace for thinking with language models. Your conversations, memories, and the connections between them stay on your machine — a small, slow, private notebook with a graph for a mind.
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

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const { sessions, createSession, updateSession } = useSessionStore();
  const { messagesBySession, streamingContent, isStreaming, fetchMessages, addMessage, setIsStreaming, setStreamingContent, appendStreamingContent, setAbortController, stopStreaming } = useMessageStore();
  const { providers, models: providerModels, activeModelId, setActiveModel, isConnected, setIsConnected } = useProviderStore();
  const { settings } = useSettingsStore();
  const { graphPanelOpen, toggleGraphPanel } = useUiStore();

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find((s) => s.id === sessionId);
  const messages = sessionId ? (messagesBySession[sessionId] || []) : [];

  // Load messages when session changes
  useEffect(() => {
    if (sessionId && !messagesBySession[sessionId]) {
      fetchMessages(sessionId);
    }
  }, [sessionId, fetchMessages, messagesBySession]);

  // Fetch models from Ollama
  useEffect(() => {
    const loadModels = async () => {
      const defaultProvider = providers.find((p) => p.is_default) || providers[0];
      if (!defaultProvider) return;

      // Update provider endpoint from settings
      const ollamaEndpoint = settings.ollama_host || defaultProvider.endpoint;
      const provider = providerRegistry.createOllama(defaultProvider.id, ollamaEndpoint);

      setModelsLoading(true);
      try {
        const health = await provider.healthCheck();
        setIsConnected(health.connected);
        if (health.connected) {
          const fetchedModels = await provider.listModels();
          setModels(fetchedModels);
          if (!activeModelId && fetchedModels.length > 0) {
            setActiveModel(fetchedModels[0].id);
          }
        }
      } catch (e) {
        setIsConnected(false);
      } finally {
        setModelsLoading(false);
      }
    };

    if (providers.length > 0) loadModels();
  }, [providers, settings.ollama_host]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(async (content: string) => {
    if (!activeModelId) return;

    let sid = sessionId;

    // Create session if none exists
    if (!sid) {
      const session = await createSession('Untitled', activeModelId);
      sid = session.id;
      navigate(`/chat/${sid}`, { replace: true });
    }

    // Add user message
    await addMessage(sid, 'user', content);

    // Get the most up-to-date messages from the store to avoid stale closure values
    const currentMessages = useMessageStore.getState().messagesBySession[sid] || [];

    // Update session title from first message
    if (currentMessages.length === 1) {
      const title = content.slice(0, 50).trim();
      await updateSession(sid, { title, model_id: activeModelId });
    }

    // Get messages for context
    const history = [...currentMessages].map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Stream response
    const defaultProvider = providers.find((p) => p.is_default) || providers[0];
    if (!defaultProvider) return;

    const ollamaEndpoint = settings.ollama_host || defaultProvider.endpoint;
    const provider = providerRegistry.createOllama(defaultProvider.id, ollamaEndpoint);

    const abortCtrl = new AbortController();
    setAbortController(abortCtrl);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      await provider.streamChat(
        { model: activeModelId, messages: history, stream: true },
        (chunk) => {
          if (chunk.content) appendStreamingContent(chunk.content);
        },
        abortCtrl.signal
      );

      // Finalize streaming message
      const finalContent = useMessageStore.getState().streamingContent;
      if (finalContent) {
        await addMessage(sid, 'assistant', finalContent, activeModelId);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        const errorMsg = `Error: ${e instanceof Error ? e.message : 'Failed to get response'}`;
        await addMessage(sid, 'assistant', errorMsg);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      setAbortController(null);
    }
  }, [activeModelId, sessionId, providers, settings.ollama_host, createSession, updateSession, addMessage, setAbortController, setIsStreaming, setStreamingContent, appendStreamingContent, navigate]);

  const handleRegenerate = useCallback(async () => {
    if (!sessionId || messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) await handleSend(lastUserMsg.content);
  }, [sessionId, messages, handleSend]);

  const handleEditMessage = useCallback(async (id: string, content: string) => {
    // Edit message and re-run from that point
    await useMessageStore.getState().updateMessage(id, content);
    // Re-trigger conversation from that message
  }, []);

  const hasMessages = messages.length > 0;
  const modelName = activeModelId?.split(':')[0] || 'model';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="text-zinc-400">{currentSession?.title || 'Untitled'}</span>
          {activeModelId && (
            <>
              <span className="text-zinc-300">·</span>
              <span className="font-mono text-xs text-zinc-400">{modelName}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleGraphPanel}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
            title="Toggle knowledge graph panel"
            aria-label="Toggle knowledge graph panel"
          >
            <PanelRight className="h-4 w-4" />
          </button>
          <span className="text-xs text-zinc-300 tracking-widest uppercase ml-2">
            Knowledge Graph
          </span>
        </div>
      </div>

      {/* Messages / Welcome */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex h-full">
            <div className="flex-1 flex flex-col px-8 py-12">
              <ChatWelcome onSuggestion={handleSend} />
            </div>
          </div>
        ) : (
          <div className="px-8 py-8 max-w-3xl mx-auto w-full">
            {messages.map((msg, i) =>
              msg.role === 'user' ? (
                <UserMessage
                  key={msg.id}
                  message={msg}
                  onEdit={handleEditMessage}
                />
              ) : (
                <AssistantMessage
                  key={msg.id}
                  message={msg}
                  isLast={i === messages.length - 1}
                  onRegenerate={handleRegenerate}
                />
              )
            )}
            {isStreaming && <StreamingMessage content={streamingContent} />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className={`px-8 pb-6 ${!hasMessages ? 'pt-4' : 'pt-4'}`}>
        <ChatInput
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          models={models}
          selectedModelId={activeModelId}
          onModelChange={setActiveModel}
          modelsLoading={modelsLoading}
        />
      </div>
    </div>
  );
}
