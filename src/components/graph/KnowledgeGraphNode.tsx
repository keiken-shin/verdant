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
  /** 0.0–1.0 — controls visual prominence. Low relevance nodes are de-emphasized. */
  relevance?: number;
}

export const KnowledgeGraphNode = memo(function KnowledgeGraphNode({ data, selected }: NodeProps<GraphNodeData>) {
  const color = data.color || NODE_CATEGORY_COLORS[data.category] || '#5A67D8';
  const relevance = data.relevance ?? 0.5;

  // Visual encoding for relevance:
  // - High (≥0.7):  full opacity, slightly larger dot
  // - Mid (0.4–0.7): normal
  // - Low (<0.4):   reduced opacity, muted styling
  const isHighRelevance = relevance >= 0.7;
  const isLowRelevance = relevance < 0.35;

  return (
    <div
      className={cn(
        'relative flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-medium cursor-default',
        'bg-white transition-shadow',
        selected
          ? 'border-zinc-400 shadow-md'
          : isHighRelevance
          ? 'border-zinc-300 shadow-sm hover:shadow-md'
          : 'border-zinc-200 hover:border-zinc-300 hover:shadow-sm',
        isLowRelevance && 'opacity-50'
      )}
    >
      {/* Color dot — grows for high-relevance nodes */}
      <div
        className={cn(
          'rounded-full shrink-0 transition-all',
          isHighRelevance ? 'h-2.5 w-2.5' : 'h-2 w-2'
        )}
        style={{ backgroundColor: color }}
      />

      {/* Label */}
      <span className="text-zinc-800 whitespace-nowrap max-w-[130px] truncate">
        {data.label}
      </span>

      {/* Category badge */}
      <span className="text-[9px] text-zinc-400 tracking-wide ml-0.5 uppercase">
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
