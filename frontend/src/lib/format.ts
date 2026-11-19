// ===========================================
// Formato de valores que pueden faltar (S10)
//
// La interfaz mostraba "null - null" en el rango de jugadores, "null por
// equipo", títulos "Fútbol - undefined" y códigos de enum crudos ("EQUIPO",
// "ROUND_ROBIN") cuando un dato venía vacío o un mapa no tenía la clave. Estos
// helpers puros son el único lugar que decide qué se ve en esos casos: un
// guion, o directamente nada, pero nunca "null"/"undefined".
//
// Lo fija `npm run check:format`.
// ===========================================

/** Lo que se muestra cuando no hay dato. */
export const SIN_DATO = '—';

/** Un número usable: ni null, ni undefined, ni NaN. */
function esNumero(valor: number | null | undefined): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

/**
 * Texto de un valor que puede faltar. `null`, `undefined`, un string vacío (o
 * de sólo espacios) y `NaN` se muestran como `respaldo`.
 */
export function textoOGuion(
  valor: string | number | null | undefined,
  respaldo: string = SIN_DATO,
): string {
  if (valor === null || valor === undefined) return respaldo;
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : respaldo;
  const limpio = valor.trim();
  return limpio === '' ? respaldo : limpio;
}

/**
 * Rango de jugadores de una disciplina.
 *
 * - ninguno → "—"
 * - iguales → "11"
 * - distintos → "5 a 7"
 * - uno solo → "Hasta 7" / "Desde 5"
 */
export function rangoJugadores(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  const hayMin = esNumero(min);
  const hayMax = esNumero(max);
  if (hayMin && hayMax) return min === max ? String(min) : `${min} a ${max}`;
  if (hayMax) return `Hasta ${max}`;
  if (hayMin) return `Desde ${min}`;
  return SIN_DATO;
}

/**
 * Etiqueta de un valor de enum. Un valor vacío o que el mapa no conoce cae en
 * `respaldo` en lugar de mostrar el código crudo.
 */
export function etiquetaEnum<K extends string>(
  mapa: Readonly<Partial<Record<K, string>>>,
  valor: K | string | null | undefined,
  respaldo: string = SIN_DATO,
): string {
  if (valor === null || valor === undefined || valor === '') return respaldo;
  const etiqueta = (mapa as Readonly<Record<string, string | undefined>>)[valor];
  return etiqueta ?? respaldo;
}

/**
 * Une las partes de un título ("Disciplina - Categoría") salteando las que
 * faltan. Sin ninguna parte devuelve `respaldo`.
 */
export function tituloCompuesto(
  partes: ReadonlyArray<string | null | undefined>,
  separador = ' - ',
  respaldo: string = SIN_DATO,
): string {
  const presentes = partes
    .map((parte) => (typeof parte === 'string' ? parte.trim() : ''))
    .filter(Boolean);
  return presentes.length > 0 ? presentes.join(separador) : respaldo;
}
