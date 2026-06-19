import type { ChatMessage, LLMProvider, NodeCategory } from '@/types';

export interface ExtractedNode {
  label: string;
  category: NodeCategory;
}

export interface ExtractedEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ExtractionResult {
  nodes: ExtractedNode[];
  edges: ExtractedEdge[];
}

const EXTRACTION_PROMPT = `You are a knowledge graph extractor. Analyze the conversation below and extract key concepts, entities, ideas, and their relationships.

Return ONLY valid JSON in this exact format:
{
  "nodes": [
    { "label": "string (short, 2-4 words)", "category": "CONCEPT|READING|CORE|IDEA|ESSAY|RESEARCH|DESIGN" }
  ],
  "edges": [
    { "source": "label of source node", "target": "label of target node", "label": "relationship verb" }
  ]
}

Categories:
- CONCEPT: Abstract ideas or frameworks
- READING: Books, papers, authors, references
- CORE: Foundational principles or beliefs
- IDEA: Specific insights or hypotheses
- ESSAY: Writing projects or essay topics
- RESEARCH: Research topics or investigations
- DESIGN: Design decisions or patterns

Rules:
- Extract 3-8 nodes maximum
- Keep node labels short and specific
- Only create edges between nodes you've defined
- Return only the JSON, no other text`;

export async function extractGraphFromConversation(
  messages: ChatMessage[],
  provider: LLMProvider,
  modelId: string
): Promise<ExtractionResult> {
  const conversationText = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const extractionMessages: ChatMessage[] = [
    {
      role: 'system',
      content: EXTRACTION_PROMPT,
    },
    {
      role: 'user',
      content: `Extract knowledge graph from this conversation:\n\n${conversationText}`,
    },
  ];

  const response = await provider.chat({
    model: modelId,
    messages: extractionMessages,
    stream: false,
  });

  return parseExtractionResponse(response.content);
}

function parseExtractionResponse(content: string): ExtractionResult {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('Could not find JSON in extraction response');
    return { nodes: [], edges: [] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      nodes?: Array<{ label?: string; category?: string }>;
      edges?: Array<{ source?: string; target?: string; label?: string }>;
    };

    const validCategories: NodeCategory[] = ['CONCEPT', 'READING', 'CORE', 'IDEA', 'ESSAY', 'RESEARCH', 'DESIGN'];

    const nodes: ExtractedNode[] = (parsed.nodes || [])
      .filter((n): n is { label: string; category: string } => Boolean(n.label && n.category))
      .map((n) => ({
        label: n.label.trim(),
        category: validCategories.includes(n.category as NodeCategory)
          ? (n.category as NodeCategory)
          : 'CONCEPT',
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

    return { nodes, edges };
  } catch (e) {
    console.error('Failed to parse extraction response:', e);
    return { nodes: [], edges: [] };
  }
}

// Heuristic fallback when no provider available
export function heuristicExtraction(text: string): ExtractionResult {
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq: Record<string, number> = {};
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they']);

  for (const w of words) {
    const clean = w.replace(/[^a-z]/g, '');
    if (clean.length > 4 && !stopWords.has(clean)) {
      wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    }
  }

  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  const nodes: ExtractedNode[] = topWords.map((w) => ({
    label: w.charAt(0).toUpperCase() + w.slice(1),
    category: 'CONCEPT' as NodeCategory,
  }));

  return { nodes, edges: [] };
}
