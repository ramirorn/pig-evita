// ===========================================
// Venues Admin Page
// ===========================================
import { useState } from 'react';
import { MapPin, Search, Plus, Pencil } from 'lucide-react';
import { useVenues } from '@/hooks/useVenues';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { SkeletonTable } from '@/components/shared/SkeletonTable';
import { EmptyState } from '@/components/shared/EmptyState';

export function VenuesAdminPage() {
  const [search, setSearch] = useState('');
  const { data: venuesData, isLoading } = useVenues();

  const filtered = (venuesData?.data || []).filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.locality.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sedes de Competencia"
        description="Gestión de polideportivos, clubes y complejos deportivos"
        icon={<MapPin className="w-5 h-5 text-white" />}
        actions={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Sede
          </Button>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-primary-100 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <Input 
              placeholder="Buscar por nombre o localidad..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="relative">
          {isLoading ? (
            <SkeletonTable rows={5} columns={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<MapPin className="w-10 h-10" />}
              title="Sin sedes registradas"
              description="No se encontraron sedes con los criterios de búsqueda."
              action={
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> Registrar Primera Sede
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Capacidad</TableHead>
                  <TableHead className="w-[100px] text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((venue) => (
                  <TableRow key={venue.id}>
                    <TableCell className="font-medium text-primary-900">
                      <div>
                        <p className="font-semibold">{venue.name}</p>
                        {venue.address && <p className="text-xs text-primary-500">{venue.address}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-primary-600">
                      {venue.locality}, {venue.department}
                    </TableCell>
                    <TableCell className="text-primary-600">
                      {venue.capacity ? `${venue.capacity} personas` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
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
