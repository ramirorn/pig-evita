// ===========================================
// eventStageStyles — paleta por etapa del calendario público
// ===========================================

/**
 * Cada etapa pinta tres piezas distintas de la tarjeta (el badge, el nodo del
 * timeline y la franja lateral). Van juntas en un objeto porque siempre se
 * eligen de a tres: si se separaran en tres mapas sueltos sería posible que una
 * etapa quedara con el badge de un color y la franja de otro.
 */
export interface StageStyle {
  badge: string;
  dot: string;
  stripe: string;
}

const STAGE_STYLES: Record<string, StageStyle> = {
  ZONAL: {
    badge: 'bg-celeste-50 text-celeste-800 border-celeste-300',
    dot: 'border-celeste-500 bg-celeste-500',
    stripe: 'bg-celeste-500',
  },
  DEPARTAMENTAL: {
    badge: 'bg-accent-50 text-accent-800 border-accent-300',
    dot: 'border-accent-500 bg-accent-500',
    stripe: 'bg-accent-500',
  },
  PROVINCIAL: {
    badge: 'bg-secondary-50 text-secondary-800 border-secondary-300',
    dot: 'border-secondary-500 bg-secondary-500',
    stripe: 'bg-secondary-500',
  },
};

const DEFAULT_STYLE: StageStyle = {
  badge: 'bg-primary-50 text-primary-800 border-primary-300',
  dot: 'border-primary-500 bg-primary-500',
  stripe: 'bg-primary-500',
};

/**
 * `stage` llega como string libre del backend, así que cualquier valor que no
 * esté en el mapa (o la ausencia de etapa) cae al estilo neutro en vez de
 * romper el render.
 */
export function getStageStyle(stage: string | null | undefined): StageStyle {
  return (stage && STAGE_STYLES[stage]) || DEFAULT_STYLE;
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
