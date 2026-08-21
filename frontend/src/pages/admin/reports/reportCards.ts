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
