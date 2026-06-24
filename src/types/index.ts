// ─── Core Types ───────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  title: string;
  tag?: string;
  model_id?: string;
  provider_id?: string;
  is_pinned: boolean;
  preview?: string;
  project_id?: string;
  summary?: string;
  summary_updated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  color?: string;
  is_pinned: boolean;
  last_opened_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  name: string;
  ext?: string;
  size: number;
  content_text: string;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_id?: string;
  created_at: string;
  sort_order: number;
  parent_id?: string | null;
}

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  source_session?: string;
  created_at: string;
  updated_at: string;
}

export type MemoryCategory = 'PREFERENCE' | 'CONTEXT' | 'INTEREST' | 'TOOLING';

export interface GraphNode {
  id: string;
  label: string;
  category: NodeCategory;
  color?: string;
  x: number;
  y: number;
  metadata: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

export interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  label?: string;
  metadata: string;
  project_id?: string;
  created_at: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type NodeCategory = 'CONCEPT' | 'READING' | 'CORE' | 'IDEA' | 'ESSAY' | 'RESEARCH' | 'DESIGN';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  endpoint: string;
  api_key?: string;
  is_default: boolean;
  config_json: string;
  created_at: string;
  updated_at: string;
}

export type ProviderType = 'ollama' | 'openai_compat' | 'lmstudio' | 'localai' | 'vllm';

export interface Setting {
  key: string;
  value: string;
}

// ─── LLM Provider Interface ───────────────────────────────────────────────────

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  providerId: string;
  size?: string;
  contextLength?: number;
  vendor?: string;
  pulledAt?: string;
  isLocal: boolean;
  isActive?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  done: boolean;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface HealthCheckResult {
  connected: boolean;
  version?: string;
  error?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  type: ProviderType;
  endpoint: string;
  isConnected(): Promise<boolean>;
  healthCheck(): Promise<HealthCheckResult>;
  listModels(): Promise<ModelInfo[]>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat(request: ChatRequest, onChunk: (chunk: StreamChunk) => void, signal?: AbortSignal): Promise<void>;
}

// ─── UI State Types ───────────────────────────────────────────────────────────

export interface AppSettings {
  ollama_host: string;
  ollama_num_ctx: number;
  auto_remember: boolean;
  show_graph_panel: boolean;
  anonymous_telemetry: boolean;
  theme: string;
  extraction_model: string;
}

export type SessionTag = 'RESEARCH' | 'WRITING' | 'READING' | 'DESIGN' | 'CODING' | 'OTHER';

export const SESSION_TAGS: SessionTag[] = ['RESEARCH', 'WRITING', 'READING', 'DESIGN', 'CODING', 'OTHER'];

export const NODE_CATEGORIES: NodeCategory[] = ['CONCEPT', 'READING', 'CORE', 'IDEA', 'ESSAY', 'RESEARCH', 'DESIGN'];

export const NODE_CATEGORY_COLORS: Record<NodeCategory, string> = {
  CONCEPT:  '#5A67D8',
  READING:  '#E8853D',
  CORE:     '#1A1A1A',
  IDEA:     '#9F5AD8',
  ESSAY:    '#38A169',
  RESEARCH: '#3B82F6',
  DESIGN:   '#1E3A5F',
};

export const MEMORY_CATEGORIES: MemoryCategory[] = ['PREFERENCE', 'CONTEXT', 'INTEREST', 'TOOLING'];
