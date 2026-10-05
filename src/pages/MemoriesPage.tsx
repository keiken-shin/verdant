import React, { useEffect, useState, useMemo } from 'react';
import { Brain, Trash2, Pencil, Check, X, Plus, Download, Sparkles, Search, Loader2, FolderKanban, Globe } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useMemoryStore } from '@/stores/memoryStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { evaluateMemoryFromDialogue } from '@/services/systemOneService';
import { formatRelativeTime, cn } from '@/utils';
import type { Memory, MemoryCategory, Session, Message } from '@/types';
import { MEMORY_CATEGORIES } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

function MemoryCard({
  memory,
  projectName,
  onDelete,
  onUpdate,
}: {
  memory: Memory;
  projectName?: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string, category: MemoryCategory) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(memory.content);
  const [editCategory, setEditCategory] = useState<MemoryCategory>(memory.category);

  const handleSave = () => {
    onUpdate(memory.id, editContent, editCategory);
    setEditing(false);
  };

  return (
    <div className="border-b border-zinc-100 py-4 group">
      {editing ? (
        <div className="flex gap-3">
          <Brain className="h-4 w-4 text-[var(--color-verdant-primary)] shrink-0 mt-1" />
          <div className="flex-1">
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as MemoryCategory)}
              className="mb-2 text-xs border border-zinc-200 rounded px-2 py-1 outline-none text-zinc-600 bg-white"
            >
              {MEMORY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              autoFocus
              className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-2 outline-none resize-none text-zinc-800 min-h-[60px]"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={handleSave} className="flex items-center gap-1 px-2.5 py-1 text-xs bg-zinc-900 text-white rounded hover:bg-zinc-700 transition-colors">
                <Check className="h-3 w-3" /> Save
              </button>
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 rounded transition-colors">
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <Brain className="h-4 w-4 text-[var(--color-verdant-primary)] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge tag={memory.category}>{memory.category}</Badge>
              {projectName ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <FolderKanban className="h-3 w-3" />
                  {projectName}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200/60">
                  <Globe className="h-3 w-3" />
                  Global
                </span>
              )}
              <span className="text-xs text-zinc-400">
                {formatRelativeTime(memory.created_at)} ago
              </span>
            </div>
            <p className="text-sm text-zinc-800 leading-relaxed">{memory.content}</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Edit memory"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(memory.id)}
              className="p-1.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
              aria-label="Delete memory"
              title="Forget"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddMemoryForm({ onAdd }: { onAdd: (content: string, category: MemoryCategory) => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('CONTEXT');

  const handleAdd = () => {
    if (!content.trim()) return;
    onAdd(content.trim(), category);
    setContent('');
    setCategory('CONTEXT');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-[var(--color-verdant-primary)] hover:opacity-80 transition-opacity mt-4 font-medium"
      >
        <Plus className="h-4 w-4" />
        Teach Verdant something new
      </button>
    );
  }

  return (
    <div className="mt-4 border border-zinc-200 rounded-xl p-4 bg-white shadow-sm">
      <div className="flex gap-3 mb-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as MemoryCategory)}
          className="text-xs border border-zinc-200 rounded px-2.5 py-1 outline-none text-zinc-600 bg-white"
        >
          {MEMORY_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus
        placeholder="What should Verdant remember? (e.g., 'Always use TypeScript with functional React and Tailwind CSS')"
        className="w-full text-sm border-0 outline-none resize-none text-zinc-800 placeholder:text-zinc-400 min-h-[70px]"
      />
      <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100">
        <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors font-medium">
          <Check className="h-3 w-3" /> Save memory
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function MemoriesPage() {
  const { memories, fetchMemories, createMemory, updateMemory, deleteMemory } = useMemoryStore();
  const { projects, fetchProjects } = useProjectStore();
  const { settings } = useSettingsStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedScope, setSelectedScope] = useState<'ALL' | 'GLOBAL' | 'PROJECTS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchMemories();
    fetchProjects();
  }, [fetchMemories, fetchProjects]);

  const projectsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.name);
    }
    return map;
  }, [projects]);

  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      if (selectedCategory !== 'ALL' && m.category !== selectedCategory) return false;
      if (selectedScope === 'GLOBAL' && m.project_id) return false;
      if (selectedScope === 'PROJECTS' && !m.project_id) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contentMatch = m.content.toLowerCase().includes(q);
        const catMatch = m.category.toLowerCase().includes(q);
        const projName = m.project_id ? projectsMap.get(m.project_id)?.toLowerCase() : '';
        return contentMatch || catMatch || Boolean(projName && projName.includes(q));
      }
      return true;
    });
  }, [memories, selectedCategory, selectedScope, searchQuery, projectsMap]);

  const handleScanChats = async () => {
    setIsScanning(true);
    setScanMessage('Scanning recent conversations for durable preferences and decisions...');
    try {
      const sessions = await invoke<Session[]>('get_sessions');
      const sys1Model = settings.enable_system_one && settings.system_one_model ? settings.system_one_model : 'clef';
      const host = settings.ollama_host || 'http://127.0.0.1:11434';
      let addedCount = 0;

      // Scan up to 10 most recent sessions
      const recentSessions = sessions.slice(0, 10);
      for (const s of recentSessions) {
        try {
          const msgs = await invoke<Message[]>('get_messages', { sessionId: s.id });
          const userMsgs = msgs.filter((m) => m.role === 'user');

          for (const u of userMsgs) {
            const currentMemories = useMemoryStore.getState().memories;
            const evalResult = await evaluateMemoryFromDialogue(
              host,
              sys1Model,
              u.content,
              undefined,
              currentMemories
            );

            if (evalResult && evalResult.shouldStore) {
              await createMemory(evalResult.content, evalResult.category, s.id, s.project_id || undefined);
              addedCount++;
            }
          }
        } catch (sessErr) {
          console.warn(`[AutoScan] Failed to process session ${s.id}:`, sessErr);
        }
      }

      setScanMessage(
        addedCount > 0
          ? `System-1 discovered and saved ${addedCount} new durable memories!`
          : 'Scanned conversations: no new durable preferences found or already stored.'
      );
      setTimeout(() => setScanMessage(null), 5000);
    } catch (e) {
      console.error('Scan failed:', e);
      setScanMessage('Failed to scan chats.');
      setTimeout(() => setScanMessage(null), 4000);
    } finally {
      setIsScanning(false);
    }
  };

  const handleExport = async () => {
    try {
      const json = await invoke<string>('export_memories_json');
      const path = await save({ defaultPath: 'verdant-memories.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (path) await writeTextFile(path, json);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  return (
    <div className="px-12 py-12 max-w-4xl">
      <PageHeader
        label="WHAT I REMEMBER"
        title="Memories"
        description="Autonomous and explicit memory of your technical preferences, project architectures, and conventions. Verdant automatically captures durable decisions so you never have to repeat yourself."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleScanChats}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 rounded-lg transition-colors border border-emerald-200 font-medium disabled:opacity-50"
              title="Use System-1 to scan recent conversations for preferences and constraints"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Scanning chats...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  Scan Recent Chats
                </>
              )}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        }
      />

      {/* System One Auto-Capture Indicator */}
      <div className="mb-6 p-3 bg-zinc-50 rounded-xl border border-zinc-200/70 flex items-center justify-between text-xs text-zinc-600">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span>
            <strong>System-1 Memory Capture:</strong> {settings.auto_remember ? 'Active' : 'Disabled in Settings'} (Evaluates dialogue using Clef/Ollama)
          </span>
        </div>
        <span className="text-zinc-400">
          {memories.length} stored {memories.length === 1 ? 'memory' : 'memories'}
        </span>
      </div>

      {scanMessage && (
        <div className="mb-6 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2 animate-in fade-in duration-200">
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {['ALL', ...MEMORY_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors',
                selectedCategory === cat
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 text-zinc-800"
          />
        </div>
      </div>

      {/* Memory List */}
      <div>
        {filteredMemories.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 text-sm bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
            {memories.length === 0 ? (
              <>
                <Brain className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                <p className="font-medium text-zinc-600">No memories yet.</p>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  Verdant automatically records durable decisions and preferences during chat using Clef System-1, or you can add them manually.
                </p>
              </>
            ) : (
              <p>No memories match your filter criteria.</p>
            )}
          </div>
        ) : (
          filteredMemories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              projectName={memory.project_id ? projectsMap.get(memory.project_id) : undefined}
              onDelete={deleteMemory}
              onUpdate={updateMemory}
            />
          ))
        )}
        <AddMemoryForm onAdd={createMemory} />
      </div>
    </div>
  );
}
