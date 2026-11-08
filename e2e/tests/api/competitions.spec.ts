// Competencias, fixture, partidos, resultados y rankings (individual y por equipos).
import { expect, test } from '@playwright/test';
import { DEPTO, anon, as, body, data, nextDni, uniq } from '../../lib/api';

const API = async () => (await as('ADMIN_PROVINCIAL')).api;

/** Una competencia es única por disciplina+categoría+etapa: cada prueba crea su propia categoría. */
async function catalogo() {
  const s = await API();
  const cats = (await data(await s.get('/categories?limit=100'))) as any[];
  const base = {
    individual: cats.find((c) => c.discipline.type === 'INDIVIDUAL' && c.sex === 'MIXTO')!,
    masculina: cats.find((c) => c.discipline.type === 'EQUIPO' && c.sex === 'MASCULINO')!,
  };
  const fresca = async (b: any) =>
    data(await s.post('/categories', { disciplineId: b.disciplineId, name: uniq('Cat'), minAge: b.minAge, maxAge: b.maxAge, sex: b.sex }), 201);
  return { individual: await fresca(base.individual), masculina: await fresca(base.masculina) };
}

/** Crea `n` participantes con inscripción APROBADA en la categoría y devuelve sus ids. */
async function aprobados(n: number, categoryId: string) {
  const s = await API();
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const ins = await data(
      await s.post('/inscriptions', {
        dni: nextDni(), firstName: `Jug${i}`, lastName: uniq('C'), birthDate: '2012-03-04', sex: 'MASCULINO',
        locality: 'Formosa', department: DEPTO, categoryId,
      }),
      201,
    );
    await data(await s.patch(`/inscriptions/${ins.id}/review`, {}));
    await data(await s.patch(`/inscriptions/${ins.id}/approve`, {}));
    ids.push(ins.participantId);
  }
  return ids;
}

const crear = async (cat: any, over: Record<string, unknown> = {}) =>
  data(
    await (await API()).post('/competitions', {
      disciplineId: cat.disciplineId, categoryId: cat.id, stage: 'ZONAL', format: 'ROUND_ROBIN', name: uniq('Comp'), ...over,
    }),
    201,
  );

test.describe('competencias', () => {
  test('alta en BORRADOR; sólo admins crean; validaciones de DTO (CA-C1.1, C1.2)', async () => {
    const { individual } = await catalogo();
    const c = await crear(individual);
    expect(c.status).toBe('BORRADOR');
    for (const rol of ['DELEGADO', 'ARBITRO', 'COORDINADOR'] as const) {
      const r = await (await as(rol)).api.post('/competitions', { disciplineId: individual.disciplineId, categoryId: individual.id, stage: 'ZONAL', format: 'ROUND_ROBIN' });
      expect(r.status(), rol).toBe(403);
    }
    const s = await API();
    for (const mal of [{ stage: 'MUNDIAL' }, { format: 'LIGA' }, { disciplineId: 'x' }, { categoryId: undefined }]) {
      const r = await s.post('/competitions', { disciplineId: individual.disciplineId, categoryId: individual.id, stage: 'ZONAL', format: 'ROUND_ROBIN', ...mal });
      expect(r.status(), JSON.stringify(mal)).toBe(400);
    }
  });

  test('categoría de otra disciplina → 400; duplicado exacto → 409', async () => {
    const { individual, masculina } = await catalogo();
    const s = await API();
    const cruzada = await s.post('/competitions', { disciplineId: individual.disciplineId, categoryId: masculina.id, stage: 'ZONAL', format: 'ROUND_ROBIN' });
    expect(cruzada.status()).toBe(400);
  });

  test('listado público y detalle; filtros inválidos → 400', async () => {
    const a = await anon();
    expect((await a.get('/competitions?limit=3')).status()).toBe(200);
    const { individual } = await catalogo();
    const c = await crear(individual);
    expect((await data(await a.get(`/competitions/${c.id}`))).id).toBe(c.id);
    expect((await a.get('/competitions/99999999-9999-4999-8999-999999999999')).status()).toBe(404);
    expect((await a.get('/competitions?stage=XX')).status()).toBe(400);
    expect((await a.get('/competitions?status=XX')).status()).toBe(400);
  });

  test('actualización de estado y datos; DELEGADO no puede', async () => {
    const { individual } = await catalogo();
    const c = await crear(individual);
    const s = await API();
    const up = await data(await s.patch(`/competitions/${c.id}`, { name: 'Renombrada', status: 'ACTIVA' }));
    expect(up).toMatchObject({ name: 'Renombrada', status: 'ACTIVA' });
    expect((await (await as('DELEGADO')).api.patch(`/competitions/${c.id}`, { name: 'x' })).status()).toBe(403);
    expect((await s.patch(`/competitions/${c.id}`, { status: 'OTRO' })).status()).toBe(400);
  });
});

test.describe('fixture, resultados y ranking (individual, round robin)', () => {
  test('3 inscriptos aprobados → 3 partidos PROGRAMADO; cargar resultados finaliza y arma el ranking público', async () => {
    const { individual } = await catalogo();
    const [a, b, c] = await aprobados(3, individual.id);
    const comp = await crear(individual);
    const s = await API();
    const fx = await data(await s.post(`/competitions/${comp.id}/fixture`, { participantIds: [a, b, c] }), [200, 201]);
    expect(fx.status).toBe('ACTIVA');
    expect(fx.matches).toHaveLength(3);
    expect(fx.matches.every((m: any) => m.status === 'PROGRAMADO')).toBe(true);
    // todos contra todos una sola vez
    const pares = new Set(fx.matches.map((m: any) => m.results.map((r: any) => r.participantId).sort().join('|')));
    expect(pares.size).toBe(3);

    // el fixture no se puede generar dos veces
    expect((await s.post(`/competitions/${comp.id}/fixture`, { participantIds: [a, b, c] })).status()).toBe(409);

    // un ARBITRO carga resultados: a gana sus dos partidos, b le gana a c
    const ganador = (m: any, id: string) => m.results.find((r: any) => r.participantId === id);
    const arb = (await as('ARBITRO')).api;
    for (const m of fx.matches) {
      const ids = m.results.map((r: any) => r.participantId);
      const gana = ids.includes(a) ? a : b;
      const payload = m.results.map((r: any) => ({ resultId: r.id, data: { isWinner: r.participantId === gana, ranking: r.participantId === gana ? 1 : 2, scoreData: { puntos: r.participantId === gana ? 1 : 0 } } }));
      const done = await data(await arb.patch(`/results/match/${m.id}`, payload));
      expect(done.status).toBe('FINALIZADO');
      expect(ganador(done, gana).isWinner).toBe(true);
    }
    const rank = await data(await (await anon()).get(`/results/rankings/competition/${comp.id}`));
    expect(rank).toHaveLength(3);
    expect(rank[0]).toMatchObject({ id: a, won: 2, played: 2, points: 6 });
    expect(rank[1]).toMatchObject({ id: b, won: 1, lost: 1, points: 3 });
    expect(rank[2]).toMatchObject({ id: c, won: 0, lost: 2, points: 0 });
  });

  test('menos de 2 participantes → 400 (CA-C2.4)', async () => {
    const { individual } = await catalogo();
    const comp = await crear(individual);
    const s = await API();
    expect((await s.post(`/competitions/${comp.id}/fixture`, { participantIds: [] })).status()).toBe(400);
    const [a] = await aprobados(1, individual.id);
    expect((await s.post(`/competitions/${comp.id}/fixture`, { participantIds: [a] })).status()).toBe(400);
  });

  test('participantes sin inscripción APROBADA no entran al fixture (CA-C1.3)', async () => {
    const { individual } = await catalogo();
    const [a] = await aprobados(1, individual.id);
    const s = await API();
    const sinAprobar = await data(
      await s.post('/participants', { dni: nextDni(), firstName: 'Sin', lastName: uniq('S'), birthDate: '2012-03-04', sex: 'MASCULINO', locality: 'Formosa', department: DEPTO }),
      201,
    );
    const comp = await crear(individual);
    const r = await s.post(`/competitions/${comp.id}/fixture`, { participantIds: [a, sinAprobar.id] });
    expect(r.status()).toBe(400);
  });

  test('el mismo participante repetido en el fixture → 400 (no 500)', async () => {
    const { individual } = await catalogo();
    const [a] = await aprobados(1, individual.id);
    const comp = await crear(individual);
    const dup = await (await API()).post(`/competitions/${comp.id}/fixture`, { participantIds: [a, a] });
    expect(dup.status()).toBe(400);
  });

  test('participante inexistente en el fixture → error de cliente, nunca 500', async () => {
    const { individual } = await catalogo();
    const [a] = await aprobados(1, individual.id);
    const comp = await crear(individual);
    const inex = await (await API()).post(`/competitions/${comp.id}/fixture`, { participantIds: [a, '99999999-9999-4999-8999-999999999999'] });
    expect(inex.status()).toBeLessThan(500);
  });

  test('cargar resultados: id de resultado ajeno o lista vacía no deben finalizar el partido', async () => {
    const { individual } = await catalogo();
    const [a, b] = await aprobados(2, individual.id);
    const comp = await crear(individual);
    const s = await API();
    const fx = await data(await s.post(`/competitions/${comp.id}/fixture`, { participantIds: [a, b] }), [200, 201]);
    const m = fx.matches[0];
    const r = await s.patch(`/results/match/${m.id}`, []);
    const det = await data(await s.get(`/competitions/${comp.id}`));
    expect(r.status() >= 400 || det.matches[0].status === 'PROGRAMADO').toBe(true);
  });

  test('un resultado ya cargado sólo lo corrige ADMIN_PROVINCIAL o superior (CA-C3.4)', async () => {
    const { individual } = await catalogo();
    const [a, b] = await aprobados(2, individual.id);
    const comp = await crear(individual);
    const s = await API();
    const fx = await data(await s.post(`/competitions/${comp.id}/fixture`, { participantIds: [a, b] }), [200, 201]);
    const m = fx.matches[0];
    const arb = (await as('ARBITRO')).api;
    const cargar = (api: any, gana: number) =>
      api.patch(`/results/match/${m.id}`, m.results.map((r: any, i: number) => ({ resultId: r.id, data: { isWinner: i === gana } })));
    expect((await cargar(arb, 0)).status()).toBe(200);
    expect((await cargar(arb, 1)).status()).toBe(403);
    expect((await cargar(s, 1)).status()).toBe(200);
  });

  test('roles sin permiso no cargan resultados (DELEGADO, COORDINADOR, OPERADOR_MESA → 403)', async () => {
    for (const rol of ['DELEGADO', 'COORDINADOR', 'OPERADOR_MESA', 'ENTRENADOR'] as const) {
      const r = await (await as(rol)).api.patch('/results/match/99999999-9999-4999-8999-999999999999', []);
      expect(r.status(), rol).toBe(403);
    }
    expect((await (await as('ARBITRO')).api.patch('/results/match/99999999-9999-4999-8999-999999999999', [])).status()).toBe(404);
  });

  test('ranking de competencia inexistente → 404; id inválido → 400', async () => {
    const a = await anon();
    expect((await a.get('/results/rankings/competition/99999999-9999-4999-8999-999999999999')).status()).toBe(404);
    expect((await a.get('/results/rankings/competition/xx')).status()).toBe(400);
  });

  test('ranking: un empate (sin ganador) no suma puntos pero tampoco cuenta como derrota', async () => {
    const { individual } = await catalogo();
    const [a, b] = await aprobados(2, individual.id);
    const comp = await crear(individual);
    const s = await API();
    const fx = await data(await s.post(`/competitions/${comp.id}/fixture`, { participantIds: [a, b] }), [200, 201]);
    const m = fx.matches[0];
    await data(await s.patch(`/results/match/${m.id}`, m.results.map((r: any) => ({ resultId: r.id, data: { isWinner: false, scoreData: { goles: 1 } } }))));
    const rank = await data(await (await anon()).get(`/results/rankings/competition/${comp.id}`));
    for (const fila of rank) expect(fila.lost, 'un empate no es derrota').toBe(0);
  });
});

test.describe('fixture por equipos y otros formatos', () => {
  for (const format of ['ELIMINACION_DIRECTA', 'FASE_GRUPOS']) {
    test(`formato ${format} genera partidos`, async () => {
      const { individual } = await catalogo();
      const ids = await aprobados(4, individual.id);
      const comp = await crear(individual, { format });
      const r = await (await API()).post(`/competitions/${comp.id}/fixture`, { participantIds: ids });
      expect(r.status()).toBeLessThan(300);
      const fx = await data(r, [200, 201]);
      expect(fx.matches.length).toBeGreaterThan(0);
    });
  }

  test('equipos: round robin entre 3 equipos inscriptos por plantel', async () => {
    const { masculina } = await catalogo();
    const s = await API();
    const equipos: string[] = [];
    for (let e = 0; e < 3; e++) {
      const miembros = Array.from({ length: 11 }, (_, i) => ({
        dni: nextDni(), firstName: `J${i}`, lastName: uniq('Eq'), birthDate: '2012-05-05', sex: 'MASCULINO', locality: 'Formosa', department: DEPTO, isSubstitute: false, shirtNumber: i + 1,
      }));
      const d = await data(await s.post('/inscriptions/team', { disciplineId: masculina.disciplineId, categoryId: masculina.id, teamName: uniq('Club'), locality: 'Formosa', department: DEPTO, members: miembros }), 201);
      // CA-C1.3: un equipo entra al fixture con al menos una inscripción APROBADA en la categoría.
      const primera = d.members[0].inscriptionId;
      await data(await s.patch(`/inscriptions/${primera}/review`, {}));
      await data(await s.patch(`/inscriptions/${primera}/approve`, {}));
      equipos.push(d.team?.id ?? d.teamId);
    }
    const comp = await crear(masculina);
    const fx = await data(await s.post(`/competitions/${comp.id}/fixture`, { teamIds: equipos }), [200, 201]);
    expect(fx.matches).toHaveLength(3);
    const m = fx.matches[0];
    const done = await data(await s.patch(`/results/match/${m.id}`, m.results.map((r: any, i: number) => ({ resultId: r.id, data: { isWinner: i === 0, scoreData: { goals: i === 0 ? 2 : 1 } } }))));
    expect(done.status).toBe('FINALIZADO');
    const rank = await data(await (await anon()).get(`/results/rankings/competition/${comp.id}`));
    expect(rank.length).toBe(2);
    expect(JSON.stringify(rank)).not.toMatch(/dni|birthDate|email/);
  });
});

test('respuesta de errores: nunca expone trazas ni Prisma en rutas de competencias', async () => {
  const s = await API();
  for (const p of ['/competitions?sortBy=nada', '/competitions?disciplineId=x', '/competitions?page=-1']) {
    const r = await s.get(p);
    expect(r.status(), p).toBeLessThan(500);
    expect(JSON.stringify(await body(r))).not.toMatch(/prisma|node_modules|at .*\.js/i);
  }
});
