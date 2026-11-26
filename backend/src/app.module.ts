// ===========================================
// App Module - Root Module
// ===========================================
import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import {
  TransformInterceptor,
  CacheControlInterceptor,
} from './common/interceptors';
import { RolesGuard } from './common/guards';
import { ScopeModule } from './common/scope';
import {
  CacheModule,
  RedisCacheService,
  RedisThrottlerStorage,
} from './common/cache';

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
import { ZonesModule } from './modules/zones/zones.module';
import { SurveyModule } from './modules/survey/survey.module';
import { StatsModule } from './modules/stats/stats.module';
import { LocalitiesModule } from './modules/localities/localities.module';
import { MetricsModule } from './modules/metrics/metrics.module';

// Auth Guards
import { JwtAuthGuard } from './modules/auth/guards';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { urlParaLog } from './common/logging/url-para-log';

// La función vive en `common/logging` para que el filtro global la use sin
// importar este módulo; se reexporta acá por compatibilidad.
export { urlParaLog };

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

    // Logging (Pino). El entorno sale de ConfigService, validado al arrancar.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const production = config.get<string>('app.nodeEnv') === 'production';
        return {
          // Sintaxis de path-to-regexp v8: el `*` por defecto de nestjs-pino
          // hace que Nest avise "Unsupported route path" al arrancar (O-5).
          forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
          pinoHttp: {
            transport: production
              ? undefined
              : { target: 'pino-pretty', options: { colorize: true } },
            level: production ? 'info' : 'debug',
            // Defensa en profundidad (VULN-25): los serializers de abajo ya
            // dejan afuera headers y body; si alguien loguea un objeto con
            // estas claves, igual salen censuradas.
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                '*.password',
                '*.passwordHash',
                '*.refreshToken',
                '*.accessToken',
                '*.dni',
                '*.email',
                '*.phone',
                '*.address',
              ],
              censor: '[oculto]',
            },
            serializers: {
              req: (req) => ({
                method: req.method,
                url: urlParaLog(req.url),
              }),
              res: (res) => ({
                statusCode: res.statusCode,
              }),
            },
          },
        };
      },
    }),

    // Rate limiting. VULN-22: la cuenta vive en Redis (compartida entre
    // instancias); si Redis no está, el storage cae a memoria. La configuración
    // sale del namespace `throttle`, validado al arrancar.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, RedisCacheService],
      useFactory: (config: ConfigService, cache: RedisCacheService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttl', 60_000),
            limit: config.get<number>('throttle.limit', 100),
          },
        ],
        storage: new RedisThrottlerStorage(cache),
      }),
    }),

    // Database
    DatabaseModule,

    // Alcance territorial (R05): global, igual que DatabaseModule.
    ScopeModule,
    CacheModule,

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
    ZonesModule,
    SurveyModule,
    StatsModule,
    LocalitiesModule,
    MetricsModule,
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
    // Cache-Control en los endpoints marcados con @CacheControl()
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheControlInterceptor,
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
