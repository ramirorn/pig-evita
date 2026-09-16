// ===========================================
// SurveyCampaignStatusBadge — en qué estado está una campaña (S20)
// ===========================================
import { CircleDot, Lock, PencilLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SurveyCampaignStatus } from '@/types';
// Igual que en `SupresionKAnonimato`: el texto compartido vive con las reglas
// para que este archivo exporte sólo componentes.
import { SURVEY_STATUS_AYUDA } from './surveyRules';

/**
 * Las clases van **literales y completas**, nunca interpoladas (regla D1). Un
 * `bg-${color}-50` no existe para Tailwind en tiempo de build: la clase no se
 * genera y el badge sale sin fondo.
 */
const ESTILOS: Record<SurveyCampaignStatus, string> = {
  [SurveyCampaignStatus.BORRADOR]:
    'bg-accent-50 text-accent-800 border-accent-300',
  [SurveyCampaignStatus.ACTIVA]:
    'bg-secondary-50 text-secondary-700 border-secondary-200',
  [SurveyCampaignStatus.CERRADA]:
    'bg-primary-100 text-primary-800 border-primary-200',
};

const ICONOS: Record<SurveyCampaignStatus, typeof CircleDot> = {
  [SurveyCampaignStatus.BORRADOR]: PencilLine,
  [SurveyCampaignStatus.ACTIVA]: CircleDot,
  [SurveyCampaignStatus.CERRADA]: Lock,
};

const ETIQUETAS: Record<SurveyCampaignStatus, string> = {
  [SurveyCampaignStatus.BORRADOR]: 'Borrador',
  [SurveyCampaignStatus.ACTIVA]: 'Recibiendo respuestas',
  [SurveyCampaignStatus.CERRADA]: 'Cerrada',
};

interface SurveyCampaignStatusBadgeProps {
  status: SurveyCampaignStatus;
}

export function SurveyCampaignStatusBadge({ status }: SurveyCampaignStatusBadgeProps) {
  const Icono = ICONOS[status];

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5', ESTILOS[status])}
      title={SURVEY_STATUS_AYUDA[status]}
    >
      <Icono className="h-3 w-3" aria-hidden="true" />
      {ETIQUETAS[status]}
    </Badge>
  );
}
