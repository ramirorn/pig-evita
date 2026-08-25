// ===========================================
// E2E — PII en la auditoría: clasificación y filas históricas (R12)
// ===========================================
//
// El sanitizador de T25 redactaba secretos y enmascaraba `dni`, `email`,
// `phone`, `address` y `birthDate`, pero **no clasificaba** `firstName`,
// `lastName`, `locality` ni `department`. O sea que la misma fila de
// `audit_logs` que guardaba `password: [REDACTED]` y `dni: ******56` guardaba
// al lado, en texto plano, "Ana Gómez, Clorinda, Pilcomayo". En un padrón de
// menores de una provincia chica, nombre + apellido + localidad identifican
// tan bien como el documento: la fila seguía siendo un dossier.
//
// Segunda mitad del problema: las filas escritas **antes** del sanitizador
// tienen el body crudo de cada POST/PATCH. Ampliar la clasificación no las
// toca. La decisión tomada es re-enmascarar en vez de purgar (el porqué está
// en `src/modules/audit/audit-pii-backfill.ts`), y esta suite la ejercita con
// un doble que **guarda de verdad** lo que se escribe: el conteo de filas con
// PII cruda antes y después sale de recorrer la tabla, no de una constante.
import {
  sanitizeAuditChanges,
  contienePiiCruda,
  REDACTED,
} from '../src/modules/audit/audit-sanitizer';
import {
  reenmascararPiiHistorica,
  type ClienteBackfill,
  type FilaAuditoria,
} from '../src/modules/audit/audit-pii-backfill';

// -------------------------------------------------
// 1. La clasificación que faltaba
// -------------------------------------------------
describe('Sanitizador de auditoría — campos que faltaban (R12)', () => {
  const PAYLOAD = {
    firstName: 'Ana',
    lastName: 'Gómez',
    locality: 'Clorinda',
    department: 'Pilcomayo',
  };

  it('enmascara los cuatro campos del hallazgo', () => {
    const salida = sanitizeAuditChanges(PAYLOAD)!;

    expect(salida.firstName).toBe('A***');
    expect(salida.lastName).toBe('G***');
    expect(salida.locality).toBe('C***');
    expect(salida.department).toBe('P***');
  });

  it('ninguno de los valores originales sobrevive en el JSON serializado', () => {
    const serializado = JSON.stringify(sanitizeAuditChanges(PAYLOAD));

    for (const valor of Object.values(PAYLOAD)) {
      expect(serializado).not.toContain(valor);
    }
  });

  it('también los enmascara anidados, no sólo en el primer nivel', () => {
    const salida = sanitizeAuditChanges({
      participante: {
        datos: { firstName: 'Ana', lastName: 'Gómez' },
        domicilio: { locality: 'Clorinda', department: 'Pilcomayo' },
      },
      equipo: [{ lastName: 'Fernández' }],
    })!;

    const serializado = JSON.stringify(salida);
    expect(serializado).not.toContain('Ana');
    expect(serializado).not.toContain('Gómez');
    expect(serializado).not.toContain('Clorinda');
    expect(serializado).not.toContain('Pilcomayo');
    expect(serializado).not.toContain('Fernández');
  });

  it('cubre los sinónimos en castellano que usan los formularios', () => {
    const salida = sanitizeAuditChanges({
      nombre: 'Ana',
      apellido: 'Gómez',
      localidad: 'Clorinda',
      departamento: 'Pilcomayo',
    })!;

    expect(Object.values(salida)).toEqual(['A***', 'G***', 'C***', 'P***']);
  });

  it('conserva la inicial: la fila sigue sirviendo para correlacionar', () => {
    // Enmascarar no es borrar. Dos altas del mismo apellido siguen siendo
    // distinguibles de dos altas de apellidos distintos, que es lo que hace
    // útil a la tabla cuando hay que investigar un incidente.
    const a = sanitizeAuditChanges({ lastName: 'Gómez' })!;
    const b = sanitizeAuditChanges({ lastName: 'Gómez' })!;
    const c = sanitizeAuditChanges({ lastName: 'Ramírez' })!;

    expect(a.lastName).toBe(b.lastName);
    expect(a.lastName).not.toBe(c.lastName);
  });

  it('no rompe lo que ya andaba: `name` de catálogo no es PII', () => {
    // `name` a secas es el nombre de una disciplina, una categoría o una sede.
    // Enmascararlo dejaría la auditoría de los catálogos ilegible sin proteger
    // a nadie.
    const salida = sanitizeAuditChanges({
      name: 'Fútbol 11',
      password: 'Secreta-123',
      dni: '40123456',
      email: 'ana@juegosevita.gob.ar',
    })!;

    expect(salida.name).toBe('Fútbol 11');
    expect(salida.password).toBe(REDACTED);
    expect(salida.dni).toBe('******56');
    expect(salida.email).toBe('a***@juegosevita.gob.ar');
  });

  it('es idempotente: sanear lo ya saneado no lo degrada', () => {
    // Es la propiedad que hace segura la migración de las filas históricas: se
    // puede reintentar sin miedo a comerse un carácter en cada vuelta.
    const unaVez = sanitizeAuditChanges(PAYLOAD);
    const dosVeces = sanitizeAuditChanges(unaVez);

    expect(dosVeces).toEqual(unaVez);
  });
});

// -------------------------------------------------
// 2. El detector que se usa para contar
// -------------------------------------------------
describe('contienePiiCruda (R12)', () => {
  it('reconoce PII en claro a cualquier profundidad', () => {
    expect(contienePiiCruda({ firstName: 'Ana' })).toBe(true);
    expect(contienePiiCruda({ a: { b: { dni: '40123456' } } })).toBe(true);
    expect(contienePiiCruda({ lista: [{ email: 'x@y.com' }] })).toBe(true);
    expect(contienePiiCruda({ password: 'Secreta-123' })).toBe(true);
  });

  it('no marca lo que ya está enmascarado', () => {
    expect(contienePiiCruda(sanitizeAuditChanges({ firstName: 'Ana' }))).toBe(
      false,
    );
    expect(
      contienePiiCruda(
        sanitizeAuditChanges({ dni: '40123456', email: 'a@b.gob.ar' }),
      ),
    ).toBe(false);
  });

  it('no marca campos sensibles con valor nulo', () => {
    expect(contienePiiCruda({ dni: null, phone: null })).toBe(false);
  });

  it('no marca payloads sin PII', () => {
    expect(contienePiiCruda({ name: 'Fútbol', isActive: true })).toBe(false);
  });
});

// -------------------------------------------------
// 3. La migración sobre las filas históricas
// -------------------------------------------------

/**
 * Tabla `audit_logs` en memoria con las filas tal como quedaron **antes** del
 * sanitizador: el body crudo de cada request.
 */
function filasHistoricas(): Array<
  FilaAuditoria & {
    userId: string | null;
    action: string;
    entity: string;
    ipAddress: string;
    createdAt: Date;
  }
> {
  return [
    {
      id: 'a1',
      userId: 'u1',
      action: 'CREATE',
      entity: 'participants',
      ipAddress: '10.0.0.1',
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
      changes: {
        dni: '40123456',
        firstName: 'Ana',
        lastName: 'Gómez',
        locality: 'Clorinda',
        department: 'Pilcomayo',
        email: 'ana.gomez@example.com',
        phone: '3704123456',
        address: 'Belgrano 123',
      },
    },
    {
      id: 'a2',
      userId: 'u2',
      action: 'CREATE',
      entity: 'users',
      ipAddress: '10.0.0.2',
      createdAt: new Date('2026-05-02T10:00:00.000Z'),
      changes: {
        email: 'coordinador@juegosevita.gob.ar',
        password: 'Secreta-123',
        firstName: 'Luis',
        lastName: 'Ramírez',
      },
    },
    {
      id: 'a3',
      userId: 'u1',
      action: 'UPDATE',
      entity: 'teams',
      ipAddress: '10.0.0.3',
      createdAt: new Date('2026-05-03T10:00:00.000Z'),
      changes: {
        name: 'Los Pumas',
        miembros: [
          { firstName: 'Juan', lastName: 'Pérez', dni: '45678901' },
          { firstName: 'Sofía', lastName: 'López', dni: '45678902' },
        ],
      },
    },
    {
      id: 'a4',
      userId: null,
      action: 'LOGIN_FAILED',
      entity: 'auth',
      ipAddress: '10.0.0.4',
      createdAt: new Date('2026-05-04T10:00:00.000Z'),
      changes: null,
    },
    {
      id: 'a5',
      userId: 'u3',
      action: 'UPDATE',
      entity: 'disciplines',
      ipAddress: '10.0.0.5',
      createdAt: new Date('2026-05-05T10:00:00.000Z'),
      // Fila sin PII: la migración no tiene que tocarla.
      changes: { name: 'Fútbol 11', isActive: false },
    },
  ];
}

/**
 * Doble de Prisma que **guarda** los updates. Es la diferencia entre medir la
 * migración y creerle: si `reenmascararPiiHistorica` no escribiera, el conteo
 * "después" seguiría dando 3.
 */
function crearTabla(filas: ReturnType<typeof filasHistoricas>) {
  const updates: string[] = [];

  const cliente: ClienteBackfill = {
    auditLog: {
      findMany: jest.fn((args) => {
        const ordenadas = [...filas].sort((a, b) => a.id.localeCompare(b.id));
        const desde = args.cursor
          ? ordenadas.findIndex((f) => f.id === args.cursor!.id) + 1
          : 0;
        return Promise.resolve(
          ordenadas
            .slice(desde, desde + args.take)
            .map((f) => ({ id: f.id, changes: f.changes })),
        );
      }),
      update: jest.fn((args) => {
        const fila = filas.find((f) => f.id === args.where.id)!;
        fila.changes = args.data.changes;
        updates.push(args.where.id);
        return Promise.resolve(fila);
      }),
    },
  };

  return { cliente, updates };
}

const contarConPii = (filas: ReturnType<typeof filasHistoricas>) =>
  filas.filter((f) => contienePiiCruda(f.changes)).length;

describe('Migración de enmascarado de la PII histórica (R12)', () => {
  it('deja en cero el conteo de filas con PII cruda', async () => {
    const filas = filasHistoricas();
    const { cliente } = crearTabla(filas);

    const antes = contarConPii(filas);
    expect(antes).toBe(3); // a1, a2 y a3

    const resultado = await reenmascararPiiHistorica(cliente, {
      tamanioLote: 2, // fuerza varias vueltas del cursor
    });

    const despues = contarConPii(filas);

    // El conteo antes/después que pide el DoD, medido sobre la tabla.
    expect(despues).toBe(0);
    expect(resultado.leidas).toBe(4); // las 4 con `changes` no nulo
    expect(resultado.reescritas).toBe(3);
  });

  it('la PII queda enmascarada, no borrada', async () => {
    const filas = filasHistoricas();
    const { cliente } = crearTabla(filas);

    await reenmascararPiiHistorica(cliente);

    const a1 = filas.find((f) => f.id === 'a1')!.changes as Record<
      string,
      unknown
    >;
    expect(a1.dni).toBe('******56');
    expect(a1.firstName).toBe('A***');
    expect(a1.lastName).toBe('G***');
    expect(a1.locality).toBe('C***');
    expect(a1.department).toBe('P***');
    expect(a1.email).toBe('a***@example.com');
    expect(a1.address).toBe('[PII]');
  });

  it('los secretos históricos se redactan', async () => {
    const filas = filasHistoricas();
    const { cliente } = crearTabla(filas);

    await reenmascararPiiHistorica(cliente);

    const a2 = filas.find((f) => f.id === 'a2')!.changes as Record<
      string,
      unknown
    >;
    expect(a2.password).toBe(REDACTED);
    expect(JSON.stringify(filas)).not.toContain('Secreta-123');
  });

  it('también baja a los arrays anidados', async () => {
    const filas = filasHistoricas();
    const { cliente } = crearTabla(filas);

    await reenmascararPiiHistorica(cliente);

    const serializado = JSON.stringify(
      filas.find((f) => f.id === 'a3')!.changes,
    );
    expect(serializado).not.toContain('45678901');
    expect(serializado).not.toContain('Pérez');
    // La estructura del cambio sobrevive: se sigue sabiendo qué se tocó.
    expect(serializado).toContain('Los Pumas');
    expect(serializado).toContain('miembros');
  });

  it('retención declarada: no se borra ninguna fila ni ninguna columna', async () => {
    const filas = filasHistoricas();
    const { cliente } = crearTabla(filas);

    await reenmascararPiiHistorica(cliente);

    expect(filas).toHaveLength(5);
    for (const fila of filas) {
      expect(fila.action).toBeDefined();
      expect(fila.entity).toBeDefined();
      expect(fila.ipAddress).toBeDefined();
      expect(fila.createdAt).toBeInstanceOf(Date);
    }
    // La fila que ya estaba limpia queda igual.
    expect(filas.find((f) => f.id === 'a5')!.changes).toEqual({
      name: 'Fútbol 11',
      isActive: false,
    });
  });

  it('no reescribe lo que ya está limpio (idempotente)', async () => {
    const filas = filasHistoricas();
    const { cliente, updates } = crearTabla(filas);

    await reenmascararPiiHistorica(cliente);
    expect(updates).toEqual(['a1', 'a2', 'a3']);

    const segunda = await reenmascararPiiHistorica(cliente);
    expect(segunda.reescritas).toBe(0);
    expect(updates).toEqual(['a1', 'a2', 'a3']);
  });

  it('el corte por fecha deja fuera lo posterior', async () => {
    const filas = filasHistoricas();
    const { cliente } = crearTabla(filas);

    // El doble ignora el `where`, así que lo que se verifica acá es que la
    // opción viaja hasta la consulta: sin eso, correr la migración acotada a
    // "lo anterior al deploy" no sería posible.
    await reenmascararPiiHistorica(cliente, {
      hasta: new Date('2026-06-01T00:00:00.000Z'),
    });

    const args = (cliente.auditLog.findMany as jest.Mock).mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(args.where.createdAt).toEqual({
      lt: new Date('2026-06-01T00:00:00.000Z'),
    });
  });
});
