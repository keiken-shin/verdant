import React from 'react';
import { cn } from '@/utils';
import type { MemoryCategory, NodeCategory, SessionTag } from '@/types';

type BadgeVariant = 'default' | 'category' | 'session-tag' | 'status';

const TAG_COLORS: Record<string, string> = {
  RESEARCH: 'bg-blue-50 text-blue-700 border-blue-200',
  WRITING:  'bg-purple-50 text-purple-700 border-purple-200',
  READING:  'bg-amber-50 text-amber-700 border-amber-200',
  DESIGN:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  CODING:   'bg-sky-50 text-sky-700 border-sky-200',
  OTHER:    'bg-zinc-50 text-zinc-600 border-zinc-200',
};

const MEMORY_COLORS: Record<MemoryCategory, string> = {
  PREFERENCE: 'bg-violet-50 text-violet-700 border-violet-200',
  CONTEXT:    'bg-sky-50 text-sky-700 border-sky-200',
  INTEREST:   'bg-amber-50 text-amber-700 border-amber-200',
  TOOLING:    'bg-emerald-50 text-emerald-700 border-emerald-200',
};

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: BadgeVariant;
  tag?: SessionTag | MemoryCategory | NodeCategory | string;
}

export function Badge({ children, className, variant = 'default', tag }: BadgeProps) {
  let colorClass = 'bg-zinc-100 text-zinc-600 border-zinc-200';

  if (tag) {
    const upper = String(tag).toUpperCase();
    colorClass = TAG_COLORS[upper] || MEMORY_COLORS[upper as MemoryCategory] || colorClass;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase border',
        colorClass,
        className
      )}
    >
      {children}
    </span>
  );
}
