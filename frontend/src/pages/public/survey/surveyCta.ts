// ===========================================
// surveyCta — contrato del CTA de la encuesta
// ===========================================

/**
 * 👉 **PUNTO DE INTEGRACIÓN DEL FORMULARIO.**
 *
 * Esta landing es informativa: el formulario de la encuesta lo implementa otra
 * persona y se engancha *desde afuera*, pasándole a `SurveyLandingPage` una de
 * estas dos props. Ninguna sección de esta carpeta sabe —ni tiene que saber—
 * qué pasa cuando alguien toca el botón.
 *
 * Las dos formas soportadas, en orden de precedencia:
 *
 * 1. `onAbrirEncuesta` — se dispara un handler (abrir un modal, montar el
 *    formulario in-place, disparar analítica). El CTA se pinta como `<button>`.
 * 2. `encuestaHref` — se navega. Si empieza con `http` se usa un `<a>` externo
 *    (target `_blank` + `rel="noopener noreferrer"`); si no, un `<Link>` de
 *    react-router hacia la ruta interna del formulario.
 *
 * Si no se pasa ninguna, el CTA se renderiza **deshabilitado y honesto**
 * ("todavía no está abierta"), en vez de un botón que no lleva a ningún lado.
 * Es la misma regla que el resto del módulo público: el dato ausente se omite,
 * no se rellena (ver `documentacion/plan-ui-publica.md` §3.4).
 */
export interface SurveyCtaProps {
  /** Handler para abrir el formulario. Tiene precedencia sobre `encuestaHref`. */
  onAbrirEncuesta?: () => void;
  /** Ruta interna (`/encuesta/responder`) o URL absoluta del formulario. */
  encuestaHref?: string;
}

/**
 * Cuánto tarda la encuesta, en un solo lugar.
 *
 * ⚠️ Aparece tres veces en la página (hero, sección "De qué va" y cierre) y es
 * una promesa que se le hace al que responde: si el formulario final queda más
 * largo, se cambia **acá** y las tres se actualizan juntas.
 * Confirmar el número con Laura antes de publicar.
 */
export const DURACION_ENCUESTA = '5 minutos';
