import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { GraphNode, GraphEdge, NodeCategory } from '@/types';
import { NODE_CATEGORY_COLORS } from '@/types';

interface GraphStore {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;

  fetchGraph: (projectId?: string) => Promise<void>;
  addNode: (label: string, category: NodeCategory, x?: number, y?: number, projectId?: string, metadata?: string) => Promise<GraphNode>;
  addEdge: (sourceId: string, targetId: string, label?: string, projectId?: string) => Promise<GraphEdge>;
  updateNodePositions: (positions: { id: string; x: number; y: number }[]) => Promise<void>;
  updateNodeMetadata: (id: string, metadata: string) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  deleteEdge: (id: string) => Promise<void>;
  importGraphData: (nodes: Omit<GraphNode, 'id' | 'created_at' | 'updated_at'>[], edges: { source_id: string; target_id: string; label?: string }[]) => Promise<void>;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  nodes: [],
  edges: [],
  loading: false,

  fetchGraph: async (projectId?: string) => {
    set({ loading: true });
    try {
      const data = await invoke<{ nodes: GraphNode[]; edges: GraphEdge[] }>('get_graph_data', { projectId });
      set({ nodes: data.nodes, edges: data.edges, loading: false });
    } catch (e) {
      console.error('Failed to fetch graph:', e);
      set({ loading: false });
    }
  },

  addNode: async (label, category, x = 0, y = 0, projectId?: string, metadata?: string) => {
    const color = NODE_CATEGORY_COLORS[category];
    const node = await invoke<GraphNode>('create_graph_node', {
      input: { label, category, color, x, y, project_id: projectId, metadata },
    });
    set((state) => ({ nodes: [...state.nodes, node] }));
    return node;
  },

  addEdge: async (sourceId, targetId, label?, projectId?) => {
    const edge = await invoke<GraphEdge>('create_graph_edge', {
      input: { source_id: sourceId, target_id: targetId, label, project_id: projectId },
    });
    set((state) => ({ edges: [...state.edges, edge] }));
    return edge;
  },

  updateNodePositions: async (positions) => {
    await invoke('update_node_positions', { positions });
    set((state) => ({
      nodes: state.nodes.map((n) => {
        const pos = positions.find((p) => p.id === n.id);
        return pos ? { ...n, x: pos.x, y: pos.y } : n;
      }),
    }));
  },

  updateNodeMetadata: async (id, metadata) => {
    await invoke('update_node_metadata', { id, metadata });
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, metadata } : n)),
    }));
  },

  deleteNode: async (id) => {
    await invoke('delete_graph_node', { id });
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source_id !== id && e.target_id !== id),
    }));
  },

  deleteEdge: async (id) => {
    await invoke('delete_graph_edge', { id });
    set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }));
  },

  importGraphData: async (nodes, edges) => {
    for (const n of nodes) {
      await get().addNode(n.label, n.category, n.x, n.y);
    }
    const currentNodes = get().nodes;
    for (const e of edges) {
      const src = currentNodes.find((n) => n.id === e.source_id);
      const tgt = currentNodes.find((n) => n.id === e.target_id);
      if (src && tgt) await get().addEdge(src.id, tgt.id, e.label);
    }
  },
}));
