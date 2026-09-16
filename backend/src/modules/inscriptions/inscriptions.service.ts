// ===========================================
// Inscriptions Service
// ===========================================
import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma, InscriptionStatus, DisciplineType, Sex } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateInscriptionDto,
  CreateTeamInscriptionDto,
  ReviewInscriptionDto,
  RejectInscriptionDto,
  InscriptionFilterDto,
  PublicInscriptionDto,
  TeamInscriptionResultDto,
} from './dto';
import { buildPaginatedResponse } from '../../common/dto';
import {
  CATEGORY_WITH_DISCIPLINE,
  PARTICIPANT_CONTACT,
  PARTICIPANT_SUMMARY,
  TEAM_MEMBER_WITH_PARTICIPANT,
  TEAM_SUMMARY,
  USER_SUMMARY,
} from '../../common/prisma-selects';
import { Alcance, ScopeService } from '../../common/scope';

@Injectable()
export class InscriptionsService {
  private readonly logger = new Logger(InscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  /**
   * Crear inscripción (endpoint público via QR).
   * - Crea o reutiliza el participante por DNI.
   * - Valida edad vs categoría.
   * - Genera código QR único.
   */
  async create(
    createDto: CreateInscriptionDto,
    createdById: string,
    alcance: Alcance,
  ) {
    const {
      dni,
      firstName,
      lastName,
      birthDate,
      sex,
      phone,
      email,
      locality,
      department,
      address,
      categoryId,
      teamId,
    } = createDto;

    // 0. R05 — el alta crea (o reutiliza) un participante con el departamento
    // que viene en el body. Sin este corte, un delegado podía inscribir gente
    // de cualquier departamento y después no volver a verla, y —peor— podía
    // usar el alta para tocar el padrón ajeno.
    if (!this.scope.permiteDepartamento(alcance, department)) {
      throw new ForbiddenException(
        `No podés inscribir participantes del departamento "${department}": ` +
          'está fuera de tu alcance territorial.',
      );
    }

    // 1. Verificar que la categoría existe y obtener su disciplina
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { discipline: true },
    });

    if (!category) {
      throw new BadRequestException('La categoría seleccionada no existe');
    }

    if (!category.isActive) {
      throw new BadRequestException('La categoría seleccionada no está activa');
    }

    // 2. Validar edad del participante
    const birthDateObj = new Date(birthDate);
    const age = this.calculateAge(birthDateObj);

    if (age < category.minAge || age > category.maxAge) {
      throw new BadRequestException(
        `La edad del participante (${age} años) no cumple con el rango de la categoría (${category.minAge}-${category.maxAge} años)`,
      );
    }

    // 3. Validar sexo vs categoría
    if (category.sex !== 'MIXTO' && category.sex !== sex) {
      throw new BadRequestException(
        `El sexo del participante no coincide con la categoría (${category.sex})`,
      );
    }

    // 6. Generar código QR único
    const qrCode = this.generarQrCode();

    // -------------------------------------------------
    // R13 — pasos 4, 5 y 7 en una sola transacción
    // -------------------------------------------------
    //
    // Antes esto eran tres escrituras sueltas: se creaba el `Participant`, se
    // chequeaba el duplicado y se creaba la `Inscription`. Si la última fallaba
    // —violación de la unique de `qrCode`, la FK de `teamId` apuntando a un
    // equipo borrado, o simplemente la conexión cayéndose— el participante
    // recién creado quedaba huérfano: una fila de una persona real, sin
    // inscripción, invisible para todas las pantallas y para el reintento (que
    // al volver a mandar el mismo DNI encuentra el participante existente y ya
    // no lo recrea, pero tampoco corrige nada). Estado parcial indetectable.
    //
    // También cierra la ventana de carrera del paso 5: dos requests simultáneos
    // con el mismo DNI y la misma categoría pasaban los dos el chequeo de
    // duplicado. Ahora el segundo choca contra la unique
    // `participantId_categoryId` **adentro** de su transacción y no deja rastro.
    //
    // `$transaction` interactiva (callback) y no la variante de array: los
    // pasos dependen del resultado del anterior (el `participantId` sale del
    // paso 4). Todo lo que no toca la base —validaciones, generación del QR,
    // render de la imagen— queda afuera para no tener la transacción abierta
    // más tiempo del necesario.
    const inscription = await this.prisma.$transaction(async (tx) => {
      // 4. Crear o encontrar participante por DNI
      //
      // S04 — la búsqueda va **con el alcance adentro del `where`**.
      //
      // Con un `findUnique({ where: { dni } })` pelado, el corte del paso 0 no
      // servía de nada: valida el `department` del *body*, así que un delegado
      // que mandaba el DNI de un chico de otro departamento declarando el suyo
      // pasaba el chequeo, reutilizaba la fila ajena y se llevaba de vuelta su
      // ficha entera —justo la que su propio `GET /participants/:id` le niega
      // con 404—. El DNI no es una barrera: figura en cualquier planilla de
      // escuela.
      //
      // Al usar `findFirst` con el filtro territorial, un DNI que existe fuera
      // del alcance responde **igual** que uno que no existe: cae en la rama de
      // creación de abajo, donde la unique de `dni` lo corta con el mismo 409
      // que cualquier duplicado. Es deliberado que no se pueda distinguir
      // "existe pero no es tuyo" de "no existe", por la misma razón por la que
      // R06 devuelve 404 y no 403.
      let participant = await tx.participant.findFirst({
        where: {
          dni,
          ...this.scope.whereParticipant(alcance),
        },
      });

      if (!participant) {
        try {
          participant = await tx.participant.create({
            data: {
              dni,
              firstName,
              lastName,
              birthDate: birthDateObj,
              sex,
              phone,
              email,
              locality,
              department,
              address,
            },
          });
          this.logger.log(`New participant created: ${dni}`);
        } catch (error) {
          // S04 — el DNI existe, pero fuera del alcance de quien pregunta.
          //
          // La búsqueda de arriba va acotada al territorio, así que un
          // participante ajeno "no aparece" y se cae en esta rama; ahí la unique
          // de `dni` corta. Sin este `catch`, el alta terminaba en un 500 con el
          // error crudo de Prisma: cambiar una fuga de datos por un 500 no es
          // arreglarla.
          //
          // El mensaje es **deliberadamente neutro**: no dice en qué
          // departamento está ni si existe, porque eso reintroduciría por texto
          // la distinción que el `findFirst` acotado vino a borrar. Dice qué
          // hacer, que es lo que el delegado necesita.
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new ConflictException(
              'Ya existe un participante con ese DNI. Si es de tu departamento, ' +
                'buscalo en el padrón; si no, pedí el alta a un administrador.',
            );
          }
          throw error;
        }
      }

      // 5. Verificar que no esté ya inscripto en esta categoría
      const existingInscription = await tx.inscription.findUnique({
        where: {
          participantId_categoryId: {
            participantId: participant.id,
            categoryId,
          },
        },
      });

      if (existingInscription) {
        throw new ConflictException(
          'El participante ya está inscripto en esta categoría',
        );
      }

      // 7. Crear inscripción
      return tx.inscription.create({
        data: {
          participantId: participant.id,
          categoryId,
          teamId,
          qrCode,
          createdById,
          status: InscriptionStatus.PENDIENTE,
        },
        include: {
          // S04/S10 — antes bajaba `participant: true`, la fila entera
          // (domicilio incluido, que ni `PARTICIPANT_CONTACT` expone). Es el
          // mecanismo que `prisma-selects.ts` describe como el motivo de existir
          // del archivo: un `include` arrastra las columnas nuevas solo.
          participant: { select: PARTICIPANT_CONTACT },
          category: { include: { discipline: true } },
        },
      });
    });

    // 8. Generar imagen QR
    const qrImage = await QRCode.toDataURL(qrCode, {
      width: 300,
      margin: 2,
      color: { dark: '#0F4C81', light: '#FFFFFF' },
    });

    this.logger.log(
      `Inscription created: ${qrCode} for ${dni} in ${category.name}`,
    );

    return {
      ...inscription,
      qrImage,
    };
  }

  /**
   * Listar inscripciones con paginación y filtros.
   */
  async findAll(filterDto: InscriptionFilterDto, alcance: Alcance) {
    const where: Prisma.InscriptionWhereInput = {};

    if (filterDto.status) {
      where.status = filterDto.status as InscriptionStatus;
    }

    if (filterDto.categoryId) {
      where.categoryId = filterDto.categoryId;
    }

    if (filterDto.department) {
      where.participant = {
        department: { contains: filterDto.department, mode: 'insensitive' },
      };
    }

    if (filterDto.search) {
      where.OR = [
        {
          participant: {
            firstName: { contains: filterDto.search, mode: 'insensitive' },
          },
        },
        {
          participant: {
            lastName: { contains: filterDto.search, mode: 'insensitive' },
          },
        },
        { participant: { dni: { contains: filterDto.search } } },
        { qrCode: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    // R05 — el departamento de una inscripción es el de su participante.
    const whereConAlcance = ScopeService.conAlcance(
      where,
      this.scope.whereInscription(alcance),
    );

    const [inscriptions, total] = await Promise.all([
      this.prisma.inscription.findMany({
        where: whereConAlcance,
        // `select` explícito: la tabla de inscripciones muestra código, estado,
        // nombre + DNI, categoría y equipo. Las notas internas y los timestamps
        // de revisión sólo se usan en el detalle, así que no viajan en la lista.
        select: {
          id: true,
          qrCode: true,
          status: true,
          createdAt: true,
          participant: { select: PARTICIPANT_SUMMARY },
          category: { select: CATEGORY_WITH_DISCIPLINE },
          team: { select: TEAM_SUMMARY },
          createdBy: { select: USER_SUMMARY },
          reviewedBy: { select: USER_SUMMARY },
          approvedBy: { select: USER_SUMMARY },
        },
        skip: filterDto.skip,
        take: filterDto.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inscription.count({ where: whereConAlcance }),
    ]);

    return buildPaginatedResponse(inscriptions, total, filterDto);
  }

  /**
   * Obtener inscripción por ID.
   */
  async findOne(id: string, alcance: Alcance) {
    const inscription = await this.prisma.inscription.findFirst({
      where: ScopeService.conAlcance(
        { id },
        this.scope.whereInscription(alcance),
      ),
      // El detalle sí muestra datos de contacto, notas y trazabilidad. Los
      // documentos del participante no se usan en esta pantalla y se piden por
      // su propio endpoint (`GET /documents/participant/:id`).
      select: {
        id: true,
        qrCode: true,
        status: true,
        notes: true,
        rejectionNote: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
        approvedAt: true,
        participant: { select: PARTICIPANT_CONTACT },
        category: { select: CATEGORY_WITH_DISCIPLINE },
        team: {
          select: {
            ...TEAM_SUMMARY,
            members: { select: TEAM_MEMBER_WITH_PARTICIPANT },
          },
        },
        createdBy: { select: USER_SUMMARY },
        reviewedBy: { select: USER_SUMMARY },
        approvedBy: { select: USER_SUMMARY },
      },
    });

    if (!inscription) {
      // 404 y no 403 para la inscripción fuera de alcance: mismo mensaje que
      // un id inexistente.
      throw new NotFoundException('Inscripción no encontrada');
    }

    return inscription;
  }

  /**
   * Buscar inscripción por código QR (endpoint PÚBLICO, sin autenticación).
   *
   * Superficie de datos mínima a propósito: cualquier persona que conozca el
   * código QR puede llamar a este endpoint. Se exponen únicamente nombre y
   * apellido del participante, disciplina, categoría y estado del trámite.
   * NO agregar dni, email, phone, birthDate, address, department ni notas
   * internas (`notes` / `rejectionNote`) al `select` ni al objeto devuelto.
   */
  async findByQr(qrCode: string): Promise<PublicInscriptionDto> {
    const inscription = await this.prisma.inscription.findUnique({
      where: { qrCode },
      select: {
        qrCode: true,
        status: true,
        createdAt: true,
        participant: { select: { firstName: true, lastName: true } },
        category: {
          select: {
            name: true,
            discipline: { select: { name: true } },
          },
        },
      },
    });

    if (!inscription) {
      throw new NotFoundException(
        'Inscripción no encontrada para el código QR proporcionado',
      );
    }

    // Mapeo explícito: evita que un cambio futuro en el `select` filtre campos
    // nuevos sin pasar por una revisión de este contrato.
    return {
      qrCode: inscription.qrCode,
      status: inscription.status,
      createdAt: inscription.createdAt,
      participant: {
        firstName: inscription.participant.firstName,
        lastName: inscription.participant.lastName,
      },
      category: {
        name: inscription.category.name,
        discipline: { name: inscription.category.discipline.name },
      },
    };
  }

  /**
   * Revisar inscripción (Delegado).
   * Estado: PENDIENTE → REVISADA
   */
  async review(
    id: string,
    userId: string,
    reviewDto: ReviewInscriptionDto,
    alcance: Alcance,
  ) {
    // `findOne` aplica el alcance: revisar una inscripción de otro
    // departamento devuelve 404 antes de cambiar ningún estado.
    const inscription = await this.findOne(id, alcance);

    if (inscription.status !== InscriptionStatus.PENDIENTE) {
      throw new BadRequestException(
        `No se puede revisar una inscripción con estado "${inscription.status}"`,
      );
    }

    const updated = await this.prisma.inscription.update({
      where: { id },
      data: {
        status: InscriptionStatus.REVISADA,
        reviewedById: userId,
        reviewedAt: new Date(),
        notes: reviewDto.notes,
      },
      include: {
        participant: true,
        category: { include: { discipline: true } },
      },
    });

    this.logger.log(
      `Inscription reviewed: ${updated.qrCode} by user ${userId}`,
    );
    return updated;
  }

  /**
   * Aprobar inscripción (Administrador).
   * Estado: REVISADA → APROBADA
   */
  async approve(id: string, userId: string, alcance: Alcance) {
    const inscription = await this.findOne(id, alcance);

    if (inscription.status !== InscriptionStatus.REVISADA) {
      throw new BadRequestException(
        `Solo se pueden aprobar inscripciones con estado "REVISADA". Estado actual: "${inscription.status}"`,
      );
    }

    const updated = await this.prisma.inscription.update({
      where: { id },
      data: {
        status: InscriptionStatus.APROBADA,
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        participant: true,
        category: { include: { discipline: true } },
      },
    });

    this.logger.log(
      `Inscription approved: ${updated.qrCode} by user ${userId}`,
    );
    return updated;
  }

  /**
   * Rechazar inscripción.
   * Estado: PENDIENTE|REVISADA → RECHAZADA
   */
  async reject(
    id: string,
    userId: string,
    rejectDto: RejectInscriptionDto,
    alcance: Alcance,
  ) {
    const inscription = await this.findOne(id, alcance);

    if (inscription.status === InscriptionStatus.APROBADA) {
      throw new BadRequestException(
        'No se puede rechazar una inscripción ya aprobada',
      );
    }

    if (inscription.status === InscriptionStatus.RECHAZADA) {
      throw new BadRequestException('La inscripción ya fue rechazada');
    }

    const updated = await this.prisma.inscription.update({
      where: { id },
      data: {
        status: InscriptionStatus.RECHAZADA,
        rejectionNote: rejectDto.rejectionNote,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
      include: {
        participant: true,
        category: { include: { discipline: true } },
      },
    });

    this.logger.log(
      `Inscription rejected: ${updated.qrCode} by user ${userId}`,
    );
    return updated;
  }

  // ===========================================
  // S21 — inscripción de planteles completos
  // ===========================================

  /**
   * Alta de un plantel entero: un `Team`, sus `TeamMember` y una `Inscription`
   * por integrante, en una sola transacción.
   *
   * Invierte el orden del alta individual. Ahí se carga la persona y recién
   * después se elige la categoría; acá el encargado elige disciplina y categoría
   * primero, el sistema le dice cuántos titulares y suplentes pide la disciplina
   * (`titulares` / `maxSuplentes`) y después carga el plantel. Para un deporte
   * de equipo el orden viejo obliga a cargar 16 chicos de a uno sin que el
   * sistema sepa nunca que forman un equipo.
   *
   * **Todo o nada.** Si falla el integrante 14 no queda ni el equipo, ni los 13
   * `TeamMember` anteriores, ni sus inscripciones, ni los participantes que se
   * hayan creado en el camino. Es el mismo motivo que R13: un plantel a medias
   * es estado parcial indetectable —un equipo de 13 que nadie sabe que está
   * incompleto— y el reintento no lo corrige porque los DNI ya existen.
   *
   * Todo lo que no toca la base (validaciones, conteos, render de los QR) queda
   * afuera de la transacción: son 16 imágenes PNG y no hay motivo para tener una
   * conexión abierta mientras se generan.
   */
  async createTeam(
    dto: CreateTeamInscriptionDto,
    createdById: string,
    alcance: Alcance,
  ): Promise<TeamInscriptionResultDto> {
    const {
      disciplineId,
      categoryId,
      teamName,
      locality,
      department,
      members,
    } = dto;

    // ---------------------------------------------
    // 1. Alcance territorial (R05)
    // ---------------------------------------------
    // Se chequea el departamento del equipo **y** el de cada integrante. Sólo
    // el del equipo no alcanza: el alta crea o reutiliza participantes con el
    // departamento que viene en cada fila del plantel, así que un delegado
    // podría declarar su departamento en el encabezado y colar gente de
    // cualquier otro lado en el mismo request.
    if (!this.scope.permiteDepartamento(alcance, department)) {
      throw new ForbiddenException(
        `No podés inscribir equipos del departamento "${department}": ` +
          'está fuera de tu alcance territorial.',
      );
    }

    const fueraDeAlcance = members.filter(
      (m) => !this.scope.permiteDepartamento(alcance, m.department),
    );
    if (fueraDeAlcance.length > 0) {
      const detalle = fueraDeAlcance
        .map(
          (m) => `${m.firstName} ${m.lastName} (DNI ${m.dni}, ${m.department})`,
        )
        .join('; ')
        .slice(0, 500);
      throw new ForbiddenException(
        'Hay integrantes de departamentos fuera de tu alcance territorial: ' +
          detalle,
      );
    }

    // ---------------------------------------------
    // 2. Consistencia interna del payload
    // ---------------------------------------------
    const dnisRepetidos = buscarRepetidos(members.map((m) => m.dni));
    if (dnisRepetidos.length > 0) {
      throw new BadRequestException(
        `El plantel tiene DNI repetidos: ${dnisRepetidos.join(', ')}. ` +
          'Cada integrante tiene que figurar una sola vez.',
      );
    }

    const capitanes = members.filter((m) => m.isCaptain === true);
    if (capitanes.length > 1) {
      throw new BadRequestException(
        `El plantel tiene ${capitanes.length} capitanes marcados. ` +
          'Como mucho puede haber uno.',
      );
    }

    // ---------------------------------------------
    // 3. Disciplina: tiene que ser de equipo y tener el plantel configurado
    // ---------------------------------------------
    const discipline = await this.prisma.discipline.findUnique({
      where: { id: disciplineId },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        titulares: true,
        maxSuplentes: true,
      },
    });

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

    // Casi ninguna disciplina tiene esto cargado todavía. El 400 explícito es
    // deliberado: adivinar un tamaño de plantel (derivándolo de `minPlayers`,
    // por ejemplo) admitiría equipos mal formados sin que nadie se entere, y el
    // error sería invisible hasta el día del partido.
    if (discipline.titulares === null || discipline.maxSuplentes === null) {
      throw new BadRequestException(
        `La disciplina "${discipline.name}" no tiene configurado el plantel ` +
          '(titulares y suplentes máximos). Cargalos en el ABM de disciplinas ' +
          'antes de inscribir equipos.',
      );
    }

    const { titulares: titularesExigidos, maxSuplentes } = discipline;

    // ---------------------------------------------
    // 4. Categoría: existe, está activa y es de esta disciplina
    // ---------------------------------------------
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        minAge: true,
        maxAge: true,
        sex: true,
        isActive: true,
        disciplineId: true,
      },
    });

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

    // ---------------------------------------------
    // 5. Composición del plantel
    // ---------------------------------------------
    const titulares = members.filter((m) => !m.isSubstitute);
    const suplentes = members.filter((m) => m.isSubstitute);

    if (titulares.length !== titularesExigidos) {
      throw new BadRequestException(
        `"${discipline.name}" exige exactamente ${titularesExigidos} titulares y ` +
          `el plantel trae ${titulares.length}.`,
      );
    }

    if (suplentes.length > maxSuplentes) {
      throw new BadRequestException(
        `"${discipline.name}" admite hasta ${maxSuplentes} suplentes y el plantel ` +
          `trae ${suplentes.length}.`,
      );
    }

    // ---------------------------------------------
    // 6. Elegibilidad de cada integrante según lo declarado
    // ---------------------------------------------
    // Se valida acá, antes de abrir la transacción, para que el encargado reciba
    // el error sin que se toque la base. Adentro se vuelve a validar contra los
    // datos **persistidos** de los participantes que ya existían: ver el
    // comentario en el paso 8.
    for (const member of members) {
      this.validarElegibilidad(category, {
        dni: member.dni,
        firstName: member.firstName,
        lastName: member.lastName,
        birthDate: new Date(member.birthDate),
        sex: member.sex,
      });
    }

    // ---------------------------------------------
    // 7. Un QR por integrante, generado con la misma función que el alta
    //    individual (`generarQrCode`). No hay una segunda forma de armarlo.
    // ---------------------------------------------
    const qrCodes = members.map(() => this.generarQrCode());

    // =============================================
    // 8. Transacción: participantes → equipo → miembros → inscripciones
    // =============================================
    const escrito = await this.prisma.$transaction(async (tx) => {
      // 8.a — Participantes: se reutilizan por DNI.
      //
      // S04 — la búsqueda va con el alcance adentro del `where`, igual que en el
      // alta individual: un DNI que existe fuera del alcance tiene que responder
      // como uno que no existe, si no el endpoint se convierte en un oráculo del
      // padrón provincial con sólo mandar DNIs.
      const participantes: Array<{
        id: string;
        dni: string;
        firstName: string;
        lastName: string;
      }> = [];

      for (const member of members) {
        const existente = await tx.participant.findFirst({
          where: { dni: member.dni, ...this.scope.whereParticipant(alcance) },
        });

        if (!existente) {
          try {
            const creado = await tx.participant.create({
              data: {
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
              },
            });
            participantes.push(creado);
            continue;
          } catch (error) {
            // Mismo caso y mismo mensaje neutro que el alta individual: el DNI
            // existe pero fuera del alcance de quien pregunta.
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            ) {
              throw new ConflictException(
                `Ya existe un participante con el DNI ${member.dni}. Si es de tu ` +
                  'departamento, buscalo en el padrón; si no, pedí el alta a un ' +
                  'administrador.',
              );
            }
            throw error;
          }
        }

        // El participante ya estaba cargado.
        //
        // DECISIÓN — qué se pisa y qué no.
        //
        // NO se pisan `firstName`, `lastName`, `birthDate`, `sex` ni
        // `department`. Esos cinco son la identidad y la elegibilidad de la
        // persona: la fecha de nacimiento y el sexo deciden en qué categoría
        // puede competir, y el departamento decide quién la ve. Una carga de
        // plantel es un tipeo apurado de 16 filas; que un dedazo ahí reescriba
        // en silencio el padrón —y de paso cambie la validez de inscripciones
        // que ya estaban aprobadas en otras disciplinas— es exactamente la clase
        // de efecto lateral que no se detecta hasta que alguien queda afuera de
        // una competencia. Esos campos se corrigen desde el módulo de
        // participantes, que es donde el cambio es explícito y auditable.
        //
        // SÍ se actualizan `phone`, `email`, `address` y `locality`, y sólo
        // cuando el payload trae un valor no vacío distinto del guardado: son
        // datos de contacto que cambian seguido y donde el dato más reciente es
        // el bueno. Nunca se borra con vacío: un campo omitido en el plantel
        // significa "no lo tengo a mano", no "bórralo".
        const cambios: Prisma.ParticipantUpdateInput = {};
        for (const campo of [
          'phone',
          'email',
          'address',
          'locality',
        ] as const) {
          const valor = (member[campo] ?? '').trim();
          if (valor.length > 0 && valor !== existente[campo]) {
            cambios[campo] = valor;
          }
        }

        const participante =
          Object.keys(cambios).length > 0
            ? await tx.participant.update({
                where: { id: existente.id },
                data: cambios,
              })
            : existente;

        // La elegibilidad se revalida contra lo **persistido**. Arriba se validó
        // lo declarado en el payload, pero para un participante que ya existe lo
        // declarado no es lo que manda: la base tiene su fecha de nacimiento y su
        // sexo reales, y son esos los que deciden si puede competir en esta
        // categoría. Sin este segundo chequeo, mandar una fecha de nacimiento
        // conveniente alcanzaría para meter a un chico en una categoría que no le
        // corresponde.
        this.validarElegibilidad(
          category,
          {
            dni: participante.dni,
            firstName: participante.firstName,
            lastName: participante.lastName,
            birthDate: participante.birthDate,
            sex: participante.sex,
          },
          'padron',
        );

        participantes.push(participante);
      }

      // 8.b — Inscripciones ya existentes en esta categoría.
      //
      // La unique `participantId_categoryId` cortaría igual, pero con un choque
      // de constraint crudo que no dice *quién* de los 16 es el repetido. Se
      // buscan todos de una y se informan por DNI y nombre: el encargado tiene
      // que poder sacar esa fila del plantel sin adivinar.
      const yaInscriptos = await tx.inscription.findMany({
        where: {
          categoryId,
          participantId: { in: participantes.map((p) => p.id) },
        },
        select: { participantId: true },
      });

      if (yaInscriptos.length > 0) {
        const repetidos = new Set(yaInscriptos.map((i) => i.participantId));
        const detalle = participantes
          .filter((p) => repetidos.has(p.id))
          .map((p) => `${p.firstName} ${p.lastName} (DNI ${p.dni})`)
          .join('; ');
        throw new ConflictException(
          `Ya están inscriptos en la categoría "${category.name}": ${detalle}. ` +
            'Sacalos del plantel o revisá la categoría elegida.',
        );
      }

      // 8.c — Equipo.
      //
      // Un nombre repetido en la misma disciplina y categoría no se reutiliza:
      // el alta de plantel es un alta, no un merge. Si el equipo ya existe, lo
      // que corresponde es editarlo desde el módulo de equipos, donde se ve qué
      // plantel tiene cargado.
      let team: {
        id: string;
        name: string;
        locality: string;
        department: string;
      };
      try {
        team = await tx.team.create({
          data: {
            name: teamName,
            disciplineId: discipline.id,
            categoryId: category.id,
            locality,
            department,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(
            `Ya existe un equipo llamado "${teamName}" en ${discipline.name} / ` +
              `${category.name}. Elegí otro nombre o editá el equipo existente.`,
          );
        }
        throw error;
      }

      // 8.d — Miembros del plantel y 8.e — una inscripción por integrante.
      const filas = members.map((member, i) => ({
        member,
        participante: participantes[i],
        qrCode: qrCodes[i],
      }));

      const teamMembers = [];
      const inscriptions = [];

      for (const { member, participante, qrCode } of filas) {
        teamMembers.push(
          await tx.teamMember.create({
            data: {
              teamId: team.id,
              participantId: participante.id,
              position: member.position,
              shirtNumber: member.shirtNumber,
              isCaptain: member.isCaptain ?? false,
              isSubstitute: member.isSubstitute,
            },
          }),
        );

        inscriptions.push(
          await tx.inscription.create({
            data: {
              participantId: participante.id,
              categoryId: category.id,
              teamId: team.id,
              qrCode,
              createdById,
              status: InscriptionStatus.PENDIENTE,
            },
            select: { id: true, qrCode: true, status: true },
          }),
        );
      }

      return { team, participantes, teamMembers, inscriptions };
    });

    // ---------------------------------------------
    // 9. Imágenes QR — fuera de la transacción.
    // ---------------------------------------------
    const qrImages = await Promise.all(
      escrito.inscriptions.map((i) =>
        QRCode.toDataURL(i.qrCode, {
          width: 300,
          margin: 2,
          color: { dark: '#0F4C81', light: '#FFFFFF' },
        }),
      ),
    );

    this.logger.log(
      `Team roster created: "${escrito.team.name}" (${discipline.name} / ` +
        `${category.name}) — ${titulares.length} titulares + ` +
        `${suplentes.length} suplentes`,
    );

    return {
      team: {
        id: escrito.team.id,
        name: escrito.team.name,
        locality: escrito.team.locality,
        department: escrito.team.department,
      },
      discipline: {
        id: discipline.id,
        name: discipline.name,
        titulares: titularesExigidos,
        maxSuplentes,
      },
      category: {
        id: category.id,
        name: category.name,
        minAge: category.minAge,
        maxAge: category.maxAge,
        sex: category.sex,
      },
      totals: {
        titulares: titulares.length,
        suplentes: suplentes.length,
        total: members.length,
      },
      // Mapeo explícito, mismo criterio que `findByQr`: que agregar un campo a
      // esta respuesta sea una decisión y no el efecto colateral de un `select`.
      members: members.map((member, i) => {
        const participante = escrito.participantes[i];
        const teamMember = escrito.teamMembers[i];
        const inscription = escrito.inscriptions[i];
        return {
          participantId: participante.id,
          dni: participante.dni,
          firstName: participante.firstName,
          lastName: participante.lastName,
          isSubstitute: teamMember.isSubstitute,
          isCaptain: teamMember.isCaptain,
          position: teamMember.position ?? null,
          shirtNumber: teamMember.shirtNumber ?? null,
          inscriptionId: inscription.id,
          qrCode: inscription.qrCode,
          status: inscription.status,
          qrImage: qrImages[i],
        };
      }),
    };
  }

  /**
   * Edad y sexo de una persona contra el rango de la categoría.
   *
   * Mismo criterio de edad que el alta individual —`calculateAge`, edad cumplida
   * al día de hoy— a propósito: dos criterios distintos para la misma pregunta
   * harían que un chico entre por una puerta y no por la otra.
   *
   * `origen` sólo cambia el texto: el mismo rechazo se lee distinto si el dato
   * vino en el request o si ya estaba en el padrón.
   */
  private validarElegibilidad(
    category: { name: string; minAge: number; maxAge: number; sex: Sex },
    persona: {
      dni: string;
      firstName: string;
      lastName: string;
      birthDate: Date;
      sex: Sex;
    },
    origen: 'payload' | 'padron' = 'payload',
  ): void {
    const quien = `${persona.firstName} ${persona.lastName} (DNI ${persona.dni})`;
    const segun =
      origen === 'padron' ? ' según los datos cargados en el padrón' : '';

    const age = this.calculateAge(persona.birthDate);
    if (age < category.minAge || age > category.maxAge) {
      throw new BadRequestException(
        `${quien} tiene ${age} años${segun} y la categoría ` +
          `"${category.name}" admite de ${category.minAge} a ${category.maxAge}.`,
      );
    }

    if (category.sex !== Sex.MIXTO && category.sex !== persona.sex) {
      throw new BadRequestException(
        `${quien} es ${persona.sex}${segun} y la categoría "${category.name}" ` +
          `es ${category.sex}.`,
      );
    }
  }

  /**
   * Código QR único de una inscripción.
   *
   * Vive acá y no repetido en cada alta: el formato `EVITA-XXXXXXXX` es lo que
   * leen el endpoint público de consulta y la credencial impresa. Una segunda
   * implementación que se desincronice rompería los dos sin tocarlos.
   */
  private generarQrCode(): string {
    return `EVITA-${uuidv4().slice(0, 8).toUpperCase()}`;
  }

  /**
   * Calcula la edad basada en la fecha de nacimiento.
   */
  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }
}

/** Valores que aparecen más de una vez, sin repetirse ellos mismos. */
function buscarRepetidos(valores: string[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const valor of valores) {
    if (vistos.has(valor)) repetidos.add(valor);
    vistos.add(valor);
  }
  return [...repetidos];
}
