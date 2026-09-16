-- S20 — encuesta psicologica anonima a los deportistas.
--
-- El cuestionario vive en la base, no en el codigo: `survey_campaigns` /
-- `survey_questions` / `survey_options` son el CMS que usa la psicologa para
-- reescribir las preguntas entre etapa y etapa sin esperar un deploy.
--
-- `survey_options.valor` es el slug con el que se agregan las metricas y por eso
-- es UNIQUE dentro de la pregunta: el `texto` se puede reescribir todas las
-- veces que haga falta sin partir la serie historica, el `valor` no.
--
-- ⚠️ `survey_responses` NO tiene `participant_id`, `user_id`, `ip` ni
-- `user_agent`, y no es un olvido. Responden menores de edad sobre su salud
-- mental: una fila identificable seria un dato sensible con nombre y apellido, y
-- ademas destruiria la utilidad del instrumento (el chico que sospecha que lo
-- pueden leer contesta lo que queda bien). El analisis entre etapas se hace por
-- conteos agregados, nunca siguiendo individuos. Si alguien propone agregar una
-- de esas columnas "para deduplicar", la respuesta esta en el comentario del
-- modelo en `schema.prisma`: sin identidad no hay deduplicacion posible, y el
-- unico freno al duplicado es el rate limit del endpoint publico.
--
-- Los cortes que si se guardan (disciplina, localidad, categoria, sexo) son
-- gruesos a proposito, y el endpoint de metricas suprime cualquier corte con
-- menos de `UMBRAL_K_ANONIMATO` respuestas (ver `survey.constants.ts`): cruzando
-- los cuatro en una muestra chica se llega a una sola persona.
--
-- ⚠️ PENDIENTE DE APLICAR. Generada con `prisma migrate diff --from-schema ...
-- --to-schema ... --script` (sin base: no habia Postgres levantado al momento de
-- escribirla), siguiendo el mismo procedimiento que
-- `20260825120000_add_zone_departments` y
-- `20260831140000_add_external_news_and_sync_state`. Antes de darla por buena
-- hay que correr `npm run db:migrate:deploy` contra el Postgres de
-- docker-compose.dev.yml y verificar con `npx prisma migrate status`.

-- CreateEnum
CREATE TYPE "SurveyWindow" AS ENUM ('PRE', 'DURANTE', 'POST');

-- CreateEnum
CREATE TYPE "SurveyCampaignStatus" AS ENUM ('BORRADOR', 'ACTIVA', 'CERRADA');

-- CreateEnum
CREATE TYPE "SurveyQuestionKind" AS ENUM ('UNICA', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "SurveyAudience" AS ENUM ('TODOS', 'INDIVIDUAL', 'EQUIPO');

-- CreateTable
CREATE TABLE "survey_campaigns" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "anio" INTEGER NOT NULL,
    "status" "SurveyCampaignStatus" NOT NULL DEFAULT 'BORRADOR',
    "ventana" "SurveyWindow" NOT NULL,
    "etapa" "CompetitionStage",
    "abre_en" TIMESTAMP(3),
    "cierra_en" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_questions" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "ayuda" TEXT,
    "kind" "SurveyQuestionKind" NOT NULL DEFAULT 'UNICA',
    "audiencia" "SurveyAudience" NOT NULL DEFAULT 'TODOS',
    "obligatoria" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "ventana" "SurveyWindow" NOT NULL,
    "etapa" "CompetitionStage" NOT NULL,
    "discipline_id" UUID,
    "discipline_type" "DisciplineType" NOT NULL,
    "locality_id" UUID,
    "category_id" UUID,
    "sexo" "Sex",
    "enviada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_answers" (
    "id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,

    CONSTRAINT "survey_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "survey_campaigns_status_ventana_etapa_idx" ON "survey_campaigns"("status", "ventana", "etapa");

-- CreateIndex
CREATE INDEX "survey_campaigns_anio_idx" ON "survey_campaigns"("anio");

-- CreateIndex
CREATE INDEX "survey_questions_campaign_id_orden_idx" ON "survey_questions"("campaign_id", "orden");

-- CreateIndex
CREATE INDEX "survey_options_question_id_orden_idx" ON "survey_options"("question_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "survey_options_question_id_valor_key" ON "survey_options"("question_id", "valor");

-- CreateIndex
CREATE INDEX "survey_responses_campaign_id_etapa_ventana_idx" ON "survey_responses"("campaign_id", "etapa", "ventana");

-- CreateIndex
CREATE INDEX "survey_responses_campaign_id_discipline_id_idx" ON "survey_responses"("campaign_id", "discipline_id");

-- CreateIndex
CREATE INDEX "survey_responses_campaign_id_locality_id_idx" ON "survey_responses"("campaign_id", "locality_id");

-- CreateIndex
CREATE INDEX "survey_responses_campaign_id_discipline_type_idx" ON "survey_responses"("campaign_id", "discipline_type");

-- CreateIndex
CREATE INDEX "survey_answers_question_id_option_id_idx" ON "survey_answers"("question_id", "option_id");

-- CreateIndex
CREATE INDEX "survey_answers_response_id_idx" ON "survey_answers"("response_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_answers_response_id_option_id_key" ON "survey_answers"("response_id", "option_id");

-- AddForeignKey
ALTER TABLE "survey_campaigns" ADD CONSTRAINT "survey_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "survey_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_options" ADD CONSTRAINT "survey_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "survey_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_locality_id_fkey" FOREIGN KEY ("locality_id") REFERENCES "localities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "survey_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "survey_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

