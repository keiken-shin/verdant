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
          ? 'bg-[var(--color-verdant-active)] text-[var(--color-verdant-primary)] font-medium'
          : 'text-[var(--color-verdant-text)] hover:bg-[var(--color-verdant-hover)]',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-[var(--color-verdant-primary)]' : 'text-zinc-500'
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

// Verdant logo component matching the SVG in design assets
function VerdantLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 39.2696V39.7801C26.6717 39.7801 28.5641 41.9354 29.1764 43.0131C36.5556 58.2892 39.8716 67.321 46.5424 83C50.1603 73.8682 57.6633 54.856 58.732 51.8613C60.0678 48.1178 63.0735 45.3953 64.0754 44.5445C65.0772 43.6937 70.2536 39.7801 73.4263 34.8456C75.9644 30.8979 76.1536 21.9703 75.931 18C75.4957 19.3535 72.0187 21.0856 64.0754 25.3168C55.899 29.672 56.6725 39.5532 57.7301 43.3534C60.4018 35.1859 66.8584 31.2155 69.7527 30.2513C68.8065 30.9319 66.1459 33.178 63.0735 36.7173C59.3806 40.9712 59.3999 45.2251 56.7282 51.8613L49.715 69.3874C46.1528 61.6169 38.8947 45.4634 38.3603 43.0131C37.826 40.5628 40.5867 39.8368 42.0339 39.7801V39.2696H24Z" fill="#99B085"/>
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
    <aside className="flex flex-col w-[210px] shrink-0 bg-[var(--color-verdant-sidebar-bg)] border-r border-[var(--color-verdant-border)] h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <VerdantLogo />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-zinc-900">Verdant</div>
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
                              ? 'bg-[var(--color-verdant-active)] text-[var(--color-verdant-primary)] font-medium'
                              : 'text-[var(--color-verdant-text)] hover:bg-[var(--color-verdant-hover)] hover:text-zinc-800'
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
      <div className="px-4 py-3 border-t border-[var(--color-verdant-border)]">
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
