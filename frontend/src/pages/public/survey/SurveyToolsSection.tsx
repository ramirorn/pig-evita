// ===========================================
// SurveyToolsSection — herramientas y pedir ayuda
// ===========================================
import { HeartHandshake, MessageCircle, Split, Wind } from 'lucide-react';

/**
 * El giro de la sección anterior: ahí se nombra lo que pasa, acá se dice que
 * hay algo para hacer. Cada herramienta está escrita como una acción concreta
 * —no como un concepto— para que se pueda probar el mismo día.
 *
 * El verde institucional (`secondary`) es el color de salud del sistema y lo
 * separa visualmente del bloque azul de arriba sin inventar una paleta nueva.
 */
const HERRAMIENTAS = [
  {
    icon: Wind,
    titulo: 'Respirar antes de entrar',
    texto:
      'Inhalás contando hasta cuatro, aguantás cuatro, soltás en seis. Tres o cuatro veces. Suena a poco y le baja un cambio a las pulsaciones.',
  },
  {
    icon: Split,
    titulo: 'Separar el resultado de vos',
    texto:
      'Erraste un penal, no sos un desastre. Perdiste una final, no sos un perdedor. Una cosa es lo que hiciste y otra es quién sos.',
  },
  {
    icon: MessageCircle,
    titulo: 'Decirlo en voz alta',
    texto:
      'Contarle a un compañero, al entrenador o en tu casa que estás con la cabeza en cualquier lado ya cambia algo. Guardárselo todo cansa más que entrenar.',
  },
  {
    icon: HeartHandshake,
    titulo: 'Buscar a alguien que sepa',
    texto:
      'Hay profesionales que trabajan justamente con deportistas. Ir no significa que estés mal: significa que querés estar mejor.',
  },
] as const;

export function SurveyToolsSection() {
  return (
    <section className="bg-secondary-900 px-4 py-16 sm:px-6 md:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight text-white md:text-3xl">
            Pedir ayuda no te hace menos jugador
          </h2>
          <p className="mt-3 text-base leading-relaxed text-secondary-100">
            Nadie te pide que resuelvas todo solo. Estas cuatro cosas las podés
            probar esta semana, sin que nadie se entere si no querés.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {HERRAMIENTAS.map(({ icon: Icon, titulo, texto }) => (
            <article
              key={titulo}
              className="rounded-xl border border-white/15 bg-white/5 p-6"
            >
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500 text-primary-900">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold text-white">{titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary-100">
                {texto}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
