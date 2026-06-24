import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderKanban, Pin, Trash2, ChevronRight, Search, Pencil } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useProjectStore } from '@/stores/projectStore';
import { formatRelativeTime, cn } from '@/utils';
import type { Project } from '@/types';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, fetchProjects, createProject, updateProject, deleteProject } = useProjectStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleOpenNewModal = () => {
    setNewName('');
    setNewDescription('');
    setIsNewModalOpen(true);
  };

  const handleCreateProject = async () => {
    if (!newName.trim()) return;
    const project = await createProject(newName.trim(), newDescription.trim() || undefined);
    setIsNewModalOpen(false);
    navigate(`/projects/${project.id}`);
  };

  const handlePin = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    await updateProject(p.id, { is_pinned: !p.is_pinned });
  };

  const handleRename = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setEditName(p.name);
    setEditingProjectId(p.id);
  };

  const handleSaveRename = async (id: string) => {
    if (editName.trim() && editName.trim() !== projects.find((p) => p.id === id)?.name) {
      await updateProject(id, { name: editName.trim() });
    }
    setEditingProjectId(null);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this project? Its sessions are kept as loose chats.')) {
      await deleteProject(id);
    }
  };

  const q = filter.trim().toLowerCase();
  const visible = q
    ? projects.filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
    : projects;
  const pinned = visible.filter((p) => p.is_pinned);
  const rest = visible.filter((p) => !p.is_pinned);

  const renderRow = (p: Project) => {
    const isEditing = editingProjectId === p.id;
    return (
      <div
        key={p.id}
        onClick={() => !isEditing && navigate(`/projects/${p.id}`)}
        onMouseEnter={() => setHoveredId(p.id)}
        onMouseLeave={() => setHoveredId(null)}
        className="flex items-center gap-4 py-4 cursor-pointer hover:bg-zinc-50 -mx-4 px-4 rounded-lg transition-colors group"
      >
        <div
          className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 text-white"
          style={{ background: p.color || 'var(--color-verdant-primary, #38A169)' }}
        >
          <FolderKanban className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0" onClick={(e) => isEditing && e.stopPropagation()}>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename(p.id);
                if (e.key === 'Escape') setEditingProjectId(null);
              }}
              onBlur={() => handleSaveRename(p.id)}
              autoFocus
              className="w-full max-w-md px-2 py-0.5 text-sm border border-zinc-200 rounded bg-white outline-none focus:border-zinc-400 text-zinc-800 font-medium"
            />
          ) : (
            <>
              <div className="text-sm font-medium text-zinc-800 truncate">{p.name}</div>
              {p.description && (
                <p className="text-sm text-zinc-400 truncate">{p.description}</p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-xs text-zinc-300">
            {formatRelativeTime(p.last_opened_at || p.updated_at)} ago
          </div>
          <div className={cn('flex items-center gap-1 transition-opacity', hoveredId === p.id ? 'opacity-100' : 'opacity-0')}>
            <button
              onClick={(e) => handlePin(e, p)}
              className={cn('p-1 rounded hover:bg-zinc-100 transition-colors', p.is_pinned ? 'text-[var(--color-verdant-primary)]' : 'text-zinc-400')}
              title={p.is_pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => handleRename(e, p)}
              className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
              title="Rename"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => handleDelete(e, p.id)}
              className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-300" />
        </div>
      </div>
    );
  };

  return (
    <div className="px-12 py-12 max-w-4xl">
      <PageHeader
        label="WORKSPACE"
        title="Projects"
        description="Group your thinking into projects. Each project keeps its own sessions, knowledge base, and graph — shared as context across every chat inside it."
        actions={
          <button
            onClick={handleOpenNewModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> New project
          </button>
        }
      />

      {/* Search/filter */}
      <div className="flex items-center gap-2 mb-6 px-3 py-2 border border-zinc-200 rounded-lg max-w-sm">
        <Search className="h-4 w-4 text-zinc-400 shrink-0" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search projects..."
          className="flex-1 text-sm text-zinc-800 placeholder:text-zinc-400 bg-transparent outline-none"
        />
      </div>

      {visible.length === 0 ? (
        <div className="py-16 text-center text-zinc-400 text-sm">
          {q ? 'No projects match your search.' : 'No projects yet. Create one to begin.'}
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 mb-1">Pinned</div>
              <div className="divide-y divide-zinc-100">{pinned.map(renderRow)}</div>
            </div>
          )}
          <div className="divide-y divide-zinc-100">{rest.map(renderRow)}</div>
        </>
      )}

      {/* New Project Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-zinc-900">Create New Project</h2>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    handleCreateProject();
                  } else if (e.key === 'Escape') {
                    setIsNewModalOpen(false);
                  }
                }}
                placeholder="E.g., Website Redesign"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] focus:ring-1 focus:ring-[var(--color-verdant-primary)] text-zinc-800"
                autoFocus
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">Description <span className="text-zinc-400 font-normal">(optional)</span></label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Briefly describe the project goals..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-verdant-primary)] focus:ring-1 focus:ring-[var(--color-verdant-primary)] text-zinc-800 resize-none"
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
