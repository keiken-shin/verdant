import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, MessageSquare, FileText, Clock, Trash2, ArrowLeft, Edit2, Check, X, Settings } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { cn } from '@/utils';
import { useConfirmStore } from '@/stores/confirmStore';
import type { Project } from '@/types';

export const TABS = ['Chat', 'Files', 'Graph', 'Timeline', 'Settings'] as const;
export type Tab = typeof TABS[number];

interface ProjectWorkspaceHeaderProps {
  project: Project;
  tab: Tab;
  setTab: (tab: Tab) => void;
  filesCount: number;
}

export function ProjectWorkspaceHeader({ project, tab, setTab, filesCount }: ProjectWorkspaceHeaderProps) {
  const navigate = useNavigate();
  const { updateProject, deleteProject } = useProjectStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  useEffect(() => {
    setTempName(project.name);
  }, [project.name]);

  const handleRenameSave = async () => {
    if (tempName.trim() && tempName !== project.name) {
      await updateProject(project.id, { name: tempName.trim() });
    }
    setIsEditingName(false);
  };

  const handleRenameCancel = () => {
    setTempName(project.name);
    setIsEditingName(false);
  };

  const handleDeleteProject = async () => {
    const yes = await useConfirmStore.getState().confirm({
      title: 'Delete Project',
      message: 'Delete this project? Its sessions are kept as loose chats.',
      kind: 'warning',
    });
    if (yes) {
      navigate('/projects');
      await deleteProject(project.id);
    }
  };

  return (
    <div className="px-10 pt-8 pb-3 border-b border-zinc-100">
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 mb-3 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Projects
      </button>
      <div className="flex items-center justify-between">
        {isEditingName ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSave();
                if (e.key === 'Escape') handleRenameCancel();
              }}
              autoFocus
              className="px-2 py-0.5 text-lg font-semibold border border-zinc-200 rounded outline-none focus:border-zinc-400 text-zinc-800"
            />
            <button
              onClick={handleRenameSave}
              className="p-1 rounded hover:bg-zinc-100 text-emerald-600"
              title="Save name"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleRenameCancel}
              className="p-1 rounded hover:bg-zinc-100 text-red-500"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group/title">
            <h1
              onClick={() => setIsEditingName(true)}
              className="text-2xl font-semibold text-zinc-900 cursor-pointer hover:text-zinc-700 transition-colors"
              title="Click to rename"
            >
              {project.name}
            </h1>
            <button
              onClick={() => setIsEditingName(true)}
              className="p-0.5 rounded text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 opacity-0 group-hover/title:opacity-100 transition-opacity"
              title="Rename project"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDeleteProject}
              className="p-0.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/title:opacity-100 transition-opacity"
              title="Delete project"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {project.description && <p className="text-sm text-zinc-500 mt-1">{project.description}</p>}

      {/* Tabs */}
      <div className="flex items-center gap-1 mt-5 -mb-3">
        {TABS.map((t) => {
          const Icon = { Chat: MessageSquare, Files: FileText, Graph: Network, Timeline: Clock, Settings: Settings }[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md border-b-2 transition-colors',
                tab === t
                  ? 'border-[var(--color-verdant-primary)] text-zinc-900 font-medium'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t}
              {t === 'Files' && filesCount > 0 && <span className="text-xs text-zinc-400">({filesCount})</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
