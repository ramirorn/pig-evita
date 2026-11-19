// ===========================================
// Métricas — agregación pura (sin Prisma)
// ===========================================
//
// Todo lo que decide cómo se cruza, se suprime y se calcula vive acá, sin
// tocar la base: el service sólo proyecta respuestas y resuelve nombres. Así
// las reglas de k-anonimato se prueban con listas en memoria y el mismo
// código sirve para cualquier campaña, sea cual sea su cuestionario.
import {
  MINIMO_PARA_FRASES,
  MOTIVO_SUPRESION,
  UMBRAL_K_ANONIMATO,
} from '../survey/survey.constants';
import type {
  CompetitionStage,
  DisciplineType,
  Sex,
  SurveyWindow,
} from '@prisma/client';
import type { Zona } from '../../common/constants';
import type { Corte } from '../survey/survey.types';
import type {
  CeldaCruce,
  CondicionKpi,
  DefinicionDestacado,
  DefinicionKpi,
  Dimension,
  DimensionFija,
  FilaCruce,
  Granularidad,
  MapasDeNombres,
  OpcionCatalogo,
  OpcionDestacada,
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
 * Etiquetas en castellano de las dimensiones que son enums, para que el panel
 * nunca muestre un código (`INTERIOR`, `DURANTE`). Espejan `lib/constants.ts`
 * del frontend; tipadas con los enums para que un valor nuevo no compile.
 */
export const ETIQUETAS_VALOR = {
  etapa: {
    ZONAL: 'Zonal',
    DEPARTAMENTAL: 'Departamental',
    PROVINCIAL: 'Provincial',
  } satisfies Record<CompetitionStage, string>,
  ventana: {
    PRE: 'Antes de competir',
    DURANTE: 'Durante la competencia',
    POST: 'Después de competir',
  } satisfies Record<SurveyWindow, string>,
  sexo: {
    MASCULINO: 'Masculino',
    FEMENINO: 'Femenino',
    MIXTO: 'Mixto',
  } satisfies Record<Sex, string>,
  disciplineType: {
    INDIVIDUAL: 'Individual',
    EQUIPO: 'Equipo',
  } satisfies Record<DisciplineType, string>,
  zona: {
    CAPITAL: 'Capital',
    INTERIOR: 'Interior',
  } satisfies Record<Zona, string>,
} as const;

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
    default: {
      const etiquetas: Readonly<Record<string, string>> =
        ETIQUETAS_VALOR[dimension];
      return etiquetas[clave] ?? clave;
    }
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
// Protección por complemento
// ===========================================
//
// El umbral por celda no alcanza cuando al lado hay un total publicado (o
// derivable de otro endpoint, como el total de respuestas): total − parte
// despeja lo oculto. Dos reglas lo cierran sin tocar lo que ya era seguro.

/** `total − parte` queda entre 1 y k−1: publicar la parte revelaría ese resto. */
export function complementoRevela(parte: number, total: number): boolean {
  const resto = total - parte;
  return resto > 0 && resto < UMBRAL_K_ANONIMATO;
}

/**
 * Supresión secundaria para celdas que suman un total conocido (pregunta de
 * opción única: cada respuesta cae en una sola celda). Con una sola celda
 * oculta, la resta la despeja; se oculta además la menor visible distinta de
 * cero, así lo que queda es la suma de dos celdas y no una sola.
 */
export function suprimirComplementaria<T extends Corte>(celdas: T[]): T[] {
  const ocultas = celdas.filter((c) => c.suprimido).length;
  if (ocultas !== 1) return celdas;
  let menor = -1;
  let menorConteo = Infinity;
  celdas.forEach((c, i) => {
    if (c.suprimido || c.conteo === 0) return;
    if (c.conteo < menorConteo) {
      menor = i;
      menorConteo = c.conteo;
    }
  });
  if (menor === -1) return celdas;
  return celdas.map((c, i) => (i === menor ? { ...c, ...SUPRIMIDO } : c));
}

/** `suprimirComplementaria` fila por fila de una tabla cruzada. */
export function aplicarSupresionComplementaria(
  filas: FilaCruce[],
): FilaCruce[] {
  return filas.map((fila) => ({
    ...fila,
    celdas: suprimirComplementaria(fila.celdas),
  }));
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
 * Lo que se publica de un KPI a partir de sus dos conteos crudos: umbral en
 * cada lado y, además, el complemento. Si `denominador − numerador` queda
 * entre 1 y k−1 (por ejemplo, 9 atendidos de 11 lesionados ⇒ 2 sin atención),
 * el numerador y el valor no se publican.
 */
export function publicarKpi(
  numerador: number,
  denominador: number,
  formato: DefinicionKpi['formato'],
): { numerador: Corte; denominador: Corte; valor: number | null } {
  const den = aplicarUmbral(denominador);
  const num = complementoRevela(numerador, denominador)
    ? SUPRIMIDO
    : aplicarUmbral(numerador);
  return {
    numerador: num,
    denominador: den,
    valor: formato === 'conteo' ? num.conteo : porcentajeKpi(num, den),
  };
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
// Destacados
// ===========================================

/**
 * Conteos crudos de un destacado: la base son las respuestas que eligieron
 * alguna de sus opciones; cada opción cuenta una vez por respuesta.
 * `valorDeOpcion`: optionId → valor (slug).
 */
export function evaluarDestacado(
  respuestas: RespuestaProyectada[],
  definicion: DefinicionDestacado,
  valorDeOpcion: Map<string, string>,
): { base: number; conteos: Map<string, number> } {
  const buscados = new Set(definicion.opciones);
  const conteos = new Map<string, number>(
    definicion.opciones.map((v) => [v, 0]),
  );
  let base = 0;
  for (const r of respuestas) {
    const elegidos = new Set<string>();
    for (const ids of r.opciones.values()) {
      for (const id of ids) {
        const valor = valorDeOpcion.get(id);
        if (valor && buscados.has(valor)) elegidos.add(valor);
      }
    }
    if (elegidos.size === 0) continue;
    base += 1;
    for (const v of elegidos) conteos.set(v, (conteos.get(v) ?? 0) + 1);
  }
  return { base, conteos };
}

/**
 * Ranking publicable de un destacado. Cada opción pasa por el umbral, por el
 * complemento contra la base y, si todas las opciones son de una misma
 * pregunta de opción única, por la supresión secundaria. Lo oculto no entra al
 * ranking (ni como "Otras": sería otra resta) y sólo se informa cuántas son.
 */
export function rankingDestacado(
  base: number,
  opciones: { valor: string; texto: string; conteo: number }[],
  { top, unica }: { top: number; unica: boolean },
): {
  base: Corte;
  opciones: OpcionDestacada[];
  ocultas: number;
  puedeAfirmar: boolean;
} {
  const baseCorte = aplicarUmbral(base);
  if (baseCorte.suprimido) {
    return {
      base: baseCorte,
      opciones: [],
      ocultas: opciones.filter((o) => o.conteo > 0).length,
      puedeAfirmar: false,
    };
  }

  let celdas: (Corte & { valor: string; texto: string })[] = opciones.map(
    (o) => ({
      valor: o.valor,
      texto: o.texto,
      ...(complementoRevela(o.conteo, base)
        ? SUPRIMIDO
        : aplicarUmbralCelda(o.conteo)),
    }),
  );
  if (unica) celdas = suprimirComplementaria(celdas);

  const visibles: OpcionDestacada[] = [];
  for (const c of celdas) {
    if (c.suprimido || c.conteo === 0) continue;
    visibles.push({
      valor: c.valor,
      texto: c.texto,
      conteo: c.conteo,
      porcentaje: Math.round((c.conteo / base) * 1000) / 10,
    });
  }
  visibles.sort(
    (a, b) => b.conteo - a.conteo || a.texto.localeCompare(b.texto),
  );

  return {
    base: baseCorte,
    opciones: visibles.slice(0, top),
    ocultas: celdas.filter((c) => c.suprimido).length,
    puedeAfirmar: base >= MINIMO_PARA_FRASES,
  };
}

/** Validación estructural de un destacado que llega del panel. */
export function validarDefinicionDestacado(def: unknown): string | null {
  if (!def || typeof def !== 'object')
    return 'La definición debe ser un objeto';
  const d = def as Partial<DefinicionDestacado>;
  if (
    !Array.isArray(d.opciones) ||
    d.opciones.length === 0 ||
    !d.opciones.every((v) => typeof v === 'string' && v.length > 0)
  ) {
    return 'opciones debe ser una lista de valores';
  }
  if (d.opciones.length > 30) return 'Un destacado admite hasta 30 opciones';
  if (
    typeof d.top !== 'number' ||
    !Number.isInteger(d.top) ||
    d.top < 1 ||
    d.top > 10
  ) {
    return 'top debe ser un entero entre 1 y 10';
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
