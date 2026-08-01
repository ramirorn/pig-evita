// ===========================================
// Home Page — Public Landing
// ===========================================
import { Link } from 'react-router';
import {
  Trophy,
  Users,
  CalendarDays,
  MapPin,
  Medal,
  ArrowRight,
  ClipboardList,
  Sparkles,
} from 'lucide-react';
import { ROUTES } from '@/lib/constants';

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

export function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary-900 to-primary-900 text-white">
        {/* Decorative shapes and brand lights */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 right-10 w-80 h-80 bg-accent-500/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary-500/15 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-celeste-400/20 rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-medium mb-6 animate-fade-in shadow-sm">
                <Sparkles className="w-4 h-4 text-accent-500" />
                <span className="text-celeste-100 font-semibold">Provincia de Formosa — Edición Oficial</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 animate-fade-in stagger-1 tracking-tight">
                Juegos Evita
                <span className="block text-accent-500">Formoseños 2026</span>
              </h1>

              <p className="text-lg md:text-xl text-celeste-100 max-w-2xl mb-8 leading-relaxed animate-fade-in stagger-2 font-normal">
                Plataforma integral de gestión deportiva. Inscribite, consultá disciplinas,
                seguí los resultados y descubrí toda la pasión deportiva de la provincia de Formosa.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 animate-fade-in stagger-3">
                <Link
                  to={ROUTES.INSCRIPTION}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-bold rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 text-primary-950 hover:from-accent-400 hover:to-accent-500 shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
                >
                  <ClipboardList className="w-5 h-5 text-primary-950" />
                  Inscribirse Ahora
                </Link>
                <Link
                  to={ROUTES.DISCIPLINES}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold rounded-xl bg-white/10 backdrop-blur-md border border-white/25 text-white hover:bg-white/20 transition-all active:scale-[0.98]"
                >
                  Ver Disciplinas
                  <ArrowRight className="w-4 h-4 text-celeste-200" />
                </Link>
              </div>
            </div>

            {/* Official Logo Emblem Showcase */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center animate-fade-in stagger-2">
              <div className="relative group flex flex-col items-center">
                <div className="absolute -inset-6 bg-gradient-to-r from-accent-500/20 to-secondary-500/20 rounded-full blur-3xl opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none" />
                <img
                  src="/logo-sinfondo.png"
                  alt="Logo Oficial Juegos Evita Formoseños"
                  className="relative w-56 md:w-72 h-auto object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-105"
                />
                <div className="mt-6 text-center">
                  <span className="text-xs font-bold text-accent-400 uppercase tracking-widest block">
                    Secretaría de Deportes
                  </span>
                  <span className="text-xs text-celeste-200 block mt-0.5">
                    Gobierno de la Provincia de Formosa
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path
              d="M0 80V30C240 60 480 10 720 30C960 50 1200 0 1440 30V80H0Z"
              fill="var(--color-surface)"
            />
          </svg>
        </div>
      </section>

      {/* Quick Links Grid */}
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

      {/* Stats Section */}
      <section className="bg-primary-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icon: <Trophy className="w-8 h-8" />, value: '+40', label: 'Disciplinas' },
              { icon: <Users className="w-8 h-8" />, value: '3', label: 'Etapas' },
              { icon: <MapPin className="w-8 h-8" />, value: '9', label: 'Departamentos' },
              { icon: <Medal className="w-8 h-8" />, value: '∞', label: 'Oportunidades' },
            ].map((stat, idx) => (
              <div key={idx} className={`animate-fade-in stagger-${idx + 1}`}>
                <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/10 flex items-center justify-center text-accent-500 shadow-inner">
                  {stat.icon}
                </div>
                <p className="text-3xl md:text-4xl font-extrabold mb-1">{stat.value}</p>
                <p className="text-celeste-200 text-sm font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-secondary-500 to-secondary-600 p-8 md:p-12 text-white text-center shadow-lg">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-2xl" />
          </div>
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              ¿Listo para competir?
            </h2>
            <p className="text-secondary-100 max-w-lg mx-auto mb-6">
              Inscribite en los Juegos Evita y representá a tu localidad en las competencias deportivas provinciales.
            </p>
            <Link
              to={ROUTES.INSCRIPTION}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold rounded-xl bg-white text-secondary-700 hover:bg-secondary-50 shadow-lg hover:shadow-xl transition-all"
            >
              <ClipboardList className="w-5 h-5" />
              Inscribirse
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
