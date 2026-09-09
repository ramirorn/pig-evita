// ===========================================
// DisciplineCard — tarjeta del listado público de disciplinas
// ===========================================
import {
  Trophy, ArrowRight, Layers, Users, Target as TargetIcon,
  Dumbbell, Bike, Target, Swords, Volleyball,
  Footprints, Waves, Wind, Flame, CircleDot, Gamepad2,
} from 'lucide-react';
import { Link } from 'react-router';
import type { Discipline } from '@/types';
import { DisciplineType } from '@/types';
import { cn } from '@/lib/utils';
import { RESULT_TYPE_LABELS } from '@/lib/constants';
import { retrasoDeEntrada } from '@/lib/gridVolumen';

/**
 * ⚠️ **Las clases de Tailwind no se interpolan.**
 *
 * Acá vivía un degradé de hover armado así:
 *
 *     `group-hover:bg-gradient-to-br group-hover:${CARD_GRADIENTS[idx % 6]}`
 *
 * Tailwind escanea el fuente buscando clases **escritas tal cual**, y
 * la clase resultante (`group-hover:` + `from-primary-500`, concatenadas en
 * tiempo de ejecución) no aparecía escrita en ningún lado del fuente: nunca
 * se generó. Lo único literal era `group-hover:bg-gradient-to-br`, que sin
 * paradas de color no pinta nada. Resultado: al pasar el mouse el fondo seguía
 * siendo `bg-primary-100` (#d6e4f4) y el texto pasaba a blanco por el
 * `group-hover:text-white` de al lado. Blanco sobre #d6e4f4 es **1.29:1**: el
 * icono directamente desaparecía. Un fallo de accesibilidad disparado por una
 * interacción, que ningún linter agarra y que no se ve mirando el JSX.
 *
 * El hover de esta tarjeta ahora cambia sombra y desplazamiento, que son
 * propiedades que no dependen de generar una clase dinámica. Si alguna vez hace
 * falta un color variable, se escriben las combinaciones completas en un mapa
 * de constantes, nunca concatenando el sufijo.
 */

// Cada disciplina conocida tiene su icono; el resto cae en el trofeo genérico.
// Son iconos y se ven como iconos: es lo honesto, porque `Discipline` no tiene
// ningún campo de imagen en el modelo y una foto de stock sería inventarle la
// identidad visual a una institución real.
const DISCIPLINE_ICONS: Record<string, React.ReactNode> = {
  'Fútbol 11': <CircleDot className="w-6 h-6" />,
  'Fútbol': <CircleDot className="w-6 h-6" />,
  'Atletismo': <Footprints className="w-6 h-6" />,
  'Natación': <Waves className="w-6 h-6" />,
  'Ciclismo': <Bike className="w-6 h-6" />,
  'Tiro': <Target className="w-6 h-6" />,
  'Esgrima': <Swords className="w-6 h-6" />,
  'Vóley': <Volleyball className="w-6 h-6" />,
  'Volleyball': <Volleyball className="w-6 h-6" />,
  'Pesas': <Dumbbell className="w-6 h-6" />,
  'Halterofilia': <Dumbbell className="w-6 h-6" />,
  'Karate': <Wind className="w-6 h-6" />,
  'Taekwondo': <Flame className="w-6 h-6" />,
  'Ajedrez': <Gamepad2 className="w-6 h-6" />,
};

function getDisciplineIcon(name: string): React.ReactNode {
  if (DISCIPLINE_ICONS[name]) return DISCIPLINE_ICONS[name];
  const key = Object.keys(DISCIPLINE_ICONS).find((k) =>
    name.toLowerCase().includes(k.toLowerCase()),
  );
  return key ? DISCIPLINE_ICONS[key] : <Trophy className="w-6 h-6" />;
}

/**
 * Qué promete el enlace, según lo que de verdad hay del otro lado.
 *
 * El CTA decía siempre "Ver reglamento y categorías". En los datos reales, de
 * las cinco disciplinas activas **ninguna** tiene reglamento cargado: cuatro lo
 * tienen en `null` y Ajedrez lo tiene en `""`, que es ausencia disfrazada de
 * presencia. Y "Lucas" tampoco tiene categorías. Prometer las dos cosas siempre
 * es de la misma familia que el "3 min de lectura" que ya se sacó de noticias.
 *
 * La tarjeta **sigue siendo un enlace** en los cuatro casos: la pantalla de
 * detalle no está vacía —tiene el tipo de modalidad, el tipo de resultado, los
 * jugadores por equipo y el CTA de inscripción— y una grilla con cuatro
 * tarjetas clickeables y una que no lo es sería una inconsistencia más cara de
 * explicar que un texto genérico. Lo que se corrige es lo que el enlace promete,
 * no su existencia.
 */
function textoDelEnlace(hayReglamento: boolean, hayCategorias: boolean): string {
  if (hayReglamento && hayCategorias) return 'Ver reglamento y categorías';
  if (hayCategorias) return 'Ver categorías';
  if (hayReglamento) return 'Ver reglamento';
  return 'Ver detalle de la disciplina';
}

interface DisciplineCardProps {
  discipline: Discipline;
  index: number;
}

export function DisciplineCard({ discipline, index }: DisciplineCardProps) {
  // `rules` viene `null` en cuatro de las cinco filas reales y `""` en la
  // quinta: una cadena en blanco no es un reglamento.
  const hayReglamento = (discipline.rules ?? '').trim().length > 0;

  const categorias = discipline._count?.categories ?? 0;
  const hayCategorias = categorias > 0;

  // Sólo tiene sentido hablar de jugadores por equipo en las disciplinas de
  // equipo, y sólo si están los dos extremos del rango.
  const hayRangoDeJugadores =
    discipline.type === DisciplineType.EQUIPO &&
    typeof discipline.minPlayers === 'number' &&
    typeof discipline.maxPlayers === 'number';

  const etiquetaResultado: string | undefined = RESULT_TYPE_LABELS[discipline.resultType];

  return (
    <Link
      to={`/disciplinas/${discipline.id}`}
      // `block h-full` arregla dos cosas con la misma línea: un `<a>` es inline
      // por defecto, así que el `h-full` de la tarjeta no estiraba y las
      // tarjetas de la fila quedaban de distinto alto según el título tuviera
      // una o dos líneas; y el contorno de `:focus-visible` se dibujaba sobre
      // una caja inline, que puede partirse en dos entre renglones. El
      // `rounded-xl` es para que ese contorno siga la forma de la tarjeta.
      className="group block h-full rounded-xl animate-fade-in"
      style={{ animationDelay: retrasoDeEntrada(index) }}
    >
      <div className="card h-full p-6 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col items-center text-center">
        {/* El hover cambia sombra y desplazamiento, nunca el color del icono. */}
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-primary-100 text-primary-700">
          {getDisciplineIcon(discipline.name)}
        </div>

        <h2 className="font-bold text-primary-900 text-lg mb-2">{discipline.name}</h2>

        <span
          className={cn(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide',
            discipline.type === DisciplineType.INDIVIDUAL
              ? 'bg-celeste-50 text-celeste-800 border border-celeste-200'
              : 'bg-secondary-50 text-secondary-800 border border-secondary-200',
          )}
        >
          {discipline.type === DisciplineType.INDIVIDUAL ? 'Individual' : 'Equipo'}
        </span>

        {/* Datos reales. La regla es la misma en las cuatro páginas: si el campo
            no está, la fila no se renderiza — nunca se sustituye por una
            etiqueta genérica ni por un "0 categorías". */}
        <div className="mt-3 space-y-1.5 text-sm text-primary-600">
          {hayCategorias && (
            <p className="flex items-center justify-center gap-1.5">
              <Layers className="w-4 h-4 text-primary-500" aria-hidden="true" />
              {categorias} {categorias === 1 ? 'categoría' : 'categorías'}
            </p>
          )}

          {hayRangoDeJugadores && (
            <p className="flex items-center justify-center gap-1.5">
              <Users className="w-4 h-4 text-primary-500" aria-hidden="true" />
              {discipline.minPlayers} a {discipline.maxPlayers} jugadores
            </p>
          )}

          {etiquetaResultado && (
            <p className="flex items-center justify-center gap-1.5">
              <TargetIcon className="w-4 h-4 text-primary-500" aria-hidden="true" />
              Se define por {etiquetaResultado.toLowerCase()}
            </p>
          )}
        </div>

        <div className="mt-auto pt-4">
          <span className="text-primary-600 font-medium text-sm flex items-center justify-center gap-1 group-hover:text-primary-800 transition-colors">
            {textoDelEnlace(hayReglamento, hayCategorias)}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
