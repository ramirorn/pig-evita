// ===========================================
// SurveyCtaSection — cierre de la landing
// ===========================================
import { SurveyCtaButton } from './SurveyCtaButton';
import { DURACION_ENCUESTA, type SurveyCtaProps } from './surveyCta';

/**
 * Franja de cierre, con el mismo `.curved-top` sobre azul institucional que usa
 * el cierre de la home: el sitio termina siempre igual y esta página no
 * inventa un remate propio.
 *
 * Repite el CTA porque el de arriba ya quedó fuera de pantalla hace tres
 * secciones, y repite el anonimato porque es la objeción que hay que sacar del
 * medio justo antes de tocar el botón.
 */
export function SurveyCtaSection({
  onAbrirEncuesta,
  encuestaHref,
}: SurveyCtaProps) {
  return (
    <section className="curved-top relative overflow-hidden bg-primary-800 px-4 pt-24 pb-20 sm:px-6 md:pt-32 md:pb-24 lg:px-8">
      <div className="absolute inset-0 noise-bg mix-blend-overlay" />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center pt-8 text-center">
        <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight text-white md:text-3xl">
          ¿Arrancamos? Son {DURACION_ENCUESTA} y quedan entre vos y vos
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-celeste-100">
          Nadie va a saber que fuiste vos. Lo único que puede pasar es que
          termines entendiéndote un poco mejor para la próxima vez que te toque
          entrar.
        </p>

        <div className="mt-10">
          <SurveyCtaButton
            onAbrirEncuesta={onAbrirEncuesta}
            encuestaHref={encuestaHref}
          >
            Quiero responder
          </SurveyCtaButton>
        </div>
      </div>
    </section>
  );
}
