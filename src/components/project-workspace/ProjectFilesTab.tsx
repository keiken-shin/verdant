import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { readTextFile, readFile } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '@/stores/projectStore';
import type { Project, ProjectFile } from '@/types';

const FILE_EXTS = ['txt', 'md', 'markdown', 'json', 'csv', 'log', 'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'toml', 'yaml', 'yml', 'html', 'css'];

interface ProjectFilesTabProps {
  project: Project;
  files: ProjectFile[];
}

export function ProjectFilesTab({ project, files }: ProjectFilesTabProps) {
  const { updateProject, addProjectFile, deleteProjectFile } = useProjectStore();
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    setInstructions(project.instructions || '');
  }, [project.instructions]);

  const handleSaveInstructions = async () => {
    if (instructions !== (project.instructions || '')) {
      await updateProject(project.id, { instructions });
    }
  };

  const handleAddFile = async () => {
    const selected = await open({ multiple: false, filters: [{ name: 'Text', extensions: FILE_EXTS }] });
    if (typeof selected !== 'string') return;
    try {
      const bytes = await readFile(selected);
      const name = selected.split(/[\\/]/).pop() || selected;
      const ext = name.includes('.') ? name.split('.').pop()! : '';
      
      const objectId = await invoke<string>('store_object', { data: Array.from(bytes) });
      await addProjectFile(project.id, name, ext, bytes.length, objectId);
    } catch (e) {
      console.error('Failed to read file:', e);
      alert(`Could not read file: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="px-10 py-8 max-w-3xl mx-auto w-full flex flex-col gap-8">
      {/* Project instructions (shared context) */}
      <div>
        <div className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 mb-2">
          Instructions <span className="font-normal lowercase tracking-normal">— shared with every session</span>
        </div>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onBlur={handleSaveInstructions}
          placeholder="Describe the project's goal, voice, constraints — injected into every chat here."
          rows={4}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-300 text-zinc-800 resize-y"
        />
      </div>

      <div>
        <button
          onClick={handleAddFile}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-700 transition-colors mb-5"
        >
          <Plus className="h-4 w-4" /> Add file
        </button>
        <p className="text-xs text-zinc-400 mb-4">Text files (txt, md, code). Their contents are injected as project context.</p>
        {files.length === 0 ? (
          <div className="text-sm text-zinc-400 py-6 text-center">No files yet.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 py-3 group">
                <FileText className="h-4 w-4 text-zinc-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-800 truncate">{f.name}</div>
                  <div className="text-xs text-zinc-400">{(f.size / 1024).toFixed(1)} KB</div>
                </div>
                <button
                  onClick={() => deleteProjectFile(f.project_id, f.id)}
                  className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove file"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
