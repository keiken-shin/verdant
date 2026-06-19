import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node as FlowNode,
  type Edge as FlowEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { X, Network } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { KnowledgeGraphNode } from './KnowledgeGraphNode';
import { useGraphStore } from '@/stores/graphStore';
import { useUiStore } from '@/stores/uiStore';
import { useMessageStore } from '@/stores/messageStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProviderStore } from '@/stores/providerStore';
import { providerRegistry } from '@/providers/registry';
import { extractGraphFromConversation } from '@/services/graphExtraction';
import { invoke } from '@tauri-apps/api/core';
import { NODE_CATEGORY_COLORS } from '@/types';
import type { NodeCategory } from '@/types';

const nodeTypes = {
  knowledgeNode: KnowledgeGraphNode,
};

export function KnowledgeGraphPanel() {
  const { nodes: storeNodes, edges: storeEdges, fetchGraph, addNode, addEdge } = useGraphStore();
  const { closeSearch, setGraphPanelOpen } = useUiStore();
  const { messagesBySession } = useMessageStore();
  const { settings } = useSettingsStore();
  const { providers, activeModelId } = useProviderStore();
  const location = useLocation();

  const [flowNodes, setFlowNodes] = useNodesState([]);
  const [flowEdges, setFlowEdges] = useEdgesState([]);
  const [extracting, setExtracting] = useState(false);

  const match = location.pathname.match(/\/chat\/([^/]+)/);
  const sessionId = match ? match[1] : undefined;
  const sessionMessages = sessionId ? (messagesBySession[sessionId] || []) : [];

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleExtract = async () => {
    if (!sessionId || sessionMessages.length === 0) return;

    setExtracting(true);
    try {
      const defaultProvider = providers.find((p) => p.is_default) || providers[0];
      if (!defaultProvider) {
        throw new Error('No provider available');
      }

      const ollamaEndpoint = settings.ollama_host || defaultProvider.endpoint;
      const provider = providerRegistry.createOllama(defaultProvider.id, ollamaEndpoint);
      
      const modelId = settings.extraction_model || activeModelId;
      if (!modelId) {
        throw new Error('No model active or configured for extraction');
      }

      const chatMessages = sessionMessages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      const { nodes: extractedNodes, edges: extractedEdges } = await extractGraphFromConversation(
        chatMessages,
        provider,
        modelId
      );

      if (extractedNodes.length === 0) {
        alert('No concepts could be extracted from this conversation.');
        return;
      }

      const labelToId: Record<string, string> = {};

      for (const n of extractedNodes) {
        const existingNode = storeNodes.find(
          (sn) => sn.label.toLowerCase() === n.label.toLowerCase()
        );

        if (existingNode) {
          labelToId[n.label.toLowerCase()] = existingNode.id;
        } else {
          const angle = Math.random() * 2 * Math.PI;
          const distance = 50 + Math.random() * 150;
          const x = 300 + Math.cos(angle) * distance;
          const y = 300 + Math.sin(angle) * distance;
          const newNode = await addNode(n.label, n.category, x, y);
          labelToId[n.label.toLowerCase()] = newNode.id;
        }
      }

      for (const e of extractedEdges) {
        const sourceId = labelToId[e.source.toLowerCase()];
        const targetId = labelToId[e.target.toLowerCase()];

        if (sourceId && targetId) {
          const edgeExists = storeEdges.some(
            (se) =>
              (se.source_id === sourceId && se.target_id === targetId) ||
              (se.source_id === targetId && se.target_id === sourceId)
          );

          if (!edgeExists) {
            await addEdge(sourceId, targetId, e.label);
          }
        }
      }

      await invoke('record_graph_extraction', {
        input: {
          session_id: sessionId,
          model_id: modelId,
          node_count: extractedNodes.length,
          edge_count: extractedEdges.length,
        },
      });

      await fetchGraph();
    } catch (e) {
      console.error('Extraction failed:', e);
      alert(`Failed to extract graph: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExtracting(false);
    }
  };

  const displayNodes = useMemo(() => {
    if (!sessionId || sessionMessages.length === 0) {
      return [];
    }

    const isRelated = (nodeLabel: string) => {
      const labelLower = nodeLabel.toLowerCase();
      return sessionMessages.some((m) => {
        const contentLower = m.content.toLowerCase();
        // Direct substring match
        if (contentLower.includes(labelLower)) return true;
        // Word-by-word match
        const words = labelLower.split(/\s+/).filter((w) => w.length > 2);
        if (words.length > 0 && words.every((w) => contentLower.includes(w))) return true;
        return false;
      });
    };

    return storeNodes.filter((n) => isRelated(n.label));
  }, [storeNodes, sessionId, sessionMessages]);

  const displayEdges = useMemo(() => {
    const nodeIds = new Set(displayNodes.map((n) => n.id));
    return storeEdges.filter(
      (e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id)
    );
  }, [storeEdges, displayNodes]);

  useEffect(() => {
    const fNodes: FlowNode[] = displayNodes.map((n) => ({
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
  }, [displayNodes]);

  useEffect(() => {
    const fEdges: FlowEdge[] = displayEdges.map((e) => ({
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      style: { stroke: '#e4e4e7', strokeWidth: 1 },
    }));
    setFlowEdges(fEdges);
  }, [displayEdges]);

  return (
    <div className="w-72 shrink-0 border-l border-zinc-100 flex flex-col bg-[var(--color-verdant-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-xs font-medium text-zinc-600">Knowledge Graph</span>
        </div>
        <div className="flex items-center gap-1.5">
          {sessionId && sessionMessages.length > 0 && (
            <button
              onClick={handleExtract}
              disabled={extracting}
              className="px-2 py-1 text-[10px] font-medium border border-zinc-200 rounded hover:bg-zinc-50 disabled:opacity-50 text-zinc-600 transition-all flex items-center gap-1"
            >
              {extracting ? 'Extracting...' : 'Extract'}
            </button>
          )}
          <button
            onClick={() => setGraphPanelOpen(false)}
            className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
            aria-label="Close graph panel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative">
        {displayNodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <div className="text-zinc-200 mb-3">
              <Network className="h-10 w-10 mx-auto" />
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Extract ideas from this conversation to build your knowledge graph.
            </p>
            {sessionId && sessionMessages.length > 0 && (
              <button
                onClick={handleExtract}
                disabled={extracting}
                className="px-3 py-1.5 text-xs text-white bg-zinc-900 hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50"
              >
                {extracting ? 'Extracting...' : 'Extract ideas'}
              </button>
            )}
          </div>
        ) : (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={true}
            zoomOnScroll={true}
            panOnScroll={false}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} color="#e4e4e7" size={1} gap={12} />
          </ReactFlow>
        )}
      </div>

      {/* Node count */}
      {displayNodes.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-100">
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set(displayNodes.map((n) => n.category))).map((cat) => {
              const count = displayNodes.filter((n) => n.category === cat).length;
              return (
                <div key={cat} className="flex items-center gap-1">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: NODE_CATEGORY_COLORS[cat as NodeCategory] }}
                  />
                  <span className="text-[10px] text-zinc-400">{cat} ({count})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
