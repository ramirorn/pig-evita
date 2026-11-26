// ===========================================
// Campaña con su cuestionario, para métricas
// ===========================================
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import type { OpcionCatalogo, PreguntaCatalogo } from './metrics.types';

export const QUESTIONNAIRE_SELECT = {
  id: true,
  titulo: true,
  anio: true,
  status: true,
  ventana: true,
  questions: {
    orderBy: { orden: 'asc' as const },
    select: {
      id: true,
      orden: true,
      texto: true,
      kind: true,
      audiencia: true,
      activa: true,
      options: {
        orderBy: { orden: 'asc' as const },
        select: { id: true, valor: true, texto: true, orden: true },
      },
    },
  },
} satisfies Prisma.SurveyCampaignSelect;

export type CampaignWithQuestionnaire = Prisma.SurveyCampaignGetPayload<{
  select: typeof QUESTIONNAIRE_SELECT;
}>;

type Question = CampaignWithQuestionnaire['questions'][number];
type Option = Question['options'][number];

const CAMPAIGN_NOT_FOUND = 'Campaña de encuesta no encontrada';

export async function findCampaignWithQuestionnaire(
  prisma: PrismaService,
  id: string,
): Promise<CampaignWithQuestionnaire> {
  const campaign = await prisma.surveyCampaign.findUnique({
    where: { id },
    select: QUESTIONNAIRE_SELECT,
  });
  if (!campaign) throw new NotFoundException(CAMPAIGN_NOT_FOUND);
  return campaign;
}

/**
 * Sólo comprueba que exista. Los ABM de KPIs y destacados no necesitan el
 * cuestionario: antes lo traían entero para esto.
 */
export async function assertCampaignExists(
  prisma: PrismaService,
  id: string,
): Promise<void> {
  const campaign = await prisma.surveyCampaign.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!campaign) throw new NotFoundException(CAMPAIGN_NOT_FOUND);
}

export function toOptionCatalog(o: Option): OpcionCatalogo {
  return { optionId: o.id, valor: o.valor, texto: o.texto, orden: o.orden };
}

export function toQuestionCatalog(q: Question): PreguntaCatalogo {
  return {
    questionId: q.id,
    orden: q.orden,
    texto: q.texto,
    kind: q.kind,
    audiencia: q.audiencia,
    activa: q.activa,
    opciones: q.options.map(toOptionCatalog),
  };
}
