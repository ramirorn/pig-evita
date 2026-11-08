// Participantes, inscripciones (individual y por plantel), QR público, revisión/aprobación y alcance territorial.
import { expect, test } from '@playwright/test';
import { DEPTO, anon, as, body, data, nextDni, uniq } from '../../lib/api';

const persona = (over: Record<string, unknown> = {}) => ({
  dni: nextDni(),
  firstName: 'Prueba',
  lastName: uniq('Ap'),
  birthDate: '2012-03-04',
  sex: 'MASCULINO',
  locality: 'Formosa',
  department: DEPTO,
  ...over,
});

async function catalogo() {
  const s = (await as('SUPER_ADMIN')).api;
  const cats = (await data(await s.get('/categories?limit=100'))) as any[];
  return {
    individual: cats.find((c) => c.discipline.type === 'INDIVIDUAL' && c.sex === 'MIXTO')!,
    femenina: cats.find((c) => c.discipline.type === 'EQUIPO' && c.sex === 'FEMENINO')!,
    masculina: cats.find((c) => c.discipline.type === 'EQUIPO' && c.sex === 'MASCULINO')!,
  };
}

test.describe('participantes', () => {
  test('alta, duplicado de DNI → 409, búsqueda por DNI (CA-B1.1 a B1.3)', async () => {
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const p = persona();
    const creado = await data(await s.post('/participants', p), 201);
    expect(creado).toMatchObject({ dni: p.dni, firstName: 'Prueba' });
    const dup = await s.post('/participants', persona({ dni: p.dni }));
    expect(dup.status()).toBe(409);
    const porDni = await data(await s.get(`/participants/dni/${p.dni}`));
    expect(porDni.id).toBe(creado.id);
    expect((await s.get('/participants/dni/00000001')).status()).toBe(404);
  });

  test('validaciones: DNI mal formado, fecha inválida, sexo inválido, campos obligatorios → 400', async () => {
    const s = (await as('ADMIN_PROVINCIAL')).api;
    for (const mal of [
      persona({ dni: 'abc' }),
      persona({ dni: '123' }),
      persona({ birthDate: 'no-es-fecha' }),
      persona({ sex: 'OTRO' }),
      persona({ firstName: '' }),
      persona({ locality: '' }),
      persona({ email: 'no-email' }),
    ]) {
      expect((await s.post('/participants', mal)).status(), JSON.stringify(mal)).toBe(400);
    }
  });

  test('la edad se calcula en cada consulta (CA-B1.4)', async () => {
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const c = await data(await s.post('/participants', persona({ birthDate: '2010-01-01' })), 201);
    const det = await data(await s.get(`/participants/${c.id}`));
    expect(typeof det.age, 'el detalle debería exponer `age`').toBe('number');
  });

  test('actualización: roles sin permiso → 403; cambio de DNI sólo SUPER_ADMIN/PROVINCIAL y queda auditado (R17)', async () => {
    const prov = (await as('ADMIN_PROVINCIAL')).api;
    const c = await data(await prov.post('/participants', persona()), 201);
    // ADMIN_ZONAL no puede editar (ACCIONES.PARTICIPANT_UPDATE)
    expect((await (await as('ADMIN_ZONAL')).api.patch(`/participants/${c.id}`, { address: 'x' })).status()).toBe(403);
    // DELEGADO puede corregir domicilio pero no el DNI
    const del = (await as('DELEGADO')).api;
    const delPart = await data(await del.post('/participants', persona()), 201);
    expect((await del.patch(`/participants/${delPart.id}`, { address: 'Calle 1' })).status()).toBe(200);
    const nuevo = nextDni();
    const ok = await prov.patch(`/participants/${c.id}`, { dni: nuevo });
    expect(ok.status()).toBe(200);
    const aud = await data(await (await as('SUPER_ADMIN')).api.get('/audit?action=DNI_CHANGE&limit=5'));
    expect(JSON.stringify(aud)).toContain('DNI_CHANGE');
  });

  test('un DELEGADO que intenta cambiar el DNI recibe 403 (no 400)', async () => {
    const del = (await as('DELEGADO')).api;
    const p = await data(await del.post('/participants', persona()), 201);
    expect((await del.patch(`/participants/${p.id}`, { dni: nextDni() })).status()).toBe(403);
  });

  test('alcance territorial: un DELEGADO de Formosa no ve ni abre participantes de otro departamento', async () => {
    const prov = (await as('ADMIN_PROVINCIAL')).api;
    const fuera = await data(await prov.post('/participants', persona({ department: 'Pilcomayo', locality: 'Clorinda' })), 201);
    const del = (await as('DELEGADO')).api;
    const lista = await data(await del.get(`/participants?dni=${fuera.dni}`));
    expect(lista).toHaveLength(0);
    expect([403, 404]).toContain((await del.get(`/participants/${fuera.id}`)).status());
    expect([403, 404]).toContain((await del.get(`/participants/dni/${fuera.dni}`)).status());
    // Y el ADMIN_ZONAL (zona = Formosa) tampoco
    const zonal = (await as('ADMIN_ZONAL')).api;
    expect(await data(await zonal.get(`/participants?dni=${fuera.dni}`))).toHaveLength(0);
  });

  test('un DELEGADO no puede dar de alta fuera de su departamento', async () => {
    const del = (await as('DELEGADO')).api;
    const r = await del.post('/participants', persona({ department: 'Pilcomayo', locality: 'Clorinda' }));
    expect([400, 403]).toContain(r.status());
  });

  test('listado: paginación, límite máximo y orden no permitido', async () => {
    const s = (await as('SUPER_ADMIN')).api;
    const p1 = await body(await s.get('/participants?page=1&limit=5'));
    expect(p1.data.length).toBeLessThanOrEqual(5);
    expect(p1.meta).toMatchObject({ page: 1, limit: 5 });
    expect((await s.get('/participants?limit=100000')).status()).toBe(400);
    expect((await s.get('/participants?sortBy=passwordHash')).status()).toBe(400);
    expect((await s.get('/participants?page=0')).status()).toBe(400);
  });
});

test.describe('inscripción individual', () => {
  test('alta → PENDIENTE con QR único; el QR es público y no filtra PII (CA-B2.1, B2.3)', async () => {
    const { individual } = await catalogo();
    const s = (await as('DELEGADO')).api;
    const ins = await data(await s.post('/inscriptions', { ...persona(), categoryId: individual.id }), 201);
    expect(ins.status).toBe('PENDIENTE');
    expect(ins.qrCode).toMatch(/^EVITA-/);
    const pub = await body(await (await anon()).get(`/inscriptions/qr/${ins.qrCode}`));
    expect(pub.data).toMatchObject({ qrCode: ins.qrCode, status: 'PENDIENTE' });
    const txt = JSON.stringify(pub);
    for (const campo of ['dni', 'birthDate', 'phone', 'email', 'address']) expect(txt).not.toContain(`"${campo}"`);
    expect((await (await anon()).get('/inscriptions/qr/NO-EXISTE')).status()).toBe(404);
  });

  test('categoría que no corresponde por edad o sexo → 400 (CA-B2.2)', async () => {
    const { femenina } = await catalogo(); // Sub-16 femenino 14-16
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const tooYoung = await s.post('/inscriptions', { ...persona({ birthDate: '2020-01-01', sex: 'FEMENINO' }), categoryId: femenina.id });
    expect(tooYoung.status(), 'edad fuera de rango').toBe(400);
    const sexo = await s.post('/inscriptions', { ...persona({ birthDate: '2011-06-01', sex: 'MASCULINO' }), categoryId: femenina.id });
    expect(sexo.status(), 'sexo distinto al de la categoría').toBe(400);
  });

  test('misma persona dos veces en la misma categoría → 409 (CA-B2.4)', async () => {
    const { individual } = await catalogo();
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const p = persona();
    await data(await s.post('/inscriptions', { ...p, categoryId: individual.id }), 201);
    const otra = await s.post('/inscriptions', { ...p, categoryId: individual.id });
    expect(otra.status()).toBe(409);
  });

  test('flujo PENDIENTE → REVISADA → APROBADA y auditoría del cambio (CA-B3.1, B3.4)', async () => {
    const { individual } = await catalogo();
    const s = (await as('ADMIN_DEPARTAMENTAL')).api;
    const ins = await data(await s.post('/inscriptions', { ...persona(), categoryId: individual.id }), 201);
    const rev = await data(await s.patch(`/inscriptions/${ins.id}/review`, {}));
    expect(rev.status).toBe('REVISADA');
    const apr = await data(await s.patch(`/inscriptions/${ins.id}/approve`, {}));
    expect(apr.status).toBe('APROBADA');
    expect(apr.approvedById).toBeTruthy();
    const aud = JSON.stringify(await data(await (await as('SUPER_ADMIN')).api.get('/audit?limit=50&sortBy=createdAt')));
    expect(aud).toMatch(/APPROVE_INSCRIPTION|REVIEW_INSCRIPTION/);
  });

  test('aprobar una PENDIENTE sin revisar se rechaza (CA-B3.1)', async () => {
    const { individual } = await catalogo();
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const ins = await data(await s.post('/inscriptions', { ...persona(), categoryId: individual.id }), 201);
    const r = await s.patch(`/inscriptions/${ins.id}/approve`, {});
    expect(r.status()).toBe(400);
  });

  test('rechazar exige motivo no vacío (CA-B3.3) y lo persiste', async () => {
    const { individual } = await catalogo();
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const ins = await data(await s.post('/inscriptions', { ...persona(), categoryId: individual.id }), 201);
    await data(await s.patch(`/inscriptions/${ins.id}/review`, {}));
    expect((await s.patch(`/inscriptions/${ins.id}/reject`, {})).status()).toBe(400);
    const ok = await data(await s.patch(`/inscriptions/${ins.id}/reject`, { rejectionNote: 'Falta certificado médico' }));
    expect(ok.status).toBe('RECHAZADA');
    expect(ok.rejectionNote).toContain('certificado');
  });

  test('rechazar con motivo sólo de espacios → 400 (CA-B3.3)', async () => {
    const { individual } = await catalogo();
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const ins = await data(await s.post('/inscriptions', { ...persona(), categoryId: individual.id }), 201);
    await data(await s.patch(`/inscriptions/${ins.id}/review`, {}));
    expect((await s.patch(`/inscriptions/${ins.id}/reject`, { rejectionNote: '   ' })).status()).toBe(400);
  });

  test('sólo SUPER_ADMIN, PROVINCIAL y DEPARTAMENTAL aprueban; ZONAL y DELEGADO → 403 (CA-B3.2)', async () => {
    const { individual } = await catalogo();
    const admin = (await as('ADMIN_PROVINCIAL')).api;
    const ins = await data(await admin.post('/inscriptions', { ...persona(), categoryId: individual.id }), 201);
    await data(await admin.patch(`/inscriptions/${ins.id}/review`, {}));
    for (const rol of ['ADMIN_ZONAL', 'DELEGADO', 'COORDINADOR', 'ARBITRO'] as const) {
      const r = await (await as(rol)).api.patch(`/inscriptions/${ins.id}/approve`, {});
      expect(r.status(), rol).toBe(403);
    }
  });

  test('una inscripción aprobada no vuelve a PENDIENTE ni se puede rechazar sin pasar por revisión', async () => {
    const { individual } = await catalogo();
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const ins = await data(await s.post('/inscriptions', { ...persona(), categoryId: individual.id }), 201);
    await data(await s.patch(`/inscriptions/${ins.id}/review`, {}));
    await data(await s.patch(`/inscriptions/${ins.id}/approve`, {}));
    expect((await s.patch(`/inscriptions/${ins.id}/review`, {})).status()).toBe(400);
    expect((await s.patch(`/inscriptions/${ins.id}/approve`, {})).status()).toBe(400);
  });

  test('un DELEGADO sólo ve inscripciones de su departamento', async () => {
    const { individual } = await catalogo();
    const prov = (await as('ADMIN_PROVINCIAL')).api;
    const ajena = await data(
      await prov.post('/inscriptions', { ...persona({ department: 'Pilcomayo', locality: 'Clorinda' }), categoryId: individual.id }),
      201,
    );
    const del = (await as('DELEGADO')).api;
    expect([403, 404]).toContain((await del.get(`/inscriptions/${ajena.id}`)).status());
    const lista = await data(await del.get('/inscriptions?limit=100'));
    expect(JSON.stringify(lista)).not.toContain(ajena.id);
  });

  test('filtro de estado inválido → 400 (no 500 con detalle de Prisma)', async () => {
    const r = await (await as('ADMIN_PROVINCIAL')).api.get('/inscriptions?status=XX');
    expect(r.status()).toBe(400);
    expect(JSON.stringify(await body(r))).not.toMatch(/prisma/i);
  });

  test('listado con filtros y orden; IDs inválidos → 400, inexistente → 404', async () => {
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const l = await body(await s.get('/inscriptions?status=APROBADA&limit=3'));
    expect(l.data.every((i: any) => i.status === 'APROBADA')).toBe(true);
    
    expect((await s.get('/inscriptions/no-uuid')).status()).toBe(400);
    expect((await s.get('/inscriptions/99999999-9999-4999-8999-999999999999')).status()).toBe(404);
  });
});

test.describe('inscripción por plantel (equipos)', () => {
  const miembro = (i: number, suplente = false, over: Record<string, unknown> = {}) => ({
    dni: nextDni(),
    firstName: `Jug${i}`,
    lastName: uniq('Eq'),
    birthDate: '2012-05-05',
    sex: 'MASCULINO',
    locality: 'Formosa',
    department: DEPTO,
    isSubstitute: suplente,
    shirtNumber: i,
    ...over,
  });
  const plantel = (tit: number, sup: number) => [
    ...Array.from({ length: tit }, (_, i) => miembro(i + 1)),
    ...Array.from({ length: sup }, (_, i) => miembro(tit + i + 1, true)),
  ];

  test('plantel completo (11 + 2) crea equipo y una inscripción por integrante, de forma atómica', async () => {
    const { masculina } = await catalogo();
    const s = (await as('DELEGADO')).api;
    const r = await s.post('/inscriptions/team', {
      disciplineId: masculina.disciplineId,
      categoryId: masculina.id,
      teamName: uniq('Club'),
      locality: 'Formosa',
      department: DEPTO,
      members: plantel(11, 2),
    });
    const d = await data(r, 201);
    expect(JSON.stringify(d)).toContain('EVITA-');
    const equipoId = d.team?.id ?? d.teamId;
    expect(equipoId).toBeTruthy();
    const det = await data(await s.get(`/teams/${equipoId}`));
    expect((det.members ?? det.teamMembers).length).toBe(13);
  });

  test('menos titulares de los exigidos, o demasiados suplentes → 400 y no deja datos a medias', async () => {
    const { masculina } = await catalogo();
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const nombre = uniq('Club');
    const pocos = plantel(5, 0);
    const r1 = await s.post('/inscriptions/team', { disciplineId: masculina.disciplineId, categoryId: masculina.id, teamName: nombre, locality: 'Formosa', department: DEPTO, members: pocos });
    expect(r1.status()).toBe(400);
    const r2 = await s.post('/inscriptions/team', { disciplineId: masculina.disciplineId, categoryId: masculina.id, teamName: nombre, locality: 'Formosa', department: DEPTO, members: plantel(11, 9) });
    expect(r2.status()).toBe(400);
    const equipos = await data(await s.get(`/teams?limit=100&search=${nombre}`));
    expect(JSON.stringify(equipos)).not.toContain(nombre);
    const dniLibre = await s.get(`/participants/dni/${pocos[0].dni}`);
    expect(dniLibre.status(), 'el rollback debe dejar libres los DNI del plantel fallido').toBe(404);
  });

  test('integrante que no corresponde a la categoría (edad/sexo) invalida todo el plantel → 400', async () => {
    const { masculina } = await catalogo();
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const p = plantel(11, 0);
    p[3] = miembro(4, false, { sex: 'FEMENINO' });
    const r = await s.post('/inscriptions/team', { disciplineId: masculina.disciplineId, categoryId: masculina.id, teamName: uniq('Club'), locality: 'Formosa', department: DEPTO, members: p });
    expect(r.status()).toBe(400);
  });

  test('DNI repetido dentro del mismo plantel → 400/409', async () => {
    const { masculina } = await catalogo();
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const p = plantel(11, 0);
    p[1].dni = p[0].dni;
    const r = await s.post('/inscriptions/team', { disciplineId: masculina.disciplineId, categoryId: masculina.id, teamName: uniq('Club'), locality: 'Formosa', department: DEPTO, members: p });
    expect([400, 409]).toContain(r.status());
  });

  test('categoría que no pertenece a la disciplina → 400', async () => {
    const { masculina, individual } = await catalogo();
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const r = await s.post('/inscriptions/team', { disciplineId: individual.disciplineId, categoryId: masculina.id, teamName: uniq('Club'), locality: 'Formosa', department: DEPTO, members: plantel(11, 0) });
    expect(r.status()).toBe(400);
  });

  test('equipos: CRUD, alta/baja de miembros y permisos', async () => {
    const { masculina } = await catalogo();
    const s = (await as('ADMIN_PROVINCIAL')).api;
    const t = await data(await s.post('/teams', { name: uniq('Eq'), categoryId: masculina.id, locality: 'Formosa', department: DEPTO }), 201);
    const p = await data(await s.post('/participants', persona({ birthDate: '2012-05-05' })), 201);
    expect((await s.post(`/teams/${t.id}/members`, { participantId: p.id, isCaptain: true })).status()).toBeLessThan(300);
    expect((await s.post(`/teams/${t.id}/members`, { participantId: p.id })).status(), 'miembro repetido').toBe(409);
    expect((await s.del(`/teams/${t.id}/members/${p.id}`)).status()).toBeLessThan(300);
    expect((await (await as('COORDINADOR')).api.patch(`/teams/${t.id}`, { name: 'x' })).status()).toBe(403);
    expect((await s.patch(`/teams/${t.id}`, { name: uniq('Eq2') })).status()).toBe(200);
    expect((await s.del(`/teams/${t.id}`)).status()).toBeLessThan(300);
    expect((await s.get(`/teams/${t.id}`)).status()).toBe(404);
  });
});
