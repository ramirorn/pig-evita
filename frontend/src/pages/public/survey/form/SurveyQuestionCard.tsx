// ===========================================
// SurveyQuestionCard — una pregunta del cuestionario
// ===========================================
import { cn } from '@/lib/utils';
import {
  SurveyQuestionKind,
  type SurveyQuestionWithOptions,
} from '@/types';

interface SurveyQuestionCardProps {
  pregunta: SurveyQuestionWithOptions;
  /** Número visible, contando sólo las preguntas que se le muestran a esta persona. */
  numero: number;
  total: number;
  elegidas: readonly string[];
  onElegir: (optionId: string) => void;
  /** Marca la pregunta obligatoria que quedó sin contestar al intentar enviar. */
  resaltarFalta: boolean;
}

/**
 * Se usan `<input type="radio">` y `<input type="checkbox">` reales dentro de un
 * `<fieldset>` con `<legend>`, y no `<div onClick>` con `aria-*` a mano.
 *
 * El navegador ya trae gratis lo que costaría mucho reimplementar bien: el
 * grupo de radios se recorre con las flechas, el foco se ve, y un lector de
 * pantalla anuncia "pregunta 3 de 8, opción 2 de 4, seleccionada". Quien
 * responde puede estar usando un teclado, un lector, o un teléfono viejo con el
 * JavaScript a medio cargar.
 *
 * El área táctil de cada opción es toda la fila (`min-h-14`, ~56 px): esto se
 * contesta mayormente desde un celular, muchas veces al sol y apurado.
 */
export function SurveyQuestionCard({
  pregunta,
  numero,
  total,
  elegidas,
  onElegir,
  resaltarFalta,
}: SurveyQuestionCardProps) {
  const esMultiple = pregunta.kind === SurveyQuestionKind.MULTIPLE;
  const idAyuda = `${pregunta.id}-ayuda`;

  return (
    <fieldset
      className={cn(
        'card scroll-mt-24 p-5 md:p-6',
        resaltarFalta && 'border-2 border-accent-500',
      )}
      id={`pregunta-${pregunta.id}`}
      aria-describedby={pregunta.ayuda ? idAyuda : undefined}
    >
      <legend className="sr-only">{pregunta.texto}</legend>

      <p className="text-xs font-bold tracking-widest text-primary-500 uppercase">
        Pregunta {numero} de {total}
      </p>

      <p
        aria-hidden="true"
        className="mt-2 text-lg leading-snug font-bold text-primary-800"
      >
        {pregunta.texto}
      </p>

      {/* El dato ausente se omite: sin `ayuda` no se pinta una aclaración vacía. */}
      {pregunta.ayuda && (
        <p id={idAyuda} className="mt-2 text-sm leading-relaxed text-primary-600">
          {pregunta.ayuda}
        </p>
      )}

      <p className="mt-2 text-sm font-semibold text-primary-600">
        {esMultiple ? 'Podés marcar varias.' : 'Elegí una.'}
        {!pregunta.obligatoria && ' Si no querés contestarla, seguí de largo.'}
      </p>

      <div className="mt-4 space-y-2">
        {pregunta.options.map((opcion) => {
          const seleccionada = elegidas.includes(opcion.id);

          return (
            <label
              key={opcion.id}
              className={cn(
                'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3',
                'transition-colors focus-within:ring-2 focus-within:ring-primary-500',
                seleccionada
                  ? 'border-primary-700 bg-primary-50'
                  : 'border-primary-400 bg-white hover:bg-primary-50',
              )}
            >
              <input
                type={esMultiple ? 'checkbox' : 'radio'}
                name={pregunta.id}
                value={opcion.id}
                checked={seleccionada}
                onChange={() => onElegir(opcion.id)}
                className="h-5 w-5 shrink-0 accent-primary-700"
              />
              <span className="text-base leading-snug font-medium text-primary-800">
                {opcion.texto}
              </span>
            </label>
          );
        })}
      </div>

      {resaltarFalta && (
        <p className="mt-3 text-sm font-bold text-accent-700" role="alert">
          Esta hay que contestarla para poder mandar la encuesta.
        </p>
      )}
    </fieldset>
  );
}
