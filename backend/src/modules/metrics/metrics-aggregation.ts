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
// Publicación en tandas y fechas
// ===========================================
//
// Restar dos lecturas del mismo corte despeja lo que entró entre una y otra:
// quien ve a alguien contestar en la sede y recarga el panel vería su
// respuesta (una celda que pasa de 12 a 13). Por eso cada corte publica sus
// respuestas de a k: entre dos lecturas cambia por 0 o por al menos k.

/** Un conteo redondeado hacia abajo a la tanda de k: 7 ⇒ 5, 4 ⇒ 0. */
export function enTandas(conteo: number): number {
  return Math.floor(conteo / UMBRAL_K_ANONIMATO) * UMBRAL_K_ANONIMATO;
}

/**
 * Las respuestas que un corte publica: sus `enTandas(n)` más viejas, por fecha
 * de envío y, a igual fecha, por id (el resultado no depende del orden en que
 * llegan de la base). Las más nuevas esperan a completar la tanda siguiente.
 */
export function publicarEnTandas<T extends { enviadaEn: Date }>(
  respuestas: readonly T[],
  idDe: (respuesta: T) => string,
): T[] {
  const ordenadas = [...respuestas].sort((a, b) => {
    const porFecha = a.enviadaEn.getTime() - b.enviadaEn.getTime();
    if (porFecha !== 0) return porFecha;
    const ia = idDe(a);
    const ib = idDe(b);
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
  return ordenadas.slice(0, enTandas(ordenadas.length));
}

/**
 * El día (UTC, `YYYY-MM-DD`) de un filtro `desde`/`hasta`. El filtro mínimo
 * de las métricas es el día: dos ventanas que difieren en minutos aislarían
 * las respuestas de esos minutos, muchas veces una sola.
 */
export function diaDelFiltro(valor: string): string {
  return new Date(valor).toISOString().slice(0, 10);
}

// ===========================================
// Filtros: tope y coherencia
// ===========================================
//
// El total sin filtro menos el total filtrado por "interior" despeja la
// capital. Dos reglas lo cierran: un corte filtrado sólo se publica si su fila
// se publicaría en el cruce del corte sin ese filtro (que ya protege las filas
// chicas y lo que se despeja restando), y no se combinan más de 2 filtros, para
// acotar las combinaciones con las que armar restas.

/** Filtros que se pueden combinar a la vez en un corte de métricas. */
export const MAXIMO_FILTROS = 2;

/** Un filtro del corte; `desde` y `hasta` juntos son uno solo: `fecha`. */
export type FiltroCorte =
  | 'etapa'
  | 'ventana'
  | 'disciplineId'
  | 'disciplineType'
  | 'localityId'
  | 'departmentId'
  | 'zona'
  | 'categoryId'
  | 'sexo'
  | 'fecha';

const ORDEN_FILTROS: readonly FiltroCorte[] = [
  'etapa',
  'ventana',
  'disciplineId',
  'disciplineType',
  'localityId',
  'departmentId',
  'zona',
  'categoryId',
  'sexo',
  'fecha',
];

type ClaveDeFiltro = Exclude<FiltroCorte, 'fecha'> | 'desde' | 'hasta';

/** Los filtros en uso, en un orden fijo; el rango de fechas cuenta una vez. */
export function filtrosActivos(
  filtros: Partial<Record<ClaveDeFiltro, unknown>>,
): FiltroCorte[] {
  return ORDEN_FILTROS.filter((filtro) =>
    filtro === 'fecha'
      ? Boolean(filtros.desde || filtros.hasta)
      : Boolean(filtros[filtro]),
  );
}

/**
 * ¿Se publica el corte filtrado por `propia`? `entradas` son las filas del
 * corte sin ese filtro, agrupadas por la dimensión del filtro, y `total` el
 * total de ese corte. Mismo criterio que las filas de un cruce: umbral y
 * supresión secundaria por masa (`protegerGrupo`). Un valor que no aparece en
 * el corte sin filtro tampoco se publica.
 */
export function filaPublicable(
  entradas: readonly (readonly [string | null, number])[],
  total: number,
  propia: string | null,
): boolean {
  const indice = entradas.findIndex(([clave]) => clave === propia);
  if (indice === -1) return false;
  const cortes = protegerGrupo(
    entradas.map(([, conteo]) => conteo),
    total,
  );
  return !cortes[indice]!.suprimido;
}

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
  {
    unica = false,
    particion = false,
  }: {
    /** La pregunta es de opción única: las celdas de una fila suman su total. */
    unica?: boolean;
    /** Las filas reparten a quienes contestaron (cada uno en una sola fila). */
    particion?: boolean;
  } = {},
): { filas: FilaCruce[]; totalRespuestas: number; totalOculto: boolean } {
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

  // 1. Dentro de cada fila. Una fila chica no publica nada, ni sus ceros: con
  //    el total a mano, "No=0 | Atendido=0" despeja la celda oculta. En una
  //    fila grande, una celda no se publica si es chica o si el resto de la
  //    fila queda de 1 a 4; y en opción única, lo oculto tiene que sumar 0 o
  //    al menos k (si no, dos celdas de 1 se despejan con el total).
  const protegidas = ordenadas.map((fila) => {
    const conteos = opciones.map((o) => fila.porOpcion.get(o.optionId) ?? 0);
    const chica = fila.respondieron < UMBRAL_K_ANONIMATO;
    let ocultas = conteos.map(
      (c) =>
        chica ||
        (c > 0 && c < UMBRAL_K_ANONIMATO) ||
        complementoRevela(c, fila.respondieron),
    );
    if (unica && !chica) {
      ocultas = completarOcultamiento(conteos, ocultas, fila.respondieron);
    }
    return {
      fila,
      conteos,
      ocultas,
      totalOculto: chica || ocultas.some(Boolean),
    };
  });

  // 2. Entre filas. Si las filas reparten a quienes contestaron, el total de
  //    una fila oculta se despeja con el total del cruce menos las visibles:
  //    también ahí lo oculto tiene que sumar 0 o al menos k. Una fila que se
  //    oculta por esto se oculta entera (sus celdas sumarían su total).
  const totalesFila = protegidas.map((p) => p.fila.respondieron);
  const filasOcultas = particion
    ? completarOcultamiento(
        totalesFila,
        protegidas.map((p) => p.totalOculto),
        totalRespuestas,
      )
    : protegidas.map((p) => p.totalOculto);

  return {
    totalRespuestas,
    // Todas las filas ocultas y aun así despejable (cinco filas de 1 y un
    // total de 5): el total del cruce tampoco se puede publicar.
    totalOculto:
      totalRespuestas < UMBRAL_K_ANONIMATO ||
      (particion && despejable(totalesFila, filasOcultas, totalRespuestas)),
    filas: protegidas.map(({ fila, conteos, ocultas, totalOculto }, i) => {
      const enteraOculta = filasOcultas[i] && !totalOculto;
      return {
        clave: fila.clave,
        etiqueta: fila.etiqueta,
        celdas: opciones.map((o, j) => ({
          optionId: o.optionId,
          valor: o.valor,
          texto: o.texto,
          ...(enteraOculta || ocultas[j]
            ? SUPRIMIDO
            : { suprimido: false, conteo: conteos[j]! }),
        })),
        totalFila: filasOcultas[i]
          ? SUPRIMIDO
          : { suprimido: false, conteo: fila.respondieron },
      };
    }),
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
 * ¿Se despeja lo oculto de un grupo de partes que suman un total conocido?
 * Lo oculto (total − visibles) se despeja si suma de 1 a k−1, o si no supera
 * la cantidad de partes ocultas distintas de cero: cada una vale al menos 1
 * (los ceros se publican, y una fila o un día sólo existen con respuestas),
 * así que con 5 ocultas que suman 5 cada una vale exactamente 1.
 */
export function despejable(
  conteos: readonly number[],
  ocultas: readonly boolean[],
  total: number,
): boolean {
  let visibles = 0;
  let ocultasConPiso = 0;
  conteos.forEach((c, i) => {
    if (!ocultas[i]) visibles += c;
    else if (c > 0) ocultasConPiso += 1;
  });
  const masa = total - visibles;
  return masa > 0 && (masa < UMBRAL_K_ANONIMATO || masa <= ocultasConPiso);
}

/**
 * Supresión secundaria por masa. En un grupo de partes que suman un total que
 * se conoce (las celdas de una fila de opción única, las filas de una
 * dimensión, las zonas, los días de la serie), mientras lo oculto sea
 * `despejable` se oculta además la parte visible más chica distinta de cero.
 * Si no queda nada visible y sigue despejable, el que llama oculta el total.
 */
export function completarOcultamiento(
  conteos: readonly number[],
  ocultas: readonly boolean[],
  total: number,
): boolean[] {
  const resultado = [...ocultas];
  while (despejable(conteos, resultado, total)) {
    let menor = -1;
    conteos.forEach((c, i) => {
      if (resultado[i] || c === 0) return;
      if (menor === -1 || c < conteos[menor]!) menor = i;
    });
    if (menor === -1) break;
    resultado[menor] = true;
  }
  return resultado;
}

/**
 * Partes de un total (zonas, etapa y ventana): umbral en cada una (el cero
 * también se oculta, como en `aplicarUmbral`) y supresión secundaria por masa.
 */
export function protegerGrupo(
  conteos: readonly number[],
  total: number,
): Corte[] {
  const ocultas = completarOcultamiento(
    conteos,
    conteos.map((c) => c < UMBRAL_K_ANONIMATO),
    total,
  );
  return conteos.map((c, i) =>
    ocultas[i] ? SUPRIMIDO : { suprimido: false, conteo: c },
  );
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
/** Tope de `valores` por condición de un KPI (VULN-40). */
export const MAXIMO_VALORES_POR_CONDICION = 50;

/** Largo máximo de un `valor` en una definición de KPI o destacado (VULN-40). */
export const MAXIMO_LARGO_VALOR = 100;

/** Mensaje de error si algún valor supera `MAXIMO_LARGO_VALOR`; `null` si no. */
function errorDeLargo(valores: readonly unknown[]): string | null {
  return valores.some(
    (v) => typeof v === 'string' && v.length > MAXIMO_LARGO_VALOR,
  )
    ? `Cada valor admite hasta ${MAXIMO_LARGO_VALOR} caracteres`
    : null;
}

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
      if (valores.length > MAXIMO_VALORES_POR_CONDICION) {
        return `Cada condición de ${nombre} admite hasta ${MAXIMO_VALORES_POR_CONDICION} valores`;
      }
      const largo = errorDeLargo(valores);
      if (largo) return largo;
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

/**
 * La definición de KPI que se persiste: reconstruida con sólo las claves que
 * se validan (VULN-40). `forbidNonWhitelisted` no alcanza a los campos JSON,
 * así que antes se guardaba lo que llegara del panel tal cual, y cualquier
 * lectura futura tomaría las claves de más como datos confiables. Llamar
 * después de `validarDefinicionKpi`.
 */
export function normalizarDefinicionKpi(def: DefinicionKpi): DefinicionKpi {
  const condiciones = (lista: CondicionKpi[]): CondicionKpi[] =>
    lista.map((c) => ({ valores: [...c.valores] }));
  return {
    numerador: condiciones(def.numerador),
    denominador:
      def.denominador === 'todas' || def.denominador === 'contestaron'
        ? def.denominador
        : condiciones(def.denominador),
    formato: def.formato,
  };
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
    // Ni cuántas opciones se ocultan: en opción única, base oculta y 4
    // opciones ocultas fijarían base 4 y 1 por opción.
    return { base: baseCorte, opciones: [], ocultas: 0, puedeAfirmar: false };
  }

  const conteos = opciones.map((o) => o.conteo);
  let ocultas = conteos.map(
    (c) => (c > 0 && c < UMBRAL_K_ANONIMATO) || complementoRevela(c, base),
  );
  if (unica) {
    ocultas = completarOcultamiento(conteos, ocultas, base);
    // Nada visible y aun así despejable (cinco opciones de 1 con base 5): la
    // base tampoco se publica.
    if (despejable(conteos, ocultas, base)) {
      return {
        base: SUPRIMIDO,
        opciones: [],
        ocultas: 0,
        puedeAfirmar: false,
      };
    }
  }
  const celdas: (Corte & { valor: string; texto: string })[] = opciones.map(
    (o, i) => ({
      valor: o.valor,
      texto: o.texto,
      ...(ocultas[i] ? SUPRIMIDO : { suprimido: false, conteo: o.conteo }),
    }),
  );

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
  const largo = errorDeLargo(d.opciones);
  if (largo) return largo;
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

/**
 * La definición de destacado que se persiste: sólo `opciones` y `top`
 * (VULN-40). Llamar después de `validarDefinicionDestacado`.
 */
export function normalizarDefinicionDestacado(
  def: DefinicionDestacado,
): DefinicionDestacado {
  return { opciones: [...def.opciones], top: def.top };
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
  const ordenados = [...buckets.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  // El total del corte se publica: un día oculto se despejaría restando los
  // visibles, así que la serie pasa por la misma regla de masa.
  const cortes = protegerGrupo(
    ordenados.map(([, conteo]) => conteo),
    fechas.length,
  );
  return ordenados.map(([fecha], i) => ({ fecha, ...cortes[i]! }));
}

/** Granularidad razonable para el rango observado: por hora si cabe en 2 días. */
export function granularidadPara(fechas: Date[]): Granularidad {
  if (fechas.length === 0) return 'dia';
  const tiempos = fechas.map((f) => f.getTime());
  const rango = Math.max(...tiempos) - Math.min(...tiempos);
  return rango <= 2 * 24 * 60 * 60 * 1000 ? 'hora' : 'dia';
}
