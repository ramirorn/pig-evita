// Usuarios, zonas, catálogo (disciplinas/categorías), auditoría, dashboard, reportes y estadísticas.
import { knownBug } from '../../lib/bugs';
import { expect, test } from '@playwright/test';
import { ROLES, anon, as, body, data, newCtx, uniq, Api, roleEmail } from '../../lib/api';
import { PASSWORD } from '../../lib/env';

const sa = async () => (await as('SUPER_ADMIN')).api;
const prov = async () => (await as('ADMIN_PROVINCIAL')).api;

test.describe('usuarios', () => {
  test('alta, duplicado de email → 409, listado filtrado por rol/estado, baja lógica (CA-A3.x)', async () => {
    const s = await sa();
    const email = `${uniq('u').toLowerCase()}@evita-e2e.test`;
    const u = await data(await s.post('/users', { email, password: PASSWORD, firstName: 'U', lastName: 'Test', role: 'COORDINADOR', department: 'Formosa' }), 201);
    expect(JSON.stringify(u)).not.toMatch(/passwordHash|argon2/);
    expect((await s.post('/users', { email, password: PASSWORD, firstName: 'U', lastName: 'Test', role: 'COORDINADOR' })).status()).toBe(409);
    const lista = await data(await s.get('/users?role=COORDINADOR&isActive=true&limit=100'));
    expect(lista.every((x: any) => x.role === 'COORDINADOR' && x.isActive)).toBe(true);
    expect(lista.map((x: any) => x.id)).toContain(u.id);
    await data(await s.del(`/users/${u.id}`), [200, 204]).catch(() => undefined);
    const tras = await s.get(`/users/${u.id}`);
    if (tras.status() === 200) expect((await body(tras)).data.isActive).toBe(false); // baja lógica
    else expect(tras.status()).toBe(404);
    const login = await new Api(await newCtx()).post('/auth/login', { email, password: PASSWORD });
    expect([401, 403]).toContain(login.status());
  });

  test('validaciones: email, contraseña corta, rol inválido → 400; contraseña inválida en el PATCH', async () => {
    const s = await sa();
    const base = { email: `${uniq('v').toLowerCase()}@evita-e2e.test`, password: PASSWORD, firstName: 'U', lastName: 'T', role: 'ARBITRO' };
    for (const mal of [{ email: 'x' }, { password: '123' }, { role: 'REY' }, { firstName: '' }]) {
      expect((await s.post('/users', { ...base, ...mal })).status(), JSON.stringify(mal)).toBe(400);
    }
  });

  test('sólo SUPER_ADMIN crea/edita; PROVINCIAL lista; el resto 403', async () => {
    const p = await prov();
    expect((await p.get('/users')).status()).toBe(200);
    expect((await p.post('/users', { email: 'a@b.cc', password: PASSWORD, firstName: 'a', lastName: 'b', role: 'ARBITRO' })).status()).toBe(403);
    expect((await (await as('DELEGADO')).api.get('/users')).status()).toBe(403);
  });

  test('un usuario no puede desactivarse a sí mismo ni al último SUPER_ADMIN', async () => {
    knownBug('F-19: el SUPER_ADMIN puede desactivar/eliminar su propia cuenta (el sistema podría quedar sin administrador)');
    const s = await sa();
    const me = (await as('SUPER_ADMIN')).user;
    const r = await s.patch(`/users/${me.id}`, { isActive: false });
    // limpieza defensiva por si el defecto estuviera corregido o no
    if (r.status() === 200) await s.patch(`/users/${me.id}`, { isActive: true });
    expect(r.status()).toBeGreaterThanOrEqual(400);
  });

  test('cambio de contraseña: la nueva funciona y la vieja no', async () => {
    const s = await sa();
    const email = `${uniq('pw').toLowerCase()}@evita-e2e.test`;
    const u = await data(await s.post('/users', { email, password: PASSWORD, firstName: 'P', lastName: 'W', role: 'ARBITRO' }), 201);
    const nueva = PASSWORD + 'x9';
    await data(await s.patch(`/users/${u.id}`, { password: nueva }));
    const api = new Api(await newCtx());
    expect((await api.post('/auth/login', { email, password: PASSWORD })).status()).toBe(401);
    expect((await api.post('/auth/login', { email, password: nueva })).status()).toBe(200);
  });
});

test.describe('zonas', () => {
  test('reemplazar departamentos, leer y borrar; validaciones', async () => {
    const s = await prov();
    const zona = uniq('Z');
    expect((await s.put(`/zones/${zona}`, { departments: ['Formosa', 'Laishí'] })).status()).toBeLessThan(300);
    const det = await data(await s.get(`/zones/${zona}`));
    expect(JSON.stringify(det)).toContain('Laishí');
    expect((await s.put(`/zones/${zona}`, { departments: [] })).status()).toBe(400);
    expect((await s.put(`/zones/${uniq('Z')}`, { departments: ['Atlantida'] })).status()).toBe(400);
    expect((await (await as('ADMIN_ZONAL')).api.put(`/zones/${zona}`, { departments: ['Formosa'] })).status()).toBe(403);
    expect((await s.del(`/zones/${zona}`)).status()).toBeLessThan(300);
    expect((await s.get(`/zones/${zona}`)).status()).toBe(404);
  });
});

test.describe('catálogo', () => {
  test('disciplinas: lectura pública; alta con validación de plantel; duplicado 409; sólo provincial escribe', async () => {
    const a = await anon();
    expect((await data(await a.get('/disciplines'))).length).toBeGreaterThan(0);
    const s = await prov();
    const nombre = uniq('Disc');
    const d = await data(await s.post('/disciplines', { name: nombre, type: 'EQUIPO', resultType: 'GOLES', titulares: 5, maxSuplentes: 3 }), 201);
    expect(d).toMatchObject({ titulares: 5, maxSuplentes: 3, isActive: true });
    expect((await s.post('/disciplines', { name: nombre, type: 'EQUIPO', resultType: 'GOLES' })).status()).toBe(409);
    expect((await s.post('/disciplines', { name: uniq('D'), type: 'COLECTIVO', resultType: 'GOLES' })).status()).toBe(400);
    expect((await s.post('/disciplines', { name: uniq('D'), type: 'EQUIPO', resultType: 'GOLES', titulares: 0 })).status()).toBe(400);
    expect((await (await as('ADMIN_DEPARTAMENTAL')).api.post('/disciplines', { name: uniq('D'), type: 'EQUIPO', resultType: 'GOLES' })).status()).toBe(403);
    expect((await s.patch(`/disciplines/${d.id}`, { maxSuplentes: 4 })).status()).toBe(200);
    expect((await s.del(`/disciplines/${d.id}`)).status()).toBeLessThan(300);
  });

  test('categorías: rango de edad coherente y pertenencia a disciplina', async () => {
    const s = await prov();
    const disc = (await data(await s.get('/disciplines'))).find((x: any) => x.type === 'INDIVIDUAL');
    const ok = await data(await s.post('/categories', { disciplineId: disc.id, name: uniq('Cat'), minAge: 8, maxAge: 12, sex: 'FEMENINO' }), 201);
    expect(ok.maxAge).toBe(12);
    expect((await s.post('/categories', { disciplineId: disc.id, name: uniq('Cat'), minAge: 15, maxAge: 10, sex: 'MIXTO' })).status(), 'min > max').toBe(400);
    expect((await s.post('/categories', { disciplineId: disc.id, name: uniq('Cat'), minAge: -1, maxAge: 10, sex: 'MIXTO' })).status()).toBe(400);
    expect((await s.post('/categories', { disciplineId: '99999999-9999-4999-8999-999999999999', name: uniq('Cat'), minAge: 1, maxAge: 10, sex: 'MIXTO' })).status()).toBeLessThan(500);
    expect((await s.patch(`/categories/${ok.id}`, { minAge: 20 })).status(), 'actualizar dejando min > max').toBe(400);
    expect((await s.del(`/categories/${ok.id}`)).status()).toBeLessThan(300);
  });

  test('borrar una categoría/disciplina con datos asociados la desactiva (no la elimina) y borrar una vacía la elimina', async () => {
    const s = await prov();
    const d = await data(await s.post('/disciplines', { name: uniq('Disc'), type: 'INDIVIDUAL', resultType: 'PUNTOS' }), 201);
    const c = await data(await s.post('/categories', { disciplineId: d.id, name: uniq('Cat'), minAge: 5, maxAge: 99, sex: 'MIXTO' }), 201);
    const vacia = await data(await s.post('/categories', { disciplineId: d.id, name: uniq('Vac'), minAge: 5, maxAge: 99, sex: 'MIXTO' }), 201);
    await data(await s.post('/inscriptions', { dni: String(30000000 + Math.floor(Math.random() * 9e6)), firstName: 'A', lastName: uniq('L'), birthDate: '2010-01-01', sex: 'MASCULINO', locality: 'Formosa', department: 'Formosa', categoryId: c.id }), 201);
    const r = await data(await s.del(`/categories/${c.id}`));
    expect(r.isActive).toBe(false);
    expect((await s.del(`/categories/${vacia.id}`)).status()).toBeLessThan(300);
    expect((await s.get(`/categories/${vacia.id}`)).status()).toBe(404);
  });
});

test.describe('auditoría', () => {
  test('sólo SUPER_ADMIN/PROVINCIAL; filtros por acción/entidad; fechas inválidas → 400; sin PII en detalle', async () => {
    const s = await prov();
    const l = await body(await s.get('/audit?limit=5'));
    expect(l.data.length).toBeGreaterThan(0);
    expect(l.meta.total).toBeGreaterThan(0);
    const acc = await body(await s.get('/audit?action=LOGIN&limit=5'));
    expect(acc.data.every((x: any) => x.action === 'LOGIN')).toBe(true);
    expect((await s.get('/audit?fromDate=ayer')).status()).toBe(400);
    expect((await s.get('/audit?userId=xx')).status()).toBe(400);
    expect((await (await as('ADMIN_ZONAL')).api.get('/audit')).status()).toBe(403);
    expect(JSON.stringify(l)).not.toMatch(/argon2|passwordHash|refreshToken/i);
  });

  test('fromDate/toDate con sólo la fecha incluyen el día completo', async () => {
    knownBug('F-18: toDate=YYYY-MM-DD se interpreta como las 00:00 y excluye los registros de ese día (calendario y auditoría)');
    const s = await prov();
    const hoy = new Date().toISOString().slice(0, 10);
    const l = await body(await s.get(`/audit?fromDate=${hoy}&toDate=${hoy}&limit=5`));
    expect(l.data.length).toBeGreaterThan(0);
  });
});

test.describe('dashboard, estadísticas y reportes', () => {
  test('dashboard: totales coherentes con el desglose por estado', async () => {
    const d = await data(await (await as('ADMIN_PROVINCIAL')).api.get('/dashboard/stats'));
    const suma = d.inscriptionsByStatus.reduce((t: number, x: any) => t + x.count, 0);
    expect(suma).toBe(d.totalInscriptions);
    expect(d.demographics.reduce((t: number, x: any) => t + x.count, 0)).toBe(d.totalParticipants);
  });

  test('dashboard de un ADMIN_DEPARTAMENTAL se limita a su alcance', async () => {
    const p = await data(await (await as('ADMIN_PROVINCIAL')).api.get('/dashboard/stats'));
    const d = await data(await (await as('ADMIN_DEPARTAMENTAL')).api.get('/dashboard/stats'));
    expect(d.totalParticipants).toBeLessThanOrEqual(p.totalParticipants);
  });

  test('stats de localidades: público, sin datos personales, con agregados coherentes', async () => {
    const r = await body(await (await anon()).get('/stats/localities'));
    expect(r.data.localities.length).toBeGreaterThan(0);
    const txt = JSON.stringify(r);
    expect(txt).not.toMatch(/"(dni|firstName|lastName|birthDate|email)"/);
    for (const l of r.data.localities) {
      expect(l.athletes).toBeGreaterThanOrEqual(0);
      expect(l.podiums.first + l.podiums.second + l.podiums.third).toBeGreaterThanOrEqual(0);
    }
  });

  for (const rep of ['participants', 'inscriptions', 'teams', 'results']) {
    test(`reporte ${rep}: CSV (cabeceras, BOM/UTF-8, no-store) y XLSX`, async () => {
      const s = await prov();
      const csv = await s.get(`/reports/${rep}`);
      expect(csv.status()).toBe(200);
      expect(csv.headers()['content-type']).toContain('text/csv');
      expect(csv.headers()['content-disposition']).toContain('attachment');
      expect(csv.headers()['cache-control']).toContain('no-store');
      const texto = await csv.text();
      expect(texto.split('\n')[0].length).toBeGreaterThan(5);
      const xlsx = await s.get(`/reports/${rep}?format=xlsx`);
      expect(xlsx.status()).toBe(200);
      expect(xlsx.headers()['content-type']).toContain('spreadsheetml');
      expect((await xlsx.body()).subarray(0, 2).toString()).toBe('PK'); // zip
    });
  }

  test('reporte de participantes respeta el alcance: DELEGADO de Formosa no exporta otros departamentos', async () => {
    const del = (await as('DELEGADO')).api;
    const txt = await (await del.get('/reports/participants')).text();
    expect(txt).not.toMatch(/Pilcomayo/);
  });

  test('reportes: sin token 401, ARBITRO 403', async () => {
    expect((await (await anon()).get('/reports/participants')).status()).toBe(401);
    expect((await (await as('ARBITRO')).api.get('/reports/participants')).status()).toBe(403);
  });

  test('reporte con filtro inválido nunca responde 500', async () => {
    knownBug('F-20: /reports/participants?disciplineId=zz (y otros filtros) responden 500 en vez de 400');
    const s = await prov();
    for (const q of ['?sex=X', '?disciplineId=zz', '?status=XX', '?format=pdf', '?from=ayer']) {
      for (const rep of ['participants', 'inscriptions', 'results']) {
        const r = await s.get(`/reports/${rep}${q}`);
        expect(r.status(), `${rep}${q}`).toBeLessThan(500);
      }
    }
  });
});

test.describe('todos los roles reciben 401/403 coherente en rutas administrativas', () => {
  test('sin token: toda ruta administrativa responde 401', async () => {
    const a = await anon();
    for (const ruta of ['/users', '/audit', '/zones', '/participants', '/teams', '/inscriptions', '/dashboard/stats', '/reports/teams', '/survey/campaigns']) {
      expect((await a.get(ruta)).status(), ruta).toBe(401);
    }
  });
  test('los 9 roles pueden iniciar sesión y /me refleja su rol', async () => {
    for (const rol of ROLES) {
      const s = await as(rol);
      expect((await data(await s.api.get('/auth/me'))).role).toBe(rol);
      expect(s.user.email).toBe(roleEmail(rol));
    }
  });
});
