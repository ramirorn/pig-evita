// ===========================================
// Reports Page
// ===========================================
import { useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, Users, Trophy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportsApi, downloadBlob } from '@/api/reports.api';
import { toast } from 'sonner';

export function ReportsPage() {
  const [loadingReport, setLoadingReport] = useState<string | null>(null);

  const handleExport = async (
    type: 'participantes' | 'inscripciones' | 'equipos' | 'resultados',
    filename: string,
    label: string
  ) => {
    try {
      setLoadingReport(type);
      toast.info(`Generando reporte de ${label}...`);
      
      let blob: Blob;
      if (type === 'participantes') {
        blob = await reportsApi.exportParticipantsCsv();
      } else if (type === 'inscripciones') {
        blob = await reportsApi.exportInscriptionsCsv();
      } else if (type === 'equipos') {
        blob = await reportsApi.exportTeamsCsv();
      } else {
        blob = await reportsApi.exportResultsCsv();
      }

      downloadBlob(blob, filename);
      toast.success(`Reporte de ${label} descargado correctamente`);
    } catch (error) {
      console.error(error);
      toast.error(`Error al generar el reporte de ${label}`);
    } finally {
      setLoadingReport(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary-800">Reportes</h1>
          <p className="text-sm text-primary-500">Generación y exportación de datos en formato CSV para Excel</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Padrón de Participantes */}
        <div className="card p-6 flex flex-col h-full border-t-4 border-t-blue-500 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4 text-blue-600">
            <Users className="w-6 h-6" />
            <h3 className="font-bold text-lg">Padrón de Participantes</h3>
          </div>
          <p className="text-primary-600 text-sm mb-6 flex-1">
            Listado completo de deportistas registrados con DNI, datos de contacto, localidad, departamento y categorías asociadas.
          </p>
          <Button 
            className="w-full gap-2 bg-blue-600 hover:bg-blue-700" 
            disabled={loadingReport !== null}
            onClick={() => handleExport('participantes', 'padron_participantes.csv', 'Padrón de Participantes')}
          >
            {loadingReport === 'participantes' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar CSV
          </Button>
        </div>

        {/* Inscripciones por Disciplina */}
        <div className="card p-6 flex flex-col h-full border-t-4 border-t-purple-500 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4 text-purple-600">
            <FileSpreadsheet className="w-6 h-6" />
            <h3 className="font-bold text-lg">Inscripciones</h3>
          </div>
          <p className="text-primary-600 text-sm mb-6 flex-1">
            Reporte detallado de todas las inscripciones individuales y de equipos con estado (Aprobada/Pendiente), código QR y fechas.
          </p>
          <Button 
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700" 
            disabled={loadingReport !== null}
            onClick={() => handleExport('inscripciones', 'inscripciones.csv', 'Inscripciones')}
          >
            {loadingReport === 'inscripciones' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar CSV
          </Button>
        </div>

        {/* Equipos Registrados */}
        <div className="card p-6 flex flex-col h-full border-t-4 border-t-emerald-500 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4 text-emerald-600">
            <FileSpreadsheet className="w-6 h-6" />
            <h3 className="font-bold text-lg">Equipos</h3>
          </div>
          <p className="text-primary-600 text-sm mb-6 flex-1">
            Listado de equipos registrados por disciplina y categoría, localidad, departamento y cantidad total de integrantes.
          </p>
          <Button 
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" 
            disabled={loadingReport !== null}
            onClick={() => handleExport('equipos', 'equipos.csv', 'Equipos')}
          >
            {loadingReport === 'equipos' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar CSV
          </Button>
        </div>

        {/* Resultados y Partidos */}
        <div className="card p-6 flex flex-col h-full border-t-4 border-t-amber-500 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4 text-amber-600">
            <Trophy className="w-6 h-6" />
            <h3 className="font-bold text-lg">Resultados y Fixture</h3>
          </div>
          <p className="text-primary-600 text-sm mb-6 flex-1">
            Historial de competencias, fixture por rondas, enfrentamientos, tanteadores y ganadores con sede asignada.
          </p>
          <Button 
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700" 
            disabled={loadingReport !== null}
            onClick={() => handleExport('resultados', 'resultados.csv', 'Resultados y Fixtures')}
          >
            {loadingReport === 'resultados' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Exportar CSV
          </Button>
        </div>
      </div>
    </div>
  );
}

