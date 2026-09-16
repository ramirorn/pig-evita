// ===========================================
// SurveyAboutSection — qué es la encuesta y por qué es anónima
// ===========================================
import { Clock, EyeOff, ListChecks, ShieldCheck } from 'lucide-react';
import { DURACION_ENCUESTA } from './surveyCta';

/**
 * Las dos mitades de esta sección responden las dos preguntas que frenan a
 * alguien con el dedo sobre el botón: *qué me van a preguntar* y *quién va a
 * ver lo que contesto*.
 *
 * El bloque de anonimato está deliberadamente **sobredimensionado**: borde
 * dorado, fondo propio y tres afirmaciones en positivo. La edición anterior
 * ponía esto en letra chica al pie de un QR y no llegó al 50 % de respuestas.
 * Si alguien lee una sola cosa de la página, que sea ésta.
 */
const TEMAS = [
  'Cómo manejás los nervios los días de competencia.',
  'Qué te pasa y qué hacés cuando perdés o te sale mal.',
  'Con qué apoyo contás en tu equipo, en tu casa y en la escuela.',
] as const;

const GARANTIAS = [
  'No te pedimos nombre, DNI, mail ni teléfono. No hay forma de saber quién contestó qué.',
  'Ni tu entrenador, ni tu club, ni tu escuela ven tus respuestas.',
  'Se leen todas juntas, para entender qué le está pasando al conjunto y qué hace falta sumar.',
] as const;

export function SurveyAboutSection() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
      <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight text-primary-800 md:text-3xl">
        De qué va esta encuesta
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-primary-700">
        La armó Laura, psicóloga del equipo de los Juegos. No es un examen y no
        hay respuestas correctas: son preguntas para que pares un minuto y te
        escuches.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6 md:p-8">
          <h3 className="flex items-center gap-2 text-lg font-bold text-primary-800">
            <ListChecks
              className="h-5 w-5 text-primary-700"
              aria-hidden="true"
            />
            Qué te vamos a preguntar
          </h3>
          <ul className="mt-4 space-y-3">
            {TEMAS.map((tema) => (
              <li
                key={tema}
                className="flex gap-3 text-sm leading-relaxed text-primary-700"
              >
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-600"
                  aria-hidden="true"
                />
                {tema}
              </li>
            ))}
          </ul>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-sm font-bold text-primary-800">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Te lleva {DURACION_ENCUESTA}
          </p>
        </div>

        {/* El bloque que más pesa de la página. Ver el comentario de arriba. */}
        <div className="rounded-xl border-2 border-accent-500 bg-accent-50 p-6 md:p-8">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-500 text-primary-900">
            <EyeOff className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="font-display text-xl font-extrabold text-primary-900 md:text-2xl">
            Es anónima. En serio.
          </h3>
          <p className="mt-2 text-base font-semibold text-primary-800">
            Contestá lo que te pasa de verdad, no lo que quedaría bien.
          </p>
          <ul className="mt-5 space-y-3">
            {GARANTIAS.map((garantia) => (
              <li
                key={garantia}
                className="flex gap-3 text-sm leading-relaxed text-primary-800"
              >
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent-700"
                  aria-hidden="true"
                />
                {garantia}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
