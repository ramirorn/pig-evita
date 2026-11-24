-- Indicadores compuestos (KPI) de la encuesta.
--
-- Tabla nueva y aditiva: no toca ninguna fila existente. La definición es
-- JSON declarativo que matchea opciones por su `valor` (slug), así un KPI
-- sobrevive a que las preguntas se reescriban en la edición siguiente.
-- `campaign_id` NULL = indicador reutilizable para cualquier campaña.
CREATE TABLE "survey_kpis" (
  "id"          UUID NOT NULL,
  "campaign_id" UUID,
  "nombre"      TEXT NOT NULL,
  "descripcion" TEXT,
  "orden"       INTEGER NOT NULL DEFAULT 0,
  "activo"      BOOLEAN NOT NULL DEFAULT true,
  "definicion"  JSONB NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "survey_kpis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "survey_kpis_campaign_id_activo_orden_idx"
  ON "survey_kpis"("campaign_id", "activo", "orden");

ALTER TABLE "survey_kpis"
  ADD CONSTRAINT "survey_kpis_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "survey_campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
