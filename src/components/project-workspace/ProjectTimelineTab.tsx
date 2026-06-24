import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@/types';

interface ProjectTimelineTabProps {
  projectSessions: Session[];
}

export function ProjectTimelineTab({ projectSessions }: ProjectTimelineTabProps) {
  const navigate = useNavigate();

  // Group sessions by created date for the timeline.
  const timeline = useMemo(() => {
    const byDay: Record<string, typeof projectSessions> = {};
    [...projectSessions]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .forEach((s) => {
        const day = new Date(s.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        (byDay[day] ||= []).push(s);
      });
    return Object.entries(byDay);
  }, [projectSessions]);

  return (
    <div className="px-10 py-8 max-w-3xl mx-auto w-full">
      {timeline.length === 0 ? (
        <div className="text-sm text-zinc-400 py-6 text-center">No sessions yet.</div>
      ) : (
        timeline.map(([day, daySessions]) => (
          <div key={day} className="mb-6">
            <div className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 mb-2">{day}</div>
            <div className="divide-y divide-zinc-100 border-l-2 border-zinc-100 pl-4">
              {daySessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/chat/${s.id}`)}
                  className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-zinc-50 -mx-3 px-3 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0 text-sm text-zinc-800 truncate">{s.title}</div>
                  <div className="text-xs text-zinc-300 shrink-0">
                    {new Date(s.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
