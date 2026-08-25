// ===========================================
// Migración de enmascarado de la PII histórica de AuditLog (R12)
// ===========================================
//
// El sanitizador de T25 protege lo que se escribe **de acá en adelante**. Las
// filas que ya están en `audit_logs` se guardaron antes de que existiera: tienen
// el body crudo de cada POST/PATCH, o sea DNI, email, teléfono, domicilio,
// nombre y apellido de menores, y contraseñas en texto plano de los `POST
// /users` viejos. Ampliar la clasificación (R12) no las toca.
//
// Las dos opciones sobre la mesa eran purgar o re-enmascarar:
//
//   a) **Purga** (`UPDATE audit_logs SET changes = NULL WHERE created_at < X`).
//      Simple y de una sola pasada, pero tira a la basura el único registro que
//      existe de *qué* cambió en cada operación. `AuditLog` es la tabla a la que
//      se recurre cuando hay que reconstruir un incidente meses después; dejarla
//      con acción y entidad pero sin contenido la vuelve un log de accesos.
//
//   b) **Re-enmascarado**: pasar cada fila histórica por el mismo
//      `sanitizeAuditChanges` que usa la escritura. Elegida. El resultado es
//      exactamente el que habría quedado si el sanitizador hubiera existido
//      desde el día uno: los secretos desaparecen, la PII queda enmascarada y
//      la estructura del cambio —qué campos se tocaron— sobrevive.
//
// Retención declarada: las filas **no** se borran. Lo que se elimina es el valor
// sensible dentro de `changes`; `userId`, `action`, `entity`, `entityId`,
// `ipAddress`, `userAgent` y `createdAt` se conservan íntegros por el plazo de
// retención de la auditoría.
//
// La operación es **idempotente**: sanear un payload ya saneado devuelve el
// mismo payload (`maskTail('******56') === '******56'`, `[REDACTED]` clasifica
// como secreto y vuelve a redactarse igual). Se puede correr dos veces sin
// degradar los datos, que es lo que la hace segura de reintentar si se corta a
// mitad.
import { sanitizeAuditChanges } from './audit-sanitizer';

/** Filas que se traen por vuelta. Acotado para no cargar la tabla entera. */
export const TAMANIO_LOTE_BACKFILL = 500;

/** Fila mínima que necesita la migración. */
export interface FilaAuditoria {
  id: string;
  changes: unknown;
}

/**
 * Cliente mínimo que necesita la migración. Se declara estructuralmente para
 * poder correrla contra un doble en los tests sin levantar Postgres.
 */
export interface ClienteBackfill {
  auditLog: {
    findMany(args: {
      where: Record<string, unknown>;
      select: { id: true; changes: true };
      orderBy: { id: 'asc' };
      take: number;
      cursor?: { id: string };
      skip?: number;
    }): Promise<FilaAuditoria[]>;
    update(args: {
      where: { id: string };
      data: { changes: unknown };
    }): Promise<unknown>;
  };
}

export interface ResultadoBackfill {
  /** Filas leídas (las que tenían `changes` no nulo). */
  leidas: number;
  /** Filas que efectivamente cambiaron al sanearse. */
  reescritas: number;
}

/**
 * Recorre `audit_logs` por cursor y reescribe `changes` con su versión saneada.
 *
 * @param prisma cliente Prisma (o doble compatible).
 * @param hasta  opcional: sólo filas anteriores a esta fecha. Sin este corte se
 *               procesa la tabla entera, que es lo correcto para la corrida
 *               inicial: una fila ya saneada no cambia.
 */
export async function reenmascararPiiHistorica(
  prisma: ClienteBackfill,
  opciones: { hasta?: Date; tamanioLote?: number } = {},
): Promise<ResultadoBackfill> {
  const tamanioLote = opciones.tamanioLote ?? TAMANIO_LOTE_BACKFILL;
  // No se filtra por `changes IS NOT NULL` en el `where`: la forma de expresar
  // "json no nulo" cambió entre versiones de Prisma (`DbNull` vs `JsonNull`) y
  // no vale la pena atarse a eso en una migración de una sola corrida. Las
  // filas sin `changes` se descartan abajo, en el bucle.
  const where: Record<string, unknown> = {};
  if (opciones.hasta) {
    where.createdAt = { lt: opciones.hasta };
  }

  let cursorId: string | undefined;
  let leidas = 0;
  let reescritas = 0;

  for (;;) {
    const lote = await prisma.auditLog.findMany({
      where,
      select: { id: true, changes: true },
      // Orden total por `id`: el cursor necesita un desempate estable, y
      // `createdAt` no es único (varias filas pueden compartir el milisegundo).
      orderBy: { id: 'asc' },
      take: tamanioLote,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    if (lote.length === 0) break;

    for (const fila of lote) {
      if (fila.changes === null || fila.changes === undefined) continue;
      leidas++;
      const saneado = sanitizeAuditChanges(fila.changes);
      // Se compara serializado: si la fila ya estaba limpia no se escribe, y
      // así una segunda corrida no genera un millón de UPDATEs al pedo.
      if (JSON.stringify(saneado) === JSON.stringify(fila.changes)) continue;

      await prisma.auditLog.update({
        where: { id: fila.id },
        data: { changes: saneado },
      });
      reescritas++;
    }

    if (lote.length < tamanioLote) break;
    cursorId = lote[lote.length - 1].id;
  }

  return { leidas, reescritas };
}
