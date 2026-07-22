// ===========================================
// Application Bootstrap
// ===========================================
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Pino as the logger
  app.useLogger(app.get(PinoLogger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const corsOrigins = configService.get<string[]>('app.corsOrigins', ['http://localhost:5173']);

  // Security: Helmet
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // API Prefix
  app.setGlobalPrefix(apiPrefix);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Juegos Evita Formosa - API')
    .setDescription(
      'API REST de la Plataforma Integral de Gestión de los Juegos Evita - Secretaría de Deportes de Formosa',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT de acceso',
      },
      'access-token',
    )
    .addTag('Health', 'Estado del sistema')
    .addTag('Auth', 'Autenticación y autorización')
    .addTag('Users', 'Gestión de usuarios administrativos')
    .addTag('Participants', 'Gestión de participantes')
    .addTag('Inscriptions', 'Inscripciones')
    .addTag('Disciplines', 'Disciplinas deportivas')
    .addTag('Categories', 'Categorías por disciplina')
    .addTag('Teams', 'Equipos')
    .addTag('Documents', 'Documentación')
    .addTag('Competitions', 'Competencias')
    .addTag('Results', 'Resultados y rankings')
    .addTag('Venues', 'Sedes')
    .addTag('News', 'Noticias')
    .addTag('Calendar', 'Calendario')
    .addTag('Reports', 'Reportes')
    .addTag('Audit', 'Auditoría')
    .addTag('Public', 'Endpoints públicos')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Juegos Evita API running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
