// ===========================================
// Lógica pura del selector de fecha (sin React)
//
// Todo el componente `DatePicker` se apoya en este módulo para que el chequeo
// `npm run check:pickers` pueda ejercitar la lógica sin un navegador.
//
// Regla de oro: una fecha del formulario es un string `YYYY-MM-DD` que se
// interpreta SIEMPRE por componentes (año, mes, día). Nunca se hace
// `new Date('YYYY-MM-DD')`: eso es medianoche UTC, que en Argentina (UTC−3)
// cae el día anterior a las 21 h. La aritmética de días usa `Date.UTC` y los
// getters `getUTC*`, que no dependen de la zona horaria de la máquina.
// ===========================================

/** Fecha en el formato que viaja en los formularios y al backend. */
export type IsoDate = string;

export interface DateParts {
  year: number;
  /** 1 a 12. */
  month: number;
  /** 1 a 31. */
  day: number;
}

export const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Semana que arranca el lunes, como se usa en Argentina. */
export const WEEKDAY_NAMES_ES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const;

export const WEEKDAY_SHORT_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'] as const;

export const DATE_TEXT_PLACEHOLDER = 'dd/mm/aaaa';

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TEXT_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

const pad2 = (n: number): string => String(n).padStart(2, '0');

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidParts({ year, month, day }: DateParts): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= 1000 &&
    year <= 9999 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

export function toIso(parts: DateParts): IsoDate {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

/** `YYYY-MM-DD` → componentes, o `null` si no es una fecha que exista. */
export function parseIso(value: string | null | undefined): DateParts | null {
  if (!value) return null;
  const match = ISO_RE.exec(value);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isValidParts(parts) ? parts : null;
}

export function isValidIso(value: string | null | undefined): value is IsoDate {
  return parseIso(value) !== null;
}

/** `YYYY-MM-DD` → `dd/mm/aaaa`; vacío si el valor no es una fecha válida. */
export function formatDateText(value: string | null | undefined): string {
  const parts = parseIso(value);
  if (!parts) return '';
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

/** Fecha local de hoy (la del reloj del usuario, no la de UTC). */
export function todayIso(now: Date = new Date()): IsoDate {
  return toIso({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
}

/** Día local de un instante (p. ej. un `timestamp` ISO completo del backend). */
export function localIsoFromDate(date: Date): IsoDate | null {
  if (Number.isNaN(date.getTime())) return null;
  return todayIso(date);
}

// -------------------------------------------------
// Texto con máscara dd/mm/aaaa
// -------------------------------------------------

/**
 * Aplica la máscara `dd/mm/aaaa` a lo que escribió el usuario.
 *
 * - Sólo quedan dígitos; las barras se ponen solas.
 * - Si el usuario separa a mano un día o un mes de un dígito ("1/5/2012"), se
 *   completa con cero ("01/05/2012").
 * - Pegar una fecha ISO (`2012-05-01`) también funciona.
 * - Una barra recién tipeada después del día o del mes se respeta, para que el
 *   texto no "rebote" al escribirla.
 */
export function maskDateText(raw: string): string {
  const trimmed = raw.trim();
  const iso = parseIso(trimmed);
  if (iso) return formatDateText(trimmed);

  const segments = trimmed.split(/\D+/);
  let digits = '';
  segments.forEach((segment, index) => {
    const hasSeparatorAfter = index < segments.length - 1;
    const position = digits.length;
    const value =
      hasSeparatorAfter && /^[1-9]$/.test(segment) && (position === 0 || position === 2)
        ? `0${segment}`
        : segment;
    digits += value;
  });
  digits = digits.slice(0, 8);

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  let text = day;
  if (month || (digits.length === 2 && /\D$/.test(trimmed))) text += `/${month}`;
  if (year || (digits.length === 4 && /\D$/.test(trimmed))) text += `/${year}`;
  return text;
}

export type DateTextResult =
  | { status: 'empty' }
  | { status: 'incomplete' }
  | { status: 'invalid' }
  | { status: 'ok'; iso: IsoDate };

/** `dd/mm/aaaa` → resultado tipado; nunca corrige una fecha imposible. */
export function parseDateText(text: string): DateTextResult {
  const trimmed = text.trim();
  if (trimmed === '') return { status: 'empty' };
  const match = TEXT_RE.exec(trimmed);
  if (!match) return { status: 'incomplete' };
  const parts = { day: Number(match[1]), month: Number(match[2]), year: Number(match[3]) };
  if (!isValidParts(parts)) return { status: 'invalid' };
  return { status: 'ok', iso: toIso(parts) };
}

// -------------------------------------------------
// Rango (min / max)
// -------------------------------------------------

/** Comparación de dos `YYYY-MM-DD` válidos (el orden lexicográfico alcanza). */
export function compareIso(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type RangeProblem = 'before-min' | 'after-max' | null;

export function rangeProblem(iso: IsoDate, min?: IsoDate, max?: IsoDate): RangeProblem {
  if (min && isValidIso(min) && compareIso(iso, min) < 0) return 'before-min';
  if (max && isValidIso(max) && compareIso(iso, max) > 0) return 'after-max';
  return null;
}

export function isInRange(iso: IsoDate, min?: IsoDate, max?: IsoDate): boolean {
  return rangeProblem(iso, min, max) === null;
}

export function clampIso(iso: IsoDate, min?: IsoDate, max?: IsoDate): IsoDate {
  const problem = rangeProblem(iso, min, max);
  if (problem === 'before-min' && min) return min;
  if (problem === 'after-max' && max) return max;
  return iso;
}

/** Mensaje accesible (voseo) para el texto escrito, o `null` si está bien. */
export function dateTextError(
  result: DateTextResult,
  min?: IsoDate,
  max?: IsoDate,
): string | null {
  switch (result.status) {
    case 'empty':
      return null;
    case 'incomplete':
      return 'Completá la fecha con el formato dd/mm/aaaa.';
    case 'invalid':
      return 'Esa fecha no existe: revisá el día y el mes.';
    case 'ok': {
      const problem = rangeProblem(result.iso, min, max);
      if (problem === 'before-min' && min) {
        return `La fecha tiene que ser el ${formatDateText(min)} o posterior.`;
      }
      if (problem === 'after-max' && max) {
        return `La fecha tiene que ser el ${formatDateText(max)} o anterior.`;
      }
      return null;
    }
  }
}

// -------------------------------------------------
// Aritmética de fechas (en UTC, independiente de la zona)
// -------------------------------------------------

function fromUtc(ms: number): IsoDate {
  const d = new Date(ms);
  return toIso({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
}

function requireParts(iso: IsoDate): DateParts {
  const parts = parseIso(iso);
  if (!parts) throw new Error(`Fecha inválida: ${iso}`);
  return parts;
}

export function addDays(iso: IsoDate, amount: number): IsoDate {
  const { year, month, day } = requireParts(iso);
  // `Date.UTC` con años < 100 los corre a 19xx; acá los años son de 4 cifras.
  return fromUtc(Date.UTC(year, month - 1, day + amount));
}

/** Suma meses conservando el día cuando existe (31/01 + 1 mes → 28 o 29/02). */
export function addMonths(iso: IsoDate, amount: number): IsoDate {
  const { year, month, day } = requireParts(iso);
  const index = year * 12 + (month - 1) + amount;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return toIso({
    year: nextYear,
    month: nextMonth,
    day: Math.min(day, daysInMonth(nextYear, nextMonth)),
  });
}

export function addYears(iso: IsoDate, amount: number): IsoDate {
  return addMonths(iso, amount * 12);
}

/** Cambia mes y año conservando el día cuando existe. */
export function withMonthYear(iso: IsoDate, year: number, month: number): IsoDate {
  const { day } = requireParts(iso);
  return toIso({ year, month, day: Math.min(day, daysInMonth(year, month)) });
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(iso: IsoDate): number {
  const { year, month, day } = requireParts(iso);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

/** "jueves 8 de octubre de 2026": nombre accesible de cada día de la grilla. */
export function formatLongEs(iso: IsoDate): string {
  const parts = parseIso(iso);
  if (!parts) return '';
  const weekday = WEEKDAY_NAMES_ES[weekdayIndex(iso)] ?? '';
  const monthName = MONTH_NAMES_ES[parts.month - 1] ?? '';
  return `${weekday} ${parts.day} de ${monthName} de ${parts.year}`;
}

/** "octubre de 2026". */
export function formatMonthYearEs(year: number, month: number): string {
  return `${MONTH_NAMES_ES[month - 1] ?? ''} de ${year}`;
}

// -------------------------------------------------
// Grilla del mes
// -------------------------------------------------

/** Una celda de la grilla: `null` es un hueco de otro mes. */
export type MonthGridCell = IsoDate | null;

/**
 * Semanas del mes, cada una de 7 celdas de lunes a domingo. Los días de los
 * meses vecinos quedan como `null` (huecos), igual que en el patrón de WAI-ARIA.
 */
export function monthGrid(year: number, month: number): MonthGridCell[][] {
  const first = toIso({ year, month, day: 1 });
  const offset = weekdayIndex(first);
  const total = daysInMonth(year, month);
  const cells: MonthGridCell[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= total; day++) cells.push(toIso({ year, month, day }));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: MonthGridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// -------------------------------------------------
// Teclado (patrón "date picker dialog" de WAI-ARIA)
// -------------------------------------------------

export type GridKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown';

const GRID_KEYS: readonly string[] = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
];

export function isGridKey(key: string): key is GridKey {
  return GRID_KEYS.includes(key);
}

/**
 * Próximo día con foco para una tecla de la grilla:
 * flechas = ±1 día / ±1 semana; Inicio/Fin = lunes/domingo de esa semana;
 * RePág/AvPág = ±1 mes (con Mayús, ±1 año). El resultado se acota a min/max
 * para que el foco nunca quede en un día que no se puede elegir.
 */
export function nextFocusDate(
  current: IsoDate,
  key: GridKey,
  options: { shift?: boolean; min?: IsoDate; max?: IsoDate } = {},
): IsoDate {
  const { shift = false, min, max } = options;
  let next: IsoDate;
  switch (key) {
    case 'ArrowLeft':
      next = addDays(current, -1);
      break;
    case 'ArrowRight':
      next = addDays(current, 1);
      break;
    case 'ArrowUp':
      next = addDays(current, -7);
      break;
    case 'ArrowDown':
      next = addDays(current, 7);
      break;
    case 'Home':
      next = addDays(current, -weekdayIndex(current));
      break;
    case 'End':
      next = addDays(current, 6 - weekdayIndex(current));
      break;
    case 'PageUp':
      next = shift ? addYears(current, -1) : addMonths(current, -1);
      break;
    case 'PageDown':
      next = shift ? addYears(current, 1) : addMonths(current, 1);
      break;
  }
  return clampIso(next, min, max);
}

/** Día que recibe el foco al abrir: el elegido, o hoy, acotado al rango. */
export function initialFocusDate(
  value: string | null | undefined,
  options: { min?: IsoDate; max?: IsoDate; today?: IsoDate } = {},
): IsoDate {
  const base = isValidIso(value) ? value : (options.today ?? todayIso());
  return clampIso(base, options.min, options.max);
}

/** ¿Algún día del mes entra en el rango? (habilita las flechas de mes). */
export function monthHasSelectableDays(
  year: number,
  month: number,
  min?: IsoDate,
  max?: IsoDate,
): boolean {
  const first = toIso({ year, month, day: 1 });
  const last = toIso({ year, month, day: daysInMonth(year, month) });
  if (min && isValidIso(min) && compareIso(last, min) < 0) return false;
  if (max && isValidIso(max) && compareIso(first, max) > 0) return false;
  return true;
}

/**
 * Años del selector rápido. Con min/max se usan esos límites; si falta alguno,
 * se ofrecen 100 años hacia atrás y 10 hacia adelante desde hoy (alcanza para
 * fechas de nacimiento y para el calendario de eventos). El año visible se
 * incluye siempre, aunque quede afuera.
 */
export function yearOptions(
  visibleYear: number,
  options: { min?: IsoDate; max?: IsoDate; today?: IsoDate } = {},
): number[] {
  const todayYear = parseIso(options.today ?? todayIso())?.year ?? visibleYear;
  const from = parseIso(options.min)?.year ?? todayYear - 100;
  const to = parseIso(options.max)?.year ?? todayYear + 10;
  const start = Math.min(from, visibleYear);
  const end = Math.max(to, visibleYear);
  const years: number[] = [];
  for (let year = end; year >= start; year--) years.push(year);
  return years;
}
