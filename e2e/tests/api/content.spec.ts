// Contenido: noticias (CRUD, borradores, imagen subida/URL, orden, sync protegido), calendario, sedes (CRUD + foto).
import { expect, test } from '@playwright/test';
import { EXE, PNG, anon, as, body, data, uniq } from '../../lib/api';

const prov = async () => (await as('ADMIN_PROVINCIAL')).api;

test.describe('noticias', () => {
  test('borrador: no aparece en el listado público ni por slug; al publicar queda con publishedAt real', async () => {
    const s = await prov();
    const titulo = uniq('Noticia');
    const n = await data(await s.post('/news', { title: titulo, content: '<p>Contenido</p>', excerpt: 'Resumen' }), 201);
    expect(n.isPublished).toBeFalsy();
    expect(n.publishedAt ?? null).toBeNull();
    const a = await anon();
    const pub = await data(await a.get('/news?limit=50'));
    expect(JSON.stringify(pub)).not.toContain(titulo);
    expect((await a.get(`/news/slug/${n.slug}`)).status()).toBe(404);
    expect((await a.get(`/news/${n.id}`)).status()).toBe(404);

    const antes = Date.now();
    const pubd = await data(await s.patch(`/news/${n.id}`, { isPublished: true }));
    expect(new Date(pubd.publishedAt).getTime()).toBeGreaterThanOrEqual(antes - 5000);
    expect(JSON.stringify(await data(await a.get('/news?limit=50')))).toContain(titulo);
    const porSlug = await data(await a.get(`/news/slug/${n.slug}`));
    expect(porSlug.id).toBe(n.id);
    // despublicar la saca del público y borra publishedAt
    const des = await data(await s.patch(`/news/${n.id}`, { isPublished: false }));
    expect(des.publishedAt ?? null).toBeNull();
    expect((await a.get(`/news/slug/${n.slug}`)).status()).toBe(404);
    expect((await s.del(`/news/${n.id}`)).status()).toBeLessThan(300);
  });

  test('orden por defecto: publicación más nueva primero; sortBy=title ascendente', async () => {
    const s = await prov();
    const p1 = await data(await s.post('/news', { title: uniq('A-orden'), content: 'x', isPublished: true }), 201);
    await new Promise((r) => setTimeout(r, 30));
    const p2 = await data(await s.post('/news', { title: uniq('B-orden'), content: 'x', isPublished: true }), 201);
    const lista = await data(await anon().then((a) => a.get('/news?limit=50')));
    const i1 = lista.findIndex((n: any) => n.id === p1.id);
    const i2 = lista.findIndex((n: any) => n.id === p2.id);
    expect(i2).toBeGreaterThanOrEqual(0);
    expect(i2).toBeLessThan(i1);
    const fechas = lista.map((n: any) => new Date(n.publishedAt).getTime());
    expect([...fechas].sort((x, y) => y - x)).toEqual(fechas);
    await s.del(`/news/${p1.id}`);
    await s.del(`/news/${p2.id}`);
  });

  test('sortBy=title ordena en español (Á junto a A, no después de Z)', async () => {
    const s = await prov();
    const base = uniq('o');
    const ids: string[] = [];
    for (const t of [`Zeta ${base}`, `Árbol ${base}`, `Alfa ${base}`]) ids.push((await data(await s.post('/news', { title: t, content: 'x', isPublished: true }), 201)).id);
    const lista = await data(await s.get(`/news?sortBy=title&sortOrder=asc&search=${base}&limit=50`));
    for (const id of ids) await s.del(`/news/${id}`);
    expect(lista.map((n: any) => n.title.split(' ')[0])).toEqual(['Alfa', 'Árbol', 'Zeta']);
  });

  test('imagen subida: JPG/PNG/WebP por firma, se sirve pública con cache immutable y nosniff; se puede quitar', async () => {
    const s = await prov();
    const n = await data(await s.post('/news', { title: uniq('ConFoto'), content: 'x', isPublished: true }), 201);
    expect((await s.upload(`/news/${n.id}/image`, { name: 'x.png', mimeType: 'image/png', buffer: EXE })).status()).toBe(400);
    const ok = await s.upload(`/news/${n.id}/image`, { name: 'x.png', mimeType: 'image/png', buffer: PNG });
    expect(ok.status()).toBe(201);
    const img = await (await anon()).get(`/news/${n.id}/image`);
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toContain('image/png');
    expect(img.headers()['x-content-type-options']).toBe('nosniff');
    expect(img.headers()['cache-control']).toMatch(/immutable/);
    expect(Buffer.from(await img.body()).equals(PNG)).toBe(true);
    const quitada = await s.del(`/news/${n.id}/image`);
    expect(quitada.status()).toBeLessThan(300);
    expect((await (await anon()).get(`/news/${n.id}/image`)).status()).toBe(404);
    await s.del(`/news/${n.id}`);
  });

  test('imagen por URL: sólo https; "" la quita; http/javascript/data se rechazan', async () => {
    const s = await prov();
    const n = await data(await s.post('/news', { title: uniq('UrlImg'), content: 'x', isPublished: true, imageKey: 'https://example.org/foto.jpg' }), 201);
    expect(n.imageUrl ?? n.imageKey).toContain('https://example.org/foto.jpg');
    for (const mala of ['http://example.org/f.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://x/y.png']) {
      expect((await s.patch(`/news/${n.id}`, { imageKey: mala })).status(), mala).toBe(400);
    }
    const sin = await data(await s.patch(`/news/${n.id}`, { imageKey: '' }));
    expect(sin.imageUrl ?? null).toBeNull();
    await s.del(`/news/${n.id}`);
  });

  test('permisos: DELEGADO/ARBITRO no gestionan noticias; el sync sólo SUPER_ADMIN/PROVINCIAL (sin llegar al portal)', async () => {
    for (const rol of ['DELEGADO', 'ARBITRO', 'COORDINADOR'] as const) {
      expect((await (await as(rol)).api.post('/news', { title: 'x', content: 'y' })).status(), rol).toBe(403);
    }
    for (const rol of ['ADMIN_DEPARTAMENTAL', 'ADMIN_ZONAL', 'DELEGADO'] as const) {
      expect((await (await as(rol)).api.post('/news/sync', {})).status(), `sync ${rol}`).toBe(403);
    }
    expect((await (await anon()).post('/news/sync', {})).status()).toBe(401);
  });

  test('sync con el portal caído (stack sin salida a Internet): 503 explícito, aborta y no inventa "0 noticias"', async () => {
    const s = await prov();
    const antes = (await body(await s.get('/news?isExternal=true&limit=1'))).meta.total;
    const r = await s.post('/news/sync', {});
    expect(r.status()).toBe(503);
    expect((await body(r)).message).toMatch(/portal no responde|abort/i);
    expect((await body(await s.get('/news?isExternal=true&limit=1'))).meta.total).toBe(antes);
  });

  test('validación de alta y de filtros', async () => {
    const s = await prov();
    expect((await s.post('/news', { title: '', content: 'x' })).status()).toBe(400);
    expect((await s.post('/news', { title: 'x' })).status()).toBe(400);
    expect((await s.get('/news?sortBy=passwordHash')).status()).toBe(400);
    expect((await s.get('/news?isPublished=talvez')).status()).toBe(400);
  });

  test('títulos repetidos generan slugs distintos', async () => {
    const s = await prov();
    const titulo = uniq('Repetida');
    const a = await data(await s.post('/news', { title: titulo, content: 'x' }), 201);
    const b = await data(await s.post('/news', { title: titulo, content: 'x' }), 201);
    expect(a.slug).not.toBe(b.slug);
    await s.del(`/news/${a.id}`);
    await s.del(`/news/${b.id}`);
  });

  test('una noticia importada del portal no se edita ni se borra desde la API', async () => {
    const s = await prov();
    const ext = await data(await s.get('/news?isExternal=true&limit=1'));
    test.skip(ext.length === 0, 'el stack aislado no tiene noticias del portal (el sync está deshabilitado y sin salida a Internet)');
    expect((await s.patch(`/news/${ext[0].id}`, { title: 'x' })).status()).toBeGreaterThanOrEqual(400);
    expect((await s.del(`/news/${ext[0].id}`)).status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('calendario', () => {
  test('CRUD, publicación y rango de fechas', async () => {
    const s = await prov();
    const inicio = new Date(Date.now() + 7 * 864e5).toISOString();
    const ev = await data(await s.post('/calendar', { title: uniq('Evento'), startDate: inicio, stage: 'ZONAL', isPublished: false }), 201);
    const a = await anon();
    expect(JSON.stringify(await data(await a.get('/calendar?limit=100')))).not.toContain(ev.id);
    await data(await s.patch(`/calendar/${ev.id}`, { isPublished: true }));
    expect(JSON.stringify(await data(await a.get('/calendar?limit=100')))).toContain(ev.id);
    expect((await s.del(`/calendar/${ev.id}`)).status()).toBeLessThan(300);
    expect((await a.get(`/calendar/${ev.id}`)).status()).toBe(404);
  });

  test('filtrar por un día (fromDate=toDate=YYYY-MM-DD) incluye los eventos de ese día', async () => {
    const s = await prov();
    const inicio = new Date(Date.now() + 9 * 864e5);
    inicio.setUTCHours(15, 0, 0, 0);
    const ev = await data(await s.post('/calendar', { title: uniq('Dia'), startDate: inicio.toISOString(), isPublished: true }), 201);
    const dia = inicio.toISOString().slice(0, 10);
    const rango = await data(await (await anon()).get(`/calendar?fromDate=${dia}&toDate=${dia}&limit=100`));
    await s.del(`/calendar/${ev.id}`);
    expect(JSON.stringify(rango)).toContain(ev.id);
  });

  test('validaciones: fecha inválida, fin anterior al inicio, etapa inválida', async () => {
    const s = await prov();
    expect((await s.post('/calendar', { title: 'x', startDate: 'mañana' })).status()).toBe(400);
    expect((await s.post('/calendar', { title: 'x', startDate: '2026-12-02T10:00:00Z', stage: 'MUNDIAL' })).status()).toBe(400);
  });

  test('un evento que termina antes de empezar se rechaza', async () => {
    const s = await prov();
    const r = await s.post('/calendar', { title: uniq('Inv'), startDate: '2026-12-10T10:00:00Z', endDate: '2026-12-01T10:00:00Z' });
    if (r.ok()) await s.del(`/calendar/${(await body(r)).data.id}`);
    expect(r.status()).toBe(400);
  });

  test('venueId/disciplineId inválidos → 400 (no 500 con detalle de Prisma)', async () => {
    const s = await prov();
    const r = await s.post('/calendar', { title: uniq('Fk'), startDate: '2026-12-02T10:00:00Z', venueId: 'no-uuid' });
    expect(r.status()).toBe(400);
  });

  test('permisos de escritura', async () => {
    for (const rol of ['DELEGADO', 'ARBITRO'] as const) {
      expect((await (await as(rol)).api.post('/calendar', { title: 'x', startDate: '2026-12-02T10:00:00Z' })).status(), rol).toBe(403);
    }
  });
});

test.describe('sedes', () => {
  test('CRUD con coordenadas y capacidad; validaciones de rango', async () => {
    const s = await prov();
    const v = await data(await s.post('/venues', { name: uniq('Sede'), address: 'Calle 1', locality: 'Formosa', department: 'Formosa', latitude: -26.18, longitude: -58.17, capacity: 500 }), 201);
    expect(v).toMatchObject({ latitude: -26.18, longitude: -58.17, capacity: 500 });
    expect((await s.patch(`/venues/${v.id}`, { capacity: -1 })).status()).toBe(400);
    expect((await s.patch(`/venues/${v.id}`, { capacity: 12.5 })).status()).toBe(400);
    const up = await data(await s.patch(`/venues/${v.id}`, { capacity: 800, isActive: false }));
    expect(up).toMatchObject({ capacity: 800, isActive: false });
    expect((await s.del(`/venues/${v.id}`)).status()).toBeLessThan(300);
    expect((await (await anon()).get(`/venues/${v.id}`)).status()).toBe(404);
  });

  test('coordenadas fuera de rango (lat > 90, lon > 180) se rechazan', async () => {
    const s = await prov();
    const r = await s.post('/venues', { name: uniq('Mala'), address: 'x', locality: 'Formosa', department: 'Formosa', latitude: 999, longitude: 999 });
    if (r.ok()) await s.del(`/venues/${(await body(r)).data.id}`);
    expect(r.status()).toBe(400);
  });

  test('foto: sube, se sirve pública, no expone imageKey, se quita; ejecutable disfrazado → 400', async () => {
    const s = await prov();
    const v = await data(await s.post('/venues', { name: uniq('Foto'), address: 'x', locality: 'Formosa', department: 'Formosa' }), 201);
    expect((await s.upload(`/venues/${v.id}/image`, { name: 'a.png', mimeType: 'image/png', buffer: EXE })).status()).toBe(400);
    const ok = await data(await s.upload(`/venues/${v.id}/image`, { name: 'a.png', mimeType: 'image/png', buffer: PNG }), 201);
    expect(ok.imageUrl).toBeTruthy();
    expect(JSON.stringify(ok)).not.toContain('imageKey');
    const a = await anon();
    const img = await a.get(`/venues/${v.id}/image`);
    expect(img.status()).toBe(200);
    expect(Buffer.from(await img.body()).equals(PNG)).toBe(true);
    expect((await s.del(`/venues/${v.id}/image`)).status()).toBeLessThan(300);
    expect((await a.get(`/venues/${v.id}/image`)).status()).toBe(404);
    await s.del(`/venues/${v.id}`);
  });

  test('lectura pública sin token; escritura prohibida a DELEGADO y sin token', async () => {
    expect((await (await anon()).get('/venues')).status()).toBe(200);
    expect((await (await as('DELEGADO')).api.post('/venues', { name: 'x', address: 'y', locality: 'z', department: 'w' })).status()).toBe(403);
    expect((await (await anon()).post('/venues', {})).status()).toBe(401);
  });
});
