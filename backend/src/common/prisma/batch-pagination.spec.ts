import {
  mapBatches,
  paginateByCursor,
  paginateByOffset,
} from './batch-pagination';

async function collect<T>(gen: AsyncGenerator<T[]>): Promise<T[][]> {
  const out: T[][] = [];
  for await (const batch of gen) out.push(batch);
  return out;
}

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}` }));

describe('paginateByCursor', () => {
  it('pide cada lote desde el último id y corta con un lote incompleto', async () => {
    const all = rows(5);
    const fetch = jest.fn((cursor?: string) => {
      const start = cursor ? all.findIndex((r) => r.id === cursor) + 1 : 0;
      return Promise.resolve(all.slice(start, start + 2));
    });

    const batches = await collect(paginateByCursor(fetch, 2));

    expect(batches.map((b) => b.map((r) => r.id))).toEqual([
      ['r1', 'r2'],
      ['r3', 'r4'],
      ['r5'],
    ]);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([undefined, 'r2', 'r4']);
  });

  it('sin filas no emite nada', async () => {
    expect(
      await collect(paginateByCursor(() => Promise.resolve([]), 2)),
    ).toEqual([]);
  });

  it('con un múltiplo exacto del lote hace una consulta final que vuelve vacía', async () => {
    const all = rows(4);
    const fetch = jest.fn((cursor?: string) => {
      const start = cursor ? all.findIndex((r) => r.id === cursor) + 1 : 0;
      return Promise.resolve(all.slice(start, start + 2));
    });
    await collect(paginateByCursor(fetch, 2));
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe('paginateByOffset', () => {
  it('avanza el salto con lo leído', async () => {
    const all = rows(3);
    const fetch = jest.fn((skip: number) =>
      Promise.resolve(all.slice(skip, skip + 2)),
    );
    const batches = await collect(paginateByOffset(fetch, 2));
    expect(batches).toHaveLength(2);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([0, 2]);
  });
});

describe('mapBatches', () => {
  it('transforma cada lote por separado', async () => {
    async function* source() {
      yield [1, 2];
      yield [3];
    }
    expect(await collect(mapBatches(source(), (n) => n * 10))).toEqual([
      [10, 20],
      [30],
    ]);
  });
});
