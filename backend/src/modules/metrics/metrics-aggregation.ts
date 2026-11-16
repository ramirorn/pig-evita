// ===========================================
// Métricas — agregación pura (sin Prisma)
// ===========================================
//
// Todo lo que decide cómo se cruza, se suprime y se calcula vive acá, sin
// tocar la base: el service sólo proyecta respuestas y resuelve nombres. Así
// las reglas de k-anonimato se prueban con listas en memoria y el mismo
// código sirve para cualquier campaña, sea cual sea su cuestionario.
import {
  MOTIVO_SUPRESION,
  UMBRAL_K_ANONIMATO,
} from '../survey/survey.constants';
import type { Corte } from '../survey/survey.types';
import type {
  CeldaCruce,
  CondicionKpi,
  DefinicionKpi,
  Dimension,
  DimensionFija,
  FilaCruce,
  Granularidad,
  MapasDeNombres,
  OpcionCatalogo,
  PuntoSerie,
  RespuestaProyectada,
} from './metrics.types';
import { DIMENSIONES_FIJAS } from './metrics.types';

// ===========================================
// Umbral
// ===========================================

/** Mismo criterio que `SurveyService.aplicarUmbral`: menos de k ⇒ suprimido. */
export function aplicarUmbral(conteo: number): Corte {
  return conteo < UMBRAL_K_ANONIMATO
    ? { suprimido: true, motivo: MOTIVO_SUPRESION, conteo: null }
    : { suprimido: false, conteo };
}

/**
 * Umbral para una celda de tabla: el cero se publica. "Nadie eligió esta
 * opción" no identifica a nadie (el panel de la encuesta ya lo muestra) y, si
 * se suprimiera, toda fila con una opción sin elegir perdería su total.
 * Lo que se oculta son los conteos de 1 a k-1.
 */
export function aplicarUmbralCelda(conteo: number): Corte {
  return conteo === 0 ? { suprimido: false, conteo: 0 } : aplicarUmbral(conteo);
}

const SUPRIMIDO: Corte = {
  suprimido: true,
  motivo: MOTIVO_SUPRESION,
  conteo: null,
};

// ===========================================
// Dimensiones
// ===========================================

export const ETIQUETAS_DIMENSION: Record<DimensionFija, string> = {
  etapa: 'Etapa',
  ventana: 'Momento de la encuesta',
  sexo: 'Rama',
  disciplineType: 'Tipo de disciplina',
  disciplina: 'Disciplina',
  categoria: 'Categoría',
  localidad: 'Localidad',
  departamento: 'Departamento',
  zona: 'Zona (capital / interior)',
};

export function esDimensionFija(valor: string): valor is DimensionFija {
  return (DIMENSIONES_FIJAS as readonly string[]).includes(valor);
}

/** `pregunta:<id>` → `<id>`; `null` si no es una dimensión de pregunta. */
export function preguntaDeDimension(dimension: string): string | null {
  return dimension.startsWith('pregunta:') ? dimension.slice(9) : null;
}

export function esDimensionValida(valor: string): valor is Dimension {
  return esDimensionFija(valor) || preguntaDeDimension(valor) !== null;
}

/**
 * Etiqueta visible de una fila del cruce. `null` es "sin dato": una respuesta
 * que no cargó localidad, categoría, etc. Se muestra, no se oculta, porque
 * ocultarla haría que la suma de filas no cierre con el total.
 */
function etiquetaDeClave(
  dimension: DimensionFija,
  clave: string | null,
  mapas: MapasDeNombres,
): string {
  if (clave === null) return 'Sin dato';
  switch (dimension) {
    case 'disciplina':
      return mapas.disciplinas.get(clave) ?? clave;
    case 'categoria':
      return mapas.categorias.get(clave) ?? clave;
    case 'localidad':
      return mapas.localidades.get(clave)?.nombre ?? clave;
    case 'departamento':
      return mapas.departamentos.get(clave) ?? clave;
    default:
      return clave;
  }
}

/**
 * Valor de la dimensión para una respuesta. Para `departamento` y `zona` se
 * pasa por la localidad; sin localidad, departamento es "sin dato" y zona es
 * INTERIOR (mismo criterio que `zonaDeLocalidad`).
 */
function claveDeRespuesta(
  dimension: DimensionFija,
  r: RespuestaProyectada,
  mapas: MapasDeNombres,
): string | null {
  switch (dimension) {
    case 'etapa':
      return r.etapa;
    case 'ventana':
      return r.ventana;
    case 'sexo':
      return r.sexo;
    case 'disciplineType':
      return r.disciplineType;
    case 'disciplina':
      return r.disciplineId;
    case 'categoria':
      return r.categoryId;
    case 'localidad':
      return r.localityId;
    case 'departamento':
      return r.localityId
        ? (mapas.localidades.get(r.localityId)?.departmentId ?? null)
        : null;
    case 'zona':
      return r.localityId
        ? (mapas.localidades.get(r.localityId)?.zona ?? 'INTERIOR')
        : 'INTERIOR';
  }
}

// ===========================================
// Cruce
// ===========================================

interface FilaAcumulada {
  clave: string | null;
  etiqueta: string;
  porOpcion: Map<string, number>;
  /** Respuestas distintas que contestaron la pregunta en esta fila. */
  respondieron: number;
}

/**
 * Tabla cruzada: filas = valores de la dimensión, columnas = opciones de la
 * pregunta. Una respuesta cuenta en cada opción que eligió (en MULTIPLE puede
 * ser más de una) y una sola vez en `respondieron`. Las respuestas que no
 * contestaron la pregunta no entran en la tabla.
 *
 * Para `pregunta:<id>` como dimensión, una respuesta cae en tantas filas como
 * opciones eligió en esa otra pregunta; la fila "Sin dato" junta a quienes no
 * la contestaron.
 */
export function cruzarRespuestas(
  respuestas: RespuestaProyectada[],
  preguntaId: string,
  opciones: OpcionCatalogo[],
  dimension: Dimension,
  mapas: MapasDeNombres,
): { filas: FilaCruce[]; totalRespuestas: number } {
  const filas = new Map<string | null, FilaAcumulada>();
  const otraPregunta = preguntaDeDimension(dimension);
  const opcionesOtra = otraPregunta
    ? (mapas.preguntas.get(otraPregunta) ?? [])
    : [];
  const textoOtra = new Map(opcionesOtra.map((o) => [o.optionId, o.texto]));

  const obtenerFila = (clave: string | null, etiqueta: string) => {
    let fila = filas.get(clave);
    if (!fila) {
      fila = { clave, etiqueta, porOpcion: new Map(), respondieron: 0 };
      filas.set(clave, fila);
    }
    return fila;
  };

  let totalRespuestas = 0;
  for (const r of respuestas) {
    const elegidas = r.opciones.get(preguntaId);
    if (!elegidas || elegidas.length === 0) continue;
    totalRespuestas += 1;

    const claves: { clave: string | null; etiqueta: string }[] = otraPregunta
      ? (r.opciones.get(otraPregunta) ?? []).length
        ? (r.opciones.get(otraPregunta) ?? []).map((id) => ({
            clave: id,
            etiqueta: textoOtra.get(id) ?? id,
          }))
        : [{ clave: null, etiqueta: 'Sin dato' }]
      : [
          (() => {
            const clave = claveDeRespuesta(
              dimension as DimensionFija,
              r,
              mapas,
            );
            return {
              clave,
              etiqueta: etiquetaDeClave(
                dimension as DimensionFija,
                clave,
                mapas,
              ),
            };
          })(),
        ];

    for (const { clave, etiqueta } of claves) {
      const fila = obtenerFila(clave, etiqueta);
      fila.respondieron += 1;
      for (const optionId of elegidas) {
        fila.porOpcion.set(optionId, (fila.porOpcion.get(optionId) ?? 0) + 1);
      }
    }
  }

  const ordenadas = ordenarFilas([...filas.values()], dimension, opcionesOtra);

  return {
    totalRespuestas,
    filas: ordenadas.map((fila) => ({
      clave: fila.clave,
      etiqueta: fila.etiqueta,
      celdas: opciones.map((o) => ({
        optionId: o.optionId,
        valor: o.valor,
        texto: o.texto,
        ...aplicarUmbralCelda(fila.porOpcion.get(o.optionId) ?? 0),
      })),
      totalFila: aplicarUmbral(fila.respondieron),
    })),
  };
}

/**
 * Orden estable de las filas: por el orden de las opciones si la dimensión es
 * otra pregunta, por conteo descendente en lo demás, y "Sin dato" siempre al
 * final.
 */
function ordenarFilas(
  filas: FilaAcumulada[],
  dimension: Dimension,
  opcionesOtra: OpcionCatalogo[],
): FilaAcumulada[] {
  const posicion = new Map(opcionesOtra.map((o, i) => [o.optionId, i]));
  return filas.sort((a, b) => {
    if (a.clave === null) return 1;
    if (b.clave === null) return -1;
    if (preguntaDeDimension(dimension)) {
      return (posicion.get(a.clave) ?? 0) - (posicion.get(b.clave) ?? 0);
    }
    return (
      b.respondieron - a.respondieron || a.etiqueta.localeCompare(b.etiqueta)
    );
  });
}

/**
 * Segunda pasada de supresión sobre una tabla ya armada: si en una fila hay
 * alguna celda suprimida, el total de la fila también se suprime. Sin esto,
 * total − (celdas visibles) despeja la celda oculta.
 */
export function aplicarUmbralTabla(filas: FilaCruce[]): FilaCruce[] {
  return filas.map((fila) => {
    const hayCeldaSuprimida = fila.celdas.some((c: CeldaCruce) => c.suprimido);
    return hayCeldaSuprimida ? { ...fila, totalFila: SUPRIMIDO } : fila;
  });
}

// ===========================================
// KPIs
// ===========================================

/** Una respuesta cumple una condición si eligió alguna opción con ese `valor`. */
function cumpleCondicion(
  r: RespuestaProyectada,
  condicion: CondicionKpi,
  valorDeOpcion: Map<string, string>,
): boolean {
  const buscados = new Set(condicion.valores);
  for (const ids of r.opciones.values()) {
    for (const id of ids) {
      const valor = valorDeOpcion.get(id);
      if (valor && buscados.has(valor)) return true;
    }
  }
  return false;
}

/** Preguntas en las que vive cada `valor` del numerador: base de `contestaron`. */
function preguntasDeCondiciones(
  condiciones: CondicionKpi[],
  preguntaDeValor: Map<string, string>,
): Set<string> {
  const preguntas = new Set<string>();
  for (const c of condiciones) {
    for (const v of c.valores) {
      const q = preguntaDeValor.get(v);
      if (q) preguntas.add(q);
    }
  }
  return preguntas;
}

/**
 * Evalúa un KPI sobre un conjunto de respuestas ya filtradas. Devuelve los dos
 * conteos crudos; quien publica les aplica el umbral a ambos y sólo informa el
 * cociente cuando los dos son visibles.
 *
 * `valorDeOpcion`: optionId → valor (slug). `preguntaDeValor`: valor → questionId.
 */
export function evaluarKpi(
  respuestas: RespuestaProyectada[],
  definicion: DefinicionKpi,
  valorDeOpcion: Map<string, string>,
  preguntaDeValor: Map<string, string>,
): { numerador: number; denominador: number } {
  const cumpleTodas = (r: RespuestaProyectada, condiciones: CondicionKpi[]) =>
    condiciones.every((c) => cumpleCondicion(r, c, valorDeOpcion));

  let numerador = 0;
  let denominador = 0;

  const preguntasBase =
    definicion.denominador === 'contestaron'
      ? preguntasDeCondiciones(definicion.numerador, preguntaDeValor)
      : null;

  for (const r of respuestas) {
    let enDenominador: boolean;
    if (definicion.denominador === 'todas') {
      enDenominador = true;
    } else if (definicion.denominador === 'contestaron') {
      enDenominador = [...preguntasBase!].some(
        (q) => (r.opciones.get(q) ?? []).length > 0,
      );
    } else {
      enDenominador = cumpleTodas(r, definicion.denominador);
    }
    if (!enDenominador) continue;
    denominador += 1;
    if (cumpleTodas(r, definicion.numerador)) numerador += 1;
  }

  return { numerador, denominador };
}

/** Cociente publicable: `null` si algún lado está suprimido o no hay denominador. */
export function porcentajeKpi(
  numerador: Corte,
  denominador: Corte,
): number | null {
  if (numerador.suprimido || denominador.suprimido) return null;
  if (denominador.conteo === 0) return null;
  return Math.round((numerador.conteo / denominador.conteo) * 1000) / 10;
}

/**
 * Validación estructural de una definición que llega del panel. Devuelve el
 * primer problema encontrado o `null`. Los `valores` desconocidos no son un
 * error acá: un KPI puede referirse a opciones de otra edición.
 */
export function validarDefinicionKpi(def: unknown): string | null {
  if (!def || typeof def !== 'object')
    return 'La definición debe ser un objeto';
  const d = def as Partial<DefinicionKpi>;
  const condicionesValidas = (lista: unknown, nombre: string) => {
    if (!Array.isArray(lista) || lista.length === 0) {
      return `${nombre} debe tener al menos una condición`;
    }
    for (const c of lista) {
      const valores = (c as CondicionKpi | undefined)?.valores;
      if (
        !Array.isArray(valores) ||
        valores.length === 0 ||
        !valores.every((v) => typeof v === 'string' && v.length > 0)
      ) {
        return `Cada condición de ${nombre} necesita una lista de valores`;
      }
    }
    return null;
  };

  const errorNumerador = condicionesValidas(d.numerador, 'numerador');
  if (errorNumerador) return errorNumerador;

  if (d.denominador !== 'todas' && d.denominador !== 'contestaron') {
    const errorDenominador = condicionesValidas(d.denominador, 'denominador');
    if (errorDenominador) return errorDenominador;
  }

  if (d.formato !== 'porcentaje' && d.formato !== 'conteo') {
    return 'formato debe ser porcentaje o conteo';
  }
  return null;
}

// ===========================================
// Serie temporal
// ===========================================

/** Clave de bucket en UTC: `YYYY-MM-DD` o `YYYY-MM-DDTHH:00`. */
function claveTemporal(fecha: Date, granularidad: Granularidad): string {
  const iso = fecha.toISOString();
  return granularidad === 'dia' ? iso.slice(0, 10) : `${iso.slice(0, 13)}:00`;
}

/**
 * Cuenta respuestas por día u hora. Cada bucket pasa por el umbral: un día
 * con 2 respuestas se muestra como suprimido, no como 2, porque "el martes a
 * la tarde respondieron dos chicos de Pirané" ya es identificar.
 */
export function serieTemporal(
  fechas: Date[],
  granularidad: Granularidad,
): PuntoSerie[] {
  const buckets = new Map<string, number>();
  for (const f of fechas) {
    const clave = claveTemporal(f, granularidad);
    buckets.set(clave, (buckets.get(clave) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, conteo]) => ({ fecha, ...aplicarUmbral(conteo) }));
}

/** Granularidad razonable para el rango observado: por hora si cabe en 2 días. */
export function granularidadPara(fechas: Date[]): Granularidad {
  if (fechas.length === 0) return 'dia';
  const tiempos = fechas.map((f) => f.getTime());
  const rango = Math.max(...tiempos) - Math.min(...tiempos);
  return rango <= 2 * 24 * 60 * 60 * 1000 ? 'hora' : 'dia';
}
