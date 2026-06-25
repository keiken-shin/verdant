import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { ChatInput } from '@/components/chat/ChatInput';
import { useSessionStore } from '@/stores/sessionStore';
import { useProjectStore } from '@/stores/projectStore';
import { useModels } from '@/hooks/useModels';
import { formatRelativeTime } from '@/utils';
import type { Session } from '@/types';

interface ProjectChatTabProps {
  projectId: string;
  projectSessions: Session[];
}

export function ProjectChatTab({ projectId, projectSessions }: ProjectChatTabProps) {
  const navigate = useNavigate();
  const { createSession } = useSessionStore();
  const { filesByProject } = useProjectStore();
  const { models, modelsLoading, activeModelId, setActiveModel } = useModels();

  const baseContextTokens = React.useMemo(() => {
    const files = filesByProject[projectId] || [];
    return files.reduce((acc, f) => {
      if (f.include_mode === 'reference') return acc;
      if (f.include_mode === 'summary' && f.summary) {
        return acc + Math.ceil(f.summary.length / 4);
      }
      return acc + Math.ceil((f.size || 0) / 4);
    }, 0);
  }, [filesByProject, projectId]);

  const handleStart = async (prompt: string) => {
    const title = prompt.slice(0, 50).trim() || 'Untitled';
    const session = await createSession(title, activeModelId || undefined, projectId);
    navigate(`/chat/${session.id}`, { state: { initialPrompt: prompt } });
  };

  return (
    <div className="px-10 py-8 max-w-3xl mx-auto w-full flex flex-col gap-8">
      <div>
        <ChatInput
          onSend={handleStart}
          models={models}
          selectedModelId={activeModelId}
          onModelChange={setActiveModel}
          modelsLoading={modelsLoading}
          placeholder="Start a new session in this project..."
          dropdownDirection="down"
          baseContextTokens={baseContextTokens}
        />
      </div>

      {/* Sessions in this project */}
      <div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 mb-2">Sessions</div>
        {projectSessions.length === 0 ? (
          <div className="text-sm text-zinc-400 py-6 text-center">No sessions yet. Send a prompt above to start one.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {projectSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/chat/${s.id}`)}
                className="w-full flex items-center gap-3 py-3 text-left hover:bg-zinc-50 -mx-3 px-3 rounded-lg transition-colors"
              >
                <MessageSquare className="h-4 w-4 text-zinc-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-800 truncate">{s.title}</div>
                </div>
                <div className="text-xs text-zinc-300 shrink-0">{formatRelativeTime(s.updated_at)} ago</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
