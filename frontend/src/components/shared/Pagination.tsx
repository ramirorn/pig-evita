// ===========================================
// Pagination — Reusable pagination controls
// ===========================================
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PAGE_SIZE_OPTIONS } from '@/lib/constants';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  className,
}: PaginationProps) {
  const from = Math.min((page - 1) * limit + 1, total);
  const to = Math.min(page * limit, total);

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-primary-100',
        className,
      )}
    >
      {/* Info */}
      <div className="text-sm text-primary-500 order-2 sm:order-1">
        Mostrando{' '}
        <span className="font-semibold text-primary-700">{from}</span>
        –<span className="font-semibold text-primary-700">{to}</span> de{' '}
        <span className="font-semibold text-primary-700">{total}</span>{' '}
        registros
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 order-1 sm:order-2">
        {/* Page size selector */}
        {onLimitChange && (
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm text-primary-500 hidden sm:inline">Por página:</span>
            <Select
              value={String(limit)}
              onValueChange={(v) => onLimitChange(Number(v))}
            >
              <SelectTrigger className="w-[70px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            aria-label="Primera página"
          >
            <ChevronsLeft className="w-3 h-3" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>

          <span className="px-3 text-sm font-medium text-primary-700 tabular-nums">
            {page} / {totalPages || 1}
          </span>

          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            aria-label="Última página"
          >
            <ChevronsRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
