import React from 'react';
import { Handle, Position } from 'reactflow';
import { PipelineNodeData } from '@/stores/pipelineStore';
import { Download, Flag } from 'lucide-react';

export function OutputNode({ data }: { data: PipelineNodeData }) {
  const handleExport = () => {
    if (!data.result) return;
    const blob = new Blob([data.result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pipeline-output.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm min-w-[250px] overflow-hidden">
      <div className="bg-zinc-50 border-b border-zinc-200 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold text-xs text-zinc-700">Final Output</span>
        </div>
        <button 
          onClick={handleExport}
          disabled={!data.result}
          className="text-zinc-400 hover:text-zinc-700 disabled:opacity-50 transition-colors"
          title="Export as Markdown"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>
      
      <div className="p-3">
        <div className="w-full text-xs p-2 bg-zinc-50 border border-zinc-100 rounded-md h-32 overflow-y-auto text-zinc-700 whitespace-pre-wrap">
          {data.result || (
            <span className="text-zinc-400 italic">Output will appear here...</span>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-zinc-400 border-2 border-white"
      />
    </div>
  );
}
