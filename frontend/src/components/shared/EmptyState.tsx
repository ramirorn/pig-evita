// ===========================================
// EmptyState — Attractive empty state component
// ===========================================
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  /** Optional call-to-action button */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title = 'Sin resultados',
  description = 'No se encontraron datos para mostrar.',
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in',
        className,
      )}
    >
      {/* Decorative circle + icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center">
          <div className="text-primary-300">
            {icon || <Inbox className="w-10 h-10" />}
          </div>
        </div>
        {/* Decorative ring */}
        <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-dashed border-primary-100 animate-spin-slow" />
      </div>

      <h3 className="text-lg font-semibold text-primary-800 mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-primary-500 max-w-sm leading-relaxed mb-6">
        {description}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
}
