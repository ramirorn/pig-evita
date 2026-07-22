// ===========================================
// Inscriptions Admin Page
// ===========================================
import { useState } from 'react';
import { ClipboardCheck, Loader2, Search, Filter } from 'lucide-react';
import { useInscriptions } from '@/hooks/useInscriptions';
import { InscriptionStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'react-router';

export function InscriptionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: inscriptionsData, isLoading } = useInscriptions({
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const getStatusBadge = (status: InscriptionStatus) => {
    switch (status) {
      case InscriptionStatus.PENDIENTE:
        return <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">Pendiente</Badge>;
      case InscriptionStatus.REVISADA:
        return <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">Revisada</Badge>;
      case InscriptionStatus.APROBADA:
        return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Aprobada</Badge>;
      case InscriptionStatus.RECHAZADA:
        return <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">Rechazada</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-800">Inscripciones</h1>
            <p className="text-sm text-primary-500">Gestión y revisión de solicitudes de inscripción</p>
          </div>
        </div>
      </div>

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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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

        <div className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-primary-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Cargando inscripciones...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-primary-500 uppercase bg-primary-50 border-b border-primary-100">
                  <tr>
                    <th className="px-6 py-3">Código QR</th>
                    <th className="px-6 py-3">Solicitante</th>
                    <th className="px-6 py-3">Categoría</th>
                    <th className="px-6 py-3">Equipo (Opcional)</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-100">
                  {inscriptionsData?.data.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-primary-500">
                        No se encontraron inscripciones.
                      </td>
                    </tr>
                  ) : (
                    inscriptionsData?.data.map((inscription) => (
                      <tr key={inscription.id} className="hover:bg-primary-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-primary-600">
                          {inscription.qrCode}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-primary-900">
                            {inscription.participant?.lastName}, {inscription.participant?.firstName}
                          </div>
                          <div className="text-xs text-primary-500">DNI: {inscription.participant?.dni}</div>
                        </td>
                        <td className="px-6 py-4 text-primary-600">
                          {inscription.category?.name}
                        </td>
                        <td className="px-6 py-4">
                          {inscription.team ? (
                            <span className="font-medium text-primary-700">{inscription.team.name}</span>
                          ) : (
                            <span className="text-primary-400 italic">Individual</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(inscription.status)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/admin/inscripciones/${inscription.id}`}>
                            <Button variant="outline" size="sm">
                              Revisar
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
