#!/bin/sh
# Arranque del backend en Docker (uso local).
#   1. Aplica las migraciones pendientes (no borra datos).
#   2. Si la base está vacía (primer arranque), carga los datos de prueba.
#   3. Levanta la API.
#
# La seed NO corre en cada arranque: borra y recrea los eventos del calendario
# y los partidos de prueba, así que repetirla pisaría lo cargado a mano.
# Para recargarla a pedido, desde backend/ en la PC:
#   npm run db:demo              (recarga los datos de prueba)
#   npm run db:demo:reset        (vacía la base y la recarga desde cero)
set -e

echo "[pgd-evita] Aplicando migraciones..."
./node_modules/.bin/prisma migrate deploy

USUARIOS=$(node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect()
  .then(() => c.query('SELECT count(*)::int AS n FROM users'))
  .then((r) => { console.log(r.rows[0].n); return c.end(); })
  .catch(() => { console.log(-1); process.exit(0); });
")

if [ "$USUARIOS" = "0" ] && [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[pgd-evita] Base vacía: cargando datos de prueba (seed)..."
  node dist/prisma/seed.js
else
  echo "[pgd-evita] La base ya tiene datos: se omite la seed."
fi

echo "[pgd-evita] Iniciando API en el puerto ${PORT:-3000}..."
exec node dist/main.js
