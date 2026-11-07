// ===========================================
// SurveyContextStep — paso 1: de qué deporte venís
// ===========================================
import { ArrowRight, EyeOff } from 'lucide-react';
import { CompetitionStage, Sex } from '@/types';
import { SEX_LABELS, STAGE_LABELS } from '@/lib/constants';
import { SelectField } from '@/components/ui/select';
import type { SurveyWizard } from './useSurveyWizard';

interface SurveyContextStepProps {
  wizard: SurveyWizard;
}

/** Texto grande y borde marcado: la encuesta la contestan chicos desde el celular. */
const CLASES_SELECT =
  'mt-2 border-2 border-primary-400 px-4 text-base text-primary-800 focus-visible:border-primary-700';
const CLASES_LISTA = '[&_[data-slot=select-item]]:min-h-11 [&_[data-slot=select-item]]:text-base';

const STAGE_OPTIONS = Object.values(CompetitionStage).map((etapa) => ({
  value: etapa,
  label: STAGE_LABELS[etapa],
}));
const SEX_OPTIONS = Object.values(Sex).map((sexo) => ({ value: sexo, label: SEX_LABELS[sexo] }));

function esEtapa(valor: string): valor is CompetitionStage {
  return (Object.values(CompetitionStage) as string[]).includes(valor);
}

function esSexo(valor: string): valor is Sex {
  return (Object.values(Sex) as string[]).includes(valor);
}

/**
 * Sólo la disciplina es obligatoria, y no por trámite: de ella sale el tipo de
 * disciplina que decide qué preguntas se muestran (y que el backend revalida).
 * Los otros campos son cortes demográficos gruesos y quedan opcionales a
 * propósito — a alguien que todavía está dudando si esto es realmente anónimo,
 * cada campo de más lo empuja a cerrar la pestaña.
 *
 * ⚠️ Acá no se pide ni se puede pedir nombre, DNI, mail ni teléfono.
 *
 * La **localidad** no se ofrece aunque el endpoint la acepte: no hay ningún
 * endpoint que liste las localidades del catálogo, y un campo de texto libre
 * produciría "Formosa", "formosa" y "Fsa" como tres cortes distintos, que es
 * peor que no tener el dato. Queda pendiente para cuando exista
 * `GET /localities`.
 */
export function SurveyContextStep({ wizard }: SurveyContextStepProps) {
  const { contexto, disciplinas, categoriasDisponibles, pideEtapa } = wizard;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-2xl leading-tight font-extrabold tracking-tight text-primary-800 md:text-3xl">
        Antes de arrancar, dos datos del deporte
      </h1>
      <p className="mt-3 text-base leading-relaxed text-primary-700">
        Nos sirven para leer las respuestas por deporte, no para saber quién
        sos. No te vamos a pedir el nombre en ningún momento.
      </p>

      <div className="mt-8 space-y-6">
        <div>
          <label
            htmlFor="survey-disciplina"
            className="text-sm font-bold text-primary-800"
          >
            ¿En qué deporte competís?
          </label>
          <SelectField
            id="survey-disciplina"
            size="xl"
            className={CLASES_SELECT}
            contentClassName={CLASES_LISTA}
            value={contexto.disciplineId ?? ''}
            onValueChange={wizard.elegirDisciplina}
            placeholder="Elegí tu deporte"
            options={disciplinas.map((disciplina) => ({
              value: disciplina.id,
              label: disciplina.name,
            }))}
            required
          />
        </div>

        {/* La etapa sólo se pregunta si la campaña no la fija: cuando la fija,
            preguntarla sería pedir un dato que ya sabemos y que además podría
            contradecir al servidor. */}
        {pideEtapa && (
          <div>
            <label
              htmlFor="survey-etapa"
              className="text-sm font-bold text-primary-800"
            >
              ¿En qué etapa estás compitiendo?
            </label>
            <SelectField
              id="survey-etapa"
              size="xl"
              className={CLASES_SELECT}
              contentClassName={CLASES_LISTA}
              value={contexto.etapa ?? ''}
              onValueChange={(valor) => {
                if (esEtapa(valor)) wizard.elegirEtapa(valor);
              }}
              placeholder="Elegí la etapa"
              options={STAGE_OPTIONS}
              required
            />
          </div>
        )}

        {/* Sin disciplina elegida no hay categorías que ofrecer, así que el
            campo directamente no aparece. */}
        {categoriasDisponibles.length > 0 && (
          <div>
            <label
              htmlFor="survey-categoria"
              className="text-sm font-bold text-primary-800"
            >
              Categoría <span className="font-medium">(si la sabés)</span>
            </label>
            <SelectField
              id="survey-categoria"
              size="xl"
              className={CLASES_SELECT}
              contentClassName={CLASES_LISTA}
              value={contexto.categoryId ?? ''}
              onValueChange={(valor) => wizard.elegirCategoria(valor || undefined)}
              emptyOptionLabel="Prefiero no decirlo"
              options={categoriasDisponibles.map((categoria) => ({
                value: categoria.id,
                label: categoria.name,
              }))}
            />
          </div>
        )}

        <div>
          <label
            htmlFor="survey-sexo"
            className="text-sm font-bold text-primary-800"
          >
            ¿En qué rama competís?{' '}
            <span className="font-medium">(opcional)</span>
          </label>
          <SelectField
            id="survey-sexo"
            size="xl"
            className={CLASES_SELECT}
            contentClassName={CLASES_LISTA}
            value={contexto.sexo ?? ''}
            onValueChange={(valor) => wizard.elegirSexo(esSexo(valor) ? valor : undefined)}
            emptyOptionLabel="Prefiero no decirlo"
            options={SEX_OPTIONS}
          />
        </div>
      </div>

      <p className="mt-8 flex items-start gap-3 rounded-xl bg-primary-50 p-4 text-sm leading-relaxed font-medium text-primary-800">
        <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" aria-hidden="true" />
        Tus respuestas se guardan sin ningún dato tuyo. Ni tu entrenador, ni tu
        club, ni tu escuela pueden ver qué contestaste.
      </p>

      <button
        type="button"
        onClick={wizard.irAPreguntas}
        className="group mt-8 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-primary-800 px-8 py-4 text-base font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-900 hover:shadow-lg active:translate-y-0 sm:w-auto"
      >
        Empezar la encuesta
        <ArrowRight
          className="h-5 w-5 transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
