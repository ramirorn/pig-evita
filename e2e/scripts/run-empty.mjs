// Corre las pruebas de primer arranque (base vacía) contra el stack ya levantado con `npm run stack:empty`.
import { spawnSync } from 'node:child_process';
const r = spawnSync('npx', ['playwright', 'test'], { stdio: 'inherit', shell: true, env: { ...process.env, E2E_EMPTY: '1' } });
process.exit(r.status ?? 1);
