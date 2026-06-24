import { invoke } from '@tauri-apps/api/core';
import type { ChatMessage, LLMProvider, Project, ProjectFile, Session, Message } from '@/types';
import { parseThinking } from '@/utils';

// Char budgets for injected project context. Local models have small windows,
// so we truncate per-part and hard-cap the total.
// ponytail: char-budget truncation; swap to token-aware/relevance-ranked if budgets bite.
const MAX_FILE_CHARS = 4000;
const MAX_SUMMARY_CHARS = 600;
const MAX_TOTAL_CHARS = 12000;

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

/** Assemble the project system message from instructions + KB files + sibling summaries. */
export function buildProjectSystemMessage(
  project: Project,
  files: ProjectFile[],
  siblingSummaries: { title: string; summary: string }[]
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

  const fileBlocks = files
    .filter((f) => f.content_text.trim())
    .map((f) => `## File: ${f.name}\n${f.content_text.slice(0, MAX_FILE_CHARS)}`);
  if (fileBlocks.length) {
    parts.push(`# Knowledge base\n${fileBlocks.join('\n\n')}`);
  }

  const summaryBlocks = siblingSummaries
    .filter((s) => s.summary.trim())
    .map((s) => `- ${s.title}: ${s.summary.slice(0, MAX_SUMMARY_CHARS)}`);
  if (summaryBlocks.length) {
    parts.push(`# Earlier sessions in this project\n${summaryBlocks.join('\n')}`);
  }

  // Hard cap guarantees the injected message never exceeds the budget.
  return parts.join('\n\n').slice(0, MAX_TOTAL_CHARS);
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
}): Promise<string | null> {
  const { project, files, currentSessionId, provider, modelId } = opts;

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

  const hasContext =
    project.instructions?.trim() ||
    project.description?.trim() ||
    files.some((f) => f.content_text.trim()) ||
    summaries.length > 0;
  if (!hasContext) return null;

  return buildProjectSystemMessage(project, files, summaries);
}
