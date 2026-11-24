// ===========================================
// Competitions Module
// ===========================================
import { Module } from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { CompetitionsController } from './competitions.controller';
import {
  EngineFactory,
  RoundRobinEngine,
  EliminacionDirectaEngine,
  FaseGruposEngine,
} from './engine.factory';

@Module({
  controllers: [CompetitionsController],
  providers: [
    CompetitionsService,
    EngineFactory,
    RoundRobinEngine,
    EliminacionDirectaEngine,
    FaseGruposEngine,
  ],
  exports: [CompetitionsService],
})
export class CompetitionsModule {}
