// ===========================================
// Inscriptions Module
// ===========================================
import { Module } from '@nestjs/common';
import { InscriptionsController } from './inscriptions.controller';
import { INSCRIPTION_PROVIDERS } from './inscriptions.providers';
import { InscriptionsService } from './inscriptions.service';

@Module({
  controllers: [InscriptionsController],
  providers: [...INSCRIPTION_PROVIDERS],
  exports: [InscriptionsService],
})
export class InscriptionsModule {}
