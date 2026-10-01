#!/bin/sh
# Achica node_modules de producción para la imagen local (Dockerfile.local).
# Sólo borra lo que el contenedor nunca carga: la API, `prisma migrate deploy`
# y la seed compilada siguen funcionando (verificado al armar la imagen).
# Prisma Studio NO corre en el contenedor: se abre desde la PC con
# `npm run db:studio:docker`.
set -eu
cd "${1:-/app/node_modules}"

# Dependencias del CLI de prisma que sólo usan `prisma studio` / `prisma dev`
# (el CLI las pide con require diferido) y `typescript`, peer opcional que
# npm instala igual: la config (prisma.config.ts) la carga jiti, no tsc.
rm -rf @electric-sql typescript react react-dom chart.js @radix-ui @types \
       @prisma/studio-core/dist/ui @prisma/studio-core/dist/metafile-*.json

# Motores de otras bases: el proyecto usa sólo PostgreSQL. El cliente generado
# (.prisma/client) trae su propia copia del query compiler.
find @prisma/client/runtime prisma/build \
  \( -name '*mysql*' -o -name '*sqlite*' -o -name '*sqlserver*' -o -name '*cockroachdb*' \) \
  -type f -delete
rm -f @prisma/client/runtime/query_compiler_*

# Fuentes TypeScript, tipos y source maps: en runtime no se cargan.
find . -type f \( -name '*.map' -o -name '*.ts' -o -name '*.mts' -o -name '*.cts' \) -delete
rm -rf effect/src exceljs/dist

# Documentación suelta de los paquetes.
find . -type f \( -iname 'README*' -o -iname 'CHANGELOG*' -o -iname 'HISTORY*' \) -delete
