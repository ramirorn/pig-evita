// ===========================================
// Schemas de la encuesta (S20)
// ===========================================
import { z } from 'zod';
import { Sex, DisciplineType, CompetitionStage, SurveyAudience, SurveyQuestionKind, SurveyWindow } from '@/types';
import { MAX_TEXTO_LARGO, textoObligatorio, nullishAVacio, textoOpcional, fechaOpcional } from './_helpers';

// ==========================================
// Survey Schemas (S20)
// ==========================================
//
// Mismo criterio que el resto del archivo: el backend es la autoridad
// (`SubmitSurveyResponseDto` revalida todo, incluida la audiencia de cada
// pregunta contra el tipo de disciplina). Estos schemas existen para dos cosas
// concretas:
//
//   1. frenar un envío inválido antes de gastar un request —que en este
//      formulario no es sólo cortesía: quien responde está en una cancha con
//      mala señal y cada request que se pierde puede costar la respuesta—; y
//   2. **validar lo que vuelve de `localStorage`**. El borrador y la cola de
//      envíos pendientes son texto que escribió una sesión anterior, con otra
//      versión del formulario o de otra campaña. Se parsea, no se castea.

/** Máximo de opciones por respuesta (`ArrayMaxSize(30)` en el DTO). */
const MAX_OPCIONES_POR_RESPUESTA = 30;

/** Máximo de preguntas por envío (`ArrayMaxSize(100)` en el DTO). */
const MAX_RESPUESTAS_POR_ENVIO = 100;

/**
 * Contexto que se pide antes del cuestionario.
 *
 * La disciplina es el único campo obligatorio, y no por burocracia: de ella
 * sale el `disciplineType` que decide qué preguntas se muestran. Los otros tres
 * son cortes demográficos gruesos y quedan opcionales a propósito — pedir más
 * datos de los necesarios a alguien que ya está dudando si la encuesta es
 * anónima es la forma más rápida de perder la respuesta.
 *
 * ⚠️ No hay ni puede haber nombre, DNI, mail ni teléfono.
 */
export const surveyContextSchema = z.object({
  disciplineId: z.string().uuid('Elegí tu disciplina'),
  categoryId: z.string().uuid('Categoría inválida').optional(),
  localityId: z.string().uuid('Localidad inválida').optional(),
  sexo: z.nativeEnum(Sex).optional(),
  /**
   * Sólo la elige quien responde cuando la campaña activa **no** fija etapa
   * (`etapa: null` = sirve para cualquiera). Cuando la fija, manda la campaña.
   *
   * Está en el schema del contexto y no sólo en el del envío porque también
   * forma parte del borrador: sin esto, Zod la descartaba al restaurar y quien
   * volvía a entrar se encontraba el selector de etapa otra vez en blanco.
   */
  etapa: z.nativeEnum(CompetitionStage).optional(),
});

export type SurveyContextValues = z.infer<typeof surveyContextSchema>;

export const surveyAnswerSchema = z.object({
  questionId: z.string().uuid(),
  optionIds: z
    .array(z.string().uuid())
    .min(1, 'Elegí al menos una opción')
    .max(MAX_OPCIONES_POR_RESPUESTA),
});

/**
 * Envío completo, espejo de `SubmitSurveyResponseDto`.
 *
 * Es también el schema con el que se vuelve a leer un envío que quedó en cola
 * porque se cayó la señal: si el JSON guardado no cumple esto, se descarta en
 * vez de mandarse y cosechar un 400 que el usuario no puede accionar.
 */
export const surveySubmissionSchema = z.object({
  campaignId: z.string().uuid(),
  etapa: z.nativeEnum(CompetitionStage),
  disciplineType: z.nativeEnum(DisciplineType),
  disciplineId: z.string().uuid().optional(),
  localityId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  sexo: z.nativeEnum(Sex).optional(),
  respuestas: z
    .array(surveyAnswerSchema)
    .min(1, 'Contestá al menos una pregunta')
    .max(MAX_RESPUESTAS_POR_ENVIO),
});

export type SurveySubmissionValues = z.infer<typeof surveySubmissionSchema>;

// ==========================================
// Survey Admin Schemas (S20)
// ==========================================
//
// Los de arriba son los del formulario público (lo que **responde** un chico).
// Estos son los del panel: lo que **redacta** la psicóloga. Mismo criterio de
// siempre — el backend es la autoridad (`survey.service.ts` revalida todo) y
// esto existe para que el error se vea antes de gastar un request.
//
// Hay una regla del backend que acá NO se modela y es a propósito: el `status`
// de una campaña no se manda nunca por este formulario. Publicar y cerrar son
// endpoints propios (`publish`/`close`) que validan las transiciones, así que
// `surveyCampaignSchema` ni siquiera tiene el campo: lo que no está en el
// formulario no se puede mandar por accidente.

/** Título de campaña: entra completo en la fila del listado. */
const MAX_TITULO_CAMPANIA = 150;

/** Enunciado de una pregunta. Lo lee un chico en un celular: si no entra en un párrafo, es dos preguntas. */
const MAX_TEXTO_PREGUNTA = 300;

/** Aclaración corta debajo del enunciado. */
const MAX_AYUDA_PREGUNTA = 300;

/** Texto de una opción de respuesta. */
const MAX_TEXTO_OPCION = 150;

/**
 * Identificador interno de una opción (`valor`). El backend lo guarda como
 * slug snake_case y es la clave con la que se agregan las métricas históricas.
 */
const MAX_VALOR_OPCION = 60;

/** Mínimo de opciones para que una pregunta sea contestable. */
export const MIN_OPCIONES_POR_PREGUNTA = 2;

/**
 * Máximo de opciones por pregunta.
 *
 * No sale del backend (que no pone techo): sale de la pantalla en la que se
 * contesta. Más de diez opciones en un celular es una lista que se scrollea y
 * que nadie lee entera.
 */
export const MAX_OPCIONES_POR_PREGUNTA = 10;

/** La primera edición de los Juegos con sistema; antes de eso no hay campaña posible. */
const ANIO_MINIMO_CAMPANIA = 2020;

/** Techo defensivo contra el tipeo (`20226`), no una regla de dominio. */
const anioMaximoCampania = () => new Date().getFullYear() + 5;

/**
 * Valor centinela del selector de etapa.
 *
 * Radix Select no admite `''` como valor de ítem, así que "cualquier etapa"
 * —que en el backend es `etapa: null`— se representa con esta constante y se
 * traduce en el submit. Es el mismo patrón que ya usa `calendarEventSchema`.
 */
export const SURVEY_ETAPA_CUALQUIERA = 'none';

export const surveyCampaignSchema = z
  .object({
    titulo: textoObligatorio(
      3,
      MAX_TITULO_CAMPANIA,
      'Poné un título que después te permita reconocer la campaña',
      'El título',
    ),
    // `descripcion` es `@db.Text`: sin límite de columna.
    descripcion: textoOpcional(MAX_TEXTO_LARGO, 'La descripción'),
    anio: z
      .number({ message: 'Indicá el año de la edición' })
      .int('El año tiene que ser un número entero')
      .min(ANIO_MINIMO_CAMPANIA, `El año no puede ser anterior a ${ANIO_MINIMO_CAMPANIA}`)
      .refine(
        (valor) => valor <= anioMaximoCampania(),
        `Revisá el año: no puede ser posterior a ${anioMaximoCampania()}`,
      ),
    ventana: z.nativeEnum(SurveyWindow, { message: 'Elegí en qué momento se responde' }),
    etapa: z
      .union([z.nativeEnum(CompetitionStage), z.literal(SURVEY_ETAPA_CUALQUIERA)])
      .default(SURVEY_ETAPA_CUALQUIERA),
    abreEn: fechaOpcional('La fecha de apertura no existe en el calendario. Revisá el día y el mes.'),
    cierraEn: fechaOpcional('La fecha de cierre no existe en el calendario. Revisá el día y el mes.'),
  })
  // Espejo de `validarVentanaTemporal` del service, que responde 400. Las dos
  // cadenas son `YYYY-MM-DD`, así que comparar texto ordena igual que comparar
  // fechas y no hay husos horarios de por medio.
  .refine((data) => !data.abreEn || !data.cierraEn || data.cierraEn > data.abreEn, {
    message: 'La fecha de cierre tiene que ser posterior a la de apertura',
    path: ['cierraEn'],
  });

export type SurveyCampaignFormValues = z.infer<typeof surveyCampaignSchema>;

/**
 * Campos de una pregunta, sin sus opciones.
 *
 * Se usa tal cual en la edición: `PATCH .../questions/:id` **no** acepta
 * `opciones` (cada opción tiene su propio endpoint), así que el formulario de
 * edición tampoco las tiene.
 */
export const surveyQuestionSchema = z.object({
  texto: textoObligatorio(
    5,
    MAX_TEXTO_PREGUNTA,
    'Escribí la pregunta como se la vas a leer a un chico',
    'La pregunta',
  ),
  ayuda: textoOpcional(MAX_AYUDA_PREGUNTA, 'La aclaración'),
  kind: z.nativeEnum(SurveyQuestionKind).default(SurveyQuestionKind.UNICA),
  audiencia: z.nativeEnum(SurveyAudience).default(SurveyAudience.TODOS),
  obligatoria: z.boolean().default(true),
  activa: z.boolean().default(true),
});

export type SurveyQuestionFormValues = z.infer<typeof surveyQuestionSchema>;

const opcionNuevaSchema = z.object({
  texto: textoObligatorio(1, MAX_TEXTO_OPCION, 'Escribí la opción o borrá la fila', 'La opción'),
});

/**
 * Alta de pregunta: los campos de arriba **más** sus opciones, que en el alta
 * sí viajan anidadas (`POST .../questions` las acepta en el mismo body).
 *
 * El mínimo de dos no es capricho: una pregunta activa sin opciones hace que
 * `publish` responda 400, y una sola opción no es una pregunta.
 */
export const surveyQuestionWithOptionsSchema = surveyQuestionSchema
  .extend({
    opciones: z
      .array(opcionNuevaSchema)
      .min(MIN_OPCIONES_POR_PREGUNTA, `Cargá al menos ${MIN_OPCIONES_POR_PREGUNTA} opciones de respuesta`)
      .max(MAX_OPCIONES_POR_PREGUNTA, `No cargues más de ${MAX_OPCIONES_POR_PREGUNTA} opciones: no se leen en un celular`),
  })
  // El backend rechaza dos opciones con el mismo `valor`, y el `valor` se deriva
  // del texto: dos opciones con el mismo texto son el mismo 409 una pantalla
  // antes, y encima ilegibles para quien responde.
  .refine(
    (data) => {
      const textos = data.opciones.map((o) => o.texto.trim().toLowerCase());
      return new Set(textos).size === textos.length;
    },
    {
      message: 'Hay dos opciones con el mismo texto',
      path: ['opciones'],
    },
  );

export type SurveyQuestionWithOptionsFormValues = z.infer<
  typeof surveyQuestionWithOptionsSchema
>;

/**
 * Edición de una opción.
 *
 * `texto` siempre se puede reescribir — es el punto de tener un panel. `valor`
 * es opcional acá porque el formulario sólo lo ofrece mientras la campaña no
 * tenga ninguna respuesta; con respuestas cargadas el backend responde 409 y la
 * pantalla lo muestra como dato de sólo lectura.
 */
export const surveyOptionSchema = z.object({
  texto: textoObligatorio(1, MAX_TEXTO_OPCION, 'La opción no puede quedar vacía', 'La opción'),
  valor: z
    .preprocess(
      nullishAVacio,
      z
        .string()
        .trim()
        .max(MAX_VALOR_OPCION, `El identificador no puede superar los ${MAX_VALOR_OPCION} caracteres`)
        .refine(
          (valor) => valor === '' || /^[a-z0-9]+(_[a-z0-9]+)*$/.test(valor),
          'El identificador sólo puede tener minúsculas sin acentos, números y guiones bajos',
        )
        .transform((valor) => (valor === '' ? undefined : valor)),
    )
    .optional(),
});

export type SurveyOptionFormValues = z.infer<typeof surveyOptionSchema>;
