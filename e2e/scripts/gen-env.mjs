// Genera e2e/.env.e2e con secretos al azar (solo del stack aislado). No pisa uno existente.
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const file = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.e2e');
if (existsSync(file)) { console.log('.env.e2e ya existe: se conserva'); process.exit(0); }
const r = (n = 24) => randomBytes(n).toString('base64url');
writeFileSync(file, [
  `DB_PASSWORD=${r()}`, `JWT_ACCESS_SECRET=${r(48)}`, `JWT_REFRESH_SECRET=${r(48)}`,
  `MINIO_ACCESS_KEY=e2e${r(8)}`, `MINIO_SECRET_KEY=${r(24)}`,
  `SEED_ADMIN_EMAIL=e2e.admin@evita-e2e.test`, `SEED_ADMIN_PASSWORD=Aa1!${r(12)}`,
  `SEED_ON_START=true`, '',
].join('\n'));
console.log('.env.e2e generado');
