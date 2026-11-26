// ===========================================
// Límites y helpers de validación compartidos
// ===========================================
import { z } from 'zod';

// ==========================================
// Límites compartidos
// ==========================================
//
// Criterio general (T15): el backend es la autoridad de validación; estos
// schemas existen para dar UX (mensajes claros antes de gastar un request).
// Por eso ninguna regla de acá puede ser MÁS LAXA que el DTO equivalente del
// backend — eso produciría un 400 incomprensible — pero sí puede ser más
// estricta.
//
// Ninguna columna de texto de Prisma tiene largo declarado (`String` en
// Postgres = `text`, sin límite) y los DTOs del backend no usan `@MaxLength`.
// Es decir: los máximos de abajo NO salen del esquema ni del backend, salen
// del dominio. Se documenta de dónde sale cada número; donde no hay un límite
// justificable, no se inventa uno.

/** Nombre y apellido de una persona. 60 es holgado para lo que entra en un DNI argentino. */
export const MAX_NOMBRE_PERSONA = 60;

/** Localidad / departamento de Formosa. El nombre más largo del catálogo no llega a 40. */
export const MAX_NOMBRE_LUGAR = 60;

/** Dirección postal de una línea. */
export const MAX_DIRECCION = 200;

/** Máximo de un email según RFC 5321 (64 de local-part + @ + 255 de dominio, truncado al límite práctico). */
const MAX_EMAIL = 254;

/**
 * El backend hashea con argon2 (`auth.service.ts`), que no trunca la entrada
 * como sí hace bcrypt a 72 bytes. El tope es sólo para evitar que un pegado
 * accidental de miles de caracteres se vaya a hashear.
 */
export const MAX_PASSWORD = 128;

/**
 * Campos de texto largo (`@db.Text`): reglamentos, contenido de noticias.
 * No hay límite de columna. El tope real es el body parser de Express, que sin
 * configuración explícita corta en 100 kB. 50.000 caracteres deja margen para
 * el resto del payload y para el escapado JSON de acentos.
 */
export const MAX_TEXTO_LARGO = 50_000;

// ==========================================
// Helpers de validación
// ==========================================

/** Texto obligatorio: recorta espacios y exige un mínimo y un máximo. */
export const textoObligatorio = (min: number, max: number, mensajeMin: string, entidad: string) =>
  z
    .string()
    .trim()
    .min(min, mensajeMin)
    .max(max, `${entidad} no puede superar los ${max} caracteres`);

/**
 * Los campos opcionales llegan como `''` desde un input controlado, pero como
 * `null` cuando el formulario se rellena con un registro existente (Prisma
 * devuelve `null`, no `undefined`, para las columnas `String?`). Sin esta
 * normalización, editar un participante sin teléfono cargado falla con un
 * "expected string, received null" que no se puede corregir desde la UI.
 */
export const nullishAVacio = (valor: string | null | undefined): string => (valor === null || valor === undefined ? '' : valor);

/**
 * Texto opcional que llega como `''` desde los inputs controlados.
 * Se normaliza a `undefined` para que el backend lo trate como ausente:
 * `@IsOptional()` de class-validator sólo saltea `null`/`undefined`, así que un
 * `''` enviado a un campo con `@IsEmail()` devuelve 400.
 */
export const textoOpcional = (max: number, entidad: string) =>
  z
    .preprocess(
      nullishAVacio,
      z
        .string()
        .trim()
        .max(max, `${entidad} no puede superar los ${max} caracteres`)
        .transform((valor) => (valor === '' ? undefined : valor)),
    )
    .optional();

/** Email obligatorio. */
export const emailObligatorio = () =>
  z
    .string()
    .trim()
    .min(1, 'El email es obligatorio')
    .max(MAX_EMAIL, `El email no puede superar los ${MAX_EMAIL} caracteres`)
    .refine(
      (valor) => z.email().safeParse(valor).success,
      'Ingresá un email válido (por ejemplo nombre@correo.com)',
    );

/** Email opcional: acepta vacío y lo manda como ausente. */
export const emailOpcional = () =>
  z
    .preprocess(
      nullishAVacio,
      z
        .string()
        .trim()
        .max(MAX_EMAIL, `El email no puede superar los ${MAX_EMAIL} caracteres`)
        .refine(
          (valor) => valor === '' || z.email().safeParse(valor).success,
          'Ingresá un email válido (por ejemplo nombre@correo.com) o dejá el campo vacío',
        )
        .transform((valor) => (valor === '' ? undefined : valor)),
    )
    .optional();

/**
 * Teléfono argentino tal como lo tipea una persona: dígitos más los separadores
 * habituales (`+54`, `(3704)`, `370-412-3456`). No se normaliza el formato
 * porque el backend guarda el string tal cual (`phone String?`).
 */
const PHONE_REGEX = /^[\d+\s()-]+$/;
/** Un fijo de Formosa sin código de área ya tiene 6; con área, 10. 8 es el piso razonable. */
const MIN_PHONE = 8;
/** `+54 9 3704 12-3456` entra cómodo en 20. */
const MAX_PHONE = 20;

export const telefonoOpcional = () =>
  z
    .preprocess(
      nullishAVacio,
      z
        .string()
        .trim()
        .superRefine((valor, ctx) => {
          if (valor === '') return; // campo vacío = no informado
          if (!PHONE_REGEX.test(valor)) {
            ctx.addIssue({
              code: 'custom',
              message: 'El teléfono sólo puede tener números, espacios y los signos + - ( )',
            });
            return;
          }
          if (valor.length < MIN_PHONE) {
            ctx.addIssue({
              code: 'custom',
              message: 'El teléfono es muy corto: incluí el código de área (por ejemplo 3704123456)',
            });
            return;
          }
          if (valor.length > MAX_PHONE) {
            ctx.addIssue({
              code: 'custom',
              message: `El teléfono no puede superar los ${MAX_PHONE} caracteres`,
            });
          }
        })
        .transform((valor) => (valor === '' ? undefined : valor)),
    )
    .optional();

// ------------------------------------------
// Fechas
// ------------------------------------------

/** El `DatePicker` (como antes el campo de fecha nativo) siempre entrega `YYYY-MM-DD`. */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** El selector de hora (`ClockTimePicker`) entrega `HH:MM` (24 h). */
export const ISO_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Valida que la cadena sea una fecha real del calendario.
 * `Date.parse('2010-02-30')` no falla (rueda a marzo), así que hay que
 * comparar los componentes después de construir la fecha.
 * Se usa UTC a propósito: con hora local, `new Date('2010-05-15')` se corre un
 * día en Formosa (UTC-3) y un cumpleaños del 1 de enero cambia de año.
 */
export function esFechaDeCalendario(valor: string): boolean {
  if (!ISO_DATE_REGEX.test(valor)) return false;
  const anio = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(5, 7));
  const dia = Number(valor.slice(8, 10));
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** Fecha opcional que puede venir vacía desde el formulario. */
export const fechaOpcional = (mensaje: string) =>
  z
    .preprocess(
      nullishAVacio,
      z
        .string()
        .trim()
        .refine((valor) => valor === '' || esFechaDeCalendario(valor), mensaje)
        .transform((valor) => (valor === '' ? undefined : valor)),
    )
    .optional();
