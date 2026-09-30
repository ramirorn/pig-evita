// ===========================================
// mapZoom — zoom y desplazamiento del mapa de impacto (lógica pura)
// ===========================================
//
// Sin React a propósito: el componente sólo traduce eventos (botones, rueda,
// arrastre, pellizco, teclado) a estas funciones, y `check:map` las ejercita
// sin DOM.
//
// Modelo: una vista `{ k, x, y }` transforma un punto del mapa `p` (unidades
// del viewBox) en su lugar en pantalla `k·p + (x, y)`, también en unidades del
// viewBox. El contenido ocupa todo el viewBox `W × H`, así que "que la
// provincia no se salga de la vista" es exactamente que el rectángulo
// transformado cubra el viewBox: `x ∈ [W − k·W, 0]` y lo mismo en `y`.
import { separateBubbles, type Bubble } from '@/lib/localityMap';

export interface MapView {
  /** Factor de zoom (1 = provincia entera). */
  k: number;
  x: number;
  y: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
/** Paso de los botones y del teclado. */
export const ZOOM_STEP = 1.5;
/** Zoom mínimo al centrar una localidad elegida desde el Top 5 o la tabla. */
export const FOCUS_ZOOM = 2.5;

export const IDENTITY_VIEW: MapView = { k: 1, x: 0, y: 0 };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Lleva la vista a los límites: zoom 1×–8× y la provincia siempre cubriendo la vista. */
export function clampView(v: MapView, W: number, H: number): MapView {
  const k = clamp(v.k, MIN_ZOOM, MAX_ZOOM);
  return {
    k,
    x: clamp(v.x, W - k * W, 0),
    y: clamp(v.y, H - k * H, 0),
  };
}

/**
 * Zoom hacia un punto de la pantalla: el punto del mapa que está bajo
 * `(px, py)` sigue ahí después del zoom (salvo que el límite lo impida).
 */
export function zoomAt(v: MapView, factor: number, px: number, py: number, W: number, H: number): MapView {
  const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
  const r = k / v.k;
  return clampView({ k, x: px - (px - v.x) * r, y: py - (py - v.y) * r }, W, H);
}

/** Desplaza la vista en unidades de pantalla (del viewBox). */
export function panBy(v: MapView, dx: number, dy: number, W: number, H: number): MapView {
  return clampView({ k: v.k, x: v.x + dx, y: v.y + dy }, W, H);
}

/** Centra un punto del mapa con el zoom pedido (ajustado a los límites). */
export function centerOn(px: number, py: number, k: number, W: number, H: number): MapView {
  const kk = clamp(k, MIN_ZOOM, MAX_ZOOM);
  return clampView({ k: kk, x: W / 2 - kk * px, y: H / 2 - kk * py }, W, H);
}

/** Punto del mapa → pantalla. */
export function toScreen(v: MapView, px: number, py: number): { x: number; y: number } {
  return { x: v.k * px + v.x, y: v.k * py + v.y };
}

/** Pantalla → punto del mapa. */
export function toMap(v: MapView, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - v.x) / v.k, y: (sy - v.y) / v.k };
}

/**
 * Escala inversa: lo que tiene que mantener su tamaño en pantalla (bordes,
 * trazos) dentro del grupo transformado se divide por el zoom.
 */
export const inverseScale = (v: MapView) => 1 / v.k;

/**
 * Burbujas en pantalla: la **posición** sigue al zoom y el **radio** no (se
 * dibujan fuera del grupo transformado). Así acercar separa las localidades
 * vecinas en vez de agrandarlas. La separación anti-choque se aplica después,
 * en pantalla, así que con zoom casi no hace falta correr nada.
 */
export function bubblesOnScreen(burbujas: readonly Bubble[], v: MapView): Bubble[] {
  return separateBubbles(burbujas.map((b) => ({ ...b, ...toScreen(v, b.x, b.y) })));
}

/** ¿El círculo cae (al menos en parte) dentro de la vista? */
export function isVisible(x: number, y: number, r: number, W: number, H: number): boolean {
  return x + r >= 0 && y + r >= 0 && x - r <= W && y - r <= H;
}

/**
 * Interpolación entre dos vistas para la transición suave (`t` de 0 a 1). El
 * zoom se interpola en escala logarítmica para que el acercamiento se sienta
 * parejo.
 */
export function lerpView(a: MapView, b: MapView, t: number): MapView {
  const k = Math.exp(Math.log(a.k) + (Math.log(b.k) - Math.log(a.k)) * t);
  return { k, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export const sameView = (a: MapView, b: MapView) =>
  Math.abs(a.k - b.k) < 1e-6 && Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3;
