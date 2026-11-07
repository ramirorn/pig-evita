// ===========================================
// useRevealOnScroll — aparición al entrar al viewport, una sola vez
// ===========================================
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * - `estatico`: estado inicial y el definitivo cuando no se anima (sin
 *   IntersectionObserver o con `prefers-reduced-motion`). El elemento se ve.
 * - `oculto`: listo para entrar; todavía no llegó al viewport.
 * - `revelado`: ya entró. No vuelve a `oculto` aunque salga de pantalla.
 */
export type RevealPhase = 'estatico' | 'oculto' | 'revelado';

interface RevealOptions {
  /** Fracción visible que dispara la entrada. */
  threshold?: number;
  /** Margen del viewport: el negativo de abajo espera a que asome un poco. */
  rootMargin?: string;
}

/**
 * El hook sólo decide la **fase**; las clases las pone quien lo usa, con
 * literales completos de Tailwind (nada interpolado).
 *
 * Arranca en `estatico` a propósito: si el efecto no corre (render en servidor,
 * JS que falla, navegador sin IntersectionObserver) el contenido queda visible.
 * El paso a `oculto` ocurre en un layout effect, antes del primer pintado, así
 * que las tarjetas que ya están en pantalla no parpadean.
 *
 * La fase sólo debe tocar `opacity` y `transform`: el elemento ocupa su lugar
 * todo el tiempo (sin saltos de layout) y sigue en el árbol de accesibilidad,
 * así que un lector de pantalla lo lee aunque no se haya animado.
 */
export function useRevealOnScroll<T extends Element>({
  threshold = 0.15,
  rootMargin = '0px 0px -8% 0px',
}: RevealOptions = {}) {
  const [phase, setPhase] = useState<RevealPhase>('estatico');
  const [node, setNode] = useState<T | null>(null);
  // Una vez revelado no se vuelve a ocultar, ni aunque cambie el nodo.
  const revealedRef = useRef(false);

  const ref = useCallback((el: T | null) => setNode(el), []);

  useLayoutEffect(() => {
    if (!node || revealedRef.current) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    setPhase('oculto');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          revealedRef.current = true;
          setPhase('revelado');
          observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [node, threshold, rootMargin]);

  return { ref, phase };
}
