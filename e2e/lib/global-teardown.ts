import { Api, ROLES, newCtx, roleEmail, data } from './api';
import { ADMIN_EMAIL, PASSWORD } from './env';

/**
 * Limpieza best-effort dentro del stack aislado: cierra campañas de encuesta activas y da de baja los usuarios
 * que crearon las pruebas (se conservan los de rol). El resto de los datos de prueba lleva prefijos únicos por
 * corrida y se descarta con `npm run stack:down` (que borra los volúmenes de `evita-e2e`).
 */
export default async function globalTeardown() {
  const ctx = await newCtx();
  const api = new Api(ctx);
  try {
    const d = await data(await api.post('/auth/login', { email: ADMIN_EMAIL, password: PASSWORD }));
    api.token = d.accessToken;
    const activas = await data(await api.get('/survey/campaigns?status=ACTIVA&limit=100'));
    for (const c of activas) await api.post(`/survey/campaigns/${c.id}/close`);
    const fijos = new Set<string>(ROLES.map((r) => roleEmail(r)));
    const usuarios = await data(await api.get('/users?limit=100'));
    for (const u of usuarios) if (!fijos.has(u.email) && /@evita-e2e\.test$/.test(u.email)) await api.del(`/users/${u.id}`);
  } catch (e) {
    console.warn('teardown (best-effort):', (e as Error).message);
  } finally {
    await ctx.dispose();
  }
}
