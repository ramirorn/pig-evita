// ===========================================
// Escritura de reportes en streaming (CSV y Excel)
// ===========================================
//
// El pipeline es de a lotes de punta a punta: Prisma (lotes de 1000) → filas →
// respuesta. El pico de memoria depende del tamaño del lote, no del total.
import { Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import { toCsvLine } from './report-format';
import type { DestinoReporte, EspecificacionReporte } from './report.types';

const encadenar = promisify(pipeline);

/**
 * Escribe una `EspecificacionReporte` en un destino. No sabe qué reporte es ni
 * de dónde salen las filas: eso lo define cada archivo de `definitions/`.
 */
export class ReportWriter {
  private readonly logger = new Logger(ReportWriter.name);

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

    const aLinea = toCsvLine;
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
}
