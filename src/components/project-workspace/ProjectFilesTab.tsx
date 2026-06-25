import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Sparkles, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProviderStore } from '@/stores/providerStore';
import { providerRegistry } from '@/providers/registry';
import { summarizeFile } from '@/services/sessionContext';
import type { Project, ProjectFile } from '@/types';

const FILE_EXTS = ['txt', 'md', 'markdown', 'json', 'csv', 'log', 'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'toml', 'yaml', 'yml', 'html', 'css'];

interface ProjectFilesTabProps {
  project: Project;
  files: ProjectFile[];
}

export function ProjectFilesTab({ project, files }: ProjectFilesTabProps) {
  const { updateProject, addProjectFile, deleteProjectFile, updateProjectFileMode, updateProjectFileSummary } = useProjectStore();
  const { settings } = useSettingsStore();
  const { providers, activeModelId } = useProviderStore();
  
  const [instructions, setInstructions] = useState('');
  const [autoSummarize, setAutoSummarize] = useState(false);
  const [summarizing, setSummarizing] = useState<Record<string, boolean>>({});
  const [expandedSummary, setExpandedSummary] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setInstructions(project.instructions || '');
  }, [project.instructions]);

  const handleSaveInstructions = async () => {
    if (instructions !== (project.instructions || '')) {
      await updateProject(project.id, { instructions });
    }
  };

  const handleSummarize = async (file: ProjectFile) => {
    if (summarizing[file.id]) return;
    
    const defaultProvider = providers.find((p) => p.id === 'ollama');
    if (!defaultProvider) {
      alert("Ollama provider not found. Please ensure it is enabled in Settings.");
      return;
    }
    
    const ollamaProvider = providerRegistry.createOllama(defaultProvider.id, settings.ollama_host || 'http://localhost:11434');
    
    const model = settings.extraction_model || activeModelId;
    if (!model) {
      alert("No model selected. Please select an active model in Settings or the chat header.");
      return;
    }

    setSummarizing(prev => ({ ...prev, [file.id]: true }));
    try {
      const text = await invoke<string>('read_object_text', { id: file.object_id });
      const summary = await summarizeFile(text, ollamaProvider, model);
      if (summary) {
        await updateProjectFileSummary(project.id, file.id, summary);
        setExpandedSummary(prev => ({ ...prev, [file.id]: true }));
      }
    } catch (e) {
      console.error('Failed to summarize file:', e);
      alert(`Summarization failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSummarizing(prev => ({ ...prev, [file.id]: false }));
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
      const file = await addProjectFile(project.id, name, ext, bytes.length, objectId);
      if (autoSummarize) {
        handleSummarize(file);
      }
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
        <div className="flex items-center gap-4 mb-5">
          <button
            onClick={handleAddFile}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add file
          </button>
          <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
            <input 
              type="checkbox" 
              checked={autoSummarize} 
              onChange={(e) => setAutoSummarize(e.target.checked)} 
              className="rounded border-zinc-300"
            />
            Auto-summarize new files
          </label>
        </div>
        <p className="text-xs text-zinc-400 mb-4">Text files (txt, md, code). Their contents are injected as project context.</p>
        {files.length === 0 ? (
          <div className="text-sm text-zinc-400 py-6 text-center">No files yet.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {files.map((f) => (
              <div key={f.id} className="flex flex-col py-3 group">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setExpandedSummary(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                    className="p-1 text-zinc-400 hover:text-zinc-600 rounded disabled:opacity-50"
                    disabled={!f.summary}
                    title={f.summary ? "Toggle summary view" : "No summary available"}
                  >
                    {expandedSummary[f.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <FileText className="h-4 w-4 text-zinc-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-800 truncate">{f.name}</span>
                      <select
                        value={f.include_mode || 'inline'}
                        onChange={(e) => updateProjectFileMode(f.project_id, f.id, e.target.value as 'inline' | 'reference' | 'summary')}
                        className="text-[10px] bg-transparent border border-zinc-200 rounded px-1 py-0.5 text-zinc-500 hover:border-zinc-300 outline-none cursor-pointer"
                        title={
                          f.include_mode === 'reference' ? "Reference only: not injected into prompts automatically" : 
                          f.include_mode === 'summary' ? "Summary: only the AI-generated summary is injected" :
                          "Inline: contents injected into every prompt"
                        }
                      >
                        <option value="inline">Inline Context</option>
                        <option value="summary">Summary Only</option>
                        <option value="reference">Reference Only</option>
                      </select>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">{(f.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button
                    onClick={() => handleSummarize(f)}
                    disabled={summarizing[f.id]}
                    className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-100 disabled:text-emerald-600"
                    title="Generate AI Summary"
                  >
                    {summarizing[f.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => deleteProjectFile(f.project_id, f.id)}
                    className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {expandedSummary[f.id] && f.summary && (
                  <div className="ml-8 mt-2 p-3 bg-zinc-50 border border-zinc-100 rounded-md text-xs text-zinc-600 whitespace-pre-wrap">
                    {f.summary}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
