import React, { useEffect, useMemo, useCallback } from 'react';
import ReactFlow, { Background, BackgroundVariant, Panel } from 'reactflow';
import 'reactflow/dist/style.css';
import { KnowledgeGraphNode } from '@/components/graph/KnowledgeGraphNode';
import { useGraphStore } from '@/stores/graphStore';
import type { NodeCategory } from '@/types';
import { applyForceLayout } from '@/utils/layout';
import { Wand2 } from 'lucide-react';

const nodeTypes = { knowledgeNode: KnowledgeGraphNode };

interface ProjectGraphTabProps {
  projectId: string;
}

export function ProjectGraphTab({ projectId }: ProjectGraphTabProps) {
  const { nodes: storeNodes, edges: storeEdges, fetchGraph, updateNodePositions } = useGraphStore();

  useEffect(() => {
    fetchGraph(projectId);
  }, [projectId, fetchGraph]);

  // Filter store items to only include this project, just in case the store has global nodes.
  const displayNodes = useMemo(() => storeNodes.filter(n => n.project_id === projectId), [storeNodes, projectId]);
  const displayEdges = useMemo(() => storeEdges.filter(e => e.project_id === projectId), [storeEdges, projectId]);

  const flowNodes = useMemo(() => displayNodes.map((n) => {
    let relevance = 0.5;
    try {
      const meta = JSON.parse(n.metadata || '{}');
      if (typeof meta.relevance === 'number') relevance = meta.relevance;
    } catch {}
    return {
      id: n.id,
      type: 'knowledgeNode',
      position: { x: n.x, y: n.y },
      data: { label: n.label, category: n.category as NodeCategory, color: n.color, relevance },
    };
  }), [displayNodes]);

  const flowEdges = useMemo(() => displayEdges.map((e) => ({
    id: e.id, source: e.source_id, target: e.target_id, label: e.label || undefined,
  })), [displayEdges]);

  const handleAutoLayout = useCallback(async () => {
    if (flowNodes.length === 0) return;
    const positionedNodes = applyForceLayout(flowNodes, flowEdges, {
      width: 800,
      height: 600,
      nodeRadius: 100,
      linkDistance: 200,
      strength: -800
    });
    
    const positions = positionedNodes.map(n => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y
    }));
    await updateNodePositions(positions);
  }, [flowNodes, flowEdges, updateNodePositions]);

  return (
    <div className="h-full">
      {flowNodes.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-zinc-400">
          No graph yet. Extract a knowledge graph from a session in this project.
        </div>
      ) : (
        <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e4e4e7" />
          <Panel position="top-right">
            <button
              onClick={handleAutoLayout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 rounded-lg shadow-sm border border-zinc-200 transition-colors m-2"
              title="Auto Layout"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Auto Layout
            </button>
          </Panel>
        </ReactFlow>
      )}
    </div>
  );
}
