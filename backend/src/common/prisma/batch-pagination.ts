// ===========================================
// Lectura por lotes (cursor y offset)
// ===========================================
//
// Generadores que recorren una consulta de a lotes sin tener toda la tabla en
// memoria. Los usan los reportes; cualquier lectura masiva puede reutilizarlos.

/**
 * Paginación **por cursor**, no por OFFSET.
 *
 * Con `OFFSET n` Postgres genera y descarta las n filas previas en cada página
 * (costo total O(N²/lote)). El cursor se traduce a `WHERE (orden) > (última
 * fila)`: Postgres se posiciona en el índice y sigue leyendo, costo constante.
 *
 * Requisito: el `orderBy` de `fetchBatch` tiene que ser un orden **total**
 * (terminar en `{ id: 'asc' }`); si no, dos filas empatadas pueden repetirse en
 * un lote y faltar en otro.
 */
export async function* paginateByCursor<T extends { id: string }>(
  fetchBatch: (cursorId?: string) => Promise<T[]>,
  batchSize: number,
): AsyncGenerator<T[], void, undefined> {
  let cursorId: string | undefined;
  for (;;) {
    const batch = await fetchBatch(cursorId);
    if (batch.length === 0) return;
    yield batch;
    // Un lote incompleto significa que se terminó: se evita una consulta final
    // que siempre vuelve vacía.
    if (batch.length < batchSize) return;
    cursorId = batch[batch.length - 1].id;
  }
}

/**
 * Paginación por OFFSET, para cuando el orden es por una columna de otra tabla
 * (Prisma no combina `cursor` con `orderBy` sobre relaciones). Sólo conviene en
 * tablas chicas.
 */
export async function* paginateByOffset<T>(
  fetchBatch: (skip: number) => Promise<T[]>,
  batchSize: number,
): AsyncGenerator<T[], void, undefined> {
  let skip = 0;
  for (;;) {
    const batch = await fetchBatch(skip);
    if (batch.length === 0) return;
    yield batch;
    if (batch.length < batchSize) return;
    skip += batch.length;
  }
}

/** Transforma cada lote sin juntarlos. */
export async function* mapBatches<T, R>(
  batches: AsyncGenerator<T[], void, undefined>,
  toRow: (item: T) => R,
): AsyncGenerator<R[], void, undefined> {
  for await (const batch of batches) {
    yield batch.map(toRow);
  }
}
