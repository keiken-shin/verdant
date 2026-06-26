import { invoke } from '@tauri-apps/api/core';
import type { ToolCall, ToolDefinition } from '@/types';

export const availableTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for up-to-date information. Use this to find recent news, facts, or data not in your training set.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to look up.'
          }
        },
        required: ['query']
      }
    }
  }
];

export async function executeToolCall(toolCall: ToolCall): Promise<string> {
  try {
    const result = await invoke<any>('execute_tool', { 
      name: toolCall.function.name, 
      arguments: toolCall.function.arguments || {}
    });
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
