// ===========================================
// useSurveyWizard — estado del cuestionario público de la encuesta (S20)
// ===========================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CompetitionStage,
  DisciplineType,
  Sex,
  type SurveyQuestionKind,
  type SurveyCampaignWithQuestions,
  type SurveyQuestionWithOptions,
} from '@/types';
import { useActiveSurvey, useSubmitSurveyResponse } from '@/hooks/useSurvey';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { useAllCategories } from '@/hooks/useCategories';
import { surveySubmissionSchema, type SurveySubmissionValues } from '@/schemas';
import { getFriendlyError, getHttpStatus } from '@/lib/utils';
import { logError } from '@/lib/logger';
import {
  alternarOpcion,
  aRespuestasPayload,
  obligatoriasSinResponder,
  podarRespuestas,
  preguntasVisibles,
  type RespuestasPorPregunta,
} from './surveyAudience';
import {
  borrarBorrador,
  encolarEnvio,
  guardarBorrador,
  leerBorrador,
  leerPendientes,
  marcarIntento,
  quitarPendiente,
  type EnvioPendiente,
} from './surveyDraft';

/** 1: contexto, 2: preguntas, 3: cierre. */
export type SurveyStep = 1 | 2 | 3;

/**
 * Cómo terminó el envío.
 *
 * `encolado` **no es un error**: la respuesta está guardada en el teléfono y se
 * va a mandar sola. Es un final distinto de `confirmado` y la pantalla de
 * cierre lo dice con otras palabras, porque mentirle a alguien diciéndole
 * "listo, gracias" cuando el servidor todavía no recibió nada es exactamente lo
 * que no hay que hacer.
 */
export type ResultadoEnvio = 'pendiente' | 'confirmado' | 'encolado';

interface ContextoEncuesta {
  disciplineId?: string;
  categoryId?: string;
  sexo?: Sex;
  /** Sólo se pide cuando la campaña no fija una etapa (`etapa: null`). */
  etapa?: CompetitionStage;
}

interface SurveyWizardOptions {
  /** Etapa sugerida por la URL, si la difusión la trae en el QR. */
  etapa?: CompetitionStage;
}

/**
 * Toda la máquina del cuestionario: qué se muestra, qué se contestó, qué se
 * guardó y qué pasó con el envío.
 *
 * Vive fuera de la página por el mismo motivo que `useInscriptionWizard`: no
 * tiene nada de layout, y así la lógica de audiencia y de recuperación se puede
 * leer —y verificar— sin montar React.
 */
export function useSurveyWizard({ etapa: etapaSugerida }: SurveyWizardOptions = {}) {
  const consulta = useActiveSurvey(
    etapaSugerida ? { etapa: etapaSugerida } : undefined,
  );
  const campania: SurveyCampaignWithQuestions | null = consulta.data ?? null;

  const { data: disciplinas, isLoading: cargandoDisciplinas } =
    useAllDisciplines({ isActive: true });

  const [step, setStep] = useState<SurveyStep>(1);
  const [contexto, setContexto] = useState<ContextoEncuesta>({});
  const [respuestas, setRespuestas] = useState<RespuestasPorPregunta>({});
  const [resultado, setResultado] = useState<ResultadoEnvio>('pendiente');
  const [pendientes, setPendientes] = useState<EnvioPendiente[]>(() =>
    leerPendientes(),
  );
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);

  const enviar = useSubmitSurveyResponse();

  const { data: categorias } = useAllCategories(
    { disciplineId: contexto.disciplineId },
    { enabled: Boolean(contexto.disciplineId) },
  );

  const disciplinaElegida = useMemo(
    () => disciplinas?.find((d) => d.id === contexto.disciplineId),
    [disciplinas, contexto.disciplineId],
  );

  /**
   * El tipo de disciplina **no se le pregunta a quien responde**: sale de la
   * disciplina que eligió. Preguntar "¿tu deporte es individual o de equipo?" es
   * pedirle que resuelva una clasificación que el catálogo ya tiene, y con
   * chances de que se equivoque y conteste la rama que no le toca.
   */
  const disciplineType: DisciplineType | null = disciplinaElegida?.type ?? null;

  const categoriasDisponibles = useMemo(
    () =>
      (categorias ?? []).filter(
        (categoria) =>
          categoria.disciplineId === contexto.disciplineId && categoria.isActive,
      ),
    [categorias, contexto.disciplineId],
  );

  /** La campaña manda; si no fija etapa, la elige quien responde. */
  const etapaFijadaPorCampania = campania?.etapa ?? null;
  const etapa = etapaFijadaPorCampania ?? contexto.etapa ?? null;

  const visibles = useMemo(
    () => preguntasVisibles(campania?.questions ?? [], disciplineType),
    [campania, disciplineType],
  );

  const faltantes = useMemo(
    () => obligatoriasSinResponder(visibles, respuestas),
    [visibles, respuestas],
  );

  const contestadas = useMemo(
    () =>
      visibles.filter((p) => (respuestas[p.id]?.length ?? 0) > 0).length,
    [visibles, respuestas],
  );

  // ===========================================
  // Borrador: restaurar y guardar
  // ===========================================

  // Restauración, una sola vez por campaña. Se corre cuando llega la campaña
  // porque el borrador se valida contra su `campaignId`: uno de la ventana PRE
  // no puede repoblar el cuestionario de la DURANTE.
  const campaniaRestaurada = useRef<string | null>(null);
  useEffect(() => {
    if (!campania || campaniaRestaurada.current === campania.id) return;
    campaniaRestaurada.current = campania.id;

    const borrador = leerBorrador(campania.id);
    if (!borrador) return;

    setContexto(borrador.contexto);
    setRespuestas(borrador.respuestas);
    setBorradorRestaurado(true);
  }, [campania]);

  // Guardado. Cada cambio escribe: el evento que hay que sobrevivir es que el
  // navegador se cierre sin avisar, y ahí no hay "guardar al salir" que valga.
  useEffect(() => {
    if (!campania) return;
    if (resultado === 'confirmado') return;
    if (Object.keys(respuestas).length === 0 && !contexto.disciplineId) return;

    guardarBorrador(campania.id, contexto, respuestas);
  }, [campania, contexto, respuestas, resultado]);

  // ===========================================
  // Edición
  // ===========================================

  /**
   * Cambiar de disciplina **poda** las respuestas de la rama que ya no aplica.
   *
   * Sin esto, quien empieza en Atletismo, contesta las dos preguntas de
   * deportes individuales y después cambia a Handball, manda respuestas de la
   * rama equivocada: el backend revalida la audiencia y devuelve un 400 que el
   * chico no tiene forma de arreglar, con la encuesta entera ya contestada.
   */
  const elegirDisciplina = useCallback(
    (disciplineId: string) => {
      setContexto((actual) => ({
        ...actual,
        disciplineId,
        // La categoría pertenece a la disciplina anterior: deja de tener sentido.
        categoryId: undefined,
      }));

      const nuevoTipo =
        disciplinas?.find((d) => d.id === disciplineId)?.type ?? null;
      const nuevasVisibles = preguntasVisibles(
        campania?.questions ?? [],
        nuevoTipo,
      );
      setRespuestas((actuales) => podarRespuestas(actuales, nuevasVisibles));
    },
    [campania, disciplinas],
  );

  const elegirCategoria = useCallback((categoryId: string | undefined) => {
    setContexto((actual) => ({ ...actual, categoryId }));
  }, []);

  const elegirSexo = useCallback((sexo: Sex | undefined) => {
    setContexto((actual) => ({ ...actual, sexo }));
  }, []);

  const elegirEtapa = useCallback((etapaElegida: CompetitionStage) => {
    setContexto((actual) => ({ ...actual, etapa: etapaElegida }));
  }, []);

  const responder = useCallback(
    (questionId: string, optionId: string, kind: SurveyQuestionKind) => {
      setRespuestas((actuales) => {
        const elegidas = actuales[questionId] ?? [];
        const siguientes = alternarOpcion(elegidas, optionId, kind);

        if (siguientes.length === 0) {
          // Se saca la clave en vez de dejar un arreglo vacío: así
          // `obligatoriasSinResponder` y el payload no tienen que distinguir
          // entre "sin contestar" y "contestado con nada".
          const { [questionId]: _quitada, ...resto } = actuales;
          return resto;
        }

        return { ...actuales, [questionId]: siguientes };
      });
    },
    [],
  );

  const irAPreguntas = useCallback(() => {
    if (!contexto.disciplineId) {
      toast.error('Elegí tu disciplina para seguir');
      return;
    }
    if (!etapa) {
      toast.error('Contanos en qué etapa estás compitiendo');
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [contexto.disciplineId, etapa]);

  const volverAContexto = useCallback(() => {
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ===========================================
  // Envío
  // ===========================================

  /**
   * Manda un envío ya armado y decide qué hacer con la falla.
   *
   * Los tres finales piden acciones distintas de quien responde, y por eso no
   * hay un `toast.error` genérico:
   *
   *   · **sin status** — la request no llegó a salir: no hay señal. La
   *     respuesta se encola y se reintenta sola. No se pierde nada, y eso es lo
   *     que hay que decirle.
   *   · **429** — el cupo del endpoint (3 por minuto). Ya mandó; esperar un
   *     minuto alcanza. Reintentar solo acá duplicaría una respuesta que quizá
   *     ya entró: el backend no deduplica, por diseño.
   *   · **400/404** — el envío no es consistente con el cuestionario guardado
   *     (la campaña cerró, o el panel editó las preguntas). Reintentar no lo
   *     arregla: hay que volver a pedir el cuestionario.
   */
  const intentarEnviar = useCallback(
    async (
      payload: SurveySubmissionValues,
      opciones: { idEnCola?: string } = {},
    ): Promise<boolean> => {
      try {
        await enviar.mutateAsync(payload);

        if (opciones.idEnCola) {
          setPendientes(quitarPendiente(opciones.idEnCola));
        }
        borrarBorrador();
        setResultado('confirmado');
        setStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
      } catch (error) {
        logError('useSurveyWizard.intentarEnviar', error);
        const status = getHttpStatus(error);

        if (status === null || status === 502 || status === 503) {
          // La request no llegó a procesarse. Tres formas de lo mismo:
          //
          //   · sin status — el navegador no obtuvo respuesta: no hay señal, o
          //     se cortó a mitad;
          //   · 502 / 503 — el proxy contestó por un backend que no estaba.
          //
          // Los dos últimos se encolan igual que el primero porque, para quien
          // responde, es la misma situación y la respuesta **no entró**.
          //
          // El 504 queda deliberadamente afuera: un gateway timeout puede
          // significar que el backend sí la procesó y tardó en contestar.
          // Reintentarlo duplicaría una respuesta —el backend no deduplica, por
          // diseño, porque no guarda identidad— e inflaría la muestra, que es
          // lo único que estas respuestas tienen para dar.
          if (opciones.idEnCola) {
            setPendientes(marcarIntento(opciones.idEnCola));
          } else {
            setPendientes(encolarEnvio(payload));
            setResultado('encolado');
            setStep(3);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          toast.info('Guardamos tus respuestas en este teléfono.', {
            description:
              'Cuando vuelva la señal se mandan solas. No hace falta que las contestes de nuevo.',
          });
          return false;
        }

        if (status === 429) {
          toast.error('Esperá un minuto antes de volver a mandar.', {
            description:
              'Ya recibimos varios envíos desde acá. Es para que nadie pueda cargar respuestas de más.',
          });
          return false;
        }

        if (status === 400 || status === 404) {
          toast.error(
            getFriendlyError(
              error,
              'La encuesta cambió o ya se cerró mientras la estabas contestando.',
            ),
            { description: 'Volvé a cargar la página para ver la versión nueva.' },
          );
          return false;
        }

        toast.error(
          getFriendlyError(error, 'No pudimos mandar tus respuestas.'),
          { description: 'Probá de nuevo en un rato: quedaron guardadas acá.' },
        );
        return false;
      }
    },
    [enviar],
  );

  const construirPayload = useCallback((): SurveySubmissionValues | null => {
    if (!campania || !etapa || !disciplineType) return null;

    const candidato = {
      campaignId: campania.id,
      etapa,
      disciplineType,
      disciplineId: contexto.disciplineId,
      categoryId: contexto.categoryId,
      sexo: contexto.sexo,
      respuestas: aRespuestasPayload(visibles, respuestas),
    };

    // Se parsea en vez de castear: parte de esto vino de `localStorage` y pudo
    // quedar viejo. Un envío inválido detectado acá se puede explicar; uno
    // detectado por el backend llega como un 400 y ya perdimos la respuesta.
    const parseado = surveySubmissionSchema.safeParse(candidato);
    if (!parseado.success) {
      logError('useSurveyWizard.construirPayload', parseado.error);
      return null;
    }

    return parseado.data;
  }, [campania, etapa, disciplineType, contexto, visibles, respuestas]);

  const confirmarEnvio = useCallback(async () => {
    if (faltantes.length > 0) {
      const primera = faltantes[0];
      toast.error('Te falta contestar una pregunta.', {
        description: primera?.texto,
      });
      return;
    }

    const payload = construirPayload();
    if (!payload) {
      toast.error('Faltan datos para mandar la encuesta.', {
        description: 'Revisá la disciplina y la etapa en el primer paso.',
      });
      return;
    }

    await intentarEnviar(payload);
  }, [faltantes, construirPayload, intentarEnviar]);

  /**
   * Reintenta lo que quedó en cola, de lo más viejo a lo más nuevo.
   *
   * Corta en la primera falla de red: si no hay señal para uno, no la hay para
   * el siguiente, y seguir sólo sumaría intentos fallidos.
   */
  const reintentarPendientes = useCallback(async () => {
    for (const pendiente of leerPendientes()) {
      const ok = await intentarEnviar(pendiente.payload, {
        idEnCola: pendiente.id,
      });
      if (!ok) break;
    }
  }, [intentarEnviar]);

  /** Descarta un envío que ya no tiene sentido mandar (campaña cerrada, etc.). */
  const descartarPendiente = useCallback((id: string) => {
    setPendientes(quitarPendiente(id));
  }, []);

  // Reintento automático al volver la conexión. El `ref` evita reenganchar el
  // listener en cada render y quedarse con una versión vieja de la función.
  const reintentarRef = useRef(reintentarPendientes);
  reintentarRef.current = reintentarPendientes;

  useEffect(() => {
    const alVolverLaSenal = () => {
      void reintentarRef.current();
    };
    window.addEventListener('online', alVolverLaSenal);
    return () => window.removeEventListener('online', alVolverLaSenal);
  }, []);

  // Y un intento al abrir: el `online` no dispara si la señal volvió mientras
  // la pestaña estaba cerrada, que es el caso más común —se responde en la
  // cancha y se vuelve a abrir el sitio desde casa—.
  const reintentoInicial = useRef(false);
  useEffect(() => {
    if (reintentoInicial.current) return;
    if (pendientes.length === 0) return;
    reintentoInicial.current = true;
    void reintentarRef.current();
  }, [pendientes.length]);

  return {
    // Datos
    campania,
    cargando: consulta.isLoading || cargandoDisciplinas,
    error: consulta.isError,
    recargar: consulta.refetch,
    disciplinas: disciplinas ?? [],
    categoriasDisponibles,
    visibles,
    // Estado
    step,
    contexto,
    respuestas,
    etapa,
    /** `true` cuando la etapa la decide quien responde (campaña sin etapa). */
    pideEtapa: etapaFijadaPorCampania === null,
    disciplineType,
    faltantes,
    contestadas,
    borradorRestaurado,
    descartarAvisoDeBorrador: () => setBorradorRestaurado(false),
    resultado,
    pendientes,
    enviando: enviar.isPending,
    // Acciones
    elegirDisciplina,
    elegirCategoria,
    elegirSexo,
    elegirEtapa,
    responder,
    irAPreguntas,
    volverAContexto,
    confirmarEnvio,
    reintentarPendientes,
    descartarPendiente,
  };
}

export type SurveyWizard = ReturnType<typeof useSurveyWizard>;

/** Re-export para las pantallas, que sólo necesitan el tipo de la pregunta. */
export type { SurveyQuestionWithOptions };
