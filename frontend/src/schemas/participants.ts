// ===========================================
// Schemas de participantes
// ===========================================
import { z } from 'zod';
import { Sex } from '@/types';
import { MAX_NOMBRE_PERSONA, MAX_NOMBRE_LUGAR, MAX_DIRECCION, textoObligatorio, textoOpcional, emailOpcional, telefonoOpcional, esFechaDeCalendario } from './_helpers';

// ==========================================
// Participant Schemas
// ==========================================

/**
 * Año más antiguo aceptable para una fecha de nacimiento. Nadie con menos de
 * ese año participa de los Juegos Evita; sirve para atajar el error de tipeo
 * clásico (`1020`, `0201`) antes de que llegue al backend.
 */
export const ANIO_MINIMO_NACIMIENTO = 1920;

/**
 * Edad mínima del participante. Es el piso de `categorySchema.minAge` y evita
 * el otro error de tipeo clásico: la fecha de hoy o una fecha futura.
 */
export const EDAD_MINIMA_PARTICIPANTE = 5;

/** Última fecha de nacimiento aceptable: hoy menos `EDAD_MINIMA_PARTICIPANTE` años. */
function fechaNacimientoMaxima(): string {
  const hoy = new Date();
  const anio = hoy.getFullYear() - EDAD_MINIMA_PARTICIPANTE;
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export const participantSchema = z.object({
  /**
   * Mismo formato que `DNI_REGEX` del backend (`common/validators/dni.validator.ts`),
   * más el rechazo de dígitos repetidos que el backend todavía no aplica (T24
   * lo dejó anotado). Es una regla de UX: `00000000` no es un DNI real, pero la
   * API directa lo sigue aceptando.
   */
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 números, sin puntos ni espacios')
    .refine(
      (valor) => !/^(\d)\1+$/.test(valor),
      'Revisá el DNI: no puede ser el mismo dígito repetido (00000000, 11111111, ...)',
    ),
  firstName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El nombre es obligatorio', 'El nombre'),
  lastName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El apellido es obligatorio', 'El apellido'),
  birthDate: z
    .string()
    .trim()
    .superRefine((valor, ctx) => {
      if (valor === '') {
        ctx.addIssue({ code: 'custom', message: 'La fecha de nacimiento es obligatoria' });
        return;
      }
      if (!esFechaDeCalendario(valor)) {
        ctx.addIssue({
          code: 'custom',
          message: 'La fecha de nacimiento no existe en el calendario. Revisá el día y el mes.',
        });
        return;
      }
      // Comparación lexicográfica: dos cadenas `YYYY-MM-DD` ordenan igual que
      // las fechas que representan, sin construir Date ni cruzar husos horarios.
      if (valor.slice(0, 4) < String(ANIO_MINIMO_NACIMIENTO)) {
        ctx.addIssue({
          code: 'custom',
          message: `El año de nacimiento no puede ser anterior a ${ANIO_MINIMO_NACIMIENTO}. Revisá el año.`,
        });
        return;
      }
      if (valor > fechaNacimientoMaxima()) {
        ctx.addIssue({
          code: 'custom',
          message: `El participante debe tener al menos ${EDAD_MINIMA_PARTICIPANTE} años cumplidos y no puede haber nacido en el futuro. Revisá el año.`,
        });
      }
    }),
  sex: z.nativeEnum(Sex, { message: 'Sexo inválido' }),
  phone: telefonoOpcional(),
  email: emailOpcional(),
  locality: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'La localidad es obligatoria', 'La localidad'),
  department: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'El departamento es obligatorio', 'El departamento'),
  address: textoOpcional(MAX_DIRECCION, 'La dirección'),
});
