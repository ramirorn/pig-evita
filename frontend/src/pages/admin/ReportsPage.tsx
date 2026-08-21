// ===========================================
// Reports Page
// ===========================================
import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import { PageHeader } from '@/components/shared/PageHeader';

import { REPORT_CARDS } from './reports/reportCards';
import { ReportCard } from './reports/ReportCard';
import { ReportFiltersPanel } from './reports/ReportFiltersPanel';
import { useReportExport } from './reports/useReportExport';
import { EMPTY_REPORT_FILTERS, type ReportFilters } from './reports/reportFilters';

export function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);

  const { data: disciplines } = useDisciplines();
  const { data: categories } = useCategories({
    disciplineId: filters.disciplineId !== 'all' ? filters.disciplineId : undefined,
  });

  const { loadingAction, isExporting, handleExport } = useReportExport(filters);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reportes y Exportación"
        description="Descarga información del sistema en formatos CSV y Excel (.xlsx) con filtros por disciplina, categoría, departamento y localidad"
        icon={<BarChart3 className="w-5 h-5 text-white" />}
      />

      {/* Global Filter Bar */}
      <ReportFiltersPanel
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={() => setFilters(EMPTY_REPORT_FILTERS)}
        disciplines={disciplines?.data ?? []}
        categories={categories?.data ?? []}
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
