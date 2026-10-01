// ===========================================
// eventStageStyles — paleta por etapa del calendario público
// ===========================================

/**
 * Cada etapa pinta tres piezas de la tarjeta: el borde izquierdo, el chip con
 * su nombre y el punto del chip. Van juntas en un objeto porque siempre se
 * eligen de a tres, y son **clases completas** (Tailwind no ve las armadas por
 * interpolación).
 *
 * Contraste del texto del chip (WCAG, hex reales del tema): Zonal 8.77:1,
 * Departamental 5.87:1, Provincial 11.50:1. Borde y punto son decorativos y
 * redundantes: el nombre de la etapa siempre va en texto.
 */
export interface StageStyle {
  borde: string;
  chip: string;
  dot: string;
}

const STAGE_STYLES: Record<string, StageStyle> = {
  ZONAL: {
    borde: 'border-l-celeste-500',
    chip: 'bg-celeste-100 text-celeste-800',
    dot: 'bg-celeste-500',
  },
  DEPARTAMENTAL: {
    borde: 'border-l-accent-500',
    chip: 'bg-accent-100 text-accent-800',
    dot: 'bg-accent-500',
  },
  PROVINCIAL: {
    borde: 'border-l-secondary-500',
    chip: 'bg-secondary-100 text-secondary-800',
    dot: 'bg-secondary-500',
  },
};

/**
 * Sin etapa (o una que no está en el mapa): borde neutro y **sin chip** —el
 * dato ausente se omite—. Neutro y no `primary-500`: un azul fuerte se leería
 * como una cuarta etapa.
 */
export const BORDE_SIN_ETAPA = 'border-l-primary-200';

/** `stage` llega como string libre del backend: lo desconocido es "sin etapa". */
export function getStageStyle(stage: string | null | undefined): StageStyle | null {
  return (stage && STAGE_STYLES[stage]) || null;
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
