// ===========================================
// Audit Page
// ===========================================
import { useState } from 'react';
import { Shield, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { localIsoFromDate } from '@/lib/datePicker';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { FilterPanel } from '@/components/shared/FilterPanel';

// Mock data for audit logs
type AuditLog = (typeof MOCK_AUDIT_LOGS)[number];

const MOCK_AUDIT_LOGS = [
  { id: '1', action: 'LOGIN', user: 'admin@evita.com', entity: 'Auth', timestamp: new Date().toISOString(), details: 'Inicio de sesión exitoso' },
  { id: '2', action: 'CREATE', user: 'admin@evita.com', entity: 'Competition', timestamp: new Date(Date.now() - 3600000).toISOString(), details: 'Competencia creada: Fútbol Sub 14' },
  { id: '3', action: 'UPDATE', user: 'delegado@evita.com', entity: 'Inscription', timestamp: new Date(Date.now() - 7200000).toISOString(), details: 'Inscripción actualizada: Equipo Los Pumas' },
  { id: '4', action: 'DELETE', user: 'admin@evita.com', entity: 'News', timestamp: new Date(Date.now() - 86400000).toISOString(), details: 'Noticia eliminada: Suspensión por lluvia' },
];

export function AuditPage() {
  const [search, setSearch] = useState('');
  const [day, setDay] = useState('');

  const getActionColor = (action: string) => {
    switch (action) {
      case 'LOGIN': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CREATE': return 'bg-green-50 text-green-700 border-green-200';
      case 'UPDATE': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'DELETE': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const filtered = MOCK_AUDIT_LOGS.filter(
    (log) =>
      (log.user.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.details.toLowerCase().includes(search.toLowerCase())) &&
      // El día se compara en hora local: un evento de las 22 h de Argentina es de ese día.
      (!day || localIsoFromDate(new Date(log.timestamp)) === day),
  );

  const columns: DataTableColumn<AuditLog>[] = [
    {
      id: 'timestamp',
      header: 'Fecha y Hora',
      className: 'text-primary-600 font-mono text-xs tabular-nums',
      mobile: 'secondary',
      cell: (log) => new Date(log.timestamp).toLocaleString('es-AR'),
    },
    {
      id: 'user',
      header: 'Usuario',
      className: 'font-medium text-primary-900',
      mobile: 'primary',
      cell: (log) => log.user,
    },
    {
      id: 'action',
      header: 'Acción',
      mobile: 'secondary',
      cell: (log) => (
        <Badge variant="outline" className={getActionColor(log.action)}>
          {log.action}
        </Badge>
      ),
    },
    {
      id: 'entity',
      header: 'Entidad',
      className: 'text-primary-600',
      mobile: 'secondary',
      cell: (log) => log.entity,
    },
    {
      id: 'details',
      header: 'Detalles',
      className: 'text-primary-800',
      mobile: 'secondary',
      cell: (log) => log.details,
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
        rows={filtered}
        getRowId={(log) => log.id}
        isLoading={false}
        hasActiveFilters={Boolean(search.trim() || day)}
        onClearFilters={() => {
          setSearch('');
          setDay('');
        }}
        emptyIcon={<Shield className="w-10 h-10" />}
        emptyTitle="Sin registros de auditoría"
        emptyDescription="No hay eventos registrados que coincidan con la búsqueda."
        toolbar={
          <>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar por usuario o acción..."
                aria-label="Buscar en la auditoría"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <FilterPanel activeCount={day ? 1 : 0} className="md:w-auto">
              <DatePicker
                aria-label="Filtrar por día"
                value={day}
                onChange={setDay}
                wrapperClassName="w-full md:w-48"
                pickerLabel="Elegir día"
              />
            </FilterPanel>
          </>
        }
      />
    </div>
  );
}
