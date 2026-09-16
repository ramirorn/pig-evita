import { z } from 'zod';
import {
  UserRole,
  Sex,
  DisciplineType,
  ResultType,
  CompetitionStage,
  CompetitionFormat,
  SurveyAudience,
  SurveyQuestionKind,
  SurveyWindow,
} from '@/types';

// ==========================================
// Límites compartidos
// ==========================================
//
// Criterio general (T15): el backend es la autoridad de validación; estos
// schemas existen para dar UX (mensajes claros antes de gastar un request).
// Por eso ninguna regla de acá puede ser MÁS LAXA que el DTO equivalente del
// backend — eso produciría un 400 incomprensible — pero sí puede ser más
// estricta.
//
// Ninguna columna de texto de Prisma tiene largo declarado (`String` en
// Postgres = `text`, sin límite) y los DTOs del backend no usan `@MaxLength`.
// Es decir: los máximos de abajo NO salen del esquema ni del backend, salen
// del dominio. Se documenta de dónde sale cada número; donde no hay un límite
// justificable, no se inventa uno.

/** Nombre y apellido de una persona. 60 es holgado para lo que entra en un DNI argentino. */
const MAX_NOMBRE_PERSONA = 60;

/** Localidad / departamento de Formosa. El nombre más largo del catálogo no llega a 40. */
const MAX_NOMBRE_LUGAR = 60;

/** Dirección postal de una línea. */
const MAX_DIRECCION = 200;

/** Máximo de un email según RFC 5321 (64 de local-part + @ + 255 de dominio, truncado al límite práctico). */
const MAX_EMAIL = 254;

/**
 * El backend hashea con argon2 (`auth.service.ts`), que no trunca la entrada
 * como sí hace bcrypt a 72 bytes. El tope es sólo para evitar que un pegado
 * accidental de miles de caracteres se vaya a hashear.
 */
const MAX_PASSWORD = 128;

/**
 * Campos de texto largo (`@db.Text`): reglamentos, contenido de noticias.
 * No hay límite de columna. El tope real es el body parser de Express, que sin
 * configuración explícita corta en 100 kB. 50.000 caracteres deja margen para
 * el resto del payload y para el escapado JSON de acentos.
 */
const MAX_TEXTO_LARGO = 50_000;

// ==========================================
// Helpers de validación
// ==========================================

/** Texto obligatorio: recorta espacios y exige un mínimo y un máximo. */
const textoObligatorio = (min: number, max: number, mensajeMin: string, entidad: string) =>
  z
    .string()
    .trim()
    .min(min, mensajeMin)
    .max(max, `${entidad} no puede superar los ${max} caracteres`);

/**
 * Los campos opcionales llegan como `''` desde un input controlado, pero como
 * `null` cuando el formulario se rellena con un registro existente (Prisma
 * devuelve `null`, no `undefined`, para las columnas `String?`). Sin esta
 * normalización, editar un participante sin teléfono cargado falla con un
 * "expected string, received null" que no se puede corregir desde la UI.
 */
const nullishAVacio = (valor: unknown) => (valor === null || valor === undefined ? '' : valor);

/**
 * Texto opcional que llega como `''` desde los inputs controlados.
 * Se normaliza a `undefined` para que el backend lo trate como ausente:
 * `@IsOptional()` de class-validator sólo saltea `null`/`undefined`, así que un
 * `''` enviado a un campo con `@IsEmail()` devuelve 400.
 */
const textoOpcional = (max: number, entidad: string) =>
  z
    .preprocess(
      nullishAVacio,
      z
        .string()
        .trim()
        .max(max, `${entidad} no puede superar los ${max} caracteres`)
        .transform((valor) => (valor === '' ? undefined : valor)),
    )
    .optional();

/** Email obligatorio. */
const emailObligatorio = () =>
  z
    .string()
    .trim()
    .min(1, 'El email es obligatorio')
    .max(MAX_EMAIL, `El email no puede superar los ${MAX_EMAIL} caracteres`)
    .refine(
      (valor) => z.email().safeParse(valor).success,
      'Ingresá un email válido (por ejemplo nombre@correo.com)',
    );

/** Email opcional: acepta vacío y lo manda como ausente. */
const emailOpcional = () =>
  z
    .preprocess(
      nullishAVacio,
      z
        .string()
        .trim()
        .max(MAX_EMAIL, `El email no puede superar los ${MAX_EMAIL} caracteres`)
        .refine(
          (valor) => valor === '' || z.email().safeParse(valor).success,
          'Ingresá un email válido (por ejemplo nombre@correo.com) o dejá el campo vacío',
        )
        .transform((valor) => (valor === '' ? undefined : valor)),
    )
    .optional();

/**
 * Teléfono argentino tal como lo tipea una persona: dígitos más los separadores
 * habituales (`+54`, `(3704)`, `370-412-3456`). No se normaliza el formato
 * porque el backend guarda el string tal cual (`phone String?`).
 */
const PHONE_REGEX = /^[\d+\s()-]+$/;
/** Un fijo de Formosa sin código de área ya tiene 6; con área, 10. 8 es el piso razonable. */
const MIN_PHONE = 8;
/** `+54 9 3704 12-3456` entra cómodo en 20. */
const MAX_PHONE = 20;

const telefonoOpcional = () =>
  z
    .preprocess(
      nullishAVacio,
      z
        .string()
        .trim()
        .superRefine((valor, ctx) => {
          if (valor === '') return; // campo vacío = no informado
          if (!PHONE_REGEX.test(valor)) {
            ctx.addIssue({
              code: 'custom',
              message: 'El teléfono sólo puede tener números, espacios y los signos + - ( )',
            });
            return;
          }
          if (valor.length < MIN_PHONE) {
            ctx.addIssue({
              code: 'custom',
              message: 'El teléfono es muy corto: incluí el código de área (por ejemplo 3704123456)',
            });
            return;
          }
          if (valor.length > MAX_PHONE) {
            ctx.addIssue({
              code: 'custom',
              message: `El teléfono no puede superar los ${MAX_PHONE} caracteres`,
            });
          }
        })
        .transform((valor) => (valor === '' ? undefined : valor)),
    )
    .optional();

// ------------------------------------------
// Fechas
// ------------------------------------------

/** `<input type="date">` siempre entrega `YYYY-MM-DD`. */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** `<input type="time">` entrega `HH:MM` (24 h). */
const ISO_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Valida que la cadena sea una fecha real del calendario.
 * `Date.parse('2010-02-30')` no falla (rueda a marzo), así que hay que
 * comparar los componentes después de construir la fecha.
 * Se usa UTC a propósito: con hora local, `new Date('2010-05-15')` se corre un
 * día en Formosa (UTC-3) y un cumpleaños del 1 de enero cambia de año.
 */
function esFechaDeCalendario(valor: string): boolean {
  if (!ISO_DATE_REGEX.test(valor)) return false;
  const anio = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(5, 7));
  const dia = Number(valor.slice(8, 10));
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** Fecha opcional que puede venir vacía desde el formulario. */
const fechaOpcional = (mensaje: string) =>
  z
    .preprocess(
      nullishAVacio,
      z
        .string()
        .trim()
        .refine((valor) => valor === '' || esFechaDeCalendario(valor), mensaje)
        .transform((valor) => (valor === '' ? undefined : valor)),
    )
    .optional();

// ==========================================
// Auth Schemas
// ==========================================

export const loginSchema = z.object({
  email: emailObligatorio(),
  // 8, no 6: `LoginDto` del backend exige `@MinLength(8)`. Con 6 el formulario
  // dejaba enviar una contraseña que el backend rechazaba con un 400.
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(MAX_PASSWORD, `La contraseña no puede superar los ${MAX_PASSWORD} caracteres`),
});

// ==========================================
// User Schemas
// ==========================================

export const createUserSchema = z.object({
  email: emailObligatorio(),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(MAX_PASSWORD, `La contraseña no puede superar los ${MAX_PASSWORD} caracteres`),
  firstName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El nombre es obligatorio', 'El nombre'),
  lastName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El apellido es obligatorio', 'El apellido'),
  role: z.nativeEnum(UserRole, { message: 'Rol inválido' }),
  // Departamento y zona de asignación del usuario administrativo: texto libre
  // en Prisma (`department String?`) y sin catálogo cerrado en el frontend.
  department: textoOpcional(MAX_NOMBRE_LUGAR, 'El departamento'),
  zone: textoOpcional(MAX_NOMBRE_LUGAR, 'La zona'),
});

export const updateUserSchema = z.object({
  email: emailObligatorio(),
  // En edición el campo vacío significa "no cambiar la contraseña".
  password: z
    .string()
    .refine(
      (val) => !val || (val.length >= 8 && val.length <= MAX_PASSWORD),
      { message: `La nueva contraseña debe tener entre 8 y ${MAX_PASSWORD} caracteres` },
    )
    .optional(),
  firstName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El nombre es obligatorio', 'El nombre'),
  lastName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El apellido es obligatorio', 'El apellido'),
  role: z.nativeEnum(UserRole, { message: 'Rol inválido' }),
  department: textoOpcional(MAX_NOMBRE_LUGAR, 'El departamento'),
  zone: textoOpcional(MAX_NOMBRE_LUGAR, 'La zona'),
  isActive: z.boolean().default(true),
});

// ==========================================
// Participant Schemas
// ==========================================

/**
 * Año más antiguo aceptable para una fecha de nacimiento. Nadie con menos de
 * ese año participa de los Juegos Evita; sirve para atajar el error de tipeo
 * clásico (`1020`, `0201`) antes de que llegue al backend.
 */
const ANIO_MINIMO_NACIMIENTO = 1920;

/**
 * Edad mínima del participante. Es el piso de `categorySchema.minAge` y evita
 * el otro error de tipeo clásico: la fecha de hoy o una fecha futura.
 */
const EDAD_MINIMA_PARTICIPANTE = 5;

/** Última fecha de nacimiento aceptable: hoy menos `EDAD_MINIMA_PARTICIPANTE` años. */
function fechaNacimientoMaxima(): string {
  const hoy = new Date();
  const anio = hoy.getFullYear() - EDAD_MINIMA_PARTICIPANTE;
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export const participantSchema = z.object({
  /**
   * Mismo formato que `DNI_REGEX` del backend (`common/validators/dni.validator.ts`),
   * más el rechazo de dígitos repetidos que el backend todavía no aplica (T24
   * lo dejó anotado). Es una regla de UX: `00000000` no es un DNI real, pero la
   * API directa lo sigue aceptando.
   */
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 números, sin puntos ni espacios')
    .refine(
      (valor) => !/^(\d)\1+$/.test(valor),
      'Revisá el DNI: no puede ser el mismo dígito repetido (00000000, 11111111, ...)',
    ),
  firstName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El nombre es obligatorio', 'El nombre'),
  lastName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El apellido es obligatorio', 'El apellido'),
  birthDate: z
    .string()
    .trim()
    .superRefine((valor, ctx) => {
      if (valor === '') {
        ctx.addIssue({ code: 'custom', message: 'La fecha de nacimiento es obligatoria' });
        return;
      }
      if (!esFechaDeCalendario(valor)) {
        ctx.addIssue({
          code: 'custom',
          message: 'La fecha de nacimiento no existe en el calendario. Revisá el día y el mes.',
        });
        return;
      }
      // Comparación lexicográfica: dos cadenas `YYYY-MM-DD` ordenan igual que
      // las fechas que representan, sin construir Date ni cruzar husos horarios.
      if (valor.slice(0, 4) < String(ANIO_MINIMO_NACIMIENTO)) {
        ctx.addIssue({
          code: 'custom',
          message: `El año de nacimiento no puede ser anterior a ${ANIO_MINIMO_NACIMIENTO}. Revisá el año.`,
        });
        return;
      }
      if (valor > fechaNacimientoMaxima()) {
        ctx.addIssue({
          code: 'custom',
          message: `El participante debe tener al menos ${EDAD_MINIMA_PARTICIPANTE} años cumplidos y no puede haber nacido en el futuro. Revisá el año.`,
        });
      }
    }),
  sex: z.nativeEnum(Sex, { message: 'Sexo inválido' }),
  phone: telefonoOpcional(),
  email: emailOpcional(),
  locality: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'La localidad es obligatoria', 'La localidad'),
  department: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'El departamento es obligatorio', 'El departamento'),
  address: textoOpcional(MAX_DIRECCION, 'La dirección'),
});

// ==========================================
// Discipline Schemas
// ==========================================

/** "Handball de playa femenino" no llega a 80. */
const MAX_NOMBRE_DISCIPLINA = 80;

/**
 * Tope de jugadores por equipo. La disciplina más numerosa del programa es
 * fútbol 11 (11 + suplentes); 50 deja margen para plantel ampliado sin dejar
 * pasar un `999` de tipeo.
 */
const MAX_JUGADORES_EQUIPO = 50;

export const disciplineSchema = z
  .object({
    name: textoObligatorio(3, MAX_NOMBRE_DISCIPLINA, 'El nombre debe tener al menos 3 caracteres', 'El nombre'),
    type: z.nativeEnum(DisciplineType),
    resultType: z.nativeEnum(ResultType),
    // `rules` es `@db.Text` (reglamento completo). Sólo se acota por el límite
    // del body parser, no por el dominio.
    rules: textoOpcional(MAX_TEXTO_LARGO, 'El reglamento'),
    minPlayers: z
      .number()
      .int('La cantidad de jugadores debe ser un número entero')
      .min(1, 'El mínimo de jugadores debe ser al menos 1')
      .max(MAX_JUGADORES_EQUIPO, `El mínimo de jugadores no puede superar ${MAX_JUGADORES_EQUIPO}`)
      .optional(),
    maxPlayers: z
      .number()
      .int('La cantidad de jugadores debe ser un número entero')
      .min(1, 'El máximo de jugadores debe ser al menos 1')
      .max(MAX_JUGADORES_EQUIPO, `El máximo de jugadores no puede superar ${MAX_JUGADORES_EQUIPO}`)
      .optional(),
    /**
     * Plantel reglamentario, sólo para disciplinas de `EQUIPO`.
     *
     * Van `nullish` porque así viajan: el backend los devuelve en `null` para
     * las individuales y para las de equipo que todavía nadie configuró. El
     * `superRefine` de abajo es el que impide guardar una disciplina de equipo
     * sin ellos, que es la única forma de que el alta de plantel completo
     * pueda usarse con esa disciplina.
     */
    titulares: z
      .number()
      .int('La cantidad de titulares debe ser un número entero')
      .min(1, 'Un equipo necesita al menos 1 titular')
      .max(MAX_JUGADORES_EQUIPO, `Los titulares no pueden superar ${MAX_JUGADORES_EQUIPO}`)
      .nullish(),
    maxSuplentes: z
      .number()
      .int('La cantidad de suplentes debe ser un número entero')
      .min(0, 'El máximo de suplentes no puede ser negativo')
      .max(MAX_JUGADORES_EQUIPO, `Los suplentes no pueden superar ${MAX_JUGADORES_EQUIPO}`)
      .nullish(),
    // Orden de visualización en el listado público: sólo se usa para ordenar,
    // no admite negativos ni valores absurdos.
    sortOrder: z
      .number()
      .int('El orden debe ser un número entero')
      .min(0, 'El orden no puede ser negativo')
      .max(999, 'El orden no puede superar 999')
      .default(0),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) =>
      data.minPlayers === undefined ||
      data.maxPlayers === undefined ||
      data.maxPlayers >= data.minPlayers,
    {
      message: 'El máximo de jugadores debe ser mayor o igual al mínimo',
      path: ['maxPlayers'],
    },
  )
  .superRefine((data, ctx) => {
    // Sólo las de equipo tienen plantel. En una individual los dos campos ni
    // siquiera se muestran, y si llegaran con valor no significarían nada.
    if (data.type !== DisciplineType.EQUIPO) return;

    if (data.titulares === null || data.titulares === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['titulares'],
        message:
          'Una disciplina de equipo necesita saber cuántos titulares lleva: sin este dato no se puede inscribir un plantel.',
      });
    }
    if (data.maxSuplentes === null || data.maxSuplentes === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['maxSuplentes'],
        message:
          'Indicá cuántos suplentes admite la disciplina. Si no admite ninguno, poné 0.',
      });
    }
  });

// ==========================================
// Category Schemas
// ==========================================

/** "Sub-14 Masculino Promocional" entra en 50. */
const MAX_NOMBRE_CATEGORIA = 50;

/** Techo de edad de una categoría: los Juegos Evita tienen rama adultos mayores. */
const EDAD_MAXIMA_CATEGORIA = 99;

export const categorySchema = z
  .object({
    disciplineId: z.string().uuid('ID de disciplina inválido'),
    name: textoObligatorio(
      2,
      MAX_NOMBRE_CATEGORIA,
      'El nombre de categoría es obligatorio (ej. Sub 14)',
      'El nombre de categoría',
    ),
    // El piso es el mismo que el de `participantSchema.birthDate`: una
    // categoría no puede pedir una edad que ningún participante puede tener.
    minAge: z
      .number()
      .int('La edad mínima debe ser un número entero')
      .min(EDAD_MINIMA_PARTICIPANTE, `La edad mínima no puede ser menor a ${EDAD_MINIMA_PARTICIPANTE} años`)
      .max(EDAD_MAXIMA_CATEGORIA, `La edad mínima no puede superar los ${EDAD_MAXIMA_CATEGORIA} años`),
    maxAge: z
      .number()
      .int('La edad máxima debe ser un número entero')
      .min(EDAD_MINIMA_PARTICIPANTE, `La edad máxima no puede ser menor a ${EDAD_MINIMA_PARTICIPANTE} años`)
      .max(EDAD_MAXIMA_CATEGORIA, `La edad máxima no puede superar los ${EDAD_MAXIMA_CATEGORIA} años`),
    sex: z.nativeEnum(Sex),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.maxAge >= data.minAge, {
    message: 'La edad máxima debe ser mayor o igual a la mínima',
    path: ['maxAge'],
  });

// ==========================================
// Team Schemas
// ==========================================

/** Nombre de equipo/club/escuela. */
const MAX_NOMBRE_EQUIPO = 60;

export const teamSchema = z.object({
  name: textoObligatorio(3, MAX_NOMBRE_EQUIPO, 'El nombre del equipo es obligatorio', 'El nombre del equipo'),
  disciplineId: z.string().uuid('Debe seleccionar una disciplina'),
  categoryId: z.string().uuid('Debe seleccionar una categoría'),
  locality: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'La localidad es obligatoria', 'La localidad'),
  department: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'El departamento es obligatorio', 'El departamento'),
});

// ==========================================
// Team Inscription Schemas (alta de plantel completo)
// ==========================================

/** "Arquero", "Base", "Punta receptora": ninguna posición real pasa de 40. */
const MAX_POSICION = 40;

/** Dorsal. Mismo techo que el DTO del backend: `@Max(999)` en `CreateTeamMemberInscriptionDto`. */
const MAX_DORSAL = 999;

/**
 * Un integrante del plantel: **los mismos datos de una persona** que pide
 * `participantSchema`, más lo que sólo tiene sentido dentro de un equipo.
 *
 * Se extiende en vez de copiarse para que las reglas duras del participante
 * (formato de DNI, dígitos repetidos, fecha de nacimiento fuera del calendario)
 * valgan igual para el chico número 14 de un plantel que para una inscripción
 * individual. Cuando T15 endureció `participantSchema`, el camino de entrada
 * que lo reimplementaba a mano se quedó atrás (R31): esto es para no repetirlo.
 */
export const teamMemberSchema = participantSchema.extend({
  isSubstitute: z.boolean(),
  position: textoOpcional(MAX_POSICION, 'La posición'),
  shirtNumber: z
    .number()
    .int('El número de camiseta debe ser un número entero')
    .min(0, 'El número de camiseta no puede ser negativo')
    .max(MAX_DORSAL, `El número de camiseta no puede superar ${MAX_DORSAL}`)
    .nullish(),
  isCaptain: z.boolean(),
});

export type TeamMemberValues = z.infer<typeof teamMemberSchema>;

/**
 * El envío completo de `POST /inscriptions/team`.
 *
 * No valida el **conteo** del plantel (titulares y suplentes contra lo que pide
 * la disciplina) ni los duplicados de DNI: eso depende de la disciplina y la
 * categoría elegidas, que no están acá adentro. Vive en `rosterModel.ts`, que
 * es lo que el contador de la pantalla usa en vivo.
 */
export const teamInscriptionSchema = z.object({
  disciplineId: z.string().uuid('Debe seleccionar una disciplina'),
  categoryId: z.string().uuid('Debe seleccionar una categoría'),
  teamName: textoObligatorio(
    3,
    MAX_NOMBRE_EQUIPO,
    'El nombre del equipo es obligatorio',
    'El nombre del equipo',
  ),
  locality: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'La localidad es obligatoria', 'La localidad'),
  department: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'El departamento es obligatorio', 'El departamento'),
  members: z.array(teamMemberSchema).min(1, 'El plantel no puede estar vacío'),
});

export type TeamInscriptionValues = z.infer<typeof teamInscriptionSchema>;

// ==========================================
// Competition Schemas
// ==========================================

/** "Final Provincial de Vóley Sub-16 Femenino 2026" entra en 100. */
const MAX_NOMBRE_COMPETENCIA = 100;

export const competitionSchema = z
  .object({
    disciplineId: z.string().uuid('Debe seleccionar una disciplina'),
    categoryId: z.string().uuid('Debe seleccionar una categoría'),
    stage: z.nativeEnum(CompetitionStage),
    format: z.nativeEnum(CompetitionFormat),
    name: textoOpcional(MAX_NOMBRE_COMPETENCIA, 'El nombre'),
    startDate: fechaOpcional('La fecha de inicio no existe en el calendario. Revisá el día y el mes.'),
    endDate: fechaOpcional('La fecha de fin no existe en el calendario. Revisá el día y el mes.'),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: 'La fecha de fin no puede ser anterior a la de inicio',
    path: ['endDate'],
  });

// ==========================================
// Calendar Event Schemas
// ==========================================

/** Título de evento del calendario público: cabe en una tarjeta sin truncar feo. */
const MAX_TITULO_EVENTO = 150;

export const calendarEventSchema = z
  .object({
    title: textoObligatorio(2, MAX_TITULO_EVENTO, 'El título es obligatorio', 'El título'),
    // `description` es `@db.Text`: sin límite de columna.
    description: textoOpcional(MAX_TEXTO_LARGO, 'La descripción'),
    startDate: z
      .string()
      .trim()
      .min(1, 'La fecha de inicio es obligatoria')
      .refine(esFechaDeCalendario, 'La fecha de inicio no existe en el calendario. Revisá el día y el mes.'),
    startTime: z
      .string()
      .trim()
      .min(1, 'La hora de inicio es obligatoria')
      .regex(ISO_TIME_REGEX, 'La hora de inicio debe tener el formato HH:MM (por ejemplo 09:30)'),
    hasEndDate: z.boolean().default(false),
    endDate: fechaOpcional('La fecha de fin no existe en el calendario. Revisá el día y el mes.'),
    endTime: z
      .preprocess(
        nullishAVacio,
        z
          .string()
          .trim()
          .refine(
            (valor) => valor === '' || ISO_TIME_REGEX.test(valor),
            'La hora de fin debe tener el formato HH:MM (por ejemplo 18:00)',
          )
          .transform((valor) => (valor === '' ? undefined : valor)),
      )
      .optional(),
    stage: z.nativeEnum(CompetitionStage).optional().nullable().or(z.literal('')).or(z.literal('none')),
    disciplineId: z.string().optional().nullable().or(z.literal('')),
    venueId: z.string().optional().nullable().or(z.literal('')),
    isPublished: z.boolean().default(true),
  })
  // Si el usuario tildó "tiene fecha de fin", la fecha de fin pasa a ser
  // obligatoria: antes se enviaba `endDate: null` en silencio.
  .refine((data) => !data.hasEndDate || Boolean(data.endDate), {
    message: 'Indicá la fecha de fin o destildá la opción',
    path: ['endDate'],
  })
  // El formulario arma `startDate + startTime` y `endDate + endTime` antes de
  // enviar, así que la comparación tiene que ser sobre el instante completo:
  // un evento del 10/03 09:00 al 10/03 08:00 es inválido aunque el día coincida.
  .refine(
    (data) => {
      if (!data.hasEndDate || !data.endDate) return true;
      const inicio = `${data.startDate}T${data.startTime}`;
      const fin = `${data.endDate}T${data.endTime ?? '23:59'}`;
      return fin >= inicio;
    },
    {
      message: 'El fin del evento no puede ser anterior al inicio',
      path: ['endDate'],
    },
  );

// ==========================================
// Venue Schemas
// ==========================================

/** Nombre de sede ("Estadio Cincuentenario", "Escuela N° 123 Anexo 2"). */
const MAX_NOMBRE_SEDE = 100;

/**
 * Capacidad de espectadores. El estadio más grande de Formosa ronda las 25.000
 * localidades; 200.000 es un techo defensivo contra el tipeo, no una regla.
 */
const MAX_CAPACIDAD_SEDE = 200_000;

/** Conversión de input de texto a número opcional, compartida por capacity/lat/lng. */
const numeroOpcionalDesdeInput = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === '' || val === null || val === undefined) return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  });

export const venueSchema = z.object({
  name: textoObligatorio(2, MAX_NOMBRE_SEDE, 'El nombre de la sede es obligatorio', 'El nombre de la sede'),
  address: textoObligatorio(2, MAX_DIRECCION, 'La dirección es obligatoria', 'La dirección'),
  department: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'El departamento es obligatorio', 'El departamento'),
  locality: textoObligatorio(2, MAX_NOMBRE_LUGAR, 'La localidad es obligatoria', 'La localidad'),
  capacity: numeroOpcionalDesdeInput
    .refine(
      (val) => val === undefined || (Number.isInteger(val) && val >= 0 && val <= MAX_CAPACIDAD_SEDE),
      `La capacidad debe ser un número entero entre 0 y ${MAX_CAPACIDAD_SEDE.toLocaleString('es-AR')}`,
    )
    .optional(),
  // Rango real de una coordenada geográfica, no un criterio de dominio.
  latitude: numeroOpcionalDesdeInput
    .refine(
      (val) => val === undefined || (val >= -90 && val <= 90),
      'La latitud debe estar entre -90 y 90',
    )
    .optional(),
  longitude: numeroOpcionalDesdeInput
    .refine(
      (val) => val === undefined || (val >= -180 && val <= 180),
      'La longitud debe estar entre -180 y 180',
    )
    .optional(),
  isActive: z.boolean().default(true),
});

export type VenueFormValues = z.infer<typeof venueSchema>;

// ==========================================
// News Schemas
// ==========================================

/** Título de noticia: entra completo en la tarjeta del listado y en un `<title>`. */
const MAX_TITULO_NOTICIA = 200;

/** Copete/resumen que se muestra en el listado y en las metatags. */
const MAX_EXCERPT_NOTICIA = 500;

export const newsSchema = z.object({
  title: textoObligatorio(3, MAX_TITULO_NOTICIA, 'El título es obligatorio (mínimo 3 caracteres)', 'El título'),
  excerpt: textoOpcional(MAX_EXCERPT_NOTICIA, 'El resumen'),
  // `content` es `@db.Text`: el único techo es el body parser.
  content: textoObligatorio(
    10,
    MAX_TEXTO_LARGO,
    'El contenido debe tener al menos 10 caracteres',
    'El contenido',
  ),
  imageKey: z.string().optional().nullable().or(z.literal('')),
  isPublished: z.boolean().default(false),
});

export type NewsFormValues = z.infer<typeof newsSchema>;

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
