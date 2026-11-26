// ===========================================
// useMapGestures — rueda, arrastre, pellizco, doble clic y teclado del mapa
// ===========================================
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import { MIN_ZOOM, panBy, ZOOM_STEP, zoomAt, type MapView } from '@/lib/mapZoom';

/** Desplazamiento de las flechas del teclado, en unidades de pantalla. */
const PASO_FLECHA = 80;
/** Cuánto queda visible el aviso de "Ctrl + rueda". */
const AVISO_MS = 1400;

interface UseMapGesturesOptions {
  svgRef: RefObject<SVGSVGElement | null>;
  width: number;
  height: number;
  viewRef: RefObject<MapView>;
  setView: Dispatch<SetStateAction<MapView>>;
  irA: (destino: MapView, animar?: boolean) => void;
  cortarAnimacion: () => void;
  acercar: (factor: number, px?: number, py?: number, animar?: boolean) => void;
  restablecer: () => void;
}

/**
 * Traduce la entrada del usuario a cambios de vista. Devuelve los handlers
 * para el `<svg>` y si hay que mostrar el aviso de "usá Ctrl + rueda".
 *
 * - Ctrl/⌘ + rueda acerca; la rueda sola deja scrollear la página y avisa.
 * - Un dedo desplaza la página; dos dedos pellizcan el mapa.
 * - Arrastrar con el mouse desplaza (sólo con zoom); un arrastre no es un clic.
 * - + / − / 0 y flechas con el mapa enfocado.
 */
export function useMapGestures({
  svgRef,
  width: W,
  height: H,
  viewRef,
  setView,
  irA,
  cortarAnimacion,
  acercar,
  restablecer,
}: UseMapGesturesOptions) {
  const [aviso, setAviso] = useState(false);
  const avisoRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (avisoRef.current !== null) window.clearTimeout(avisoRef.current);
    },
    [],
  );

  /** Posición del cliente → coordenadas del viewBox (fuera del grupo transformado). */
  const aSvg = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      const ctm = svg?.getScreenCTM();
      if (!svg || !ctm) return { x: W / 2, y: H / 2 };
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },
    [svgRef, W, H],
  );

  /** Unidades del viewBox por píxel de pantalla. */
  const unidadesPorPx = () => {
    const ctm = svgRef.current?.getScreenCTM();
    return ctm ? 1 / ctm.a : 1;
  };

  // ---------- Rueda (Ctrl/⌘ + rueda) y pellizco ----------
  //
  // Van con listeners nativos porque React registra `wheel` y `touchmove` como
  // pasivos y acá hace falta `preventDefault`: con Ctrl + rueda el navegador
  // haría zoom de la página entera, y con dos dedos la desplazaría.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const alRodar = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const p = aSvg(e.clientX, e.clientY);
        irA(zoomAt(viewRef.current, Math.exp(-e.deltaY * 0.0025), p.x, p.y, W, H), false);
        return;
      }
      // Rueda sola: la página sigue scrolleando; sólo se avisa cómo acercar.
      setAviso(true);
      if (avisoRef.current !== null) window.clearTimeout(avisoRef.current);
      avisoRef.current = window.setTimeout(() => setAviso(false), AVISO_MS);
    };
    const alMoverDedos = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
    };
    svg.addEventListener('wheel', alRodar, { passive: false });
    svg.addEventListener('touchmove', alMoverDedos, { passive: false });
    return () => {
      svg.removeEventListener('wheel', alRodar);
      svg.removeEventListener('touchmove', alMoverDedos);
    };
  }, [svgRef, viewRef, aSvg, irA, W, H]);

  // ---------- Arrastre (mouse) y pellizco (dos dedos) ----------

  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const pellizco = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const arrastre = useRef<{ id: number; x: number; y: number; movio: boolean } | null>(null);
  const suprimirClic = useRef(false);

  const datosPellizco = () => {
    const [a, b] = [...dedos.current.values()];
    if (!a || !b) return null;
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: aSvg((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.current.size === 2) {
        cortarAnimacion();
        pellizco.current = datosPellizco();
      }
      return;
    }
    if (e.button !== 0 || viewRef.current.k <= MIN_ZOOM) return;
    cortarAnimacion();
    arrastre.current = { id: e.pointerId, x: e.clientX, y: e.clientY, movio: false };
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      if (!dedos.current.has(e.pointerId)) return;
      dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const antes = pellizco.current;
      const ahora = datosPellizco();
      if (!antes || !ahora || antes.dist === 0) return;
      let v = zoomAt(viewRef.current, ahora.dist / antes.dist, ahora.mid.x, ahora.mid.y, W, H);
      v = panBy(v, ahora.mid.x - antes.mid.x, ahora.mid.y - antes.mid.y, W, H);
      setView(v);
      pellizco.current = ahora;
      suprimirClic.current = true;
      return;
    }
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    if (!a.movio && Math.hypot(dx, dy) < 4) return;
    if (!a.movio) {
      a.movio = true;
      // La captura recién ahora: capturar en el pointerdown mandaría el clic
      // al <svg> y ninguna localidad respondería.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const u = unidadesPorPx();
    setView(panBy(viewRef.current, dx * u, dy * u, W, H));
    a.x = e.clientX;
    a.y = e.clientY;
  };

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      dedos.current.delete(e.pointerId);
      if (dedos.current.size < 2) pellizco.current = null;
      if (dedos.current.size === 0) window.setTimeout(() => (suprimirClic.current = false), 0);
      return;
    }
    const a = arrastre.current;
    if (a?.movio) {
      suprimirClic.current = true;
      window.setTimeout(() => (suprimirClic.current = false), 0);
    }
    arrastre.current = null;
  };

  const onClickCapture = (e: MouseEvent<SVGSVGElement>) => {
    if (suprimirClic.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const onDoubleClick = (e: MouseEvent<SVGSVGElement>) => {
    const p = aSvg(e.clientX, e.clientY);
    acercar(2, p.x, p.y);
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const v = viewRef.current;
    const mover = (dx: number, dy: number) => {
      if (v.k <= MIN_ZOOM) return;
      e.preventDefault();
      irA(panBy(v, dx, dy, W, H));
    };
    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault();
        acercar(ZOOM_STEP);
        break;
      case '-':
      case '_':
        e.preventDefault();
        acercar(1 / ZOOM_STEP);
        break;
      case '0':
        e.preventDefault();
        restablecer();
        break;
      case 'ArrowLeft':
        mover(PASO_FLECHA, 0);
        break;
      case 'ArrowRight':
        mover(-PASO_FLECHA, 0);
        break;
      case 'ArrowUp':
        mover(0, PASO_FLECHA);
        break;
      case 'ArrowDown':
        mover(0, -PASO_FLECHA);
        break;
    }
  };

  return {
    aviso,
    handlers: {
      onKeyDown,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
      onDoubleClick,
    },
  };
}
