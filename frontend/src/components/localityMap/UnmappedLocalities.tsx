// ===========================================
// UnmappedLocalities — lo que no se pudo ubicar, a la vista
// ===========================================
import { MapPinOff } from 'lucide-react';
import type { LocalityStat } from '@/schemas/localityStats';
import { formatMetric } from '@/lib/localityMap';

interface UnmappedLocalitiesProps {
  localities: readonly LocalityStat[];
}

/**
 * Localidades con participación que no se pudieron ubicar en el mapa oficial.
 *
 * No se descartan en silencio ni se asignan "a la más parecida": se muestran
 * con sus números, que igual cuentan en los totales de arriba.
 */
export function UnmappedLocalities({ localities }: UnmappedLocalitiesProps) {
  if (localities.length === 0) return null;

  return (
    <section
      aria-labelledby="sin-ubicacion"
      className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
    >
      <h2 id="sin-ubicacion" className="flex items-center gap-2 text-base font-bold text-amber-900">
        <MapPinOff className="h-5 w-5" aria-hidden="true" />
        Sin ubicación en el mapa
      </h2>
      <p className="mt-1 text-sm text-amber-800">
        Estas localidades tienen participación, pero no figuran en el mapa oficial del IGN
        o su nombre no se pudo reconocer. Sus números sí cuentan en los totales.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {localities.map((l, i) => (
          <li key={`${l.locality}-${l.department}-${i}`} className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
            <p className="font-semibold text-primary-800">{l.locality}</p>
            <p className="text-xs text-primary-500">Departamento {l.department}</p>
            <p className="mt-1 text-primary-700">
              {[
                formatMetric(l.athletes, 'athletes'),
                formatMetric(l.delegations, 'delegations'),
                formatMetric(l.disciplines, 'disciplines'),
                formatMetric(l.podiums.first + l.podiums.second + l.podiums.third, 'podiums'),
              ].join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
