// ===========================================
// useElementSize — tamaño en pantalla de un elemento, al día
// ===========================================
import { useEffect, useState, type RefObject } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Mide el elemento con `getBoundingClientRect` y lo vuelve a medir con un
 * `ResizeObserver` cada vez que cambia de tamaño.
 *
 * Una medición en cero (elemento oculto, todavía sin layout) **no** pisa la
 * anterior: quien dibuja con estas medidas prefiere la última conocida a
 * dividir por cero. Mientras no hubo ninguna, devuelve `{ 0, 0 }`.
 */
export function useElementSize(ref: RefObject<Element | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSize((prev) => (prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height }));
      }
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);

  return size;
}
