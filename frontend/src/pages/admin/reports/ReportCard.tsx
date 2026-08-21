// ===========================================
// ReportCard — tarjeta de un reporte con sus dos formatos de descarga
// ===========================================
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { ReportFormat } from '@/api/reports.api';
import type { ReportCardConfig } from './reportCards';
import { Button } from '@/components/ui/button';

interface ReportCardProps {
  card: ReportCardConfig;
  /** Clave `${id}-${format}` de la descarga en curso, o null si no hay ninguna. */
  loadingAction: string | null;
  /** Hay una descarga en curso (de este reporte o de cualquier otro). */
  isExporting: boolean;
  onExport: (format: ReportFormat) => void;
}

export function ReportCard({ card, loadingAction, isExporting, onExport }: ReportCardProps) {
  const Icon = card.icon;
  const isCsvLoading = loadingAction === `${card.id}-csv`;
  const isExcelLoading = loadingAction === `${card.id}-xlsx`;

  return (
    <div
      className={`card p-6 flex flex-col h-full border-t-4 ${card.borderColor} hover:shadow-lg transition-all duration-200 bg-white`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2.5 rounded-xl bg-primary-50/80 ${card.accentColor}`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-lg text-primary-900 leading-snug">{card.title}</h3>
      </div>

      <p className="text-primary-600 text-sm mb-6 flex-1 leading-relaxed">
        {card.description}
      </p>

      <div className="space-y-2.5 pt-4 border-t border-primary-100">
        {/* Excel Option */}
        <Button
          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all"
          disabled={isExporting}
          onClick={() => onExport('xlsx')}
        >
          {isExcelLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
          )}
          Exportar Excel (.xlsx)
        </Button>

        {/* CSV Option */}
        <Button
          variant="outline"
          className="w-full gap-2 border-primary-200 text-primary-700 hover:bg-primary-50 hover:text-primary-900 font-medium transition-all"
          disabled={isExporting}
          onClick={() => onExport('csv')}
        >
          {isCsvLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
          ) : (
            <FileText className="w-4 h-4 text-primary-500" />
          )}
          Exportar CSV
        </Button>
      </div>
    </div>
  );
}
