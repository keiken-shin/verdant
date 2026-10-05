import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage, LLMProvider, Project, ProjectFile, Session, Message } from '@/types';
import { parseThinking } from '@/utils';

// We use a heuristic of ~4 chars per token.
// Local models have small windows, so we cap the total injected context.
const MAX_FILE_CHARS = 4000;
const MAX_SUMMARY_CHARS = 600;

const SUMMARY_PROMPT = `You summarize a chat conversation for future reference.
Write 2-4 sentences capturing the key topics, questions, decisions, and conclusions.
Be specific and factual. Return only the summary text, no preamble.`;

/** One LLM call to summarize a single session's conversation. */
export async function summarizeSession(
  messages: ChatMessage[],
  provider: LLMProvider,
  modelId: string
): Promise<string> {
  const conversationText = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const content = m.role === 'assistant' ? parseThinking(m.content).content : m.content;
      return `${m.role === 'user' ? 'User' : 'Assistant'}: ${content}`;
    })
    .join('\n\n');

  const response = await provider.chat({
    model: modelId,
    messages: [
      { role: 'system', content: SUMMARY_PROMPT },
      { role: 'user', content: `Summarize this conversation:\n\n${conversationText}` },
    ],
    stream: false,
  });

  return parseThinking(response.content).content.trim();
}

function isStale(s: Session): boolean {
  if (!s.summary || !s.summary_updated_at) return true;
  return new Date(s.summary_updated_at).getTime() < new Date(s.updated_at).getTime();
}

const FILE_SUMMARY_PROMPT = `You are a technical assistant. Summarize the following file contents for future reference.
Provide a concise, high-level overview of what this file is, its purpose, and its key components or functions.
Return only the summary text, no preamble or conversational filler.`;

export async function summarizeFile(
  fileText: string,
  provider: LLMProvider,
  modelId: string
): Promise<string> {
  const response = await provider.chat({
    model: modelId,
    messages: [
      { role: 'system', content: FILE_SUMMARY_PROMPT },
      { role: 'user', content: `File contents:\n\n${fileText.slice(0, 16000)}` },
    ],
    stream: false,
  });

  return parseThinking(response.content).content.trim();
}

export interface ProjectWorkspaceSummary {
  folder_path: string;
  total_files: number;
  file_list: string[];
  manifest_filename?: string;
  manifest_content?: string;
}

export interface ReferencedFile {
  file_path: string;
  content: string;
}

/** Assemble the project system message from instructions + workspace files + KB files + sibling summaries + RAG chunks. */
export function buildProjectSystemMessage(
  project: Project,
  files: (ProjectFile & { content_text?: string })[],
  siblingSummaries: { title: string; summary: string }[],
  relevantCodeChunks: { file_path: string; chunk_text: string; start_line: number; end_line: number }[] = [],
  workspaceSummary?: ProjectWorkspaceSummary | null,
  referencedFiles: ReferencedFile[] = [],
  budgetChars: number = 14000
): string {
  const parts: string[] = [];

  if (project.instructions?.trim()) {
    parts.push(`# Project: ${project.name}\n${project.instructions.trim()}`);
  } else {
    parts.push(`# Project: ${project.name}`);
  }
  if (project.description?.trim()) {
    parts.push(project.description.trim());
  }

  if (project.folder_path?.trim()) {
    const totalFiles = workspaceSummary?.total_files || (workspaceSummary?.file_list?.length ?? 0);
    parts.push(`## Linked Workspace Directory\nLocal Path: \`${project.folder_path.trim()}\` (${totalFiles} code/text files)\nYou are a pair programming co-worker on this local codebase. You have access to tools such as \`read_workspace_file\`, \`search_workspace_code\`, and \`list_workspace_files\` to inspect and search files on demand.`);

    if (workspaceSummary?.manifest_filename && workspaceSummary?.manifest_content) {
      parts.push(`### Workspace Overview / Manifest (\`${workspaceSummary.manifest_filename}\`):\n\`\`\`\n${workspaceSummary.manifest_content}\n\`\`\``);
    }

    if (workspaceSummary?.file_list && workspaceSummary.file_list.length > 0) {
      const fileLines = workspaceSummary.file_list.map((f) => `- ${f}`).join('\n');
      parts.push(`### Workspace File Tree:\nThe following files are present in the linked repository folder:\n${fileLines}`);
    }
  }

  if (referencedFiles.length > 0) {
    const fileBlocks = referencedFiles.map((rf) =>
      `### File: \`${rf.file_path}\`\n\`\`\`\n${rf.content.slice(0, 3500)}\n\`\`\``
    );
    parts.push(`# Explicitly Referenced Workspace Files\n${fileBlocks.join('\n\n')}`);
  }

  if (relevantCodeChunks.length > 0) {
    const codeBlocks = relevantCodeChunks.map(c => 
      `### \`${c.file_path}\` (Lines ${c.start_line}-${c.end_line}):\n\`\`\`\n${c.chunk_text.slice(0, 2000)}\n\`\`\``
    );
    parts.push(`# Relevant Code Chunks (RAG)\n${codeBlocks.join('\n\n')}`);
  }

  const fileBlocks = files
    .filter((f) => f.content_text?.trim() || f.summary?.trim())
    .map((f) => {
      if (f.include_mode === 'summary' && f.summary?.trim()) {
        return `## File Summary: ${f.name}\n${f.summary}`;
      }
      return `## File: ${f.name}\n${f.content_text!.slice(0, MAX_FILE_CHARS)}`;
    });
  if (fileBlocks.length) {
    parts.push(`# Knowledge base\n${fileBlocks.join('\n\n')}`);
  }

  const summaryBlocks = siblingSummaries
    .filter((s) => s.summary.trim())
    .map((s) => `- ${s.title}: ${s.summary.slice(0, MAX_SUMMARY_CHARS)}`);
  if (summaryBlocks.length) {
    parts.push(`# Earlier sessions in this project\n${summaryBlocks.join('\n')}`);
  }

  // Assembly with budget checking
  let finalMessage = parts.join('\n\n');
  if (finalMessage.length > budgetChars) {
    finalMessage = finalMessage.slice(0, budgetChars) + '\n\n[SYSTEM WARNING: Project context truncated due to model context limits.]';
  }

  return finalMessage;
}

/**
 * Build the full project context string to inject as a system message.
 * Lazily summarizes any sibling session whose cached summary is stale, persists
 * the result, and returns the assembled message (or null if there's nothing to add).
 */
export async function buildProjectContext(opts: {
  project: Project;
  files: ProjectFile[];
  currentSessionId: string | null;
  provider: LLMProvider;
  modelId: string;
  budgetTokens?: number;
  relevantCodeChunks?: { file_path: string; chunk_text: string; start_line: number; end_line: number }[];
  userMessage?: string;
}): Promise<string | null> {
  const { project, files, currentSessionId, provider, modelId, relevantCodeChunks = [], userMessage } = opts;

  let workspaceSummary: ProjectWorkspaceSummary | null = null;
  const referencedFiles: ReferencedFile[] = [];

  if (project.folder_path) {
    try {
      workspaceSummary = await invoke<ProjectWorkspaceSummary>('get_project_workspace_summary', {
        projectId: project.id,
      });

      // Pre-fetch files mentioned in the user's message
      if (userMessage && workspaceSummary?.file_list) {
        const msgLower = userMessage.toLowerCase();
        for (const relPath of workspaceSummary.file_list) {
          const fileName = relPath.split('/').pop()?.toLowerCase();
          if (
            (fileName && fileName.length >= 3 && msgLower.includes(fileName)) ||
            msgLower.includes(relPath.toLowerCase())
          ) {
            try {
              const content = await invoke<string>('read_project_file_content', {
                projectId: project.id,
                relativePath: relPath,
              });
              if (content) {
                referencedFiles.push({ file_path: relPath, content });
              }
            } catch (err) {
              console.warn(`[Workspace] Failed to pre-fetch file ${relPath}:`, err);
            }
            if (referencedFiles.length >= 3) break;
          }
        }
      }
    } catch (e) {
      console.warn('[Workspace] Failed to get workspace summary:', e);
    }
  }

  const siblings = (await invoke<Session[]>('get_project_sessions', { projectId: project.id }))
    .filter((s) => s.id !== currentSessionId);

  const summaries: { title: string; summary: string }[] = [];
  for (const s of siblings) {
    if (!isStale(s)) {
      summaries.push({ title: s.title, summary: s.summary! });
      continue;
    }
    try {
      const msgs = await invoke<Message[]>('get_messages', { sessionId: s.id });
      if (msgs.length === 0) continue;
      const chatMsgs: ChatMessage[] = msgs.map((m) => ({ role: m.role, content: m.content }));
      const summary = await summarizeSession(chatMsgs, provider, modelId);
      if (summary) {
        await invoke('set_session_summary', { id: s.id, summary });
        summaries.push({ title: s.title, summary });
      }
    } catch (e) {
      console.error(`Failed to summarize session ${s.id}:`, e);
    }
  }

  const filesWithContent = await Promise.all(
    files
      .filter((f) => f.include_mode !== 'reference')
      .map(async (f) => {
        try {
          const text = await invoke<string>('read_object_text', { id: f.object_id });
          return { ...f, content_text: text };
        } catch (e) {
          console.error(`Failed to read object ${f.object_id}:`, e);
          return { ...f, content_text: '' };
        }
      })
  );

  const hasContext =
    project.instructions?.trim() ||
    project.description?.trim() ||
    project.folder_path?.trim() ||
    filesWithContent.some((f) => f.content_text?.trim() || f.summary?.trim()) ||
    summaries.length > 0;
  if (!hasContext) return null;

  const budgetChars = (opts.budgetTokens || 3500) * 4;
  return buildProjectSystemMessage(
    project,
    filesWithContent,
    summaries,
    relevantCodeChunks,
    workspaceSummary,
    referencedFiles,
    budgetChars
  );
}
