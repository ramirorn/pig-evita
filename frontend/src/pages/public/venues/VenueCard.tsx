// ===========================================
// VenueCard — tarjeta del listado público de sedes
// ===========================================
import { Navigation, Users, CalendarDays } from 'lucide-react';
import { Link } from 'react-router';
import type { Venue } from '@/types';
import { safeExternalUrl } from '@/lib/utils';
import { VenuePhoto } from '@/components/venues/VenuePhoto';
import { LocalityChip } from '@/components/localityMap/LocalityChip';

/** Base fija de Google Maps: nunca se arma con datos del backend. */
const MAPS_SEARCH_BASE = 'https://maps.google.com/';

interface VenueCardProps {
  venue: Venue;
  /**
   * Eventos publicados **futuros** que apuntan a esta sede.
   *
   * `null` significa "no se pudo calcular" y no "cero": el cruce se hace en el
   * cliente y se apaga por encima de cierto volumen (ver `VenuesPage`). Con
   * `null` no se pinta nada, que es distinto de pintar un cero que sería
   * mentira.
   */
  eventosProgramados: number | null;
}

export function VenueCard({ venue, eventosProgramados }: VenueCardProps) {
  // `address` y `locality` son texto libre del backend: si el helper no puede
  // armar una URL https limpia, no se muestra el link.
  const mapsUrl = safeExternalUrl(MAPS_SEARCH_BASE, {
    q: `${venue.address ?? ''} ${venue.locality ?? ''} Formosa`,
  });

  // El departamento sólo se nombra aparte cuando difiere de la localidad (en las
  // tres sedes reales es Formosa/Formosa). La localidad va como chip hacia el mapa.
  const departamento =
    venue.department && venue.department !== venue.locality ? venue.department : null;

  return (
    <article className="card overflow-hidden flex flex-col h-full">
      {/* Portada: la foto real de la sede (16:9 fijo, sin salto de layout) o un
          placeholder decorativo con los colores del sitio. Nunca una foto
          inventada. */}
      <VenuePhoto imageUrl={venue.imageUrl} name={venue.name} variant="cover" />

      <div className="p-6 flex flex-col flex-1">
        {/* El nombre primero. Antes el departamento y la localidad estaban arriba
            a la derecha en mayúsculas y el nombre debajo y a la izquierda: el ojo
            iba primero al dato secundario, cuando lo que la persona busca es la
            sede. */}
        <div className="flex items-start gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="type-h3 text-primary-900">{venue.name}</h2>
            {/* `primary-600` sobre blanco da 9.26:1. El `primary-400` que había
                acá daba 3.75:1 en texto de 14 px, por debajo del 4.5:1 de AA — y
                es la localidad de la sede, o sea información, no decoración. */}
            {(venue.locality || departamento) && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-primary-600">
                <LocalityChip name={venue.locality} />
                {departamento && <span>Departamento {departamento}</span>}
              </p>
            )}
          </div>
        </div>

        {venue.address && (
          <p className="text-primary-600 text-sm mb-4 flex-1">{venue.address}</p>
        )}

        <div className="mb-4 space-y-1.5 text-sm text-primary-600 empty:hidden">
          {/* Antes esta ranura decía "Sede Oficial" cuando no se sabía la
              capacidad. Eran dos cosas distintas en el mismo lugar, y encima
              "Sede Oficial" no distingue nada: todas las sedes del listado son
              oficiales. Si no hay capacidad, no hay fila. */}
          {typeof venue.capacity === 'number' && venue.capacity > 0 && (
            <p className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary-500" aria-hidden="true" />
              Capacidad <span className="tabular-nums">{venue.capacity.toLocaleString('es-AR')}</span>
            </p>
          )}

          {/* Lo único que esta página sabía decir de una sede era su dirección.
              Los eventos publicados traen `venueId`, así que el dato para contar
              lo que pasa en ella ya estaba: sólo había que cruzarlo. */}
          {eventosProgramados !== null && eventosProgramados > 0 && (
            <p className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-primary-500" aria-hidden="true" />
              <Link
                to="/calendario"
                className="rounded font-medium text-primary-700 underline underline-offset-2 transition-colors duration-120 hover:text-primary-900 active:text-primary-950 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
              >
                <span className="tabular-nums">{eventosProgramados}</span> {eventosProgramados === 1 ? 'evento programado' : 'eventos programados'}
              </Link>
            </p>
          )}
        </div>

        <div className="mt-auto pt-4 border-t border-primary-100">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded text-primary-600 hover:text-primary-800 active:text-primary-900 text-sm font-medium transition-colors duration-120 pointer-coarse:min-h-11"
            >
              <Navigation className="w-4 h-4" aria-hidden="true" /> Cómo llegar
            </a>
          ) : (
            // Sin link, pero la dirección sigue arriba como texto plano: el dato
            // no desaparece de la pantalla, sólo deja de ser clickeable.
            <span className="inline-flex items-center gap-1 text-primary-600 text-sm font-medium">
              <Navigation className="w-4 h-4" aria-hidden="true" /> Sin mapa disponible
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
