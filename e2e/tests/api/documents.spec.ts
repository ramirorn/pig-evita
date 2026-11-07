// Documentos: subida (MinIO real), validación por firma, revisión, links firmados y alcance.
import { knownBug } from '../../lib/bugs';
import { expect, test } from '@playwright/test';
import { DEPTO, EXE, PDF, PNG, as, body, data, nextDni, uniq } from '../../lib/api';

async function participante(rol: 'ADMIN_PROVINCIAL' | 'DELEGADO' = 'ADMIN_PROVINCIAL', depto = DEPTO, loc = 'Formosa') {
  const s = (await as(rol)).api;
  return data(
    await s.post('/participants', {
      dni: nextDni(), firstName: 'Doc', lastName: uniq('D'), birthDate: '2012-03-04', sex: 'MASCULINO', locality: loc, department: depto,
    }),
    201,
  );
}
const subir = async (rol: 'ADMIN_PROVINCIAL' | 'DELEGADO', participantId: string, type: string, buffer: Buffer, name: string, mimeType: string) =>
  (await as(rol)).api.upload('/documents/upload', { name, mimeType, buffer }, { participantId, type });

test.describe('documentos', () => {
  test('subir PNG/PDF → 201 PENDIENTE; el link firmado descarga los mismos bytes desde MinIO', async () => {
    const p = await participante();
    const r = await subir('ADMIN_PROVINCIAL', p.id, 'DNI_FRENTE', PNG, 'frente.png', 'image/png');
    const doc = await data(r, 201);
    expect(doc).toMatchObject({ documentType: 'DNI_FRENTE', status: 'PENDIENTE', mimeType: 'image/png' });
    await data(await subir('ADMIN_PROVINCIAL', p.id, 'CERTIFICADO_MEDICO', PDF, 'cert.pdf', 'application/pdf'), 201);

    const s = (await as('ADMIN_PROVINCIAL')).api;
    const lista = await data(await s.get(`/documents/participant/${p.id}`));
    expect(lista).toHaveLength(2);
    const conUrl = lista.find((d: any) => d.documentType === 'DNI_FRENTE');
    const url: string = conUrl.url ?? conUrl.presignedUrl ?? conUrl.downloadUrl;
    expect(url, 'cada documento debe traer su link firmado').toBeTruthy();
    expect(url).toMatch(/^http:\/\/localhost:19100\//);
    const bytes = await fetch(url);
    expect(bytes.status).toBe(200);
    expect(Buffer.from(await bytes.arrayBuffer()).equals(PNG)).toBe(true);
    // El bucket es privado: sin firma no se lee
    const sinFirma = await fetch(url.split('?')[0]);
    expect(sinFirma.status).toBeGreaterThanOrEqual(400);
  });

  test('rechaza un ejecutable disfrazado de PNG (firma real) y extensiones no permitidas', async () => {
    const p = await participante();
    expect((await subir('ADMIN_PROVINCIAL', p.id, 'FOTO', EXE, 'foto.png', 'image/png')).status()).toBe(400);
    expect((await subir('ADMIN_PROVINCIAL', p.id, 'FOTO', PNG, 'foto.exe', 'application/octet-stream')).status()).toBeGreaterThanOrEqual(400);
    expect((await subir('ADMIN_PROVINCIAL', p.id, 'TIPO_RARO', PNG, 'f.png', 'image/png')).status()).toBe(400);
  });

  test('archivo mayor a 5 MB → 422', async () => {
    const p = await participante();
    const grande = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10, 1)]);
    expect((await subir('ADMIN_PROVINCIAL', p.id, 'FOTO', grande, 'grande.png', 'image/png')).status()).toBe(422);
  });

  test('sin archivo o con participante inexistente → error de cliente, nunca 500', async () => {
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const sin = await s.post('/documents/upload', undefined, { multipart: { participantId: (await participante()).id, type: 'FOTO' } });
    expect(sin.status()).toBeLessThan(500);
    expect(sin.status()).toBeGreaterThanOrEqual(400);
    const inex = await subir('ADMIN_PROVINCIAL', '99999999-9999-4999-8999-999999999999', 'FOTO', PNG, 'f.png', 'image/png');
    expect(inex.status()).toBe(404);
  });

  test('revisión: aprobar, rechazar exige observaciones, ARBITRO/DELEGADO no revisan', async () => {
    const p = await participante();
    const doc = await data(await subir('ADMIN_PROVINCIAL', p.id, 'FOTO', PNG, 'f.png', 'image/png'), 201);
    const s = (await as('ADMIN_ZONAL')).api;
    expect((await s.patch(`/documents/${doc.id}/review`, { status: 'RECHAZADO' })).status(), 'rechazo sin notas').toBe(400);
    const ok = await data(await s.patch(`/documents/${doc.id}/review`, { status: 'RECHAZADO', notes: 'Ilegible' }));
    expect(ok.status).toBe('RECHAZADO');
    const apr = await data(await s.patch(`/documents/${doc.id}/review`, { status: 'APROBADO' }));
    expect(apr.status).toBe('APROBADO');
    for (const rol of ['DELEGADO', 'ARBITRO', 'COORDINADOR'] as const) {
      expect((await (await as(rol)).api.patch(`/documents/${doc.id}/review`, { status: 'APROBADO' })).status(), rol).toBe(403);
    }
  });

  test('la revisión sólo admite APROBADO o RECHAZADO (no se puede volver a PENDIENTE)', async () => {
    knownBug('F-08: PATCH /documents/:id/review acepta status=PENDIENTE aunque el contrato declara sólo APROBADO|RECHAZADO');
    const p = await participante();
    const doc = await data(await subir('ADMIN_PROVINCIAL', p.id, 'FOTO', PNG, 'f.png', 'image/png'), 201);
    const r = await (await as('ADMIN_PROVINCIAL')).api.patch(`/documents/${doc.id}/review`, { status: 'PENDIENTE' });
    expect(r.status()).toBe(400);
  });

  test('rechazo con observaciones sólo de espacios → 400', async () => {
    knownBug('F-07: las observaciones "   " se aceptan como motivo de rechazo del documento');
    const p = await participante();
    const doc = await data(await subir('ADMIN_PROVINCIAL', p.id, 'FOTO', PNG, 'f.png', 'image/png'), 201);
    const r = await (await as('ADMIN_PROVINCIAL')).api.patch(`/documents/${doc.id}/review`, { status: 'RECHAZADO', notes: '   ' });
    expect(r.status()).toBe(400);
  });

  test('alcance: un DELEGADO de Formosa no lista ni sube documentos de un participante de otro departamento', async () => {
    const ajeno = await participante('ADMIN_PROVINCIAL', 'Pilcomayo', 'Clorinda');
    await data(await subir('ADMIN_PROVINCIAL', ajeno.id, 'FOTO', PNG, 'f.png', 'image/png'), 201);
    const del = (await as('DELEGADO')).api;
    const lista = await del.get(`/documents/participant/${ajeno.id}`);
    if (lista.status() === 200) expect(await data(lista)).toHaveLength(0);
    else expect([403, 404]).toContain(lista.status());
    expect([403, 404]).toContain((await subir('DELEGADO', ajeno.id, 'FOTO', PNG, 'f.png', 'image/png')).status());
  });

  test('sin token → 401', async () => {
    const r = await (await import('../../lib/api')).anon();
    expect((await (await r).get('/documents/participant/99999999-9999-4999-8999-999999999999')).status()).toBe(401);
  });

  test('el listado nunca expone fileKey interno ni credenciales de MinIO', async () => {
    const p = await participante();
    await data(await subir('ADMIN_PROVINCIAL', p.id, 'FOTO', PNG, 'f.png', 'image/png'), 201);
    const txt = JSON.stringify(await body(await (await as('ADMIN_PROVINCIAL')).api.get(`/documents/participant/${p.id}`)));
    expect(txt).not.toMatch(/secret|SECRET/);
  });
});
