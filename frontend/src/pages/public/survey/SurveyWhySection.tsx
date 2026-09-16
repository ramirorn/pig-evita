// ===========================================
// SurveyWhySection — por qué la cabeza también cuenta
// ===========================================
import { CloudRain, Flame, Users } from 'lucide-react';

/**
 * La primera sección después del hero **no explica qué es la salud mental**:
 * describe tres situaciones que cualquiera que compite reconoce sin que se las
 * expliquen. Nombrar la escena ("el nudo en la panza") hace el trabajo que no
 * hace una definición, y evita la jerga clínica que en la edición anterior
 * dejaba la encuesta del lado de "esto no es para mí".
 *
 * Tres tarjetas y no seis: la página se lee de una pasada en el celular.
 */
const MOMENTOS = [
  {
    icon: Flame,
    titulo: 'El nudo en la panza',
    texto:
      'Faltan diez minutos, te tiembla todo y sentís que el cuerpo no te responde. No sos el único: le pasa a los que recién arrancan y a los que llegan a la selección.',
  },
  {
    icon: CloudRain,
    titulo: 'La bronca cuando perdés',
    texto:
      'Terminó el partido, saliste mal y no querés hablar con nadie. Estar caliente después de perder es normal. Lo que cambia las cosas es qué hacés con eso al otro día.',
  },
  {
    icon: Users,
    titulo: 'La presión de no fallar',
    texto:
      'Tu familia, el club, los profes de la escuela. Un montón de gente esperando algo. A veces terminás compitiendo para no defraudar a nadie más que para disfrutar.',
  },
] as const;

export function SurveyWhySection() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
      <div className="max-w-2xl">
        <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight text-primary-800 md:text-3xl">
          Los nervios antes de entrar no son un problema tuyo
        </h2>
        <p className="mt-3 text-base leading-relaxed text-primary-700">
          Entrenás el cuerpo todas las semanas. Lo que sentís arriba de la cancha
          también se entrena, y casi nunca se habla.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MOMENTOS.map(({ icon: Icon, titulo, texto }) => (
          <article key={titulo} className="card p-6">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-bold text-primary-800">{titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-primary-700">
              {texto}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
