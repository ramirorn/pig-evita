// ===========================================
// SurveyQuestionCard — una pregunta del cuestionario
// ===========================================
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
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
 * Se usan `RadioGroup` / `Checkbox` propios (Radix: `role="radiogroup"`,
 * `role="radio"` y `role="checkbox"` con `aria-checked`) dentro de un
 * `<fieldset>` con `<legend>`, y no `<div onClick>` con `aria-*` a mano.
 *
 * Radix trae lo difícil de reimplementar bien: el grupo de radios se recorre
 * con las flechas, Espacio marca, el foco se ve, y un lector de pantalla anuncia
 * "pregunta 3 de 8, opción 2 de 4, seleccionada".
 *
 * El área táctil de cada opción es toda la fila (`min-h-14`, ~56 px): esto se
 * contesta mayormente desde un celular, muchas veces al sol y apurado.
 */
const filaClase = (seleccionada: boolean) =>
  cn(
    'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3',
    'transition-colors duration-120 motion-reduce:transition-none focus-within:ring-2 focus-within:ring-primary-500',
    seleccionada
      ? 'border-primary-700 bg-primary-50'
      : 'border-primary-400 bg-white hover:bg-primary-50',
  );

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

      {esMultiple ? (
        <div className="mt-4 space-y-2">
          {pregunta.options.map((opcion) => {
            const seleccionada = elegidas.includes(opcion.id);
            const idControl = `${pregunta.id}-${opcion.id}`;
            return (
              <label key={opcion.id} htmlFor={idControl} className={filaClase(seleccionada)}>
                <Checkbox
                  id={idControl}
                  checked={seleccionada}
                  onCheckedChange={() => onElegir(opcion.id)}
                  className="size-6"
                />
                <span className="text-base leading-snug font-medium text-primary-800">
                  {opcion.texto}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <RadioGroup
          aria-label={pregunta.texto}
          value={elegidas[0] ?? ''}
          onValueChange={onElegir}
          className="mt-4 gap-2"
        >
          {pregunta.options.map((opcion) => {
            const seleccionada = elegidas.includes(opcion.id);
            const idControl = `${pregunta.id}-${opcion.id}`;
            return (
              <label key={opcion.id} htmlFor={idControl} className={filaClase(seleccionada)}>
                <RadioItem id={idControl} value={opcion.id} className="size-6" />
                <span className="text-base leading-snug font-medium text-primary-800">
                  {opcion.texto}
                </span>
              </label>
            );
          })}
        </RadioGroup>
      )}

      {resaltarFalta && (
        <p className="mt-3 text-sm font-bold text-accent-700" role="alert">
          Esta hay que contestarla para poder mandar la encuesta.
        </p>
      )}
    </fieldset>
  );
}
