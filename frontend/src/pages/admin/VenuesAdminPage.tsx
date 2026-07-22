// ===========================================
// Venues Admin Page
// ===========================================
import { useState } from 'react';
import { MapPin, Search, Plus, Loader2 } from 'lucide-react';
import { useVenues } from '@/hooks/useVenues';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function VenuesAdminPage() {
  const [search, setSearch] = useState('');
  const { data: venuesData, isLoading } = useVenues();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-800">Sedes de Competencia</h1>
            <p className="text-sm text-primary-500">Gestión de polideportivos y clubes</p>
          </div>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Sede
        </Button>
      </div>

      <div className="card p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
          <Input 
            placeholder="Buscar por nombre o localidad..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="card p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-primary-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p>Cargando sedes...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-primary-500 uppercase bg-primary-50 border-b border-primary-100">
                <tr>
                  <th className="px-6 py-3">Nombre</th>
                  <th className="px-6 py-3">Ubicación</th>
                  <th className="px-6 py-3">Capacidad</th>
                  <th className="px-6 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {venuesData?.data.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-primary-500">
                      No se encontraron sedes.
                    </td>
                  </tr>
                ) : (
                  venuesData?.data.map((venue) => (
                    <tr key={venue.id} className="hover:bg-primary-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-primary-900">
                        {venue.name}
                      </td>
                      <td className="px-6 py-4 text-primary-600">
                        {venue.locality}, {venue.department}
                      </td>
                      <td className="px-6 py-4 text-primary-600">
                        {venue.capacity || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
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
  );
}
