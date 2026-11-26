// ===========================================
// Schemas de sedes
// ===========================================
import { z } from 'zod';
import { MAX_NOMBRE_LUGAR, MAX_DIRECCION, textoObligatorio } from './_helpers';

// ==========================================
// Venue Schemas
// ==========================================

/** Nombre de sede ("Estadio Cincuentenario", "Escuela N° 123 Anexo 2"). */
const MAX_NOMBRE_SEDE = 100;

/**
 * Capacidad de espectadores. El estadio más grande de Formosa ronda las 25.000
 * localidades; 200.000 es un techo defensivo contra el tipeo, no una regla.
 */
const MAX_CAPACIDAD_SEDE = 200_000;

/** Conversión de input de texto a número opcional, compartida por capacity/lat/lng. */
const numeroOpcionalDesdeInput = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  });

export const venueSchema = z.object({
  name: textoObligatorio(2, MAX_NOMBRE_SEDE, 'El nombre de la sede es obligatorio', 'El nombre de la sede'),
  address: textoObligatorio(2, MAX_DIRECCION, 'La dirección es obligatoria', 'La dirección'),
  department: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'El departamento es obligatorio', 'El departamento'),
  locality: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'La localidad es obligatoria', 'La localidad'),
  capacity: numeroOpcionalDesdeInput
    .refine(
      (val) => val === undefined || (Number.isInteger(val) && val >= 0 && val <= MAX_CAPACIDAD_SEDE),
      `La capacidad debe ser un número entero entre 0 y ${MAX_CAPACIDAD_SEDE.toLocaleString('es-AR')}`,
    )
    .optional(),
  // Rango real de una coordenada geográfica, no un criterio de dominio.
  latitude: numeroOpcionalDesdeInput
    .refine(
      (val) => val === undefined || (val >= -90 && val <= 90),
      'La latitud debe estar entre -90 y 90',
    )
    .optional(),
  longitude: numeroOpcionalDesdeInput
    .refine(
      (val) => val === undefined || (val >= -180 && val <= 180),
      'La longitud debe estar entre -180 y 180',
    )
    .optional(),
  isActive: z.boolean().default(true),
});

export type VenueFormValues = z.infer<typeof venueSchema>;
