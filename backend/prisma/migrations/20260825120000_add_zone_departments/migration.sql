-- R05 — mapeo zona -> departamentos.
--
-- `User.zone` existia pero ni `Participant` ni `Team` tienen columna de zona:
-- esta tabla es la traduccion que faltaba. Arranca vacia (ver prisma/seed.ts):
-- con la regla de fallar cerrado, un ADMIN_ZONAL no ve nada hasta que se cargue
-- el mapeo real de Formosa.
--
-- ATENCION: este SQL se genero con `prisma migrate diff` SIN base de datos
-- (Docker caido al momento de escribirlo). No se aplico ni se valido contra un
-- Postgres real: falta correr `prisma migrate deploy` / `migrate dev` cuando la
-- base vuelva a estar disponible.

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
