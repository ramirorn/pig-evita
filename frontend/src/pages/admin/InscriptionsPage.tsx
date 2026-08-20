// ===========================================
// Inscriptions Admin Page
// ===========================================
import { useState } from 'react';
import { ClipboardCheck, Search, Filter, ClipboardList } from 'lucide-react';
import { useInscriptions } from '@/hooks/useInscriptions';
import { InscriptionStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Link } from 'react-router';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';
import { InscriptionStatusBadge } from '@/components/shared/InscriptionStatusBadge';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';

export function InscriptionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);

  const { data: inscriptionsData, isLoading } = useInscriptions({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inscripciones"
        description="Gestión y revisión de solicitudes de inscripción"
        icon={<ClipboardCheck className="w-5 h-5 text-white" />}
      />

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input
              placeholder="Buscar por código QR o solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary-400" />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
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
        </div>

        <div>
          {isLoading ? (
            <SkeletonTable rows={limit > 5 ? 8 : 5} columns={6} />
          ) : !inscriptionsData?.data.length ? (
            <EmptyState
              icon={<ClipboardList className="w-10 h-10" />}
              title="Sin inscripciones"
              description="No se encontraron inscripciones con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código QR</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Equipo (Opcional)</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inscriptionsData.data.map((inscription) => (
                  <TableRow key={inscription.id}>
                    <TableCell className="font-mono font-medium text-primary-600">
                      {inscription.qrCode}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-primary-900">
                        {inscription.participant?.lastName}, {inscription.participant?.firstName}
                      </div>
                      <div className="text-xs text-primary-500">DNI: {inscription.participant?.dni}</div>
                    </TableCell>
                    <TableCell className="text-primary-600">
                      {inscription.category?.name}
                    </TableCell>
                    <TableCell>
                      {inscription.team ? (
                        <span className="font-medium text-primary-700">{inscription.team.name}</span>
                      ) : (
                        <span className="text-primary-400 italic">Individual</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <InscriptionStatusBadge status={inscription.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/admin/inscripciones/${inscription.id}`}>
                        <Button variant="outline" size="sm">
                          Revisar
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {inscriptionsData && inscriptionsData.meta.totalPages > 1 && (
          <Pagination
            page={inscriptionsData.meta.page}
            totalPages={inscriptionsData.meta.totalPages}
            total={inscriptionsData.meta.total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        )}
      </div>
    </div>
  );
}
