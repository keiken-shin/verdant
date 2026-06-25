import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/utils';
import type { Attachment } from '@/types';

interface AttachmentThumbnailProps {
  attachment: Attachment;
  className?: string;
  fallbackClassName?: string;
}

export function AttachmentThumbnail({ attachment, className, fallbackClassName }: AttachmentThumbnailProps) {
  const [base64, setBase64] = useState<string | null>(null);

  useEffect(() => {
    if (attachment.type === 'image') {
      invoke<string>('read_object_base64', { id: attachment.objectId })
        .then(setBase64)
        .catch((e) => console.error('Failed to load image thumbnail', e));
    }
  }, [attachment]);

  if (attachment.type === 'image') {
    if (!base64) {
      return (
        <div className={cn("h-16 w-16 bg-zinc-200 rounded-md animate-pulse flex items-center justify-center", fallbackClassName)}>
          <ImageIcon className="h-4 w-4 text-zinc-400" />
        </div>
      );
    }
    // Simple way to handle different image types - assuming JPEG/PNG
    const src = base64.startsWith('iVBORw') ? `data:image/png;base64,${base64}` : `data:image/jpeg;base64,${base64}`;
    return (
      <img
        src={src}
        alt={attachment.name}
        className={cn("h-16 w-16 object-cover rounded-md border border-zinc-200", className)}
        title={attachment.name}
      />
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200 rounded-md text-xs text-zinc-700 h-8 max-w-[200px]">
      <FileText className="h-3 w-3 text-zinc-400 shrink-0" />
      <span className="truncate">{attachment.name}</span>
    </div>
  );
}
