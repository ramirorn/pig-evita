// ===========================================
// Impact Map Page — Admin
// ===========================================
import { Map as MapIcon } from 'lucide-react';
import { useLocalityStats } from '@/hooks/useLocalityStats';
import { PageHeader } from '@/components/shared/PageHeader';
import { LocalityImpactMap } from '@/components/localityMap/LocalityImpactMap';

/**
 * El mismo mapa del sitio público, dentro del panel. Los datos son públicos:
 * la pantalla existe para que las autoridades lo tengan a mano junto al
 * dashboard, no porque muestre algo distinto.
 */
export function ImpactMapAdminPage() {
  const { data, isLoading, isError, refetch, isFetching } = useLocalityStats();

  return (
    <LocalityImpactMap
      placement="admin"
      header={
        <PageHeader
          title="Mapa de impacto"
          description="Participación y resultados de cada localidad"
          icon={<MapIcon className="w-5 h-5 text-white" />}
        />
      }
      data={data}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => void refetch()}
      isRetrying={isFetching}
    />
  );
}
