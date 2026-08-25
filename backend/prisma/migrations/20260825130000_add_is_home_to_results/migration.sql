-- R23 — localía explícita en los resultados.
--
-- La pantalla del fixture tomaba `results[0]` como local y `results[1]` como
-- visitante, pero el modelo no tenía ningún campo que distinguiera localía y la
-- consulta no llevaba `ORDER BY`. Postgres no garantiza orden sin él, así que
-- el mismo partido podía leerse "San Martín 3 : 1 Belgrano" en un refetch y al
-- revés en el siguiente.
--
-- Nullable a propósito: en las disciplinas individuales un partido tiene N
-- resultados y la localía no significa nada. NULL es "no aplica", y las filas
-- que ya existen quedan así — es lo correcto, porque de ellas no se puede
-- deducir quién era local.
--
-- Generado con `prisma migrate diff` sin base (Docker estaba caido), y
-- APLICADO Y VERIFICADO despues con `prisma migrate deploy` contra el Postgres
-- de docker-compose.dev.yml el 2026-08-25.

-- AlterTable
ALTER TABLE "results" ADD COLUMN     "is_home" BOOLEAN;
