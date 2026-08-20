// ===========================================
// @IsDni() — regla única de qué es un DNI válido (T24)
// ===========================================
import { applyDecorators } from '@nestjs/common';
import type { ValidationOptions } from 'class-validator';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Formato de DNI argentino aceptado por el sistema: 7 u 8 dígitos, sin puntos
 * ni separadores. El frontend normaliza antes de enviar.
 *
 * Vive acá y no inline en cada DTO porque el DNI es la clave de identidad del
 * participante: hasta T24 había dos copias de este regex (inscriptions y
 * participants) que podían divergir sin que ningún test lo notara, y una
 * divergencia significa que el mismo documento entra por una puerta y rebota
 * por la otra.
 */
export const DNI_REGEX = /^\d{7,8}$/;

/**
 * Mensajes visibles para el usuario final (español rioplatense).
 * Se exportan para que los tests puedan afirmar sobre ellos sin repetir strings.
 */
export const DNI_MESSAGES = {
  requerido: 'El DNI es obligatorio',
  formato: 'El DNI debe tener 7 u 8 dígitos',
} as const;

/**
 * Valida un campo DNI obligatorio.
 *
 * Compone las tres validaciones que estaban repetidas en los DTOs
 * (`@IsString` + `@IsNotEmpty` + `@Matches`) en vez de sólo el regex: si
 * dejáramos `@IsNotEmpty` en el call site, un `dni: ''` pasaría de devolver dos
 * mensajes de error a devolver uno, y el frontend podría estar mostrando
 * cualquiera de los dos. El objetivo de T24 es no cambiar el comportamiento.
 *
 * La obligatoriedad no molesta a los `UpdateXxxDto`: `PartialType()` inyecta
 * `@IsOptional()` sobre cada propiedad heredada, así que un update sin `dni`
 * sigue siendo válido — igual que antes.
 *
 * @example
 * ⁠@ApiProperty({ description: 'DNI del participante', example: '12345678' })
 * ⁠@IsDni()
 * dni: string;
 *
 * @remarks
 * Este decorador es el lugar correcto para endurecer la regla más adelante
 * (ver T15: rechazar dígitos repetidos como `00000000` / `11111111`). El
 * cliente valida por UX, el servidor por seguridad: si T15 agrega esa regla en
 * Zod, tiene que agregarse también acá o el backend seguirá aceptando lo que el
 * frontend rechaza. **No implementada todavía a propósito**, para no cambiar el
 * comportamiento de validación dentro del alcance de T24.
 */
export function IsDni(validationOptions?: ValidationOptions) {
  return applyDecorators(
    IsString(validationOptions),
    IsNotEmpty({ message: DNI_MESSAGES.requerido, ...validationOptions }),
    Matches(DNI_REGEX, { message: DNI_MESSAGES.formato, ...validationOptions }),
  );
}
