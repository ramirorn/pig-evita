-- S19 — noticias externas del portal oficial + cursor del sincronizador.
--
-- `news.source_url` guarda el link al original y es UNIQUE a proposito: es la
-- clave de idempotencia del sync, que hace UPSERT por esta columna. Sin el
-- unique, dos corridas seguidas duplicarian cada nota.
--
-- `news.is_external` marca las que enlazan afuera. No se editan ni se
-- despublican como propias (`news.service.ts` lo rechaza): son un reflejo de lo
-- que hay en formosa.gob.ar, no contenido de esta plataforma. Las filas que ya
-- existen quedan en `false`, que es lo correcto: son noticias propias.
--
-- `sync_state` es el cursor del recorrido de IDs. Existe porque el
-- descubrimiento tiene tope por corrida: sin cursor persistido, una corrida que
-- se queda sin presupuesto vuelve a arrancar en el mismo lugar y no avanza
-- nunca. `last_found_at` es lo que permite gritar cuando el sync lleva semanas
-- terminando "en verde" sin traer una sola nota.
--
-- ✅ APLICADA el 2026-08-31 con `prisma migrate deploy` contra el Postgres de
-- docker-compose.dev.yml. Se generó con `prisma migrate diff --script` sin base
-- —Docker estaba caído en ese momento—, así que la aplicación fue posterior;
-- `prisma migrate status` reporta el esquema al día y las tres columnas más la
-- tabla `sync_state` están verificadas en la base.

-- AlterTable
ALTER TABLE "news" ADD COLUMN     "is_external" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source_name" TEXT,
ADD COLUMN     "source_url" TEXT;

-- CreateTable
CREATE TABLE "sync_state" (
    "key" TEXT NOT NULL,
    "last_scanned_id" INTEGER NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "last_found_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_source_url_key" ON "news"("source_url");

-- CreateIndex
CREATE INDEX "news_is_external_idx" ON "news"("is_external");
