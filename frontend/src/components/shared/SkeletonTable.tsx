// ===========================================
// SkeletonTable — Shimmer loading for tables
// ===========================================
import { cn } from '@/lib/utils';

interface SkeletonTableProps {
  /** Number of rows to render */
  rows?: number;
  /** Number of columns to render */
  columns?: number;
  className?: string;
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-4 bg-primary-100 rounded-md animate-shimmer',
        className,
      )}
    />
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  // Vary column widths for a more realistic look
  const columnWidths = ['w-20', 'w-40', 'w-28', 'w-32', 'w-24', 'w-36'];

  return (
    <div className={cn('w-full', className)}>
      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-primary-100 bg-primary-50/50">
        {Array.from({ length: columns }).map((_, colIdx) => (
          <SkeletonBlock
            key={`header-${colIdx}`}
            className={cn('h-3', columnWidths[colIdx % columnWidths.length], 'opacity-60')}
          />
        ))}
      </div>

      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`row-${rowIdx}`}
          className="flex items-center gap-4 px-6 py-4 border-b border-primary-50"
          style={{ animationDelay: `${rowIdx * 75}ms` }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <SkeletonBlock
              key={`cell-${rowIdx}-${colIdx}`}
              className={cn(
                columnWidths[colIdx % columnWidths.length],
                rowIdx % 2 === 0 ? 'opacity-70' : 'opacity-50',
              )}
              // Stagger the shimmer animation per cell
            />
          ))}
        </div>
      ))}
    </div>
  );
}
