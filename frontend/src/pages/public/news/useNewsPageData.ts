// ===========================================
// useNewsPageData — estado y datos de /noticias
// ===========================================
import { useMemo, useState } from 'react';
import { useNewsList } from '@/hooks/useNews';
import { useAllCalendarEvents } from '@/hooks/useCalendar';
import { useAllVenues } from '@/hooks/useVenues';
import { useDebounce } from '@/hooks/useDebounce';
import { NOTAS_EN_PORTADA, repartirPortada } from './newsLayout';
import { proximosEventos } from './proximosEventos';
import type { OrigenDeNoticia } from './NewsOriginFilter';

/** Página de la grilla de resultados (búsqueda, filtro o "Ver todas"). */
export const NOTICIAS_POR_PAGINA = 12;

/**
 * Todo lo que `/noticias` consulta y recuerda: la búsqueda, el filtro de
 * origen, en qué vista está (portada o grilla) y las cuatro consultas que la
 * alimentan. La página queda con el dibujo.
 */
export function useNewsPageData() {
  const [search, setSearch] = useState('');
  const [origen, setOrigen] = useState<OrigenDeNoticia>(undefined);
  const [verTodas, setVerTodas] = useState(false);
  const [paginaArchivo, setPaginaArchivo] = useState(1);
  const busqueda = useDebounce(search.trim());
  const [enfocarResultados, setEnfocarResultados] = useState(false);

  // Cambiar la búsqueda o el filtro reinicia la paginación. Antes era un
  // `useEffect` que hacía `setPage(1)` después del render (un render de más con
  // la página vieja); ahora la página se guarda junto con la clave del filtro
  // para la que vale, y con otra clave es la 1.
  const claveFiltro = `${busqueda}|${origen ?? ''}`;
  const [paginacion, setPaginacion] = useState({ clave: claveFiltro, page: 1 });
  const page = paginacion.clave === claveFiltro ? paginacion.page : 1;
  const setPage = (nueva: number) => setPaginacion({ clave: claveFiltro, page: nueva });

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

  const reparto = useMemo(() => repartirPortada(portada.data?.data ?? []), [portada.data]);
  const eventos = useMemo(() => proximosEventos(calendario.data ?? []), [calendario.data]);
  const sedePorId = useMemo(() => new Map((sedes.data ?? []).map((v) => [v.id, v.name])), [sedes.data]);

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

  const cambiarOrigen = (valor: OrigenDeNoticia) => {
    setOrigen(valor);
    // "Todas" sin búsqueda vuelve a la portada editorial.
    if (valor === undefined) setVerTodas(false);
  };

  return {
    search,
    setSearch,
    origen,
    cambiarOrigen,
    hayFiltro,
    enListado,
    page,
    setPage,
    paginaArchivo,
    setPaginaArchivo,
    enfocarResultados,
    terminarEnfoque: () => setEnfocarResultados(false),
    portada,
    archivo,
    resultados,
    calendario,
    totalPublicadas,
    paginasDeArchivo,
    reparto,
    eventos,
    sedePorId,
    abrirTodas,
    volverAPortada,
  };
}
