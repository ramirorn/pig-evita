// ===========================================
// InscriptionStatusBadge — Estado de una inscripción
// ===========================================
import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { INSCRIPTION_STATUS_LABELS } from '@/lib/constants';
import { InscriptionStatus } from '@/types';

/**
 * Clases de color por estado. Vive a nivel de módulo (no dentro del componente)
 * para que el objeto se construya una sola vez en toda la vida de la app y no
 * en cada render de cada fila de la tabla.
 */
const STATUS_CLASSES: Record<InscriptionStatus, string> = {
  [InscriptionStatus.PENDIENTE]: 'text-orange-600 bg-orange-50 border-orange-200',
  [InscriptionStatus.REVISADA]: 'text-blue-600 bg-blue-50 border-blue-200',
  [InscriptionStatus.APROBADA]: 'text-green-600 bg-green-50 border-green-200',
  [InscriptionStatus.RECHAZADA]: 'text-red-600 bg-red-50 border-red-200',
};

interface InscriptionStatusBadgeProps {
  status: InscriptionStatus;
  className?: string;
}

/**
 * Badge del estado de una inscripción (hallazgos Q19/Q28).
 *
 * Antes cada página resolvía el color y la etiqueta por su cuenta: un `switch`
 * redefinido en cada render en `InscriptionsPage` y una cadena de ternarios en
 * `InscriptionDetailPage`, con paletas que ya empezaban a divergir. Ahora hay
 * una sola fuente de verdad.
 *
 * Está envuelto en `memo` a propósito: en la tabla de inscripciones se monta una
 * instancia por fila, y las props que recibe son *primitivas* (`status` es un
 * string enum, `className` un literal). Al ser referencialmente estables entre
 * renders, la comparación superficial de `memo` da `true` y React saltea el
 * re-render de las N filas cuando la página se vuelve a renderizar por algo que
 * no cambió la lista — por ejemplo tipear en el buscador.
 *
 * ⚠️ Si algún día necesita una prop objeto/array/función, hay que estabilizarla
 * en el llamador (`useMemo`/`useCallback`) o el `memo` deja de servir.
 */
export const InscriptionStatusBadge = memo(function InscriptionStatusBadge({
  status,
  className,
}: InscriptionStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status], className)}>
      {INSCRIPTION_STATUS_LABELS[status]}
    </Badge>
  );
});
