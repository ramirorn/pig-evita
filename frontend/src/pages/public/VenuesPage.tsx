// ===========================================
// Venues Page — Public
// ===========================================
import { MapPin, Loader2, Navigation, Building2 } from 'lucide-react';
import { useVenues } from '@/hooks/useVenues';
import { PageHero } from '@/components/shared/PageHero';
import { EmptyState } from '@/components/shared/EmptyState';

export function VenuesPage() {
  const { data: venuesData, isLoading } = useVenues({ isActive: true });
  const venueCount = venuesData?.data.length || 0;

  return (
    <div>
      <PageHero
        title="Sedes de Competencia"
        description="Descubrí todos los polideportivos, clubes y espacios donde se desarrollan los Juegos Evita Formosa."
        icon={<MapPin className="w-8 h-8 text-white" />}
        variant="celeste"
      >
        {venueCount > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-md border border-white/20 rounded-full text-sm font-semibold text-white">
            <Building2 className="w-4 h-4 text-accent-400" />
            {venueCount} sede{venueCount !== 1 ? 's' : ''} activa{venueCount !== 1 ? 's' : ''}
          </div>
        )}
      </PageHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
          </div>
        ) : venuesData?.data && venuesData.data.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {venuesData.data.map((venue, idx) => (
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

                <h3 className="text-xl font-bold text-primary-900 mb-2">{venue.name}</h3>
                <p className="text-primary-600 text-sm mb-6 flex-1">
                  {venue.address}
                </p>

                <div className="mt-auto pt-4 border-t border-primary-100 flex justify-between items-center">
                  <span className="text-sm font-medium text-primary-700">
                    {venue.capacity ? `Capacidad: ${venue.capacity}` : 'Sede Oficial'}
                  </span>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(venue.address + ' ' + venue.locality + ' Formosa')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary-600 hover:text-primary-800 text-sm font-medium transition-colors"
                  >
                    <Navigation className="w-4 h-4" /> Cómo llegar
                  </a>
                </div>
              </div>
            ))}
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
