// ===========================================
// News Page — Public
// ===========================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Newspaper, Search, X } from 'lucide-react';
import { useNewsList } from '@/hooks/useNews';
import { useAllCalendarEvents } from '@/hooks/useCalendar';
import { useAllVenues } from '@/hooks/useVenues';
import { useDebounce } from '@/hooks/useDebounce';
import { PublicPageHeader } from '@/components/shared/PublicPageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { PublicListState } from '@/components/shared/PublicListState';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { News } from '@/types';
import { NewsListSkeleton } from './news/NewsListSkeleton';
import { NewsCard } from './news/NewsCard';
import { NewsMosaicCard } from './news/NewsMosaicCard';
import { NewsTickerCard } from './news/NewsTickerCard';
import { NewsHeroCarousel } from './news/NewsHeroCarousel';
import { NewsSidebarList } from './news/NewsSidebarList';
import { UpcomingEventsPanel } from './news/UpcomingEventsPanel';
import { NOTAS_EN_PORTADA, repartirPortada } from './news/newsLayout';
import { proximosEventos } from './news/proximosEventos';
import {
  NewsOriginFilter,
  type OrigenDeNoticia,
} from './news/NewsOriginFilter';

/** Página de la grilla de resultados (búsqueda, filtro o "Ver todas"). */
const NOTICIAS_POR_PAGINA = 12;

/**
 * Columnas de la tira superior en escritorio según cuántas notas lleva. Clases
 * completas: Tailwind no ve las armadas por interpolación.
 */
const COLUMNAS_DE_LA_TIRA: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

/**
 * `/noticias` tiene dos vistas y una sola regla para elegir:
 *
 * - **Portada editorial** (vista "Todas", sin búsqueda): tira de notas
 *   compactas, carrusel con las 4 más recientes junto a "Próximos eventos",
 *   mosaico "No te pierdas" con la lista "Más recientes", y debajo el archivo
 *   con lo que no entró. Ninguna nota se repite entre secciones.
 * - **Grilla de resultados** (búsqueda, filtro de origen o "Ver todas"): una
 *   grilla pareja y paginada, en orden de publicación.
 *
 * Con un filtro activo no se reparte el resultado en el mosaico: un carrusel
 * "destacado" de resultados de búsqueda destacaría notas por coincidir, no por
 * ser importantes, y quien busca quiere recorrer la lista entera.
 */
export function NewsPage() {
  const [search, setSearch] = useState('');
  const [origen, setOrigen] = useState<OrigenDeNoticia>(undefined);
  const [verTodas, setVerTodas] = useState(false);
  const [page, setPage] = useState(1);
  const [paginaArchivo, setPaginaArchivo] = useState(1);
  const busqueda = useDebounce(search.trim());
  const [enfocarResultados, setEnfocarResultados] = useState(false);

  const hayFiltro = Boolean(busqueda) || origen !== undefined;
  const enListado = hayFiltro || verTodas;

  // ---- Portada: las 18 más recientes, repartidas entre las secciones.
  const portada = useNewsList(
    { isPublished: true, page: 1, limit: NOTAS_EN_PORTADA },
    { enabled: !enListado },
  );
  const totalPublicadas = portada.data?.meta.total ?? 0;
  const paginasDeArchivo = Math.max(0, (portada.data?.meta.totalPages ?? 1) - 1);

  // ---- Archivo: lo que no entró en la portada. Mismo tamaño de página que la
  // portada, así "la página 2 del backend" es exactamente lo que sigue.
  const archivo = useNewsList(
    { isPublished: true, page: paginaArchivo + 1, limit: NOTAS_EN_PORTADA },
    { enabled: !enListado && paginasDeArchivo > 0 },
  );

  // ---- Grilla de resultados: búsqueda y filtro los resuelve el backend
  // (`/news?search=&isExternal=`), nunca un `filter()` en memoria (R29).
  const resultados = useNewsList(
    {
      isPublished: true,
      page,
      limit: NOTICIAS_POR_PAGINA,
      search: busqueda || undefined,
      isExternal: origen,
    },
    { enabled: enListado },
  );

  // ---- Calendario: mismo hook y misma clave que /calendario (cache compartido).
  const calendario = useAllCalendarEvents({ isPublished: true });
  const sedes = useAllVenues({ isActive: true });

  // Cambiar la búsqueda o el filtro reinicia la paginación.
  useEffect(() => {
    setPage(1);
  }, [busqueda, origen]);

  const reparto = useMemo(
    () => repartirPortada(portada.data?.data ?? []),
    [portada.data],
  );
  const eventos = useMemo(
    () => proximosEventos(calendario.data ?? []),
    [calendario.data],
  );
  const sedePorId = useMemo(
    () => new Map((sedes.data ?? []).map((v) => [v.id, v.name])),
    [sedes.data],
  );

  const abrirTodas = () => {
    setVerTodas(true);
    setPage(1);
    // El contenido cambia de forma entera: la grilla lleva el foco a su
    // encabezado al montarse, para que el lector no quede parado sobre un
    // botón que ya no existe (el foco caería al <body>).
    setEnfocarResultados(true);
  };

  const volverAPortada = () => {
    setVerTodas(false);
    setSearch('');
    setOrigen(undefined);
  };

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-10 sm:px-6 lg:px-8">
        <PublicPageHeader
          title="Noticias"
          description="Actualidad de los Juegos Evita Formoseños y del portal oficial de la provincia."
          icon={<Newspaper className="h-6 w-6" aria-hidden="true" />}
          actions={
            <div className="relative w-full md:w-80">
              <Search
                className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-primary-500"
                aria-hidden="true"
              />
              <Input
                placeholder="Buscar noticias..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar noticias"
                className="h-10 rounded-full border-primary-200 bg-surface-elevated pr-10 pl-11 text-sm shadow-sm focus-visible:ring-primary-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpiar la búsqueda de noticias"
                  className="absolute top-1/2 right-3 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-primary-500 hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-primary-600"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          }
        />

        <NewsOriginFilter
          valor={origen}
          onChange={(valor) => {
            setOrigen(valor);
            // "Todas" sin búsqueda vuelve a la portada editorial.
            if (valor === undefined) setVerTodas(false);
          }}
        />

        {enListado ? (
          <Resultados
            enfocar={enfocarResultados}
            onEnfocado={() => setEnfocarResultados(false)}
            noticias={resultados.data?.data ?? []}
            meta={resultados.data?.meta}
            isLoading={resultados.isLoading}
            hayFiltro={hayFiltro}
            onPageChange={setPage}
            onVolver={volverAPortada}
          />
        ) : (
          <PublicListState
            isLoading={portada.isLoading}
            isEmpty={reparto.carrusel.length === 0}
            skeleton={<NewsListSkeleton />}
            empty={
              <EmptyState
                icon={<Newspaper className="h-10 w-10" />}
                title="Sin noticias disponibles"
                description="No hay noticias publicadas en este momento. ¡Volvé a consultar pronto!"
              />
            }
          >
            <div className="space-y-8 md:space-y-10">
              {/* 1. Tira de notas compactas. En celular, fila deslizable. */}
              {reparto.tira.length > 0 && (
                <section aria-labelledby="tira-titulo">
                  <h2 id="tira-titulo" className="sr-only">
                    Últimas notas
                  </h2>
                  <ul
                    className={cn(
                      '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0',
                      COLUMNAS_DE_LA_TIRA[reparto.tira.length] ?? 'lg:grid-cols-4',
                    )}
                  >
                    {reparto.tira.map((n) => (
                      <li key={n.id} className="w-72 shrink-0 snap-start lg:w-auto">
                        <NewsTickerCard news={n} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* 2. Carrusel destacado + próximos eventos del calendario. */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-0">
                <div className="lg:col-span-8">
                  <NewsHeroCarousel noticias={reparto.carrusel} />
                </div>
                <div className="lg:col-span-4">
                  <UpcomingEventsPanel
                    eventos={eventos}
                    sedePorId={sedePorId}
                    estado={
                      calendario.isLoading
                        ? 'cargando'
                        : calendario.isError
                          ? 'error'
                          : 'listo'
                    }
                  />
                </div>
              </div>

              {/* 3. "No te pierdas" + "Más recientes". */}
              {(reparto.mosaico.length > 0 || reparto.lista.length > 0) && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {reparto.mosaico.length > 0 && (
                    <section
                      aria-labelledby="no-te-pierdas-titulo"
                      className={reparto.lista.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'}
                    >
                      <TituloDeSeccion id="no-te-pierdas-titulo">No te pierdas</TituloDeSeccion>
                      <Mosaico noticias={reparto.mosaico} />
                    </section>
                  )}

                  {reparto.lista.length > 0 && (
                    <section
                      aria-labelledby="mas-recientes-titulo"
                      className={
                        reparto.mosaico.length > 0
                          ? 'rounded-2xl border border-primary-100 bg-surface-elevated p-4 shadow-sm lg:col-span-4'
                          : 'rounded-2xl border border-primary-100 bg-surface-elevated p-4 shadow-sm lg:col-span-12'
                      }
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        {/* "Más recientes" y no "lo más leído": la plataforma no
                            cuenta lecturas. */}
                        <h2
                          id="mas-recientes-titulo"
                          className="font-display text-lg font-bold text-primary-900"
                        >
                          Más recientes
                        </h2>
                        <button
                          type="button"
                          onClick={abrirTodas}
                          className="rounded-md text-sm font-semibold text-primary-600 underline-offset-4 hover:text-primary-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                        >
                          Ver todas<span className="sr-only"> las noticias</span>
                        </button>
                      </div>
                      <NewsSidebarList news={reparto.lista} />
                    </section>
                  )}
                </div>
              )}

              {/* 4. Archivo: lo que no entró en la portada, paginado. */}
              {(reparto.resto.length > 0 || paginasDeArchivo > 0) && (
                <section aria-labelledby="mas-noticias-titulo">
                  <TituloDeSeccion id="mas-noticias-titulo">Más noticias</TituloDeSeccion>
                  <PublicListState
                    isLoading={archivo.isLoading}
                    isEmpty={false}
                    skeleton={<NewsListSkeleton variante="grilla" />}
                    empty={null}
                  >
                    <GrillaDeNotas
                      noticias={[...reparto.resto, ...(archivo.data?.data ?? [])]}
                    />
                  </PublicListState>
                  {paginasDeArchivo > 1 && (
                    <div className="mt-6 rounded-2xl border border-primary-100 bg-surface-elevated">
                      <Pagination
                        page={paginaArchivo}
                        totalPages={paginasDeArchivo}
                        total={Math.max(0, totalPublicadas - NOTAS_EN_PORTADA)}
                        limit={NOTAS_EN_PORTADA}
                        onPageChange={setPaginaArchivo}
                        className="border-t-0"
                      />
                    </div>
                  )}
                </section>
              )}

              {/* Sin archivo, el acceso a todas las notas en lista es "Ver todas". */}
              {paginasDeArchivo === 0 && reparto.lista.length === 0 && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={abrirTodas}
                    className="rounded-full border border-primary-200 bg-surface-elevated px-5 py-2 text-sm font-semibold text-primary-700 shadow-sm hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                  >
                    Ver todas las noticias en lista
                  </button>
                </div>
              )}
            </div>
          </PublicListState>
        )}
      </div>
    </div>
  );
}

/** Encabezado de sección con la barrita de color de la referencia. */
function TituloDeSeccion({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-display mb-4 border-l-4 border-primary-600 pl-3 text-xl leading-tight font-bold text-primary-900"
    >
      {children}
    </h2>
  );
}

/**
 * Mosaico: una grande que ocupa dos filas y las demás en 2×2 (con 5), o una
 * grande y dos apiladas (con 3). En celular, todas una debajo de la otra.
 */
function Mosaico({ noticias }: { noticias: readonly News[] }) {
  const [grande, ...chicas] = noticias;
  if (!grande) return null;
  const completo = chicas.length >= 4;

  return (
    <div
      className={
        completo
          ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:grid-rows-[14rem_14rem]'
          : 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-rows-[14rem_14rem]'
      }
    >
      <div
        className={
          completo
            ? 'min-h-72 sm:col-span-2 md:col-span-1 md:row-span-2'
            : 'min-h-72 sm:row-span-2'
        }
      >
        <NewsMosaicCard news={grande} tamano="grande" />
      </div>
      {chicas.map((n) => (
        <div key={n.id}>
          <NewsMosaicCard news={n} />
        </div>
      ))}
    </div>
  );
}

function GrillaDeNotas({ noticias }: { noticias: readonly News[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {noticias.map((n, idx) => (
        <li key={n.id}>
          <NewsCard news={n} index={idx} />
        </li>
      ))}
    </ul>
  );
}

interface ResultadosProps {
  /** Llevar el foco al encabezado al montarse (se llegó por "Ver todas"). */
  enfocar: boolean;
  onEnfocado: () => void;
  noticias: News[];
  meta?: { page: number; totalPages: number; total: number; limit: number };
  isLoading: boolean;
  hayFiltro: boolean;
  onPageChange: (page: number) => void;
  onVolver: () => void;
}

/** Grilla pareja y paginada: búsqueda, filtro de origen o "Ver todas". */
function Resultados({
  enfocar,
  onEnfocado,
  noticias,
  meta,
  isLoading,
  hayFiltro,
  onPageChange,
  onVolver,
}: ResultadosProps) {
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!enfocar) return;
    tituloRef.current?.focus({ preventScroll: true });
    // Arriba de todo: el encabezado de la grilla queda a la vista con el
    // buscador y los filtros, que es desde donde se sigue.
    // 'instant': el html tiene scroll-behavior smooth y la animación se corta
    // cuando la grilla reemplaza al esqueleto.
    window.scrollTo({ top: 0, behavior: 'instant' });
    onEnfocado();
  }, [enfocar, onEnfocado]);

  return (
    <section aria-labelledby="resultados-titulo">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          id="resultados-titulo"
          ref={tituloRef}
          tabIndex={-1}
          className="font-display scroll-mt-24 border-l-4 border-primary-600 pl-3 text-xl font-bold text-primary-900 focus:outline-none"
        >
          {hayFiltro ? 'Resultados' : 'Todas las noticias'}
          {meta && (
            <span className="ml-2 text-base font-semibold text-primary-600">({meta.total})</span>
          )}
        </h2>
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-primary-600 hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a la portada
        </button>
      </div>

      <PublicListState
        isLoading={isLoading}
        isEmpty={noticias.length === 0}
        skeleton={<NewsListSkeleton variante="grilla" />}
        empty={
          <EmptyState
            icon={<Newspaper className="h-10 w-10" />}
            title="Sin noticias disponibles"
            description={
              // Cierta: la búsqueda la resolvió el backend sobre el archivo
              // completo, no un `filter()` sobre las filas traídas.
              hayFiltro
                ? 'No se encontraron artículos que coincidan con la búsqueda o el filtro.'
                : 'No hay noticias publicadas en este momento. ¡Volvé a consultar pronto!'
            }
          />
        }
      >
        <GrillaDeNotas noticias={noticias} />
        {meta && meta.totalPages > 1 && (
          <div className="mt-6 rounded-2xl border border-primary-100 bg-surface-elevated">
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={onPageChange}
              className="border-t-0"
            />
          </div>
        )}
      </PublicListState>
    </section>
  );
}
