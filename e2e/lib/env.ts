import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '..', '.env.e2e'), 'utf8');
const env: Record<string, string> = {};
for (const l of raw.split('\n')) {
  const i = l.indexOf('=');
  if (i > 0) env[l.slice(0, i)] = l.slice(i + 1);
}

export const BASE = process.env.E2E_BASE ?? 'http://localhost:18081';
export const DIRECT = process.env.E2E_DIRECT ?? 'http://localhost:18080';
export const API = `${BASE}/api/v1`;
export const ADMIN_EMAIL = env.SEED_ADMIN_EMAIL;
/** Una sola contraseña de prueba para todos los usuarios que crea el global-setup. */
export const PASSWORD = env.SEED_ADMIN_PASSWORD;
