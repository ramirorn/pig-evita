// ===========================================
// E2E — Inscripción de planteles completos (S21)
// ===========================================
//
// `POST /inscriptions/team` escribe en cuatro tablas por plantel: `Team`, un
// `TeamMember` y una `Inscription` por integrante, más los `Participant` que no
// existieran. Con 16 chicos eso son ~50 escrituras, y cualquiera de ellas puede
// fallar.
//
// Lo que este spec protege es que ese conjunto sea **atómico**. Un plantel a
// medias —un equipo de 13 cuando la disciplina pide 11 titulares + 3 suplentes—
// no se distingue a simple vista de uno completo, no lo corrige el reintento
// (los DNI ya existen y la segunda pasada los reutiliza) y recién se descubre el
// día del partido. Es el mismo razonamiento de R13, multiplicado por 16.
//
// El doble de Prisma implementa `$transaction(cb)` con rollback real: copia las
// tablas antes de entrar y las restaura si el callback tira. Sin eso el test no
// probaría nada, porque un mock que acepta todo hace pasar por igual al código
// con y sin transacción.
import { Test, TestingModule } from '@nestjs/testing';
import { InscriptionsService } from '../src/modules/inscriptions/inscriptions.service';
import { PrismaService } from '../src/database/prisma.service';
import { ALCANCE_PROVINCIAL, ScopeService } from '../src/common/scope';
import { CreateTeamInscriptionDto } from '../src/modules/inscriptions/dto';
import { DisciplineType, Sex } from '@prisma/client';

// Un plantel son 14 imágenes QR. `qrcode` tarda ~17 ms por código en Node suelto
// pero ~650 ms bajo el sandbox de Jest (el encoder PNG pasa por zlib), así que el
// camino feliz se come los 5 s de default sin que haya nada lento en el código.
// El costo es del entorno de test, no del endpoint: no se recorta la generación
// de QR para que el test entre.
jest.setTimeout(45_000);

const DISCIPLINA_EQUIPO = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Fútbol 11',
  type: DisciplineType.EQUIPO,
  isActive: true,
  titulares: 11,
  maxSuplentes: 5,
};

const CATEGORIA = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Sub-14 Masculino',
  minAge: 12,
  maxAge: 14,
  sex: Sex.MASCULINO,
  isActive: true,
  disciplineId: DISCIPLINA_EQUIPO.id,
};

const USUARIO = '99999999-9999-4999-8999-999999999999';

/** Año de nacimiento que deja al chico con `edad` años cumplidos hoy. */
function nacidoCon(edad: number): string {
  // Mes/día fijos al 1 de enero: la edad cumplida no depende de cuándo corra el
  // test dentro del año.
  return `${new Date().getFullYear() - edad}-01-01`;
}

function integrante(
  i: number,
  extra: Partial<CreateTeamInscriptionDto['members'][number]> = {},
): CreateTeamInscriptionDto['members'][number] {
  return {
    dni: `4810${String(i).padStart(4, '0')}`,
    firstName: `Jugador${i}`,
    lastName: 'Pérez',
    birthDate: nacidoCon(13),
    sex: Sex.MASCULINO,
    locality: 'Clorinda',
    department: 'Pilcomayo',
    isSubstitute: false,
    ...extra,
  };
}

/** Plantel válido: 11 titulares + 3 suplentes. */
function plantelValido(): CreateTeamInscriptionDto {
  const titulares = Array.from({ length: 11 }, (_, i) => integrante(i + 1));
  const suplentes = Array.from({ length: 3 }, (_, i) =>
    integrante(12 + i, { isSubstitute: true }),
  );
  return {
    disciplineId: DISCIPLINA_EQUIPO.id,
    categoryId: CATEGORIA.id,
    teamName: 'Escuela 123',
    locality: 'Clorinda',
    department: 'Pilcomayo',
    members: [...titulares, ...suplentes],
  };
}

interface Tablas {
  participants: Array<Record<string, any>>;
  teams: Array<Record<string, any>>;
  teamMembers: Array<Record<string, any>>;
  inscriptions: Array<Record<string, any>>;
}

function crearPrismaFalso(
  opciones: {
    disciplina?: Record<string, any> | null;
    categoria?: Record<string, any> | null;
    participantesPrecargados?: Array<Record<string, any>>;
    /** 1-based: en qué `inscription.create` explota la operación. */
    fallarEnInscripcionNro?: number;
  } = {},
) {
  const tablas: Tablas = {
    participants: [...(opciones.participantesPrecargados ?? [])],
    teams: [],
    teamMembers: [],
    inscriptions: [],
  };

  let inscripcionesIntentadas = 0;

  const api = (t: Tablas) => ({
    participant: {
      // S04 — la búsqueda por DNI lleva el filtro territorial adentro del
      // `where`. El doble lo evalúa además del DNI: si sólo matcheara por DNI,
      // un participante ajeno se reutilizaría y el spec quedaría en verde con la
      // fuga puesta.
      findFirst: jest.fn(({ where }: { where: Record<string, any> }) =>
        Promise.resolve(
          t.participants.find((p) => {
            if (where.dni !== undefined && p.dni !== where.dni) return false;
            const dep = where.department;
            if (dep === undefined && !Array.isArray(where.OR)) return true;
            if (Array.isArray(dep?.in)) return dep.in.includes(p.department);
            if (Array.isArray(where.OR)) {
              return where.OR.some(
                (c: any) => c.department?.equals === p.department,
              );
            }
            return true;
          }) ?? null,
        ),
      ),
      create: jest.fn(({ data }: { data: Record<string, any> }) => {
        if (t.participants.some((p) => p.dni === data.dni)) {
          return Promise.reject(
            Object.assign(new Error('Unique constraint failed: (`dni`)'), {
              code: 'P2002',
            }),
          );
        }
        const fila = { id: `p-${data.dni}`, ...data };
        t.participants.push(fila);
        return Promise.resolve(fila);
      }),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: any }) => {
          const fila = t.participants.find((p) => p.id === where.id);
          Object.assign(fila as object, data);
          return Promise.resolve(fila);
        },
      ),
    },
    team: {
      create: jest.fn(({ data }: { data: Record<string, any> }) => {
        const choca = t.teams.some(
          (x) =>
            x.name === data.name &&
            x.disciplineId === data.disciplineId &&
            x.categoryId === data.categoryId,
        );
        if (choca) {
          return Promise.reject(
            Object.assign(new Error('Unique constraint failed'), {
              code: 'P2002',
            }),
          );
        }
        const fila = { id: `t${t.teams.length + 1}`, ...data };
        t.teams.push(fila);
        return Promise.resolve(fila);
      }),
    },
    teamMember: {
      create: jest.fn(({ data }: { data: Record<string, any> }) => {
        const fila = { id: `tm${t.teamMembers.length + 1}`, ...data };
        t.teamMembers.push(fila);
        return Promise.resolve(fila);
      }),
    },
    inscription: {
      findMany: jest.fn(({ where }: { where: Record<string, any> }) =>
        Promise.resolve(
          t.inscriptions
            .filter(
              (i) =>
                i.categoryId === where.categoryId &&
                where.participantId.in.includes(i.participantId),
            )
            .map((i) => ({ participantId: i.participantId })),
        ),
      ),
      create: jest.fn(({ data }: { data: Record<string, any> }) => {
        inscripcionesIntentadas += 1;
        if (inscripcionesIntentadas === opciones.fallarEnInscripcionNro) {
          return Promise.reject(
            Object.assign(
              new Error('Unique constraint failed on the fields: (`qr_code`)'),
              { code: 'P2002' },
            ),
          );
        }
        const fila = {
          id: `i${t.inscriptions.length + 1}`,
          status: 'PENDIENTE',
          ...data,
        };
        t.inscriptions.push(fila);
        return Promise.resolve(fila);
      }),
    },
  });

  // Una sola instancia del API falso, compartida entre el `prisma` de afuera y
  // el `tx` de adentro de la transacción. Si se construyera una por llamada,
  // cada `jest.fn()` sería nuevo y los `toHaveBeenCalledTimes` de los tests
  // contarían siempre cero: verdes que no prueban nada. El rollback sigue
  // funcionando porque los closures leen `t.participants` en cada llamada, y
  // restaurar reasigna esa propiedad sobre el mismo objeto.
  const tx = api(tablas);

  const prisma = {
    ...tx,
    discipline: {
      findUnique: jest.fn(() =>
        Promise.resolve(
          opciones.disciplina === undefined
            ? DISCIPLINA_EQUIPO
            : opciones.disciplina,
        ),
      ),
    },
    category: {
      findUnique: jest.fn(() =>
        Promise.resolve(
          opciones.categoria === undefined ? CATEGORIA : opciones.categoria,
        ),
      ),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      const respaldo: Tablas = {
        participants: [...tablas.participants],
        teams: [...tablas.teams],
        teamMembers: [...tablas.teamMembers],
        inscriptions: [...tablas.inscriptions],
      };
      try {
        return await cb(tx);
      } catch (error) {
        // ROLLBACK.
        tablas.participants = respaldo.participants;
        tablas.teams = respaldo.teams;
        tablas.teamMembers = respaldo.teamMembers;
        tablas.inscriptions = respaldo.inscriptions;
        throw error;
      }
    }),
    _tablas: () => tablas,
  };

  return prisma;
}

async function construir(prisma: ReturnType<typeof crearPrismaFalso>) {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    providers: [
      InscriptionsService,
      ScopeService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  return moduleFixture.get(InscriptionsService);
}

describe('Inscripción de plantel completo (S21)', () => {
  // -------------------------------------------------
  // Camino feliz
  // -------------------------------------------------
  describe('camino feliz', () => {
    it('crea el equipo, los miembros y una inscripción por integrante', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      const r = await service.createTeam(
        plantelValido(),
        USUARIO,
        ALCANCE_PROVINCIAL,
      );

      const t = prisma._tablas();
      expect(t.teams).toHaveLength(1);
      expect(t.teamMembers).toHaveLength(14);
      expect(t.inscriptions).toHaveLength(14);
      expect(t.participants).toHaveLength(14);

      expect(r.totals).toEqual({ titulares: 11, suplentes: 3, total: 14 });
      expect(r.members).toHaveLength(14);
      expect(r.team.name).toBe('Escuela 123');
    });

    it('todas las inscripciones cuelgan del mismo equipo y de la categoría elegida', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      await service.createTeam(plantelValido(), USUARIO, ALCANCE_PROVINCIAL);

      const t = prisma._tablas();
      const equipo = t.teams[0];
      for (const i of t.inscriptions) {
        expect(i.teamId).toBe(equipo.id);
        expect(i.categoryId).toBe(CATEGORIA.id);
        expect(i.createdById).toBe(USUARIO);
      }
    });

    it('cada integrante recibe su propio QR, con el formato del alta individual', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      const r = await service.createTeam(
        plantelValido(),
        USUARIO,
        ALCANCE_PROVINCIAL,
      );

      const codigos = r.members.map((m) => m.qrCode);
      expect(new Set(codigos).size).toBe(14);
      for (const m of r.members) {
        expect(m.qrCode).toMatch(/^EVITA-[0-9A-F]{8}$/);
        expect(m.qrImage).toMatch(/^data:image\/png;base64,/);
      }
    });

    // El DoD: hasta ahora `TeamMember` no distinguía titular de suplente y el
    // plantel entraba como una bolsa plana.
    it('los suplentes quedan con isSubstitute = true y los titulares en false', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      const r = await service.createTeam(
        plantelValido(),
        USUARIO,
        ALCANCE_PROVINCIAL,
      );

      const guardados = prisma._tablas().teamMembers;
      expect(guardados.filter((m) => m.isSubstitute === true)).toHaveLength(3);
      expect(guardados.filter((m) => m.isSubstitute === false)).toHaveLength(
        11,
      );

      // Y la respuesta lo refleja fila por fila, en el orden del request.
      expect(r.members.map((m) => m.isSubstitute)).toEqual([
        ...Array(11).fill(false),
        ...Array(3).fill(true),
      ]);
    });
  });

  // -------------------------------------------------
  // Atomicidad: el DoD central
  // -------------------------------------------------
  describe('cuando falla un integrante a mitad de camino', () => {
    it('no deja basura: ni el equipo, ni los miembros, ni las inscripciones previas', async () => {
      const prisma = crearPrismaFalso({ fallarEnInscripcionNro: 14 });
      const service = await construir(prisma);

      await expect(
        service.createTeam(plantelValido(), USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toMatchObject({ code: 'P2002' });

      const t = prisma._tablas();
      // Sin transacción acá había 1 equipo, 14 miembros, 13 inscripciones y 14
      // participantes: un plantel incompleto que ninguna pantalla marca.
      expect(t.teams).toHaveLength(0);
      expect(t.teamMembers).toHaveLength(0);
      expect(t.inscriptions).toHaveLength(0);
      expect(t.participants).toHaveLength(0);
    });

    it('usa una sola transacción para todo el plantel', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      await service.createTeam(plantelValido(), USUARIO, ALCANCE_PROVINCIAL);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('el reintento posterior parte de una base limpia', async () => {
      const fallando = crearPrismaFalso({ fallarEnInscripcionNro: 14 });
      const servicioQueFalla = await construir(fallando);
      await expect(
        servicioQueFalla.createTeam(
          plantelValido(),
          USUARIO,
          ALCANCE_PROVINCIAL,
        ),
      ).rejects.toThrow();

      const sano = crearPrismaFalso();
      const servicioSano = await construir(sano);
      await servicioSano.createTeam(
        plantelValido(),
        USUARIO,
        ALCANCE_PROVINCIAL,
      );

      expect(sano._tablas().inscriptions).toHaveLength(14);
    });
  });

  // -------------------------------------------------
  // Reutilización de participantes por DNI
  // -------------------------------------------------
  describe('participantes que ya existen', () => {
    const YA_CARGADO = {
      id: 'p-48100001',
      dni: '48100001',
      firstName: 'Jugador1',
      lastName: 'Pérez',
      birthDate: new Date(nacidoCon(13)),
      sex: Sex.MASCULINO,
      locality: 'Clorinda',
      department: 'Pilcomayo',
      phone: null,
      email: null,
      address: null,
    };

    it('se reutilizan por DNI en vez de duplicarse', async () => {
      const prisma = crearPrismaFalso({
        participantesPrecargados: [{ ...YA_CARGADO }],
      });
      const service = await construir(prisma);

      await service.createTeam(plantelValido(), USUARIO, ALCANCE_PROVINCIAL);

      const t = prisma._tablas();
      // 14 integrantes, uno ya estaba ⇒ 13 altas nuevas, no 14.
      expect(t.participants).toHaveLength(14);
      expect(
        t.participants.filter((p) => p.dni === YA_CARGADO.dni),
      ).toHaveLength(1);
      expect(prisma.participant.create).toHaveBeenCalledTimes(13);

      // Y la inscripción del reutilizado apunta a la fila que ya existía.
      expect(
        t.inscriptions.some((i) => i.participantId === YA_CARGADO.id),
      ).toBe(true);
    });

    it('no pisa identidad ni elegibilidad, pero sí actualiza el contacto', async () => {
      // La decisión documentada en el service: `firstName`, `lastName`,
      // `birthDate`, `sex` y `department` del padrón mandan; `phone`, `email`,
      // `address` y `locality` se refrescan con lo que traiga el plantel.
      const prisma = crearPrismaFalso({
        participantesPrecargados: [{ ...YA_CARGADO }],
      });
      const service = await construir(prisma);

      const dto = plantelValido();
      dto.members[0] = integrante(1, {
        firstName: 'NombreNuevo',
        lastName: 'ApellidoNuevo',
        phone: '3704-111111',
      });

      await service.createTeam(dto, USUARIO, ALCANCE_PROVINCIAL);

      const guardado = prisma
        ._tablas()
        .participants.find((p) => p.dni === YA_CARGADO.dni);
      expect(guardado?.firstName).toBe('Jugador1');
      expect(guardado?.lastName).toBe('Pérez');
      expect(guardado?.phone).toBe('3704-111111');
    });

    it('sin cambios de contacto no escribe el participante al pedo', async () => {
      const prisma = crearPrismaFalso({
        participantesPrecargados: [{ ...YA_CARGADO }],
      });
      const service = await construir(prisma);

      await service.createTeam(plantelValido(), USUARIO, ALCANCE_PROVINCIAL);

      expect(prisma.participant.update).not.toHaveBeenCalled();
    });

    it('rechaza nombrando al que ya está inscripto en esa categoría', async () => {
      const prisma = crearPrismaFalso({
        participantesPrecargados: [{ ...YA_CARGADO }],
      });
      // Una inscripción previa del mismo participante en la misma categoría.
      prisma._tablas().inscriptions.push({
        id: 'i0',
        participantId: YA_CARGADO.id,
        categoryId: CATEGORIA.id,
      });
      const service = await construir(prisma);

      await expect(
        service.createTeam(plantelValido(), USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toThrow(/Jugador1 Pérez \(DNI 48100001\)/);

      // Y no quedó nada del intento: la inscripción previa sigue sola.
      expect(prisma._tablas().inscriptions).toHaveLength(1);
      expect(prisma._tablas().teams).toHaveLength(0);
    });
  });

  // -------------------------------------------------
  // Validaciones
  // -------------------------------------------------
  describe('validaciones', () => {
    it('rechaza una disciplina INDIVIDUAL y manda al alta individual', async () => {
      const prisma = crearPrismaFalso({
        disciplina: {
          ...DISCIPLINA_EQUIPO,
          name: 'Ajedrez',
          type: DisciplineType.INDIVIDUAL,
          titulares: null,
          maxSuplentes: null,
        },
      });
      const service = await construir(prisma);

      await expect(
        service.createTeam(plantelValido(), USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toThrow(/INDIVIDUAL.*alta individual/s);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza cuando la cantidad de titulares no coincide', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      const dto = plantelValido();
      // 10 titulares donde la disciplina pide 11.
      dto.members = dto.members
        .filter((m) => m.isSubstitute)
        .concat(dto.members.filter((m) => !m.isSubstitute).slice(0, 10));

      await expect(
        service.createTeam(dto, USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toThrow(/exactamente 11 titulares.*trae 10/s);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza cuando hay más suplentes que los admitidos', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      const dto = plantelValido();
      for (let i = 0; i < 3; i++) {
        dto.members.push(integrante(20 + i, { isSubstitute: true }));
      }

      await expect(
        service.createTeam(dto, USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toThrow(/hasta 5 suplentes.*trae 6/s);
    });

    // Hoy le pasa a casi todas las disciplinas: el 400 explícito es la decisión
    // deliberada de no adivinar el tamaño del plantel.
    it('rechaza con 400 explícito si la disciplina no tiene el plantel configurado', async () => {
      const prisma = crearPrismaFalso({
        disciplina: {
          ...DISCIPLINA_EQUIPO,
          titulares: null,
          maxSuplentes: null,
        },
      });
      const service = await construir(prisma);

      await expect(
        service.createTeam(plantelValido(), USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toThrow(/no tiene configurado el plantel/);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza a quien queda fuera del rango de edad de la categoría', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      const dto = plantelValido();
      // Sub-14 admite 12 a 14: este tiene 17.
      dto.members[5] = integrante(6, { birthDate: nacidoCon(17) });

      await expect(
        service.createTeam(dto, USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toThrow(/Jugador6 Pérez \(DNI 48100006\) tiene 17 años/);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma._tablas().participants).toHaveLength(0);
    });

    it('rechaza a quien no coincide con el sexo de la categoría', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      const dto = plantelValido();
      dto.members[2] = integrante(3, { sex: Sex.FEMENINO });

      await expect(
        service.createTeam(dto, USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toThrow(/es FEMENINO y la categoría/);
    });

    it('rechaza DNI repetidos dentro del mismo plantel', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      const dto = plantelValido();
      dto.members[7] = integrante(1, { isSubstitute: false });

      await expect(
        service.createTeam(dto, USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toThrow(/DNI repetidos: 48100001/);
    });

    it('rechaza más de un capitán', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      const dto = plantelValido();
      dto.members[0].isCaptain = true;
      dto.members[1].isCaptain = true;

      await expect(
        service.createTeam(dto, USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toThrow(/2 capitanes/);
    });

    it('rechaza una categoría que no pertenece a la disciplina elegida', async () => {
      const prisma = crearPrismaFalso({
        categoria: { ...CATEGORIA, disciplineId: 'otra-disciplina' },
      });
      const service = await construir(prisma);

      await expect(
        service.createTeam(plantelValido(), USUARIO, ALCANCE_PROVINCIAL),
      ).rejects.toThrow(/no pertenece a la disciplina/);
    });
  });

  // -------------------------------------------------
  // Alcance territorial (R05)
  // -------------------------------------------------
  describe('alcance territorial', () => {
    const ALCANCE_PILCOMAYO = {
      tipo: 'DEPARTAMENTOS' as const,
      departamentos: ['Pilcomayo'],
    };

    it('deja inscribir dentro del alcance', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      await expect(
        service.createTeam(plantelValido(), USUARIO, ALCANCE_PILCOMAYO),
      ).resolves.toBeDefined();
    });

    // Sólo mirar el departamento del encabezado no alcanzaba: el alta crea
    // participantes con el departamento de cada fila del plantel.
    it('rechaza un integrante de otro departamento aunque el equipo sea del propio', async () => {
      const prisma = crearPrismaFalso();
      const service = await construir(prisma);

      const dto = plantelValido();
      dto.members[9] = integrante(10, { department: 'Formosa' });

      await expect(
        service.createTeam(dto, USUARIO, ALCANCE_PILCOMAYO),
      ).rejects.toThrow(/fuera de tu alcance territorial/);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
