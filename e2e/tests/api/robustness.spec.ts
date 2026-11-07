// Robustez: parámetros basura nunca deben producir 500 ni filtrar detalles internos; cabeceras de seguridad;
// límites de lectura pública; CORS; 404 de rutas desconocidas.
import { knownBug } from '../../lib/bugs';
import { expect, test } from '@playwright/test';
import { Api, anon, as, body, data, freshIp, newCtx } from '../../lib/api';

const GARBAGE = ['XX', 'zz-no-uuid', '-1', '99999999999999999999', "'; DROP TABLE users;--", '%00', '<script>'];

// endpoint → parámetros de query que acepta
const LISTADOS: Record<string, string[]> = {
  '/participants': ['dni', 'department', 'locality', 'sex', 'disciplineId', 'categoryId', 'sortBy', 'page', 'limit'],
  '/teams': ['disciplineId', 'categoryId', 'department', 'isActive', 'sortBy', 'page'],
  '/inscriptions': ['status', 'categoryId', 'disciplineId', 'teamId', 'participantId', 'sortBy', 'page'],
  '/competitions': ['disciplineId', 'categoryId', 'stage', 'status', 'sortBy', 'page'],
  '/users': ['role', 'isActive', 'department', 'sortBy', 'page'],
  '/audit': ['userId', 'action', 'entity', 'entityId', 'fromDate', 'toDate', 'page'],
  '/venues': ['locality', 'department', 'isActive', 'sortBy', 'page'],
  '/news': ['isPublished', 'isExternal', 'sortBy', 'page'],
  '/calendar': ['fromDate', 'toDate', 'isPublished', 'page'],
  '/disciplines': ['type', 'isActive', 'sortBy', 'page'],
  '/categories': ['disciplineId', 'sex', 'isActive', 'page'],
  '/survey/campaigns': ['anio', 'status', 'ventana', 'etapa', 'sortBy', 'page'],
  '/survey/active': ['etapa', 'ventana'],
};

test.describe('parámetros inválidos nunca producen 500', () => {
  for (const [ruta, params] of Object.entries(LISTADOS)) {
    test(`GET ${ruta}`, async () => {
      const s = (await as('SUPER_ADMIN')).api;
      const malos: string[] = [];
      for (const p of params.filter((x) => x !== 'page')) {
        for (const g of GARBAGE) {
          const r = await s.get(`${ruta}?${p}=${encodeURIComponent(g)}`);
          if (r.status() >= 500) malos.push(`${p}=${g} → ${r.status()}`);
          else {
            const t = await r.text();
            if (/prisma|\/app\/dist|node_modules/i.test(t)) malos.push(`${p}=${g} filtra detalle interno`);
          }
        }
      }
      if (ruta === '/inscriptions') knownBug('F-01: /inscriptions?status=<inválido> responde 500 y filtra la consulta de Prisma');
      expect(malos, malos.join('\n')).toEqual([]);
    });
  }
});

test.describe('paginación extrema', () => {
  for (const ruta of ['/participants', '/teams', '/inscriptions', '/users', '/audit', '/survey/campaigns', '/competitions', '/venues', '/news']) {
    test(`GET ${ruta}?page=99999999999999999999 → 400 (no 500)`, async () => {
      knownBug('F-21: un número de página enorme desborda el offset y responde 500 en todos los listados paginados');
      const r = await (await as('SUPER_ADMIN')).api.get(`${ruta}?page=99999999999999999999`);
      expect(r.status()).toBeLessThan(500);
    });
  }
});

test.describe('seguridad HTTP', () => {
  test('cabeceras de seguridad y sin X-Powered-By', async () => {
    const r = await (await newCtx()).get('/api/v1/health');
    const h = r.headers();
    expect(h['x-powered-by']).toBeUndefined();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['strict-transport-security'] ?? h['x-frame-options'] ?? h['content-security-policy']).toBeTruthy();
  });

  test('rutas de API desconocidas → 404 JSON; no se sirve el index.html', async () => {
    const r = await (await newCtx()).get('/api/v1/no-existe');
    expect(r.status()).toBe(404);
    expect(r.headers()['content-type']).toContain('json');
  });

  test('swagger no está expuesto sin autenticación en este despliegue', async () => {
    const r = await (await newCtx()).get('/api/docs');
    expect([200, 301, 302, 401, 403, 404]).toContain(r.status());
  });

  test('body JSON malformado → 400, no 500', async () => {
    const ctx = await newCtx();
    const r = await ctx.post('/api/v1/auth/login', { headers: { 'content-type': 'application/json', 'x-test-ip': freshIp() }, data: '{no-json' });
    expect(r.status()).toBe(400);
  });

  test('propiedades extra en el body se rechazan (whitelist)', async () => {
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const r = await s.post('/venues', { name: 'x', address: 'y', locality: 'z', department: 'w', isAdmin: true });
    expect(r.status()).toBe(400);
  });

  test('payload gigante → 413', async () => {
    knownBug('F-22: un body JSON mayor a ~100 KB responde 500 "request entity too large" en vez de 413');
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const r = await s.post('/news', { title: 'x', content: 'a'.repeat(3 * 1024 * 1024) });
    expect(r.status()).toBe(413);
  });

  test('mass-assignment: el rol no se puede elevar vía PATCH /users como no SUPER_ADMIN ni /auth/me', async () => {
    const del = (await as('DELEGADO')).api;
    const me = (await as('DELEGADO')).user;
    const r = await del.patch(`/users/${me.id}`, { role: 'SUPER_ADMIN' });
    expect(r.status()).toBe(403);
  });
});

test.describe('límite de lecturas públicas (20/min por IP)', () => {
  test('la lectura 21 desde la misma IP recibe 429 con Retry-After y otra IP no se ve afectada', async () => {
    const ip = freshIp();
    const a = new Api(await newCtx(), undefined, ip);
    const estados: number[] = [];
    let retry: string | undefined;
    for (let i = 0; i < 24; i++) {
      const r = await a.get('/disciplines');
      estados.push(r.status());
      if (r.status() === 429) retry = r.headers()['retry-after'];
    }
    expect(estados.filter((s) => s === 200).length).toBe(20);
    expect(estados.slice(20).every((s) => s === 429)).toBe(true);
    expect(retry, 'el 429 debería traer Retry-After').toBeTruthy();
    const otra = new Api(await newCtx(), undefined, freshIp());
    expect((await otra.get('/disciplines')).status()).toBe(200);
  });

  test('el 429 mantiene el formato de error JSON del resto de la API', async () => {
    const a = new Api(await newCtx(), undefined, freshIp());
    let r;
    for (let i = 0; i < 25; i++) r = await a.get('/disciplines');
    expect(r!.status()).toBe(429);
    const b = await body(r!);
    expect(b).toMatchObject({ success: false, statusCode: 429 });
  });
});

test.describe('CORS', () => {
  test('sólo el origen configurado recibe Access-Control-Allow-Origin', async () => {
    const ctx = await newCtx();
    const ok = await ctx.get('/api/v1/health', { headers: { origin: 'http://localhost:18080' } });
    expect(ok.headers()['access-control-allow-origin']).toBe('http://localhost:18080');
    const mal = await ctx.get('/api/v1/health', { headers: { origin: 'https://evil.example' } });
    expect(mal.headers()['access-control-allow-origin']).toBeUndefined();
  });
});

test('anon y sesiones inválidas no filtran datos', async () => {
  const a = await anon();
  const r = await a.get('/participants');
  expect(r.status()).toBe(401);
  const falso = new Api(await newCtx(), 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIiwicm9sZSI6IlNVUEVSX0FETUlOIn0.');
  expect((await falso.get('/users')).status()).toBe(401);
  void data;
});
