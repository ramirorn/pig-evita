// ===========================================
// Corre todos los `check:*` de package.json
// ===========================================
//
// La lista sale del propio package.json: un check nuevo entra solo, sin tocar
// el CI. Corre todos aunque alguno falle, para ver el panorama completo en una
// sola pasada, y termina con código 1 si falló al menos uno.
//
// Corre con: npm run check:all
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const { scripts } = JSON.parse(readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));

const checks = Object.keys(scripts).filter(
  (nombre) => nombre.startsWith('check:') && nombre !== 'check:all',
);

const fallidos = [];
for (const check of checks) {
  console.log(`\n▶ npm run ${check}`);
  const { status } = spawnSync('npm', ['run', '--silent', check], {
    cwd: RAIZ,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (status !== 0) fallidos.push(check);
}

console.log(`\n${checks.length - fallidos.length}/${checks.length} checks OK`);
if (fallidos.length > 0) {
  console.error(`Fallaron: ${fallidos.join(', ')}`);
  process.exit(1);
}
