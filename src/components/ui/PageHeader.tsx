import React from 'react';
import { cn } from '@/utils';

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <span className={cn('section-label', className)}>
      {children}
    </span>
  );
}

interface PageHeaderProps {
  label: string;
  title: string;
  description?: string;
  className?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ label, title, description, className, actions }: PageHeaderProps) {
  return (
    <div className={cn('mb-10', className)}>
      <SectionLabel className="mb-3 block">{label}</SectionLabel>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title mb-3">{title}</h1>
          {description && (
            <p className="text-base text-[var(--color-wollama-text)] max-w-lg leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 mt-2">{actions}</div>}
      </div>
    </div>
  );
}
