// ===========================================
// Audit Page
// ===========================================
import { useState } from 'react';
import { Shield, Search, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

// Mock data for audit logs
const MOCK_AUDIT_LOGS = [
  { id: '1', action: 'LOGIN', user: 'admin@evita.com', entity: 'Auth', timestamp: new Date().toISOString(), details: 'Inicio de sesión exitoso' },
  { id: '2', action: 'CREATE', user: 'admin@evita.com', entity: 'Competition', timestamp: new Date(Date.now() - 3600000).toISOString(), details: 'Competencia creada: Fútbol Sub 14' },
  { id: '3', action: 'UPDATE', user: 'delegado@evita.com', entity: 'Inscription', timestamp: new Date(Date.now() - 7200000).toISOString(), details: 'Inscripción actualizada: Equipo Los Pumas' },
  { id: '4', action: 'DELETE', user: 'admin@evita.com', entity: 'News', timestamp: new Date(Date.now() - 86400000).toISOString(), details: 'Noticia eliminada: Suspensión por lluvia' },
];

export function AuditPage() {
  const [search, setSearch] = useState('');

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
      log.user.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Auditoría del Sistema"
        description="Registro de actividades, eventos de seguridad y cambios realizados"
        icon={<Shield className="w-5 h-5 text-white" />}
      />

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input 
              placeholder="Buscar por usuario o acción..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-40">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
              <Input type="date" className="pl-9" />
            </div>
          </div>
        </div>

        <div className="relative">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Shield className="w-10 h-10" />}
              title="Sin registros de auditoría"
              description="No hay eventos registrados que coincidan con la búsqueda."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-primary-600 font-mono text-xs">
                      {new Date(log.timestamp).toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell className="font-medium text-primary-900">{log.user}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getActionColor(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-primary-600">{log.entity}</TableCell>
                    <TableCell className="text-primary-800">{log.details}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
