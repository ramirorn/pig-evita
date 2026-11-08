// ===========================================
// FactList — datos clave en lista de definición (etiqueta + valor)
// ===========================================
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Fact {
  label: string;
  value: ReactNode;
  /** Ocupa las dos columnas (direcciones largas, notas). */
  wide?: boolean;
}

interface FactListProps {
  facts: Fact[];
  className?: string;
}

/** Una columna en celular, dos desde `sm`; los números van en `tabular-nums`. */
export function FactList({ facts, className }: FactListProps) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2', className)}>
      {facts.map((fact) => (
        <div key={fact.label} className={cn('min-w-0', fact.wide && 'sm:col-span-2')}>
          <dt className="text-xs text-primary-600">{fact.label}</dt>
          <dd className="mt-0.5 font-medium text-primary-900 tabular-nums break-words">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
