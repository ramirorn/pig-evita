// ===========================================
// @ToBoolean — coerción explícita de booleanos (R10)
// ===========================================
//
// El `ValidationPipe` global corre con `enableImplicitConversion: true`, y esa
// conversión implícita hace `Boolean(valor)` sobre el string crudo de la query.
// Como **todo string no vacío es truthy**, `?isActive=false` llegaba al service
// como `true` y el listado devolvía exactamente lo contrario de lo pedido. El
// filtro no fallaba: mentía, que es peor.
//
// Por qué un `@Transform` por campo y no apagar `enableImplicitConversion`
// globalmente: esa opción es la que hoy convierte a número los `page`/`limit`
// que no llevan `@Type(() => Number)` y la que resuelve las coerciones de
// varios DTOs de query que no declaran transformación propia. Apagarla arregla
// los booleanos y rompe, en silencio y a la vez, toda la coerción numérica y de
// fechas de la API — un cambio global para un bug acotado. El `@Transform`
// se aplica sólo donde hace falta y no toca nada más.
//
// Detalle de implementación que importa: la función lee `obj[key]` (el valor
// **crudo** del objeto plano) y no `value`. `class-transformer` corre la
// conversión implícita *antes* de las transformaciones custom, así que para
// cuando llega acá `value` ya vale `true`; `obj[key]` sigue siendo `'false'`.
import { Transform } from 'class-transformer';

/** Strings que se aceptan como `true` / `false`, normalizados a minúscula. */
const VERDADEROS = new Set(['true', '1', 'yes', 'si', 'sí', 'on']);
const FALSOS = new Set(['false', '0', 'no', 'off']);

/**
 * Convierte el valor crudo de una query string en booleano.
 *
 * - `undefined` / `null` / `''` → `undefined` (campo ausente: el service no
 *   debe filtrar por él).
 * - booleano real (body JSON) → se devuelve tal cual.
 * - string reconocido → el booleano correspondiente.
 * - cualquier otra cosa → se devuelve **sin tocar**, para que `@IsBoolean()`
 *   la rechace con un 400. Nunca se adivina.
 */
export function parseBooleanQuery(valor: unknown): unknown {
  if (valor === undefined || valor === null || valor === '') return undefined;
  if (typeof valor === 'boolean') return valor;

  if (typeof valor === 'number') {
    if (valor === 1) return true;
    if (valor === 0) return false;
    return valor;
  }

  if (typeof valor === 'string') {
    const normalizado = valor.trim().toLowerCase();
    if (VERDADEROS.has(normalizado)) return true;
    if (FALSOS.has(normalizado)) return false;
  }

  return valor;
}

/**
 * Decorador para los campos booleanos de los DTOs.
 *
 * Va **siempre** acompañado de `@IsBoolean()`: el transform normaliza lo que
 * reconoce y `@IsBoolean()` rechaza el resto.
 *
 * @example
 * ⁠@IsOptional()
 * ⁠@ToBoolean()
 * ⁠@IsBoolean()
 * isActive?: boolean;
 */
export const ToBoolean = () =>
  Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
    parseBooleanQuery(obj?.[key]),
  );
