// ===========================================
// Stats DTOs (respuesta de GET /stats/localities)
// ===========================================
import { ApiProperty } from '@nestjs/swagger';

/**
 * Igual que los DTOs del dashboard, estos no validan entrada: existen para que
 * Swagger publique la forma exacta del payload que consume el mapa de calor.
 *
 * ⚠️ Es un endpoint **público**. Todo lo que se agregue acá tiene que ser un
 * conteo agregado: ni nombres, ni DNI, ni ids de participantes o equipos. Con
 * localidades chicas un id alcanza para reidentificar a un menor.
 */

/** Podios de la localidad: resultados con `ranking` 1, 2 y 3. */
export class LocalityPodiumsDto {
  @ApiProperty({ example: 4, description: 'Resultados con ranking = 1' })
  first: number;

  @ApiProperty({ example: 2, description: 'Resultados con ranking = 2' })
  second: number;

  @ApiProperty({ example: 5, description: 'Resultados con ranking = 3' })
  third: number;
}

/** Resumen de participación de una localidad. */
export class LocalityStatsDto {
  @ApiProperty({
    example: 'Clorinda',
    description:
      'Nombre de la localidad tal como está cargado en Participant.locality / Team.locality, sin espacios sobrantes. ' +
      'Las variantes que sólo difieren en mayúsculas, espacios o tildes se agrupan en una sola entrada y se devuelve la grafía más usada. ' +
      'No se empareja contra el catálogo ni contra el mapa: eso lo hace el frontend.',
  })
  locality: string;

  @ApiProperty({
    example: 'Pilcomayo',
    description:
      'Departamento de la localidad: el más frecuente entre las filas que aportan a sus conteos.',
  })
  department: string;

  @ApiProperty({
    example: 128,
    description:
      'Participantes distintos con al menos una inscripción no RECHAZADA, atribuidos por Participant.locality. ' +
      'Un integrante de equipo cuenta en su propia localidad, no en la del equipo.',
  })
  athletes: number;

  @ApiProperty({
    example: 17,
    description:
      'Delegaciones de la localidad en el torneo: cada equipo activo con al menos una inscripción no RECHAZADA (por Team.locality) ' +
      'más cada categoría (disciplina + edad + sexo) con inscripciones individuales no RECHAZADAS (por Participant.locality).',
  })
  delegations: number;

  @ApiProperty({
    example: 9,
    description:
      'Disciplinas distintas en las que la localidad tiene participación (inscripciones de sus atletas o equipos inscriptos).',
  })
  disciplines: number;

  @ApiProperty({
    example: 14,
    description: 'Categorías distintas, con el mismo criterio que disciplines.',
  })
  categories: number;

  @ApiProperty({
    type: LocalityPodiumsDto,
    description:
      'Resultados en podio, atribuidos por participant.locality (individuales) o team.locality (equipos).',
  })
  podiums: LocalityPodiumsDto;

  @ApiProperty({
    example: 6,
    description:
      'Resultados con isWinner = true, con la misma atribución que podiums.',
  })
  wins: number;
}

/** Payload completo de `GET /stats/localities`. */
export class LocalitiesStatsDto {
  @ApiProperty({
    format: 'date-time',
    description:
      'Momento en que se calcularon los datos. Con el cache de 60s puede estar hasta un minuto atrasado.',
  })
  generatedAt: string;

  @ApiProperty({
    type: [LocalityStatsDto],
    description:
      'Una entrada por localidad con al menos un conteo distinto de cero, ordenadas por nombre. Las localidades sin participación no aparecen.',
  })
  localities: LocalityStatsDto[];
}
