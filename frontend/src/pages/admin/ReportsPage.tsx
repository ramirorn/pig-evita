// ===========================================
// Reports Page
// ===========================================
import { BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ReportsPage() {
  const handleDownload = (reportName: string) => {
    toast.success(`Generando reporte de ${reportName}...`);
    setTimeout(() => {
      toast.success(`Reporte de ${reportName} descargado exitosamente`);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary-800">Reportes</h1>
          <p className="text-sm text-primary-500">Generación de reportes y exportaciones de datos</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card p-6 flex flex-col h-full border-t-4 border-t-blue-500">
          <div className="flex items-center gap-3 mb-4 text-blue-600">
            <FileSpreadsheet className="w-6 h-6" />
            <h3 className="font-bold text-lg">Padrón de Participantes</h3>
          </div>
          <p className="text-primary-600 text-sm mb-6 flex-1">
            Exporta el listado completo de todos los participantes registrados, incluyendo datos personales, de contacto y médicos.
          </p>
          <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => handleDownload('Participantes')}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>

        <div className="card p-6 flex flex-col h-full border-t-4 border-t-purple-500">
          <div className="flex items-center gap-3 mb-4 text-purple-600">
            <FileSpreadsheet className="w-6 h-6" />
            <h3 className="font-bold text-lg">Inscripciones por Disciplina</h3>
          </div>
          <p className="text-primary-600 text-sm mb-6 flex-1">
            Reporte detallado de todas las inscripciones aprobadas y pendientes, agrupadas por disciplina y categoría.
          </p>
          <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700" onClick={() => handleDownload('Inscripciones')}>
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>

        <div className="card p-6 flex flex-col h-full border-t-4 border-t-amber-500">
          <div className="flex items-center gap-3 mb-4 text-amber-600">
            <BarChart3 className="w-6 h-6" />
            <h3 className="font-bold text-lg">Resultados Finales</h3>
          </div>
          <p className="text-primary-600 text-sm mb-6 flex-1">
            Ranking final y tabla de posiciones general de todas las disciplinas finalizadas en la etapa actual.
          </p>
          <Button className="w-full gap-2 bg-amber-600 hover:bg-amber-700" onClick={() => handleDownload('Resultados')}>
            <Download className="w-4 h-4" /> Exportar Excel
          </Button>
        </div>
      </div>
    </div>
  );
}
