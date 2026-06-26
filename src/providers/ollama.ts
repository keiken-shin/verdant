import { fetch } from '@tauri-apps/plugin-http';
import { useSettingsStore } from '@/stores/settingsStore';
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
    tool_calls?: any[];
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

    const models: ModelInfo[] = data.models.map((m) => ({
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
      capabilities: [],
    }));

    await Promise.all(models.map(async (m) => {
      try {
        const showRes = await fetch(`${this.endpoint}/api/show`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: m.id })
        });
        if (showRes.ok) {
          const showData = await showRes.json() as any;
          m.capabilities = showData.capabilities || [];
          const ctxKey = Object.keys(showData.model_info || {}).find(k => k.endsWith('.context_length'));
          if (ctxKey) m.contextLength = showData.model_info[ctxKey];
        }
      } catch (e) {
        // ignore
      }
    }));

    return models;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        tools: request.tools,
        options: { num_ctx: useSettingsStore.getState().settings.ollama_num_ctx || 32768 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: HTTP ${response.status}`);
    }

    const data = await response.json() as OllamaChatResponse & { message: { reasoning_content?: string, thinking?: string } };
    
    let finalContent = "";
    const thinkingText = data.message?.reasoning_content || data.message?.thinking;
    if (thinkingText) {
      finalContent += `<think>\n${thinkingText}\n</think>\n\n`;
    }
    finalContent += data.message.content;

    return {
      content: finalContent,
      model: data.model,
      done: data.done,
      tool_calls: data.message?.tool_calls,
    } as ChatResponse;
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
        tools: request.tools,
        options: { num_ctx: useSettingsStore.getState().settings.ollama_num_ctx || 32768 },
      }),
      signal,
    });

    if (!response.ok) {
      let errorText = `HTTP ${response.status}`;
      try {
        const bodyText = await response.text();
        try {
          const errJson = JSON.parse(bodyText);
          if (errJson.error) errorText = `${errorText} - ${errJson.error}`;
          else errorText = `${errorText} - ${bodyText}`;
        } catch (e) {
          errorText = `${errorText} - ${bodyText}`;
        }
      } catch (e) {}
      throw new Error(`Stream chat failed: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let isThinking = false;
    let thinkingEnded = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as OllamaChatResponse & { message: { reasoning_content?: string, thinking?: string } };
          
          let chunkText = "";
          const thinkingText = chunk.message?.reasoning_content || chunk.message?.thinking;
          
          if (thinkingText) {
             if (!isThinking) {
                isThinking = true;
                chunkText += "<think>\n";
             }
             chunkText += thinkingText;
          }
          
          if (chunk.message?.content) {
             if (isThinking && !thinkingEnded) {
                thinkingEnded = true;
                chunkText += "\n</think>\n\n";
             }
             chunkText += chunk.message.content;
          }

          onChunk({
            content: chunkText,
            done: chunk.done,
            prompt_eval_count: (chunk as any).prompt_eval_count,
            eval_count: (chunk as any).eval_count,
            tool_calls: chunk.message?.tool_calls,
          });
          if (chunk.done) {
             // ensure we close the tag if it ended abruptly
             if (isThinking && !thinkingEnded) {
               onChunk({ content: "\n</think>\n", done: true });
             }
             return;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  }
}
