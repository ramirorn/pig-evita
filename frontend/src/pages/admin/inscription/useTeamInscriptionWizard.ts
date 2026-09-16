// ===========================================
// useTeamInscriptionWizard — estado del alta de plantel completo
// ===========================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DisciplineType, type TeamInscriptionResult } from '@/types';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import { useAllCategories } from '@/hooks/useCategories';
import { useCreateTeamInscription } from '@/hooks/useInscriptions';
import { teamInscriptionSchema, type TeamMemberValues } from '@/schemas';
import { getFriendlyError } from '@/lib/utils';
import { logError } from '@/lib/logger';
import {
  aPayloadPlantel,
  aplicarIntegrante,
  contarPlantel,
  extraerDnisEnConflicto,
  leerPlantelRequerido,
  plantelCompleto,
  plantelSinConfigurar,
  quitarIntegrante,
  validarIntegrante,
  type RosterMember,
} from './rosterModel';
import {
  borrarBorradorPlantel,
  guardarBorradorPlantel,
  leerBorradorPlantel,
} from './rosterDraft';

/** 1: Disciplina y categoría, 2: Plantel, 3: Confirmación, 4: Credenciales. */
export type TeamWizardStep = 1 | 2 | 3 | 4;

interface DatosEquipoForm {
  teamName: string;
  locality: string;
  department: string;
}

const EQUIPO_VACIO: DatosEquipoForm = {
  teamName: '',
  locality: '',
  department: 'Formosa',
};

/**
 * La máquina de estados de la inscripción por plantel.
 *
 * El orden invierte al asistente viejo a propósito: **primero la disciplina y
 * la categoría**, después las personas. No es una preferencia estética —es lo
 * único que permite decirle al encargado "esto necesita 11 titulares y hasta 5
 * suplentes" antes de que empiece a cargar, y detectar en el paso 1 que la
 * disciplina no tiene el plantel configurado, en vez de cosecharlo como un 400
 * cuando ya cargó a 16 chicos.
 *
 * El hook también cubre la rama `INDIVIDUAL`: en ese caso se queda con la
 * selección hecha y la página delega los pasos de la persona en el asistente
 * que ya existía (`useInscriptionWizard`), sin duplicar `StepPersonalData`.
 */
export function useTeamInscriptionWizard() {
  const [paso, setPaso] = useState<TeamWizardStep>(1);
  const [disciplineId, setDisciplineId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [equipo, setEquipo] = useState<DatosEquipoForm>(EQUIPO_VACIO);
  const [integrantes, setIntegrantes] = useState<RosterMember[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<TeamInscriptionResult | null>(null);

  /** Integrantes que el backend (o la revalidación previa al envío) rechazó. */
  const [idsConProblema, setIdsConProblema] = useState<string[]>([]);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const [borradorRestaurado, setBorradorRestaurado] = useState(false);
  const [storageDisponible, setStorageDisponible] = useState(true);

  const { data: disciplines, isLoading: loadingDisciplines } = useAllDisciplines();
  const { data: categories, isLoading: loadingCategories } = useAllCategories(
    { disciplineId },
    { enabled: Boolean(disciplineId) },
  );
  const createTeamMutation = useCreateTeamInscription();

  const selectedDiscipline = useMemo(
    () => disciplines?.find((discipline) => discipline.id === disciplineId),
    [disciplines, disciplineId],
  );

  const availableCategories = useMemo(() => {
    if (!disciplineId || !categories) return [];
    return categories.filter(
      (categoria) => categoria.disciplineId === disciplineId && categoria.isActive,
    );
  }, [disciplineId, categories]);

  const selectedCategory = useMemo(
    () => categories?.find((categoria) => categoria.id === categoryId),
    [categories, categoryId],
  );

  const esIndividual = selectedDiscipline?.type === DisciplineType.INDIVIDUAL;
  const plantelRequerido = useMemo(
    () => leerPlantelRequerido(selectedDiscipline),
    [selectedDiscipline],
  );
  const faltaConfigurarPlantel = plantelSinConfigurar(selectedDiscipline);

  const conteo = useMemo(() => contarPlantel(integrantes), [integrantes]);
  const completo = plantelRequerido ? plantelCompleto(integrantes, plantelRequerido) : false;

  // ===========================================
  // Borrador: restaurar al entrar
  // ===========================================
  //
  // Corre una sola vez, al montar. Si había un plantel a medio cargar, se
  // vuelve directo al paso 2 con todo puesto: la selección de disciplina y
  // categoría también estaba guardada, así que no hay que rehacerla.
  const yaRestauro = useRef(false);
  useEffect(() => {
    if (yaRestauro.current) return;
    yaRestauro.current = true;

    const borrador = leerBorradorPlantel();
    if (!borrador) return;

    setDisciplineId(borrador.disciplineId);
    setCategoryId(borrador.categoryId);
    setEquipo({
      teamName: borrador.teamName,
      locality: borrador.locality,
      department: borrador.department,
    });
    setIntegrantes(borrador.members);
    setPaso(2);
    setBorradorRestaurado(true);
  }, []);

  // ===========================================
  // Borrador: guardar en cada cambio
  // ===========================================
  //
  // Se guarda mientras se arma (pasos 2 y 3) y deja de guardarse en cuanto el
  // servidor confirmó. Nunca se borra desde acá en un camino de error: el
  // borrado vive sólo en el `onSuccess` del envío y en "descartar".
  useEffect(() => {
    if (paso >= 4) return;
    if (!disciplineId || !categoryId) return;

    const guardado = guardarBorradorPlantel(
      { disciplineId, categoryId, ...equipo },
      integrantes,
    );
    if (!guardado) setStorageDisponible(false);
  }, [paso, disciplineId, categoryId, equipo, integrantes]);

  const irAPaso = useCallback((siguiente: TeamWizardStep) => {
    setPaso(siguiente);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ===========================================
  // Paso 1 — disciplina y categoría
  // ===========================================

  const elegirDisciplina = useCallback(
    (id: string) => {
      setDisciplineId(id);
      // La categoría vieja pertenece a otra disciplina, y el plantel cargado
      // fue validado contra ella: cambiar de deporte invalida las dos cosas.
      setCategoryId('');
      if (integrantes.length > 0) {
        setIntegrantes([]);
        setIdsConProblema([]);
        toast.info('Cambiaste de disciplina: el plantel que habías empezado se descartó.');
      }
    },
    [integrantes.length],
  );

  const elegirCategoria = useCallback(
    (id: string) => {
      setCategoryId(id);
      // El aviso va acá y no dentro del updater de `setIntegrantes`: React puede
      // llamar dos veces a un updater (StrictMode), y el toast saldría duplicado.
      if (integrantes.length > 0) {
        setIntegrantes([]);
        setIdsConProblema([]);
        toast.info('Cambiaste de categoría: el plantel que habías empezado se descartó.');
      }
    },
    [integrantes.length],
  );

  /**
   * Avanza del paso 1. Acá es donde se corta el camino de la disciplina sin
   * plantel configurado: el encargado se entera **antes** de cargar a nadie.
   */
  const confirmarSeleccion = useCallback(() => {
    if (!disciplineId) {
      toast.error('Elegí una disciplina para seguir');
      return;
    }
    if (!categoryId) {
      toast.error('Elegí una categoría para seguir');
      return;
    }
    if (faltaConfigurarPlantel) {
      toast.error('Esta disciplina todavía no tiene definido su plantel. Configuralo en Disciplinas.');
      return;
    }
    irAPaso(2);
  }, [disciplineId, categoryId, faltaConfigurarPlantel, irAPaso]);

  const volverASeleccion = useCallback(() => irAPaso(1), [irAPaso]);

  // ===========================================
  // Paso 2 — carga del plantel
  // ===========================================

  /**
   * Agrega o reemplaza un integrante. Devuelve `null` si entró, o el motivo del
   * rechazo si no.
   *
   * Devuelve el texto en vez de mostrarlo porque el lugar donde ese mensaje
   * sirve es **pegado al formulario**, fijo, mientras se corrige el campo. Un
   * toast que se va a los cuatro segundos obliga a acordarse de qué decía.
   */
  const agregarIntegrante = useCallback(
    (valores: TeamMemberValues): string | null => {
      if (!selectedCategory || !plantelRequerido) {
        return 'Todavía no se terminó de cargar la categoría. Esperá un segundo y probá de nuevo.';
      }

      const resultadoValidacion = validarIntegrante({
        valores,
        integrantes,
        categoria: selectedCategory,
        requerido: plantelRequerido,
        editandoId: editandoId ?? undefined,
      });

      if (!resultadoValidacion.ok) return resultadoValidacion.mensaje;

      const siguiente = aplicarIntegrante(
        integrantes,
        resultadoValidacion.integrante,
        editandoId ?? undefined,
      );
      setIntegrantes(siguiente);
      // Una ficha corregida deja de estar marcada: el conflicto que reportó el
      // backend era sobre los datos viejos.
      setIdsConProblema((ids) => ids.filter((id) => id !== resultadoValidacion.integrante.id));
      setEditandoId(null);
      return null;
    },
    [selectedCategory, plantelRequerido, integrantes, editandoId],
  );

  const iniciarEdicion = useCallback((id: string) => setEditandoId(id), []);
  const cancelarEdicion = useCallback(() => setEditandoId(null), []);

  const eliminarIntegrante = useCallback(
    (id: string) => {
      setIntegrantes((actuales) => quitarIntegrante(actuales, id));
      setIdsConProblema((ids) => ids.filter((otro) => otro !== id));
      if (editandoId === id) setEditandoId(null);
    },
    [editandoId],
  );

  const irAConfirmacion = useCallback(() => {
    if (!plantelRequerido) return;
    if (!completo) {
      toast.error(
        `Faltan titulares: cargaste ${conteo.titulares} de ${plantelRequerido.titulares}.`,
      );
      return;
    }
    if (!equipo.teamName.trim()) {
      toast.error('Poné el nombre del equipo antes de confirmar');
      return;
    }
    setEditandoId(null);
    irAPaso(3);
  }, [plantelRequerido, completo, conteo.titulares, equipo.teamName, irAPaso]);

  const volverAlPlantel = useCallback(() => irAPaso(2), [irAPaso]);

  // ===========================================
  // Paso 3 — envío
  // ===========================================

  const enviarPlantel = useCallback(async () => {
    setErrorEnvio(null);
    setIdsConProblema([]);

    // Última pasada de las reglas duras antes de gastar el request. Importa
    // sobre todo para un plantel restaurado de un borrador viejo: el borrador
    // se guarda con forma laxa a propósito (ver `rosterDraft.ts`), así que es
    // acá donde se revalida cada ficha contra el schema real.
    const validacion = teamInscriptionSchema.safeParse({
      disciplineId,
      categoryId,
      ...equipo,
      members: integrantes,
    });

    if (!validacion.success) {
      const problema = validacion.error.issues[0];
      const indice = problema?.path[0] === 'members' ? problema.path[1] : undefined;
      const conProblema =
        typeof indice === 'number' ? integrantes[indice] : undefined;

      if (conProblema) {
        setIdsConProblema([conProblema.id]);
        setErrorEnvio(
          `${conProblema.firstName} ${conProblema.lastName}: ${problema?.message ?? 'revisá los datos'}`,
        );
      } else {
        setErrorEnvio(problema?.message ?? 'Revisá los datos del equipo');
      }
      irAPaso(2);
      return;
    }

    try {
      const respuesta = await createTeamMutation.mutateAsync(
        aPayloadPlantel({ disciplineId, categoryId, ...equipo }, integrantes),
      );

      // Recién acá se borra: el plantel ya existe del lado del servidor.
      borrarBorradorPlantel();
      setResultado(respuesta);
      irAPaso(4);
      toast.success(`Se inscribieron ${integrantes.length} integrantes del plantel`);
    } catch (error) {
      logError('useTeamInscriptionWizard.enviarPlantel', error);

      // El plantel NO se toca. El endpoint es transaccional: no se creó nada,
      // y lo que hay en pantalla es exactamente lo que hay que corregir y
      // reintentar, sin recargar ni volver a cargar a nadie.
      const dnis = extraerDnisEnConflicto(error, integrantes);
      const mensaje = getFriendlyError(error, 'No se pudo inscribir el plantel. Intentá de nuevo.');
      setErrorEnvio(mensaje);

      if (dnis.length > 0) {
        setIdsConProblema(
          integrantes
            .filter((integrante) => dnis.includes(integrante.dni.trim()))
            .map((integrante) => integrante.id),
        );
        // Sin toast: el mensaje va pegado a la persona, en la lista.
        irAPaso(2);
        return;
      }

      toast.error(mensaje);
    }
  }, [disciplineId, categoryId, equipo, integrantes, createTeamMutation, irAPaso]);

  // ===========================================
  // Reinicios
  // ===========================================

  const limpiarTodo = useCallback(() => {
    borrarBorradorPlantel();
    setDisciplineId('');
    setCategoryId('');
    setEquipo(EQUIPO_VACIO);
    setIntegrantes([]);
    setEditandoId(null);
    setIdsConProblema([]);
    setErrorEnvio(null);
    setResultado(null);
    setBorradorRestaurado(false);
    setPaso(1);
  }, []);

  /** "Descartar el borrador recuperado y empezar de cero." */
  const descartarBorrador = useCallback(() => {
    limpiarTodo();
    toast.success('Se descartó el plantel guardado');
  }, [limpiarTodo]);

  return {
    paso,
    // Selección
    disciplineId,
    categoryId,
    disciplines,
    availableCategories,
    selectedDiscipline,
    selectedCategory,
    loadingDisciplines,
    loadingCategories,
    esIndividual,
    plantelRequerido,
    faltaConfigurarPlantel,
    elegirDisciplina,
    elegirCategoria,
    confirmarSeleccion,
    volverASeleccion,
    // Equipo
    equipo,
    setEquipo,
    // Plantel
    integrantes,
    conteo,
    completo,
    editandoId,
    idsConProblema,
    agregarIntegrante,
    iniciarEdicion,
    cancelarEdicion,
    eliminarIntegrante,
    irAConfirmacion,
    volverAlPlantel,
    // Envío
    errorEnvio,
    enviarPlantel,
    isSubmitting: createTeamMutation.isPending,
    resultado,
    // Borrador
    borradorRestaurado,
    storageDisponible,
    descartarBorrador,
    limpiarTodo,
  };
}

export type TeamInscriptionWizard = ReturnType<typeof useTeamInscriptionWizard>;
