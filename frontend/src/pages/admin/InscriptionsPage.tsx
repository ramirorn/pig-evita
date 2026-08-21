// ===========================================
// Inscriptions Admin Page
// ===========================================
import { useMemo, useState } from 'react';
import { ClipboardCheck, Search, Filter, ClipboardList } from 'lucide-react';
import { Link } from 'react-router';
import { useInscriptions } from '@/hooks/useInscriptions';
import { InscriptionStatus, type Inscription } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { InscriptionStatusBadge } from '@/components/shared/InscriptionStatusBadge';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

export function InscriptionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const { data: inscriptionsData, isLoading, isFetching, isError, refetch } = useInscriptions({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit,
  });

  // `GET /inscriptions` no acepta `search` (ver `InscriptionFilters`): hasta que
  // el backend lo soporte, el buscador filtra sólo la página ya traída. Antes el
  // input existía pero no filtraba nada; el placeholder ahora dice la verdad.
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const data = inscriptionsData?.data ?? [];
    if (!needle) return data;
    return data.filter((inscription) =>
      [
        inscription.qrCode,
        inscription.participant?.lastName ?? '',
        inscription.participant?.firstName ?? '',
        inscription.participant?.dni ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [inscriptionsData, search]);

  const hasActiveFilters = statusFilter !== 'all' || search.trim() !== '';

  const clearFilters = () => {
    setStatusFilter('all');
    setSearch('');
    setPage(1);
  };

  const columns: DataTableColumn<Inscription>[] = [
    {
      id: 'qr',
      header: 'Código QR',
      // Identidad de la fila. No lleva link primario: la navegación al detalle
      // ya la ofrece el botón "Revisar", y la spec pide un solo `<a>` por fila.
      rowHeader: true,
      className: 'font-mono font-medium text-primary-600',
      headClassName: 'min-w-[140px]',
      cell: (inscription) => inscription.qrCode,
    },
    {
      id: 'applicant',
      header: 'Solicitante',
      headClassName: 'min-w-[200px]',
      cell: (inscription) => (
        <>
          <div className="font-medium text-primary-900">
            {inscription.participant?.lastName}, {inscription.participant?.firstName}
          </div>
          <div className="text-xs text-primary-500">DNI: {inscription.participant?.dni}</div>
        </>
      ),
    },
    {
      id: 'category',
      header: 'Categoría',
      className: 'text-primary-600',
      cell: (inscription) => inscription.category?.name,
    },
    {
      id: 'team',
      header: 'Equipo (Opcional)',
      cell: (inscription) =>
        inscription.team ? (
          <span className="font-medium text-primary-700">{inscription.team.name}</span>
        ) : (
          // `primary-400` daba 3.75:1 sobre blanco (falla AA); `primary-500`
          // llega a 6.52:1 y la itálica conserva el matiz de "no aplica".
          <span className="text-primary-500 italic">Individual</span>
        ),
    },
    {
      id: 'status',
      header: 'Estado',
      // El badge memoizado de T26: la tabla se re-renderiza en cada tecla del
      // buscador y sus props son primitivas, así que el `memo` evita N renders.
      cell: (inscription) => <InscriptionStatusBadge status={inscription.status} />,
    },
    {
      id: 'action',
      header: 'Acción',
      interactive: true,
      headClassName: 'text-right w-[110px]',
      className: 'text-right',
      cell: (inscription) => (
        // Antes era `<Link><Button/></Link>`: un `<button>` dentro de un `<a>`,
        // anidado inválido. `asChild` deja un único `<a>` con estilo de botón.
        <Button asChild variant="outline" size="sm">
          <Link to={`/admin/inscripciones/${inscription.id}`}>
            Revisar
            <span className="sr-only"> la inscripción {inscription.qrCode}</span>
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Inscripciones"
        description="Gestión y revisión de solicitudes de inscripción"
        icon={<ClipboardCheck className="w-5 h-5 text-white" />}
      />

      <DataTable
        entityName="inscripciones"
        columns={columns}
        rows={rows}
        getRowId={(inscription) => inscription.id}
        isLoading={isLoading}
        isFetching={isFetching && !isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        meta={inscriptionsData?.meta}
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        emptyIcon={<ClipboardList className="w-10 h-10" />}
        emptyTitle="Todavía no hay inscripciones"
        emptyDescription="Cuando se registre la primera solicitud, va a aparecer acá para su revisión."
        toolbar={
          <>
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar en esta página por código QR, apellido o DNI..."
                aria-label="Buscar inscripciones en la página actual"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary-400" aria-hidden="true" />
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full md:w-[180px]" aria-label="Filtrar por estado">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value={InscriptionStatus.PENDIENTE}>Pendiente</SelectItem>
                  <SelectItem value={InscriptionStatus.REVISADA}>Revisada</SelectItem>
                  <SelectItem value={InscriptionStatus.APROBADA}>Aprobada</SelectItem>
                  <SelectItem value={InscriptionStatus.RECHAZADA}>Rechazada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        }
      />
    </div>
  );
}
