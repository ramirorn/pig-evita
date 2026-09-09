// ===========================================
// Venues Page — Public
// ===========================================
import { useMemo, useState } from 'react';
import { MapPin, Building2 } from 'lucide-react';
import { useAllVenues } from '@/hooks/useVenues';
import { useAllCalendarEvents } from '@/hooks/useCalendar';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { PublicListState } from '@/components/shared/PublicListState';
import { CardGridSkeleton } from '@/components/shared/CardGridSkeleton';
import { VenueCard } from './venues/VenueCard';
import { cn } from '@/lib/utils';
import { columnasSegunVolumen } from '@/lib/gridVolumen';

const TODOS = 'TODOS';

/**
 * Tope del cruce en el cliente para contar eventos por sede.
 *
 * El conteo se deriva trayendo **todos** los eventos publicados y agrupándolos
 * por `venueId`. Con los 3 eventos cargados eso es gratis y se sirve del cache
 * que ya llenó `CalendarPage` (misma clave de query). Con 5.000 es un
 * despropósito: serían 50 requests para pintar un número.
 *
 * La salida correcta es que `/venues` devuelva el conteo en su `_count`, y eso
 * **no se puede hoy**: `CalendarEvent` no tiene `@relation` con `Venue` en
 * `schema.prisma`, así que Prisma no tiene por dónde contar. Está anotado como
 * U13 y es trabajo de backend.
 *
 * Mientras tanto, por encima de este tope la sección simplemente no se pinta.
 * Es una curita y se sabe que lo es: la alternativa era no mostrar nunca la
 * conexión entre una sede y lo que pasa en ella hasta que exista la migración.
 */
const TOPE_DE_CRUCE_EN_CLIENTE = 200;

export function VenuesPage() {
  // Recorre la paginación hasta el final (R29/S06/S13): antes era `useVenues`
  // sin `limit` —20 filas— y de ahí salían el chip contador y las opciones del
  // filtro por departamento.
  const { data: venues, isLoading } = useAllVenues({ isActive: true });
  const { data: eventos } = useAllCalendarEvents({ isPublished: true });

  const [departamento, setDepartamento] = useState<string>(TODOS);

  const todasLasSedes = useMemo(() => venues ?? [], [venues]);

  /**
   * El contador del encabezado.
   *
   * Antes salía de `venuesData?.data.length`, que es **la cantidad de la página
   * actual**, no el total: con 25 sedes el chip decía "20 sedes activas". Acá
   * el hook recorre todas las páginas, así que la longitud del arreglo *es* el
   * total (`meta.total`) y no la primera página de él.
   */
  const totalDeSedes = todasLasSedes.length;

  /**
   * Eventos futuros por sede.
   *
   * `null` cuando no se pudo calcular —todavía no llegaron los eventos, o hay
   * demasiados—, que es distinto de un cero: un cero afirmaría que en esa sede
   * no hay nada programado, y eso no se sabe.
   */
  const eventosPorSede = useMemo<Map<string, number> | null>(() => {
    if (!eventos) return null;
    if (eventos.length > TOPE_DE_CRUCE_EN_CLIENTE) return null;

    const hoy = new Date();
    const corte = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();

    const conteo = new Map<string, number>();
    for (const evento of eventos) {
      if (!evento.venueId) continue;
      const inicio = new Date(evento.startDate).getTime();
      if (Number.isNaN(inicio) || inicio < corte) continue;
      conteo.set(evento.venueId, (conteo.get(evento.venueId) ?? 0) + 1);
    }
    return conteo;
  }, [eventos]);

  /**
   * Los departamentos que **de verdad** tienen sedes, derivados de los datos —
   * mismo criterio que `opcionesDeMes` en el calendario.
   *
   * Hoy las tres sedes son del departamento Formosa, así que hay una sola
   * opción y el filtro no se pinta: un filtro con una opción es decoración.
   */
  const departamentos = useMemo(
    () => [...new Set(todasLasSedes.map((v) => v.department).filter(Boolean))].sort(),
    [todasLasSedes],
  );

  const sedes = useMemo(
    () =>
      departamento === TODOS
        ? todasLasSedes
        : todasLasSedes.filter((v) => v.department === departamento),
    [todasLasSedes, departamento],
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      <PublicPageHeader
        title="Sedes de Competencia"
        description="Polideportivos, clubes y espacios donde se desarrollan los Juegos Evita Formoseños."
        icon={<MapPin className="h-6 w-6" aria-hidden="true" />}
        actions={
          totalDeSedes > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm">
              {/* `accent-500` sobre blanco da 2.05:1: como icono portador de
                  significado no llegaría al 3:1 de AA. Acá es puramente
                  decorativo —el significado está en el texto de al lado— y por
                  eso va con `aria-hidden`. */}
              <Building2 className="h-4 w-4 text-accent-700" aria-hidden="true" />
              {totalDeSedes} sede{totalDeSedes !== 1 ? 's' : ''} activa{totalDeSedes !== 1 ? 's' : ''}
            </div>
          ) : undefined
        }
      />

      {departamentos.length > 1 && (
        <div role="group" aria-label="Filtrar sedes por departamento" className="mb-8 flex flex-wrap gap-2">
          {[TODOS, ...departamentos].map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={departamento === opcion}
              onClick={() => setDepartamento(opcion)}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors',
                departamento === opcion
                  ? 'bg-primary-800 text-white'
                  : 'border border-primary-400 bg-white text-primary-600 hover:bg-primary-50',
              )}
            >
              {opcion === TODOS ? 'Todos los departamentos' : opcion}
            </button>
          ))}
        </div>
      )}

      <PublicListState
        isLoading={isLoading}
        isEmpty={sedes.length === 0}
        skeleton={<CardGridSkeleton cantidad={3} alto="h-64" />}
        empty={
          <EmptyState
            icon={<MapPin className="w-10 h-10" />}
            title="Sin sedes"
            description={
              departamento === TODOS
                ? 'No hay sedes cargadas en el sistema.'
                : 'No hay sedes activas en ese departamento.'
            }
          />
        }
      >
        <div className={columnasSegunVolumen(sedes.length)}>
          {sedes.map((venue, idx) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              index={idx}
              eventosProgramados={
                eventosPorSede === null ? null : eventosPorSede.get(venue.id) ?? 0
              }
            />
          ))}
        </div>
      </PublicListState>
    </div>
  );
}
