// Auth: login, refresh (rotación), logout, /me, /permissions, límites y matriz de roles.
import { expect, test } from '@playwright/test';
import { Api, freshIp, ROLES, anon, as, body, data, newCtx, roleEmail } from '../../lib/api';
import { ADMIN_EMAIL, DIRECT, PASSWORD } from '../../lib/env';

test.describe('health', () => {
  test('GET /health responde ok con la base arriba (por el borde y por el nginx real del frontend)', async ({ request }) => {
    const r = await request.get('/api/v1/health');
    expect(r.status()).toBe(200);
    expect((await r.json()).data).toMatchObject({ status: 'ok', services: { database: 'up' } });
    const d = await request.get(`${DIRECT}/api/v1/health`);
    expect(d.status()).toBe(200);
  });
});

test.describe('login', () => {
  test('credenciales válidas → accessToken + cookie httpOnly de refresh, sin passwordHash', async () => {
    const api = new Api(await newCtx());
    const r = await api.post('/auth/login', { email: ADMIN_EMAIL, password: PASSWORD });
    expect(r.status()).toBe(200);
    const b = await body(r);
    expect(b.data.accessToken).toBeTruthy();
    expect(b.data.user).toMatchObject({ email: ADMIN_EMAIL, role: 'SUPER_ADMIN' });
    expect(JSON.stringify(b)).not.toMatch(/passwordHash|password_hash|\$argon2/);
    const cookie = r.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie')?.value ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/evita_refresh_token=/);
  });

  test('contraseña incorrecta → 401 con mensaje genérico (no revela si el email existe)', async () => {
    const api = new Api(await newCtx());
    const mal = await api.post('/auth/login', { email: ADMIN_EMAIL, password: 'incorrecta-123' });
    const noExiste = await api.post('/auth/login', { email: 'nadie@evita-e2e.test', password: 'incorrecta-123' });
    expect(mal.status()).toBe(401);
    expect(noExiste.status()).toBe(401);
    expect((await body(mal)).message).toEqual((await body(noExiste)).message);
  });

  test('payload inválido → 400 con mensajes de validación', async () => {
    const api = new Api(await newCtx());
    for (const p of [{}, { email: 'no-es-email', password: 'abcdefgh' }, { email: ADMIN_EMAIL, password: 'corta' }]) {
      const r = await api.post('/auth/login', p);
      expect(r.status(), JSON.stringify(p)).toBe(400);
    }
  });

  test('límite de 5 intentos por IP: el 6º devuelve 429', async () => {
    const api = new Api(await newCtx());
    const estados: number[] = [];
    for (let i = 0; i < 6; i++) estados.push((await api.post('/auth/login', { email: ADMIN_EMAIL, password: 'incorrecta-123' })).status());
    expect(estados.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(estados[5]).toBe(429);
  });

  test('un usuario desactivado no puede iniciar sesión', async () => {
    const admin = (await as('SUPER_ADMIN')).api;
    const email = `e2e.baja.${Date.now()}@evita-e2e.test`;
    const u = await data(await admin.post('/users', { email, password: PASSWORD, firstName: 'Baja', lastName: 'Test', role: 'ARBITRO' }), 201);
    await data(await admin.patch(`/users/${u.id}`, { isActive: false }));
    const r = await new Api(await newCtx()).post('/auth/login', { email, password: PASSWORD });
    expect([401, 403]).toContain(r.status());
    await admin.del(`/users/${u.id}`);
  });
});

test.describe('sesión', () => {
  test('/auth/me devuelve el usuario del token; sin token → 401', async () => {
    const s = await as('ADMIN_PROVINCIAL');
    const me = await data(await s.api.get('/auth/me'));
    expect(me).toMatchObject({ email: roleEmail('ADMIN_PROVINCIAL'), role: 'ADMIN_PROVINCIAL' });
    expect((await (await anon()).get('/auth/me')).status()).toBe(401);
    const falso = new Api(await newCtx(), 'abc.def.ghi');
    expect((await falso.get('/auth/me')).status()).toBe(401);
  });

  test('refresh rota el token; reusar el anterior se rechaza y queda auditado', async () => {
    const ip = freshIp();
    const ctx1 = await newCtx();
    const api = new Api(ctx1, undefined, ip);
    await data(await api.post('/auth/login', { email: roleEmail('ARBITRO'), password: PASSWORD }));
    const viejo = (await ctx1.storageState()).cookies.find((c) => c.name === 'evita_refresh_token')!.value;
    const r1 = await api.post('/auth/refresh');
    expect(r1.status()).toBe(200);
    expect((await body(r1)).data.accessToken).toBeTruthy();
    const nuevo = (await ctx1.storageState()).cookies.find((c) => c.name === 'evita_refresh_token')!.value;
    expect(nuevo).not.toEqual(viejo);
    // Atacante con el token viejo
    const ctx2 = await newCtx();
    const ataque = await ctx2.post('/api/v1/auth/refresh', { headers: { cookie: `evita_refresh_token=${viejo}`, 'x-test-ip': ip } });
    expect(ataque.status()).toBe(403); // contrato: 403 = refresh token revocado
    // Y la auditoría lo registró
    const admin = (await as('SUPER_ADMIN')).api;
    const aud = await data(await admin.get('/audit?action=REFRESH_TOKEN_REUSE&limit=5'));
    expect(JSON.stringify(aud)).toContain('REFRESH_TOKEN_REUSE');
  });

  test('refresh sin cookie → 401', async () => {
    expect((await new Api(await newCtx()).post('/auth/refresh')).status()).toBe(401);
  });

  test('logout invalida la cookie de refresh', async () => {
    const ip2 = freshIp();
    const ctx = await newCtx();
    const api = new Api(ctx, undefined, ip2);
    const d = await data(await api.post('/auth/login', { email: roleEmail('OPERADOR_MESA'), password: PASSWORD }));
    api.token = d.accessToken;
    const cookie = (await ctx.storageState()).cookies.find((c) => c.name === 'evita_refresh_token')!.value;
    expect((await api.post('/auth/logout')).status()).toBeLessThan(300);
    const ctx2 = await newCtx();
    const r = await ctx2.post('/api/v1/auth/refresh', { headers: { cookie: `evita_refresh_token=${cookie}`, 'x-test-ip': ip2 } });
    expect(r.status()).toBe(403);
  });

  test('/auth/permissions expone las acciones de cada rol y SUPER_ADMIN las tiene todas', async () => {
    const sa = await data((await (await as('SUPER_ADMIN')).api.get('/auth/permissions')));
    const ar = await data((await (await as('ARBITRO')).api.get('/auth/permissions')));
    expect(sa.actions.length).toBeGreaterThan(ar.actions.length);
    expect(ar.actions).not.toContain('PARTICIPANT_CREATE');
    expect(sa.actions).toContain('PARTICIPANT_UPDATE_DNI');
  });
});

test.describe('matriz de roles (backend)', () => {
  // endpoint → roles que DEBEN entrar (los demás reciben 403). Espejo de ACCIONES (common/constants).
  const todos = ROLES;
  const matriz: Array<[string, string, string[]]> = [
    ['users', '/users', ['SUPER_ADMIN', 'ADMIN_PROVINCIAL']],
    ['audit', '/audit', ['SUPER_ADMIN', 'ADMIN_PROVINCIAL']],
    ['dashboard', '/dashboard/stats', ['SUPER_ADMIN', 'ADMIN_PROVINCIAL', 'ADMIN_DEPARTAMENTAL', 'ADMIN_ZONAL', 'COORDINADOR']],
    ['participants', '/participants', ['SUPER_ADMIN', 'ADMIN_PROVINCIAL', 'ADMIN_DEPARTAMENTAL', 'ADMIN_ZONAL', 'DELEGADO', 'COORDINADOR']],
    ['teams', '/teams', ['SUPER_ADMIN', 'ADMIN_PROVINCIAL', 'ADMIN_DEPARTAMENTAL', 'ADMIN_ZONAL', 'DELEGADO', 'COORDINADOR']],
    ['inscriptions', '/inscriptions', ['SUPER_ADMIN', 'ADMIN_PROVINCIAL', 'ADMIN_DEPARTAMENTAL', 'ADMIN_ZONAL', 'DELEGADO']],
    ['reports', '/reports/participants', ['SUPER_ADMIN', 'ADMIN_PROVINCIAL', 'ADMIN_DEPARTAMENTAL', 'ADMIN_ZONAL', 'DELEGADO']],
    ['zones', '/zones', ['SUPER_ADMIN', 'ADMIN_PROVINCIAL', 'ADMIN_DEPARTAMENTAL', 'ADMIN_ZONAL']],
    ['survey campaigns', '/survey/campaigns', ['SUPER_ADMIN', 'ADMIN_PROVINCIAL', 'ADMIN_DEPARTAMENTAL', 'ADMIN_ZONAL']],
  ];
  for (const [nombre, ruta, permitidos] of matriz) {
    test(`GET ${ruta} (${nombre}): sólo ${permitidos.length} roles entran`, async () => {
      for (const rol of todos) {
        const s = await as(rol);
        const r = await s.api.get(ruta);
        const esperado = permitidos.includes(rol);
        // 200 si entra; 403 si no. Cualquier otro (500, 401) es un defecto.
        expect(r.status(), `${rol} → ${ruta}`).toBe(esperado ? 200 : 403);
      }
    });
  }
});
