// ===========================================
// Tipos de los reportes
// ===========================================

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
 * Destino al que se escribe el reporte. Se declara estructuralmente (y no como
 * `express.Response`) para poder testear contra un `Writable` cualquiera sin
 * levantar un servidor HTTP.
 */
export interface DestinoReporte {
  write(chunk: string | Buffer): boolean;
  end(): void;
  once(evento: string, listener: (...args: unknown[]) => void): unknown;
  removeListener(
    evento: string,
    listener: (...args: unknown[]) => void,
  ): unknown;
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
