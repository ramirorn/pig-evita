// ===========================================
// HomeHero — encabezado principal de la landing
// ===========================================
import { Link } from 'react-router';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

/**
 * Bloque de apertura del sitio público.
 *
 * El `pb-64` no es decorativo: `StatsSection` se monta encima con un margen
 * negativo y necesita ese aire para no taparle el texto al hero. Las dos
 * secciones están acopladas por diseño y por eso van seguidas en `HomePage`.
 */
export function HomeHero() {
  return (
    <section className="relative overflow-visible bg-primary-900 pt-20 pb-56 md:pt-28 md:pb-64">
      {/* Degradé institucional: del azul más oscuro al medio. */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-500 opacity-95" />
      <div className="absolute inset-0 noise-bg mix-blend-overlay" />

      {/* Luces de marca. `pointer-events-none` para que no coman clics. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 h-[800px] w-[800px] -translate-y-1/2 translate-x-1/3 rounded-full bg-celeste-200/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[600px] w-[600px] -translate-x-1/4 translate-y-1/3 rounded-full bg-accent-300/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-between gap-16 px-4 sm:px-6 md:flex-row lg:px-8">
        <div className="pt-6 text-center md:w-[55%] md:pt-0 md:text-left">
          <h1 className="font-display mb-8 text-4xl leading-[1.1] font-extrabold tracking-tight text-white md:text-6xl">
            Juegos Evita <br className="hidden md:block" />
            <span className="pr-2 font-black text-accent-500 italic drop-shadow-sm">
              Formoseños
            </span>
            <span className="font-light text-celeste-200">2026</span>
          </h1>

          <p className="mb-10 max-w-xl text-lg leading-relaxed text-celeste-100">
            La competencia deportiva más importante de la provincia. Sumate,
            competí y representá a tu localidad con orgullo.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row md:justify-start">
            <Link
              to={ROUTES.INSCRIPTION}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-500 px-10 py-4 text-lg font-bold text-primary-900 transition-all duration-300 hover:-translate-y-1 hover:bg-accent-400 hover:shadow-[0_10px_40px_-10px_rgba(232,170,52,0.5)] active:scale-[0.98]"
            >
              <ClipboardList className="h-5 w-5" />
              Inscribirse ahora
            </Link>
            <Link
              to={ROUTES.DISCIPLINES}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-celeste-200/30 bg-transparent px-10 py-4 text-lg font-semibold text-white transition-all duration-300 hover:border-celeste-200/50 hover:bg-white/10 active:scale-[0.98]"
            >
              Conocer más
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative flex justify-center md:w-[45%]">
          <div className="group relative flex flex-col items-center">
            <div className="pointer-events-none absolute -inset-6 rounded-full bg-gradient-to-r from-accent-500/20 to-celeste-400/20 opacity-70 blur-3xl transition-opacity group-hover:opacity-100" />
            <img
              src="/logo-sinfondo.png"
              alt="Logo oficial de los Juegos Evita Formoseños"
              className="relative z-10 h-72 w-72 object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.35)] transition-transform duration-700 ease-out group-hover:scale-105 md:h-[420px] md:w-[420px]"
            />
            <div className="relative z-10 mt-6 text-center">
              <span className="block text-xs font-bold tracking-widest text-accent-400 uppercase">
                Secretaría de Deportes
              </span>
              <span className="mt-0.5 block text-xs text-celeste-200">
                Gobierno de la Provincia de Formosa
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
