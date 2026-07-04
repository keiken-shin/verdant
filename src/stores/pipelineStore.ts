import { create } from 'zustand';
import { 
  Connection, 
  Edge, 
  EdgeChange, 
  Node, 
  NodeChange, 
  addEdge, 
  OnNodesChange, 
  OnEdgesChange, 
  OnConnect,
  applyNodeChanges, 
  applyEdgeChanges 
} from 'reactflow';

export type PipelineNodeType = 'inputNode' | 'llmNode' | 'outputNode';

export interface PipelineNodeData {
  label: string;
  content?: string;
  modelId?: string;
  systemPrompt?: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  result?: string;
}

export type PipelineNode = Node<PipelineNodeData>;

interface PipelineState {
  nodes: PipelineNode[];
  edges: Edge[];
  isRunning: boolean;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: PipelineNode) => void;
  updateNodeData: (id: string, data: Partial<PipelineNodeData>) => void;
  setNodes: (nodes: PipelineNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  setIsRunning: (isRunning: boolean) => void;
}

const initialNodes: PipelineNode[] = [
  {
    id: 'node-1',
    type: 'inputNode',
    position: { x: 100, y: 100 },
    data: { label: 'Input', content: 'Enter your initial text here...' },
  },
  {
    id: 'node-2',
    type: 'llmNode',
    position: { x: 400, y: 100 },
    data: { label: 'LLM Processor', systemPrompt: 'Summarize the input in 3 bullet points.', status: 'idle' },
  },
  {
    id: 'node-3',
    type: 'outputNode',
    position: { x: 700, y: 100 },
    data: { label: 'Output', result: '' },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'node-1', target: 'node-2' },
  { id: 'e2-3', source: 'node-2', target: 'node-3' },
];

export const usePipelineStore = create<PipelineState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  isRunning: false,

  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },
  addNode: (node: PipelineNode) => {
    set({ nodes: [...get().nodes, node] });
  },
  updateNodeData: (id: string, data: Partial<PipelineNodeData>) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      }),
    });
  },
  setNodes: (nodes: PipelineNode[]) => {
    set({ nodes });
  },
  setEdges: (edges: Edge[]) => {
    set({ edges });
  },
  setIsRunning: (isRunning: boolean) => {
    set({ isRunning });
  },
}));
