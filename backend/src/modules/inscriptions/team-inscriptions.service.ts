// ===========================================
// S21 — Inscripción de planteles completos
// ===========================================
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  DisciplineType,
  InscriptionStatus,
  Participant,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { Alcance, ScopeService } from '../../common/scope';
import {
  CreateTeamInscriptionDto,
  CreateTeamMemberInscriptionDto,
  TeamInscriptionResultDto,
} from './dto';
import { InscriptionQrService } from './inscription-qr.service';
import { memberEligibilityError } from './inscription-eligibility';
import {
  rosterConsistencyError,
  rosterSizeError,
  splitRoster,
} from './roster-rules';

type TxClient = Prisma.TransactionClient;
type Member = CreateTeamMemberInscriptionDto;

/** Datos de contacto que una carga de plantel puede actualizar (ver `contactChanges`). */
const CONTACT_FIELDS = ['phone', 'email', 'address', 'locality'] as const;

const DISCIPLINE_FOR_ROSTER = {
  id: true,
  name: true,
  type: true,
  isActive: true,
  titulares: true,
  maxSuplentes: true,
} satisfies Prisma.DisciplineSelect;

const CATEGORY_FOR_ROSTER = {
  id: true,
  name: true,
  ageCriterion: true,
  minAge: true,
  maxAge: true,
  minBirthYear: true,
  maxBirthYear: true,
  sex: true,
  isActive: true,
  disciplineId: true,
} satisfies Prisma.CategorySelect;

type RosterCategory = Prisma.CategoryGetPayload<{
  select: typeof CATEGORY_FOR_ROSTER;
}>;

/** Disciplina con el plantel ya verificado como configurado. */
type RosterDiscipline = Prisma.DisciplineGetPayload<{
  select: typeof DISCIPLINE_FOR_ROSTER;
}> & { titulares: number; maxSuplentes: number };

interface RosterCatalog {
  discipline: RosterDiscipline;
  category: RosterCategory;
}

/**
 * Un DNI del plantel ya existe fuera del alcance de quien carga (S04). Se lanza
 * adentro de la transacción para que haga rollback, y afuera se traduce al 409
 * que nombra el DNI: adentro no se puede consultar cuál era, porque Postgres
 * deja la transacción abortada después de la violación de la unique.
 */
class DniOutsideScopeError extends Error {
  constructor(readonly dnis: string[]) {
    super('DNI existente fuera del alcance');
  }
}

/**
 * Alta de un plantel entero: un `Team`, sus `TeamMember` y una `Inscription`
 * por integrante, todo o nada (mismo motivo que R13: un plantel a medias es un
 * estado parcial que nadie detecta y que el reintento no corrige).
 *
 * El encargado elige disciplina y categoría primero; la disciplina dice cuántos
 * titulares y suplentes pide (`titulares` / `maxSuplentes`).
 */
@Injectable()
export class TeamInscriptionsService {
  private readonly logger = new Logger(TeamInscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly qr: InscriptionQrService,
  ) {}

  async createTeam(
    dto: CreateTeamInscriptionDto,
    createdById: string,
    alcance: Alcance,
  ): Promise<TeamInscriptionResultDto> {
    const { members } = dto;

    this.assertWithinScope(dto, alcance);
    throwIfError(rosterConsistencyError(members));

    const catalog = await this.loadCatalog(dto.disciplineId, dto.categoryId);
    const { discipline, category } = catalog;
    const limits = {
      name: discipline.name,
      starters: discipline.titulares,
      maxSubstitutes: discipline.maxSuplentes,
    };
    throwIfError(rosterSizeError(members, limits));

    // Lo declarado se valida antes de tocar la base; lo ya guardado en el
    // padrón se vuelve a validar adentro (ver `writeRoster`).
    for (const member of members) {
      throwIfError(
        memberEligibilityError(category, declaredPerson(member), 'payload'),
      );
    }

    // QR e imágenes quedan fuera de la transacción: no hay motivo para tener
    // una conexión abierta mientras se generan.
    const qrCodes = members.map(() => this.qr.generateCode());

    const written = await this.persist(
      dto,
      catalog,
      qrCodes,
      createdById,
      alcance,
    );

    const qrImages = await Promise.all(
      written.inscriptions.map((i) => this.qr.renderImage(i.qrCode)),
    );

    const { starters, substitutes } = splitRoster(members);
    this.logger.log(
      `Team roster created: "${written.team.name}" (${discipline.name} / ` +
        `${category.name}) — ${starters.length} titulares + ` +
        `${substitutes.length} suplentes`,
    );

    // Mapeo explícito, mismo criterio que la consulta por QR: agregar un campo
    // a la respuesta tiene que ser una decisión, no un efecto de un `select`.
    return {
      team: {
        id: written.team.id,
        name: written.team.name,
        locality: written.team.locality,
        department: written.team.department,
      },
      discipline: {
        id: discipline.id,
        name: discipline.name,
        titulares: limits.starters,
        maxSuplentes: limits.maxSubstitutes,
      },
      category: {
        id: category.id,
        name: category.name,
        ageCriterion: category.ageCriterion,
        minAge: category.minAge,
        maxAge: category.maxAge,
        minBirthYear: category.minBirthYear,
        maxBirthYear: category.maxBirthYear,
        sex: category.sex,
      },
      totals: {
        titulares: starters.length,
        suplentes: substitutes.length,
        total: members.length,
      },
      members: members.map((member, i) => {
        const participant = written.participants[i];
        const inscription = written.inscriptions[i];
        return {
          participantId: participant.id,
          dni: participant.dni,
          firstName: participant.firstName,
          lastName: participant.lastName,
          isSubstitute: member.isSubstitute,
          isCaptain: member.isCaptain ?? false,
          position: member.position ?? null,
          shirtNumber: member.shirtNumber ?? null,
          inscriptionId: inscription.id,
          qrCode: inscription.qrCode,
          status: inscription.status,
          qrImage: qrImages[i],
        };
      }),
    };
  }

  /**
   * R05 — el departamento del equipo **y** el de cada integrante: con sólo el
   * del equipo, un delegado podría declarar el suyo en el encabezado y colar
   * gente de otro departamento en las filas.
   */
  private assertWithinScope(
    dto: CreateTeamInscriptionDto,
    alcance: Alcance,
  ): void {
    if (!this.scope.permiteDepartamento(alcance, dto.department)) {
      throw new ForbiddenException(
        `No podés inscribir equipos del departamento "${dto.department}": ` +
          'está fuera de tu alcance territorial.',
      );
    }

    const outside = dto.members.filter(
      (m) => !this.scope.permiteDepartamento(alcance, m.department),
    );
    if (outside.length > 0) {
      const detail = outside
        .map(
          (m) => `${m.firstName} ${m.lastName} (DNI ${m.dni}, ${m.department})`,
        )
        .join('; ')
        .slice(0, 500);
      throw new ForbiddenException(
        'Hay integrantes de departamentos fuera de tu alcance territorial: ' +
          detail,
      );
    }
  }

  /**
   * Disciplina y categoría en paralelo: son independientes. Se valida primero
   * la disciplina para conservar el orden de los mensajes.
   */
  private async loadCatalog(
    disciplineId: string,
    categoryId: string,
  ): Promise<RosterCatalog> {
    const [discipline, category] = await Promise.all([
      this.prisma.discipline.findUnique({
        where: { id: disciplineId },
        select: DISCIPLINE_FOR_ROSTER,
      }),
      this.prisma.category.findUnique({
        where: { id: categoryId },
        select: CATEGORY_FOR_ROSTER,
      }),
    ]);

    if (!discipline) {
      throw new BadRequestException('La disciplina seleccionada no existe');
    }
    if (!discipline.isActive) {
      throw new BadRequestException(
        `La disciplina "${discipline.name}" no está activa`,
      );
    }
    if (discipline.type !== DisciplineType.EQUIPO) {
      throw new BadRequestException(
        `"${discipline.name}" es una disciplina INDIVIDUAL y no se inscribe por ` +
          'plantel. Usá el alta individual (POST /inscriptions), una inscripción ' +
          'por participante.',
      );
    }
    // 400 explícito y no un tamaño adivinado: admitir planteles mal formados
    // sería un error invisible hasta el día del partido.
    const { titulares, maxSuplentes } = discipline;
    if (titulares === null || maxSuplentes === null) {
      throw new BadRequestException(
        `La disciplina "${discipline.name}" no tiene configurado el plantel ` +
          '(titulares y suplentes máximos). Cargalos en el ABM de disciplinas ' +
          'antes de inscribir equipos.',
      );
    }

    if (!category) {
      throw new BadRequestException('La categoría seleccionada no existe');
    }
    if (!category.isActive) {
      throw new BadRequestException('La categoría seleccionada no está activa');
    }
    if (category.disciplineId !== discipline.id) {
      throw new BadRequestException(
        `La categoría "${category.name}" no pertenece a la disciplina ` +
          `"${discipline.name}".`,
      );
    }

    return {
      discipline: { ...discipline, titulares, maxSuplentes },
      category,
    };
  }

  /** La transacción, con el 409 de DNI resuelto después del rollback. */
  private async persist(
    dto: CreateTeamInscriptionDto,
    catalog: RosterCatalog,
    qrCodes: string[],
    createdById: string,
    alcance: Alcance,
  ) {
    try {
      return await this.prisma.$transaction((tx) =>
        this.writeRoster(tx, dto, catalog, qrCodes, createdById, alcance),
      );
    } catch (error) {
      if (error instanceof DniOutsideScopeError) {
        throw await this.dniConflict(error.dnis);
      }
      throw error;
    }
  }

  /**
   * Participantes → equipo → miembros → inscripciones, en lote: el costo en
   * consultas es fijo y no crece con el tamaño del plantel.
   */
  private async writeRoster(
    tx: TxClient,
    dto: CreateTeamInscriptionDto,
    catalog: RosterCatalog,
    qrCodes: string[],
    createdById: string,
    alcance: Alcance,
  ) {
    const { members } = dto;
    const { category } = catalog;

    // S04 — búsqueda con el alcance adentro del `where`: un DNI de otro
    // territorio responde igual que uno inexistente.
    const found = await tx.participant.findMany({
      where: {
        dni: { in: members.map((m) => m.dni) },
        ...this.scope.whereParticipant(alcance),
      },
    });
    const byDni = new Map(found.map((p) => [p.dni, p]));

    // La elegibilidad de quien ya estaba se valida contra lo **persistido**:
    // si no, alcanzaría con declarar una fecha de nacimiento conveniente.
    for (const member of members) {
      const existing = byDni.get(member.dni);
      if (existing) {
        throwIfError(memberEligibilityError(category, existing, 'registry'));
      }
    }

    const toCreate = members.filter((m) => !byDni.has(m.dni));
    if (toCreate.length > 0) {
      try {
        const created = await tx.participant.createManyAndReturn({
          data: toCreate.map(newParticipantData),
        });
        for (const p of created) byDni.set(p.dni, p);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new DniOutsideScopeError(toCreate.map((m) => m.dni));
        }
        throw error;
      }
    }

    for (const p of found) {
      const member = members.find((m) => m.dni === p.dni)!;
      const changes = contactChanges(member, p);
      if (Object.keys(changes).length > 0) {
        byDni.set(
          p.dni,
          await tx.participant.update({ where: { id: p.id }, data: changes }),
        );
      }
    }

    const participants = members.map((m) => byDni.get(m.dni)!);

    // Sólo quien ya existía puede estar inscripto. Se buscan todos de una para
    // nombrar a cada repetido, en vez del choque crudo de la unique.
    if (found.length > 0) {
      const already = await tx.inscription.findMany({
        where: {
          categoryId: category.id,
          participantId: { in: found.map((p) => p.id) },
        },
        select: { participantId: true },
      });
      if (already.length > 0) {
        const ids = new Set(already.map((i) => i.participantId));
        const detail = participants
          .filter((p) => ids.has(p.id))
          .map((p) => `${p.firstName} ${p.lastName} (DNI ${p.dni})`)
          .join('; ');
        throw new ConflictException(
          `Ya están inscriptos en la categoría "${category.name}": ${detail}. ` +
            'Sacalos del plantel o revisá la categoría elegida.',
        );
      }
    }

    const team = await this.createTeamRow(tx, dto, catalog);

    await tx.teamMember.createMany({
      data: members.map((member, i) => ({
        teamId: team.id,
        participantId: participants[i].id,
        position: member.position,
        shirtNumber: member.shirtNumber,
        isCaptain: member.isCaptain ?? false,
        isSubstitute: member.isSubstitute,
      })),
    });

    const created = await tx.inscription.createManyAndReturn({
      data: participants.map((p, i) => ({
        participantId: p.id,
        categoryId: category.id,
        teamId: team.id,
        qrCode: qrCodes[i],
        createdById,
        status: InscriptionStatus.PENDIENTE,
      })),
      select: { id: true, qrCode: true, status: true },
    });
    // El lote no garantiza el orden de devolución: se reordena por QR (único).
    const byQr = new Map(created.map((i) => [i.qrCode, i]));
    const inscriptions = qrCodes.map((code) => byQr.get(code)!);

    return { team, participants, inscriptions };
  }

  /**
   * Un nombre repetido en la misma disciplina y categoría no se reutiliza: el
   * alta de plantel es un alta, no un merge.
   */
  private async createTeamRow(
    tx: TxClient,
    dto: CreateTeamInscriptionDto,
    { discipline, category }: RosterCatalog,
  ) {
    try {
      return await tx.team.create({
        data: {
          name: dto.teamName,
          disciplineId: discipline.id,
          categoryId: category.id,
          locality: dto.locality,
          department: dto.department,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Ya existe un equipo llamado "${dto.teamName}" en ${discipline.name} / ` +
            `${category.name}. Elegí otro nombre o editá el equipo existente.`,
        );
      }
      throw error;
    }
  }

  /**
   * 409 neutro (S04): dice qué hacer sin decir en qué territorio está la
   * persona. Se consulta afuera de la transacción ya revertida.
   */
  private async dniConflict(dnis: string[]): Promise<ConflictException> {
    const existing = await this.prisma.participant.findMany({
      where: { dni: { in: dnis } },
      select: { dni: true },
    });
    const dni = existing[0]?.dni;
    return new ConflictException(
      `Ya existe un participante con ${dni ? `el DNI ${dni}` : 'uno de los DNI del plantel'}. ` +
        'Si es de tu departamento, buscalo en el padrón; si no, pedí el alta a un ' +
        'administrador.',
    );
  }
}

function throwIfError(message: string | null): void {
  if (message) throw new BadRequestException(message);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function declaredPerson(member: Member) {
  return {
    dni: member.dni,
    firstName: member.firstName,
    lastName: member.lastName,
    birthDate: new Date(member.birthDate),
    sex: member.sex,
  };
}

function newParticipantData(member: Member): Prisma.ParticipantCreateManyInput {
  return {
    dni: member.dni,
    firstName: member.firstName,
    lastName: member.lastName,
    birthDate: new Date(member.birthDate),
    sex: member.sex,
    phone: member.phone,
    email: member.email,
    locality: member.locality,
    department: member.department,
    address: member.address,
  };
}

/**
 * Qué se pisa de un participante que ya existía.
 *
 * Nunca la identidad ni la elegibilidad (nombre, apellido, nacimiento, sexo,
 * departamento): un dedazo en una carga apurada de 16 filas no puede reescribir
 * el padrón. Eso se corrige desde el módulo de participantes, donde es
 * explícito y auditable. Sí el contacto, sólo con un valor no vacío distinto
 * del guardado: un campo omitido significa "no lo tengo", no "borralo".
 */
function contactChanges(
  member: Member,
  existing: Participant,
): Prisma.ParticipantUpdateInput {
  const changes: Prisma.ParticipantUpdateInput = {};
  for (const field of CONTACT_FIELDS) {
    const value = (member[field] ?? '').trim();
    if (value.length > 0 && value !== existing[field]) {
      changes[field] = value;
    }
  }
  return changes;
}
