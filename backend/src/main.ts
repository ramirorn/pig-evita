// ===========================================
// Application Bootstrap
// ===========================================
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { AppModule } from './app.module';
import { setupSwagger, SWAGGER_PATH } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // La app corre detrás del reverse proxy de nginx (ver docker/nginx/nginx.conf),
  // así que sin esto Express ve siempre la IP del proxy. Con un único salto de
  // confianza, Express toma la última entrada de X-Forwarded-For y `request.ip`
  // pasa a ser la IP real del cliente. Importa por dos motivos:
  //   1) la auditoría (A-06) guardaría la IP del contenedor de nginx y no la del
  //      usuario, volviendo inútil el dato para investigar un incidente;
  //   2) el ThrottlerGuard cuenta requests por IP: sin esto todos los visitantes
  //      comparten un mismo contador y el rate limiting deja de proteger nada.
  // Se usa 1 (y no `true`) a propósito: confiar en toda la cadena permitiría a
  // un cliente falsificar su IP mandando su propio header X-Forwarded-For.
  app.set('trust proxy', 1);

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
