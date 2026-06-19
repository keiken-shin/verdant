import { fetch } from '@tauri-apps/plugin-http';
import type {
  LLMProvider,
  ModelInfo,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  HealthCheckResult,
  OllamaModel,
} from '@/types';

interface OllamaTagsResponse {
  models: OllamaModel[];
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason?: string;
}

function formatModelSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}MB`;
}

function extractParamSize(details: OllamaModel['details']): string | undefined {
  if (details.parameter_size) return details.parameter_size;
  return undefined;
}

export class OllamaProvider implements LLMProvider {
  id: string;
  name: string;
  type: 'ollama' = 'ollama';
  endpoint: string;

  constructor(id: string, endpoint: string) {
    this.id = id;
    this.name = 'Ollama';
    this.endpoint = endpoint.replace(/\/$/, '');
  }

  async isConnected(): Promise<boolean> {
    const result = await this.healthCheck();
    return result.connected;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const response = await fetch(`${this.endpoint}/api/version`, {
        method: 'GET',
        connectTimeout: 5000,
      });
      if (response.ok) {
        const data = await response.json() as { version: string };
        return { connected: true, version: data.version };
      }
      return { connected: false, error: `HTTP ${response.status}` };
    } catch (e) {
      return { connected: false, error: String(e) };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.endpoint}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: HTTP ${response.status}`);
    }

    const data = await response.json() as OllamaTagsResponse;

    return data.models.map((m) => ({
      id: m.name,
      name: m.name,
      displayName: m.name.split(':')[0],
      provider: 'Ollama',
      providerId: this.id,
      size: m.size ? formatModelSize(m.size) : extractParamSize(m.details),
      contextLength: undefined,
      vendor: m.details.family || undefined,
      pulledAt: m.modified_at,
      isLocal: true,
    }));
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: HTTP ${response.status}`);
    }

    const data = await response.json() as OllamaChatResponse;
    return {
      content: data.message.content,
      model: data.model,
      done: data.done,
    };
  }

  async streamChat(
    request: ChatRequest,
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Stream chat failed: HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as OllamaChatResponse;
          onChunk({
            content: chunk.message?.content || '',
            done: chunk.done,
          });
          if (chunk.done) return;
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  }
}
