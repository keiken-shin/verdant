import React, { useCallback, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, Edge, Node, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { usePipelineStore, PipelineNode, PipelineNodeType } from '@/stores/pipelineStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProviderStore } from '@/stores/providerStore';
import { providerRegistry } from '@/providers/registry';

import { InputNode } from './nodes/InputNode';
import { LLMNode } from './nodes/LLMNode';
import { OutputNode } from './nodes/OutputNode';
import { PipelineSidebar } from './PipelineSidebar';
import { Play, Square } from 'lucide-react';

const nodeTypes = {
  inputNode: InputNode,
  llmNode: LLMNode,
  outputNode: OutputNode,
};

function PipelineCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeData,
    isRunning,
    setIsRunning,
  } = usePipelineStore();

  const { settings } = useSettingsStore();
  const { providers } = useProviderStore();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const type = event.dataTransfer.getData('application/reactflow') as PipelineNodeType;
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: PipelineNode = {
        id: `node-${Date.now()}`,
        type,
        position,
        data: { 
          label: type === 'inputNode' ? 'Input' : type === 'llmNode' ? 'LLM' : 'Output',
          status: 'idle'
        },
      };

      addNode(newNode);
    },
    [reactFlowInstance, addNode]
  );

  const executePipeline = async () => {
    if (isRunning) return;
    setIsRunning(true);
    
    // Topologically sort nodes
    const getNextNodes = (nodeId: string) => edges.filter(e => e.source === nodeId).map(e => e.target);
    const inDegree = new Map<string, number>();
    nodes.forEach(n => inDegree.set(n.id, 0));
    edges.forEach(e => inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1));
    
    const queue: string[] = [];
    inDegree.forEach((count, id) => {
      if (count === 0) queue.push(id);
    });

    const sortedIds: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sortedIds.push(current);
      getNextNodes(current).forEach(target => {
        inDegree.set(target, inDegree.get(target)! - 1);
        if (inDegree.get(target) === 0) queue.push(target);
      });
    }

    // Reset status
    nodes.forEach(n => updateNodeData(n.id, { status: 'idle', result: '' }));

    // Get Provider
    const defaultProvider = providers.find((p) => p.is_default) || providers[0];
    if (!defaultProvider) {
      setIsRunning(false);
      return;
    }
    const ollamaEndpoint = settings.ollama_host || defaultProvider.endpoint;
    const provider = providerRegistry.createOllama(defaultProvider.id, ollamaEndpoint);

    // Node Output map
    const nodeOutputs = new Map<string, string>();

    // Execute
    for (const nodeId of sortedIds) {
      const node = usePipelineStore.getState().nodes.find(n => n.id === nodeId);
      if (!node) continue;

      try {
        updateNodeData(nodeId, { status: 'running' });

        // Get inputs from previous nodes
        const prevEdges = edges.filter(e => e.target === nodeId);
        const inputs = prevEdges.map(e => nodeOutputs.get(e.source)).filter(Boolean);
        const aggregatedInput = inputs.join('\n\n');

        if (node.type === 'inputNode') {
          nodeOutputs.set(nodeId, node.data.content || '');
          updateNodeData(nodeId, { status: 'success' });
        } else if (node.type === 'llmNode') {
          const modelId = node.data.modelId || 'llama3';
          const systemPrompt = node.data.systemPrompt || '';
          
          let result = '';
          const messages = [];
          if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
          messages.push({ role: 'user', content: aggregatedInput });
          
          await provider.streamChat(
            { model: modelId, messages: messages as any, stream: true },
            (chunk) => {
              if (chunk.content) {
                result += chunk.content;
                updateNodeData(nodeId, { result });
              }
            }
          );
          
          nodeOutputs.set(nodeId, result);
          updateNodeData(nodeId, { status: 'success' });
        } else if (node.type === 'outputNode') {
          updateNodeData(nodeId, { result: aggregatedInput, status: 'success' });
          nodeOutputs.set(nodeId, aggregatedInput);
        }
      } catch (err: any) {
        console.error("Pipeline Error:", err);
        updateNodeData(nodeId, { status: 'error', result: err.message || 'Error occurred' });
        setIsRunning(false);
        return;
      }
    }
    
    setIsRunning(false);
  };

  return (
    <div className="flex h-full w-full bg-zinc-50 relative">
      <PipelineSidebar />
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <div className="absolute top-4 right-4 z-10">
          <button 
            onClick={executePipeline}
            disabled={isRunning}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            {isRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            {isRunning ? 'Running...' : 'Run Pipeline'}
          </button>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#ccc" gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export function PipelineEditor() {
  return (
    <ReactFlowProvider>
      <PipelineCanvas />
    </ReactFlowProvider>
  );
}
