import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

/**
 * System-1 Decision Layer Service (Ollama /v1/systemone with /api/chat fallback)
 *
 * Provides sub-second decision gating for:
 * 1. Routing queries to decide if codebase retrieval (RAG) is needed
 * 2. Determining if a chat message contains concrete architectural decisions
 * 3. Matching conversation decisions to codebase functions/symbols (bridge edges)
 * 4. Selecting and prioritizing durable events/preferences for autonomous memory capture
 */

export interface SystemOneQuestion {
  type: 'bool' | 'enum' | 'text' | 'choice';
  instructions?: string;
  options?: string[];
  criteria?: Record<string, string>;
}

export interface SystemOneResponse {
  decisions: Record<string, {
    answer: string | boolean;
    confidence?: number;
    probabilities?: Record<string, number>;
  }>;
}

export interface EvaluatedMemory {
  shouldStore: boolean;
  category: 'PREFERENCE' | 'CONTEXT' | 'INTEREST' | 'TOOLING';
  importance: 'HIGH' | 'MEDIUM';
  content: string;
}

const getFetch = () => (typeof tauriFetch === 'function' ? tauriFetch : globalThis.fetch);

/**
 * Call the Ollama /v1/systemone endpoint.
 * Translates bool/enum to Ollama's choice format and normalizes responses.
 * Automatically falls back to /api/chat structured JSON if /v1/systemone is unsupported.
 */
export async function querySystemOne(
  endpoint: string,
  model: string,
  state: string,
  questions: Record<string, SystemOneQuestion>,
  images?: string[]
): Promise<SystemOneResponse | null> {
  const cleanEndpoint = endpoint.replace(/\/+$/, '');
  const url = `${cleanEndpoint}/v1/systemone`;
  const fetchFn = getFetch();

  // Format questions into Ollama /v1/systemone choice criteria
  const formattedQuestions: Record<string, { type: string; criteria: Record<string, string> }> = {};
  for (const [key, q] of Object.entries(questions)) {
    if (q.type === 'bool') {
      formattedQuestions[key] = {
        type: 'choice',
        criteria: {
          yes: q.instructions || 'Yes / True condition met',
          no: 'No / False condition not met',
        },
      };
    } else if (q.type === 'choice' && q.criteria) {
      formattedQuestions[key] = {
        type: 'choice',
        criteria: q.criteria,
      };
    } else if (q.type === 'enum' && q.options) {
      const criteria: Record<string, string> = {};
      for (const opt of q.options) {
        criteria[opt] = `${opt} option`;
      }
      formattedQuestions[key] = {
        type: 'choice',
        criteria,
      };
    } else {
      // Default binary choice
      formattedQuestions[key] = {
        type: 'choice',
        criteria: {
          yes: q.instructions || 'Yes',
          no: 'No',
        },
      };
    }
  }

  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'clef',
        state,
        questions: formattedQuestions,
        images: images && images.length > 0 ? images : undefined,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const rawAnswers = (data.answers || data.decisions || {}) as Record<string, any>;
      const decisions: SystemOneResponse['decisions'] = {};

      for (const [key, val] of Object.entries(rawAnswers)) {
        const choice = val.choice ?? val.answer;
        let mappedAnswer: string | boolean = choice;
        if (choice === 'yes') mappedAnswer = true;
        if (choice === 'no') mappedAnswer = false;

        decisions[key] = {
          answer: mappedAnswer,
          confidence: val.confidence,
          probabilities: val.probabilities,
        };
      }
      return { decisions };
    }

    // If /v1/systemone returns 404 or fails, fall back to /api/chat structured JSON
    console.warn(`[SystemOne] /v1/systemone returned ${res.status}, falling back to /api/chat`);
    return await querySystemOneViaChatFallback(cleanEndpoint, model, state, questions);
  } catch (e) {
    console.warn('[SystemOne] Error calling /v1/systemone, trying /api/chat fallback:', e);
    return await querySystemOneViaChatFallback(cleanEndpoint, model, state, questions);
  }
}

/**
 * Resilient fallback: uses standard Ollama /api/chat with format: "json".
 */
async function querySystemOneViaChatFallback(
  endpoint: string,
  model: string,
  state: string,
  questions: Record<string, SystemOneQuestion>
): Promise<SystemOneResponse | null> {
  const url = `${endpoint}/api/chat`;
  const fetchFn = getFetch();

  const schemaMap: Record<string, string> = {};
  for (const [key, q] of Object.entries(questions)) {
    if (q.type === 'bool') {
      schemaMap[key] = 'boolean (true or false)';
    } else if (q.type === 'choice' && q.criteria) {
      schemaMap[key] = `one of [${Object.keys(q.criteria).join(', ')}]`;
    } else if (q.type === 'enum' && q.options) {
      schemaMap[key] = `one of [${q.options.join(', ')}]`;
    } else {
      schemaMap[key] = 'string';
    }
  }

  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3',
        messages: [
          {
            role: 'system',
            content: `You are a fast classification system. Analyze the given text and output a JSON object matching this schema:\n${JSON.stringify(schemaMap, null, 2)}\nRespond ONLY with the JSON object.`,
          },
          {
            role: 'user',
            content: state,
          },
        ],
        format: 'json',
        stream: false,
      }),
    });

    if (!res.ok) return null;
    const body = await res.json();
    const content = body.message?.content || '{}';
    const parsed = JSON.parse(content);
    const decisions: SystemOneResponse['decisions'] = {};

    for (const [k, v] of Object.entries(parsed)) {
      decisions[k] = { answer: v as string | boolean };
    }
    return { decisions };
  } catch (err) {
    console.warn('[SystemOne] Chat fallback failed:', err);
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
      type: 'choice',
      criteria: {
        retrieve: 'User asks to inspect files, functions, code logic, implementation details, repository structure, or technical code questions',
        no_retrieve: 'Casual greeting, general knowledge, conceptual question, or chit-chat not requiring codebase inspection',
      },
    },
  };

  const res = await querySystemOne(endpoint, model, userMessage, questions);
  if (!res || !res.decisions || !res.decisions.needs_code) {
    return true; // Default safe fallback
  }

  const ans = res.decisions.needs_code.answer;
  return ans === 'retrieve' || ans === true;
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
      type: 'choice',
      criteria: {
        decision: 'Concrete technical, code design, or architecture decision was made or confirmed',
        no_decision: 'No decision was made; general discussion, question, or exploration',
      },
    },
    category: {
      type: 'choice',
      criteria: {
        ARCHITECTURE: 'High-level system design, state management, or component boundaries',
        STORAGE: 'Database, persistence, schemas, caching',
        API: 'Endpoints, protocols, interfaces, RPCs',
        UI: 'Styling, layout, frontend components',
        SECURITY: 'Auth, permissions, data protection',
        REFACTOR: 'Code cleanup, restructuring, migration',
        NONE: 'No technical decision',
      },
    },
  };

  const res = await querySystemOne(endpoint, model, messageText, questions);
  if (!res || !res.decisions) {
    // Fallback: heuristic regex
    const hasMatch = /\b(let'?s (use|switch|implement|change|replace|choose)|decided to|we should use)\b/i.test(messageText);
    return { hasDecision: hasMatch };
  }

  const ans = res.decisions.has_decision?.answer;
  const hasDecision = ans === 'decision' || ans === true;
  const category = res.decisions.category?.answer as string | undefined;

  return {
    hasDecision,
    category: category && category !== 'NONE' && category !== 'no_decision' ? category : undefined,
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

  const options = candidateSymbols.slice(0, 15);
  const symbolCriteria: Record<string, string> = {
    NONE: 'No specific symbol in the candidate list is directly affected',
  };
  for (const sym of options) {
    symbolCriteria[sym] = `Code symbol or function: ${sym}`;
  }

  const questions: Record<string, SystemOneQuestion> = {
    target_symbol: {
      type: 'choice',
      criteria: symbolCriteria,
    },
    relation: {
      type: 'choice',
      criteria: {
        affects: 'General impact or dependency',
        implements: 'Implements new logic for the symbol',
        refactors: 'Restructures or rewrites the symbol',
        replaces: 'Deprecates or replaces the symbol',
      },
    },
  };

  const res = await querySystemOne(endpoint, model, decisionText, questions);
  if (!res || !res.decisions) {
    const found = candidateSymbols.find((sym) => decisionText.toLowerCase().includes(sym.toLowerCase()));
    return { matchedSymbol: found || null, relation: 'affects' };
  }

  const target = res.decisions.target_symbol?.answer as string;
  const rel = (res.decisions.relation?.answer as any) || 'affects';

  return {
    matchedSymbol: target && target !== 'NONE' ? target : null,
    relation: ['affects', 'implements', 'refactors', 'replaces'].includes(rel) ? rel : 'affects',
  };
}

/**
 * Autonomous Memory Selection & Prioritization using System-1 (e.g. Clef)
 *
 * Evaluates a conversational exchange to decide if it contains a durable
 * personal preference, coding habit, tech stack choice, architecture decision,
 * or project constraint that should be remembered permanently.
 *
 * Discards transient debugging, temporary errors, casual pleasantries, or one-off questions.
 * Prioritizes HIGH/MEDIUM importance items and prevents duplicate memories.
 */
export async function evaluateMemoryFromDialogue(
  endpoint: string,
  model: string,
  userMessage: string,
  assistantResponse?: string,
  existingMemories?: import('@/types').Memory[]
): Promise<EvaluatedMemory | null> {
  const trimmed = userMessage.trim();
  if (trimmed.length < 10) return null;

  // Rapid heuristic pre-filter: Skip trivial short phrases and greetings
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|yes|no)\b/i.test(trimmed) && trimmed.length < 25) {
    return null;
  }

  const questions: Record<string, SystemOneQuestion> = {
    should_store: {
      type: 'choice',
      criteria: {
        store: 'Contains a durable personal preference, coding convention, project constraint, tech stack choice, or key context to remember across future sessions',
        discard: 'Transient talk, temporary troubleshooting, error logs, greetings, or casual questions',
      },
    },
    category: {
      type: 'choice',
      criteria: {
        PREFERENCE: 'User coding style, conventions, habits, frameworks liked or disliked',
        CONTEXT: 'Project architecture, database, constraints, tech stack, deployment',
        INTEREST: 'Domains of interest, learning topics, or product goals',
        TOOLING: 'Specific tools, linters, package managers, or environments used',
        NONE: 'None of the above',
      },
    },
    importance: {
      type: 'choice',
      criteria: {
        HIGH: 'Strict constraint, firm rule, core architecture, or explicit "always/never" directive',
        MEDIUM: 'Helpful preference, convention, or notable project fact',
        LOW: 'Incidental detail or minor comment',
      },
    },
  };

  const res = await querySystemOne(endpoint, model || 'clef', trimmed, questions);
  if (!res || !res.decisions) {
    return null;
  }

  const shouldStoreAns = res.decisions.should_store?.answer;
  const isStore = shouldStoreAns === 'store' || shouldStoreAns === true;
  if (!isStore) {
    return null;
  }

  const importanceAns = (res.decisions.importance?.answer as string) || 'LOW';
  if (importanceAns === 'LOW') {
    return null;
  }

  const rawCat = (res.decisions.category?.answer as string) || 'NONE';
  if (rawCat === 'NONE' || !['PREFERENCE', 'CONTEXT', 'INTEREST', 'TOOLING'].includes(rawCat)) {
    return null;
  }
  const category = rawCat as 'PREFERENCE' | 'CONTEXT' | 'INTEREST' | 'TOOLING';

  // Format concise memory statement from user statement
  let content = trimmed.replace(/[\r\n]+/g, ' ').trim();
  content = content.replace(/^(hey|hi|hello|please note that|remember that|just so you know,?|by the way,?)\s+/i, '');
  if (content.length > 300) {
    const dotIdx = content.indexOf('.', 120);
    if (dotIdx !== -1 && dotIdx < 300) {
      content = content.slice(0, dotIdx + 1).trim();
    } else {
      content = content.slice(0, 300).trim() + '...';
    }
  }

  // Deduplication against existing memories
  if (existingMemories && existingMemories.length > 0) {
    const norm = content.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isDup = existingMemories.some((m) => {
      const mNorm = m.content.toLowerCase().replace(/[^a-z0-9]/g, '');
      return mNorm === norm || (mNorm.length > 15 && norm.includes(mNorm)) || (norm.length > 15 && mNorm.includes(norm));
    });
    if (isDup) {
      return null;
    }
  }

  return {
    shouldStore: true,
    category,
    importance: importanceAns === 'HIGH' ? 'HIGH' : 'MEDIUM',
    content,
  };
}
