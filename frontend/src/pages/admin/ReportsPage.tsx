// ===========================================
// Reports Page
// ===========================================
import { useState } from 'react';
import { BarChart3, FileSpreadsheet, Users, Trophy, Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportsApi, downloadBlob, type ReportFormat } from '@/api/reports.api';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';

interface ReportCardConfig {
  id: 'participantes' | 'inscripciones' | 'equipos' | 'resultados';
  title: string;
  description: string;
  icon: typeof Users;
  accentColor: string;
  borderColor: string;
  badgeColor: string;
  baseFilename: string;
}

const REPORT_CARDS: ReportCardConfig[] = [
  {
    id: 'participantes',
    title: 'Padrón de Participantes',
    description: 'Listado completo de deportistas registrados con DNI, datos de contacto, localidad, departamento y categorías asociadas.',
    icon: Users,
    accentColor: 'text-blue-600',
    borderColor: 'border-t-blue-500',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    baseFilename: 'padron_participantes',
  },
  {
    id: 'inscripciones',
    title: 'Inscripciones por Disciplina',
    description: 'Reporte detallado de todas las inscripciones individuales y de equipos con estado (Aprobada/Pendiente), código QR y fechas.',
    icon: FileSpreadsheet,
    accentColor: 'text-purple-600',
    borderColor: 'border-t-purple-500',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    baseFilename: 'inscripciones',
  },
  {
    id: 'equipos',
    title: 'Equipos Registrados',
    description: 'Listado de equipos registrados por disciplina y categoría, localidad, departamento y cantidad total de integrantes.',
    icon: FileSpreadsheet,
    accentColor: 'text-emerald-600',
    borderColor: 'border-t-emerald-500',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    baseFilename: 'equipos',
  },
  {
    id: 'resultados',
    title: 'Resultados y Fixture',
    description: 'Historial de competencias, fixture por rondas, enfrentamientos, tanteadores y ganadores con sede asignada.',
    icon: Trophy,
    accentColor: 'text-amber-600',
    borderColor: 'border-t-amber-500',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    baseFilename: 'resultados_fixture',
  },
];

export function ReportsPage() {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleExport = async (
    type: 'participantes' | 'inscripciones' | 'equipos' | 'resultados',
    format: ReportFormat,
    baseFilename: string,
    label: string
  ) => {
    const actionKey = `${type}-${format}`;
    const extension = format === 'xlsx' ? 'xlsx' : 'csv';
    const filename = `${baseFilename}.${extension}`;
    const formatLabel = format === 'xlsx' ? 'Excel (.xlsx)' : 'CSV';

    const toastId = toast.loading(`Generando reporte de ${label} en formato ${formatLabel}...`);

    try {
      setLoadingAction(actionKey);

      let blob: Blob;
      if (type === 'participantes') {
        blob = await reportsApi.exportParticipants(undefined, format);
      } else if (type === 'inscripciones') {
        blob = await reportsApi.exportInscriptions(undefined, format);
      } else if (type === 'equipos') {
        blob = await reportsApi.exportTeams(undefined, format);
      } else {
        blob = await reportsApi.exportResults(undefined, format);
      }

      downloadBlob(blob, filename);
      toast.success(`Reporte de ${label} (${formatLabel}) descargado exitosamente`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error(`Error al generar el reporte de ${label}`, { id: toastId });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reportes y Exportación"
        description="Descarga información del sistema en formatos CSV y Excel (.xlsx) con diseño profesional"
        icon={<BarChart3 className="w-5 h-5 text-white" />}
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {REPORT_CARDS.map((card) => {
          const Icon = card.icon;
          const isCsvLoading = loadingAction === `${card.id}-csv`;
          const isExcelLoading = loadingAction === `${card.id}-xlsx`;
          const isAnyLoading = loadingAction !== null;

          return (
            <div
              key={card.id}
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
                  disabled={isAnyLoading}
                  onClick={() => handleExport(card.id, 'xlsx', card.baseFilename, card.title)}
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
                  disabled={isAnyLoading}
                  onClick={() => handleExport(card.id, 'csv', card.baseFilename, card.title)}
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
        })}
      </div>
    </div>
  );
}
