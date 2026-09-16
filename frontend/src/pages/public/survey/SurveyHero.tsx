// ===========================================
// SurveyHero — apertura de la landing de la encuesta
// ===========================================
import { Clock, EyeOff } from 'lucide-react';
import { SurveyCtaButton } from './SurveyCtaButton';
import { DURACION_ENCUESTA, type SurveyCtaProps } from './surveyCta';

/**
 * Hereda el lenguaje del hero de la home (azul institucional en degradé + el
 * grano de `.noise-bg`) pero **sin la imagen del logo**: la edición anterior de
 * la encuesta no llegó al 50 % de respuestas y una parte de eso se juega en los
 * primeros segundos, muchos desde un celular de gama baja. Acá no entra nada
 * que haya que descargar: el fondo son dos degradés CSS y un data-URI de ~300
 * bytes que ya está en el bundle.
 *
 * Los dos chips de abajo del botón son la información que más pesa en la
 * decisión de tocarlo —cuánto tarda y que es anónima—, así que van **arriba**,
 * no en la letra chica del final.
 */
export function SurveyHero({ onAbrirEncuesta, encuestaHref }: SurveyCtaProps) {
  return (
    <section className="relative overflow-hidden bg-primary-900 px-4 pt-16 pb-20 sm:px-6 md:pt-24 md:pb-28 lg:px-8">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-500 opacity-95" />
      <div className="absolute inset-0 noise-bg mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 h-[600px] w-[600px] -translate-y-1/3 translate-x-1/3 rounded-full bg-celeste-200/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center rounded-full border border-celeste-200/30 bg-white/10 px-4 py-1.5 text-xs font-bold tracking-widest text-celeste-100 uppercase">
          Juegos Evita Formoseños
        </span>

        <h1 className="font-display mt-6 text-3xl leading-[1.15] font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
          Antes de competir,{' '}
          <span className="text-accent-500 italic">la cabeza</span> también
          entrena
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-celeste-100">
          Contanos cómo la llevás cuando aprieta. Es anónimo y no hay respuestas
          correctas: sirve para que te conozcas un poco más y para que sepamos
          qué te hace falta.
        </p>

        <div className="mt-10 flex flex-col items-center gap-6">
          <SurveyCtaButton
            onAbrirEncuesta={onAbrirEncuesta}
            encuestaHref={encuestaHref}
          >
            Responder la encuesta
          </SurveyCtaButton>

          <ul className="flex flex-col items-center gap-3 text-sm font-semibold text-celeste-100 sm:flex-row sm:gap-6">
            <li className="inline-flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-accent-400" aria-hidden="true" />
              Anónima: no te pedimos el nombre
            </li>
            <li className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent-400" aria-hidden="true" />
              Te lleva {DURACION_ENCUESTA}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
