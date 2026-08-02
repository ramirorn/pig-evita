// ===========================================
// PageHeader — Reusable admin page header
// ===========================================
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon: ReactNode;
  /** Gradient for the icon badge */
  gradient?: string;
  /** Right-side actions (buttons, etc.) */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  gradient = 'from-primary-500 to-primary-700',
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm',
            gradient,
          )}
        >
          {icon}
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary-800">{title}</h1>
          {description && (
            <p className="text-sm text-primary-500">{description}</p>
          )}
        </div>
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
