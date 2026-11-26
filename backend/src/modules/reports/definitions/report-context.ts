// ===========================================
// Lo que necesita una definición de reporte
// ===========================================
import type { PrismaService } from '../../../database/prisma.service';
import type { ScopeService } from '../../../common/scope';

/**
 * Dependencias de las definiciones: la base y el recorte territorial. Son
 * funciones y no providers porque no guardan estado; `ReportsService` les pasa
 * lo suyo.
 */
export interface ReportContext {
  prisma: PrismaService;
  scope: ScopeService;
}

/**
 * Cuántas filas se traen de la base por vuelta: pocas idas a Postgres (20 para
 * 20.000 filas) y un lote de pocos MB.
 */
export const TAMANIO_LOTE = 1000;
