// ===========================================
// News Module
// ===========================================
import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { NewsSyncController } from './sync/news-sync.controller';
import { NewsSyncService } from './sync/news-sync.service';
import { NewsSyncScheduler } from './sync/news-sync.scheduler';
import { FormosaPortalClient } from './sync/formosa-portal.client';
import { NewsImagesController } from './news-images.controller';
import { NewsImagesService } from './news-images.service';
import { DocumentsModule } from '../documents/documents.module';
import { ImageUploadInterceptor } from '../images/image-upload.interceptor';
import { ImageSignaturePipe } from '../images/image-signature.pipe';

@Module({
  // `DocumentsModule` exporta el `MinioService` (una sola instancia, con la
  // verificación de bucket privado ya hecha): imagen subida de la noticia.
  imports: [DocumentsModule],
  controllers: [NewsController, NewsImagesController, NewsSyncController],
  // S19 — el sync vive adentro del módulo de noticias porque escribe sobre
  // `News` y comparte sus reglas: una nota externa es una noticia más para el
  // listado público, con la diferencia de que enlaza afuera y no se edita.
  providers: [
    NewsService,
    NewsImagesService,
    ImageUploadInterceptor,
    ImageSignaturePipe,
    NewsSyncService,
    NewsSyncScheduler,
    FormosaPortalClient,
  ],
  exports: [NewsService, NewsSyncService],
})
export class NewsModule {}
