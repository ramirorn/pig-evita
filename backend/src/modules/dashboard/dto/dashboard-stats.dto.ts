// ===========================================
// Dashboard DTOs (respuesta de GET /dashboard/stats)
// ===========================================
import { ApiProperty } from '@nestjs/swagger';
import { InscriptionStatus, Sex } from '@prisma/client';

/**
 * Estos DTOs no validan entrada: existen para que Swagger publique la **forma
 * exacta** del payload. El dashboard es el único consumidor hoy, pero es un
 * contrato entre dos equipos (BE/FE) y sin schema el frontend termina
 * adivinando qué campos vienen y cuáles pueden faltar.
 */

/** Un estado de inscripción y su cantidad. */
export class InscriptionStatusCountDto {
  @ApiProperty({
    enum: InscriptionStatus,
    example: InscriptionStatus.PENDIENTE,
  })
  status: InscriptionStatus;

  @ApiProperty({ example: 128, description: 'Cantidad de inscripciones' })
  count: number;
}

/** Participantes agrupados por sexo. */
export class DemographicsCountDto {
  @ApiProperty({ enum: Sex, example: Sex.MASCULINO })
  sex: Sex;

  @ApiProperty({ example: 540 })
  count: number;
}

/** Participante mostrado en el listado de últimas inscripciones. */
export class RecentInscriptionParticipantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Juan' })
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  lastName: string;
}

/** Categoría mostrada en el listado de últimas inscripciones. */
export class RecentInscriptionCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Sub-14 Masculino' })
  name: string;
}

/**
 * Fila del listado de últimas inscripciones.
 *
 * Deliberadamente **no** trae `notes`, `rejectionNote`, DNI ni datos de
 * contacto: es un widget de resumen, y el detalle ya tiene su endpoint.
 */
export class RecentInscriptionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'EVITA-00000042' })
  qrCode: string;

  @ApiProperty({ enum: InscriptionStatus })
  status: InscriptionStatus;

  @ApiProperty({
    format: 'date-time',
    example: '2026-08-19T14:03:11.482Z',
    description: 'ISO 8601 en UTC',
  })
  createdAt: string;

  @ApiProperty({ type: RecentInscriptionParticipantDto })
  participant: RecentInscriptionParticipantDto;

  @ApiProperty({ type: RecentInscriptionCategoryDto })
  category: RecentInscriptionCategoryDto;
}

/** Payload completo de `GET /dashboard/stats`. */
export class DashboardStatsDto {
  @ApiProperty({ example: 1240 })
  totalParticipants: number;

  @ApiProperty({ example: 87 })
  totalTeams: number;

  @ApiProperty({ example: 1502 })
  totalInscriptions: number;

  @ApiProperty({ example: 14 })
  totalCompetitions: number;

  @ApiProperty({
    type: [InscriptionStatusCountDto],
    description:
      'Siempre los 4 estados, en orden fijo (PENDIENTE, REVISADA, APROBADA, RECHAZADA) y con count 0 si no hay filas. El frontend no tiene que completar faltantes.',
  })
  inscriptionsByStatus: InscriptionStatusCountDto[];

  @ApiProperty({
    type: [DemographicsCountDto],
    description:
      'Participantes por sexo. Sólo aparecen los valores con al menos un participante.',
  })
  demographics: DemographicsCountDto[];

  @ApiProperty({
    type: [RecentInscriptionDto],
    description:
      'Las 5 inscripciones más recientes, de la más nueva a la más vieja.',
  })
  recentInscriptions: RecentInscriptionDto[];

  @ApiProperty({
    format: 'date-time',
    description:
      'Momento en que se calcularon los datos. Con cache de 60s puede estar hasta un minuto atrasado respecto del reloj del cliente.',
  })
  lastUpdated: string;
}
