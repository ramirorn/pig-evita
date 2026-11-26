// ===========================================
// Survey Module (S20)
// ===========================================
import { Module } from '@nestjs/common';
import { SurveyController } from './survey.controller';
import { SurveyService } from './survey.service';
import { SurveyVersionCache } from './survey-version.cache';

@Module({
  controllers: [SurveyController],
  providers: [SurveyService, SurveyVersionCache],
  exports: [SurveyService, SurveyVersionCache],
})
export class SurveyModule {}
