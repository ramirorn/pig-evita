// ===========================================
// DataTable — bloque de listado reusable (T27)
// ===========================================
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, SearchX } from 'lucide-react';

import { cn } from '@/lib/utils';
import { logError } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import type { PaginatedResponse } from '@/types';

/** `meta` del sobre paginado del backend (`{ success, data, meta }`). */
export type DataTableMeta = PaginatedResponse<unknown>['meta'];

/**
 * Definición de una columna.
 *
 * `header` es **texto plano a propósito**: es el nombre accesible que el lector
 * de pantalla asocia a cada celda de la columna. Si la columna no debe mostrar
 * título (la de acciones, por ejemplo), se usa `hideHeader`, que lo oculta
 * visualmente pero lo conserva para la accesibilidad. Antes de T27 esas
 * columnas eran `<TableHead className="w-[80px]"></TableHead>`: sin nombre.
 */
export interface DataTableColumn<TRow> {
  /** Identificador estable de la columna (sirve de `key`). */
  id: string;
  /** Nombre accesible y visible de la columna. */
  header: string;
  /** Contenido de la celda. El `<DataTable>` nunca decide qué va adentro. */
  cell: (row: TRow) => ReactNode;
  /**
   * Esta columna identifica a la fila: se renderiza como `<th scope="row">` y
   * es donde se ancla el link primario cuando la fila es clickeable.
   */
  rowHeader?: boolean;
  /**
   * La celda contiene controles propios (menú, botones, texto a copiar).
   * Se eleva con `relative z-10` para quedar por encima del overlay del link
   * primario; sin esto el menú de acciones queda inalcanzable con el mouse.
   */
  interactive?: boolean;
  /** Oculta el título visualmente, conservando el nombre accesible. */
  hideHeader?: boolean;
  /** Clases extra para las celdas del cuerpo. */
  className?: string;
  /** Clases extra para el `<th>` de la cabecera (anchos mínimos, alineación). */
  headClassName?: string;
}

/** Destino del link primario de una fila (patrón "link + overlay"). */
export interface DataTableRowLink {
  to: string;
  /**
   * Nombre accesible del link. Sólo hace falta cuando el contenido visible de
   * la celda no alcanza para identificar el registro (por ejemplo, un DNI).
   */
  label?: string;
}

export interface DataTableProps<TRow> {
  /**
   * Nombre del listado en plural y minúscula (`'sedes'`, `'equipos'`).
   * Alimenta el `<caption>`, los anuncios de la live region y los textos por defecto.
   */
  entityName: string;
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;

  // --- Estado de la query (el DataTable no hace fetch: lo recibe) ---
  isLoading: boolean;
  /** Refetch con datos ya en pantalla: atenúa el cuerpo, no vuelve al skeleton. */
  isFetching?: boolean;
  isError?: boolean;
  onRetry?: () => void;

  // --- Paginación (opcional) ---
  meta?: DataTableMeta;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;

  // --- Toolbar y filtros (el DataTable no es dueño del estado de filtros) ---
  toolbar?: ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;

  // --- Vacío sin datos ---
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;

  // --- Filas ---
  /** Sin link primario no hay fila clickeable: no se inventa un `onClick` sin URL. */
  rowLink?: (row: TRow) => DataTableRowLink | null;
  /** Marca visual de registro inactivo. Nunca `opacity` sobre la fila entera. */
  isRowInactive?: (row: TRow) => boolean;

  density?: 'comfortable' | 'compact';
  className?: string;
}

/**
 * Densidad. Las primitivas traen `h-10`/`p-2`, más apretado de lo que rinde el
 * caso real dominante (celda de dos líneas: nombre + dato secundario).
 */
const DENSITY = {
  comfortable: { head: 'h-11 px-4', cell: 'px-4 py-3' },
  compact: { head: 'h-9 px-3', cell: 'px-3 py-2' },
} as const;

/** Debounce del anuncio: tipear en el buscador no debe anunciar una vez por tecla. */
const ANNOUNCE_DELAY_MS = 600;

export function DataTable<TRow>({
  entityName,
  columns,
  rows,
  getRowId,
  isLoading,
  isFetching = false,
  isError = false,
  onRetry,
  meta,
  onPageChange,
  onLimitChange,
  toolbar,
  hasActiveFilters = false,
  onClearFilters,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  rowLink,
  isRowInactive,
  density = 'comfortable',
  className,
}: DataTableProps<TRow>) {
  const spacing = DENSITY[density];
  const total = meta?.total ?? rows.length;
  const caption = meta
    ? `${entityName} — ${total} registros, página ${meta.page} de ${meta.totalPages || 1}`
    : `${entityName} — ${total} registros`;

  // Anuncio diferido para el lector de pantalla.
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (isLoading || isError) {
      setAnnouncement('');
      return;
    }
    const timer = window.setTimeout(() => setAnnouncement(caption), ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [caption, isLoading, isError]);

  // Contrato interno: si la fila es clickeable, alguna columna tiene que ser la
  // de identidad. Se avisa en desarrollo en vez de fallar en silencio.
  const hasRowHeader = columns.some((column) => column.rowHeader);
  const warnedRef = useRef(false);
  if (rowLink && !hasRowHeader && !warnedRef.current) {
    warnedRef.current = true;
    logError(
      'DataTable',
      new Error(
        `El listado "${entityName}" define rowLink pero ninguna columna tiene rowHeader: true.`,
      ),
    );
  }

  return (
    <div className={cn('card shadow-xs animate-fade-in', className)}>
      {toolbar && (
        <div className="p-4 border-b border-primary-100 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {toolbar}
        </div>
      )}

      <div className="relative">
        {isError ? (
          <ErrorState entityName={entityName} onRetry={onRetry} />
        ) : isLoading ? (
          <LoadingState entityName={entityName} columns={columns.length} limit={meta?.limit} />
        ) : rows.length === 0 && hasActiveFilters ? (
          <FilteredEmptyState entityName={entityName} onClearFilters={onClearFilters} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle ?? `Todavía no hay ${entityName}`}
            description={emptyDescription ?? `Registrá el primer registro para empezar.`}
            action={emptyAction}
          />
        ) : (
          <>
            <Table
              aria-busy={isFetching || undefined}
              containerProps={{
                // Si la tabla desborda, este div es el único que scrollea: sin
                // `tabIndex` no hay forma de alcanzarlo con el teclado.
                role: 'region',
                'aria-label': `Tabla de ${entityName}`,
                tabIndex: 0,
              }}
            >
              <TableCaption className="sr-only mt-0">{caption}</TableCaption>

              <TableHeader>
                <TableRow className="bg-primary-50 border-b border-primary-200 hover:bg-primary-50">
                  {columns.map((column) => (
                    <TableHead
                      key={column.id}
                      scope="col"
                      className={cn(
                        spacing.head,
                        'text-primary-700 font-semibold text-xs uppercase tracking-wide',
                        column.headClassName,
                      )}
                    >
                      <span className={cn(column.hideHeader && 'sr-only')}>{column.header}</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody className={cn(isFetching && 'opacity-60 pointer-events-none')}>
                {rows.map((row) => {
                  const link = rowLink?.(row) ?? null;
                  const inactive = isRowInactive?.(row) ?? false;

                  return (
                    <TableRow
                      key={getRowId(row)}
                      className={cn(
                        'relative border-b border-primary-100 transition-colors duration-150',
                        // El anillo de foco se dibuja en la fila, no en el link:
                        // así no lo recorta el `overflow-x-auto` del viewport.
                        'hover:bg-primary-50/60 has-[:focus-visible]:bg-primary-50/60',
                        link &&
                          'cursor-pointer has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-primary-500 has-[a:focus-visible]:-outline-offset-2',
                        inactive && 'bg-surface',
                      )}
                    >
                      {columns.map((column) => {
                        const content =
                          column.rowHeader && link ? (
                            <Link
                              to={link.to}
                              aria-label={link.label}
                              // El pseudo-elemento estira el link sobre toda la
                              // fila sin agregar un tab stop por columna.
                              className="font-medium text-primary-600 hover:underline after:absolute after:inset-0 after:content-['']"
                            >
                              {column.cell(row)}
                            </Link>
                          ) : (
                            column.cell(row)
                          );

                        const cellClassName = cn(
                          spacing.cell,
                          'align-middle',
                          inactive ? 'text-primary-700' : 'text-primary-900',
                          column.interactive && 'relative z-10',
                          column.className,
                        );

                        if (column.rowHeader) {
                          return (
                            <th
                              key={column.id}
                              scope="row"
                              className={cn(cellClassName, 'text-left font-normal')}
                            >
                              {content}
                            </th>
                          );
                        }

                        return (
                          <TableCell key={column.id} className={cellClassName}>
                            {content}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {isFetching && (
              <span role="status" aria-live="polite" className="sr-only">
                Actualizando resultados…
              </span>
            )}
          </>
        )}

        {/* Live region estable: el anuncio llega con debounce, sin interrumpir. */}
        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </div>

      {meta && onPageChange && meta.totalPages > 1 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={meta.limit}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
        />
      )}
    </div>
  );
}

// -------------------------------------------
// Estados
// -------------------------------------------

function LoadingState({
  entityName,
  columns,
  limit,
}: {
  entityName: string;
  columns: number;
  limit?: number;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando {entityName}…</span>
      {/* Los bloques vacíos del esqueleto no aportan nada al lector de pantalla. */}
      <div aria-hidden="true">
        <SkeletonTable rows={Math.min(limit ?? 8, 8)} columns={columns} />
      </div>
    </div>
  );
}

function FilteredEmptyState({
  entityName,
  onClearFilters,
}: {
  entityName: string;
  onClearFilters?: () => void;
}) {
  return (
    <div role="status" aria-live="polite">
      <EmptyState
        icon={<SearchX className="w-10 h-10" />}
        title="Sin resultados para tu búsqueda"
        description={`Ningún registro de ${entityName} coincide con los filtros aplicados. Probá cambiando el texto o limpiando los filtros.`}
        action={
          onClearFilters && (
            // Crear un registro nuevo no resuelve el problema del usuario que
            // filtró mal; limpiar el filtro sí.
            <Button variant="outline" onClick={onClearFilters}>
              Limpiar filtros
            </Button>
          )
        }
      />
    </div>
  );
}

function ErrorState({ entityName, onRetry }: { entityName: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in"
    >
      <div className="w-20 h-20 rounded-full bg-destructive-50 border-2 border-destructive-500/20 flex items-center justify-center mb-6">
        <AlertTriangle className="w-10 h-10 text-destructive-600" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-primary-800 mb-1.5">
        No pudimos cargar los datos
      </h3>
      {/* Texto fijo: nunca el mensaje crudo del backend (coherente con T16). */}
      <p className="text-sm text-primary-500 max-w-sm leading-relaxed mb-6">
        Ocurrió un problema al consultar {entityName}. Volvé a intentar en unos segundos.
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
