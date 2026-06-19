import React, { useEffect, useState } from 'react';
import { Brain, Trash2, Pencil, Check, X, Plus, Download, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useMemoryStore } from '@/stores/memoryStore';
import { formatRelativeTime, cn } from '@/utils';
import type { Memory, MemoryCategory } from '@/types';
import { MEMORY_CATEGORIES } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

function MemoryCard({
  memory,
  onDelete,
  onUpdate,
}: {
  memory: Memory;
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
          <Brain className="h-4 w-4 text-[var(--color-wollama-primary)] shrink-0 mt-1" />
          <div className="flex-1">
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as MemoryCategory)}
              className="mb-2 text-xs border border-zinc-200 rounded px-2 py-1 outline-none text-zinc-600"
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
              <button onClick={handleSave} className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-900 text-white rounded hover:bg-zinc-700 transition-colors">
                <Check className="h-3 w-3" /> Save
              </button>
              <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 rounded transition-colors">
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <Brain className="h-4 w-4 text-[var(--color-wollama-primary)] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge tag={memory.category}>{memory.category}</Badge>
              <span className="text-xs text-zinc-400">
                {formatRelativeTime(memory.created_at)} ago
              </span>
            </div>
            <p className="text-sm text-zinc-800">{memory.content}</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Edit memory"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(memory.id)}
              className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
              aria-label="Delete memory"
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
        className="flex items-center gap-1.5 text-sm text-[var(--color-wollama-primary)] hover:opacity-80 transition-opacity mt-4"
      >
        <Plus className="h-4 w-4" />
        Teach Wollama something new
      </button>
    );
  }

  return (
    <div className="mt-4 border border-zinc-200 rounded-xl p-4 bg-white">
      <div className="flex gap-3 mb-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as MemoryCategory)}
          className="text-xs border border-zinc-200 rounded px-2 py-1 outline-none text-zinc-600"
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
        placeholder="What should Wollama remember?"
        className="w-full text-sm border-0 outline-none resize-none text-zinc-800 placeholder:text-zinc-400 min-h-[60px]"
      />
      <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-100">
        <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors">
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

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  const handleExport = async () => {
    try {
      const json = await invoke<string>('export_memories_json');
      const path = await save({ defaultPath: 'wollama-memories.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
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
        description="Small notes the assistant keeps about you, so it can be useful without having to be told twice. Edit, forget, or export — they are yours."
        actions={
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        }
      />

      <div>
        {memories.length === 0 ? (
          <div className="py-8 text-center text-zinc-400 text-sm">
            No memories yet. Wollama will remember things as you chat, or you can add them manually.
          </div>
        ) : (
          memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
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
