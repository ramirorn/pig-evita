// ===========================================
// Reglas del editor de campañas (S20)
// ===========================================
//
// Todo lo que este archivo devuelve es un **espejo en cliente de una regla que
// el backend ya aplica** (`backend/src/modules/survey/survey.service.ts`). No
// reemplaza a esas validaciones: el servidor sigue decidiendo. Lo que evita es
// el modo de falla que importa acá — que Laura escriba un cuestionario entero,
// apriete "Publicar" y se coma un 400 que no sabe cómo arreglar.
//
// El criterio de toda la pantalla: cuando una acción no está disponible, el
// control se **deshabilita y dice por qué**. Esconderlo obliga a adivinar.

import {
  SurveyAudience,
  SurveyCampaignStatus,
  type SurveyCampaign,
  type SurveyCampaignWithQuestions,
  type SurveyQuestionWithOptions,
} from '@/types';

/** Resultado de preguntar "¿se puede hacer esto?" con su explicación. */
export interface Permiso {
  permitido: boolean;
  /** Por qué no. Se muestra tal cual como `title` del control deshabilitado. */
  motivo?: string;
}

const PERMITIDO: Permiso = { permitido: true };

// ===========================================
// Estado de la campaña
// ===========================================

export function estaCerrada(campaign: Pick<SurveyCampaign, 'status'>): boolean {
  return campaign.status === SurveyCampaignStatus.CERRADA;
}

/** Cuántas respuestas lleva la campaña. `_count` puede no venir: se asume 0. */
export function respuestasDe(campaign: Pick<SurveyCampaign, '_count'>): number {
  return campaign._count?.responses ?? 0;
}

/**
 * Una campaña cerrada es el registro de lo que efectivamente se preguntó.
 *
 * Espejo de `rechazarSiEstaCerrada`: el backend responde 409 a cualquier
 * escritura sobre el cuestionario de una campaña cerrada, incluidas las
 * opciones. Acá se apaga la edición entera y se explica.
 */
export function puedeEditarCuestionario(
  campaign: Pick<SurveyCampaign, 'status'>,
): Permiso {
  if (!estaCerrada(campaign)) return PERMITIDO;
  return {
    permitido: false,
    motivo:
      'La campaña está cerrada: el cuestionario quedó congelado tal como lo contestaron. Si hay que cambiar algo, creá una campaña nueva.',
  };
}

/**
 * Espejo de `removeCampaign`: borrar arrastra las respuestas en cascada, así
 * que con respuestas cargadas la salida correcta es cerrar.
 */
export function puedeEliminarCampania(
  campaign: Pick<SurveyCampaign, 'status' | '_count'>,
): Permiso {
  const respuestas = respuestasDe(campaign);
  if (respuestas > 0) {
    return {
      permitido: false,
      motivo: `Ya hay ${respuestas} ${respuestas === 1 ? 'respuesta cargada' : 'respuestas cargadas'} y eliminar la campaña las borraría. Cerrala en vez de eliminarla.`,
    };
  }
  return PERMITIDO;
}

/** Espejo de `closeCampaign`: sólo una campaña activa se cierra. */
export function puedeCerrarCampania(
  campaign: Pick<SurveyCampaign, 'status'>,
): Permiso {
  if (campaign.status === SurveyCampaignStatus.ACTIVA) return PERMITIDO;
  if (estaCerrada(campaign)) {
    return { permitido: false, motivo: 'La campaña ya está cerrada.' };
  }
  return {
    permitido: false,
    motivo:
      'Todavía es un borrador: no hay nada que cerrar. Un borrador se elimina.',
  };
}

// ===========================================
// Publicación
// ===========================================

/** Qué falta para poder publicar. Vacío = se puede publicar. */
export interface RequisitosPublicacion {
  /** Textos en segunda persona, listos para mostrar como checklist. */
  faltantes: string[];
  listo: boolean;
}

/**
 * Espejo de `publishCampaign`: ≥1 pregunta activa y ninguna activa sin opciones.
 *
 * Se devuelve la lista completa de lo que falta, no el primer problema: el
 * backend corta en el primero y obliga a publicar, fallar, corregir, publicar,
 * fallar. Acá se ve todo junto antes de tocar el botón.
 */
export function requisitosPublicacion(
  campaign: SurveyCampaignWithQuestions,
): RequisitosPublicacion {
  const faltantes: string[] = [];
  const activas = campaign.questions.filter((q) => q.activa);

  if (activas.length === 0) {
    faltantes.push(
      'Agregá al menos una pregunta activa: hoy la encuesta no tiene nada que preguntar.',
    );
  }

  // `options` es opcional en `SurveyQuestion` (el listado no lo trae) y el
  // detalle sí lo incluye; se normaliza acá en vez de afirmar que está.
  const sinOpciones = activas.filter((q) => (q.options ?? []).length === 0);
  for (const pregunta of sinOpciones) {
    faltantes.push(
      `La pregunta "${pregunta.texto}" no tiene opciones para elegir: nadie podría contestarla.`,
    );
  }

  return { faltantes, listo: faltantes.length === 0 };
}

/**
 * Espejo de la transición BORRADOR → ACTIVA, con los requisitos ya evaluados.
 */
export function puedePublicarCampania(
  campaign: SurveyCampaignWithQuestions,
): Permiso {
  if (estaCerrada(campaign)) {
    return {
      permitido: false,
      motivo: 'Una campaña cerrada no se vuelve a activar.',
    };
  }
  if (campaign.status === SurveyCampaignStatus.ACTIVA) {
    return { permitido: false, motivo: 'La campaña ya está publicada.' };
  }

  const requisitos = requisitosPublicacion(campaign);
  if (!requisitos.listo) {
    return {
      permitido: false,
      motivo: `Falta resolver ${requisitos.faltantes.length} ${requisitos.faltantes.length === 1 ? 'cosa' : 'cosas'} antes de publicar.`,
    };
  }

  return PERMITIDO;
}

// ===========================================
// Preguntas
// ===========================================

/**
 * Espejo de `removeQuestion`: con respuestas cargadas, borrar una pregunta
 * borraría en cascada lo que ya contestaron. El camino correcto es desactivarla.
 */
export function puedeEliminarPregunta(
  campaign: Pick<SurveyCampaign, 'status' | '_count'>,
): Permiso {
  const cerrada = puedeEditarCuestionario(campaign);
  if (!cerrada.permitido) return cerrada;

  const respuestas = respuestasDe(campaign);
  if (respuestas > 0) {
    return {
      permitido: false,
      motivo:
        'La campaña ya tiene respuestas. Desactivá la pregunta para que deje de mostrarse: así no se pierde lo que ya contestaron.',
    };
  }
  return PERMITIDO;
}

// ===========================================
// Opciones
// ===========================================

/**
 * Cuántas veces se eligió cada opción, sacado de las métricas sin filtrar.
 *
 * `undefined` significa **no lo sabemos**, y no es lo mismo que cero: cuando la
 * campaña tiene menos respuestas que el umbral de k-anonimato, el backend
 * suprime el desglose entero y no hay forma legítima de saber si una opción ya
 * fue elegida. Ver `puedeEliminarOpcion`.
 */
export type ConteosPorOpcion = Map<string, number> | undefined;

/**
 * Espejo de `removeOption`: una opción ya elegida no se borra, porque borrarla
 * se llevaría las respuestas que la eligieron.
 *
 * El caso interesante es el tercero: la campaña tiene respuestas pero son menos
 * que el umbral, así que las métricas vienen suprimidas y el conteo por opción
 * no existe. Ahí **no se adivina**: se deshabilita el borrado diciendo que no se
 * puede saber. Suponer "0 respuestas" ofrecería un botón que el backend rechaza,
 * y suponer "ya la eligieron" sería mentir.
 */
export function puedeEliminarOpcion(
  campaign: Pick<SurveyCampaign, 'status' | '_count'>,
  optionId: string,
  conteos: ConteosPorOpcion,
): Permiso {
  const cerrada = puedeEditarCuestionario(campaign);
  if (!cerrada.permitido) return cerrada;

  if (respuestasDe(campaign) === 0) return PERMITIDO;

  if (conteos === undefined) {
    return {
      permitido: false,
      motivo:
        'La campaña ya tiene respuestas, pero son muy pocas para publicar el detalle por opción: no se puede saber si alguien ya eligió ésta. Reescribí el texto en vez de borrarla.',
    };
  }

  const elegida = conteos.get(optionId) ?? 0;
  if (elegida > 0) {
    return {
      permitido: false,
      motivo:
        'Alguien ya eligió esta opción: borrarla borraría esas respuestas. Podés reescribir el texto, que no afecta lo ya recolectado.',
    };
  }

  return PERMITIDO;
}

/**
 * Espejo de `updateOption`: el `texto` se reescribe siempre; el identificador
 * interno (`valor`) queda congelado apenas entra la primera respuesta, porque
 * es la clave con la que se agregan las métricas históricas.
 */
export function puedeEditarValorDeOpcion(
  campaign: Pick<SurveyCampaign, 'status' | '_count'>,
): Permiso {
  const cerrada = puedeEditarCuestionario(campaign);
  if (!cerrada.permitido) return cerrada;

  if (respuestasDe(campaign) > 0) {
    return {
      permitido: false,
      motivo:
        'El identificador interno es la clave con la que se suman las respuestas ya recolectadas: cambiarlo renombraría hacia atrás lo que contestaron. El texto que se lee en pantalla sí se puede cambiar.',
    };
  }
  return PERMITIDO;
}

// ===========================================
// Identificador interno (`valor`)
// ===========================================

/**
 * Convierte el texto de una opción en el slug snake_case que espera el backend.
 *
 * Existe para que Laura **nunca tenga que escribir un slug**: ella redacta "No
 * sé qué es" y esto produce `no_se_que_es`. La pantalla lo muestra como dato
 * secundario, no como un campo a completar.
 */
export function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    // Marcas diacríticas: saca los acentos dejando la letra base.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/**
 * Slug único dentro de una pregunta.
 *
 * El backend tiene `@@unique([questionId, valor])` y responde 409: dos opciones
 * que slugifican igual ("Sí" y "Si") se resuelven con un sufijo en vez de con
 * un error que Laura no puede interpretar. Si el texto no deja ninguna letra
 * —una opción que es sólo un emoji— cae en `opcion_N`, que sigue siendo estable.
 */
export function valorUnico(texto: string, usados: Iterable<string>): string {
  const ocupados = new Set(usados);
  const base = slugificar(texto) || 'opcion';

  if (!ocupados.has(base)) return base;

  let sufijo = 2;
  while (ocupados.has(`${base}_${sufijo}`)) sufijo += 1;
  return `${base}_${sufijo}`;
}

/** Los `valor` ya usados en una pregunta, para no repetirlos. */
export function valoresDe(pregunta: SurveyQuestionWithOptions): string[] {
  return pregunta.options.map((o) => o.valor);
}

// ===========================================
// Balance de audiencias
// ===========================================

/**
 * Cuántas preguntas ve cada deportista según su rama.
 *
 * El diseño previsto del cuestionario es 6 comunes + 2 por rama = 8 por
 * deportista. Sin esta cuenta a la vista, el desbalance no se nota hasta que
 * alguien compara dos celulares: es la única forma de que Laura vea que los de
 * deportes de equipo están contestando doce preguntas y los de individuales
 * siete.
 *
 * Sólo cuenta las **activas**: una pregunta desactivada no la ve nadie.
 */
export interface BalanceAudiencias {
  todos: number;
  individual: number;
  equipo: number;
  /** Lo que ve, en total, quien compite en un deporte individual. */
  totalIndividual: number;
  /** Lo que ve, en total, quien compite en un deporte de equipo. */
  totalEquipo: number;
  /** Las dos ramas no ven la misma cantidad de preguntas. */
  desbalanceado: boolean;
}

export function balanceAudiencias(
  questions: readonly SurveyQuestionWithOptions[],
): BalanceAudiencias {
  const activas = questions.filter((q) => q.activa);
  const contar = (audiencia: SurveyAudience) =>
    activas.filter((q) => q.audiencia === audiencia).length;

  const todos = contar(SurveyAudience.TODOS);
  const individual = contar(SurveyAudience.INDIVIDUAL);
  const equipo = contar(SurveyAudience.EQUIPO);

  return {
    todos,
    individual,
    equipo,
    totalIndividual: todos + individual,
    totalEquipo: todos + equipo,
    desbalanceado: individual !== equipo,
  };
}

// ===========================================
// Textos que comparten pantalla y componentes
// ===========================================
//
// Viven acá, con las reglas, y no en los componentes que los pintan: un archivo
// que exporta componentes **y** constantes rompe el Fast Refresh de Vite
// (`react(only-export-components)`), y el proyecto trata esos warnings como
// ruido a no agregar.

/** Por qué no se publica un número. Es el texto que lee Laura, no una nota técnica. */
export function textoSupresion(umbral: number): string {
  return `Este dato no se muestra porque hay menos de ${umbral} respuestas en este cruce. Quienes contestan son menores de edad: con tan pocas respuestas, cruzar disciplina, localidad y etapa alcanza para darse cuenta de quién contestó qué.`;
}

/** Qué significa cada estado de campaña, en una línea y sin jerga. */
export const SURVEY_STATUS_AYUDA: Record<SurveyCampaignStatus, string> = {
  [SurveyCampaignStatus.BORRADOR]:
    'Todavía no la ve nadie. Podés escribir y cambiar todo lo que quieras.',
  [SurveyCampaignStatus.ACTIVA]: 'Está recibiendo respuestas ahora mismo.',
  [SurveyCampaignStatus.CERRADA]:
    'Ya no recibe respuestas y el cuestionario quedó congelado.',
};
