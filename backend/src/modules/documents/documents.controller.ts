// ===========================================
// Documents Controller
// ===========================================
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto, ReviewDocumentDto } from './dto';
import { FileSignaturePipe } from './file-signature.pipe';
import { Audit, Roles, CurrentUser } from '../../common/decorators';
import { ACCIONES } from '../../common/constants';
import { ScopeService } from '../../common/scope';
import type { JwtPayload } from '../auth/interfaces';

/** Tope de multer para documentos: 6 MB (el límite de negocio es 5 MB). */
const LIMITE_MULTER_DOCUMENTO = 6 * 1024 * 1024;

@ApiTags('Documents')
@Controller('documents')
@ApiBearerAuth('access-token')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly scope: ScopeService,
  ) {}

  @Post('upload')
  @Roles(...ACCIONES.DOCUMENT_UPLOAD)
  // VULN-10: sin `limits`, multer acumulaba en memoria el archivo entero (de
  // cualquier tamaño) antes de que el pipe mirara los 5 MB. El tope de multer
  // va un poco arriba (6 MB) para que lo de entre 5 y 6 MB siga respondiendo
  // el 422 de siempre; más que eso se corta con 413 sin llegar a memoria.
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: LIMITE_MULTER_DOCUMENTO,
        files: 1,
        fields: 5,
        fieldSize: 1024,
      },
    }),
  )
  @ApiOperation({ summary: 'Subir documento' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentDto })
  @ApiResponse({
    status: 201,
    description: 'Documento subido a MinIO y registrado',
  })
  async upload(
    // Tipado explícito: el ValidationPipe global valida `participantId` (UUID)
    // y `type` (enum) antes de que lleguen a Prisma.
    @Body() body: UploadDocumentDto,
    @UploadedFile(
      // Sólo el tamaño (sigue devolviendo 422, como antes). El
      // `addFileTypeValidator` que había acá comparaba contra `file.mimetype`,
      // que lo declara el cliente: se fue a `FileSignaturePipe`, que mira los
      // magic bytes del contenido y responde 400 (ver R14).
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
      FileSignaturePipe,
    )
    file: Express.Multer.File,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.documentsService.upload(
      body.participantId,
      body.type,
      file,
      await this.scope.alcanceDe(actor),
    );
  }

  @Get('participant/:participantId')
  @Roles(...ACCIONES.DOCUMENT_READ)
  // VULN-26: quién pidió las URLs firmadas de documentos de identidad de un
  // menor queda en la auditoría (una fila por usuario y participante cada
  // 10 minutos).
  @Audit({ action: 'READ_DOCUMENTS', lectura: true })
  @ApiOperation({ summary: 'Listar documentos del participante' })
  @ApiResponse({
    status: 200,
    description: 'Lista de documentos con URLs presignadas',
  })
  async findByParticipant(
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    // Fuera de alcance devuelve lista vacía, igual que un participante sin
    // documentos: no hay forma de distinguir "no tiene" de "no es tuyo".
    return this.documentsService.findByParticipant(
      participantId,
      await this.scope.alcanceDe(actor),
    );
  }

  @Patch(':id/review')
  @Roles(...ACCIONES.DOCUMENT_REVIEW)
  @ApiOperation({ summary: 'Validar/Rechazar documento' })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reviewDto: ReviewDocumentDto,
    @CurrentUser('sub') userId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.documentsService.review(
      id,
      userId,
      reviewDto,
      await this.scope.alcanceDe(actor),
    );
  }
}
