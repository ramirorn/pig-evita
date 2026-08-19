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

/**
 * Credenciales que nunca deben llegar a un entorno real. Se validan en el
 * constructor: si aparecen, la aplicación no arranca (fail fast en bootstrap).
 */
const FORBIDDEN_CREDENTIALS = new Set([
  'minioadmin',
  'minio',
  'admin',
  'root',
  'password',
  'secret',
  'changeme',
  'change-me',
  'test',
]);

const MIN_CREDENTIAL_LENGTH = 8;

/** Extensiones aceptadas. Cualquier otra cosa se guarda como `.bin`. */
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);
const FALLBACK_EXTENSION = '.bin';

/** Largo máximo del nombre legible que se conserva junto al UUID. */
const MAX_STEM_LENGTH = 60;

/** Ventana de validez de las URLs pre-firmadas (segundos). */
const DEFAULT_PRESIGNED_EXPIRY = 300;
const MIN_PRESIGNED_EXPIRY = 60;
const MAX_PRESIGNED_EXPIRY = 3600;

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

    this.assertStrongCredential('MINIO_ACCESS_KEY', accessKey);
    this.assertStrongCredential('MINIO_SECRET_KEY', secretKey);

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
  // Bootstrap / configuración del bucket
  // -------------------------------------------------

  /**
   * Rechaza credenciales vacías, cortas o de la lista de defaults conocidos.
   * Se ejecuta en el constructor para que un despliegue mal configurado falle
   * al arrancar y no en el primer upload.
   */
  private assertStrongCredential(envVar: string, value?: string): void {
    const trimmed = (value ?? '').trim();

    if (!trimmed) {
      throw new Error(
        `❌ ${envVar} no está definida. Generá una credencial dedicada para MinIO.`,
      );
    }

    if (FORBIDDEN_CREDENTIALS.has(trimmed.toLowerCase())) {
      throw new Error(
        `❌ ${envVar} usa una credencial por defecto ("${trimmed}"). ` +
          'Generá una credencial propia antes de levantar la aplicación.',
      );
    }

    if (trimmed.length < MIN_CREDENTIAL_LENGTH) {
      throw new Error(
        `❌ ${envVar} debe tener al menos ${MIN_CREDENTIAL_LENGTH} caracteres.`,
      );
    }
  }

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
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket "${this.bucketName}" created in MinIO`);
      }

      await this.removeBucketPolicy();
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

    try {
      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
          // Evita que el navegador renderice inline un archivo malicioso.
          'Content-Disposition': 'attachment',
        },
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
      await this.minioClient.removeObject(this.bucketName, cleanObjectName);
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
