import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { NODE_CATEGORY_COLORS } from '@/types';
import type { NodeCategory } from '@/types';
import { cn } from '@/utils';

interface GraphNodeData {
  label: string;
  category: NodeCategory;
  color?: string;
  selected?: boolean;
}

export const KnowledgeGraphNode = memo(function KnowledgeGraphNode({ data, selected }: NodeProps<GraphNodeData>) {
  const color = data.color || NODE_CATEGORY_COLORS[data.category] || '#5A67D8';

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-medium cursor-default',
        'bg-white transition-shadow',
        selected ? 'border-zinc-400 shadow-md' : 'border-zinc-200 hover:border-zinc-300 hover:shadow-sm'
      )}
    >
      {/* Color dot */}
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Label */}
      <span className="text-zinc-800 whitespace-nowrap max-w-[120px] truncate">
        {data.label}
      </span>

      {/* Category */}
      <span className="text-[10px] text-zinc-400 tracking-wide ml-0.5">
        {data.category}
      </span>

      {/* Handles — invisible but required for React Flow connections */}
      <Handle
        type="target"
        position={Position.Left}
        className="opacity-0 w-2 h-2 border-0"
        style={{ background: 'transparent' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="opacity-0 w-2 h-2 border-0"
        style={{ background: 'transparent' }}
      />
    </div>
  );
});
