// ===========================================
// Reports Page
// ===========================================
import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { useAllCategories } from '@/hooks/useCategories';
import { PageHeader } from '@/components/shared/PageHeader';
import { usePermisos } from '@/hooks/usePermisos';

import { REPORT_CARDS } from './reports/reportCards';
import { ReportCard } from './reports/ReportCard';
import { ReportFiltersPanel } from './reports/ReportFiltersPanel';
import { useReportExport } from './reports/useReportExport';
import { EMPTY_REPORT_FILTERS, type ReportFilters } from './reports/reportFilters';

export function ReportsPage() {
  const { puedeFiltrarPorDepartamento } = usePermisos();
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);

  // El selector recorre la paginación hasta el final (S06): con el hook
  // paginado ofrecía como mucho 20 opciones y la 21 era inelegible.
  const { data: disciplines } = useAllDisciplines();
  const { data: categories } = useAllCategories({
    disciplineId: filters.disciplineId !== 'all' ? filters.disciplineId : undefined,
  });

  const { loadingAction, isExporting, handleExport } = useReportExport(filters);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reportes y Exportación"
        description={
          puedeFiltrarPorDepartamento
            ? 'Descarga información del sistema en formatos CSV y Excel (.xlsx) con filtros por disciplina, categoría, departamento y localidad'
            : // R05 — el archivo sale recortado al alcance del usuario y lo dice en
              // su primera fila; conviene que la pantalla lo anticipe.
              'Descarga información en CSV y Excel (.xlsx). Los reportes incluyen únicamente tu alcance territorial, y el archivo lo declara en su primera fila.'
        }
        icon={<BarChart3 className="w-5 h-5 text-white" />}
      />

      {/* Global Filter Bar */}
      <ReportFiltersPanel
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={() => setFilters(EMPTY_REPORT_FILTERS)}
        disciplines={disciplines ?? []}
        categories={categories ?? []}
        mostrarFiltroDepartamento={puedeFiltrarPorDepartamento}
      />

      {/* Report Cards Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {REPORT_CARDS.map((card) => (
          <ReportCard
            key={card.id}
            card={card}
            loadingAction={loadingAction}
            isExporting={isExporting}
            onExport={(format) => handleExport(card.id, format, card.baseFilename, card.title)}
          />
        ))}
      </div>
    </div>
  );
}
