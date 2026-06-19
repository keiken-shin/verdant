import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Plus, Search, MessageSquare, Brain, Network, Cpu, Settings, MoreHorizontal, Edit2, Trash2
} from 'lucide-react';
import { cn } from '@/utils';
import { useSessionStore } from '@/stores/sessionStore';
import { useProviderStore } from '@/stores/providerStore';
import { useUiStore } from '@/stores/uiStore';
import { truncate } from '@/utils';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to?: string;
  onClick?: () => void;
  active?: boolean;
  shortcut?: string;
  className?: string;
}

function NavItem({ icon, label, to, onClick, active, shortcut, className }: NavItemProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) onClick();
    else if (to) navigate(to);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors group',
        active
          ? 'bg-[var(--color-wollama-active)] text-[var(--color-wollama-primary)] font-medium'
          : 'text-[var(--color-wollama-text)] hover:bg-[var(--color-wollama-hover)]',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-[var(--color-wollama-primary)]' : 'text-zinc-500'
        )}>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      {shortcut && (
        <span className="text-[11px] text-zinc-400 font-mono">{shortcut}</span>
      )}
    </button>
  );
}

// Wollama logo component matching the SVG in design assets
function WollamaLogo() {
  return (
    <svg width="22" height="21" viewBox="0 0 49 46" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M43.9091 25.0909C43.9091 23.4273 43.2477 21.8322 42.0714 20.6559C40.895 19.4795 39.3 18.8182 37.6363 18.8182H35.5454C34.3907 18.8182 33.4545 17.882 33.4545 16.7273C33.4545 15.5725 34.3907 14.6364 35.5454 14.6364H37.6363C40.4091 14.6364 43.0674 15.7386 45.028 17.6992C46.9886 19.6598 48.0909 22.3182 48.0909 25.0909C48.0909 27.8636 46.9886 30.522 45.028 32.4826C43.0674 34.4432 40.4091 35.5454 37.6363 35.5454H35.5454C34.3907 35.5454 33.4545 34.6093 33.4545 33.4545C33.4545 32.2998 34.3907 31.3636 35.5454 31.3636H37.6363C39.3 31.3636 40.895 30.7023 42.0714 29.5259C43.2477 28.3495 43.9091 26.7545 43.9091 25.0909Z" fill="black"/>
      <path d="M33.4545 18.8182H4.18182V35.5454C4.18182 37.2091 4.84317 38.8041 6.01953 39.9805C7.1959 41.1568 8.79092 41.8182 10.4545 41.8182H27.1818C28.8454 41.8182 30.4405 41.1568 31.6168 39.9805C32.7932 38.8041 33.4545 37.2091 33.4545 35.5454V18.8182ZM37.6364 35.5454C37.6364 38.3182 36.5341 40.9765 34.5735 42.9371C32.6129 44.8977 29.9545 46 27.1818 46H10.4545C7.68183 46 5.02346 44.8977 3.06285 42.9371C1.10225 40.9765 0 38.3182 0 35.5454V16.7273C0 15.5725 0.936132 14.6364 2.09091 14.6364H35.5455C36.7002 14.6364 37.6364 15.5725 37.6364 16.7273V35.5454Z" fill="black"/>
      <path d="M8.36362 8.36364V2.09091C8.36362 0.936132 9.29975 0 10.4545 0C11.6093 0 12.5454 0.936132 12.5454 2.09091V8.36364C12.5454 9.51841 11.6093 10.4545 10.4545 10.4545C9.29975 10.4545 8.36362 9.51841 8.36362 8.36364Z" fill="black"/>
      <path d="M16.7273 8.36364V2.09091C16.7273 0.936132 17.6634 0 18.8182 0C19.973 0 20.9091 0.936132 20.9091 2.09091V8.36364C20.9091 9.51841 19.973 10.4545 18.8182 10.4545C17.6634 10.4545 16.7273 9.51841 16.7273 8.36364Z" fill="black"/>
      <path d="M25.0909 8.36364V2.09091C25.0909 0.936132 26.027 0 27.1818 0C28.3366 0 29.2727 0.936132 29.2727 2.09091V8.36364C29.2727 9.51841 28.3366 10.4545 27.1818 10.4545C26.027 10.4545 25.0909 9.51841 25.0909 8.36364Z" fill="black"/>
    </svg>
  );
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openSearch } = useUiStore();
  const { sessions, createSession, updateSession, deleteSession } = useSessionStore();
  const { isConnected, providers } = useProviderStore();

  const path = location.pathname;

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuSessionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveRename = async (id: string) => {
    if (editTitle.trim() && editTitle.trim() !== sessions.find((s) => s.id === id)?.title) {
      await updateSession(id, { title: editTitle.trim() });
    }
    setEditingSessionId(null);
  };

  const handleDeleteSession = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      await deleteSession(id);
      if (path === `/chat/${id}`) {
        navigate('/');
      }
    }
  };
  const isActive = (route: string) => {
    if (route === '/') return path === '/' || path.startsWith('/chat');
    return path.startsWith(route);
  };

  const handleNewChat = async () => {
    const session = await createSession('Untitled');
    navigate(`/chat/${session.id}`);
  };

  // Get the 4 most recent sessions for sidebar "RECENT"
  const recentSessions = sessions.slice(0, 4);

  // Provider status display
  const defaultProvider = providers.find((p) => p.is_default) || providers[0];

  return (
    <aside className="flex flex-col w-[210px] shrink-0 bg-[var(--color-wollama-sidebar-bg)] border-r border-[var(--color-wollama-border)] h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <WollamaLogo />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-zinc-900">Wollama</div>
            <div className="text-[10px] tracking-widest uppercase text-zinc-400">LOCAL · PRIVATE</div>
          </div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {/* New Chat */}
        <NavItem
          icon={<Plus className="h-4 w-4" />}
          label="New Chat"
          onClick={handleNewChat}
          shortcut="⌘N"
          className="font-medium"
        />

        {/* Search */}
        <NavItem
          icon={<Search className="h-4 w-4" />}
          label="Search"
          onClick={openSearch}
        />

        {/* Sessions */}
        <NavItem
          icon={<MessageSquare className="h-4 w-4" />}
          label="Sessions"
          to="/sessions"
          active={isActive('/sessions')}
        />

        {/* Memories */}
        <NavItem
          icon={<Brain className="h-4 w-4" />}
          label="Memories"
          to="/memories"
          active={isActive('/memories')}
        />

        {/* Knowledge Graph */}
        <NavItem
          icon={<Network className="h-4 w-4" />}
          label="Knowledge Graph"
          to="/knowledge-graph"
          active={isActive('/knowledge-graph')}
        />

        {/* Models */}
        <NavItem
          icon={<Cpu className="h-4 w-4" />}
          label="Models"
          to="/models"
          active={isActive('/models')}
        />

        {/* Settings */}
        <NavItem
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          to="/settings"
          active={isActive('/settings')}
        />

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <div className="pt-5 pb-1">
            <div className="px-3 pb-2">
              <span className="section-label">Recent</span>
            </div>
            <div className="space-y-0.5">
              {recentSessions.map((session) => {
                const isEditing = editingSessionId === session.id;
                const isMenuOpen = activeMenuSessionId === session.id;
                const isSessionActive = path === `/chat/${session.id}`;

                return (
                  <div
                    key={session.id}
                    className="relative group w-full flex items-center px-1"
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(session.id);
                          if (e.key === 'Escape') setEditingSessionId(null);
                        }}
                        onBlur={() => handleSaveRename(session.id)}
                        autoFocus
                        className="w-full px-2 py-1 text-xs border border-zinc-200 rounded bg-white outline-none focus:border-zinc-300 text-zinc-800 font-normal"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => navigate(`/chat/${session.id}`)}
                          className={cn(
                            'w-full text-left pl-2 pr-7 py-1.5 rounded text-sm transition-colors truncate cursor-pointer',
                            isSessionActive
                              ? 'bg-[var(--color-wollama-active)] text-[var(--color-wollama-primary)] font-medium'
                              : 'text-[var(--color-wollama-text)] hover:bg-[var(--color-wollama-hover)] hover:text-zinc-800'
                          )}
                        >
                          {truncate(session.title, 22)}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuSessionId(isMenuOpen ? null : session.id);
                          }}
                          className={cn(
                            'absolute right-2 p-1 rounded hover:bg-zinc-200/50 text-zinc-400 hover:text-zinc-600 transition-all shrink-0 cursor-pointer',
                            isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          )}
                          title="Session actions"
                          aria-label="Session actions"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>

                        {isMenuOpen && (
                          <div
                            ref={menuRef}
                            className="absolute top-full right-2 mt-1 w-24 bg-white rounded shadow-lg border border-zinc-200 py-1 z-50 text-[11px]"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditTitle(session.title);
                                setEditingSessionId(session.id);
                                setActiveMenuSessionId(null);
                              }}
                              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-800 transition-colors cursor-pointer"
                            >
                              <Edit2 className="h-3 w-3 shrink-0" />
                              <span>Rename</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.id);
                                setActiveMenuSessionId(null);
                              }}
                              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3 shrink-0" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer — Provider Status */}
      <div className="px-4 py-3 border-t border-[var(--color-wollama-border)]">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'h-1.5 w-1.5 rounded-full',
              isConnected ? 'bg-emerald-500' : 'bg-zinc-300'
            )} />
            <span className="font-mono text-[11px]">
              {defaultProvider?.name.toLowerCase() || 'ollama'}
            </span>
            <span>·</span>
            <span className="font-mono text-[11px] truncate max-w-[70px]">
              {defaultProvider?.endpoint.replace('http://', '').replace('https://', '') || 'localhost'}
            </span>
          </div>
          <span className="font-mono text-[11px]">v0.1.0</span>
        </div>
      </div>
    </aside>
  );
}
