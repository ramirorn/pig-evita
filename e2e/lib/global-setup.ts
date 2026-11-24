import { Api, DEPTO, ROLES, ZONA, newCtx, roleEmail, data } from './api';
import { ADMIN_EMAIL, PASSWORD } from './env';

/** Crea (si faltan) un usuario por rol en el stack aislado y define la zona de prueba. */
export default async function globalSetup() {
  const ctx = await newCtx();
  const admin = new Api(ctx);
  const d = await data(await admin.post('/auth/login', { email: ADMIN_EMAIL, password: PASSWORD }));
  admin.token = d.accessToken;
  for (const role of ROLES) {
    if (role === 'SUPER_ADMIN') continue;
    const r = await admin.post('/users', {
      email: roleEmail(role),
      password: PASSWORD,
      firstName: 'E2E',
      lastName: role,
      role,
      department: ['ADMIN_DEPARTAMENTAL', 'DELEGADO', 'COORDINADOR'].includes(role) ? DEPTO : undefined,
      zone: role === 'ADMIN_ZONAL' ? ZONA : undefined,
    });
    if (![201, 409].includes(r.status())) throw new Error(`no se pudo crear ${role}: ${r.status()} ${await r.text()}`);
  }
  const z = await admin.put(`/zones/${encodeURIComponent(ZONA)}`, { departments: [DEPTO] });
  if (!z.ok()) throw new Error(`zona: ${z.status()} ${await z.text()}`);
  await ctx.dispose();
}
