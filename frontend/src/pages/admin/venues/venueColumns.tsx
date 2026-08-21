// ===========================================
// venueColumns — definición de las columnas de la tabla de sedes
// ===========================================
import { Building2, ExternalLink, MapPin, MoreVertical, Pencil, Trash2, Users } from 'lucide-react';
import type { Venue } from '@/types';
import type { DataTableColumn } from '@/components/shared/DataTable';
import { safeExternalUrl } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Base fija de Google Maps: nunca se arma con datos del backend. */
const MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/';

interface VenueColumnActions {
  onEdit: (venue: Venue) => void;
  onDelete: (venue: Venue) => void;
}

/**
 * Cómo se ve una sede dentro de la tabla. Es la mitad más larga de la página y
 * no depende de nada suyo salvo qué hacer al editar o eliminar, así que se
 * define acá y la página queda con el layout y el estado de filtros.
 */
export function createVenueColumns({ onEdit, onDelete }: VenueColumnActions): DataTableColumn<Venue>[] {
  return [
    {
      id: 'venue',
      header: 'Sede / Instalación',
      rowHeader: true,
      headClassName: 'min-w-[220px]',
      cell: (venue) => (
        <div>
          <p className="font-semibold text-primary-900 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
            {venue.name}
          </p>
          {venue.address && (
            <p className="text-xs text-primary-600 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-primary-400 shrink-0" aria-hidden="true" />
              {venue.address}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Ubicación',
      headClassName: 'min-w-[160px]',
      cell: (venue) => (
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary-800">{venue.locality}</p>
          <Badge
            variant="outline"
            className="text-[11px] bg-white text-primary-600 border-primary-200"
          >
            Dpto. {venue.department}
          </Badge>
        </div>
      ),
    },
    {
      id: 'capacity',
      header: 'Capacidad',
      headClassName: 'min-w-[120px]',
      cell: (venue) =>
        venue.capacity ? (
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md border border-primary-100">
            <Users className="w-3.5 h-3.5 text-primary-500" aria-hidden="true" />
            {venue.capacity.toLocaleString('es-AR')} personas
          </div>
        ) : (
          // `primary-400` daba 3.75:1 sobre blanco (falla AA); `primary-500` da 6.52:1.
          <span className="text-xs text-primary-500 italic">Sin especificar</span>
        ),
    },
    {
      id: 'status',
      header: 'Estado',
      headClassName: 'min-w-[100px]',
      cell: (venue) =>
        venue.isActive ? (
          // `emerald-*` y `gray-*` no pertenecen a la paleta institucional.
          <Badge
            variant="outline"
            className="bg-secondary-50 text-secondary-700 border-secondary-200"
          >
            Activa
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-primary-700 border-primary-200">
            Inactiva
          </Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      hideHeader: true,
      interactive: true,
      headClassName: 'w-[100px] text-right',
      className: 'text-right',
      cell: (venue) => {
        // `address` y `locality` son texto libre del backend: si el helper
        // no puede armar una URL https limpia, el item del menú no se muestra.
        const mapsUrl = safeExternalUrl(MAPS_SEARCH_BASE, {
          api: '1',
          query: `${venue.name} ${venue.address ?? ''} ${venue.locality ?? ''} Formosa`,
        });

        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-600 hover:text-primary-900 hover:bg-primary-100"
              onClick={() => onEdit(venue)}
              aria-label={`Editar ${venue.name}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-600 hover:text-primary-900 hover:bg-primary-100"
                  aria-label={`Más acciones para ${venue.name}`}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => onEdit(venue)}
                  className="gap-2 text-primary-800"
                >
                  <Pencil className="w-4 h-4 text-primary-600" />
                  Editar Sede
                </DropdownMenuItem>

                {mapsUrl && (
                  <DropdownMenuItem asChild className="gap-2 text-primary-800">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4 text-primary-600" />
                      Ver en Google Maps
                    </a>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => onDelete(venue)}
                  // `text-destructive` a secas no existe en el `@theme`: no se genera.
                  className="gap-2 text-destructive-600 focus:text-destructive-700 focus:bg-destructive-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar Sede
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
