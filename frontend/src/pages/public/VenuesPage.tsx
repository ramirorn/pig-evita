// ===========================================
// Venues Page — Public
// ===========================================
import { MapPin, Loader2, Navigation, Building2 } from 'lucide-react';
import { useVenues } from '@/hooks/useVenues';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { safeExternalUrl } from '@/lib/utils';

/** Base fija de Google Maps: nunca se arma con datos del backend. */
const MAPS_SEARCH_BASE = 'https://maps.google.com/';

export function VenuesPage() {
  const { data: venuesData, isLoading } = useVenues({ isActive: true });
  const venueCount = venuesData?.data.length || 0;

  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
        <PublicPageHeader
          title="Sedes de Competencia"
          description="Polideportivos, clubes y espacios donde se desarrollan los Juegos Evita Formoseños."
          icon={<MapPin className="h-6 w-6" aria-hidden="true" />}
          actions={
            venueCount > 0 ? (
              // Sobre fondo claro el contador pasa a la paleta institucional:
              // el `bg-white/15` de antes sólo se leía sobre el hero oscuro.
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm">
                <Building2 className="h-4 w-4 text-accent-500" />
                {venueCount} sede{venueCount !== 1 ? 's' : ''} activa{venueCount !== 1 ? 's' : ''}
              </div>
            ) : undefined
          }
        />

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
          </div>
        ) : venuesData?.data && venuesData.data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {venuesData.data.map((venue, idx) => {
              // `address` y `locality` son texto libre del backend: si el helper
              // no puede armar una URL https limpia, no se muestra el link.
              const mapsUrl = safeExternalUrl(MAPS_SEARCH_BASE, {
                q: `${venue.address ?? ''} ${venue.locality ?? ''} Formosa`,
              });

              return (
              <div
                key={venue.id}
                className="card p-6 flex flex-col h-full hover:shadow-lg transition-all hover:-translate-y-0.5 animate-fade-in"
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-celeste-100 to-primary-100 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary-500 block">
                      {venue.department}
                    </span>
                    <span className="text-sm text-primary-400 block">
                      {venue.locality}
                    </span>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-primary-900 mb-2">{venue.name}</h2>
                <p className="text-primary-600 text-sm mb-6 flex-1">
                  {venue.address}
                </p>

                <div className="mt-auto pt-4 border-t border-primary-100 flex justify-between items-center">
                  <span className="text-sm font-medium text-primary-700">
                    {venue.capacity ? `Capacidad: ${venue.capacity}` : 'Sede Oficial'}
                  </span>
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary-600 hover:text-primary-800 text-sm font-medium transition-colors"
                    >
                      <Navigation className="w-4 h-4" /> Cómo llegar
                    </a>
                  ) : (
                    // Sin link, pero la dirección sigue arriba como texto plano:
                    // el dato no desaparece de la pantalla, sólo deja de ser
                    // clickeable.
                    <span className="flex items-center gap-1 text-primary-400 text-sm font-medium">
                      <Navigation className="w-4 h-4" /> Sin mapa disponible
                    </span>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<MapPin className="w-10 h-10" />}
            title="Sin sedes"
            description="No hay sedes cargadas en el sistema."
          />
        )}
      </div>
    </div>
  );
}
