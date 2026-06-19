import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, X } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useMemoryStore } from '@/stores/memoryStore';
import { cn, truncate } from '@/utils';
import type { Session, Memory } from '@/types';

type SearchResult =
  | { type: 'session'; item: Session }
  | { type: 'memory'; item: Memory };

export function SearchModal() {
  const { searchOpen, closeSearch } = useUiStore();
  const { sessions, searchSessions } = useSessionStore();
  const { memories, searchMemories } = useMemoryStore();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      const recent = sessions.slice(0, 7).map((s) => ({ type: 'session' as const, item: s }));
      setResults(recent);
      setSelectedIndex(0);
      return;
    }

    const [foundSessions, foundMemories] = await Promise.all([
      searchSessions(q),
      searchMemories(q),
    ]);

    const combined: SearchResult[] = [
      ...foundSessions.slice(0, 5).map((s) => ({ type: 'session' as const, item: s })),
      ...foundMemories.slice(0, 3).map((m) => ({ type: 'memory' as const, item: m })),
    ];
    setResults(combined);
    setSelectedIndex(0);
  }, [sessions, searchSessions, searchMemories]);

  useEffect(() => {
    if (searchOpen) {
      runSearch(query);
    }
  }, [searchOpen, query, runSearch]);

  useEffect(() => {
    if (!searchOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [searchOpen]);

  const handleSelect = (result: SearchResult) => {
    closeSearch();
    if (result.type === 'session') {
      navigate(`/chat/${result.item.id}`);
    } else {
      navigate('/memories');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  };

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        useUiStore.getState().toggleSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <DialogPrimitive.Root open={searchOpen} onOpenChange={(open) => !open && closeSearch()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
        />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 rounded-xl bg-white shadow-2xl border border-zinc-200 overflow-hidden"
          onKeyDown={handleKeyDown}
          aria-label="Search"
        >
          {/* Search Input */}
          <div className="flex items-center px-4 border-b border-zinc-100">
            <Search className="h-4 w-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sessions, memories, ideas..."
              className="flex-1 px-3 py-4 text-sm text-zinc-800 placeholder:text-zinc-400 bg-transparent outline-none"
            />
            <button
              onClick={closeSearch}
              className="p-1 rounded hover:bg-zinc-100 text-zinc-400 transition-colors"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="max-h-80 overflow-y-auto py-2">
              {results.map((result, i) => (
                <button
                  key={`${result.type}-${result.type === 'session' ? result.item.id : result.item.id}`}
                  onClick={() => handleSelect(result)}
                  className={cn(
                    'w-full flex items-start gap-4 px-4 py-3 text-left transition-colors',
                    i === selectedIndex ? 'bg-zinc-50' : 'hover:bg-zinc-50'
                  )}
                >
                  <span className="shrink-0 mt-0.5 text-[10px] font-medium tracking-widest uppercase text-zinc-400 w-14">
                    {result.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-800 truncate">
                      {result.type === 'session' ? result.item.title : result.item.content}
                    </div>
                    {result.type === 'session' && result.item.preview && (
                      <div className="text-xs text-zinc-400 mt-0.5 italic truncate">
                        {truncate(result.item.preview, 80)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.trim() && results.length === 0 && (
            <div className="py-8 text-center text-sm text-zinc-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-100 bg-zinc-50/50">
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span>↵ open</span>
              <span>↑↓ navigate</span>
              <span>esc close</span>
            </div>
            {results.length > 0 && (
              <span className="text-xs text-zinc-400">{results.length} matches</span>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
