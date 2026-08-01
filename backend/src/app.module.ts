// ===========================================
// App Module - Root Module
// ===========================================
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

// Config
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  redisConfig,
  minioConfig,
  throttleConfig,
} from './config';
import { validateEnv } from './config/config.validation';

// Database
import { DatabaseModule } from './database/database.module';

// Common
import { GlobalExceptionFilter } from './common/filters';
import { TransformInterceptor } from './common/interceptors';
import { RolesGuard } from './common/guards';

// Feature Modules
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ParticipantsModule } from './modules/participants/participants.module';
import { InscriptionsModule } from './modules/inscriptions/inscriptions.module';
import { AuditModule } from './modules/audit/audit.module';
import { DisciplinesModule } from './modules/disciplines/disciplines.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TeamsModule } from './modules/teams/teams.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { VenuesModule } from './modules/venues/venues.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { ResultsModule } from './modules/results/results.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NewsModule } from './modules/news/news.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

// Auth Guards
import { JwtAuthGuard } from './modules/auth/guards';
import { AuditInterceptor } from './modules/audit/audit.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        redisConfig,
        minioConfig,
        throttleConfig,
      ],
      validate: validateEnv,
    }),

    // Logging (Pino)
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
      },
    ]),

    // Database
    DatabaseModule,

    // Feature Modules
    HealthModule,
    AuthModule,
    UsersModule,
    ParticipantsModule,
    InscriptionsModule,
    AuditModule,
    DisciplinesModule,
    CategoriesModule,
    TeamsModule,
    DocumentsModule,
    VenuesModule,
    CompetitionsModule,
    ResultsModule,
    ReportsModule,
    NewsModule,
    CalendarModule,
    DashboardModule,
  ],
  providers: [
    // Global Exception Filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Global Response Transform
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    // Global Audit Interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    // Global JWT Auth Guard (all routes require JWT unless @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Roles Guard (checks @Roles() decorator)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Global Rate Limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
