// ===========================================
// Filtros: URL y tope
// ===========================================
import type { MetricsFiltros } from '@/types';

// ===========================================
// Filtros ↔ URL
// ===========================================

const CLAVES_FILTRO = [
  'etapa',
  'ventana',
  'disciplineId',
  'disciplineType',
  'localityId',
  'departmentId',
  'zona',
  'categoryId',
  'sexo',
  'desde',
  'hasta',
] as const satisfies readonly (keyof MetricsFiltros)[];

// ===========================================
// Tope de filtros
// ===========================================
//
// El backend rechaza más de 2 filtros a la vez: cada filtro más multiplica las
// restas posibles entre cortes. `desde` y `hasta` juntos son un solo filtro.

export const MAXIMO_FILTROS = 2;

export const TEXTO_TOPE_FILTROS = `Se pueden combinar hasta ${MAXIMO_FILTROS} filtros a la vez, para cuidar el anonimato.`;

export type GrupoFiltro =
  | Exclude<(typeof CLAVES_FILTRO)[number], 'desde' | 'hasta'>
  | 'fecha';

const grupoDe = (clave: (typeof CLAVES_FILTRO)[number]): GrupoFiltro =>
  clave === 'desde' || clave === 'hasta' ? 'fecha' : clave;

/** Los filtros en uso, en el orden de la barra; el rango de fechas cuenta una vez. */
export function filtrosEnUso(filtros: MetricsFiltros): GrupoFiltro[] {
  const grupos: GrupoFiltro[] = [];
  for (const clave of CLAVES_FILTRO) {
    const grupo = grupoDe(clave);
    if (filtros[clave] && !grupos.includes(grupo)) grupos.push(grupo);
  }
  return grupos;
}

/** ¿Se puede tocar este filtro? Sí si ya está en uso o si queda lugar. */
export function puedeSumarFiltro(filtros: MetricsFiltros, grupo: GrupoFiltro): boolean {
  const enUso = filtrosEnUso(filtros);
  return enUso.includes(grupo) || enUso.length < MAXIMO_FILTROS;
}

/**
 * Filtros desde la query string; ignora las claves que no son filtros. Un
 * enlace viejo con más filtros que el tope se lee con los primeros.
 */
export function filtrosDesdeBusqueda(busqueda: URLSearchParams): MetricsFiltros {
  const filtros: Record<string, string> = {};
  const grupos: GrupoFiltro[] = [];
  for (const clave of CLAVES_FILTRO) {
    const valor = busqueda.get(clave);
    if (!valor) continue;
    const grupo = grupoDe(clave);
    if (!grupos.includes(grupo)) {
      if (grupos.length >= MAXIMO_FILTROS) continue;
      grupos.push(grupo);
    }
    filtros[clave] = valor;
  }
  return filtros as MetricsFiltros;
}

/** Escribe los filtros en la query string conservando las claves ajenas. */
export function filtrosABusqueda(
  filtros: MetricsFiltros,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const salida = new URLSearchParams(base);
  for (const clave of CLAVES_FILTRO) {
    const valor = filtros[clave];
    if (valor) salida.set(clave, String(valor));
    else salida.delete(clave);
  }
  return salida;
}

export function hayFiltrosActivos(filtros: MetricsFiltros): boolean {
  return CLAVES_FILTRO.some((clave) => !!filtros[clave]);
}

/**
 * Al cambiar de departamento, una localidad de otro departamento deja de
 * tener sentido: se limpia. Lo mismo la categoría al cambiar de disciplina.
 */
export function aplicarCambioDeFiltro(
  actuales: MetricsFiltros,
  cambio: Partial<MetricsFiltros>,
  catalogo: {
    departamentos: { id: string; localidades: { id: string }[] }[];
    categorias: { id: string; disciplineId: string }[];
  },
): MetricsFiltros {
  const siguiente: MetricsFiltros = { ...actuales, ...cambio };
  // Un filtro más allá del tope no se aplica (la barra ya lo deshabilita).
  if (filtrosEnUso(siguiente).length > MAXIMO_FILTROS) return actuales;
  if ('departmentId' in cambio && siguiente.localityId) {
    const depto = catalogo.departamentos.find((d) => d.id === siguiente.departmentId);
    if (siguiente.departmentId && !depto?.localidades.some((l) => l.id === siguiente.localityId)) {
      siguiente.localityId = undefined;
    }
  }
  if ('disciplineId' in cambio && siguiente.categoryId) {
    const categoria = catalogo.categorias.find((c) => c.id === siguiente.categoryId);
    if (siguiente.disciplineId && categoria?.disciplineId !== siguiente.disciplineId) {
      siguiente.categoryId = undefined;
    }
  }
  return siguiente;
}
