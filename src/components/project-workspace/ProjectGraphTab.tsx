import React, { useEffect, useMemo, useCallback, useState } from 'react';
import ReactFlow, { Background, BackgroundVariant, Panel } from 'reactflow';
import 'reactflow/dist/style.css';
import { KnowledgeGraphNode } from '@/components/graph/KnowledgeGraphNode';
import { useGraphStore } from '@/stores/graphStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { matchDecisionToSymbol } from '@/services/systemOneService';
import type { NodeCategory } from '@/types';
import { applyForceLayout } from '@/utils/layout';
import { Wand2, Code2, Loader2, Sparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

const nodeTypes = { knowledgeNode: KnowledgeGraphNode };

interface ProjectGraphTabProps {
  projectId: string;
}

export function ProjectGraphTab({ projectId }: ProjectGraphTabProps) {
  const { nodes: storeNodes, edges: storeEdges, fetchGraph, updateNodePositions, addEdge } = useGraphStore();
  const { settings } = useSettingsStore();
  const [domainFilter, setDomainFilter] = useState<'all' | 'code' | 'conversation'>('all');
  const [isScanningCode, setIsScanningCode] = useState(false);
  const [isBridging, setIsBridging] = useState(false);

  useEffect(() => {
    fetchGraph(projectId);
  }, [projectId, fetchGraph]);

  const handleScanCodebase = async () => {
    setIsScanningCode(true);
    try {
      await invoke('parse_codebase_to_graph', { projectId });
      await fetchGraph(projectId);
    } catch (e) {
      console.error('Failed to parse codebase to graph:', e);
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setIsScanningCode(false);
    }
  };

  const handleAutoBridge = async () => {
    setIsBridging(true);
    try {
      const codeNodes = storeNodes.filter(n => n.project_id === projectId && n.domain === 'code');
      const convNodes = storeNodes.filter(n => n.project_id === projectId && (n.domain || 'conversation') === 'conversation');
      if (codeNodes.length === 0 || convNodes.length === 0) {
        alert('Both Code AST nodes and Conversation nodes are required to extract bridge edges.');
        return;
      }
      const candidateSymbols = codeNodes.map(c => c.label);
      let bridgedCount = 0;

      for (const cn of convNodes) {
        if (['DECISION', 'ACTION', 'INSIGHT', 'TOOL'].includes(cn.category)) {
          const { matchedSymbol, relation } = await matchDecisionToSymbol(
            settings.ollama_host || 'http://127.0.0.1:11434',
            settings.system_one_model || 'clef-flash',
            cn.label,
            candidateSymbols
          );
          if (matchedSymbol) {
            const codeTarget = codeNodes.find(c => c.label === matchedSymbol);
            if (codeTarget) {
              const alreadyExists = storeEdges.some(e =>
                e.edge_type === 'bridge' &&
                ((e.source_id === cn.id && e.target_id === codeTarget.id) ||
                 (e.source_id === codeTarget.id && e.target_id === cn.id))
              );
              if (!alreadyExists) {
                await addEdge(cn.id, codeTarget.id, relation, projectId, 'bridge');
                bridgedCount++;
              }
            }
          }
        }
      }
      await fetchGraph(projectId);
    } catch (e) {
      console.error('Failed to auto-bridge concepts:', e);
    } finally {
      setIsBridging(false);
    }
  };

  // Filter store items to only include this project, and apply domain filter
  const displayNodes = useMemo(() => {
    return storeNodes
      .filter((n) => n.project_id === projectId)
      .filter((n) => {
        if (domainFilter === 'all') return true;
        return (n.domain || 'conversation') === domainFilter;
      });
  }, [storeNodes, projectId, domainFilter]);

  const displayNodeIds = useMemo(() => new Set(displayNodes.map((n) => n.id)), [displayNodes]);

  const displayEdges = useMemo(() => {
    return storeEdges
      .filter((e) => e.project_id === projectId)
      .filter((e) => displayNodeIds.has(e.source_id) && displayNodeIds.has(e.target_id));
  }, [storeEdges, projectId, displayNodeIds]);

  const flowNodes = useMemo(() => displayNodes.map((n) => {
    let relevance = 0.5;
    let kind: string | undefined;
    try {
      const meta = JSON.parse(n.metadata || '{}');
      if (typeof meta.relevance === 'number') relevance = meta.relevance;
      if (typeof meta.kind === 'string') kind = meta.kind;
    } catch {}
    return {
      id: n.id,
      type: 'knowledgeNode',
      position: { x: n.x, y: n.y },
      data: {
        label: n.label,
        category: n.category as NodeCategory,
        color: n.color,
        relevance,
        domain: n.domain || 'conversation',
        kind,
      },
    };
  }), [displayNodes]);

  const flowEdges = useMemo(() => displayEdges.map((e) => {
    const isBridge = e.edge_type === 'bridge';
    const isStructural = e.edge_type === 'structural';
    return {
      id: e.id,
      source: e.source_id,
      target: e.target_id,
      label: e.label || undefined,
      style: isBridge
        ? { stroke: '#10B981', strokeDasharray: '5,5', strokeWidth: 2 }
        : isStructural
        ? { stroke: '#71717A', strokeWidth: 1.5 }
        : { stroke: '#D4D4D8', strokeWidth: 1 },
      animated: isBridge,
    };
  }), [displayEdges]);

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
    <div className="h-full flex flex-col">
      {/* Top Filter Toolbar */}
      <div className="px-6 py-2 border-b border-zinc-100 flex items-center justify-between bg-white text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mr-2">Layer:</span>
          {(['all', 'code', 'conversation'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setDomainFilter(filter)}
              className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                domainFilter === filter
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {filter === 'all' ? 'All (Hybrid)' : filter === 'code' ? 'Code AST' : 'Decisions & Intent'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScanCodebase}
            disabled={isScanningCode}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md border border-emerald-200 transition-colors shadow-xs font-medium disabled:opacity-50"
            title="Scan linked folder and build code AST graph"
          >
            {isScanningCode ? (
              <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
            ) : (
              <Code2 className="h-3 w-3 text-emerald-600" />
            )}
            {isScanningCode ? 'Scanning...' : 'Scan Codebase'}
          </button>

          <button
            onClick={handleAutoBridge}
            disabled={isBridging || isScanningCode}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-md border border-amber-200 transition-colors shadow-xs font-medium disabled:opacity-50"
            title="Auto-match decisions and concepts to code functions via bridge edges"
          >
            {isBridging ? (
              <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
            ) : (
              <Sparkles className="h-3 w-3 text-amber-600" />
            )}
            {isBridging ? 'Bridging...' : 'Auto-Bridge'}
          </button>

          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1.5 px-3 py-1 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md border border-zinc-200 transition-colors shadow-xs"
            title="Auto Layout"
          >
            <Wand2 className="h-3 w-3" />
            Auto Layout
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        {flowNodes.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            No graph nodes found for this layer.
          </div>
        ) : (
          <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e4e4e7" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
