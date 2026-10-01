#!/usr/bin/env node
// ===========================================
// Juegos Evita — herramientas para el stack Docker local ("pgd-evita")
// ===========================================
// Se corre desde backend/ con npm (ver package.json):
//
//   npm run setup               PC nueva: crea .env (si no existe), construye y
//                               levanta todo, y deja los datos de prueba.
//   npm run db:demo             Recarga los datos de prueba (idempotente).
//   npm run db:demo:reset       Vacía la base y la recarga desde cero.
//                               `npm run db:demo:reset -- --yes` no pregunta.
//   npm run db:studio:docker    Prisma Studio contra la base de Docker.
//
// Sin dependencias: sólo módulos de Node, para que `npm run setup` funcione en
// un clon recién bajado, antes de cualquier `npm install`. Llama al CLI de
// Docker con argumentos (sin shell), así anda igual en Windows, Linux y macOS.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const BACKEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_DIR = resolve(BACKEND_DIR, '..');
const ENV_FILE = join(ROOT_DIR, '.env');
const ENV_EXAMPLE = join(ROOT_DIR, '.env.example');

const DB_USER = 'evita_user';
const DB_NAME = 'juegos_evita';
const DEFAULT_ADMIN_EMAIL = 'admin@juegosevita.gob.ar';
const SEED_JS = 'dist/prisma/seed.js';

// --------------------------------------------------------------- salida ----
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => paint('1', s);
const step = (s) => console.log(`\n${paint('36', '==>')} ${bold(s)}`);
const info = (s) => console.log(`    ${s}`);
const warn = (s) => console.log(`${paint('33', '[!]')} ${s}`);

class Fatal extends Error {}
const fail = (msg) => {
  throw new Fatal(msg);
};

// ------------------------------------------------------- procesos/docker ----
/**
 * Corre un comando y devuelve { status, stdout, stderr }.
 * `capture: false` muestra la salida en vivo (stdio heredado).
 */
function run(cmd, args, { capture = true, cwd = ROOT_DIR } = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) {
    if (r.error.code === 'ENOENT') {
      fail(
        `No se encontró "${cmd}". Instalá Docker Desktop (Windows/macOS) o ` +
          'Docker Engine con el plugin compose (Linux).',
      );
    }
    throw r.error;
  }
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

// cwd = raíz del repo: compose toma docker-compose.yml (y un
// docker-compose.override.yml si existe) y el .env de la raíz.
const compose = (args, opts) => run('docker', ['compose', ...args], opts);

function composeOrFail(args, what, opts = {}) {
  const r = compose(args, { capture: false, ...opts });
  if (r.status !== 0) fail(`Falló: ${what} (docker compose ${args.join(' ')})`);
}

function assertDocker() {
  const r = run('docker', ['info', '--format', '{{.ServerVersion}}']);
  if (r.status !== 0) {
    fail(
      'Docker no está andando. Abrí Docker Desktop (o iniciá el servicio ' +
        '`docker`), esperá a que diga "running" y volvé a correr el comando.',
    );
  }
  const c = run('docker', ['compose', 'version', '--short']);
  if (c.status !== 0) {
    fail('Falta Docker Compose v2 (`docker compose`). Actualizá Docker.');
  }
}

function stackUp({ build = false, services = [] } = {}) {
  const args = ['up', '-d', '--wait', '--wait-timeout', '600'];
  if (build) args.push('--build');
  const r = compose([...args, ...services], { capture: false });
  if (r.status !== 0) {
    warn('El stack no quedó sano. Estado de los contenedores:');
    compose(['ps', '-a'], { capture: false });
    warn('Últimas líneas del backend:');
    compose(['logs', '--tail', '40', 'backend'], { capture: false });
    fail('No se pudo levantar el stack (ver arriba).');
  }
}

/** Puerto publicado en la PC para un servicio (o null). */
function publishedPort(service, port) {
  const r = compose(['port', service, String(port)]);
  const line = r.stdout.trim().split(/\r?\n/)[0] ?? '';
  const m = line.match(/:(\d+)$/);
  return r.status === 0 && m ? m[1] : null;
}

function psql(sql) {
  const r = compose([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    DB_USER,
    '-d',
    DB_NAME,
    '-v',
    'ON_ERROR_STOP=1',
    '-At',
    '-F',
    '\t',
    '-c',
    sql,
  ]);
  if (r.status !== 0) fail(`Error de Postgres:\n${r.stderr.trim()}`);
  return r.stdout.trim();
}

// --------------------------------------------------------------- .env ------
function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    } else {
      v = v.replace(/\s+#.*$/, '');
    }
    out[m[1]] = v;
  }
  return out;
}

function readRootEnv() {
  if (!existsSync(ENV_FILE)) {
    fail(
      `No existe ${ENV_FILE}.\n    Para una PC nueva corré \`npm run setup\` ` +
        '(lo crea con secretos al azar).',
    );
  }
  const env = parseEnv(readFileSync(ENV_FILE, 'utf8'));
  const required = [
    'DB_PASSWORD',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'SEED_ADMIN_PASSWORD',
  ];
  const bad = required.filter((k) => !env[k] || env[k].includes('<GENERAR'));
  if (bad.length) {
    fail(`Faltan valores en ${ENV_FILE}: ${bad.join(', ')}`);
  }
  return env;
}

// Espejo de backend/src/common/security/forbidden-secrets.ts: el backend no
// arranca si un secreto contiene alguno de estos fragmentos.
const FORBIDDEN_SUBSTRINGS = [
  'change-me',
  'changeme',
  'cambiame',
  'minioadmin',
  'admin123',
  'password',
  'contrasena',
  'secret',
  'qwerty',
  '123456',
  'default',
  'ejemplo',
  'example',
];

function randomSecret(bytes, prefix = '') {
  for (;;) {
    const value = prefix + randomBytes(bytes).toString('base64url');
    const lower = value.toLowerCase();
    if (!FORBIDDEN_SUBSTRINGS.some((f) => lower.includes(f))) return value;
  }
}

/** Crea .env desde .env.example con secretos nuevos. Nunca pisa uno existente. */
function createRootEnv() {
  const values = {
    DB_PASSWORD: randomSecret(24),
    JWT_ACCESS_SECRET: randomSecret(64),
    JWT_REFRESH_SECRET: randomSecret(64),
    MINIO_ACCESS_KEY: randomSecret(9, 'evita-'),
    MINIO_SECRET_KEY: randomSecret(32),
    SEED_ADMIN_EMAIL: DEFAULT_ADMIN_EMAIL,
    SEED_ADMIN_PASSWORD: randomSecret(12),
    SEED_ON_START: 'true',
  };
  const template = existsSync(ENV_EXAMPLE)
    ? readFileSync(ENV_EXAMPLE, 'utf8')
    : '';
  const pending = new Set(Object.keys(values));
  const lines = template.split(/\r?\n/).map((line) => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (m && pending.has(m[1])) {
      pending.delete(m[1]);
      return `${m[1]}=${values[m[1]]}`;
    }
    return line;
  });
  for (const k of pending) lines.push(`${k}=${values[k]}`);
  // `wx`: falla si el archivo apareció entre medio; jamás se sobrescribe.
  writeFileSync(ENV_FILE, lines.join('\n').replace(/\n*$/, '\n'), {
    flag: 'wx',
    mode: 0o600,
  });
  return values;
}

// ------------------------------------------------------------- pasos -------
function migrate() {
  step('Aplicando migraciones (prisma migrate deploy)');
  composeOrFail(
    [
      'exec',
      '-T',
      'backend',
      './node_modules/.bin/prisma',
      'migrate',
      'deploy',
    ],
    'migraciones',
  );
}

function seed() {
  step('Cargando los datos de prueba (seed completa)');
  const has = compose(['exec', '-T', 'backend', 'test', '-f', SEED_JS]);
  if (has.status !== 0) {
    fail(
      `La imagen del backend no trae ${SEED_JS} (es anterior a este script).\n` +
        '    Reconstruila con `docker compose up -d --build` en la raíz y repetí.',
    );
  }
  composeOrFail(['exec', '-T', 'backend', 'node', SEED_JS], 'seed');
}

function clearStatsCache() {
  step('Limpiando la caché de estadísticas en Redis');
  const script =
    'n=0; for p in "stats:*" "dashboard:*"; do ' +
    'for k in $(redis-cli --scan --pattern "$p"); do ' +
    'redis-cli DEL "$k" >/dev/null; n=$((n+1)); done; done; echo $n';
  const r = compose(['exec', '-T', 'redis', 'sh', '-c', script]);
  if (r.status !== 0) fail(`No se pudo limpiar Redis:\n${r.stderr.trim()}`);
  info(`Claves borradas: ${r.stdout.trim() || 0}`);
}

function tableCounts() {
  // count(*) exacto de cada tabla en una sola consulta.
  const sql = `
    SELECT table_name,
           (xpath('/row/c/text()', query_to_xml(
             format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
             false, true, '')))[1]::text::int
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`;
  return psql(sql)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => l.split('\t'));
}

function printSummary(env, { showPassword = false } = {}) {
  step('Resumen: registros por tabla');
  const rows = tableCounts();
  const width = Math.max(...rows.map(([t]) => t.length), 5);
  for (const [t, n] of rows) info(`${t.padEnd(width)}  ${n.padStart(6)}`);

  const webPort = publishedPort('frontend', 80) ?? '8080';
  const minioPort = publishedPort('minio', 9001);
  const email = env.SEED_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  step('Cómo entrar');
  info(`Web:         http://localhost:${webPort}`);
  info(`Panel:       http://localhost:${webPort}/login`);
  info(`Usuario:     ${email}`);
  if (showPassword) {
    info(`Contraseña:  ${env.SEED_ADMIN_PASSWORD}`);
    info(
      `             (guardada en ${ENV_FILE}, variable SEED_ADMIN_PASSWORD)`,
    );
  } else {
    info(`Contraseña:  la de SEED_ADMIN_PASSWORD en ${ENV_FILE}`);
  }
  if (minioPort) info(`MinIO:       http://localhost:${minioPort} (consola)`);
  info('Studio:      npm run db:studio:docker   (desde backend/)');
}

async function confirmReset(yes) {
  warn(
    bold(
      'db:demo:reset BORRA TODO el contenido de la base de Docker ' +
        '(DROP SCHEMA public CASCADE): usuarios, inscripciones, noticias, ' +
        'auditoría y todo lo cargado a mano.',
    ),
  );
  info('Los archivos ya subidos a MinIO no se borran (quedan huérfanos).');
  if (yes) {
    info('--yes: se omite la confirmación.');
    return;
  }
  if (!process.stdin.isTTY) {
    fail(
      'Sin terminal interactiva: confirmá con `npm run db:demo:reset -- --yes`.',
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('    Escribí "borrar" para continuar: '))
    .trim()
    .toLowerCase();
  rl.close();
  if (answer !== 'borrar') fail('Cancelado: la base quedó como estaba.');
}

// ------------------------------------------------------------ comandos -----
async function cmdSetup() {
  assertDocker();

  step('Archivo de secretos (.env de la raíz)');
  let created = false;
  if (existsSync(ENV_FILE)) {
    info(`${ENV_FILE} ya existe: no se toca.`);
  } else {
    createRootEnv();
    created = true;
    info(`Creado ${ENV_FILE} con secretos al azar (no se commitea).`);
  }
  const env = readRootEnv();

  step(
    'Construyendo y levantando el stack (puede tardar unos minutos la primera vez)',
  );
  stackUp({ build: true });

  // El primer arranque con la base vacía ya corre la seed antes de que la API
  // quede sana. Si no la corrió (SEED_ON_START=false), se carga acá.
  const users = Number(psql('SELECT count(*) FROM users'));
  if (users === 0) {
    migrate();
    seed();
    clearStatsCache();
  } else {
    step('Datos de prueba');
    info(
      'La base tiene datos (en el primer arranque la seed corre sola). ' +
        'Para recargarlos: npm run db:demo',
    );
  }

  printSummary(env, { showPassword: created });
  console.log(`\n${bold('Listo.')}`);
}

async function cmdDemo({ reset, yes }) {
  assertDocker();
  const env = readRootEnv();

  step('Levantando el stack si hace falta');
  stackUp();

  if (reset) {
    await confirmReset(yes);
    step('Vaciando la base (DROP SCHEMA public CASCADE)');
    psql('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    info('Base vacía.');
  }

  migrate();
  seed();
  clearStatsCache();
  printSummary(env);
  if (reset) warn('La base se reseteó: quedó sólo con los datos de prueba.');
  console.log(`\n${bold('Listo.')}`);
}

async function cmdStudio(extraArgs) {
  assertDocker();
  const env = readRootEnv();

  const cli = join(BACKEND_DIR, 'node_modules', 'prisma', 'build', 'index.js');
  if (!existsSync(cli)) {
    fail('Prisma Studio corre en tu PC: primero `npm install` en backend/.');
  }

  step('Levantando Postgres si hace falta');
  stackUp({ services: ['postgres'] });
  const port = publishedPort('postgres', 5432);
  if (!port)
    fail('Postgres no publica un puerto en la PC (revisá docker-compose.yml).');

  const url =
    `postgresql://${DB_USER}:${encodeURIComponent(env.DB_PASSWORD)}` +
    `@127.0.0.1:${port}/${DB_NAME}?schema=public`;
  step(
    `Prisma Studio → base de Docker (127.0.0.1:${port}). Ctrl+C para salir.`,
  );
  // DATABASE_URL va por el entorno del proceso: prisma.config.ts carga
  // backend/.env con dotenv, que no pisa variables ya definidas.
  const child = spawn(process.execPath, [cli, 'studio', ...extraArgs], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
    windowsHide: true,
  });
  const forward = (sig) => () => child.kill(sig);
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));
  child.on('exit', (code, signal) => process.exit(signal ? 0 : (code ?? 0)));
}

// ---------------------------------------------------------------- main -----
const USAGE = `Uso: node scripts/docker-dev.mjs <comando>
  setup                 PC nueva: .env + build + stack + datos de prueba
  demo [--reset] [--yes]  recarga los datos de prueba (--reset vacía la base antes)
  studio [args]         Prisma Studio contra la base de Docker`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = new Set(rest);
  switch (command) {
    case 'setup':
      return cmdSetup();
    case 'demo':
      return cmdDemo({
        reset: flags.has('--reset'),
        yes: flags.has('--yes') || flags.has('-y'),
      });
    case 'studio':
      return cmdStudio(rest);
    default:
      console.log(USAGE);
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((e) => {
  if (e instanceof Fatal) {
    console.error(`\n${paint('31', '[x]')} ${e.message}`);
  } else {
    console.error(e);
  }
  process.exit(1);
});
