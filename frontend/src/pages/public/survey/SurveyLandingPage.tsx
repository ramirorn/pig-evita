// ===========================================
// SurveyLandingPage — landing educativa de la Encuesta de salud mental
// ===========================================
import { SurveyHero } from './SurveyHero';
import { SurveyWhySection } from './SurveyWhySection';
import { SurveyToolsSection } from './SurveyToolsSection';
import { SurveyAboutSection } from './SurveyAboutSection';
import { SurveyCtaSection } from './SurveyCtaSection';
import type { SurveyCtaProps } from './surveyCta';

/**
 * Landing **informativa** de la encuesta de salud mental para deportistas.
 * No contiene el formulario: lo abre.
 *
 * Por qué existe: la edición anterior de la encuesta se difundió como un QR
 * suelto, sin contexto, y no llegó al 50 % de respuestas. Esta página es el
 * contexto que faltaba, y está escrita para alguien de 12 a 18 años que entra
 * desde el celular — secciones cortas, cero jerga clínica, cero imágenes
 * pesadas (todo el fondo es CSS) y ninguna dependencia nueva.
 *
 * El orden de los bloques es el del argumento, y no es intercambiable:
 *
 *   1. Hero      — para qué es esto, en una frase, y el botón.
 *   2. Why       — lo que te pasa (nervios, bronca, presión). Que se reconozca.
 *   3. Tools     — que hay algo para hacer, y que pedir ayuda no es debilidad.
 *   4. About     — qué te vamos a preguntar, cuánto tarda y **que es anónima**.
 *   5. Cta       — el botón otra vez, ahora que ya sabe de qué se trata.
 *
 * El anonimato aparece tres veces (hero, About, cierre) a propósito: es la
 * palanca principal para que contesten con honestidad, así que no va en letra
 * chica.
 *
 * 👉 **INTEGRACIÓN DEL FORMULARIO** — la página no sabe nada de él. Se le pasa
 * `onAbrirEncuesta` (handler: modal, formulario in-place, analítica) **o**
 * `encuestaHref` (ruta interna o URL absoluta), y el mismo CTA de arriba y el
 * de abajo se enganchan solos. El contrato completo, en `surveyCta.ts`.
 *
 * ```tsx
 * // en el router, cuando el formulario tenga ruta propia:
 * <Route path="/encuesta" element={<SurveyLandingPage encuestaHref={ROUTES.SURVEY_FORM} />} />
 *
 * // o abriéndolo en la misma página:
 * <SurveyLandingPage onAbrirEncuesta={() => setFormularioAbierto(true)} />
 * ```
 *
 * Si no se le pasa ninguna de las dos, el CTA se pinta deshabilitado y avisa
 * que la encuesta todavía no está abierta, en vez de simular un link muerto.
 */
export function SurveyLandingPage({
  onAbrirEncuesta,
  encuestaHref,
}: SurveyCtaProps) {
  return (
    <div className="bg-surface-elevated">
      <SurveyHero
        onAbrirEncuesta={onAbrirEncuesta}
        encuestaHref={encuestaHref}
      />
      <SurveyWhySection />
      <SurveyToolsSection />
      <SurveyAboutSection />
      <SurveyCtaSection
        onAbrirEncuesta={onAbrirEncuesta}
        encuestaHref={encuestaHref}
      />
    </div>
  );
}
