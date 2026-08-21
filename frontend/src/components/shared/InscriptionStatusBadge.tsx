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
  // Remapeo a la paleta institucional. Los `orange/blue/green/red` de Tailwind
  // no sólo estaban fuera de marca: tres de los cuatro fallaban AA como texto
  // (3.35:1, 3.15:1 y 4.41:1 contra el umbral de 4.5). Los tokens de acá dan
  // 6.35:1, 8.29:1, 9.87:1 y 5.75:1 respectivamente.
  [InscriptionStatus.PENDIENTE]: 'text-accent-800 bg-accent-50 border-accent-300',
  [InscriptionStatus.REVISADA]: 'text-primary-600 bg-primary-50 border-primary-200',
  [InscriptionStatus.APROBADA]: 'text-secondary-700 bg-secondary-50 border-secondary-200',
  [InscriptionStatus.RECHAZADA]:
    'text-destructive-700 bg-destructive-50 border-destructive-500/30',
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
