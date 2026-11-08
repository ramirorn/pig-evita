// ===========================================
// LocalityChip — la localidad de una sede, con salida al mapa
// ===========================================
import { Link } from 'react-router';
import { matchLocality } from '@/lib/localityMap';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface LocalityChipProps {
  /** Nombre tal como lo trae el dato (sede, inscripción). */
  name: string | null | undefined;
  className?: string;
}

/**
 * Eco discreto del mapa de calor en el resto del sitio: un punto con el color
 * de la rampa y el nombre de la localidad. Si el nombre se reconoce en el mapa
 * oficial, lleva a `/mapa?localidad=<id>` (el mapa abre su detalle); si no, es
 * sólo texto: nunca un enlace a un lugar que el mapa no sabe ubicar.
 *
 * No muestra cifras: los números salen del mapa, no se repiten (ni se
 * inventan) en las tarjetas.
 */
export function LocalityChip({ name, className }: LocalityChipProps) {
  const limpio = name?.trim();
  if (!limpio) return null;

  const lugar = matchLocality(limpio);
  const base =
    'inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-800';

  const punto = (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full bg-heat-teal ring-2 ring-heat-green/30"
    />
  );

  if (!lugar) {
    return (
      <span className={cn(base, className)}>
        {punto}
        {limpio}
      </span>
    );
  }

  return (
    <Link
      to={`${ROUTES.IMPACT_MAP}?localidad=${encodeURIComponent(lugar.feature.id)}`}
      aria-label={`${limpio}: ver en el mapa de los Juegos`}
      className={cn(
        base,
        'transition-colors duration-120 hover:bg-primary-100 active:bg-primary-200 pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
        className,
      )}
    >
      {punto}
      {limpio}
    </Link>
  );
}
