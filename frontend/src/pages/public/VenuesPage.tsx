import { MapPin, Loader2, Navigation } from 'lucide-react';
import { useVenues } from '@/hooks/useVenues';

export function VenuesPage() {
  const { data: venuesData, isLoading } = useVenues({ isActive: true });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12 animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
          <MapPin className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary-800 mb-4">Sedes de Competencia</h1>
        <p className="text-primary-600 max-w-2xl mx-auto text-lg">
          Descubrí todos los polideportivos, clubes y espacios donde se desarrollan los Juegos Evita Formosa.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venuesData?.data.map((venue) => (
            <div key={venue.id} className="card p-6 flex flex-col h-full hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
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

          {venuesData?.data.length === 0 && (
            <div className="col-span-full py-12 text-center text-primary-500 bg-white rounded-2xl border border-primary-100">
              No hay sedes cargadas en el sistema.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
