// ===========================================
// fullscreenMode — reglas puras de la pantalla completa del mapa
// ===========================================
//
// Sin React ni DOM: el componente le pasa lo que detectó del navegador y estas
// funciones deciden. `check:map` las ejercita.

/** Qué sabe el componente del navegador, sin tocar el DOM acá. */
export interface FullscreenSupport {
  /** Existe `element.requestFullscreen`. */
  standard: boolean;
  /** Existe `element.webkitRequestFullscreen` (Safari de escritorio, iPad). */
  webkit: boolean;
  /**
   * `document.fullscreenEnabled` (o su versión webkit). Un iframe sin
   * `allowfullscreen` o una política del navegador lo dejan en `false`.
   */
  enabled: boolean;
}

/**
 * - `native`: Fullscreen API sobre el contenedor del mapa (el navegador maneja
 *   Escape y el scroll).
 * - `overlay`: capa fija a pantalla completa dentro de la página. Es la
 *   alternativa para el iPhone (que no deja poner en pantalla completa un
 *   elemento que no sea un video) o si la API no está habilitada o falla.
 */
export type FullscreenMode = 'native' | 'overlay';

export function chooseFullscreenMode(s: FullscreenSupport): FullscreenMode {
  return s.enabled && (s.standard || s.webkit) ? 'native' : 'overlay';
}

/**
 * Foco atrapado: a qué elemento enfocable pasar con Tab (o Shift+Tab) desde el
 * actual. Cicla en los dos sentidos. Si el foco está afuera (`actual = -1`),
 * entra por el primero (o por el último, hacia atrás). Sin enfocables, `-1`.
 */
export function nextFocusIndex(cantidad: number, actual: number, haciaAtras: boolean): number {
  if (cantidad <= 0) return -1;
  if (actual < 0 || actual >= cantidad) return haciaAtras ? cantidad - 1 : 0;
  return haciaAtras ? (actual - 1 + cantidad) % cantidad : (actual + 1) % cantidad;
}

/**
 * Cuánto compensar a la derecha al bloquear el scroll de `<html>` en la capa:
 * el ancho de la barra de desplazamiento que desaparece, así la página de
 * atrás no "salta". Nunca negativo.
 */
export function scrollbarCompensation(anchoVentana: number, anchoDocumento: number): number {
  return Math.max(0, anchoVentana - anchoDocumento);
}

/**
 * Escape en la capa: si hay un detalle abierto, Escape cierra el detalle (la
 * capa sigue); si no, sale de la pantalla completa. En modo nativo Escape lo
 * maneja el navegador y siempre sale.
 */
export function escapeAction(modo: FullscreenMode, hayDetalle: boolean): 'close-detail' | 'exit' | 'browser' {
  if (modo === 'native') return 'browser';
  return hayDetalle ? 'close-detail' : 'exit';
}
