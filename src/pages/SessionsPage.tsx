import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MessageSquare, Trash2, Pin } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useSessionStore } from '@/stores/sessionStore';
import { formatRelativeTime, cn } from '@/utils';
import type { Session } from '@/types';

export function SessionsPage() {
  const navigate = useNavigate();
  const { sessions, fetchSessions, deleteSession, updateSession } = useSessionStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleOpen = (session: Session) => {
    navigate(`/chat/${session.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteSession(id);
  };

  const handlePin = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    await updateSession(session.id, { is_pinned: !session.is_pinned });
  };

  return (
    <div className="px-12 py-12 max-w-4xl">
      <PageHeader
        label="ARCHIVE"
        title="Sessions"
        description="Conversations you've had, kept locally. Open one to keep thinking from where you left off."
      />

      <div className="divide-y divide-zinc-100">
        {sessions.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            No sessions yet. Start a new chat to begin.
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleOpen(session)}
              onMouseEnter={() => setHoveredId(session.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="flex items-center gap-4 py-4 cursor-pointer hover:bg-zinc-50 -mx-4 px-4 rounded-lg transition-colors group"
            >
              {/* Icon */}
              <MessageSquare className="h-4 w-4 text-zinc-300 shrink-0" />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-zinc-800">
                    {session.title}
                  </span>
                  {session.tag && (
                    <Badge tag={session.tag}>{session.tag}</Badge>
                  )}
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-xs font-mono text-zinc-400">
                    {session.model_id?.split(':')[0] || '—'}
                  </div>
                  <div className="text-xs text-zinc-300">
                    {formatRelativeTime(session.updated_at)} ago
                  </div>
                </div>

                {/* Action buttons (show on hover) */}
                <div className={cn(
                  'flex items-center gap-1 transition-opacity',
                  hoveredId === session.id ? 'opacity-100' : 'opacity-0'
                )}>
                  <button
                    onClick={(e) => handlePin(e, session)}
                    className={cn(
                      'p-1 rounded hover:bg-zinc-100 transition-colors',
                      session.is_pinned ? 'text-[var(--color-verdant-primary)]' : 'text-zinc-400'
                    )}
                    title={session.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, session.id)}
                    className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                <ChevronRight className="h-4 w-4 text-zinc-300" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
