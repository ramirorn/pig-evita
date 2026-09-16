// ===========================================
// SurveyCtaButton — el único botón que abre la encuesta
// ===========================================
import { Link } from 'react-router';
import { ArrowRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SurveyCtaProps } from './surveyCta';

interface SurveyCtaButtonProps extends SurveyCtaProps {
  /** Texto del botón. Cambia entre el CTA de apertura y el de cierre. */
  children: string;
  /**
   * `oscuro` va sobre fondo azul o verde institucional (hero y cierre):
   * dorado sólido sobre el azul más oscuro del sistema.
   * `claro` va sobre el fondo blanco de la página.
   */
  tono?: 'oscuro' | 'claro';
  className?: string;
}

/**
 * CTA de la encuesta, desacoplado del formulario (ver `surveyCta.ts`).
 *
 * Es siempre un elemento interactivo real —`<button>`, `<a>` o `<Link>`—, nunca
 * un `<div onClick>`: hace falta para el foco por teclado, para el Enter/Espacio
 * y para que un lector de pantalla lo anuncie como lo que es.
 *
 * El `min-h-14` no es estético: son 56 px de área táctil, por encima de los
 * 44 px mínimos, porque la mitad de estos chicos entra desde un celular.
 */
export function SurveyCtaButton({
  onAbrirEncuesta,
  encuestaHref,
  children,
  tono = 'oscuro',
  className,
}: SurveyCtaButtonProps) {
  const base = cn(
    'group inline-flex min-h-14 items-center justify-center gap-3 rounded-full px-8 py-4 text-base font-bold',
    'transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
    'sm:px-10 sm:text-lg',
    tono === 'oscuro'
      ? 'bg-accent-500 text-primary-900 hover:bg-accent-400 hover:shadow-[0_10px_40px_-10px_rgba(232,170,52,0.5)]'
      : 'bg-primary-800 text-white hover:bg-primary-900 hover:shadow-lg',
    className,
  );

  const contenido = (
    <>
      {children}
      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
    </>
  );

  // 1. Handler: el formulario se abre en la misma página.
  if (onAbrirEncuesta) {
    return (
      <button type="button" onClick={onAbrirEncuesta} className={base}>
        {contenido}
      </button>
    );
  }

  // 2. Navegación. Absoluta → `<a>` externo; relativa → ruta interna.
  if (encuestaHref) {
    if (/^https?:\/\//i.test(encuestaHref)) {
      return (
        <a
          href={encuestaHref}
          target="_blank"
          rel="noopener noreferrer"
          className={base}
        >
          {contenido}
        </a>
      );
    }

    return (
      <Link to={encuestaHref} className={base}>
        {contenido}
      </Link>
    );
  }

  // 3. Sin destino todavía. Antes que un botón que no lleva a ningún lado,
  //    se dice que no está abierta. `disabled` ya lo saca del orden de foco;
  //    el texto de al lado explica por qué, para todos y no sólo para quien ve
  //    el gris.
  return (
    <span className="inline-flex flex-col items-center gap-2">
      <button
        type="button"
        disabled
        className={cn(
          base,
          'cursor-not-allowed opacity-60 hover:translate-y-0 hover:shadow-none',
        )}
      >
        {children}
        <Lock className="h-5 w-5" />
      </button>
      <span
        className={cn(
          'text-sm font-medium',
          tono === 'oscuro' ? 'text-celeste-100' : 'text-primary-700',
        )}
      >
        Todavía no está abierta. Volvé en unos días.
      </span>
    </span>
  );
}
