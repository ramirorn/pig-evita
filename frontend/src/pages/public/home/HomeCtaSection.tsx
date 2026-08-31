// ===========================================
// HomeCtaSection — cierre de la landing con llamada a inscribirse
// ===========================================
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

/**
 * Franja de cierre, a todo el ancho y en el verde institucional.
 *
 * El borde superior curvo lo hace un `clip-path` (`.curved-top` en
 * `index.css`), no un `<svg>` de onda: una propiedad en vez de un nodo extra.
 */
export function HomeCtaSection() {
  return (
    <section className="curved-top relative overflow-hidden bg-secondary-500 px-4 pt-32 pb-24 sm:px-6 md:pt-40 md:pb-32 lg:px-8">
      {/* Trazos decorativos. Aria-hidden: no aportan nada a quien no los ve. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-10"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <path
          d="M0,50 Q25,20 50,50 T100,50"
          fill="none"
          stroke="white"
          strokeWidth="0.5"
        />
        <path
          d="M0,70 Q25,40 50,70 T100,70"
          fill="none"
          stroke="white"
          strokeWidth="0.5"
        />
      </svg>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center pt-12 text-center">
        <h2 className="font-display mb-6 max-w-4xl text-3xl leading-tight font-bold text-white md:text-4xl">
          ¿Listo para competir? <br className="hidden md:block" />
          Formá parte de la historia deportiva de Formosa
        </h2>
        <p className="mb-10 max-w-2xl text-lg font-light text-white/90">
          Las inscripciones ya están abiertas para todas las disciplinas.
          Representá a tu municipio y alcanzá la gloria.
        </p>
        <Link
          to={ROUTES.INSCRIPTION}
          className="group inline-flex items-center gap-3 rounded-full bg-accent-500 px-12 py-5 text-lg font-bold text-primary-900 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:text-secondary-600 hover:shadow-2xl active:scale-[0.98]"
        >
          Inscribirse ahora
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
