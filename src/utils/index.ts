import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return formatDistanceToNow(date, { addSuffix: false })
      .replace('about ', '')
      .replace(' minutes', 'min')
      .replace(' minute', 'min')
      .replace(' hours', 'h')
      .replace(' hour', 'h')
      .replace(' days', 'd')
      .replace(' day', 'd')
      .replace(' weeks', 'w')
      .replace(' week', 'w')
      .replace(' months', 'mo')
      .replace(' month', 'mo');
  } catch {
    return '';
  }
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function autoLayoutNodes(
  count: number,
  containerWidth = 800,
  containerHeight = 600
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellW = containerWidth / cols;
  const cellH = containerHeight / rows;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: col * cellW + cellW / 2 + (Math.random() - 0.5) * 60,
      y: row * cellH + cellH / 2 + (Math.random() - 0.5) * 40,
    });
  }

  return positions;
}

export interface ParsedMessage {
  thinking: string | null;
  content: string;
  isThinking: boolean;
}

export function parseThinking(text: string): ParsedMessage {
  if (typeof text !== 'string') {
    return { thinking: null, content: text || '', isThinking: false };
  }

  const thinkStart = text.indexOf('<think>');
  if (thinkStart === -1) {
    return { thinking: null, content: text, isThinking: false };
  }

  const thinkEnd = text.indexOf('</think>');
  const beforeThink = text.slice(0, thinkStart);

  if (thinkEnd === -1) {
    // We have <think> but no </think> yet.
    const thinking = text.slice(thinkStart + 7);
    return {
      thinking,
      content: beforeThink,
      isThinking: true,
    };
  } else {
    // We have both <think> and </think>.
    const thinking = text.slice(thinkStart + 7, thinkEnd);
    const afterThink = text.slice(thinkEnd + 8);
    return {
      thinking,
      content: beforeThink + afterThink,
      isThinking: false,
    };
  }
}

