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
import { Roles, CurrentUser } from '../../common/decorators';
import { Role, ADMIN_ROLES } from '../../common/constants';

@ApiTags('Documents')
@Controller('documents')
@ApiBearerAuth('access-token')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @Roles(...ADMIN_ROLES, Role.DELEGADO)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir documento' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentDto })
  @ApiResponse({
    status: 201,
    description: 'Documento subido a MinIO y registrado',
  })
  async upload(
    @Body() body: any,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpeg|jpg|png|pdf)$/i,
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    file: Express.Multer.File,
  ) {
    return this.documentsService.upload(body.participantId, body.type, file);
  }

  @Get('participant/:participantId')
  @Roles(...ADMIN_ROLES, Role.DELEGADO, Role.COORDINADOR)
  @ApiOperation({ summary: 'Listar documentos del participante' })
  @ApiResponse({
    status: 200,
    description: 'Lista de documentos con URLs presignadas',
  })
  async findByParticipant(
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.documentsService.findByParticipant(participantId);
  }

  @Patch(':id/review')
  @Roles(...ADMIN_ROLES)
  @ApiOperation({ summary: 'Validar/Rechazar documento' })
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reviewDto: ReviewDocumentDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.documentsService.review(id, userId, reviewDto);
  }
}
