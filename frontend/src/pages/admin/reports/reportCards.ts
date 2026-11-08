// ===========================================
// reportCards — catálogo de reportes exportables
// ===========================================
import { FileSpreadsheet, Trophy, Users } from 'lucide-react';

/** Los cuatro reportes que expone la API. */
export type ReportId = 'participantes' | 'inscripciones' | 'equipos' | 'resultados';

export interface ReportCardConfig {
  id: ReportId;
  title: string;
  description: string;
  icon: typeof Users;
  accentColor: string;
  borderColor: string;
  badgeColor: string;
  baseFilename: string;
}

/**
 * Es data, no UI: qué reportes hay, cómo se llaman y de qué color se pintan.
 * Vive fuera de la página para que agregar un reporte sea editar una lista y no
 * navegar 90 líneas de JSX.
 */
export const REPORT_CARDS: ReportCardConfig[] = [
  {
    id: 'participantes',
    title: 'Padrón de Participantes',
    description:
      'Listado completo de deportistas registrados con DNI, datos de contacto, localidad, departamento y categorías asociadas.',
    icon: Users,
    accentColor: 'text-primary-600',
    borderColor: 'border-t-blue-500',
    badgeColor: 'bg-celeste-50 text-primary-700 border-celeste-200',
    baseFilename: 'padron_participantes',
  },
  {
    id: 'inscripciones',
    title: 'Inscripciones por Disciplina',
    description:
      'Reporte detallado de todas las inscripciones individuales y de equipos con estado (Aprobada/Pendiente), código QR y fechas.',
    icon: FileSpreadsheet,
    accentColor: 'text-celeste-700',
    borderColor: 'border-t-purple-500',
    badgeColor: 'bg-celeste-100 text-celeste-700 border-celeste-300',
    baseFilename: 'inscripciones',
  },
  {
    id: 'equipos',
    title: 'Equipos Registrados',
    description:
      'Listado de equipos registrados por disciplina y categoría, localidad, departamento y cantidad total de integrantes.',
    icon: FileSpreadsheet,
    accentColor: 'text-success-600',
    borderColor: 'border-t-emerald-500',
    badgeColor: 'bg-success-50 text-success-700 border-success-200',
    baseFilename: 'equipos',
  },
  {
    id: 'resultados',
    title: 'Resultados y Fixture',
    description:
      'Historial de competencias, fixture por rondas, enfrentamientos, tanteadores y ganadores con sede asignada.',
    icon: Trophy,
    accentColor: 'text-warning-600',
    borderColor: 'border-t-amber-500',
    badgeColor: 'bg-warning-50 text-warning-700 border-warning-200',
    baseFilename: 'resultados_fixture',
  },
];
