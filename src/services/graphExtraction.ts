import type { ChatMessage, LLMProvider, NodeCategory } from '@/types';
import { parseThinking } from '@/utils';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ExtractedNode {
  label: string;
  category: NodeCategory;
  /** 0.0–1.0: how central is this node to the conversation's core purpose? */
  relevance: number;
}

export interface ExtractedEdge {
  source: string;
  target: string;
  /** Typed relationship verb */
  label?: string;
}

export interface ExtractionResult {
  nodes: ExtractedNode[];
  edges: ExtractedEdge[];
  /** Detected conversation type for metadata */
  conversationType?: string;
  /** Inferred top-level user intent */
  userIntent?: string;
}

// ─── Universal Extraction Prompt ──────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are an expert knowledge graph extractor. Your job is to analyze a conversation and extract a meaningful, interconnected graph of concepts — regardless of the domain.

## Universal Categories (pick the BEST fit):
- **ENTITY** — Named things: people, products, services, files, APIs, organizations, places
- **TOPIC** — Subjects or themes being discussed (can be broad or narrow)
- **DECISION** — Choices made or actively being weighed during the conversation
- **ACTION** — Concrete tasks, next steps, things to implement or do
- **QUESTION** — Open questions, uncertainties, things not yet resolved
- **INSIGHT** — Conclusions, learnings, realizations, "aha!" moments
- **TOOL** — Technologies, libraries, languages, frameworks, commands, software

## Relation Types for edges (use these verbs):
leads_to, depends_on, contradicts, answers, uses, produces, requires, enables, blocks, relates_to, implements, extends, replaces, part_of

## Extraction Rules:
1. Extract **5–15 nodes** — capture the full richness of the conversation
2. Every node MUST have a **relevance** score from 0.0 to 1.0:
   - 0.9–1.0: the absolute core of the conversation, mentioned repeatedly
   - 0.6–0.8: important, directly relevant to the user's goal
   - 0.3–0.5: contextual, supporting, mentioned in passing
   - 0.0–0.2: peripheral, background context
3. Keep labels **short and specific** (2–5 words max)
4. Only create edges between nodes you have defined
5. Infer the conversation's **type** (e.g. "debugging", "brainstorming", "planning", "learning", "reviewing", "troubleshooting", "design", "Q&A") and the user's **intent** (one concise sentence)
6. Work for ANY domain: coding, cooking, travel, creative writing, medical, financial, etc.

## Output Format (return ONLY valid JSON, no other text):
\`\`\`json
{
  "conversation_type": "string",
  "user_intent": "string",
  "nodes": [
    { "label": "string", "category": "ENTITY|TOPIC|DECISION|ACTION|QUESTION|INSIGHT|TOOL", "relevance": 0.0 }
  ],
  "edges": [
    { "source": "label of source node", "target": "label of target node", "label": "relation_type" }
  ]
}
\`\`\``;

// ─── Main Extraction Function ─────────────────────────────────────────────────

export async function extractGraphFromConversation(
  messages: ChatMessage[],
  provider: LLMProvider,
  modelId: string
): Promise<ExtractionResult> {
  const conversationText = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const content = m.role === 'assistant' ? parseThinking(m.content).content : m.content;
      return `${m.role === 'user' ? 'User' : 'Assistant'}: ${content}`;
    })
    .join('\n\n');

  const extractionMessages: ChatMessage[] = [
    {
      role: 'system',
      content: EXTRACTION_PROMPT,
    },
    {
      role: 'user',
      content: `Extract a knowledge graph from this conversation:\n\n${conversationText}`,
    },
  ];

  const response = await provider.chat({
    model: modelId,
    messages: extractionMessages,
    stream: false,
  });

  return parseExtractionResponse(response.content);
}

// ─── Response Parser ──────────────────────────────────────────────────────────

const VALID_CATEGORIES: NodeCategory[] = ['ENTITY', 'TOPIC', 'DECISION', 'ACTION', 'QUESTION', 'INSIGHT', 'TOOL'];

/** Legacy category → new universal taxonomy fallback for any stale LLM outputs */
const LEGACY_CATEGORY_MAP: Record<string, NodeCategory> = {
  CONCEPT:  'TOPIC',
  READING:  'ENTITY',
  CORE:     'INSIGHT',
  IDEA:     'INSIGHT',
  ESSAY:    'TOPIC',
  RESEARCH: 'TOPIC',
  DESIGN:   'DECISION',
};

function normalizeCategory(raw: string): NodeCategory {
  const upper = raw.trim().toUpperCase();
  if (VALID_CATEGORIES.includes(upper as NodeCategory)) {
    return upper as NodeCategory;
  }
  if (LEGACY_CATEGORY_MAP[upper]) {
    return LEGACY_CATEGORY_MAP[upper];
  }
  return 'TOPIC'; // universal safe default
}

function parseExtractionResponse(content: string): ExtractionResult {
  // Strip markdown code fences if the model wrapped its JSON
  const stripped = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Find the outermost JSON object
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('[graphExtraction] Could not find JSON in extraction response');
    return { nodes: [], edges: [] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      conversation_type?: string;
      user_intent?: string;
      nodes?: Array<{ label?: string; category?: string; relevance?: number }>;
      edges?: Array<{ source?: string; target?: string; label?: string }>;
    };

    const nodes: ExtractedNode[] = (parsed.nodes || [])
      .filter((n): n is { label: string; category: string; relevance?: number } =>
        Boolean(n.label && n.category)
      )
      .map((n) => ({
        label: n.label.trim(),
        category: normalizeCategory(n.category),
        relevance: typeof n.relevance === 'number'
          ? Math.max(0, Math.min(1, n.relevance))
          : 0.5, // default mid-relevance if missing
      }));

    const nodeLabels = new Set(nodes.map((n) => n.label));
    const edges: ExtractedEdge[] = (parsed.edges || [])
      .filter((e): e is { source: string; target: string; label?: string } =>
        Boolean(e.source && e.target && nodeLabels.has(e.source) && nodeLabels.has(e.target))
      )
      .map((e) => ({
        source: e.source,
        target: e.target,
        label: e.label,
      }));

    return {
      nodes,
      edges,
      conversationType: parsed.conversation_type,
      userIntent: parsed.user_intent,
    };
  } catch (e) {
    console.error('[graphExtraction] Failed to parse extraction response:', e);
    return { nodes: [], edges: [] };
  }
}

// ─── Improved Heuristic Fallback ──────────────────────────────────────────────

/**
 * Heuristic extraction when no LLM provider is available.
 * Uses bigram/trigram extraction + TF-IDF-like scoring instead of raw word frequency.
 */
export function heuristicExtraction(text: string): ExtractionResult {
  const STOP_WORDS = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
    'is','are','was','were','be','been','being','have','has','had','do','does',
    'did','will','would','could','should','may','might','can','this','that',
    'these','those','i','you','he','she','it','we','they','my','your','his',
    'her','its','our','their','what','which','who','when','where','how','why',
    'not','no','so','if','then','than','as','from','up','about','into','over',
    'also','just','more','some','all','there','here','now','only','very','well',
    'like','get','got','use','used','need','want','make','think','know','see',
    'let','say','go','going','come','take','give','tell','show','much','many',
    'thing','things','way','good','great','really','actually','basically',
  ]);

  const sentences = text
    .toLowerCase()
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const totalSentences = sentences.length || 1;

  // Build term frequency across the whole doc
  const termFreq: Record<string, number> = {};
  // Build document frequency (how many sentences contain the term)
  const docFreq: Record<string, number> = {};

  const extractTerms = (s: string) => {
    const tokens = s.split(/\s+/).map((w) => w.replace(/[^a-z0-9'-]/g, ''));
    const filtered = tokens.filter((t) => t.length > 2 && !STOP_WORDS.has(t));
    const terms: string[] = [...filtered];

    // Add bigrams
    for (let i = 0; i < filtered.length - 1; i++) {
      terms.push(`${filtered[i]} ${filtered[i + 1]}`);
    }
    // Add trigrams
    for (let i = 0; i < filtered.length - 2; i++) {
      terms.push(`${filtered[i]} ${filtered[i + 1]} ${filtered[i + 2]}`);
    }
    return terms;
  };

  for (const sentence of sentences) {
    const terms = extractTerms(sentence);
    const seen = new Set<string>();
    for (const t of terms) {
      termFreq[t] = (termFreq[t] || 0) + 1;
      if (!seen.has(t)) {
        docFreq[t] = (docFreq[t] || 0) + 1;
        seen.add(t);
      }
    }
  }

  // TF-IDF-like score: freq * log(totalSentences / docFreq)
  const scored = Object.entries(termFreq)
    .map(([term, freq]) => ({
      term,
      score: freq * Math.log(totalSentences / (docFreq[term] || 1) + 1),
    }))
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 10);
  const maxScore = top[0]?.score || 1;

  const nodes: ExtractedNode[] = top.map(({ term, score }) => ({
    label: term
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    category: 'TOPIC' as NodeCategory,
    relevance: Math.round((score / maxScore) * 10) / 10,
  }));

  return { nodes, edges: [] };
}
