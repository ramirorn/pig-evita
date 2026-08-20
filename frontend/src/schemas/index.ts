import { z } from 'zod';
import { UserRole, Sex, DisciplineType, ResultType, CompetitionStage, CompetitionFormat } from '@/types';

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
  );

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
