// ===========================================
// Audit Page
// ===========================================
import { formatDateTime } from '@/lib/utils';
import { useState } from 'react';
import { Shield } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { FilterPanel } from '@/components/shared/FilterPanel';
import { useAuditLogs } from '@/hooks/useAudit';
import type { AuditLogRow } from '@/api/audit.api';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_FILTERS,
  autorAuditoria,
  etiquetaAccion,
  etiquetaEntidad,
  rangoAuditoria,
  tonoAccion,
  type TonoAccion,
} from '@/lib/audit/auditLabels';

/** Valor del Select que significa "sin filtro" (Radix no admite ""). */
const TODAS = 'all';

const CLASES_TONO: Record<TonoAccion, string> = {
  info: 'bg-celeste-50 text-primary-700 border-celeste-200',
  exito: 'bg-success-50 text-success-700 border-success-200',
  aviso: 'bg-warning-50 text-warning-700 border-warning-200',
  peligro: 'bg-destructive-50 text-destructive-700 border-destructive/30',
  neutro: 'bg-muted text-muted-foreground border-border',
};

const OPCIONES_ACCION = Object.keys(AUDIT_ACTION_LABELS)
  .map((valor) => ({ valor, etiqueta: etiquetaAccion(valor) }))
  .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));

const OPCIONES_ENTIDAD = AUDIT_ENTITY_FILTERS.map((valor) => ({
  valor,
  etiqueta: etiquetaEntidad(valor),
})).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));

export function AuditPage() {
  const [action, setAction] = useState(TODAS);
  const [entity, setEntity] = useState(TODAS);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const { data, isLoading, isFetching, isError, refetch } = useAuditLogs({
    page,
    limit,
    action: action === TODAS ? undefined : action,
    entity: entity === TODAS ? undefined : entity,
    ...rangoAuditoria(desde, hasta),
  });

  // Tocar un filtro vuelve a la primera página: el resultado es otro y la
  // página en la que estabas puede ya no existir.
  const conPrimeraPagina =
    <T,>(set: (valor: T) => void) =>
    (valor: T) => {
      set(valor);
      setPage(1);
    };

  const activeCount = [desde, hasta].filter(Boolean).length;
  const hasActiveFilters = action !== TODAS || entity !== TODAS || activeCount > 0;

  const clearFilters = () => {
    setAction(TODAS);
    setEntity(TODAS);
    setDesde('');
    setHasta('');
    setPage(1);
  };

  const columns: DataTableColumn<AuditLogRow>[] = [
    {
      id: 'timestamp',
      header: 'Fecha y hora',
      className: 'text-primary-600 font-mono text-xs tabular-nums',
      mobile: 'secondary',
      cell: (log) => formatDateTime(log.createdAt),
    },
    {
      id: 'user',
      header: 'Usuario',
      className: 'font-medium text-primary-900',
      mobile: 'primary',
      cell: (log) => {
        const autor = autorAuditoria(log.user);
        return (
          <div className="min-w-0">
            <span className="block truncate">{autor.nombre}</span>
            {autor.email && (
              <span className="block truncate text-xs font-normal text-primary-500">
                {autor.email}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'action',
      header: 'Acción',
      mobile: 'secondary',
      cell: (log) => (
        <Badge variant="outline" className={CLASES_TONO[tonoAccion(log.action)]}>
          {etiquetaAccion(log.action)}
        </Badge>
      ),
    },
    {
      id: 'entity',
      header: 'Entidad',
      className: 'text-primary-600',
      mobile: 'secondary',
      cell: (log) => etiquetaEntidad(log.entity),
    },
    {
      id: 'details',
      header: 'Detalles',
      className: 'text-primary-800',
      mobile: 'secondary',
      cell: (log) => (
        <div className="min-w-0 text-xs">
          <span className="block font-mono truncate">
            {log.entityId ? `Registro ${log.entityId.slice(0, 8)}` : 'Sin registro asociado'}
          </span>
          {log.ipAddress && (
            <span className="block text-primary-500">IP {log.ipAddress}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoría del Sistema"
        description="Registro de actividades, eventos de seguridad y cambios realizados"
        icon={<Shield className="w-5 h-5 text-white" />}
      />

      <DataTable
        entityName="registros de auditoría"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(log) => log.id}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        meta={data?.meta}
        onPageChange={setPage}
        onLimitChange={(nuevo) => {
          setLimit(nuevo);
          setPage(1);
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        emptyIcon={<Shield className="w-10 h-10" />}
        emptyTitle={hasActiveFilters ? 'No hay eventos que coincidan' : 'Todavía no hay eventos registrados'}
        emptyDescription={
          hasActiveFilters
            ? 'Probá con otra acción o entidad, o ampliá el rango de fechas para ver más eventos.'
            : 'Los movimientos del sistema aparecen acá a medida que se registran.'
        }
        toolbar={
          <>
            <Select value={action} onValueChange={conPrimeraPagina(setAction)}>
              <SelectTrigger className="w-full md:w-[240px]" aria-label="Filtrar por acción">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas las acciones</SelectItem>
                {OPCIONES_ACCION.map((opcion) => (
                  <SelectItem key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entity} onValueChange={conPrimeraPagina(setEntity)}>
              <SelectTrigger className="w-full md:w-[220px]" aria-label="Filtrar por entidad">
                <SelectValue placeholder="Entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas las entidades</SelectItem>
                {OPCIONES_ENTIDAD.map((opcion) => (
                  <SelectItem key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FilterPanel activeCount={activeCount} className="md:w-auto">
              <DatePicker
                aria-label="Filtrar desde el día"
                value={desde}
                max={hasta || undefined}
                onChange={conPrimeraPagina(setDesde)}
                wrapperClassName="w-full md:w-44"
                pickerLabel="Elegir día de inicio"
              />
              <DatePicker
                aria-label="Filtrar hasta el día"
                value={hasta}
                min={desde || undefined}
                onChange={conPrimeraPagina(setHasta)}
                wrapperClassName="w-full md:w-44"
                pickerLabel="Elegir día de fin"
              />
            </FilterPanel>
          </>
        }
      />
    </div>
  );
}
