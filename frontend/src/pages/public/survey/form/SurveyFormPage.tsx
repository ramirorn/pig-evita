// ===========================================
// SurveyFormPage — el cuestionario público de la encuesta (S20)
// ===========================================
import { Link, useSearchParams } from 'react-router';
import { CalendarClock, RefreshCw, WifiOff } from 'lucide-react';
import { CompetitionStage } from '@/types';
import { ROUTES } from '@/lib/constants';
import { PublicPageFallback } from '@/components/shared/PublicPageFallback';
import { useSurveyWizard } from './useSurveyWizard';
import { SurveyContextStep } from './SurveyContextStep';
import { SurveyQuestionsStep } from './SurveyQuestionsStep';
import { SurveyDoneStep } from './SurveyDoneStep';

/** ¿El `?etapa=` de la URL es una etapa de verdad? Si no, se ignora. */
function etapaDeLaUrl(valor: string | null): CompetitionStage | undefined {
  if (!valor) return undefined;
  const etapas: string[] = Object.values(CompetitionStage);
  return etapas.includes(valor) ? (valor as CompetitionStage) : undefined;
}

/**
 * Ruta propia (`/encuesta/responder`), no un modal sobre la landing.
 *
 * Tres razones, y las tres salen del mismo problema de producto: esto se
 * difunde con un QR impreso y se contesta con mala señal.
 *
 *   1. Tiene URL. Se imprime en el QR, se manda por WhatsApp y se puede volver
 *      a abrir. Un modal no se puede compartir ni recargar.
 *   2. Sobrevive al refresh. Con un modal, cualquier recarga devuelve a la
 *      landing y hay que volver a bajar hasta el botón.
 *   3. La landing queda intacta: se engancha por `encuestaHref` y no hubo que
 *      tocarle una línea (ver `surveyCta.ts`).
 *
 * El `?etapa=` opcional permite imprimir un QR distinto por etapa y que el
 * cuestionario venga elegido de fábrica; si viene cualquier otra cosa se
 * ignora en vez de romper.
 */
export function SurveyFormPage() {
  const [searchParams] = useSearchParams();
  const wizard = useSurveyWizard({ etapa: etapaDeLaUrl(searchParams.get('etapa')) });

  if (wizard.cargando) {
    return <PublicPageFallback />;
  }

  // No se pudo pedir el cuestionario. Es distinto de "no hay encuesta abierta",
  // y por eso el texto y el botón son otros: acá sí hay algo que reintentar.
  if (wizard.error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <WifiOff className="mx-auto h-14 w-14 text-primary-600" aria-hidden="true" />
        <h1 className="font-display mt-6 text-2xl font-extrabold tracking-tight text-primary-800">
          No pudimos cargar la encuesta
        </h1>
        <p className="mt-3 text-base leading-relaxed text-primary-700">
          Puede ser la señal. Probá de nuevo en un rato.
        </p>
        <button
          type="button"
          onClick={() => void wizard.recargar()}
          className="mt-8 inline-flex min-h-14 items-center gap-2 rounded-full bg-primary-800 px-8 py-4 text-base font-bold text-white transition-colors hover:bg-primary-900"
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
          Probar de nuevo
        </button>
      </div>
    );
  }

  // `data === null` es un estado normal del sitio: todavía no se publicó
  // ninguna campaña. Se dice tal cual, sin inventar un cuestionario vacío.
  if (!wizard.campania) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <CalendarClock
          className="mx-auto h-14 w-14 text-primary-600"
          aria-hidden="true"
        />
        <h1 className="font-display mt-6 text-2xl font-extrabold tracking-tight text-primary-800">
          Todavía no hay una encuesta abierta
        </h1>
        <p className="mt-3 text-base leading-relaxed text-primary-700">
          Se abre junto con las competencias. Volvé en unos días.
        </p>
        <Link
          to={ROUTES.SURVEY}
          className="mt-8 inline-flex min-h-14 items-center justify-center rounded-full border-2 border-primary-700 px-8 py-4 text-base font-bold text-primary-800 transition-colors hover:bg-primary-50"
        >
          Ver de qué se trata
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated">
      {/* Aviso de borrador restaurado. Va arriba de todo y es descartable: si
          no se dijera, la persona ve respuestas ya marcadas y no entiende por
          qué —o peor, cree que alguien más contestó desde su teléfono—. */}
      {wizard.borradorRestaurado && wizard.step !== 3 && (
        <div className="border-b border-primary-200 bg-primary-50 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-2xl items-start justify-between gap-4">
            <p className="text-sm leading-relaxed font-medium text-primary-800">
              Recuperamos lo que habías contestado la última vez. Seguí donde lo
              dejaste.
            </p>
            <button
              type="button"
              onClick={wizard.descartarAvisoDeBorrador}
              className="shrink-0 text-sm font-bold text-primary-700 underline hover:text-primary-900"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {wizard.step === 1 && <SurveyContextStep wizard={wizard} />}
      {wizard.step === 2 && <SurveyQuestionsStep wizard={wizard} />}
      {wizard.step === 3 && <SurveyDoneStep wizard={wizard} />}
    </div>
  );
}
