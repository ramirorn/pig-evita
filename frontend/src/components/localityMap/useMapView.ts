// ===========================================
// useMapView — vista (zoom y desplazamiento) del mapa, con transiciones
// ===========================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { IDENTITY_VIEW, lerpView, sameView, zoomAt, type MapView } from '@/lib/mapZoom';

const DURACION_MS = 220;

interface UseMapViewOptions {
  /** Ancho y alto del viewBox. */
  width: number;
  height: number;
  /** `prefers-reduced-motion`: sin transiciones. */
  reducedMotion: boolean;
}

/**
 * Dueño de la vista del mapa. `viewRef` está siempre al día (los gestos lo leen
 * en medio de un arrastre sin esperar al render) y `irA` pasa a una vista nueva
 * con una transición corta, salvo movimiento reducido o pestaña oculta.
 */
export function useMapView({ width: W, height: H, reducedMotion }: UseMapViewOptions) {
  const [view, setView] = useState<MapView>(IDENTITY_VIEW);
  const viewRef = useRef(view);
  viewRef.current = view;
  const animRef = useRef<number | null>(null);
  const finRef = useRef<number | null>(null);

  const cortarAnimacion = useCallback(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    if (finRef.current !== null) window.clearTimeout(finRef.current);
    finRef.current = null;
  }, []);

  /** Pasa a una vista nueva, con transición salvo movimiento reducido. */
  const irA = useCallback(
    (destino: MapView, animar = true) => {
      cortarAnimacion();
      const desde = viewRef.current;
      if (!animar || reducedMotion || document.hidden || sameView(desde, destino)) {
        setView(destino);
        return;
      }
      const inicio = performance.now();
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - inicio) / DURACION_MS);
        const suave = 1 - (1 - t) ** 3;
        setView(t >= 1 ? destino : lerpView(desde, destino, suave));
        animRef.current = t >= 1 ? null : requestAnimationFrame(paso);
        if (t >= 1 && finRef.current !== null) {
          window.clearTimeout(finRef.current);
          finRef.current = null;
        }
      };
      animRef.current = requestAnimationFrame(paso);
      // Red de seguridad: si el navegador frena los frames (pestaña en segundo
      // plano, ventana tapada), la vista igual llega a destino.
      finRef.current = window.setTimeout(() => {
        cortarAnimacion();
        setView(destino);
      }, DURACION_MS + 80);
    },
    [reducedMotion, cortarAnimacion],
  );

  useEffect(() => cortarAnimacion, [cortarAnimacion]);

  const acercar = useCallback(
    (factor: number, px = W / 2, py = H / 2, animar = true) =>
      irA(zoomAt(viewRef.current, factor, px, py, W, H), animar),
    [irA, W, H],
  );
  const restablecer = useCallback(() => irA(IDENTITY_VIEW), [irA]);

  return { view, setView, viewRef, irA, cortarAnimacion, acercar, restablecer };
}
