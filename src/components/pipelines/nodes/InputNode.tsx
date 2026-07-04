import React from 'react';
import { Handle, Position } from 'reactflow';
import { PipelineNodeData, usePipelineStore } from '@/stores/pipelineStore';
import { FileText } from 'lucide-react';
import { cn } from '@/utils';

export function InputNode({ id, data }: { id: string; data: PipelineNodeData }) {
  const updateNodeData = usePipelineStore((state) => state.updateNodeData);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-sm min-w-[250px] overflow-hidden">
      <div className="bg-zinc-50 border-b border-zinc-200 px-3 py-2 flex items-center gap-2">
        <FileText className="h-4 w-4 text-emerald-600" />
        <span className="font-semibold text-xs text-zinc-700">Input Data</span>
      </div>
      
      <div className="p-3 flex flex-col gap-2">
        <textarea
          className="w-full text-xs p-2 border border-zinc-200 rounded-md outline-none focus:border-emerald-500 resize-none h-24"
          placeholder="Enter initial text here..."
          value={data.content || ''}
          onChange={(e) => updateNodeData(id, { content: e.target.value })}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-emerald-500 border-2 border-white"
      />
    </div>
  );
}
