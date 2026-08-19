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

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {}

  async upload(
    participantId: string,
    type: DocumentType,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se adjuntó ningún archivo');
    }

    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
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

  async findByParticipant(participantId: string) {
    const documents = await this.prisma.document.findMany({
      where: { participantId },
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

  async review(id: string, userId: string, reviewDto: ReviewDocumentDto) {
    if (reviewDto.status === DocumentStatus.RECHAZADO && !reviewDto.notes) {
      throw new BadRequestException(
        'Debe incluir observaciones si rechaza el documento',
      );
    }

    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
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
