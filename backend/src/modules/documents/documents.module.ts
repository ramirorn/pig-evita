// ===========================================
// Documents Module
// ===========================================
import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { MinioService } from './minio.service';
import { FileSignaturePipe } from './file-signature.pipe';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, MinioService, FileSignaturePipe],
  exports: [DocumentsService, MinioService],
})
export class DocumentsModule {}
