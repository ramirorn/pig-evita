// ===========================================
// Documents Service
// ===========================================
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DocumentStatus, DocumentType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MinioService } from './minio.service';
import { ReviewDocumentDto } from './dto';
import { Alcance, ScopeService } from '../../common/scope';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly scope: ScopeService,
  ) {}

  async upload(
    participantId: string,
    type: DocumentType,
    file: Express.Multer.File,
    alcance: Alcance,
  ) {
    if (!file) {
      throw new BadRequestException('No se adjuntó ningún archivo');
    }

    // R05 — el participante tiene que estar dentro del alcance. Si no lo está,
    // 404 con el mismo mensaje que un id inexistente: subir un archivo a un
    // participante ajeno también sirve para confirmar que existe.
    const participant = await this.prisma.participant.findFirst({
      where: ScopeService.conAlcance(
        { id: participantId },
        this.scope.whereParticipant(alcance),
      ),
    });

    if (!participant) {
      throw new NotFoundException('Participante no encontrado');
    }

    // 1. Subir archivo a MinIO.
    // El nombre original se sanitiza dentro de MinioService (UUID + charset
    // acotado). No se incluye el DNI en la clave: viaja en las URLs firmadas.
    const objectName = await this.minioService.uploadFile(
      file,
      `participants/${participantId}`,
      file.originalname,
    );

    // 2. Desactivar documento anterior del mismo tipo si existía
    await this.prisma.document.updateMany({
      where: {
        participantId,
        documentType: type,
        status: { in: ['PENDIENTE', 'APROBADO', 'RECHAZADO'] },
      },
      data: {
        status: 'RECHAZADO',
        rejectionNote: 'Reemplazado por una versión más reciente',
      },
    });

    // 3. Crear registro en BD
    const document = await this.prisma.document.create({
      data: {
        participantId,
        documentType: type,
        fileKey: objectName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: DocumentStatus.PENDIENTE,
      },
    });

    this.logger.log(
      `Document ${type} uploaded for participant ${participant.dni}`,
    );
    return document;
  }

  async findByParticipant(participantId: string, alcance: Alcance) {
    // El recorte va en el `where` y no como un chequeo previo del participante:
    // una sola query, y sin forma de que un `documentId` suelto se escape.
    const documents = await this.prisma.document.findMany({
      where: ScopeService.conAlcance(
        { participantId },
        this.scope.whereDocument(alcance),
      ),
      orderBy: { createdAt: 'desc' },
    });

    // El bucket es privado: la única forma de acceder al archivo es una URL
    // pre-firmada de corta duración generada en cada consulta.
    return Promise.all(
      documents.map(async (doc) => {
        const presignedUrl = await this.minioService.getPresignedUrl(
          doc.fileKey,
        );
        return { ...doc, presignedUrl };
      }),
    );
  }

  async review(
    id: string,
    userId: string,
    reviewDto: ReviewDocumentDto,
    alcance: Alcance,
  ) {
    if (reviewDto.status === DocumentStatus.RECHAZADO && !reviewDto.notes) {
      throw new BadRequestException(
        'Debe incluir observaciones si rechaza el documento',
      );
    }

    const document = await this.prisma.document.findFirst({
      where: ScopeService.conAlcance({ id }, this.scope.whereDocument(alcance)),
    });

    if (!document) {
      // 404 y no 403 para el documento fuera de alcance.
      throw new NotFoundException('Documento no encontrado');
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        status: reviewDto.status,
        rejectionNote: reviewDto.notes,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
      include: {
        participant: { select: { dni: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(
      `Document ${id} reviewed by ${userId} - Status: ${updated.status}`,
    );
    return updated;
  }
}
