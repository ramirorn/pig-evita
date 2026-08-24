// ===========================================
// Accesos rápidos del dashboard
// ===========================================
import { ROUTES } from '@/lib/constants';
import { puedeVerRuta, type AdminRoutePath } from '@/lib/adminRoutes';
import type { UserRole } from '@/types';

export interface QuickAction {
  label: string;
  link: AdminRoutePath;
}

/**
 * Los cuatro atajos de la tarjeta "Acción Requerida".
 *
 * Se pintaban sin filtrar, y el dashboard lo ven más roles que las pantallas a
 * las que apuntan: un COORDINADOR tenía cuatro botones y tres terminaban en
 * "Acceso Denegado" (R08).
 */
export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Revisar Inscripciones', link: ROUTES.INSCRIPTIONS },
  { label: 'Generar Fixtures', link: ROUTES.COMPETITIONS },
  { label: 'Cargar Resultados', link: ROUTES.RESULTS },
  { label: 'Descargar Reportes', link: ROUTES.REPORTS },
];

/** Los atajos que un rol puede efectivamente abrir. */
export function quickActionsParaRol(role: UserRole | undefined): QuickAction[] {
  if (!role) return [];
  return QUICK_ACTIONS.filter((action) => puedeVerRuta(role, action.link));
}
