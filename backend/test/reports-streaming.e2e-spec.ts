// ===========================================
// E2E — Reportes en streaming + paginación (T23 / Q5, Q23)
// ===========================================
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Writable } from 'stream';
import request from 'supertest';
import { App } from 'supertest/types';
import * as ExcelJS from 'exceljs';
import compression from 'compression';

import { ReportsController } from '../src/modules/reports/reports.controller';
import {
  ReportsService,
  TAMANIO_LOTE,
} from '../src/modules/reports/reports.service';
import { PrismaService } from '../src/database/prisma.service';

// ===========================================
// Doble de Prisma
// ===========================================

/**
 * Las filas se generan **por página**, no de antemano.
 *
 * Es la única forma honesta de medir memoria: si el doble armara un array de
 * 20.000 objetos para después ir devolviéndolo de a pedazos, el pico de memoria
 * del test mediría el array del test y no el del servicio.
 */
function participanteEn(indice: number) {
  return {
    id: `p${String(indice).padStart(11, '0')}`,
    dni: `4${String(20000000 + indice)}`,
    firstName: 'Juan Ignacio',
    lastName: `Pérez ${String(indice).padStart(6, '0')}`,
    sex: indice % 2 === 0 ? 'MASCULINO' : 'FEMENINO',
    birthDate: new Date('2010-05-15T00:00:00.000Z'),
    department: 'Pilcomayo',
    locality: 'Clorinda',
    phone: '3704123456',
    email: `participante.${indice}@example.com`,
    inscriptions: [
      {
        category: {
          name: 'Sub-14 Masculino',
          discipline: { name: 'Fútbol' },
        },
      },
    ],
  };
}

/** `p00000000123` → 123. Así el doble resuelve el cursor sin guardar estado. */
function indiceDeId(id: string): number {
  return Number(id.slice(1));
}

interface ContadorPrisma {
  llamadas: Array<Record<string, unknown>>;
  /** Se invoca al entrar a cada `findMany`, antes de resolver la pagina. */
  alConsultar?: () => void;
}

/**
 * @param total cuántos participantes "hay" en la base.
 */
function crearPrismaFalso(total: number, contador: ContadorPrisma) {
  return {
    participant: {
      findMany: jest.fn((args: any) => {
        contador.llamadas.push(args);
        contador.alConsultar?.();
        const desde = args.cursor ? indiceDeId(args.cursor.id) + 1 : 0;
        const hasta = Math.min(desde + args.take, total);
        const pagina: unknown[] = [];
        for (let i = desde; i < hasta; i++) {
          pagina.push(participanteEn(i));
        }
        return Promise.resolve(pagina);
      }),
    },
    inscription: { findMany: jest.fn(() => Promise.resolve([])) },
    team: { findMany: jest.fn(() => Promise.resolve([])) },
    match: { findMany: jest.fn(() => Promise.resolve([])) },
  };
}

// ===========================================
// Destino que descarta los bytes
// ===========================================

/**
 * Hace de `res`: cuenta bytes y los tira. `headersSent` arranca en false y pasa
 * a true con el primer write, igual que un `ServerResponse` real — lo necesita
 * la política de error a mitad de stream.
 */
class DestinoNulo extends Writable {
  bytes = 0;
  /** Cuantos chunks se recibieron. Sirve para medir el adelanto. */
  bloques = 0;
  headersSent = false;
  chunks: Buffer[] | null = null;
  /**
   * Se arma en el constructor y no en un getter: `escribirExcel` termina el
   * stream por dentro (lo cierra `workbook.commit()`), así que un getter que
   * recién ahí se suscribe a `finish` se colgaría esperando un evento que ya
   * pasó.
   */
  readonly terminado: Promise<void>;

  /**
   * Simula un cliente lento: difiere el callback de `_write` un tick del
   * event loop en vez de aceptar el chunk en el acto. Sin esto no hay
   * backpressure y el buffer del Readable nunca se llena.
   */
  readonly lento: boolean;

  constructor(opciones?: { guardar?: boolean; lento?: boolean }) {
    super();
    this.lento = opciones?.lento ?? false;
    if (opciones?.guardar) this.chunks = [];
    this.terminado = new Promise<void>((resolve) => {
      this.once('finish', () => resolve());
      this.once('close', () => resolve());
      this.once('error', () => resolve());
    });
  }

  _write(
    chunk: Buffer | string,
    _enc: BufferEncoding,
    cb: (e?: Error | null) => void,
  ) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.headersSent = true;
    this.bloques++;
    this.bytes += buf.length;
    if (this.chunks) this.chunks.push(buf);
    if (this.lento) setImmediate(cb);
    else cb();
  }

  get contenido(): Buffer {
    return Buffer.concat(this.chunks ?? []);
  }
}

/** Deja correr la cola de microtareas y un tick del event loop. */
const proximoTick = () => new Promise((r) => setTimeout(r, 0));

describe('Reportes en streaming (e2e)', () => {
  let app: INestApplication<App>;
  let service: ReportsService;
  let contador: ContadorPrisma;

  async function levantar(total: number, conCompresion = false) {
    contador = { llamadas: [] };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: crearPrismaFalso(total, contador),
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mismo middleware global que monta `main.ts` en T18: los reportes tienen
    // que atravesarlo sin romperse ni bufferizar.
    if (conCompresion) app.use(compression());
    await app.init();
    service = moduleFixture.get(ReportsService);
    return app;
  }

  afterEach(async () => {
    if (app) await app.close();
    jest.clearAllMocks();
  });

  // ===========================================
  // Contrato HTTP: no cambió nada de lo que ve el frontend
  // ===========================================
  describe('contrato HTTP', () => {
    it('el CSV mantiene Content-Type, Content-Disposition y BOM', async () => {
      await levantar(3);
      const res = await request(app.getHttpServer())
        .get('/reports/participants')
        .buffer(true)
        .parse((r, cb) => {
          const partes: Buffer[] = [];
          r.on('data', (c: Buffer) => partes.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(partes)));
        })
        .expect(200);

      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="padron_participantes.csv"',
      );

      const cuerpo = res.body as Buffer;
      // BOM UTF-8: sin esto Excel en Windows muestra "PÃ©rez".
      expect(cuerpo.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));

      const texto = cuerpo.toString('utf8');
      const lineas = texto.replace('﻿', '').split('\n');
      expect(lineas).toHaveLength(4); // encabezado + 3 filas, sin salto final
      expect(lineas[0]).toBe(
        '"DNI","Nombre","Apellido","Sexo","Fecha Nacimiento","Departamento",' +
          '"Localidad","Teléfono","Email","Categorías"',
      );
      expect(lineas[1]).toContain('"Pérez 000000"');
      expect(lineas[1]).toContain('"Fútbol - Sub-14 Masculino"');
      expect(texto.endsWith('\n')).toBe(false);
    });

    it('el CSV escapa las comillas duplicándolas, como antes', async () => {
      await levantar(0);
      const destino = new DestinoNulo({ guardar: true });
      await service.escribirCsv(destino, {
        nombreHoja: 'X',
        headers: ['a'],

        lotes: async function* () {
          yield [['dice "hola"'], [null], [7]];
        },
      });
      expect(destino.contenido.toString('utf8')).toBe(
        '﻿"a"\n"dice ""hola"""\n"null"\n"7"',
      );
    });

    it('el Excel mantiene Content-Type y Content-Disposition', async () => {
      await levantar(3);
      const res = await request(app.getHttpServer())
        .get('/reports/participants?format=xlsx')
        .buffer(true)
        .parse((r, cb) => {
          const partes: Buffer[] = [];
          r.on('data', (c: Buffer) => partes.push(Buffer.from(c)));
          r.on('end', () => cb(null, Buffer.concat(partes)));
        })
        .expect(200);

      expect(res.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="padron_participantes.xlsx"',
      );
      // Firma de un zip: el .xlsx salió completo y no truncado.
      expect((res.body as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');
    });

    it('el Excel generado en streaming se abre y conserva estilos', async () => {
      await levantar(5);
      const destino = new DestinoNulo({ guardar: true });
      await service.escribirExcel(
        destino,
        service.especificacionParticipants(),
      );
      await destino.terminado;

      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(destino.contenido as any);
      const hoja = libro.getWorksheet('Padrón Participantes');
      expect(hoja).toBeDefined();
      expect(hoja!.rowCount).toBe(6); // encabezado + 5 filas
      expect(hoja!.getRow(1).getCell(1).value).toBe('DNI');
      expect(hoja!.getRow(2).getCell(3).value).toBe('Pérez 000000');

      // El estilo sobrevive al WorkbookWriter (`useStyles: true`).
      const celdaEncabezado = hoja!.getRow(1).getCell(1);
      expect(celdaEncabezado.font?.bold).toBe(true);
      expect((celdaEncabezado.fill as any)?.fgColor?.argb).toBe('FF0F4C81');
      expect(hoja!.getRow(1).height).toBe(28);
      expect(hoja!.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      // Cebrado: la 2da fila de datos (índice 1) va gris.
      expect((hoja!.getRow(3).getCell(1).fill as any)?.fgColor?.argb).toBe(
        'FFF8FAFC',
      );
      // El ancho se calcula con el primer lote, no queda en el default.
      expect(hoja!.getColumn(3).width).toBeGreaterThan(12);
    });

    it('un reporte vacío devuelve sólo el encabezado', async () => {
      await levantar(0);
      const destino = new DestinoNulo({ guardar: true });
      await service.escribirExcel(
        destino,
        service.especificacionParticipants(),
      );
      await destino.terminado;

      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(destino.contenido as any);
      expect(libro.getWorksheet('Padrón Participantes')!.rowCount).toBe(1);
    });
  });

  // ===========================================
  // Convivencia con compression() (T18)
  // ===========================================
  describe('compression() en el medio', () => {
    /** Descarga cruda, sin que supertest interprete el cuerpo. */
    function crudo(req: request.Test) {
      return req.buffer(true).parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on('data', (c: Buffer) => partes.push(Buffer.from(c)));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      });
    }

    it('el CSV se comprime y llega entero (2000 filas, 3 lotes)', async () => {
      await levantar(2000, true);
      const res = await crudo(
        request(app.getHttpServer())
          .get('/reports/participants')
          .set('Accept-Encoding', 'gzip'),
      ).expect(200);

      expect(res.headers['content-encoding']).toBe('gzip');
      // Sin Content-Length: la respuesta sale chunked porque el tamaño no se
      // conoce hasta terminar de generarla.
      expect(res.headers['content-length']).toBeUndefined();

      // superagent des-gzipea solo: `res.body` ya viene en claro. Que haya
      // llegado completo y descomprimible prueba que el gzip vio el stream
      // entero (un chunk perdido rompería el CRC final).
      const texto = (res.body as Buffer).toString('utf8');
      const lineas = texto.replace('﻿', '').split('\n');
      expect(lineas).toHaveLength(2001);
      expect(lineas[2000]).toContain('"Pérez 001999"');
    });

    it('el .xlsx no se re-comprime (ya es un zip)', async () => {
      await levantar(500, true);
      const res = await crudo(
        request(app.getHttpServer())
          .get('/reports/participants?format=xlsx')
          .set('Accept-Encoding', 'gzip'),
      ).expect(200);

      // Dos motivos independientes por los que `compression` se aparta: el mime
      // del xlsx no está en la lista de comprimibles, y el controller manda
      // `Cache-Control: no-transform`.
      expect(res.headers['content-encoding']).toBeUndefined();
      expect(res.headers['cache-control']).toContain('no-transform');
      expect((res.body as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');

      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(res.body as any);
      expect(libro.getWorksheet('Padrón Participantes')!.rowCount).toBe(501);
    });

    it('no deja listeners colgados en el gzip al esperar backpressure', async () => {
      // `compression` parchea `res.on` para redirigir 'drain' a zlib, pero no
      // `res.removeListener`. Si el service manejara el drain a mano, cada lote
      // dejaría un listener y Node avisaría a partir del décimo. Con `pipeline`
      // hay uno solo.
      await levantar(20_000, true);
      const avisos: string[] = [];
      const original = process.emitWarning;
      (process as any).emitWarning = (aviso: any, ...resto: any[]) => {
        avisos.push(String(aviso?.name ?? aviso));
        return original.call(process, aviso, ...resto);
      };
      try {
        await crudo(
          request(app.getHttpServer())
            .get('/reports/participants')
            .set('Accept-Encoding', 'gzip'),
        ).expect(200);
      } finally {
        (process as any).emitWarning = original;
      }
      expect(avisos).not.toContain('MaxListenersExceededWarning');
    }, 60_000);
  });

  // ===========================================
  // Paginación por cursor
  // ===========================================
  describe('paginación por cursor', () => {
    it('trae de a 1000 y encadena por cursor, sin OFFSET', async () => {
      await levantar(2500);
      const destino = new DestinoNulo();
      await service.escribirCsv(destino, service.especificacionParticipants());

      // 2500 filas → 1000 + 1000 + 500. El tercer lote viene incompleto, así
      // que no se dispara una cuarta query.
      expect(contador.llamadas).toHaveLength(3);
      for (const args of contador.llamadas) {
        expect(args.take).toBe(TAMANIO_LOTE);
        // Nada de `skip: n` creciente: el salto siempre es 1 (la fila del
        // cursor), que es lo que hace que Postgres no descarte filas.
        expect(args.skip === undefined || args.skip === 1).toBe(true);
      }
      expect(contador.llamadas[0].cursor).toBeUndefined();
      expect(contador.llamadas[1].cursor).toEqual({ id: 'p00000000999' });
      expect(contador.llamadas[2].cursor).toEqual({ id: 'p00000001999' });
    });

    it('el orden termina en `id` para que el cursor sea determinista', async () => {
      await levantar(1);
      const destino = new DestinoNulo();
      await service.escribirCsv(destino, service.especificacionParticipants());

      expect(contador.llamadas[0].orderBy).toEqual([
        { lastName: 'asc' },
        { firstName: 'asc' },
        { id: 'asc' },
      ]);
    });

    it('un total múltiplo exacto del lote no pierde ni repite filas', async () => {
      await levantar(2000);
      const destino = new DestinoNulo({ guardar: true });
      await service.escribirCsv(destino, service.especificacionParticipants());

      const lineas = destino.contenido.toString('utf8').split('\n');
      expect(lineas).toHaveLength(2001);
      expect(new Set(lineas).size).toBe(2001);
      expect(lineas[1]).toContain('"Pérez 000000"');
      expect(lineas[2000]).toContain('"Pérez 001999"');
      // 2 lotes llenos + 1 vacío para saber que se terminó.
      expect(contador.llamadas).toHaveLength(3);
    });
  });

  // ===========================================
  // Error a mitad del stream
  // ===========================================
  describe('fallo a mitad del stream', () => {
    /** Espec que revienta después de N lotes. */
    function especQueFalla(lotesOk: number) {
      return {
        nombreHoja: 'Prueba',
        headers: ['a', 'b'],

        lotes: async function* () {
          for (let l = 0; l < lotesOk; l++) {
            yield Array.from({ length: 10 }, (_, i) => [l, i]);
          }
          throw new Error('la base se cayó en el lote 15');
        },
      };
    }

    it('si falla antes del primer byte, relanza para que Nest responda 500', async () => {
      await levantar(0);
      const destino = new DestinoNulo();
      await expect(
        service.escribirCsv(destino, especQueFalla(0)),
      ).rejects.toThrow('la base se cayó');
      expect(destino.headersSent).toBe(false);
    });

    it('si falla con la respuesta ya iniciada, destruye la conexión', async () => {
      await levantar(0);
      const destino = new DestinoNulo();
      const errores: Error[] = [];
      destino.on('error', (e) => errores.push(e));

      // No relanza: con los headers ya mandados, un throw sólo lograría que
      // Nest intente escribir un JSON de error sobre un archivo a medio bajar.
      await service.escribirCsv(destino, especQueFalla(15));
      // `destroy(err)` emite 'error' en el tick siguiente, no en el acto.
      await proximoTick();

      expect(destino.headersSent).toBe(true);
      expect(destino.destroyed).toBe(true);
      expect(errores[0]?.message).toContain('la base se cayó');
      // Lo importante: la respuesta NO se cerró prolijamente. Sin
      // `Content-Length` y sin el chunk final, el cliente ve una descarga
      // fallida en vez de un padrón truncado que parece válido.
      expect(destino.writableFinished).toBe(false);
    });

    it('lo mismo vale para el Excel', async () => {
      await levantar(0);
      const destino = new DestinoNulo();
      destino.on('error', () => undefined);
      await service.escribirExcel(destino, especQueFalla(3));
      await proximoTick();
      expect(destino.destroyed).toBe(true);
    });
  });

  // ===========================================
  // DoD: el reporte sale entrelazado con la paginación
  // ===========================================
  //
  // Acá NO se afirma nada sobre bytes de memoria, a propósito.
  //
  // La primera versión de esta suite comparaba `process.memoryUsage().heapUsed`
  // entre una corrida de 2.000 filas y otra de 20.000. Fallaba ~1 de cada 8
  // corridas: `global.gc?.()` es un no-op salvo que Jest arranque con
  // `--expose-gc` (y `test:e2e` no lo hace), así que el delta medía cuándo
  // decidió correr el GC y no cuánto vive a la vez — para el mismo caso de 20K
  // filas se lo vio valer 11,7 / 12,0 / 23 / 64 MB. Subir el umbral hasta que
  // dejara de fallar habría dejado un test verde sin poder de detección: con un
  // techo lo bastante alto también pasa una implementación que bufferiza todo.
  //
  // La evidencia numérica del DoD (RSS < 300MB con 20K filas) vive en
  // `test/reports-memoria-manual.js`, que la mide bien: un proceso limpio por
  // caso, muestreo del pico cada 20ms y la implementación anterior como testigo.
  // Se corre con:
  //
  //     npm run build && node test/reports-memoria-manual.js 20000
  //
  // Lo que queda acá es el **invariante estructural** del que se desprende esa
  // memoria acotada, medido sin depender del GC: los bytes ya salieron al
  // cliente mientras la paginación todavía está en curso. La implementación
  // anterior a T23 falla estos tests con números durísimos (0 bytes entregados),
  // y son deterministas porque cuentan bytes escritos, no páginas de memoria.
  describe('entrelazado de generación y envío (DoD)', () => {
    const FILAS = 20_000;
    const LOTES = FILAS / TAMANIO_LOTE;

    /**
     * Genera el CSV anotando cuántos bytes había recibido el destino en el
     * momento de cada consulta a la base.
     */
    async function generarObservando() {
      await levantar(FILAS);
      const destino = new DestinoNulo();
      const bytesPorConsulta: number[] = [];
      contador.alConsultar = () => bytesPorConsulta.push(destino.bytes);

      await service.escribirCsv(destino, service.especificacionParticipants());
      await destino.terminado;

      return { bytesPorConsulta, total: destino.bytes };
    }

    it('CSV: al pedir la última página ya se entregó casi todo el archivo', async () => {
      const { bytesPorConsulta, total } = await generarObservando();

      // 20.000 filas → 20 páginas llenas + 1 vacía que corta el bucle.
      expect(bytesPorConsulta).toHaveLength(LOTES + 1);

      const alPedirLaUltima = bytesPorConsulta[bytesPorConsulta.length - 1];
      const porcentaje = (alPedirLaUltima / total) * 100;

      console.log(
        `[T23] csv: al pedir la última de ${bytesPorConsulta.length} páginas ` +
          `ya salieron ${(alPedirLaUltima / 1024).toFixed(0)}KB de ` +
          `${(total / 1024).toFixed(0)}KB (${porcentaje.toFixed(1)}%)`,
      );

      // La implementación vieja daba 0% acá: no escribía un byte hasta tener
      // todas las filas. Se exige >90%: con la lectura anticipada acotada a un
      // lote (ver el `Readable.from` del service), sólo puede faltar la cola.
      expect(porcentaje).toBeGreaterThan(90);
    }, 120_000);

    it('CSV: el envío arranca antes de la segunda página', async () => {
      const { bytesPorConsulta } = await generarObservando();

      // Primera consulta: todavía no salió nada, y está bien — el encabezado se
      // escribe recién cuando la primera página respondió, justamente para poder
      // devolver un 500 limpio si la base falla (ver `abortar`).
      expect(bytesPorConsulta[0]).toBe(0);
      // Segunda consulta: el encabezado y la primera página ya viajaron.
      expect(bytesPorConsulta[1]).toBeGreaterThan(0);
      // Y de ahí en más crece en cada página, sin mesetas.
      for (let i = 2; i < bytesPorConsulta.length; i++) {
        expect(bytesPorConsulta[i]).toBeGreaterThan(bytesPorConsulta[i - 1]);
      }
    }, 120_000);

    /**
     * El xlsx NO se entrelaza con el envío, y conviene decirlo: medido, durante
     * las 21 consultas salen 49 bytes (la cabecera zip de `theme1.xml`) y el
     * resto viaja recién en `workbook.commit()`. Archiver retiene la salida
     * comprimida de una entrada hasta cerrarla.
     *
     * No es un problema, y explica por qué el DoD igual se cumple con holgura:
     * lo que se evita al streamear el xlsx no son los bytes comprimidos —0,9MB
     * para 20K filas, 4,6MB para 100K, calderilla— sino el **árbol de celdas**,
     * que es lo caro: cada celda es un objeto con fuente, alineación, relleno y
     * cuatro bordes. Eso es lo que se mide acá.
     *
     * `WorksheetWriter._rows` es el buffer de filas todavía no serializadas.
     * `row.commit()` las vuelca a XML y las saca de ese array, así que entre
     * lote y lote tiene que estar en cero. Si alguien borrara el `row.commit()`
     * del service, acá se verían 20.000 filas vivas y el test rompe — que es
     * exactamente la regresión que arruinaría la memoria.
     */
    it('xlsx: el workbook no acumula filas (se commitean lote a lote)', async () => {
      await levantar(FILAS);

      const hojas: any[] = [];
      const addWorksheetOriginal =
        ExcelJS.stream.xlsx.WorkbookWriter.prototype.addWorksheet;
      const espia = jest
        .spyOn(ExcelJS.stream.xlsx.WorkbookWriter.prototype, 'addWorksheet')
        .mockImplementation(function (this: any, ...args: any[]) {
          const hoja = addWorksheetOriginal.apply(this, args as any);
          hojas.push(hoja);
          return hoja;
        });

      const destino = new DestinoNulo();
      let maxFilasVivas = 0;
      contador.alConsultar = () => {
        const vivas: number = hojas[0]?._rows?.length ?? 0;
        if (vivas > maxFilasVivas) maxFilasVivas = vivas;
      };

      try {
        await service.escribirExcel(
          destino,
          service.especificacionParticipants(),
        );
        await destino.terminado;
      } finally {
        espia.mockRestore();
      }

      console.log(
        `[T23] xlsx: ${FILAS} filas generadas (${(destino.bytes / 1024).toFixed(
          0,
        )}KB), máximo de filas sin commitear en la hoja: ${maxFilasVivas}`,
      );

      expect(hojas).toHaveLength(1);
      expect(destino.bytes).toBeGreaterThan(0);
      // En la práctica da 0. Se afirma "menos que un lote" para no atarse a un
      // detalle interno de ExcelJS; alcanza y sobra para detectar la regresión,
      // que daría 20.000.
      expect(maxFilasVivas).toBeLessThan(TAMANIO_LOTE);
    }, 120_000);

    it('la paginación no se adelanta más de un lote al envío', async () => {
      // Cuenta cuántas páginas llegó a pedir el service por encima de los
      // bloques que ya entregó: es la cota de filas vivas, expresada en lotes.
      //
      // Verificado mutando el service: si se juntan todas las páginas antes de
      // escribir —la implementación previa a T23— esto da 20 y el test rompe.
      // El destino va en modo lento para que el caso pase por el camino de
      // backpressure y no sólo por el de sumidero instantáneo.
      await levantar(FILAS);
      const destino = new DestinoNulo({ lento: true });
      let consultas = 0;
      let maxAdelanto = 0;
      contador.alConsultar = () => {
        consultas++;
        // `bytes / total` no sirve acá; se compara contra bloques entregados.
        const bloquesEntregados = destino.bloques;
        const adelanto = consultas - bloquesEntregados;
        if (adelanto > maxAdelanto) maxAdelanto = adelanto;
      };

      await service.escribirCsv(destino, service.especificacionParticipants());

      console.log(
        `[T23] adelanto máximo de la paginación: ${maxAdelanto} lote(s)`,
      );
      // 2 = el lote que se está procesando + el encabezado, que sale como un
      // bloque aparte. Con objectMode daba 16.
      expect(maxAdelanto).toBeLessThanOrEqual(2);
    }, 120_000);
  });
});
