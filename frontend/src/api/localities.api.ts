// ===========================================
// Localities API — catálogo territorial público
// ===========================================
import { z } from 'zod';
import apiClient from './client';

const localidadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  zona: z.enum(['CAPITAL', 'INTERIOR']),
});

const departamentoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  localities: z.array(localidadSchema),
});

export const localitiesCatalogSchema = z.array(departamentoSchema);

export type LocalityItem = z.infer<typeof localidadSchema>;
export type DepartmentWithLocalities = z.infer<typeof departamentoSchema>;

export const localitiesApi = {
  /**
   * `GET /localities` — departamentos con sus localidades y la zona de cada
   * una. Público y cacheable: es lo que usa el formulario de la encuesta para
   * que la localidad sea un dato comparable y no un texto libre.
   */
  async findAll(): Promise<DepartmentWithLocalities[]> {
    const { data } = await apiClient.get<unknown>('/localities');
    return localitiesCatalogSchema.parse(data);
  },
};
