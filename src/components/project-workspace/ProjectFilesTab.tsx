import React, { useState, useEffect, useCallback } from 'react';
import { Folder, FolderOpen, RefreshCw, FileText, ChevronRight, ChevronDown, Loader2, Unlink, Database, Check } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getCodeChunksCount, indexCodebasePipeline } from '@/services/embeddingService';
import type { Project, ProjectFile } from '@/types';

interface FileNode {
  name: String;
  path: String;
  relative_path: String;
  is_dir: boolean;
  size: number;
  children?: FileNode[];
}

interface ProjectFilesTabProps {
  project: Project;
  files: ProjectFile[];
}

function FileTreeNode({
  node,
  selectedPath,
  onSelect,
}: {
  node: FileNode;
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (node.is_dir) {
    return (
      <div className="select-none">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-zinc-100 cursor-pointer text-zinc-700 text-sm group"
        >
          <span className="text-zinc-400 group-hover:text-zinc-600">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
          <Folder className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="truncate font-medium">{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div className="pl-4 border-l border-zinc-100 ml-3 mt-0.5 space-y-0.5">
            {node.children.map((child) => (
              <FileTreeNode
                key={String(child.path)}
                node={child}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === String(node.relative_path);

  return (
    <div
      onClick={() => onSelect(node)}
      className={`flex items-center justify-between py-1 px-2 rounded-md cursor-pointer text-sm transition-colors ${
        isSelected
          ? 'bg-emerald-50 text-emerald-900 font-medium'
          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
      }`}
    >
      <div className="flex items-center gap-2 truncate">
        <FileText className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-zinc-400'}`} />
        <span className="truncate">{node.name}</span>
      </div>
      <span className="text-[10px] text-zinc-400 shrink-0 ml-2">
        {(node.size / 1024).toFixed(1)} KB
      </span>
    </div>
  );
}

export function ProjectFilesTab({ project }: ProjectFilesTabProps) {
  const { updateProject, cachedFolderTrees, setCachedFolderTree, invalidateFolderTree } = useProjectStore();
  const { settings } = useSettingsStore();
  const [instructions, setInstructions] = useState('');
  const cachedTree = project.id ? (cachedFolderTrees[project.id] as FileNode | undefined) : undefined;
  const [tree, setTree] = useState<FileNode | null>(cachedTree || null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // RAG Indexing State
  const [indexedCount, setIndexedCount] = useState<number | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<{ current: number; total: number } | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  const loadIndexedCount = useCallback(async () => {
    if (!project.id || !project.folder_path) {
      setIndexedCount(null);
      return;
    }
    try {
      const count = await getCodeChunksCount(project.id);
      setIndexedCount(count);
    } catch (e) {
      console.warn('Failed to load code chunks count:', e);
    }
  }, [project.id, project.folder_path]);

  useEffect(() => {
    loadIndexedCount();
  }, [loadIndexedCount]);

  const handleIndexCodebase = async () => {
    if (!project.id || !project.folder_path) return;
    setIndexing(true);
    setIndexError(null);
    setIndexingProgress({ current: 0, total: 0 });

    const endpoint = settings.ollama_host || 'http://127.0.0.1:11434';
    const model = settings.extraction_model || 'nomic-embed-text';

    const res = await indexCodebasePipeline(
      project.id,
      endpoint,
      model,
      (current, total) => {
        setIndexingProgress({ current, total });
      }
    );

    setIndexing(false);
    setIndexingProgress(null);

    if (res.error) {
      setIndexError(`Embedding failed: ${res.error}. Make sure Ollama is running and has '${model}' pulled.`);
    } else {
      setIndexedCount(res.indexedCount);
    }
  };

  useEffect(() => {
    setInstructions(project.instructions || '');
  }, [project.instructions]);

  const handleSaveInstructions = async () => {
    if (instructions !== (project.instructions || '')) {
      await updateProject(project.id, { instructions });
    }
  };

  const loadFolderTree = useCallback(async (force = false) => {
    if (!project.id || !project.folder_path) {
      setTree(null);
      return;
    }
    if (!force && cachedFolderTrees[project.id]) {
      setTree(cachedFolderTrees[project.id]);
      return;
    }
    setScanning(true);
    setError(null);
    try {
      const data = await invoke<FileNode>('scan_project_folder', { projectId: project.id });
      setTree(data);
      setCachedFolderTree(project.id, data);
    } catch (e) {
      console.error('Failed to scan folder:', e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }, [project.id, project.folder_path, cachedFolderTrees, setCachedFolderTree]);

  useEffect(() => {
    if (!project.folder_path) {
      setTree(null);
      return;
    }
    if (!cachedFolderTrees[project.id]) {
      loadFolderTree(false);
    } else {
      setTree(cachedFolderTrees[project.id]);
    }
  }, [project.id, project.folder_path]);

  const handleLinkFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Workspace Root Directory',
    });
    if (typeof selected !== 'string') return;

    invalidateFolderTree(project.id);
    await updateProject(project.id, { folder_path: selected });
  };

  const handleUnlinkFolder = async () => {
    invalidateFolderTree(project.id);
    await updateProject(project.id, { folder_path: '' });
    setTree(null);
    setSelectedFile(null);
    setPreviewContent(null);
  };

  const handleSelectFile = async (node: FileNode) => {
    setSelectedFile(node);
    setPreviewLoading(true);
    try {
      const content = await invoke<string>('read_project_file_content', {
        projectId: project.id,
        relativePath: node.relative_path,
      });
      setPreviewContent(content);
    } catch (e) {
      setPreviewContent(`[Error reading file: ${e instanceof Error ? e.message : String(e)}]`);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="px-8 py-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
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
          rows={3}
          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-emerald-600 text-zinc-800 resize-y"
        />
      </div>

      {/* Linked Folder Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400">
            Linked Workspace Folder <span className="font-normal lowercase tracking-normal">— local codebase reference</span>
          </div>

          <div className="flex items-center gap-2">
            {project.folder_path && (
              <>
                <button
                  onClick={handleIndexCodebase}
                  disabled={indexing || scanning}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                    indexedCount && indexedCount > 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  } disabled:opacity-50`}
                  title="Generate vector embeddings for local semantic code search (RAG)"
                >
                  {indexing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                      <span>
                        {indexingProgress && indexingProgress.total > 0
                          ? `Indexing ${indexingProgress.current}/${indexingProgress.total}...`
                          : 'Preparing chunks...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Database className="h-3 w-3 text-emerald-600" />
                      <span>
                        {indexedCount && indexedCount > 0 ? `${indexedCount} Chunks Indexed` : 'Index Embeddings'}
                      </span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => loadFolderTree(true)}
                  disabled={scanning || indexing}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  title="Rescan directory"
                >
                  <RefreshCw className={`h-3 w-3 ${scanning ? 'animate-spin' : ''}`} />
                  Rescan
                </button>
                <button
                  onClick={handleUnlinkFolder}
                  disabled={indexing}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-zinc-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Unlink folder from this project"
                >
                  <Unlink className="h-3 w-3" />
                  Unlink
                </button>
              </>
            )}
            <button
              onClick={handleLinkFolder}
              disabled={indexing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {project.folder_path ? 'Change Folder' : 'Link Local Folder'}
            </button>
          </div>
        </div>

        {!project.folder_path ? (
          <div className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center bg-zinc-50/50">
            <Folder className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
            <div className="text-sm font-medium text-zinc-700 mb-1">No local directory linked yet</div>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mb-4">
              Link this project to a local repository folder. Verdant will read and index files locally without needing manual uploads.
            </p>
            <button
              onClick={handleLinkFolder}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
            >
              <FolderOpen className="h-4 w-4" /> Link Local Folder
            </button>
          </div>
        ) : (
          <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
            <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
              <span className="font-mono truncate max-w-xl text-zinc-700" title={project.folder_path}>
                {project.folder_path}
              </span>
              <span className="text-[10px] text-zinc-400">In-place local read</span>
            </div>

            {indexError && (
              <div className="p-3 text-xs text-amber-800 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                <span>{indexError}</span>
                <button onClick={() => setIndexError(null)} className="text-amber-600 hover:text-amber-900 font-bold ml-2">✕</button>
              </div>
            )}

            {error && (
              <div className="p-4 text-xs text-red-600 bg-red-50 border-b border-red-100">
                {error}
              </div>
            )}

            <div className="grid grid-cols-12 min-h-[360px] max-h-[500px]">
              {/* File Tree Column */}
              <div className="col-span-5 border-r border-zinc-100 p-3 overflow-y-auto max-h-[500px]">
                {scanning ? (
                  <div className="flex items-center justify-center h-48 text-zinc-400 text-xs gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Scanning folder...
                  </div>
                ) : tree && tree.children && tree.children.length > 0 ? (
                  <div className="space-y-0.5">
                    {tree.children.map((child) => (
                      <FileTreeNode
                        key={String(child.path)}
                        node={child}
                        selectedPath={selectedFile ? String(selectedFile.relative_path) : null}
                        onSelect={handleSelectFile}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-xs text-zinc-400">
                    No code or text files found.
                  </div>
                )}
              </div>

              {/* File Preview Column */}
              <div className="col-span-7 p-4 overflow-y-auto max-h-[500px] bg-zinc-50/30">
                {selectedFile ? (
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3">
                      <span className="font-mono text-xs font-semibold text-zinc-800 truncate">
                        {String(selectedFile.relative_path)}
                      </span>
                      <span className="text-[10px] text-zinc-400 shrink-0">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    {previewLoading ? (
                      <div className="flex items-center justify-center h-40 text-zinc-400 text-xs gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Reading file...
                      </div>
                    ) : (
                      <pre className="font-mono text-xs text-zinc-700 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                        {previewContent}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-xs text-center py-12">
                    <FileText className="h-6 w-6 text-zinc-300 mb-2" />
                    Select a file from the tree to preview its content
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
