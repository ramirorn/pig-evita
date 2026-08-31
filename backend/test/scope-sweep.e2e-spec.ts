// ===========================================
// E2E — S01: la red que barre TODOS los handlers que devuelven
//            Participant, Team o Inscription
// ===========================================
//
// Tres rondas de revisión encontraron la MISMA clase de bug —datos de personas
// sin recortar— siempre en el módulo de al lado: inscripciones (T01),
// competencias (R01), y ahora dashboard + PATCH + alta de inscripción. Lo que
// falló no fue ninguna tarea: fue el **criterio de alcance**, que se definió por
// archivo ("arreglar competitions.service.ts") en vez de por propiedad
// ("ningún endpoint devuelve filas fuera del alcance territorial").
//
// Este spec define la propiedad y la verifica sobre TODOS los handlers, que
// **descubre por reflexión** sobre los controllers reales — igual que el barrido
// de `@Public()` que dejó R01 en `public-pii.e2e-spec.ts`, que funcionó
// justamente por eso: un endpoint nuevo entra solo.
//
// -------------------------------------------------
// La propiedad
// -------------------------------------------------
// Para un usuario con alcance territorial acotado, NINGUNA respuesta puede
// contener un dato identificatorio de una fila que esté fuera de su alcance: ni
// el id, ni el DNI, ni el apellido, ni el código QR, ni el nombre del
// departamento ajeno. Da igual si el dato viene arriba de todo o anidado tres
// niveles abajo, y da igual por qué vía llegó.
//
// -------------------------------------------------
// Las tres vías
// -------------------------------------------------
//   1. LISTADO   — `GET /participants`, `GET /teams`, `GET /dashboard/stats`…
//   2. LECTURA   — `GET /participants/:id`, `GET /inscriptions/:id`…
//   3. ESCRITURA — la **respuesta** de un `POST` / `PATCH` / `DELETE`.
//
// La tercera es la que se escapó: S03 (el PATCH que muda una fila de
// jurisdicción) y S04 (el alta que reutiliza un participante ajeno y baja su
// ficha) son las dos instancias de esta ronda. Se revisan los `select` de los
// listados y nadie mira lo que baja después de un `create`.
//
// -------------------------------------------------
// Por qué el barrido no puede quedar mudo
// -------------------------------------------------
//   * Si la reflexión deja de encontrar handlers, el test falla: hay pisos
//     mínimos globales, por controller y por vía.
//   * Un handler descubierto **sin receta de invocación** falla con un mensaje
//     que dice qué agregar. La lista escrita a mano es *cómo se llama* a cada
//     handler, nunca *cuáles existen*: agregar un endpoint nuevo pone el barrido
//     en rojo hasta que alguien lo mire, que es exactamente lo que se busca.
//   * Un control positivo con alcance provincial exige que cada handler responda
//     2xx al menos una vez. Sin eso, un barrido que le pega a rutas mal armadas
//     cosecharía 404 en todas y quedaría "verde" sin haber mirado un payload.
//
// El doble de Prisma evalúa el `where` y **muta el estado** en las escrituras
// (`mocks/prisma-territorial`). Un mock que devuelve constantes haría pasar por
// igual al código con recorte y al de antes, y ocultaría el efecto de un PATCH
// que mueve una fila de departamento — que es justo lo que S03 tiene que ver.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import request from 'supertest';
import { App } from 'supertest/types';

import { ParticipantsController } from '../src/modules/participants/participants.controller';
import { ParticipantsService } from '../src/modules/participants/participants.service';
import { TeamsController } from '../src/modules/teams/teams.controller';
import { TeamsService } from '../src/modules/teams/teams.service';
import { InscriptionsController } from '../src/modules/inscriptions/inscriptions.controller';
import { InscriptionsService } from '../src/modules/inscriptions/inscriptions.service';
import { DocumentsController } from '../src/modules/documents/documents.controller';
import { DocumentsService } from '../src/modules/documents/documents.service';
import { MinioService } from '../src/modules/documents/minio.service';
import { FileSignaturePipe } from '../src/modules/documents/file-signature.pipe';
import { DashboardController } from '../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { RolesGuard } from '../src/common/guards';
import { AuditService } from '../src/modules/audit/audit.service';
import { PrismaService } from '../src/database/prisma.service';
import { ScopeService } from '../src/common/scope';
import { IS_PUBLIC_KEY, Role } from '../src/common/constants';
import { coincide, tabla } from './mocks/prisma-territorial';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

/** Montar una app por handler cuesta; el barrido completo no entra en 5s. */
jest.setTimeout(180_000);

// ===========================================
// El universo del fixture: dos departamentos simétricos
// ===========================================
//
// Simétricos a propósito. Cada rol del barrido tiene UNO de los dos como propio,
// así que "fila ajena" no es una constante del archivo sino algo que se deriva
// del alcance de quien pregunta. Un test que hardcodea "Pirané es lo prohibido"
// no detecta nada sobre el rol cuyo territorio ES Pirané.
export const PILCOMAYO = 'Pilcomayo';
export const PIRANE = 'Pirané';
export const ZONA_DE_PIRANE = 'Zona Sur';

const ID_INEXISTENTE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

export const DISCIPLINA = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Fútbol',
  type: 'EQUIPO',
  resultType: 'GOLES',
  minPlayers: 5,
  maxPlayers: 11,
  isActive: true,
};

export const CATEGORIA = {
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Sub-14 Mixto',
  disciplineId: DISCIPLINA.id,
  discipline: DISCIPLINA,
  sex: 'MIXTO',
  minAge: 12,
  maxAge: 14,
  isActive: true,
};

/**
 * Segunda categoría, sin ninguna inscripción cargada.
 *
 * Las altas de inscripción del barrido apuntan acá: si usaran `CATEGORIA`, el
 * participante ajeno ya está inscripto en ella y el service cortaría con 409
 * **antes** de llegar al `include` que baja su ficha — o sea, el barrido daría
 * verde por el motivo equivocado.
 */
export const CATEGORIA_LIBRE = {
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Sub-14 Mixto B',
  disciplineId: DISCIPLINA.id,
  discipline: DISCIPLINA,
  sex: 'MIXTO',
  minAge: 12,
  maxAge: 14,
  isActive: true,
};

/** Nacimiento que cae dentro de la categoría sin depender del año en que corra. */
const NACIMIENTO = new Date(Date.UTC(new Date().getUTCFullYear() - 13, 5, 15));
const NACIMIENTO_ISO = NACIMIENTO.toISOString().slice(0, 10);

export type Territorio = typeof PILCOMAYO | typeof PIRANE;

/** Las entidades de un departamento, con valores identificatorios únicos. */
function universoDe(departamento: Territorio, n: string) {
  const esPilcomayo = departamento === PILCOMAYO;

  const participant = {
    id: `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n.repeat(12)}`,
    dni: esPilcomayo ? '48111111' : '48999999',
    firstName: esPilcomayo ? 'Ana' : 'Joaquín',
    lastName: esPilcomayo ? 'Godoy' : 'Insaurralde',
    birthDate: NACIMIENTO,
    sex: 'FEMENINO',
    phone: null as string | null,
    email: null as string | null,
    locality: esPilcomayo ? 'Clorinda' : 'Villa Dos Trece',
    department: departamento,
    address: esPilcomayo ? 'Av. San Martín 100' : 'Calle Rivadavia 900',
    createdAt: new Date('2026-01-02T10:00:00.000Z'),
    updatedAt: new Date('2026-01-02T10:00:00.000Z'),
    inscriptions: [] as unknown[],
    documents: [] as unknown[],
    teamMembers: [] as unknown[],
    results: [] as unknown[],
  };

  const team = {
    id: `${n}${n}${n}${n}${n}${n}${n}a-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n.repeat(11)}a`,
    name: esPilcomayo ? 'Clorinda FC' : 'Juniors del Sur',
    disciplineId: DISCIPLINA.id,
    categoryId: CATEGORIA.id,
    discipline: DISCIPLINA,
    category: CATEGORIA,
    institution: null as string | null,
    locality: participant.locality,
    department: departamento,
    isActive: true,
    createdAt: new Date('2026-01-03T10:00:00.000Z'),
    updatedAt: new Date('2026-01-03T10:00:00.000Z'),
    members: [] as unknown[],
    inscriptions: [] as unknown[],
    results: [] as unknown[],
    _count: { members: 1, inscriptions: 0, results: 0 },
  };

  /**
   * Copia del participante **sin sus relaciones**, para las referencias hacia
   * atrás (`document.participant`, `teamMember.participant`).
   *
   * Con la fila original se armaban ciclos —`participant.documents[0].participant`—
   * y `JSON.stringify` de la respuesta explotaba con 500, que el barrido habría
   * contado como "no filtró nada". Los delatores son valores, así que una copia
   * detecta la fuga igual.
   */
  const participantePlano = {
    ...participant,
    inscriptions: [] as unknown[],
    documents: [] as unknown[],
    teamMembers: [] as unknown[],
    results: [] as unknown[],
  };

  const inscripcionBase = {
    notes: null as string | null,
    rejectionNote: null as string | null,
    createdAt: new Date('2026-02-01T10:00:00.000Z'),
    updatedAt: new Date('2026-02-01T10:00:00.000Z'),
    reviewedAt: null as Date | null,
    approvedAt: null as Date | null,
    participantId: participant.id,
    participant: participantePlano,
    categoryId: CATEGORIA.id,
    category: CATEGORIA,
    teamId: null as string | null,
    team: null as unknown,
    createdById: null as string | null,
    createdBy: null as unknown,
    reviewedBy: null as unknown,
    approvedBy: null as unknown,
  };

  const inscription = {
    ...inscripcionBase,
    id: `${n}${n}${n}${n}${n}${n}${n}b-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n.repeat(11)}b`,
    qrCode: esPilcomayo ? 'EVITA-PILCO001' : 'EVITA-PIRANE01',
    status: 'PENDIENTE',
  };

  /**
   * Una segunda inscripción ya REVISADA. `approve` sólo acepta ese estado: sin
   * esta fila el handler nunca podría responder 200 y el control positivo lo
   * daría por inalcanzable, que es una forma silenciosa de no barrerlo.
   */
  const inscriptionRevisada = {
    ...inscripcionBase,
    id: `${n}${n}${n}${n}${n}${n}${n}c-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n.repeat(11)}c`,
    qrCode: esPilcomayo ? 'EVITA-PILCO002' : 'EVITA-PIRANE02',
    status: 'REVISADA',
  };

  const document = {
    id: `${n}${n}${n}${n}${n}${n}${n}e-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n.repeat(11)}e`,
    participantId: participant.id,
    participant: participantePlano,
    documentType: 'DNI_FRENTE',
    fileKey: `participants/${departamento.toLowerCase()}/dni.pdf`,
    originalName: 'dni.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    status: 'PENDIENTE',
    rejectionNote: null as string | null,
    reviewedById: null as string | null,
    reviewedAt: null as Date | null,
    createdAt: new Date('2026-02-02T10:00:00.000Z'),
    updatedAt: new Date('2026-02-02T10:00:00.000Z'),
  };

  const teamMember = {
    id: `${n}${n}${n}${n}${n}${n}${n}f-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n.repeat(11)}f`,
    teamId: team.id,
    participantId: participant.id,
    participant: participantePlano,
    isCaptain: true,
    shirtNumber: 10,
    position: null as string | null,
  };

  participant.inscriptions = [inscription, inscriptionRevisada];
  participant.documents = [document];
  participant.teamMembers = [teamMember];
  team.members = [teamMember];

  return {
    departamento,
    participant,
    team,
    inscription,
    inscriptionRevisada,
    document,
    teamMember,
  };
}

export const U_PILCOMAYO = universoDe(PILCOMAYO, '1');
export const U_PIRANE = universoDe(PIRANE, '9');
export const UNIVERSOS = [U_PILCOMAYO, U_PIRANE];

type Universo = (typeof UNIVERSOS)[number];

/** Sólo la zona de Pirané está mapeada: el ADMIN_ZONAL del barrido ve Pirané. */
export const ZONE_DEPARTMENTS = [
  { zone: ZONA_DE_PIRANE, department: PIRANE },
];

/**
 * Todo lo que delata a una fila. El barrido busca estos textos en el JSON
 * completo de la respuesta y no en campos sueltos: si el dato aparece tres
 * niveles más abajo, se ve igual.
 */
function delatoresDe(u: Universo): string[] {
  return [
    u.departamento,
    u.participant.id,
    u.participant.dni,
    u.participant.lastName,
    u.participant.address,
    u.team.id,
    u.team.name,
    u.inscription.id,
    u.inscription.qrCode,
    u.inscriptionRevisada.id,
    u.inscriptionRevisada.qrCode,
    u.document.id,
    u.document.fileKey,
  ];
}

// ===========================================
// Los alcances que se barren
// ===========================================
interface AlcanceDePrueba {
  etiqueta: string;
  rol: Role;
  territorio: { department?: string | null; zone?: string | null };
  /** Departamentos que este usuario SÍ puede ver. */
  visibles: Territorio[];
}

const ALCANCES: AlcanceDePrueba[] = [
  {
    etiqueta: 'ADMIN_DEPARTAMENTAL de Pilcomayo',
    rol: Role.ADMIN_DEPARTAMENTAL,
    territorio: { department: PILCOMAYO },
    visibles: [PILCOMAYO],
  },
  {
    etiqueta: 'DELEGADO de Pilcomayo',
    rol: Role.DELEGADO,
    territorio: { department: PILCOMAYO },
    visibles: [PILCOMAYO],
  },
  {
    etiqueta: 'COORDINADOR de Pilcomayo',
    rol: Role.COORDINADOR,
    territorio: { department: PILCOMAYO },
    visibles: [PILCOMAYO],
  },
  {
    // La cara B del barrido: para éste lo ajeno es Pilcomayo.
    etiqueta: 'ADMIN_ZONAL de la Zona Sur (mapeada a Pirané)',
    rol: Role.ADMIN_ZONAL,
    territorio: { zone: ZONA_DE_PIRANE },
    visibles: [PIRANE],
  },
  {
    // El agujero que cerró R05: un rol acotado sin su campo territorial cargado
    // no ve NADA. En el dashboard (S02) eso significa ceros, no el total.
    //
    // Va con ADMIN_DEPARTAMENTAL y no con DELEGADO porque es el rol acotado con
    // la superficie más ancha: `DASHBOARD_READ` no incluye a DELEGADO, así que
    // con ese rol el barrido ni llegaría al panel.
    etiqueta: 'ADMIN_DEPARTAMENTAL sin departamento cargado',
    rol: Role.ADMIN_DEPARTAMENTAL,
    territorio: { department: null },
    visibles: [],
  },
];

// ===========================================
// Recetas de invocación
// ===========================================
//
// La reflexión dice QUÉ handlers existen; esto dice CÓMO se llama a cada uno.
// Un handler descubierto sin receta pone el barrido en rojo: no se saltea.
type Via = 'LISTADO' | 'LECTURA' | 'ESCRITURA';

interface Contexto {
  /** Departamento propio del usuario (Pilcomayo si no tiene ninguno). */
  propio: Territorio;
  /** El otro: el que este usuario NO debería poder tocar. */
  ajeno: Territorio;
  uPropio: Universo;
  uAjeno: Universo;
}

interface Invocacion {
  etiqueta: string;
  params?: Record<string, string>;
  query?: string;
  body?: Record<string, unknown>;
  /** Subida multipart: adjunta un PDF mínimo válido por magic bytes. */
  adjuntarPdf?: boolean;
}

interface Receta {
  via: Via;
  invocaciones: (ctx: Contexto) => Invocacion[];
}

/** `%PDF-` son los magic bytes que exige `FileSignaturePipe` (R14). */
const PDF_MINIMO = Buffer.from('%PDF-1.4\n% documento de prueba\n');

function cuerpoParticipante(dni: string, departamento: string) {
  return {
    dni,
    firstName: 'Nuevo',
    lastName: 'Participante',
    birthDate: NACIMIENTO_ISO,
    sex: 'FEMENINO',
    locality: 'Localidad',
    department: departamento,
  };
}

function cuerpoEquipo(nombre: string, departamento: string) {
  return {
    name: nombre,
    categoryId: CATEGORIA.id,
    locality: 'Localidad',
    department: departamento,
  };
}

function cuerpoInscripcion(dni: string, departamento: string) {
  return {
    ...cuerpoParticipante(dni, departamento),
    categoryId: CATEGORIA_LIBRE.id,
  };
}

const RECETAS: Record<string, Receta> = {
  // --- Participantes ---
  'ParticipantsController.findAll': {
    via: 'LISTADO',
    invocaciones: (ctx) => [
      { etiqueta: 'sin filtros' },
      {
        // Pedir explícitamente el departamento ajeno no puede ser un atajo.
        etiqueta: 'filtrando por el departamento ajeno',
        query: `department=${encodeURIComponent(ctx.ajeno)}`,
      },
      {
        etiqueta: 'buscando el apellido ajeno',
        query: `search=${encodeURIComponent(ctx.uAjeno.participant.lastName)}`,
      },
    ],
  },
  'ParticipantsController.findOne': {
    via: 'LECTURA',
    invocaciones: (ctx) => [
      { etiqueta: 'el propio', params: { id: ctx.uPropio.participant.id } },
      { etiqueta: 'el ajeno', params: { id: ctx.uAjeno.participant.id } },
      { etiqueta: 'uno inexistente', params: { id: ID_INEXISTENTE } },
    ],
  },
  'ParticipantsController.findByDni': {
    via: 'LECTURA',
    invocaciones: (ctx) => [
      { etiqueta: 'el DNI propio', params: { dni: ctx.uPropio.participant.dni } },
      { etiqueta: 'el DNI ajeno', params: { dni: ctx.uAjeno.participant.dni } },
    ],
  },
  'ParticipantsController.create': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'alta en el departamento propio',
        body: cuerpoParticipante('30111222', ctx.propio),
      },
      {
        etiqueta: 'alta en el departamento ajeno',
        body: cuerpoParticipante('30333444', ctx.ajeno),
      },
    ],
  },
  'ParticipantsController.update': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        // El cuidado de R17: los formularios mandan el objeto completo, así que
        // reenviar el mismo departamento no puede romper la edición.
        etiqueta: 'editando el teléfono y reenviando el mismo departamento',
        params: { id: ctx.uPropio.participant.id },
        body: { phone: '3704000111', department: ctx.propio },
      },
      {
        // S03: el PATCH que muda la fila fuera de la jurisdicción.
        etiqueta: 'mudando el propio al departamento ajeno',
        params: { id: ctx.uPropio.participant.id },
        body: { department: ctx.ajeno },
      },
      {
        etiqueta: 'editando el ajeno',
        params: { id: ctx.uAjeno.participant.id },
        body: { phone: '3704000222' },
      },
    ],
  },

  // --- Equipos ---
  'TeamsController.findAll': {
    via: 'LISTADO',
    invocaciones: (ctx) => [
      { etiqueta: 'sin filtros' },
      {
        etiqueta: 'filtrando por el departamento ajeno',
        query: `department=${encodeURIComponent(ctx.ajeno)}`,
      },
    ],
  },
  'TeamsController.findOne': {
    via: 'LECTURA',
    invocaciones: (ctx) => [
      { etiqueta: 'el propio', params: { id: ctx.uPropio.team.id } },
      { etiqueta: 'el ajeno', params: { id: ctx.uAjeno.team.id } },
    ],
  },
  'TeamsController.create': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'alta en el departamento propio',
        body: cuerpoEquipo('Equipo Nuevo Propio', ctx.propio),
      },
      {
        etiqueta: 'alta en el departamento ajeno',
        body: cuerpoEquipo('Equipo Nuevo Ajeno', ctx.ajeno),
      },
    ],
  },
  'TeamsController.update': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'renombrando y reenviando el mismo departamento',
        params: { id: ctx.uPropio.team.id },
        body: { name: 'Renombrado', department: ctx.propio },
      },
      {
        // S03, la otra entidad.
        etiqueta: 'mudando el propio al departamento ajeno',
        params: { id: ctx.uPropio.team.id },
        body: { department: ctx.ajeno },
      },
      {
        etiqueta: 'editando el ajeno',
        params: { id: ctx.uAjeno.team.id },
        body: { name: 'Tocado desde afuera' },
      },
    ],
  },
  'TeamsController.remove': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      { etiqueta: 'borrando el ajeno', params: { id: ctx.uAjeno.team.id } },
      { etiqueta: 'borrando el propio', params: { id: ctx.uPropio.team.id } },
    ],
  },
  'TeamsController.addMember': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'sumando un participante ajeno al equipo propio',
        params: { id: ctx.uPropio.team.id },
        body: { participantId: ctx.uAjeno.participant.id },
      },
      {
        etiqueta: 'sumando el participante propio a un equipo ajeno',
        params: { id: ctx.uAjeno.team.id },
        body: { participantId: ctx.uPropio.participant.id },
      },
    ],
  },
  'TeamsController.removeMember': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'sacando un integrante del equipo ajeno',
        params: {
          id: ctx.uAjeno.team.id,
          participantId: ctx.uAjeno.participant.id,
        },
      },
      {
        etiqueta: 'sacando un integrante del equipo propio',
        params: {
          id: ctx.uPropio.team.id,
          participantId: ctx.uPropio.participant.id,
        },
      },
    ],
  },

  // --- Inscripciones ---
  'InscriptionsController.findAll': {
    via: 'LISTADO',
    invocaciones: (ctx) => [
      { etiqueta: 'sin filtros' },
      {
        etiqueta: 'buscando el QR ajeno',
        query: `search=${encodeURIComponent(ctx.uAjeno.inscription.qrCode)}`,
      },
    ],
  },
  'InscriptionsController.findOne': {
    via: 'LECTURA',
    invocaciones: (ctx) => [
      { etiqueta: 'la propia', params: { id: ctx.uPropio.inscription.id } },
      { etiqueta: 'la ajena', params: { id: ctx.uAjeno.inscription.id } },
    ],
  },
  'InscriptionsController.create': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'alta de una persona nueva en el departamento propio',
        body: cuerpoInscripcion('30555666', ctx.propio),
      },
      {
        // S04, el escenario reproducido en vivo por la revisión: el DNI de un
        // chico del otro departamento, declarando el departamento propio.
        etiqueta:
          'alta con el DNI de un participante ajeno declarando el departamento propio',
        body: cuerpoInscripcion(ctx.uAjeno.participant.dni, ctx.propio),
      },
      {
        etiqueta: 'alta declarando el departamento ajeno',
        body: cuerpoInscripcion('30777888', ctx.ajeno),
      },
    ],
  },
  'InscriptionsController.review': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'revisando la ajena',
        params: { id: ctx.uAjeno.inscription.id },
        body: {},
      },
      {
        etiqueta: 'revisando la propia',
        params: { id: ctx.uPropio.inscription.id },
        body: {},
      },
    ],
  },
  'InscriptionsController.approve': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'aprobando la ajena',
        params: { id: ctx.uAjeno.inscriptionRevisada.id },
      },
      {
        etiqueta: 'aprobando la propia',
        params: { id: ctx.uPropio.inscriptionRevisada.id },
      },
    ],
  },
  'InscriptionsController.reject': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'rechazando la ajena',
        params: { id: ctx.uAjeno.inscription.id },
        body: { rejectionNote: 'Motivo de prueba' },
      },
      {
        etiqueta: 'rechazando la propia',
        params: { id: ctx.uPropio.inscription.id },
        body: { rejectionNote: 'Motivo de prueba' },
      },
    ],
  },

  // --- Documentos (el participante viaja anidado) ---
  'DocumentsController.findByParticipant': {
    via: 'LISTADO',
    invocaciones: (ctx) => [
      {
        etiqueta: 'los del participante propio',
        params: { participantId: ctx.uPropio.participant.id },
      },
      {
        etiqueta: 'los del participante ajeno',
        params: { participantId: ctx.uAjeno.participant.id },
      },
    ],
  },
  'DocumentsController.review': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'revisando el documento ajeno',
        params: { id: ctx.uAjeno.document.id },
        body: { status: 'APROBADO' },
      },
      {
        etiqueta: 'revisando el documento propio',
        params: { id: ctx.uPropio.document.id },
        body: { status: 'APROBADO' },
      },
    ],
  },
  'DocumentsController.upload': {
    via: 'ESCRITURA',
    invocaciones: (ctx) => [
      {
        etiqueta: 'subiendo un documento del participante ajeno',
        body: { participantId: ctx.uAjeno.participant.id, type: 'DNI_FRENTE' },
        adjuntarPdf: true,
      },
      {
        etiqueta: 'subiendo un documento del participante propio',
        body: { participantId: ctx.uPropio.participant.id, type: 'DNI_FRENTE' },
        adjuntarPdf: true,
      },
    ],
  },

  // --- Dashboard: participantes e inscripciones, agregados y anidados ---
  'DashboardController.getStats': {
    via: 'LISTADO',
    invocaciones: () => [{ etiqueta: 'panel de resumen' }],
  },
};

// ===========================================
// Descubrimiento por reflexión
// ===========================================
const CONTROLLERS = [
  ParticipantsController,
  TeamsController,
  InscriptionsController,
  DocumentsController,
  DashboardController,
];

/** `RequestMethod` → verbo de supertest. */
const VERBOS: Record<number, 'get' | 'post' | 'put' | 'delete' | 'patch'> = {
  0: 'get',
  1: 'post',
  2: 'put',
  3: 'delete',
  4: 'patch',
};

interface HandlerDescubierto {
  clave: string;
  verbo: 'get' | 'post' | 'put' | 'delete' | 'patch';
  /** Patrón con los `:param` sin resolver, p. ej. `/participants/:id`. */
  patron: string;
  parametros: string[];
}

function descubrirHandlers(): HandlerDescubierto[] {
  const encontrados: HandlerDescubierto[] = [];

  for (const controller of CONTROLLERS) {
    const prefijo = Reflect.getMetadata(PATH_METADATA, controller) as string;
    const proto = controller.prototype as Record<string, any>;

    for (const nombre of Object.getOwnPropertyNames(proto)) {
      if (nombre === 'constructor') continue;
      const handler = proto[nombre];
      const metodo = Reflect.getMetadata(METHOD_METADATA, handler) as
        | number
        | undefined;
      if (metodo === undefined || VERBOS[metodo] === undefined) continue;

      // Los `@Public()` no tienen usuario y por lo tanto no tienen alcance: su
      // superficie de datos la custodia `public-pii.e2e-spec.ts`, el barrido
      // hermano de éste. Acá no habría contra qué recortar.
      if (Reflect.getMetadata(IS_PUBLIC_KEY, handler)) continue;

      const sufijo = (Reflect.getMetadata(PATH_METADATA, handler) ??
        '') as string;
      const patron = `/${prefijo}/${sufijo}`
        .replace(/\/+/g, '/')
        .replace(/\/$/, '');

      encontrados.push({
        clave: `${controller.name}.${nombre}`,
        verbo: VERBOS[metodo],
        patron,
        parametros: [...patron.matchAll(/:([A-Za-z]+)/g)].map((m) => m[1]),
      });
    }
  }

  return encontrados.sort((a, b) => a.clave.localeCompare(b.clave));
}

// ===========================================
// El módulo de prueba
// ===========================================
function crearPrisma() {
  const participant = tabla(
    'participant',
    UNIVERSOS.map((u) => u.participant),
    (datos) => ({
      ...datos,
      id: `eeeeeeee-eeee-4eee-8eee-${aleatorio()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      inscriptions: [],
      documents: [],
      teamMembers: [],
      results: [],
    }),
  );

  const inscription = tabla(
    'inscription',
    UNIVERSOS.flatMap((u) => [u.inscription, u.inscriptionRevisada]),
    (datos) => ({
      ...datos,
      id: `ffffffff-ffff-4fff-8fff-${aleatorio()}`,
      notes: null,
      rejectionNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewedAt: null,
      approvedAt: null,
      participant: participant._filas.find((f) => f.id === datos.participantId),
      category: CATEGORIA,
      team: null,
      createdBy: null,
      reviewedBy: null,
      approvedBy: null,
    }),
  );

  const team = tabla(
    'team',
    UNIVERSOS.map((u) => u.team),
    (datos) => ({
      ...datos,
      id: `cccccccc-cccc-4ccc-8ccc-${aleatorio()}`,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      discipline: DISCIPLINA,
      category: CATEGORIA,
      members: [],
      inscriptions: [],
      results: [],
      _count: { members: 0, inscriptions: 0, results: 0 },
    }),
  );

  const document = tabla(
    'document',
    UNIVERSOS.map((u) => u.document),
    (datos) => ({
      ...datos,
      id: `bbbbbbbb-bbbb-4bbb-8bbb-${aleatorio()}`,
      rejectionNote: null,
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      participant: participant._filas.find((f) => f.id === datos.participantId),
    }),
  );

  const teamMember = tabla(
    'teamMember',
    UNIVERSOS.map((u) => u.teamMember),
    (datos) => ({
      ...datos,
      id: `abababab-abab-4bab-8bab-${aleatorio()}`,
      participant: participant._filas.find((f) => f.id === datos.participantId),
      team: team._filas.find((f) => f.id === datos.teamId),
    }),
  );

  const prisma: Record<string, any> = {
    participant,
    team,
    inscription,
    document,
    teamMember,
    category: tabla('category', [CATEGORIA, CATEGORIA_LIBRE] as Record<
      string,
      unknown
    >[]),
    competition: tabla('competition', [] as Record<string, unknown>[]),
    zoneDepartment: {
      findMany: jest.fn(({ where }: { where?: Record<string, unknown> } = {}) =>
        Promise.resolve(
          ZONE_DEPARTMENTS.filter((z) => coincide(z, where)).map((z) => ({
            department: z.department,
          })),
        ),
      ),
    },
  };

  /**
   * `$transaction` interactiva: le pasa el mismo doble como `tx`, así las
   * escrituras de adentro se ven afuera —igual que en Postgres cuando la
   * transacción confirma—. El rollback no se modela acá: lo cubre
   * `inscriptions-transaction.e2e-spec.ts`.
   */
  prisma.$transaction = jest.fn((cb: unknown) =>
    typeof cb === 'function'
      ? (cb as (tx: unknown) => unknown)(prisma)
      : Promise.all(cb as Promise<unknown>[]),
  );

  return prisma;
}

/** Sufijo de 12 hex para ids generados, único dentro del test. */
let contador = 0;
function aleatorio(): string {
  contador += 1;
  return String(contador).padStart(12, '0');
}

/** Redis de mentira: guarda en memoria y responde como uno conectado. */
export function crearRedisFalso() {
  const almacen = new Map<string, string>();
  return {
    status: 'ready',
    almacen,
    get: jest.fn((k: string) => Promise.resolve(almacen.get(k) ?? null)),
    setex: jest.fn((k: string, _ttl: number, v: string) => {
      almacen.set(k, v);
      return Promise.resolve('OK');
    }),
    disconnect: jest.fn(),
    on: jest.fn(),
    connect: jest.fn(() => Promise.resolve()),
  };
}

export async function montarApp(): Promise<{
  app: INestApplication<App>;
  jwt: JwtService;
  prisma: ReturnType<typeof crearPrisma>;
  redis: ReturnType<typeof crearRedisFalso>;
}> {
  const prisma = crearPrisma();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      PassportModule.register({ defaultStrategy: 'jwt' }),
      JwtModule.register({ secret: ACCESS_SECRET }),
    ],
    controllers: CONTROLLERS,
    providers: [
      ParticipantsService,
      TeamsService,
      InscriptionsService,
      DocumentsService,
      DashboardService,
      ScopeService,
      FileSignaturePipe,
      JwtStrategy,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: { log: jest.fn() } },
      {
        provide: MinioService,
        useValue: {
          getPresignedUrl: jest.fn(() => Promise.resolve('https://firmada')),
          uploadFile: jest.fn(() => Promise.resolve('participants/clave.pdf')),
        },
      },
      {
        provide: ConfigService,
        useValue: { get: jest.fn((key: string) => CONFIG[key]) },
      },
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  // El service arma su propio cliente de Redis en `onModuleInit`. Se lo
  // reemplaza por uno de mentira: así el test no depende de que haya un Redis
  // corriendo y, sobre todo, se pueden mirar las claves que escribe (S02).
  const dashboard = app.get(DashboardService);
  dashboard.onModuleDestroy();
  const redis = crearRedisFalso();
  (dashboard as unknown as { redisClient: unknown }).redisClient = redis;

  return { app, jwt: moduleFixture.get(JwtService), prisma, redis };
}

export function firmarToken(
  jwt: JwtService,
  rol: Role,
  territorio: { department?: string | null; zone?: string | null } = {},
): string {
  return jwt.sign({
    sub: `usuario-${rol}-${territorio.department ?? territorio.zone ?? 'sin-territorio'}`,
    email: `${rol.toLowerCase()}@juegosevita.gob.ar`,
    role: rol,
    department: territorio.department ?? null,
    zone: territorio.zone ?? null,
    type: 'access',
  });
}

async function invocar(
  app: INestApplication<App>,
  jwt: JwtService,
  h: HandlerDescubierto,
  inv: Invocacion,
  rol: Role,
  territorio: { department?: string | null; zone?: string | null },
) {
  let url = h.patron;
  for (const [clave, valor] of Object.entries(inv.params ?? {})) {
    url = url.replace(`:${clave}`, encodeURIComponent(valor));
  }
  if (inv.query) url += `?${inv.query}`;

  const req = request(app.getHttpServer())
    [h.verbo](url)
    .set('Authorization', `Bearer ${firmarToken(jwt, rol, territorio)}`);

  if (inv.adjuntarPdf) {
    for (const [k, v] of Object.entries(inv.body ?? {})) {
      void req.field(k, String(v));
    }
    return req.attach('file', PDF_MINIMO, 'dni.pdf');
  }

  if (inv.body) return req.send(inv.body);
  return req;
}

/** Contexto para un alcance dado: qué es lo propio y qué es lo ajeno. */
function contextoDe(alcance: AlcanceDePrueba): Contexto {
  const ajenos = UNIVERSOS.filter(
    (u) => !alcance.visibles.includes(u.departamento),
  );
  // El rol sin territorio no tiene nada propio: se le da Pilcomayo para poder
  // ejercitar los handlers, y como no lo alcanza, todo le tiene que dar 404/403.
  const propio =
    UNIVERSOS.find((u) => alcance.visibles.includes(u.departamento)) ??
    U_PILCOMAYO;
  const uAjeno = ajenos[0] ?? U_PIRANE;

  return {
    propio: propio.departamento,
    ajeno: uAjeno.departamento,
    uPropio: propio,
    uAjeno,
  };
}

// ===========================================
// El barrido
// ===========================================
describe('S01 — barrido territorial de los handlers con datos de personas', () => {
  const handlers = descubrirHandlers();

  // -------------------------------------------------
  // 0. Red de seguridad del propio barrido
  // -------------------------------------------------
  describe('el barrido encuentra handlers por reflexión', () => {
    it('no queda vacío y cubre todos los controllers barridos', () => {
      // Si alguien borra handlers, mueve un módulo o rompe la reflexión, el
      // barrido no puede quedarse recorriendo una lista vacía y decir "verde".
      expect(handlers.length).toBeGreaterThanOrEqual(19);

      const sinHandlers = CONTROLLERS.filter(
        (c) => !handlers.some((h) => h.clave.startsWith(`${c.name}.`)),
      ).map((c) => c.name);

      expect(sinHandlers).toEqual([]);
    });

    it('cubre las tres vías, y la de escritura no es testimonial', () => {
      const porVia = (via: Via) =>
        handlers.filter((h) => RECETAS[h.clave]?.via === via);

      expect(porVia('LISTADO').length).toBeGreaterThanOrEqual(5);
      expect(porVia('LECTURA').length).toBeGreaterThanOrEqual(4);
      // La vía que se escapó tres veces es la que más handlers tiene que tener.
      expect(porVia('ESCRITURA').length).toBeGreaterThanOrEqual(9);
    });

    it('todo handler descubierto tiene receta de invocación', () => {
      // Ésta es la cláusula que hace que un endpoint nuevo entre solo: no se
      // saltea en silencio, pone el barrido en rojo hasta que alguien decida
      // cómo ejercitarlo.
      const sinReceta = handlers
        .filter((h) => !RECETAS[h.clave])
        .map((h) => `${h.clave} (${h.verbo.toUpperCase()} ${h.patron})`);

      expect(sinReceta).toEqual([]);
    });

    it('las recetas resuelven todos los parámetros de ruta', () => {
      const faltantes: string[] = [];

      for (const alcance of ALCANCES) {
        const ctx = contextoDe(alcance);
        for (const h of handlers) {
          for (const inv of RECETAS[h.clave].invocaciones(ctx)) {
            for (const p of h.parametros) {
              if (!inv.params?.[p]) {
                faltantes.push(
                  `${h.clave} / "${inv.etiqueta}" no resuelve :${p}`,
                );
              }
            }
          }
        }
      }

      expect([...new Set(faltantes)]).toEqual([]);
    });
  });

  // -------------------------------------------------
  // 1. Control positivo: el barrido realmente llega a cada handler
  // -------------------------------------------------
  describe('control positivo con alcance provincial', () => {
    it('cada handler responde 2xx al menos una vez', async () => {
      // Sin esto, un barrido que le pega a rutas mal armadas cosecharía 404 en
      // todas y estaría "verde" sin haber mirado un solo payload.
      const ctx = contextoDe({
        etiqueta: 'provincial',
        rol: Role.SUPER_ADMIN,
        territorio: {},
        visibles: [PILCOMAYO, PIRANE],
      });
      const mudos: string[] = [];

      for (const h of handlers) {
        // App nueva por handler: las escrituras mutan el universo (un `remove`
        // borra el equipo que el `update` de después necesitaba), y el orden
        // alfabético de los handlers no puede decidir qué se puede probar.
        const { app, jwt } = await montarApp();
        try {
          const estados: number[] = [];
          for (const inv of RECETAS[h.clave].invocaciones(ctx)) {
            const res = await invocar(app, jwt, h, inv, Role.SUPER_ADMIN, {});
            estados.push(res.status);
          }
          if (!estados.some((s) => s >= 200 && s < 300)) {
            mudos.push(
              `${h.clave} nunca respondió 2xx (estados: ${estados.join(', ')})`,
            );
          }
        } finally {
          await app.close();
        }
      }

      expect(mudos).toEqual([]);
    });
  });

  // -------------------------------------------------
  // 2. La propiedad, para cada rol acotado
  // -------------------------------------------------
  describe.each(ALCANCES)('$etiqueta', (alcance: AlcanceDePrueba) => {
    const ctx = contextoDe(alcance);
    /** Todo lo que este usuario NO puede ver, venga por donde venga. */
    const prohibidos = UNIVERSOS.filter(
      (u) => !alcance.visibles.includes(u.departamento),
    ).flatMap(delatoresDe);

    it('ninguna respuesta contiene datos de una fila fuera de su alcance', async () => {
      const fugas: string[] = [];

      for (const h of handlers) {
        const { app, jwt } = await montarApp();
        try {
          for (const inv of RECETAS[h.clave].invocaciones(ctx)) {
            const res = await invocar(
              app,
              jwt,
              h,
              inv,
              alcance.rol,
              alcance.territorio,
            );

            // Un 4xx no filtra nada: el handler cerró la puerta.
            if (res.status >= 400) continue;

            const cuerpo = JSON.stringify(res.body ?? '');
            for (const delator of prohibidos) {
              if (cuerpo.includes(delator)) {
                fugas.push(
                  `[${RECETAS[h.clave].via}] ${h.clave} — "${inv.etiqueta}" ` +
                    `(${h.verbo.toUpperCase()} ${h.patron}) devolvió "${delator}"`,
                );
              }
            }
          }
        } finally {
          await app.close();
        }
      }

      expect(fugas).toEqual([]);
    });
  });
});
