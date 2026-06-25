import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node as FlowNode,
  type Edge as FlowEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Network, PanelRightClose, PanelRightOpen, Sparkles, Wand2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/utils';
import { KnowledgeGraphNode } from './KnowledgeGraphNode';
import { useGraphStore } from '@/stores/graphStore';
import { useUiStore } from '@/stores/uiStore';
import { useMessageStore } from '@/stores/messageStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProviderStore } from '@/stores/providerStore';
import { providerRegistry } from '@/providers/registry';
import { extractGraphFromConversation } from '@/services/graphExtraction';
import { invoke } from '@tauri-apps/api/core';
import { NODE_CATEGORY_COLORS } from '@/types';
import type { NodeCategory, GraphNode } from '@/types';
import { applyForceLayout } from '@/utils/layout';

const nodeTypes = {
  knowledgeNode: KnowledgeGraphNode,
};

const EMPTY_MESSAGES: any[] = [];

// ─── Session-scoped display logic ─────────────────────────────────────────────

function getSessionNodes(
  storeNodes: GraphNode[],
  sessionId: string
): GraphNode[] {
  return storeNodes.filter((node) => {
    // Strictly isolate to the session that extracted them
    try {
      const meta = JSON.parse(node.metadata || '{}') as Record<string, unknown>;
      if (meta.source_session_id === sessionId) return true;
      if (Array.isArray(meta.source_session_ids) && meta.source_session_ids.includes(sessionId)) return true;
    } catch {
      // ignore invalid metadata
    }
    return false;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KnowledgeGraphPanel() {
  const { nodes: storeNodes, edges: storeEdges, fetchGraph, addNode, addEdge, updateNodePositions } = useGraphStore();
  const { graphPanelOpen, toggleGraphPanel } = useUiStore();
  const { messagesBySession } = useMessageStore();
  const { sessions } = useSessionStore();
  const { settings } = useSettingsStore();
  const { providers, activeModelId } = useProviderStore();
  const location = useLocation();

  const [flowNodes, setFlowNodes] = useNodesState([]);
  const [flowEdges, setFlowEdges] = useEdgesState([]);
  const [extracting, setExtracting] = useState(false);
  const [lastIntent, setLastIntent] = useState<string | undefined>();

  const match = location.pathname.match(/\/chat\/([^/]+)/);
  const sessionId = match ? match[1] : undefined;
  const sessionMessages = sessionId ? (messagesBySession[sessionId] || EMPTY_MESSAGES) : EMPTY_MESSAGES;
  const projectId = sessionId ? sessions.find((s) => s.id === sessionId)?.project_id : undefined;

  const [width, setWidth] = useState(300);
  const [logoHovered, setLogoHovered] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.max(220, Math.min(800, startWidth + deltaX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };

    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    fetchGraph(projectId);
  }, [fetchGraph, projectId]);

  const handleAutoLayout = async () => {
    if (flowNodes.length === 0) return;
    const positionedNodes = applyForceLayout(flowNodes, flowEdges, {
      width: width,
      height: 600,
      nodeRadius: 80,
      linkDistance: 120,
      strength: -400
    });
    
    setFlowNodes(positionedNodes);

    const positions = positionedNodes.map(n => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y
    }));
    await updateNodePositions(positions);
  };

  // ─── Extract handler ───────────────────────────────────────────────────────

  const handleExtract = useCallback(async () => {
    if (!sessionId || sessionMessages.length === 0) return;

    setExtracting(true);
    try {
      const defaultProvider = providers.find((p) => p.is_default) || providers[0];
      if (!defaultProvider) throw new Error('No provider available');

      const ollamaEndpoint = settings.ollama_host || defaultProvider.endpoint;
      const provider = providerRegistry.createOllama(defaultProvider.id, ollamaEndpoint);

      const modelId = settings.extraction_model || activeModelId;
      if (!modelId) throw new Error('No model active or configured for extraction');

      const chatMessages = sessionMessages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      const { nodes: extractedNodes, edges: extractedEdges, conversationType, userIntent } =
        await extractGraphFromConversation(chatMessages, provider, modelId);

      if (extractedNodes.length === 0) {
        alert('No concepts could be extracted from this conversation.');
        return;
      }

      if (userIntent) setLastIntent(userIntent);

      const labelToId: Record<string, string> = {};
      const scopedNodes = storeNodes.filter((sn) => (sn.project_id || undefined) === projectId);

      for (const n of extractedNodes) {
        const existingNode = scopedNodes.find(
          (sn) => sn.label.toLowerCase() === n.label.toLowerCase()
        );

        if (existingNode) {
          labelToId[n.label.toLowerCase()] = existingNode.id;

          // Tag existing node with this session so it shows in the display
          try {
            const meta = JSON.parse(existingNode.metadata || '{}') as Record<string, unknown>;
            const sessionIds = Array.isArray(meta.source_session_ids)
              ? meta.source_session_ids as string[]
              : (meta.source_session_id ? [meta.source_session_id as string] : []);
            if (!sessionIds.includes(sessionId)) {
              sessionIds.push(sessionId);
              // Persist the updated metadata
              await invoke('update_node_metadata', {
                id: existingNode.id,
                metadata: JSON.stringify({
                  ...meta,
                  source_session_ids: sessionIds,
                  relevance: Math.max((meta.relevance as number) || 0, n.relevance),
                }),
              });
            }
          } catch {
            // Non-fatal — display fallback will still find it
          }
        } else {
          const angle = Math.random() * 2 * Math.PI;
          const distance = 60 + Math.random() * 180;
          const x = 300 + Math.cos(angle) * distance;
          const y = 300 + Math.sin(angle) * distance;

          // Embed session tracking + relevance + conversation context in node metadata
          const metadata = JSON.stringify({
            source_session_id: sessionId,
            source_session_ids: [sessionId],
            relevance: n.relevance,
            conversation_type: conversationType,
          });

          const newNode = await addNode(n.label, n.category, x, y, projectId, metadata);
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
            await addEdge(sourceId, targetId, e.label, projectId);
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
  }, [sessionId, sessionMessages, providers, settings, activeModelId, storeNodes, storeEdges, projectId, addNode, addEdge, fetchGraph]);

  // ─── Display nodes: session-scoped ────────────────────────────────────────

  const displayNodes = useMemo(() => {
    if (!sessionId) return [];
    return getSessionNodes(storeNodes, sessionId);
  }, [storeNodes, sessionId]);

  const displayEdges = useMemo(() => {
    const nodeIds = new Set(displayNodes.map((n) => n.id));
    return storeEdges.filter(
      (e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id)
    );
  }, [storeEdges, displayNodes]);

  // ─── React Flow nodes with relevance-based visual encoding ────────────────

  useEffect(() => {
    const fNodes: FlowNode[] = displayNodes.map((n) => {
      let relevance = 0.5;
      try {
        const meta = JSON.parse(n.metadata || '{}') as { relevance?: number };
        if (typeof meta.relevance === 'number') relevance = meta.relevance;
      } catch { /* use default */ }

      return {
        id: n.id,
        type: 'knowledgeNode',
        position: { x: n.x, y: n.y },
        data: {
          label: n.label,
          category: n.category as NodeCategory,
          color: n.color,
          relevance,
        },
      };
    });
    setFlowNodes(fNodes);
  }, [displayNodes]);

  useEffect(() => {
    const fEdges: FlowEdge[] = displayEdges.map((e) => ({
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      label: e.label,
      style: { stroke: '#d4d4d8', strokeWidth: 1 },
      labelStyle: { fontSize: 9, fill: '#a1a1aa' },
      labelBgStyle: { fill: 'transparent' },
    }));
    setFlowEdges(fEdges);
  }, [displayEdges]);

  // ─── Category stats for footer ─────────────────────────────────────────────

  const categoryStats = useMemo(() => {
    const counts: Partial<Record<NodeCategory, number>> = {};
    for (const n of displayNodes) {
      counts[n.category as NodeCategory] = (counts[n.category as NodeCategory] || 0) + 1;
    }
    return Object.entries(counts) as [NodeCategory, number][];
  }, [displayNodes]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'relative shrink-0 border-l border-zinc-100 flex flex-col bg-[var(--color-verdant-bg)] transition-all duration-200 ease-in-out overflow-x-hidden',
        graphPanelOpen ? '' : 'w-14'
      )}
      style={graphPanelOpen ? { width: `${width}px` } : undefined}
    >
      {/* Resizer */}
      {graphPanelOpen && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--color-verdant-primary)] z-10 group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
        </div>
      )}

      {/* Header */}
      {graphPanelOpen ? (
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Network className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-600">Knowledge Graph</span>
          </div>
          <div className="flex items-center gap-1.5">
              <button
                id="kg-layout-btn"
                onClick={handleAutoLayout}
                className="px-2 py-1 text-[10px] font-medium border border-zinc-200 rounded hover:bg-zinc-50 text-zinc-600 transition-all flex items-center gap-1"
                title="Auto Layout"
              >
                <Wand2 className="h-2.5 w-2.5" />
                Layout
              </button>
            {sessionId && sessionMessages.length > 0 && (
              <button
                id="kg-extract-btn"
                onClick={handleExtract}
                disabled={extracting}
                className="px-2 py-1 text-[10px] font-medium border border-zinc-200 rounded hover:bg-zinc-50 disabled:opacity-50 text-zinc-600 transition-all flex items-center gap-1"
              >
                {extracting ? (
                  <>
                    <span className="animate-spin inline-block w-2.5 h-2.5 border border-zinc-400 border-t-transparent rounded-full" />
                    Extracting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-2.5 w-2.5" />
                    Extract
                  </>
                )}
              </button>
            )}
            <button
              id="kg-collapse-btn"
              onClick={() => toggleGraphPanel()}
              className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
              title="Collapse panel"
              aria-label="Collapse panel"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="py-3 flex items-center justify-center border-b border-zinc-100"
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
        >
          <div className="flex items-center justify-center w-[34px] h-[34px] shrink-0">
            {logoHovered ? (
              <button
                id="kg-expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleGraphPanel();
                }}
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
                title="Expand panel"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
            ) : (
              <Network className="h-4 w-4 text-zinc-400" />
            )}
          </div>
        </div>
      )}

      {/* Inferred intent badge */}
      {graphPanelOpen && lastIntent && (
        <div className="px-3 py-2 border-b border-zinc-100 bg-zinc-50">
          <p className="text-[10px] text-zinc-400 leading-relaxed line-clamp-2" title={lastIntent}>
            <span className="font-medium text-zinc-500">Intent: </span>{lastIntent}
          </p>
        </div>
      )}

      {/* Graph */}
      {graphPanelOpen && (
        <div className="flex-1 relative">
          {displayNodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <div className="text-zinc-200 mb-3">
                <Network className="h-10 w-10 mx-auto" />
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                Extract entities, topics, decisions, and insights from this conversation.
              </p>
              {sessionId && sessionMessages.length > 0 && (
                <button
                  id="kg-extract-empty-btn"
                  onClick={handleExtract}
                  disabled={extracting}
                  className="px-3 py-1.5 text-xs text-white bg-zinc-900 hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {extracting ? (
                    <>
                      <span className="animate-spin inline-block w-3 h-3 border border-white border-t-transparent rounded-full" />
                      Extracting…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      Extract graph
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.25 }}
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
      )}

      {/* Category stats footer */}
      {graphPanelOpen && categoryStats.length > 0 && (
        <div className="px-3 py-2 border-t border-zinc-100">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {categoryStats.map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-1">
                <div
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: NODE_CATEGORY_COLORS[cat] }}
                />
                <span className="text-[10px] text-zinc-400">
                  {cat} ({count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
