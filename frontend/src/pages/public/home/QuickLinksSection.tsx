// ===========================================
// QuickLinksSection — accesos rápidos de la landing
// ===========================================
import { Link } from 'react-router';
import { ArrowRight, CalendarDays, MapPin, Medal, Trophy } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

/**
 * La tabla vive acá y no en `constants.ts` porque incluye JSX (el ícono) y
 * clases de Tailwind: es presentación de esta sección, no configuración
 * compartida.
 */
const QUICK_LINKS = [
  {
    title: 'Disciplinas',
    description: 'Consultá las más de 40 disciplinas deportivas disponibles.',
    icon: <Trophy className="w-7 h-7" />,
    path: ROUTES.DISCIPLINES,
    color: 'from-primary-700 to-primary-800',
  },
  {
    title: 'Rankings',
    description: 'Tablas de posiciones y clasificaciones actualizadas.',
    icon: <Medal className="w-7 h-7" />,
    path: ROUTES.RANKINGS,
    color: 'from-accent-500 to-accent-600',
  },
  {
    title: 'Calendario',
    description: 'Fechas, horarios y programación de competencias.',
    icon: <CalendarDays className="w-7 h-7" />,
    path: ROUTES.CALENDAR,
    color: 'from-secondary-500 to-secondary-600',
  },
  {
    title: 'Sedes',
    description: 'Ubicación de las sedes de competencia en toda la provincia.',
    icon: <MapPin className="w-7 h-7" />,
    path: ROUTES.VENUES,
    color: 'from-celeste-500 to-celeste-600',
  },
];

export function QuickLinksSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h2 className="text-2xl md:text-3xl font-bold text-primary-800 mb-3">
          Explorá los Juegos Evita
        </h2>
        <p className="text-primary-600 max-w-xl mx-auto">
          Toda la información que necesitás sobre las competencias deportivas más importantes de la provincia.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {QUICK_LINKS.map((link, idx) => (
          <Link
            key={link.path}
            to={link.path}
            className={`card group p-6 hover:scale-[1.02] hover:border-primary-300 transition-all animate-fade-in stagger-${idx + 1}`}
          >
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center text-white shadow-md mb-4 group-hover:shadow-lg transition-shadow`}>
              {link.icon}
            </div>
            <h3 className="text-lg font-bold text-primary-800 mb-1.5 group-hover:text-primary-600 transition-colors">
              {link.title}
            </h3>
            <p className="text-sm text-primary-500 leading-relaxed">
              {link.description}
            </p>
            <div className="flex items-center gap-1 mt-3 text-sm font-semibold text-primary-600 group-hover:text-primary-800 transition-colors">
              Ver más <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
