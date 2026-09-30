// ===========================================
// Impact Map Page — Public
// ===========================================
import { Map as MapIcon } from 'lucide-react';
import { useLocalityStats } from '@/hooks/useLocalityStats';
import { LocalityImpactMap } from '@/components/localityMap/LocalityImpactMap';

/**
 * El encabezado es más compacto que el `PublicPageHeader` de los listados a
 * propósito: acá el protagonista es el mapa y tiene que entrar entero en la
 * ventana, así que el título va en una sola línea junto a su bajada.
 */
export function ImpactMapPage() {
  const { data, isLoading, isError, refetch, isFetching } = useLocalityStats();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-10">
      <LocalityImpactMap
        placement="public"
        header={
          <div className="flex flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-3">
            <h1 className="font-display flex shrink-0 items-center gap-2 whitespace-nowrap text-2xl font-extrabold tracking-tight text-primary-800">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-800 text-white">
                <MapIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              Mapa de los Juegos
            </h1>
            <p className="text-sm text-primary-600 lg:truncate">
              Participación de cada localidad de la provincia. Tocá un círculo para ver el detalle.
            </p>
          </div>
        }
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    </div>
  );
}
