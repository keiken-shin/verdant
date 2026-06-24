import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ReactFlow, { Background, BackgroundVariant } from 'reactflow';
import 'reactflow/dist/style.css';
import { KnowledgeGraphNode } from '@/components/graph/KnowledgeGraphNode';
import type { GraphNode, GraphEdge, NodeCategory } from '@/types';

const nodeTypes = { knowledgeNode: KnowledgeGraphNode };

interface ProjectGraphTabProps {
  projectId: string;
}

export function ProjectGraphTab({ projectId }: ProjectGraphTabProps) {
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });

  useEffect(() => {
    invoke<{ nodes: GraphNode[]; edges: GraphEdge[] }>('get_graph_data', { projectId })
      .then(setGraph)
      .catch(console.error);
  }, [projectId]);

  const flowNodes = graph.nodes.map((n) => ({
    id: n.id,
    type: 'knowledgeNode',
    position: { x: n.x, y: n.y },
    data: { label: n.label, category: n.category as NodeCategory, color: n.color },
  }));

  const flowEdges = graph.edges.map((e) => ({
    id: e.id, source: e.source_id, target: e.target_id, label: e.label || undefined,
  }));

  return (
    <div className="h-full">
      {flowNodes.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-zinc-400">
          No graph yet. Extract a knowledge graph from a session in this project.
        </div>
      ) : (
        <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e4e4e7" />
        </ReactFlow>
      )}
    </div>
  );
}
