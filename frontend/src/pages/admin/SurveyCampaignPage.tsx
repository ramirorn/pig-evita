// ===========================================
// Survey Campaign Page — editor y tablero de una campaña (S20)
// ===========================================
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  HeartPulse,
  Loader2,
  Lock,
  MessageSquareText,
  Pencil,
  Send,
  Users,
  Waypoints,
} from 'lucide-react';

import {
  useCloseSurveyCampaign,
  usePublishSurveyCampaign,
  useSurveyCampaign,
  useSurveyFlow,
  useSurveyMetrics,
} from '@/hooks/useSurvey';
import { usePermisos } from '@/hooks/usePermisos';
import {
  ROUTES,
  STAGE_LABELS,
  SURVEY_WINDOW_LABELS,
} from '@/lib/constants';
import { logError } from '@/lib/logger';
import { SurveyCampaignStatus } from '@/types';
import {
  SURVEY_STATUS_AYUDA,
  puedeCerrarCampania,
  puedePublicarCampania,
  requisitosPublicacion,
  respuestasDe,
} from './survey/surveyRules';
import { SurveyCampaignStatusBadge } from './survey/SurveyCampaignStatusBadge';
import { SurveyCampaignForm } from './survey/SurveyCampaignForm';
import { SurveyQuestionsEditor } from './survey/SurveyQuestionsEditor';
import { SurveyMetricsPanel } from './survey/SurveyMetricsPanel';
import { SurveyFlowPanel } from './survey/SurveyFlowPanel';

import { Breadcrumbs } from '@/components/shared/Breadcrumbs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Fecha del backend en el formato que se lee en Formosa. */
function fechaCorta(iso?: string | null): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toLocaleDateString('es-AR');
}

export function SurveyCampaignPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { puede } = usePermisos();

  const [editandoDatos, setEditandoDatos] = useState(false);
  const [confirmando, setConfirmando] = useState<'publicar' | 'cerrar' | null>(null);

  const { data: campaign, isLoading, isError } = useSurveyCampaign(id);

  const flowQuery = useSurveyFlow(id);

  /**
   * Métricas **sin filtrar**, que la pantalla usa para dos cosas distintas:
   * el tablero de la pestaña de resultados arma las suyas con sus filtros, y
   * el editor necesita saber qué opciones ya fueron elegidas para decidir si
   * el botón de borrar una opción va habilitado (el backend responde 409).
   */
  const metricsQuery = useSurveyMetrics(id);

  /**
   * `undefined` a propósito cuando el corte viene suprimido: ahí no se sabe
   * si una opción fue elegida, y suponer que no lo fue ofrecería un botón de
   * borrar que el backend rechaza. Ver `puedeEliminarOpcion`.
   */
  const conteos = useMemo(() => {
    const metrics = metricsQuery.data;
    if (!metrics || metrics.suprimido) return undefined;

    const mapa = new Map<string, number>();
    for (const pregunta of metrics.preguntas) {
      for (const opcion of pregunta.opciones) {
        mapa.set(opcion.optionId, opcion.conteo);
      }
    }
    return mapa;
  }, [metricsQuery.data]);

  const publishMutation = usePublishSurveyCampaign();
  const closeMutation = useCloseSurveyCampaign();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" aria-hidden="true" />
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-xl font-semibold text-primary-800">No encontramos esta encuesta</h2>
        <Button variant="link" onClick={() => navigate(ROUTES.SURVEY_ADMIN)}>
          Volver al listado
        </Button>
      </div>
    );
  }

  const publicar = puedePublicarCampania(campaign);
  const cerrar = puedeCerrarCampania(campaign);
  const requisitos = requisitosPublicacion(campaign);
  const respuestas = respuestasDe(campaign);
  const gestiona = puede('SURVEY_MANAGE');

  const abre = fechaCorta(campaign.abreEn);
  const cierra = fechaCorta(campaign.cierraEn);

  const confirmar = async () => {
    try {
      if (confirmando === 'publicar') await publishMutation.mutateAsync(campaign.id);
      if (confirmando === 'cerrar') await closeMutation.mutateAsync(campaign.id);
      setConfirmando(null);
    } catch (error) {
      logError('SurveyCampaignPage.confirmar', error);
    }
  };

  return (
    <div className="animate-fade-in max-w-5xl space-y-6">
      <Breadcrumbs
        items={[{ label: 'Encuesta', path: ROUTES.SURVEY_ADMIN }, { label: campaign.titulo }]}
      />

      {/* ---------- Encabezado ---------- */}
      <div className="rounded-xl border border-primary-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700">
                <HeartPulse className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
              <h1 className="text-xl font-bold text-primary-900">{campaign.titulo}</h1>
              <SurveyCampaignStatusBadge status={campaign.status} />
            </div>
            <p className="mt-2 text-sm text-primary-600">
              {SURVEY_STATUS_AYUDA[campaign.status]}
            </p>
          </div>

          {gestiona && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setEditandoDatos(true)}
              >
                <Pencil className="h-4 w-4" />
                Editar datos
              </Button>

              {/* Publicar y cerrar son las dos transiciones reales. El botón
                  que no corresponde no se esconde: se deshabilita con el
                  motivo, porque "¿por qué no puedo publicar?" es exactamente
                  la pregunta que hay que responder en pantalla. */}
              <Button
                className="gap-2"
                disabled={!publicar.permitido || publishMutation.isPending}
                title={publicar.motivo}
                onClick={() => setConfirmando('publicar')}
              >
                {publishMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publicar
              </Button>

              <Button
                variant="outline"
                className="gap-2"
                disabled={!cerrar.permitido || closeMutation.isPending}
                title={cerrar.motivo}
                onClick={() => setConfirmando('cerrar')}
              >
                <Lock className="h-4 w-4" />
                Cerrar
              </Button>
            </div>
          )}
        </div>

        <dl className="mt-4 grid gap-3 border-t border-primary-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Año" valor={String(campaign.anio)} />
          <Dato etiqueta="Se contesta" valor={SURVEY_WINDOW_LABELS[campaign.ventana]} />
          <Dato
            etiqueta="Etapa"
            valor={campaign.etapa ? STAGE_LABELS[campaign.etapa] : 'Cualquier etapa'}
          />
          <Dato
            etiqueta="Respuestas"
            valor={respuestas.toLocaleString('es-AR')}
            icono={<Users className="h-3.5 w-3.5 text-primary-400" aria-hidden="true" />}
          />
          {/* El dato ausente se omite: sin fechas cargadas no se pinta una
              fila vacía ni un guión, simplemente no está. */}
          {(abre || cierra) && (
            <Dato
              etiqueta="Ventana de respuesta"
              valor={
                abre && cierra
                  ? `Del ${abre} al ${cierra}`
                  : abre
                    ? `Desde el ${abre}`
                    : `Hasta el ${cierra}`
              }
              icono={<CalendarRange className="h-3.5 w-3.5 text-primary-400" aria-hidden="true" />}
            />
          )}
        </dl>

        {campaign.descripcion && (
          <p className="mt-3 whitespace-pre-wrap border-t border-primary-100 pt-3 text-sm text-primary-700">
            {campaign.descripcion}
          </p>
        )}
      </div>

      {/* ---------- Qué falta para publicar ---------- */}
      {gestiona && campaign.status !== SurveyCampaignStatus.CERRADA && publicar.permitido === false && !requisitos.listo && (
        <div className="rounded-xl border border-accent-300 bg-accent-50/70 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-accent-800">
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
            Para poder publicarla falta esto
          </h2>
          <ul className="mt-2 space-y-1.5">
            {requisitos.faltantes.map((falta) => (
              <li key={falta} className="flex items-start gap-2 text-sm text-primary-800">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                {falta}
              </li>
            ))}
          </ul>
        </div>
      )}

      {gestiona && requisitos.listo && publicar.permitido && (
        <p className="flex items-center gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm font-medium text-secondary-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          El cuestionario está listo: cuando la publiques, empieza a recibir respuestas.
        </p>
      )}

      {/* ---------- Cuestionario y tableros ---------- */}
      <Tabs defaultValue="preguntas">
        <TabsList>
          <TabsTrigger value="preguntas" className="gap-1.5">
            <MessageSquareText className="h-4 w-4" />
            Preguntas
          </TabsTrigger>
          <TabsTrigger value="resultados" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Qué contestaron
          </TabsTrigger>
          <TabsTrigger value="participacion" className="gap-1.5">
            <Waypoints className="h-4 w-4" />
            Quiénes contestaron
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preguntas" className="pt-4">
          <SurveyQuestionsEditor campaign={campaign} conteos={conteos} />
        </TabsContent>

        <TabsContent value="resultados" className="pt-4">
          <SurveyMetricsPanel campaignId={campaign.id} flow={flowQuery.data} />
        </TabsContent>

        <TabsContent value="participacion" className="pt-4">
          <SurveyFlowPanel
            flow={flowQuery.data}
            isLoading={flowQuery.isLoading}
            isError={flowQuery.isError}
            onRetry={() => void flowQuery.refetch()}
          />
        </TabsContent>
      </Tabs>

      {/* ---------- Editar los datos generales ---------- */}
      <Dialog open={editandoDatos} onOpenChange={setEditandoDatos}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Editar los datos de la encuesta</DialogTitle>
            <DialogDescription>
              El nombre, el año, el momento y las fechas. Las preguntas se
              editan en la lista de abajo.
            </DialogDescription>
          </DialogHeader>
          <SurveyCampaignForm
            initialData={campaign}
            onCancel={() => setEditandoDatos(false)}
            onSuccess={() => setEditandoDatos(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ---------- Confirmación de publicar / cerrar ---------- */}
      <Dialog open={confirmando !== null} onOpenChange={(v) => !v && setConfirmando(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {confirmando === 'publicar' ? '¿Publicar la encuesta?' : '¿Cerrar la encuesta?'}
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              {confirmando === 'publicar' ? (
                <>
                  Desde que la publiques, cualquier chico que abra el link o
                  escanee el QR va a poder contestarla. Vas a poder seguir
                  corrigiendo el texto de las preguntas, pero conviene revisarlas
                  ahora.
                </>
              ) : (
                <>
                  Deja de recibir respuestas y el cuestionario queda congelado
                  tal como lo contestaron. <strong>No se puede volver a
                  abrir:</strong> si después hace falta preguntar de nuevo, se
                  crea una campaña nueva. Los resultados ya cargados se
                  conservan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmando(null)}>
              Cancelar
            </Button>
            <Button
              className="gap-2"
              disabled={publishMutation.isPending || closeMutation.isPending}
              onClick={() => void confirmar()}
            >
              {(publishMutation.isPending || closeMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {confirmando === 'publicar' ? 'Sí, publicar' : 'Sí, cerrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  icono,
}: {
  etiqueta: string;
  valor: string;
  icono?: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-primary-500">{etiqueta}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-primary-900">
        {icono}
        {valor}
      </dd>
    </div>
  );
}
