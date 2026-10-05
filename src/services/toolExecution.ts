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
  },
  {
    type: 'function',
    function: {
      name: 'read_workspace_file',
      description: 'Read the contents of a specific file in the workspace linked directory. Path can be relative to workspace root (e.g. "src/App.tsx") or absolute.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The file path to read (relative to workspace or absolute).'
          },
          start_line: {
            type: 'number',
            description: 'Optional line number to start reading from (1-indexed).'
          },
          end_line: {
            type: 'number',
            description: 'Optional line number to stop reading at.'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_workspace_code',
      description: 'Search for text, code snippets, or symbol names across all files in the linked workspace directory.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search string, symbol name, or keyword.'
          },
          root_path: {
            type: 'string',
            description: 'Optional workspace directory path to search (defaults to project workspace folder).'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_workspace_files',
      description: 'List files and directories within the linked workspace directory or a subfolder.',
      parameters: {
        type: 'object',
        properties: {
          subpath: {
            type: 'string',
            description: 'Optional subfolder path relative to workspace root (e.g. "src" or "components").'
          }
        }
      }
    }
  }
];

export async function executeToolCall(toolCall: ToolCall, activeFolderPath?: string | null): Promise<string> {
  try {
    let args: Record<string, any> = {};
    if (typeof toolCall.function.arguments === 'string') {
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }
    } else if (toolCall.function.arguments && typeof toolCall.function.arguments === 'object') {
      args = { ...toolCall.function.arguments };
    }

    if (activeFolderPath) {
      if (!args.root_path) args.root_path = activeFolderPath;
      if (!args.project_folder) args.project_folder = activeFolderPath;
      if (!args.folder_path) args.folder_path = activeFolderPath;
    }

    const result = await invoke<any>('execute_tool', { 
      name: toolCall.function.name, 
      arguments: args
    });
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}
