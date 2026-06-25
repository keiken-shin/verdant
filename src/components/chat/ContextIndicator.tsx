import React from 'react';
import { useMessageStore } from '@/stores/messageStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { cn } from '@/utils';
import { Brain } from 'lucide-react';

export function ContextIndicator() {
  const lastContextUsage = useMessageStore(state => state.lastContextUsage);
  const settings = useSettingsStore(state => state.settings);

  const used = lastContextUsage?.used || 0;
  const total = lastContextUsage?.total || settings.ollama_num_ctx || 32768;
  const percentage = Math.min(100, Math.round((used / total) * 100));
  
  // Color coding
  let colorClass = 'text-green-500';
  let strokeClass = 'stroke-green-500';
  if (percentage >= 80) {
    colorClass = 'text-red-500';
    strokeClass = 'stroke-red-500';
  } else if (percentage >= 50) {
    colorClass = 'text-amber-500';
    strokeClass = 'stroke-amber-500';
  }

  // SVG Circle calculations
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div 
      className="flex items-center gap-1.5 px-2 py-1 bg-white border border-zinc-200 rounded-full shadow-sm text-xs text-zinc-600 cursor-help transition-opacity"
      title={`Context usage: ${used.toLocaleString()} / ${total.toLocaleString()} tokens (${percentage}%)`}
    >
      <Brain className={cn("h-3 w-3", colorClass)} />
      <div className="relative h-4 w-4 transform -rotate-90">
        <svg className="w-full h-full" viewBox="0 0 20 20">
          <circle
            cx="10"
            cy="10"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-zinc-100"
          />
          <circle
            cx="10"
            cy="10"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn("transition-all duration-500 ease-out", strokeClass)}
          />
        </svg>
      </div>
      <span className="font-medium mr-1">{percentage}%</span>
    </div>
  );
}
