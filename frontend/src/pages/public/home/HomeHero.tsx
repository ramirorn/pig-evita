// ===========================================
// HomeHero — encabezado principal de la landing
// ===========================================
import { Link } from 'react-router';
import { ArrowRight, ClipboardList, Sparkles } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

export function HomeHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary-900 to-primary-900 text-white">
      {/* Decorative shapes and brand lights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-80 h-80 bg-accent-500/15 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary-500/15 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-celeste-400/20 rounded-full blur-2xl animate-float" />
        {/* Subtle dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
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
  );
}
