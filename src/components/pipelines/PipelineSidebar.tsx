import React from 'react';
import { FileText, Brain, Flag } from 'lucide-react';
import { PipelineNodeType } from '@/stores/pipelineStore';

const nodeTypes: { type: PipelineNodeType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'inputNode', label: 'Input Data', icon: <FileText className="h-4 w-4" />, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { type: 'llmNode', label: 'LLM Processor', icon: <Brain className="h-4 w-4" />, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { type: 'outputNode', label: 'Final Output', icon: <Flag className="h-4 w-4" />, color: 'bg-purple-50 text-purple-700 border-purple-200' },
];

export function PipelineSidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 border-r border-zinc-200 bg-white h-full flex flex-col">
      <div className="p-4 border-b border-zinc-200">
        <h2 className="font-semibold text-zinc-800">Nodes</h2>
        <p className="text-xs text-zinc-500 mt-1">Drag and drop nodes onto the canvas to build your pipeline.</p>
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        {nodeTypes.map((nt) => (
          <div
            key={nt.type}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-grab hover:shadow-sm transition-all ${nt.color}`}
            onDragStart={(event) => onDragStart(event, nt.type)}
            draggable
          >
            {nt.icon}
            <span className="text-sm font-medium">{nt.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
