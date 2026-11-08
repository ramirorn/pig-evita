// ===========================================
// HomeHero — encabezado principal de la landing
// ===========================================
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Entrada compuesta del hero: titular, luego bajada y botones, luego el escudo.
 * Sólo `opacity` y `transform`. Con `prefers-reduced-motion` las clases
 * `motion-reduce:*` lo dejan visible y quieto desde el primer pintado.
 */
const ENTRADA_BASE =
  'transition-[opacity,transform] duration-600 ease-out-soft motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none';
const ENTRADA_OCULTA = 'translate-y-4 opacity-0';
const ENTRADA_VISIBLE = 'translate-y-0 opacity-100';


/**
 * Bloque de apertura del sitio público.
 *
 * El `pb` no es decorativo: `LatestNewsSection` se monta encima con un margen
 * negativo (encabezado sobre el azul, tarjetas sobre el borde) y necesita ese
 * aire para no taparle el texto al hero. Las dos secciones están acopladas por
 * diseño y por eso van seguidas en `HomePage`.
 */
export function HomeHero() {
  const [entro, setEntro] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntro(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const estado = entro ? ENTRADA_VISIBLE : ENTRADA_OCULTA;

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
          <h1 className={cn('type-display mb-8 text-white', ENTRADA_BASE, estado)}>
            Juegos Evita <br className="hidden md:block" />
            {/* El espacio explícito no es opcional: JSX descarta el salto de
                línea entre dos elementos adyacentes, así que sin él el titular
                se lee y se copia como "Formoseños2026". El `pr` en `em` suma
                encima la compensación óptica de la itálica —que se inclina
                hacia el 2— y escala con el tamaño de fuente, que cambia entre
                mobile y escritorio. */}
            <span className="pr-[0.08em] font-black text-accent-500 italic drop-shadow-sm">
              Formoseños
            </span>{' '}
            <span className="font-light text-celeste-200">2026</span>
          </h1>

          <p className={cn('mb-10 max-w-xl text-lg leading-relaxed text-celeste-100 delay-150', ENTRADA_BASE, estado)}>
            La competencia deportiva más importante de la provincia. Sumate,
            competí y representá a tu localidad con orgullo.
          </p>

          <div className={cn('flex flex-col justify-center gap-4 sm:flex-row md:justify-start delay-200', ENTRADA_BASE, estado)}>
            <Link
              to={ROUTES.INSCRIPTION}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-500 px-10 py-4 text-lg font-bold text-primary-900 transition-[background-color,box-shadow,transform] duration-200 ease-out-soft hover:bg-accent-400 hover:shadow-[0_10px_40px_-10px_rgba(232,170,52,0.5)] active:scale-[0.98] active:duration-120 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
              Inscribirse ahora
            </Link>
            <Link
              to={ROUTES.DISCIPLINES}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-celeste-200/30 bg-transparent px-10 py-4 text-lg font-semibold text-white transition-[background-color,border-color,transform] duration-200 ease-out-soft hover:border-celeste-200/50 hover:bg-white/10 active:scale-[0.98] active:duration-120 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Ver disciplinas
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className={cn('relative flex justify-center md:w-[45%] delay-300', ENTRADA_BASE, estado)}>
          <div className="group relative flex flex-col items-center">
            <div className="pointer-events-none absolute -inset-6 rounded-full bg-gradient-to-r from-accent-500/20 to-celeste-400/20 opacity-70 blur-3xl transition-opacity duration-320 group-hover:opacity-100 motion-reduce:transition-none" />
            <img
              src="/logo-sinfondo.png"
              alt="Logo oficial de los Juegos Evita Formoseños"
              width={420}
              height={420}
              fetchPriority="high"
              decoding="async"
              className="relative z-10 h-72 w-72 object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.35)] transition-transform duration-320 ease-out-soft group-hover:scale-105 md:h-[420px] md:w-[420px]"
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
