// ===========================================
// Runner de la migración de datos de R12
// ===========================================
//
//   npm run audit:backfill-pii            # cuenta y reescribe
//   npm run audit:backfill-pii -- --dry   # sólo cuenta, no escribe
//
// Imprime el conteo de filas con PII cruda **antes** y **después**, que es la
// evidencia que pide el DoD de R12. Correrlo es idempotente: una segunda pasada
// tiene que reportar 0 reescritas.
import { PrismaClient } from '@prisma/client';
import {
  reenmascararPiiHistorica,
  type ClienteBackfill,
} from '../src/modules/audit/audit-pii-backfill';
import { contienePiiCruda } from '../src/modules/audit/audit-sanitizer';

async function contarFilasConPiiCruda(prisma: PrismaClient): Promise<number> {
  let cursorId: string | undefined;
  let total = 0;

  for (;;) {
    const lote = await prisma.auditLog.findMany({
      where: {},
      select: { id: true, changes: true },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    if (lote.length === 0) break;
    total += lote.filter((f) => contienePiiCruda(f.changes)).length;
    if (lote.length < 500) break;
    cursorId = lote[lote.length - 1].id;
  }

  return total;
}

async function main() {
  const soloContar = process.argv.includes('--dry');
  const prisma = new PrismaClient();

  try {
    const antes = await contarFilasConPiiCruda(prisma);
    console.log(`Filas de audit_logs con PII cruda ANTES: ${antes}`);

    if (soloContar) return;

    const resultado = await reenmascararPiiHistorica(
      prisma as unknown as ClienteBackfill,
    );
    console.log(
      `Leídas: ${resultado.leidas} · Reescritas: ${resultado.reescritas}`,
    );

    const despues = await contarFilasConPiiCruda(prisma);
    console.log(`Filas de audit_logs con PII cruda DESPUÉS: ${despues}`);

    if (despues > 0) {
      console.error(
        'Quedaron filas con PII cruda: revisar la clasificación del sanitizador.',
      );
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
