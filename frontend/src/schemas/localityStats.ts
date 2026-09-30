// ===========================================
// Schema de GET /stats/localities (mapa de impacto por localidad)
// ===========================================
//
// Vive en su propio archivo y no en `schemas/index.ts` porque no valida un
// formulario sino una **respuesta**: el mapa la consume en el sitio público y
// en el panel, y el chequeo `check:map` lo bundlea sin arrastrar el resto de
// los schemas (ni sus enums de `@/types`).
//
// Se valida en el borde (en `stats.api.ts`) porque el endpoint es nuevo y lo
// consume una pantalla pública: si el contrato cambia, preferimos un error
// explícito con "Reintentar" a un mapa que pinta `NaN` o se cae a mitad del
// render.
import { z } from 'zod';

const conteo = z.number().int().nonnegative();

export const localityStatSchema = z.object({
  /** Texto libre del participante: se empareja contra el mapa en `localityMap.ts`. */
  locality: z.string(),
  department: z.string(),
  athletes: conteo,
  delegations: conteo,
  disciplines: conteo,
  categories: conteo,
  podiums: z.object({
    first: conteo,
    second: conteo,
    third: conteo,
  }),
  wins: conteo,
});

export const localityStatsSchema = z.object({
  generatedAt: z.string(),
  /** Las localidades sin participación no vienen. */
  localities: z.array(localityStatSchema),
});

export type LocalityStat = z.infer<typeof localityStatSchema>;
export type LocalityStats = z.infer<typeof localityStatsSchema>;
