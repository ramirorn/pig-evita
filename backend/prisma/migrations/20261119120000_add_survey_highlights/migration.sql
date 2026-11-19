-- Destacados del panel de Métricas ("Lo que más necesitan los deportistas es:").
--
-- Tabla nueva y aditiva: no toca ninguna fila existente. Mismo criterio que
-- survey_kpis: la definición es JSON que matchea opciones por su `valor`, y
-- `campaign_id` NULL = destacado reutilizable para cualquier campaña.
CREATE TABLE "survey_highlights" (
  "id"          UUID NOT NULL,
  "campaign_id" UUID,
  "titulo"      TEXT NOT NULL,
  "descripcion" TEXT,
  "orden"       INTEGER NOT NULL DEFAULT 0,
  "activo"      BOOLEAN NOT NULL DEFAULT true,
  "definicion"  JSONB NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "survey_highlights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "survey_highlights_campaign_id_activo_orden_idx"
  ON "survey_highlights"("campaign_id", "activo", "orden");

ALTER TABLE "survey_highlights"
  ADD CONSTRAINT "survey_highlights_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "survey_campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
