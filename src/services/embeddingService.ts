import { invoke } from '@tauri-apps/api/core';

export interface CodeChunk {
  file_path: string;
  chunk_text: string;
  start_line: number;
  end_line: number;
  embedding?: number[];
}

export interface ChunkSearchResult {
  file_path: string;
  chunk_text: string;
  start_line: number;
  end_line: number;
  score: number;
}

/**
 * Fetch embedding vector from Ollama endpoint (/api/embeddings).
 */
export async function getOllamaEmbedding(
  endpoint: string,
  model: string,
  text: string
): Promise<number[] | null> {
  const url = `${endpoint.replace(/\/+$/, '')}/api/embeddings`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'nomic-embed-text',
        prompt: text,
      }),
    });
    if (!res.ok) {
      console.warn(`[Embedding] Ollama embedding failed with status ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data.embedding || null;
  } catch (e) {
    console.warn('[Embedding] Failed to generate embedding from Ollama:', e);
    return null;
  }
}

/**
 * Split source code into logical chunks of roughly maxLines.
 */
export function chunkCodeFile(filePath: string, text: string, maxLines = 40): CodeChunk[] {
  const lines = text.split('\n');
  const chunks: CodeChunk[] = [];

  let start = 0;
  while (start < lines.length) {
    const end = Math.min(start + maxLines, lines.length);
    const chunkLines = lines.slice(start, end);
    const chunkText = chunkLines.join('\n').trim();

    if (chunkText.length > 20) {
      chunks.push({
        file_path: filePath,
        chunk_text: chunkText,
        start_line: start + 1,
        end_line: end,
      });
    }

    // 10 line overlap
    start += Math.max(1, maxLines - 10);
  }

  return chunks;
}

/**
 * Prepare chunks from codebase via Rust backend.
 */
export async function prepareProjectCodeChunks(projectId: string): Promise<CodeChunk[]> {
  return await invoke<CodeChunk[]>('prepare_project_code_chunks', { projectId });
}

/**
 * Get total count of indexed chunks for a project.
 */
export async function getCodeChunksCount(projectId: string): Promise<number> {
  return await invoke<number>('get_code_chunks_count', { projectId });
}

/**
 * Clear existing code chunks for a project.
 */
export async function clearProjectCodeChunks(projectId: string): Promise<void> {
  await invoke('clear_code_chunks', { projectId });
}

/**
 * Index a list of chunks into SQLite code_chunks table.
 */
export async function indexProjectCode(projectId: string, chunks: CodeChunk[]): Promise<number> {
  return await invoke<number>('index_code_chunks', {
    projectId,
    chunks,
  });
}

/**
 * Orchestrate full chunk extraction + Ollama embeddings + SQLite indexing.
 */
export async function indexCodebasePipeline(
  projectId: string,
  ollamaEndpoint: string,
  model: string,
  onProgress?: (current: number, total: number) => void
): Promise<{ indexedCount: number; error?: string }> {
  try {
    // 1. Prepare raw chunks from backend
    const chunks = await prepareProjectCodeChunks(projectId);
    if (!chunks || chunks.length === 0) {
      return { indexedCount: 0 };
    }

    // 2. Clear previous chunks
    await clearProjectCodeChunks(projectId);

    // 3. Batch embed and insert
    const batchSize = 4;
    let completed = 0;
    let indexedTotal = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const slice = chunks.slice(i, i + batchSize);
      const results = await Promise.all(
        slice.map(async (chunk) => {
          const emb = await getOllamaEmbedding(ollamaEndpoint, model, chunk.chunk_text);
          return {
            ...chunk,
            embedding: emb || undefined,
          };
        })
      );

      const withEmbeddings = results.filter((c) => c.embedding && c.embedding.length > 0);
      if (withEmbeddings.length > 0) {
        await indexProjectCode(projectId, withEmbeddings);
        indexedTotal += withEmbeddings.length;
      }

      completed += slice.length;
      if (onProgress) {
        onProgress(Math.min(completed, chunks.length), chunks.length);
      }
    }

    return { indexedCount: indexedTotal };
  } catch (e) {
    console.error('Failed to run indexCodebasePipeline:', e);
    return {
      indexedCount: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Semantic vector search over project code chunks.
 */
export async function searchProjectCodeVectors(
  projectId: string,
  queryEmbedding: number[],
  limit = 5
): Promise<ChunkSearchResult[]> {
  return await invoke<ChunkSearchResult[]>('search_code_chunks', {
    projectId,
    queryEmbedding,
    limit,
  });
}
