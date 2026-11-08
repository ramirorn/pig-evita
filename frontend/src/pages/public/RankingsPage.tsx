// ===========================================
// Rankings Page — Public
// ===========================================
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '@/lib/constants';
import { Medal, Search, Trophy } from 'lucide-react';
import { useAllCompetitions } from '@/hooks/useCompetitions';
import { Input } from '@/components/ui/input';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { PublicListState } from '@/components/shared/PublicListState';
import { CardGridSkeleton } from '@/components/shared/CardGridSkeleton';
import { CompetitionCard } from './rankings/CompetitionCard';
import { columnasSegunVolumen } from '@/lib/gridVolumen';

export function RankingsPage() {
  const [search, setSearch] = useState('');

  // Recorre la paginación hasta el final. Éste era el caso más grave de la
  // familia R29/S06/S13: `useCompetitions()` traía 20 filas y **después** se
  // descartaban las `BORRADOR` y se aplicaba la búsqueda, las dos cosas en
  // memoria. Con 20 borradores en la primera página la pantalla se veía vacía
  // teniendo competencias activas en la segunda.
  const { data: competitions, isLoading, isError, refetch, isFetching } = useAllCompetitions();

  const filteredCompetitions = useMemo(() => {
    const termino = search.trim().toLowerCase();

    return (competitions ?? []).filter((comp) => {
      // El descarte de borradores sigue en el cliente, pero ahora sobre el
      // conjunto **completo**. No pasa al servidor porque `status` es una
      // igualdad de un solo valor y esta pantalla necesita ACTIVA *y*
      // FINALIZADA: serían dos requests para ahorrar un `filter()` sobre un
      // listado chico (ver el comentario de `useAllCompetitions`).
      if (comp.status === 'BORRADOR') return false;
      if (termino === '') return true;

      return [comp.name, comp.discipline?.name, comp.category?.name].some((campo) =>
        campo?.toLowerCase().includes(termino),
      );
    });
  }, [competitions, search]);

  const hayBusqueda = search.trim() !== '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
      <PublicPageHeader
        title="Rankings y Resultados"
        description="Tablas de posiciones, fixtures y resultados de las competencias activas."
        icon={<Medal className="h-6 w-6" aria-hidden="true" />}
        actions={
          <div className="relative w-full md:w-96">
            <Search
              className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-primary-600"
              aria-hidden="true"
            />
            <Input
              className="h-11 rounded-full border-primary-200 bg-white/80 pl-11 text-sm shadow-[0_10px_40px_-10px_rgba(0,45,108,0.08)] backdrop-blur-xl focus-visible:ring-primary-500"
              placeholder="Buscar torneo, disciplina o categoría..."
              aria-label="Buscar competencias"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      />

      <PublicListState
        isLoading={isLoading}
        isEmpty={isError || filteredCompetitions.length === 0}
        skeleton={<CardGridSkeleton cantidad={3} alto="h-64" />}
        empty={
          <EmptyState
            icon={<Trophy className="w-10 h-10" />}
            title={isError ? 'No pudimos cargar los torneos' : hayBusqueda ? 'Ningún torneo coincide' : 'Todavía no hay torneos publicados'}
            description={
              // La frase vieja —"con los filtros aplicados"— se mostraba igual
              // con la búsqueda vacía, afirmando que había filtros que no
              // había. Mismo arreglo que ya lleva `NewsPage`.
              isError
                ? 'Puede ser un problema de conexión. Probá de nuevo en unos segundos.'
                : hayBusqueda
                  ? 'Revisá cómo escribiste la búsqueda o probá con el nombre de la disciplina.'
                  : 'Cuando se publiquen vas a ver acá las tablas de posiciones y los resultados. Mientras tanto, mirá el calendario.'
            }
            action={
              isError ? (
                <button type="button" onClick={() => void refetch()} disabled={isFetching} className="">
                  Reintentar
                </button>
              ) : hayBusqueda ? (
                <button type="button" onClick={() => setSearch('')} className="">
                  Borrar la búsqueda
                </button>
              ) : (
                <Link to={ROUTES.CALENDAR} className="">
                  Ver el calendario
                </Link>
              )
            }
          />
        }
      >
        {/* Con una sola competencia visible —que es el caso real de hoy— una
            grilla de 3 columnas dejaba dos tercios de fila vacíos. */}
        <div className={columnasSegunVolumen(filteredCompetitions.length)}>
          {filteredCompetitions.map((competition) => (
            <CompetitionCard key={competition.id} competition={competition} />
          ))}
        </div>
      </PublicListState>
    </div>
  );
}
