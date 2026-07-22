// ===========================================
// Competitions Module
// ===========================================
import { Module } from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { CompetitionsController } from './competitions.controller';
import { EngineFactory, RoundRobinEngine } from './engine.factory';

@Module({
  controllers: [CompetitionsController],
  providers: [CompetitionsService, EngineFactory, RoundRobinEngine],
  exports: [CompetitionsService],
})
export class CompetitionsModule {}
