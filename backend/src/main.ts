// ===========================================
// Application Bootstrap
// ===========================================
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { AppModule } from './app.module';
import { setupSwagger, SWAGGER_PATH } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Pino as the logger
  app.useLogger(app.get(PinoLogger));

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api/v1');
  const corsOrigins = configService.get<string[]>('app.corsOrigins', [
    'http://localhost:5173',
  ]);

  // Security: Helmet
  app.use(helmet());

  // Cookies: el refresh token viaja en una cookie httpOnly (ver auth.cookies.ts)
  app.use(cookieParser());

  // Compresión gzip/deflate de las respuestas. Los JSON de listados son texto
  // muy repetitivo: comprime ~60-70%.
  app.use(compression());

  // CORS
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    // Imprescindible para que el navegador mande la cookie del refresh token.
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

  // Swagger / OpenAPI (se omite en producción, ver swagger.ts)
  const swaggerHabilitado = setupSwagger(app, nodeEnv);

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(
    `🚀 Juegos Evita API running on: http://localhost:${port}/${apiPrefix}`,
  );
  if (swaggerHabilitado) {
    logger.log(`📚 Swagger docs: http://localhost:${port}/${SWAGGER_PATH}`);
  }
}

void bootstrap();
