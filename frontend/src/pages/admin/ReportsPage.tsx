// ===========================================
// Reports Page
// ===========================================
import { useState } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Users,
  Trophy,
  Loader2,
  FileText,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { reportsApi, downloadBlob, type ReportFormat } from '@/api/reports.api';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
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
    description:
      'Listado completo de deportistas registrados con DNI, datos de contacto, localidad, departamento y categorías asociadas.',
    icon: Users,
    accentColor: 'text-blue-600',
    borderColor: 'border-t-blue-500',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    baseFilename: 'padron_participantes',
  },
  {
    id: 'inscripciones',
    title: 'Inscripciones por Disciplina',
    description:
      'Reporte detallado de todas las inscripciones individuales y de equipos con estado (Aprobada/Pendiente), código QR y fechas.',
    icon: FileSpreadsheet,
    accentColor: 'text-purple-600',
    borderColor: 'border-t-purple-500',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    baseFilename: 'inscripciones',
  },
  {
    id: 'equipos',
    title: 'Equipos Registrados',
    description:
      'Listado de equipos registrados por disciplina y categoría, localidad, departamento y cantidad total de integrantes.',
    icon: FileSpreadsheet,
    accentColor: 'text-emerald-600',
    borderColor: 'border-t-emerald-500',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    baseFilename: 'equipos',
  },
  {
    id: 'resultados',
    title: 'Resultados y Fixture',
    description:
      'Historial de competencias, fixture por rondas, enfrentamientos, tanteadores y ganadores con sede asignada.',
    icon: Trophy,
    accentColor: 'text-amber-600',
    borderColor: 'border-t-amber-500',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    baseFilename: 'resultados_fixture',
  },
];

export function ReportsPage() {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Filters state
  const [disciplineId, setDisciplineId] = useState<string>('all');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [department, setDepartment] = useState<string>('');
  const [locality, setLocality] = useState<string>('');

  const { data: disciplines } = useDisciplines();
  const { data: categories } = useCategories({
    disciplineId: disciplineId !== 'all' ? disciplineId : undefined,
  });

  const hasActiveFilters =
    disciplineId !== 'all' ||
    categoryId !== 'all' ||
    department.trim() !== '' ||
    locality.trim() !== '';

  const handleResetFilters = () => {
    setDisciplineId('all');
    setCategoryId('all');
    setDepartment('');
    setLocality('');
  };

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

    const toastId = toast.loading(
      `Generando reporte de ${label} en formato ${formatLabel}...`
    );

    try {
      setLoadingAction(actionKey);

      const activeDisciplineId =
        disciplineId !== 'all' ? disciplineId : undefined;
      const activeCategoryId = categoryId !== 'all' ? categoryId : undefined;
      const activeDepartment = department.trim() || undefined;
      const activeLocality = locality.trim() || undefined;

      let blob: Blob;
      if (type === 'participantes') {
        blob = await reportsApi.exportParticipants(
          {
            disciplineId: activeDisciplineId,
            categoryId: activeCategoryId,
            department: activeDepartment,
            locality: activeLocality,
          },
          format
        );
      } else if (type === 'inscripciones') {
        blob = await reportsApi.exportInscriptions(
          {
            disciplineId: activeDisciplineId,
            categoryId: activeCategoryId,
          },
          format
        );
      } else if (type === 'equipos') {
        blob = await reportsApi.exportTeams(
          {
            disciplineId: activeDisciplineId,
            categoryId: activeCategoryId,
            department: activeDepartment,
            locality: activeLocality,
          },
          format
        );
      } else {
        blob = await reportsApi.exportResults(undefined, format);
      }

      downloadBlob(blob, filename);
      toast.success(
        `Reporte de ${label} (${formatLabel}) descargado exitosamente`,
        { id: toastId }
      );
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
        description="Descarga información del sistema en formatos CSV y Excel (.xlsx) con filtros por disciplina, categoría, departamento y localidad"
        icon={<BarChart3 className="w-5 h-5 text-white" />}
      />

      {/* Global Filter Bar */}
      <div className="card p-5 space-y-4 bg-white border border-primary-100 shadow-sm">
        <div className="flex items-center justify-between border-b border-primary-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary-600" />
            <h3 className="font-semibold text-sm text-primary-900">
              Filtros para Exportación
            </h3>
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs bg-primary-100 text-primary-800">
                Filtros activos
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-primary-500 hover:text-primary-800 gap-1 h-8 px-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-primary-700">Disciplina</label>
            <Select
              value={disciplineId}
              onValueChange={(v) => {
                setDisciplineId(v);
                setCategoryId('all');
              }}
            >
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Todas las disciplinas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las disciplinas</SelectItem>
                {disciplines?.data.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-primary-700">Categoría</label>
            <Select
              value={categoryId}
              onValueChange={(v) => setCategoryId(v)}
              disabled={disciplineId === 'all'}
            >
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories?.data.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-primary-700">Departamento</label>
            <Input
              placeholder="Ej. Formosa, Pilcomayo..."
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-primary-700">Localidad</label>
            <Input
              placeholder="Ej. Clorinda, Pirané..."
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              className="bg-white"
            />
          </div>
        </div>
      </div>

      {/* Report Cards Grid */}
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
