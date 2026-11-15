// ===========================================
// InscriptionStatusBadge — Estado de una inscripción
// ===========================================
import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';
import { INSCRIPTION_STATUS_LABELS } from '@/lib/constants';
import { InscriptionStatus } from '@/types';

/**
 * Clases de color por estado. Vive a nivel de módulo (no dentro del componente)
 * para que el objeto se construya una sola vez en toda la vida de la app y no
 * en cada render de cada fila de la tabla.
 */
type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>;

const STATUS_VARIANT: Record<InscriptionStatus, BadgeVariant> = {
  // Variantes semánticas del Badge (fondo suave + texto fuerte, AA).
  [InscriptionStatus.PENDIENTE]: 'warning',
  [InscriptionStatus.REVISADA]: 'info',
  [InscriptionStatus.APROBADA]: 'success',
  [InscriptionStatus.RECHAZADA]: 'danger',
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
    <Badge variant={STATUS_VARIANT[status]} className={cn(className)}>
      {INSCRIPTION_STATUS_LABELS[status]}
    </Badge>
  );
});
