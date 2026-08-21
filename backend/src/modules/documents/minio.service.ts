// ===========================================
// MinIO Service
// ===========================================
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as Minio from 'minio';
import { assertStrongSecret } from '../../common/security/forbidden-secrets';
import { retryAsync } from '../../common/resilience/retry';

/** Largos mínimos de las credenciales de MinIO. */
const MIN_ACCESS_KEY_LENGTH = 8;
const MIN_SECRET_KEY_LENGTH = 16;

/** Extensiones aceptadas. Cualquier otra cosa se guarda como `.bin`. */
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);
const FALLBACK_EXTENSION = '.bin';

/** Largo máximo del nombre legible que se conserva junto al UUID. */
const MAX_STEM_LENGTH = 60;

/** Ventana de validez de las URLs pre-firmadas (segundos). */
const DEFAULT_PRESIGNED_EXPIRY = 300;
const MIN_PRESIGNED_EXPIRY = 60;
const MAX_PRESIGNED_EXPIRY = 3600;

// -------------------------------------------------
// Política de reintentos (T28)
// -------------------------------------------------

/**
 * Intentos TOTALES por operación: 1 intento + 2 reintentos.
 *
 * Se cuenta el primero adentro del presupuesto a propósito: lo que hay que
 * acotar es el peor caso de latencia que ve el usuario, no la cantidad de veces
 * que insistimos.
 */
const MINIO_MAX_ATTEMPTS = 3;

/** Espera antes del primer reintento. Se duplica en cada vuelta. */
const MINIO_RETRY_BASE_DELAY_MS = 100;

/**
 * Tope de la espera entre intentos. Con base 100 ms y este tope, el peor caso
 * agrega ~300 ms + jitter a un request que igual va a fallar: barato al lado de
 * un blip de red, e imperceptible al lado del timeout del cliente HTTP.
 */
const MINIO_RETRY_MAX_DELAY_MS = 2_000;

/**
 * En el bootstrap el reintento sirve para el arranque en frío de docker-compose
 * (la API levanta antes que MinIO), pero no puede demorar el `listen()`, así que
 * usa un tope de espera más chico que el de las operaciones de request.
 */
const MINIO_BOOTSTRAP_MAX_DELAY_MS = 500;

/**
 * Códigos de error de red que sí conviene reintentar: son cortes puntuales de
 * conexión o de resolución, no configuración mal puesta.
 *
 * Queda afuera `ENOTFOUND` a propósito: un host que no resuelve casi siempre es
 * un `MINIO_ENDPOINT` mal escrito, y reintentarlo sólo esconde el error real.
 */
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
]);

/**
 * Códigos S3 que MinIO devuelve cuando está saturado o reiniciando. Son los
 * únicos que el propio protocolo marca como "volvé a intentar".
 */
const TRANSIENT_S3_CODES = new Set([
  'SlowDown',
  'RequestTimeout',
  'RequestTimeTooSkewed',
  'InternalError',
  'ServiceUnavailable',
  'OperationAborted',
]);

/**
 * Decide si un error de MinIO amerita otro intento.
 *
 * La regla es: reintentar sólo lo que puede resolverse solo. Un `ECONNREFUSED`
 * mientras MinIO reinicia, o un 503 por saturación, se arreglan esperando. Un
 * 403 por credenciales mal puestas, un 404 de objeto inexistente o un
 * `NoSuchBucket` NO: reintentarlos agrega latencia a un error seguro y encima
 * multiplica el ruido en los logs. Por eso la lista es allowlist y no denylist:
 * ante un error desconocido, no reintentamos.
 */
export function isTransientMinioError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidato = error as {
    code?: unknown;
    statusCode?: unknown;
    errno?: unknown;
  };

  const code = typeof candidato.code === 'string' ? candidato.code : undefined;
  if (code && TRANSIENT_NETWORK_CODES.has(code)) {
    return true;
  }
  if (code && TRANSIENT_S3_CODES.has(code)) {
    return true;
  }

  // 5xx = el servidor falló, no el request. 429 = rate limit del propio MinIO.
  // Cualquier otro 4xx es culpa nuestra y no cambia por reintentar.
  const statusCode =
    typeof candidato.statusCode === 'number' ? candidato.statusCode : undefined;
  if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500)) {
    return true;
  }

  return false;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly minioClient: Minio.Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName =
      this.configService.get<string>('minio.bucket') || 'juegos-evita';

    const accessKey = this.configService.get<string>('minio.accessKey');
    const secretKey = this.configService.get<string>('minio.secretKey');

    // Misma lista de defaults prohibidos que usa el schema Zod del arranque
    // (ver common/security/forbidden-secrets.ts). Acá se repite el chequeo
    // porque el ConfigService puede recibir valores por otras vías.
    assertStrongSecret('MINIO_ACCESS_KEY', accessKey, MIN_ACCESS_KEY_LENGTH);
    assertStrongSecret('MINIO_SECRET_KEY', secretKey, MIN_SECRET_KEY_LENGTH);

    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('minio.endpoint') || 'localhost',
      port: this.configService.get<number>('minio.port') ?? 9000,
      useSSL: this.configService.get<boolean>('minio.useSSL') ?? false,
      accessKey: accessKey as string,
      secretKey: secretKey as string,
    });
  }

  async onModuleInit() {
    await this.ensureBucketIsPrivate();
  }

  // -------------------------------------------------
  // Reintentos
  // -------------------------------------------------

  /**
   * Corre una operación de MinIO reintentando sólo fallas transitorias.
   *
   * `operacion` tiene que ser segura de repetir. Todas las que se envuelven acá
   * lo son: `putObject` escribe sobre una clave con UUID que nadie más usa (dos
   * intentos escriben el mismo byte a byte) y `removeObject` es idempotente por
   * definición (borrar algo ya borrado es un no-op en S3).
   */
  private withRetry<T>(
    nombre: string,
    operacion: () => Promise<T>,
    maxDelayMs = MINIO_RETRY_MAX_DELAY_MS,
  ): Promise<T> {
    return retryAsync(() => operacion(), {
      maxAttempts: MINIO_MAX_ATTEMPTS,
      baseDelayMs: MINIO_RETRY_BASE_DELAY_MS,
      maxDelayMs,
      shouldRetry: isTransientMinioError,
      onRetry: (error, attempt, delayMs) => {
        this.logger.warn(
          `MinIO ${nombre}: falla transitoria (intento ${attempt}/${MINIO_MAX_ATTEMPTS}), ` +
            `reintentando en ${delayMs}ms: ${(error as Error).message}`,
        );
      },
    });
  }

  // -------------------------------------------------
  // Bootstrap / configuración del bucket
  // -------------------------------------------------

  /**
   * Crea el bucket si no existe y garantiza que sea PRIVADO.
   *
   * El bucket nace privado en MinIO; acá además se elimina cualquier policy
   * pre-existente (los buckets provisionados por versiones anteriores de este
   * servicio quedaron con `s3:GetObject` abierto a `*`). Todo acceso a objetos
   * debe pasar por `getPresignedUrl()`.
   */
  private async ensureBucketIsPrivate(): Promise<void> {
    try {
      // Se reintenta todo el chequeo como una unidad, con un tope de espera más
      // chico que el de las operaciones de request: el caso que importa es el
      // arranque en frío de docker-compose, donde la API levanta unos cientos de
      // ms antes que MinIO y el primer `bucketExists` se come un ECONNREFUSED.
      // Sin reintento eso dejaba la garantía de bucket privado sin verificar
      // hasta el próximo redeploy (ver T02).
      await this.withRetry(
        'ensureBucketIsPrivate',
        async () => {
          const exists = await this.minioClient.bucketExists(this.bucketName);
          if (!exists) {
            await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
            this.logger.log(`Bucket "${this.bucketName}" created in MinIO`);
          }

          await this.removeBucketPolicy();
        },
        MINIO_BOOTSTRAP_MAX_DELAY_MS,
      );
    } catch (error) {
      // MinIO caído no debe tumbar toda la API, pero sí quedar registrado:
      // hasta que este chequeo corra OK no hay garantía de bucket privado.
      this.logger.error(
        `No se pudo verificar que el bucket "${this.bucketName}" sea privado: ${
          (error as Error).message
        }`,
      );
    }
  }

  /** Elimina cualquier policy del bucket (incluida la pública heredada). */
  private async removeBucketPolicy(): Promise<void> {
    let currentPolicy = '';

    try {
      currentPolicy = await this.minioClient.getBucketPolicy(this.bucketName);
    } catch {
      // `NoSuchBucketPolicy`: el bucket ya es privado.
      return;
    }

    if (!currentPolicy || currentPolicy.trim() === '') {
      return;
    }

    await this.minioClient.setBucketPolicy(this.bucketName, '');
    this.logger.warn(
      `Se eliminó una policy pública pre-existente del bucket "${this.bucketName}". ` +
        'Los objetos ahora sólo son accesibles vía URL pre-firmada.',
    );
  }

  // -------------------------------------------------
  // Sanitizado de nombres
  // -------------------------------------------------

  /**
   * Convierte el nombre subido por el usuario en una clave de objeto segura.
   *
   * - Descarta cualquier componente de ruta (`../../etc/passwd.pdf` → `passwd.pdf`).
   * - Deja sólo `[a-zA-Z0-9_-]` en el nombre legible (sin puntos: matan el traversal).
   * - Antepone un `randomUUID()` para que dos archivos nunca colisionen.
   * - Fuerza la extensión a la lista permitida (o `.bin`).
   */
  private sanitizeFilename(original: string): string {
    const base = (original ?? '').split(/[\\/]/).pop() ?? '';
    const dotIndex = base.lastIndexOf('.');

    const rawExtension = dotIndex > 0 ? base.slice(dotIndex).toLowerCase() : '';
    const extension = ALLOWED_EXTENSIONS.has(rawExtension)
      ? rawExtension
      : FALLBACK_EXTENSION;

    const stem = (dotIndex > 0 ? base.slice(0, dotIndex) : base)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // tildes y diacríticos
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/\./g, '_') // ningún punto sobrevive en el nombre legible
      .replace(/_{2,}/g, '_')
      .replace(/^[-_]+|[-_]+$/g, '')
      .slice(0, MAX_STEM_LENGTH);

    return stem
      ? `${randomUUID()}-${stem}${extension}`
      : `${randomUUID()}${extension}`;
  }

  /** Sanitiza la carpeta destino con el mismo criterio, segmento por segmento. */
  private sanitizeFolder(folder: string): string {
    return (folder ?? '')
      .split(/[\\/]/)
      .map((segment) =>
        segment
          .replace(/[^a-zA-Z0-9_-]+/g, '_')
          .replace(/_{2,}/g, '_')
          .replace(/^[-_]+|[-_]+$/g, ''),
      )
      .filter((segment) => segment.length > 0)
      .join('/');
  }

  /**
   * Construye la clave final del objeto: `<carpeta>/<uuid>-<nombre>.<ext>`.
   * Público para poder testear el sanitizado sin tocar la red.
   */
  buildObjectName(folder: string, filename: string): string {
    const safeFolder = this.sanitizeFolder(folder);
    const safeFilename = this.sanitizeFilename(filename);
    return safeFolder ? `${safeFolder}/${safeFilename}` : safeFilename;
  }

  // -------------------------------------------------
  // Operaciones
  // -------------------------------------------------

  /**
   * Sube un archivo a MinIO y devuelve el `objectName` (clave interna).
   *
   * NO devuelve una URL: el bucket es privado. Para mostrarle el archivo a un
   * usuario, el consumidor debe pedir una URL temporal con `getPresignedUrl()`.
   */
  async uploadFile(
    file: Express.Multer.File,
    folder: string,
    filename: string,
  ): Promise<string> {
    const objectName = this.buildObjectName(folder, filename);

    // El reintento es posible porque `file.buffer` es un Buffer en memoria
    // (multer default = memoryStorage): se puede volver a mandar entero. Si
    // algún día el upload pasa a stream, este retry hay que sacarlo — un stream
    // ya consumido reintentado sube un archivo vacío, que es peor que fallar.
    try {
      await this.withRetry('putObject', () =>
        this.minioClient.putObject(
          this.bucketName,
          objectName,
          file.buffer,
          file.size,
          {
            'Content-Type': file.mimetype,
            // Evita que el navegador renderice inline un archivo malicioso.
            'Content-Disposition': 'attachment',
          },
        ),
      );

      return objectName;
    } catch (error) {
      this.logger.error(
        `Failed to upload file to MinIO: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('Error al subir el archivo');
    }
  }

  /**
   * Obtiene una URL pre-firmada temporal. Única vía de acceso a los objetos.
   *
   * A propósito NO va envuelta en retry: firmar es un cálculo local (HMAC sobre
   * la URL) y no toca la red, así que un fallo acá es determinístico —
   * credenciales mal o clave inválida— y reintentarlo sólo suma latencia.
   * La única salvedad es el lookup de región de la primera llamada del proceso,
   * que sí sale a la red; el cliente lo cachea, y si falla el usuario reintenta
   * a mano con un costo mucho menor que el de un upload perdido.
   */
  async getPresignedUrl(
    objectName: string,
    expiryInSeconds = DEFAULT_PRESIGNED_EXPIRY,
  ): Promise<string> {
    const cleanObjectName = this.normalizeObjectName(objectName);
    const expiry = Math.min(
      Math.max(expiryInSeconds, MIN_PRESIGNED_EXPIRY),
      MAX_PRESIGNED_EXPIRY,
    );

    try {
      return await this.minioClient.presignedGetObject(
        this.bucketName,
        cleanObjectName,
        expiry,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        'Error al generar link del archivo',
      );
    }
  }

  /**
   * Elimina un archivo de MinIO.
   */
  async deleteFile(objectName: string): Promise<void> {
    const cleanObjectName = this.normalizeObjectName(objectName);

    try {
      // Borrar es idempotente en S3: repetirlo no puede romper nada.
      await this.withRetry('removeObject', () =>
        this.minioClient.removeObject(this.bucketName, cleanObjectName),
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete file from MinIO: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException('Error al eliminar el archivo');
    }
  }

  /**
   * Normaliza una clave guardada en base de datos.
   *
   * Acepta el formato histórico `/<bucket>/<objectName>` y rechaza cualquier
   * intento de salir del bucket (`..`, rutas absolutas).
   */
  private normalizeObjectName(objectName: string): string {
    let clean = (objectName ?? '').trim();

    if (clean.startsWith(`/${this.bucketName}/`)) {
      clean = clean.slice(`/${this.bucketName}/`.length);
    }

    clean = clean.replace(/^\/+/, '');

    if (!clean || clean.split('/').some((segment) => segment === '..')) {
      throw new BadRequestException('Referencia de archivo inválida');
    }

    return clean;
  }
}
