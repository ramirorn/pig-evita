// ===========================================
// HomeNowSection — "Lo que viene": próximos eventos y puerta al mapa
// ===========================================
import { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Map as MapIcon } from 'lucide-react';
import { useAllCalendarEvents } from '@/hooks/useCalendar';
import { useAllVenues } from '@/hooks/useVenues';
import { ROUTES } from '@/lib/constants';
import { UpcomingEventsPanel } from '@/pages/public/news/UpcomingEventsPanel';
import { proximosEventos } from '@/pages/public/news/proximosEventos';

/**
 * Segundo bloque de la landing, después de las noticias: qué viene en el
 * calendario (el mismo panel y el mismo corte de "próximo" que usa /noticias)
 * y una puerta al mapa de calor, la firma visual del sitio.
 *
 * Los eventos y las sedes se piden con los mismos hooks que /noticias, así que
 * la caché se comparte. Sin eventos el panel no desaparece: lo dice y lleva al
 * calendario. La tarjeta del mapa no muestra cifras: la rampa de color es sólo
 * la leyenda del mapa real.
 */
export function HomeNowSection() {
  const calendario = useAllCalendarEvents({ isPublished: true });
  const sedes = useAllVenues({ isActive: true });

  const eventos = useMemo(() => proximosEventos(calendario.data ?? []), [calendario.data]);
  const sedePorId = useMemo(
    () => new Map((sedes.data ?? []).map((v) => [v.id, v.name])),
    [sedes.data],
  );

  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 pb-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingEventsPanel
          eventos={eventos}
          sedePorId={sedePorId}
          estado={calendario.isLoading ? 'cargando' : calendario.isError ? 'error' : 'listo'}
        />

        <Link
          to={ROUTES.IMPACT_MAP}
          className="card card-interactive group flex flex-col justify-between gap-8 p-6 sm:p-8"
        >
          <div>
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-800 text-white">
              <MapIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="type-h2 mb-2 text-primary-900 transition-colors duration-120 group-hover:text-primary-700">
              Mapa de los Juegos
            </h2>
            <p className="max-w-md text-primary-700">
              Mirá qué localidades de la provincia participan y cuántos atletas aporta cada una.
            </p>
          </div>
          <div>
            <div
              aria-hidden="true"
              className="h-3 w-full rounded-full bg-gradient-to-r from-primary-900 via-heat-teal via-45% to-heat-yellow"
            />
            <div className="mt-1.5 flex justify-between text-xs font-medium text-primary-700" aria-hidden="true">
              <span>Menos atletas</span>
              <span>Más atletas</span>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary-800 group-hover:text-primary-900">
              Explorar el mapa
              <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out-soft group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
