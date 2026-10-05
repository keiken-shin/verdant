/**
 * System-1 Decision Layer Service (Ollama /v1/systemone)
 *
 * Provides sub-40ms decision gating for:
 * 1. Determining if a chat message contains concrete architectural decisions
 * 2. Routing queries to decide if codebase retrieval (RAG) is needed
 * 3. Matching conversation decisions to codebase functions/symbols (bridge edges)
 */

export interface SystemOneQuestion {
  type: 'bool' | 'enum' | 'text';
  instructions?: string;
  options?: string[];
}

export interface SystemOneResponse {
  decisions: Record<string, {
    answer: string | boolean;
    confidence?: number;
  }>;
}

/**
 * Call the Ollama /v1/systemone endpoint.
 * Returns null if System-1 is unavailable or disabled.
 */
export async function querySystemOne(
  endpoint: string,
  model: string,
  state: string,
  questions: Record<string, SystemOneQuestion>,
  images?: string[]
): Promise<SystemOneResponse | null> {
  const url = `${endpoint.replace(/\/+$/, '')}/v1/systemone`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'clef-flash',
        state,
        questions,
        images: images && images.length > 0 ? images : undefined,
      }),
    });

    if (!res.ok) {
      console.warn(`[SystemOne] Endpoint returned ${res.status}: ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    return data;
  } catch (e) {
    console.warn('[SystemOne] Failed to query System-1 decision model:', e);
    return null;
  }
}

/**
 * Fast router: Check whether the user message requires codebase retrieval (RAG).
 */
export async function shouldRetrieveCodeContext(
  endpoint: string,
  model: string,
  userMessage: string
): Promise<boolean> {
  const questions: Record<string, SystemOneQuestion> = {
    needs_code: {
      type: 'bool',
      instructions: 'Does this message ask about, reference, or require inspecting the codebase, files, functions, implementation details, or code architecture?',
    },
  };

  const res = await querySystemOne(endpoint, model, userMessage, questions);
  if (!res || !res.decisions) {
    // Fallback: If System-1 is not responding or disabled, return true to retrieve
    return true;
  }

  return Boolean(res.decisions.needs_code?.answer);
}

/**
 * Fast check: Does this message express a concrete architectural or technical decision?
 */
export async function detectChatDecision(
  endpoint: string,
  model: string,
  messageText: string
): Promise<{ hasDecision: boolean; category?: string; summary?: string }> {
  const questions: Record<string, SystemOneQuestion> = {
    has_decision: {
      type: 'bool',
      instructions: 'Did the user or assistant make or finalize a concrete technical, code design, or architecture decision?',
    },
    category: {
      type: 'enum',
      options: ['ARCHITECTURE', 'STORAGE', 'API', 'UI', 'SECURITY', 'REFACTOR', 'NONE'],
    },
  };

  const res = await querySystemOne(endpoint, model, messageText, questions);
  if (!res || !res.decisions) {
    // Fallback: heuristic regex
    const hasMatch = /\b(let'?s (use|switch|implement|change|replace|choose)|decided to|we should use)\b/i.test(messageText);
    return { hasDecision: hasMatch };
  }

  const hasDecision = Boolean(res.decisions.has_decision?.answer);
  const category = res.decisions.category?.answer as string | undefined;

  return {
    hasDecision,
    category: category !== 'NONE' ? category : undefined,
  };
}

/**
 * Fast bridge matcher: Connects a conversation decision to a candidate code symbol
 */
export async function matchDecisionToSymbol(
  endpoint: string,
  model: string,
  decisionText: string,
  candidateSymbols: string[]
): Promise<{ matchedSymbol: string | null; relation: 'affects' | 'implements' | 'refactors' | 'replaces' }> {
  if (candidateSymbols.length === 0) {
    return { matchedSymbol: null, relation: 'affects' };
  }

  const options = [...candidateSymbols.slice(0, 15), 'NONE'];
  const questions: Record<string, SystemOneQuestion> = {
    target_symbol: {
      type: 'enum',
      options,
      instructions: 'Which code symbol or function is directly affected or referenced by this decision?',
    },
    relation: {
      type: 'enum',
      options: ['affects', 'implements', 'refactors', 'replaces'],
    },
  };

  const res = await querySystemOne(endpoint, model, decisionText, questions);
  if (!res || !res.decisions) {
    // Fallback: substring matching
    const found = candidateSymbols.find((sym) => decisionText.toLowerCase().includes(sym.toLowerCase()));
    return { matchedSymbol: found || null, relation: 'affects' };
  }

  const target = res.decisions.target_symbol?.answer as string;
  const relation = (res.decisions.relation?.answer as any) || 'affects';

  return {
    matchedSymbol: target && target !== 'NONE' ? target : null,
    relation,
  };
}
