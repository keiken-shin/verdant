import React, { useEffect, useMemo, useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node as FlowNode,
  type Edge as FlowEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Trash2, Download } from 'lucide-react';
import { PageHeader, SectionLabel } from '@/components/ui/PageHeader';
import { KnowledgeGraphNode } from '@/components/graph/KnowledgeGraphNode';
import { Badge } from '@/components/ui/Badge';
import { useGraphStore } from '@/stores/graphStore';
import { NODE_CATEGORY_COLORS, NODE_CATEGORIES } from '@/types';
import type { NodeCategory } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

const nodeTypes = {
  knowledgeNode: KnowledgeGraphNode,
};

function AddNodeModal({ onAdd, onClose }: { onAdd: (label: string, cat: NodeCategory) => void; onClose: () => void }) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<NodeCategory>('CONCEPT');

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl border border-zinc-200 p-6 w-80">
        <h3 className="text-sm font-semibold text-zinc-900 mb-4">Add node</h3>
        <div className="space-y-3">
          <div>
            <label className="section-label block mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              placeholder="e.g. Pattern Language"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-[var(--color-wollama-primary)] text-zinc-800"
            />
          </div>
          <div>
            <label className="section-label block mb-1">Category</label>
            <div className="flex flex-wrap gap-1">
              {NODE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full border text-xs transition-all"
                  style={{
                    borderColor: category === cat ? NODE_CATEGORY_COLORS[cat] : '#e4e4e7',
                    backgroundColor: category === cat ? `${NODE_CATEGORY_COLORS[cat]}18` : 'transparent',
                    color: category === cat ? NODE_CATEGORY_COLORS[cat] : '#71717a',
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: NODE_CATEGORY_COLORS[cat] }}
                  />
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 pt-4 border-t border-zinc-100">
          <button
            onClick={() => { if (label.trim()) { onAdd(label.trim(), category); onClose(); } }}
            className="flex-1 py-2 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Add node
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function KnowledgeGraphPage() {
  const { nodes: storeNodes, edges: storeEdges, fetchGraph, addNode, addEdge: storeAddEdge, updateNodePositions, deleteNode, deleteEdge } = useGraphStore();
  const [flowNodes, setFlowNodes, onFlowNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onFlowEdgesChange] = useEdgesState([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  // Sync store nodes to flow nodes
  useEffect(() => {
    const fNodes: FlowNode[] = storeNodes.map((n) => ({
      id: n.id,
      type: 'knowledgeNode',
      position: { x: n.x, y: n.y },
      data: {
        label: n.label,
        category: n.category as NodeCategory,
        color: n.color,
      },
    }));
    setFlowNodes(fNodes);
  }, [storeNodes]);

  // Sync store edges to flow edges
  useEffect(() => {
    const fEdges: FlowEdge[] = storeEdges.map((e) => ({
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      label: e.label || '',
      animated: false,
      style: { stroke: '#d4d4d8', strokeWidth: 1.5 },
      labelStyle: { fontSize: 10, fill: '#a1a1aa' },
    }));
    setFlowEdges(fEdges);
  }, [storeEdges]);

  // Save positions on drag stop
  const handleNodesChange = useCallback((changes: Parameters<typeof onFlowNodesChange>[0]) => {
    onFlowNodesChange(changes);
    const posChanges = changes
      .filter((c) => c.type === 'position' && (c as { dragging?: boolean }).dragging === false && (c as { position?: { x: number; y: number } }).position)
      .map((c) => {
        const pc = c as { id: string; position: { x: number; y: number } };
        return { id: pc.id, x: pc.position.x, y: pc.position.y };
      });
    if (posChanges.length > 0) {
      updateNodePositions(posChanges);
    }
  }, [onFlowNodesChange, updateNodePositions]);

  const handleConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      storeAddEdge(connection.source, connection.target);
    }
  }, [storeAddEdge]);

  const handleAddNode = async (label: string, category: NodeCategory) => {
    // Position new nodes in a grid-like layout
    const angle = (storeNodes.length * 60) % 360;
    const r = 200 + Math.floor(storeNodes.length / 6) * 120;
    const x = 400 + r * Math.cos(angle * Math.PI / 180);
    const y = 300 + r * Math.sin(angle * Math.PI / 180);
    await addNode(label, category, x, y);
  };

  const handleDeleteSelected = async () => {
    if (selectedNodeId) {
      await deleteNode(selectedNodeId);
      setSelectedNodeId(null);
    }
  };

  const handleExport = async () => {
    try {
      const json = await invoke<string>('export_graph_json');
      const path = await save({ defaultPath: 'wollama-graph.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (path) await writeTextFile(path, json);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  // Legend counts
  const categoryCounts = storeNodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.category] = (acc[n.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Header area */}
      <div className="px-12 pt-12 pb-6 border-b border-zinc-100">
        <PageHeader
          label="CONNECTED IDEAS"
          title="Knowledge Graph"
          description={`${storeNodes.length} nodes · ${storeEdges.length} connections`}
          actions={
            <div className="flex items-center gap-2">
              {selectedNodeId && (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete node
                </button>
              )}
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors border border-zinc-200"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                onClick={() => setAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-zinc-900 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add node
              </button>
            </div>
          }
        />

        {/* Category legend */}
        {storeNodes.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-2">
            {NODE_CATEGORIES.filter((c) => categoryCounts[c] > 0).map((cat) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: NODE_CATEGORY_COLORS[cat] }}
                />
                <span className="text-xs text-zinc-500">{cat}</span>
                <span className="text-xs text-zinc-300">({categoryCounts[cat]})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Graph canvas */}
      <div className="flex-1 relative">
        {storeNodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
            <div className="text-zinc-300 mb-4">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="31" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
                <circle cx="32" cy="20" r="6" fill="currentColor" fillOpacity="0.3" />
                <circle cx="20" cy="44" r="5" fill="currentColor" fillOpacity="0.3" />
                <circle cx="44" cy="44" r="5" fill="currentColor" fillOpacity="0.3" />
                <line x1="32" y1="26" x2="20" y2="39" stroke="currentColor" strokeWidth="1" />
                <line x1="32" y1="26" x2="44" y2="39" stroke="currentColor" strokeWidth="1" />
              </svg>
            </div>
            <p className="text-sm text-zinc-400 mb-2">No nodes yet</p>
            <p className="text-xs text-zinc-300 max-w-xs">
              Extract concepts from a conversation or add one manually.
            </p>
            <button
              onClick={() => setAddModalOpen(true)}
              className="mt-4 flex items-center gap-1.5 px-3 py-2 text-xs text-[var(--color-wollama-primary)] hover:bg-[var(--color-wollama-hover)] rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add your first node
            </button>
          </div>
        ) : (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onFlowEdgesChange}
            onConnect={handleConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode={null}
            minZoom={0.2}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} color="#e4e4e7" size={1} gap={16} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const cat = node.data?.category as NodeCategory;
                return NODE_CATEGORY_COLORS[cat] || '#5A67D8';
              }}
              style={{ borderRadius: 8, border: '1px solid #e4e4e7' }}
            />
          </ReactFlow>
        )}
      </div>

      {addModalOpen && (
        <AddNodeModal
          onAdd={handleAddNode}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </div>
  );
}
