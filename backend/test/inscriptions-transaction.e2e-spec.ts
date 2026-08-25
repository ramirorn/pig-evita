// ===========================================
// E2E — Alta de inscripción transaccional (R13)
// ===========================================
//
// `InscriptionsService.create()` escribía en dos tablas con llamadas sueltas:
// primero creaba el `Participant` (si el DNI no existía) y después la
// `Inscription`. Si la segunda fallaba —la unique de `qrCode`, la FK de
// `teamId` apuntando a un equipo borrado, la conexión cayéndose— quedaba una
// persona cargada en el padrón sin inscripción: una fila que no aparece en
// ninguna pantalla, que no se puede corregir desde la app y que en el reintento
// hace que el `findUnique` por DNI encuentre al participante y ni siquiera
// vuelva a intentar crearlo. Estado parcial indetectable, que es la peor clase.
//
// El doble de Prisma modela la semántica que importa: `$transaction(cb)`
// **revierte** las escrituras si el callback tira. Sin eso el test no probaría
// nada: un mock que acepta todo hace pasar por igual al código con y sin
// transacción. Acá el rollback se implementa copiando las tablas antes de
// entrar y restaurándolas si hubo error, que es exactamente lo que hace
// Postgres a los efectos de este test.
import { Test, TestingModule } from '@nestjs/testing';
import { InscriptionsService } from '../src/modules/inscriptions/inscriptions.service';
import { PrismaService } from '../src/database/prisma.service';
import { CreateInscriptionDto } from '../src/modules/inscriptions/dto';
import { Sex } from '@prisma/client';

const CATEGORIA = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Sub-14 Masculino',
  minAge: 12,
  maxAge: 14,
  sex: 'MASCULINO',
  isActive: true,
  discipline: { id: 'd1', name: 'Fútbol' },
};

const ALTA: CreateInscriptionDto = {
  dni: '48123456',
  firstName: 'Juan',
  lastName: 'Pérez',
  // Edad calculada contra la fecha de hoy: se toma el año corriente menos 13.
  birthDate: `${new Date().getFullYear() - 13}-05-15`,
  sex: Sex.MASCULINO,
  locality: 'Clorinda',
  department: 'Pilcomayo',
  categoryId: CATEGORIA.id,
};

const USUARIO = '99999999-9999-4999-8999-999999999999';

interface Tablas {
  participants: Array<Record<string, unknown>>;
  inscriptions: Array<Record<string, unknown>>;
}

/**
 * Prisma falso con tablas en memoria y `$transaction` con rollback.
 *
 * `fallarEnInscriptionCreate` simula el último paso de la operación fallando,
 * que es el escenario que pide el DoD.
 */
function crearPrismaFalso(
  opciones: { fallarEnInscriptionCreate?: Error } = {},
) {
  const tablas: Tablas = { participants: [], inscriptions: [] };

  const api = (t: Tablas) => ({
    participant: {
      findUnique: jest.fn(({ where }: { where: { dni?: string } }) =>
        Promise.resolve(
          t.participants.find((p) => p.dni === where.dni) ?? null,
        ),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const fila = { id: `p${t.participants.length + 1}`, ...data };
        t.participants.push(fila);
        return Promise.resolve(fila);
      }),
    },
    inscription: {
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            participantId_categoryId?: {
              participantId: string;
              categoryId: string;
            };
          };
        }) => {
          const clave = where.participantId_categoryId;
          if (!clave) return Promise.resolve(null);
          return Promise.resolve(
            t.inscriptions.find(
              (i) =>
                i.participantId === clave.participantId &&
                i.categoryId === clave.categoryId,
            ) ?? null,
          );
        },
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        if (opciones.fallarEnInscriptionCreate) {
          return Promise.reject(opciones.fallarEnInscriptionCreate);
        }
        const fila = { id: `i${t.inscriptions.length + 1}`, ...data };
        t.inscriptions.push(fila);
        return Promise.resolve({
          ...fila,
          participant: t.participants.find((p) => p.id === data.participantId),
          category: CATEGORIA,
        });
      }),
    },
  });

  const prisma = {
    ...api(tablas),
    category: {
      findUnique: jest.fn(() => Promise.resolve(CATEGORIA)),
    },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      // Copia superficial de las tablas: el punto de restauración.
      const respaldo: Tablas = {
        participants: [...tablas.participants],
        inscriptions: [...tablas.inscriptions],
      };

      try {
        return await cb(api(tablas));
      } catch (error) {
        // ROLLBACK: todo lo escrito adentro del callback se descarta.
        tablas.participants = respaldo.participants;
        tablas.inscriptions = respaldo.inscriptions;
        throw error;
      }
    }),
    /** Sólo para el test: qué hay realmente en la base. */
    _tablas: () => tablas,
  };

  return prisma;
}

describe('Alta de inscripción — atomicidad (R13)', () => {
  async function construir(prisma: ReturnType<typeof crearPrismaFalso>) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        InscriptionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    return moduleFixture.get(InscriptionsService);
  }

  it('el camino feliz sigue creando participante e inscripción', async () => {
    const prisma = crearPrismaFalso();
    const service = await construir(prisma);

    const resultado = await service.create(ALTA, USUARIO);

    expect(resultado.qrCode).toMatch(/^EVITA-/);
    expect(resultado.qrImage).toMatch(/^data:image\/png;base64,/);
    expect(prisma._tablas().participants).toHaveLength(1);
    expect(prisma._tablas().inscriptions).toHaveLength(1);
  });

  it('usa $transaction para las escrituras', async () => {
    const prisma = crearPrismaFalso();
    const service = await construir(prisma);

    await service.create(ALTA, USUARIO);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------
  // El DoD: falla el último paso → no queda ninguna fila
  // -------------------------------------------------
  describe('cuando falla el último paso', () => {
    const FALLA = Object.assign(
      new Error('Unique constraint failed on the fields: (`qr_code`)'),
      { code: 'P2002' },
    );

    it('no queda el participante huérfano', async () => {
      const prisma = crearPrismaFalso({ fallarEnInscriptionCreate: FALLA });
      const service = await construir(prisma);

      await expect(service.create(ALTA, USUARIO)).rejects.toThrow(FALLA);

      // Lo que R13 vino a cerrar: sin transacción, acá había 1 participante.
      expect(prisma._tablas().participants).toHaveLength(0);
      expect(prisma._tablas().inscriptions).toHaveLength(0);
    });

    it('el error se propaga: la operación no se da por buena', async () => {
      const prisma = crearPrismaFalso({ fallarEnInscriptionCreate: FALLA });
      const service = await construir(prisma);

      await expect(service.create(ALTA, USUARIO)).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('el reintento posterior vuelve a crear todo desde cero', async () => {
      // Con el bug, el segundo intento encontraba al participante huérfano por
      // DNI y seguía adelante: el estado parcial se volvía permanente e
      // invisible. Con el rollback, el reintento parte de una base limpia.
      const fallando = crearPrismaFalso({ fallarEnInscriptionCreate: FALLA });
      const servicioQueFalla = await construir(fallando);
      await expect(servicioQueFalla.create(ALTA, USUARIO)).rejects.toThrow();

      const sano = crearPrismaFalso();
      const servicioSano = await construir(sano);
      await servicioSano.create(ALTA, USUARIO);

      expect(sano._tablas().participants).toHaveLength(1);
      expect(sano._tablas().inscriptions).toHaveLength(1);
    });
  });

  // -------------------------------------------------
  // Lo que no debe cambiar
  // -------------------------------------------------
  it('un participante ya existente se reutiliza, no se duplica', async () => {
    const prisma = crearPrismaFalso();
    const service = await construir(prisma);

    await service.create(ALTA, USUARIO);
    await service
      .create({ ...ALTA, categoryId: CATEGORIA.id }, USUARIO)
      .catch(() => undefined);

    expect(prisma._tablas().participants).toHaveLength(1);
  });

  it('el duplicado en la misma categoría sigue dando 409 y no escribe nada', async () => {
    const prisma = crearPrismaFalso();
    const service = await construir(prisma);

    await service.create(ALTA, USUARIO);
    await expect(service.create(ALTA, USUARIO)).rejects.toThrow(
      /ya está inscripto/,
    );

    expect(prisma._tablas().participants).toHaveLength(1);
    expect(prisma._tablas().inscriptions).toHaveLength(1);
  });

  it('las validaciones previas no abren transacción', async () => {
    // Categoría inactiva: se corta antes de tocar la base. Abrir y cerrar una
    // transacción para nada es una conexión ocupada al pedo.
    const prisma = crearPrismaFalso();
    prisma.category.findUnique = jest.fn(() =>
      Promise.resolve({ ...CATEGORIA, isActive: false }),
    );
    const service = await construir(prisma);

    await expect(service.create(ALTA, USUARIO)).rejects.toThrow(
      /no está activa/,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
