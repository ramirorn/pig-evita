// ===========================================
// NewsHeroCarousel — carrusel de las notas más recientes de /noticias
// ===========================================
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { News } from '@/types';
import { cn } from '@/lib/utils';
import { FeaturedNewsCard } from './FeaturedNewsCard';

/** Cada cuánto avanza solo. Más de 5 s: WCAG 2.2.2 pide poder pausarlo (botón). */
const INTERVALO_MS = 7000;

/** `prefers-reduced-motion: reduce` — sin auto-avance ni transiciones. */
function usePrefiereMenosMovimiento(): boolean {
  const [reducir, setReducir] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const alCambiar = () => setReducir(consulta.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);
  return reducir;
}

/**
 * Carrusel con el patrón de la WAI-ARIA APG ("Carousel", rotación automática):
 *
 * - Botón de pausa/reproducción visible, primero en el orden de foco.
 * - Pausa mientras el puntero está encima o el foco está adentro: nadie quiere
 *   que la nota cambie mientras la está leyendo o a punto de hacer clic.
 * - Sin auto-avance si el sistema pide menos movimiento.
 * - La región de diapositivas es `aria-live="polite"` cuando **no** rota sola
 *   (al usar flechas, puntos o teclado se anuncia la nota nueva) y `off`
 *   mientras rota, para no interrumpir al lector cada 7 segundos.
 * - Flechas ← → del teclado con el foco en cualquier control del carrusel.
 *
 * Las diapositivas inactivas quedan `inert`: no se enfocan ni se leen.
 */
export function NewsHeroCarousel({ noticias }: { noticias: readonly News[] }) {
  const total = noticias.length;
  const [activa, setActiva] = useState(0);
  const [pausadoPorUsuario, setPausadoPorUsuario] = useState(false);
  const [encima, setEncima] = useState(false);
  const [foco, setFoco] = useState(false);
  const reducirMovimiento = usePrefiereMenosMovimiento();

  const rota =
    total > 1 && !pausadoPorUsuario && !encima && !foco && !reducirMovimiento;

  const ir = useCallback(
    (destino: number) => setActiva(((destino % total) + total) % total),
    [total],
  );

  useEffect(() => {
    if (!rota) return;
    const id = window.setInterval(() => setActiva((i) => (i + 1) % total), INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [rota, total]);

  // Si la lista se achica (otra página, menos notas), la activa no puede quedar
  // fuera de rango.
  const indice = activa < total ? activa : 0;

  if (total === 0) return null;

  const alTeclear = (e: KeyboardEvent<HTMLElement>) => {
    if (total < 2) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      ir(indice + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      ir(indice - 1);
    }
  };

  return (
    <section
      aria-roledescription="carrusel"
      aria-labelledby="notas-destacadas-titulo"
      className="relative h-[30rem] overflow-hidden rounded-2xl bg-primary-900 lg:h-full lg:min-h-[28rem] lg:rounded-r-none"
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      onFocus={() => setFoco(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFoco(false);
      }}
      onKeyDown={alTeclear}
    >
      {/* h2 invisible: las diapositivas son h3 y sin él colgarían del h1. */}
      <h2 id="notas-destacadas-titulo" className="sr-only">
        Notas destacadas
      </h2>
      {/* Los controles van antes que las diapositivas en el DOM (posición
          absoluta: visualmente quedan abajo) para que la pausa sea lo primero
          que alcanza el foco, como pide la APG. */}
      {total > 1 && (
        <div className="absolute right-4 bottom-4 z-20 flex items-center gap-2 md:right-6 md:bottom-5">
          <button
            type="button"
            onClick={() => setPausadoPorUsuario((p) => !p)}
            aria-label={
              pausadoPorUsuario || reducirMovimiento
                ? 'Reanudar el pase automático de notas'
                : 'Pausar el pase automático de notas'
            }
            disabled={reducirMovimiento}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 disabled:hidden"
          >
            {pausadoPorUsuario ? (
              <Play className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Pause className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => ir(indice - 1)}
            aria-label="Nota anterior"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => ir(indice + 1)}
            aria-label="Nota siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {total > 1 && (
        <div className="absolute bottom-5 left-5 z-20 flex items-center gap-1 md:bottom-6 md:left-8">
          {noticias.map((news, i) => (
            <button
              key={news.id}
              type="button"
              onClick={() => ir(i)}
              aria-label={`Ir a la nota ${i + 1} de ${total}: ${news.title}`}
              aria-current={i === indice ? 'true' : undefined}
              // El área de toque es el botón (24 px); la barrita es lo visible.
              className="group/punto flex h-6 items-center rounded-full px-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-400"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none',
                  i === indice
                    ? 'w-7 bg-accent-400'
                    : 'w-4 bg-white/50 group-hover/punto:bg-white/80',
                )}
              />
            </button>
          ))}
        </div>
      )}
      <div
        aria-live={rota ? 'off' : 'polite'}
        aria-atomic="false"
        className="relative h-full"
      >
        {noticias.map((news, i) => {
          const visible = i === indice;
          return (
            <div
              key={news.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}`}
              aria-hidden={!visible}
              inert={!visible}
              className={cn(
                'absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none',
                visible ? 'z-10 opacity-100' : 'z-0 opacity-0',
              )}
            >
              <FeaturedNewsCard news={news} prioritaria={i === 0} />
            </div>
          );
        })}
      </div>

    </section>
  );
}
