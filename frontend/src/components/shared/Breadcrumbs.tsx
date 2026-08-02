// ===========================================
// Breadcrumbs — Navigation breadcrumbs for admin
// ===========================================
import { Link } from 'react-router';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1.5 text-sm', className)}
    >
      <Link
        to="/admin/dashboard"
        className="text-primary-400 hover:text-primary-600 transition-colors"
        aria-label="Dashboard"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <span key={idx} className="flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3 text-primary-300" />
            {isLast || !item.path ? (
              <span className="text-primary-700 font-medium truncate max-w-[200px]">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className="text-primary-400 hover:text-primary-600 transition-colors truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
