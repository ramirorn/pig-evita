-- R05 — mapeo zona -> departamentos.
--
-- `User.zone` existia pero ni `Participant` ni `Team` tienen columna de zona:
-- esta tabla es la traduccion que faltaba. Arranca vacia (ver prisma/seed.ts):
-- con la regla de fallar cerrado, un ADMIN_ZONAL no ve nada hasta que se cargue
-- el mapeo real de Formosa.
--
-- Generado con `prisma migrate diff` sin base (Docker estaba caido), y
-- APLICADO Y VERIFICADO despues con `prisma migrate deploy` contra el Postgres
-- de docker-compose.dev.yml el 2026-08-25.

-- CreateTable
CREATE TABLE "zone_departments" (
    "id" UUID NOT NULL,
    "zone" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zone_departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zone_departments_zone_idx" ON "zone_departments"("zone");

-- CreateIndex
CREATE UNIQUE INDEX "zone_departments_zone_department_key" ON "zone_departments"("zone", "department");
