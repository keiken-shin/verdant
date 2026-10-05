import React from 'react';
import { PipelineEditor } from '@/components/pipelines/PipelineEditor';

export function PipelinesPage() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50">
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center px-4 shrink-0">
        <h1 className="font-semibold text-zinc-800">Visual Workflow Pipelines</h1>
      </header>
      <div className="flex-1 overflow-hidden">
        <PipelineEditor />
      </div>
    </div>
  );
}

