import React, { useEffect } from 'react';
import { useConfirmStore } from '@/stores/confirmStore';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/utils';

export function ConfirmModal() {
  const { isOpen, options, respond } = useConfirmStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        respond(false);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        respond(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, respond]);

  if (!isOpen || !options) return null;

  const isDanger = options.kind === 'danger' || options.kind === 'warning';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex gap-3 items-start">
          <div className={cn("p-2 rounded-full shrink-0", isDanger ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600")}>
            {isDanger ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <h2 className="text-lg font-semibold text-zinc-900 leading-none">{options.title}</h2>
            <p className="text-sm text-zinc-500 mt-1">{options.message}</p>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => respond(false)}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            {options.cancelText || 'Cancel'}
          </button>
          <button
            onClick={() => respond(true)}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors",
              isDanger ? "bg-red-600 hover:bg-red-700" : "bg-zinc-900 hover:bg-zinc-800"
            )}
            autoFocus
          >
            {options.confirmText || (isDanger ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
