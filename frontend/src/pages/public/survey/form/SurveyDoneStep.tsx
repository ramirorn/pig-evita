// ===========================================
// SurveyDoneStep — paso 3: cierre
// ===========================================
import { Link } from 'react-router';
import { CheckCircle2, CloudUpload, Loader2, RefreshCw } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import type { SurveyWizard } from './useSurveyWizard';

interface SurveyDoneStepProps {
  wizard: SurveyWizard;
}

/**
 * Dos cierres distintos, porque son dos cosas distintas:
 *
 *   · **confirmado** — el servidor la recibió. Se agradece y se termina.
 *   · **encolado** — no había señal. La respuesta está guardada en el teléfono
 *     y se va a mandar sola. Decir "gracias, listo" acá sería mentir, y decir
 *     "error, se perdió" también.
 *
 * ⚠️ **No hay, ni puede haber, un "ver mis respuestas".** La respuesta se
 * guarda sin ninguna atadura a quien la mandó —el acuse del backend ni siquiera
 * trae un id, a propósito— así que no existe nada que mostrar. Ofrecerlo sería
 * prometer algo que el modelo de datos no puede cumplir, y peor: insinuar que
 * en algún lado hay una fila con nombre.
 */
export function SurveyDoneStep({ wizard }: SurveyDoneStepProps) {
  const encolado = wizard.resultado === 'encolado';
  const pendientes = wizard.pendientes.length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 md:py-24">
      {encolado ? (
        <CloudUpload
          className="mx-auto h-16 w-16 text-primary-700"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2
          className="mx-auto h-16 w-16 text-secondary-500"
          aria-hidden="true"
        />
      )}

      <h1 className="font-display mt-6 text-2xl leading-tight font-extrabold tracking-tight text-primary-800 md:text-3xl">
        {encolado ? 'Quedaron guardadas en este teléfono' : '¡Gracias por contestar!'}
      </h1>

      <p className="mt-4 text-base leading-relaxed text-primary-700">
        {encolado
          ? 'No había señal para mandarlas. No las contestes de nuevo: apenas vuelva la conexión se envían solas. Podés cerrar la página.'
          : 'Lo que contestaste se suma al resto, sin tu nombre ni ningún dato tuyo. Sirve para entender qué les está pasando a los que compiten y qué hace falta sumar.'}
      </p>

      {pendientes > 0 && (
        <div className="mt-8 rounded-xl border-2 border-primary-200 bg-primary-50 p-5 text-left">
          <p className="text-sm leading-relaxed font-bold text-primary-800">
            {pendientes === 1
              ? 'Hay 1 envío esperando conexión.'
              : `Hay ${pendientes} envíos esperando conexión.`}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-primary-700">
            Se reintenta solo cuando vuelve la señal. También podés probar ahora.
          </p>
          <button
            type="button"
            onClick={() => void wizard.reintentarPendientes()}
            disabled={wizard.enviando}
            className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary-800 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {wizard.enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Probando…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Intentar ahora
              </>
            )}
          </button>
        </div>
      )}

      <Link
        to={ROUTES.HOME}
        className="mt-10 inline-flex min-h-14 items-center justify-center rounded-full border-2 border-primary-700 px-8 py-4 text-base font-bold text-primary-800 transition-colors hover:bg-primary-50"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
