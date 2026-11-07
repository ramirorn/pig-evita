// Recrea el stack aislado con la base VACÍA (SEED_ON_START=false). Borra sólo los volúmenes de `evita-e2e`.
import { spawnSync } from 'node:child_process';
const base = ['compose', '-p', 'evita-e2e', '-f', 'docker-compose.e2e.yml', '--env-file', '.env.e2e'];
const run = (args, env = {}) => {
  const r = spawnSync('docker', [...base, ...args], { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(['down', '-v', '--remove-orphans']);
run(['up', '-d', '--wait'], { SEED_ON_START: 'false' });
console.log('Stack aislado levantado con base vacía.');
