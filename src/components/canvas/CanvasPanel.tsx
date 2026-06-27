import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Code2, Play } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { cn } from '@/utils';

export function CanvasPanel() {
  const { isOpen, activeArtifact, closeCanvas, versions, setVersion } = useCanvasStore();
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // If there's no active artifact or we are closed, render nothing or hidden
  if (!isOpen || !activeArtifact) return null;

  const isHtml = activeArtifact.type.toLowerCase() === 'html' || activeArtifact.type.toLowerCase() === 'react';

  // Force code view if it's not html/react
  const effectiveViewMode = isHtml ? viewMode : 'code';

  const handleDownload = () => {
    if (!activeArtifact) return;
    let mimeType = 'text/plain';
    let extension = 'txt';
    
    if (isHtml) {
      mimeType = 'text/html';
      extension = 'html';
    } else if (activeArtifact.type === 'typescript' || activeArtifact.type === 'ts') {
      mimeType = 'application/typescript';
      extension = 'ts';
    } else if (activeArtifact.type === 'javascript' || activeArtifact.type === 'js') {
      mimeType = 'application/javascript';
      extension = 'js';
    } else if (activeArtifact.type === 'markdown' || activeArtifact.type === 'md') {
      mimeType = 'text/markdown';
      extension = 'md';
    }

    const blob = new Blob([activeArtifact.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeArtifact.title.replace(/\s+/g, '_').toLowerCase()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const artifactVersions = versions.filter(v => (v.identifier || v.type) === (activeArtifact.identifier || activeArtifact.type));
  const currentIndex = artifactVersions.findIndex(v => v.id === activeArtifact.id);
  const displayVersion = currentIndex >= 0 ? currentIndex + 1 : 1;
  const isLatest = currentIndex === artifactVersions.length - 1;

  return (
    <div className="flex flex-col h-full w-full bg-white border-l border-zinc-200 shadow-sm animate-in slide-in-from-right-8 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50/50">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium text-sm text-zinc-800 truncate" title={activeArtifact.title}>
              {activeArtifact.title}
            </div>
            
            {/* Version Dropdown */}
            {artifactVersions.length > 0 && (
              <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                  v{displayVersion} {isLatest && '· Latest'}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-zinc-200 rounded-lg shadow-lg z-20 py-1 flex flex-col">
                      {artifactVersions.map((v, i) => {
                        const vNum = i + 1;
                        const isThisLatest = i === artifactVersions.length - 1;
                        return (
                          <button
                            key={v.id}
                            onClick={() => {
                              setVersion(v.id);
                              setDropdownOpen(false);
                            }}
                            className={cn(
                              "text-left px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 transition-colors flex items-center justify-between",
                              v.id === activeArtifact.id ? "text-blue-600 bg-blue-50/50" : "text-zinc-700"
                            )}
                          >
                            <span>Version {vNum}</span>
                            {isThisLatest && <span className="text-[10px] text-zinc-400 font-normal">Latest</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle (Only show if previewable) */}
          {isHtml && (
            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
              <button
                onClick={() => setViewMode('code')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === 'code' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <Code2 className="w-3.5 h-3.5" />
                Code
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  viewMode === 'preview' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <Play className="w-3.5 h-3.5" />
                Preview
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleDownload}
              className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={closeCanvas}
              className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative bg-zinc-50">
        {effectiveViewMode === 'preview' && isHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={activeArtifact.content}
            className="w-full h-full border-none bg-white"
            title="Artifact Preview"
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
          />
        ) : (
          <div className="w-full h-full p-4 bg-white">
            <pre className="w-full h-full overflow-auto font-mono text-xs leading-relaxed text-zinc-800 bg-zinc-50 p-4 rounded-lg border border-zinc-200 custom-scrollbar m-0">
              <code>{activeArtifact.content}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
