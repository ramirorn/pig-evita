// ===========================================
// Venues Module
// ===========================================
import { Module } from '@nestjs/common';
import { VenuesService } from './venues.service';
import { VenuesController } from './venues.controller';
import { VenueImagesController } from './venue-images.controller';
import { VenueImagesService } from './venue-images.service';
import { ImageUploadInterceptor } from '../images/image-upload.interceptor';
import { DocumentsModule } from '../documents/documents.module';
import { ImageSignaturePipe } from '../images/image-signature.pipe';

@Module({
  // `DocumentsModule` exporta el `MinioService` (una sola instancia, con la
  // verificación de bucket privado ya hecha).
  imports: [DocumentsModule],
  controllers: [VenuesController, VenueImagesController],
  providers: [
    VenuesService,
    VenueImagesService,
    ImageUploadInterceptor,
    ImageSignaturePipe,
  ],
  exports: [VenuesService],
})
export class VenuesModule {}
