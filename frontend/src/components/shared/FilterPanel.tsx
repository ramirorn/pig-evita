// ===========================================
// FilterPanel — filtros colapsables en móvil, en línea desde md
// ===========================================
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import { cn } from '@/lib/utils';

interface FilterPanelProps {
  /** Los controles de filtro (buscador, selects). El panel no conoce su estado. */
  children: ReactNode;
  /**
   * Cantidad de filtros aplicados. Se muestra como badge en el botón "Filtros"
   * (sólo si es mayor a 0), para que el usuario sepa que hay filtros activos
   * aunque el panel esté plegado.
   */
  activeCount?: number;
  /** El panel arranca abierto en móvil. Por defecto, plegado. */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Contenedor de filtros para pantallas de listado.
 *
 * - Por debajo de `md`: un botón "Filtros" (con badge de filtros activos) que
 *   despliega los controles. `aria-expanded` + `aria-controls` lo conectan con
 *   el panel; el foco queda en el botón, así que Enter/Espacio lo alternan.
 * - Desde `md`: el botón desaparece y los controles se muestran siempre, en línea.
 *
 * Es sólo presentación: el estado de los filtros sigue viviendo en la página
 * (URL / hook). Se puede usar como `toolbar` del `DataTable` o suelto.
 *
 * @example
 * <FilterPanel activeCount={[search, status].filter(Boolean).length}>
 *   <Input value={search} onChange={...} aria-label="Buscar" />
 *   <StatusSelect value={status} onChange={...} />
 * </FilterPanel>
 */
export function FilterPanel({
  children,
  activeCount = 0,
  defaultOpen = false,
  className,
}: FilterPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={cn('w-full', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="md:hidden inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-primary-200 bg-white px-4 text-sm font-medium text-primary-800 transition-colors duration-120 hover:bg-primary-50 active:bg-primary-100"
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtros
          {activeCount > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary-800 px-1.5 text-xs font-semibold leading-5 text-white">
              <span aria-hidden="true">{activeCount}</span>
              <span className="sr-only">{activeCount} activos</span>
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200 ease-out-soft',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {/* Móvil: se oculta con `hidden` cuando está plegado (sale del árbol de
          accesibilidad y del orden de Tab). Desde md: siempre visible. */}
      <div
        id={panelId}
        className={cn(
          'mt-3 flex-col gap-3 md:mt-0 md:flex md:flex-row md:flex-wrap md:items-center',
          open ? 'flex' : 'hidden',
        )}
      >
        {children}
      </div>
    </div>
  );
}
