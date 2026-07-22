// ===========================================
// Audit Page
// ===========================================
import { useState } from 'react';
import { Shield, Search, Calendar, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary-800">Auditoría del Sistema</h1>
          <p className="text-sm text-primary-500">Registro de actividades y cambios realizados</p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
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

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-primary-500 uppercase bg-primary-50 border-b border-primary-100">
              <tr>
                <th className="px-6 py-3">Fecha y Hora</th>
                <th className="px-6 py-3">Usuario</th>
                <th className="px-6 py-3">Acción</th>
                <th className="px-6 py-3">Entidad</th>
                <th className="px-6 py-3">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {MOCK_AUDIT_LOGS.map((log) => (
                <tr key={log.id} className="hover:bg-primary-50/50 transition-colors">
                  <td className="px-6 py-4 text-primary-600 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-primary-900">
                    {log.user}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={`font-bold ${getActionColor(log.action)}`}>
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-primary-700 font-medium">
                    {log.entity}
                  </td>
                  <td className="px-6 py-4 text-primary-600 max-w-xs truncate" title={log.details}>
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary-400 flex-shrink-0" />
                      {log.details}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
