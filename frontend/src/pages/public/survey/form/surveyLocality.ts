// ===========================================
// surveyLocality — departamento → localidad en el formulario
// ===========================================
//
// Reglas puras del selector territorial de la encuesta. Viven afuera del
// componente para que `scripts/check-survey.mjs` las pruebe contra el fuente
// real. La localidad es opcional, como el resto de los cortes demográficos:
// lo único que importa es que, si se elige, sea una del catálogo.
import type { DepartmentWithLocalities, LocalityItem } from '@/api/localities.api';

/** Localidades del departamento elegido, en el orden del catálogo. */
export function localidadesDeDepartamento(
  catalogo: readonly DepartmentWithLocalities[],
  departmentId: string | undefined,
): LocalityItem[] {
  if (!departmentId) return [];
  return catalogo.find((d) => d.id === departmentId)?.localities ?? [];
}

/**
 * Departamento al que pertenece una localidad. Lo usa el paso de contexto
 * para reconstruir el primer selector cuando se restaura un borrador que sólo
 * guardó la localidad.
 */
export function departamentoDeLocalidad(
  catalogo: readonly DepartmentWithLocalities[],
  localityId: string | undefined,
): string | undefined {
  if (!localityId) return undefined;
  return catalogo.find((d) => d.localities.some((l) => l.id === localityId))?.id;
}

/**
 * Localidad que queda elegida al cambiar de departamento: se conserva sólo si
 * pertenece al nuevo; si no, se limpia (sería un corte imposible).
 */
export function localidadTrasCambiarDepartamento(
  catalogo: readonly DepartmentWithLocalities[],
  departmentId: string | undefined,
  localityId: string | undefined,
): string | undefined {
  if (!localityId) return undefined;
  return localidadesDeDepartamento(catalogo, departmentId).some(
    (l) => l.id === localityId,
  )
    ? localityId
    : undefined;
}
