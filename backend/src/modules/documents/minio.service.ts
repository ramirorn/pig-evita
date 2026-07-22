// ===========================================
// MinIO Service
// ===========================================
import { Injectable, Logger, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('minio.bucket') || 'juegos-evita';

    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('minio.endPoint') || 'localhost',
      port: parseInt(this.configService.get<string>('minio.port') || '9000', 10),
      useSSL: this.configService.get<boolean>('minio.useSSL') || false,
      accessKey: this.configService.get<string>('minio.accessKey') || 'minioadmin',
      secretKey: this.configService.get<string>('minio.secretKey') || 'minioadmin',
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket "${this.bucketName}" created in MinIO`);
        
        // Configurar política para que los archivos sean públicos por defecto si se requiere
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Action: ['s3:GetObject'],
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
      }
    } catch (error) {
      this.logger.error(`Error connecting to MinIO: ${error.message}`);
    }
  }

  /**
   * Sube un archivo a MinIO y devuelve la URL del archivo.
   */
  async uploadFile(file: Express.Multer.File, folder: string, filename: string): Promise<string> {
    try {
      const objectName = `${folder}/${Date.now()}-${filename}`;
      
      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype }
      );

      // En este proyecto usamos un bucket público, devolvemos la ruta relativa
      return `/${this.bucketName}/${objectName}`;
    } catch (error) {
      this.logger.error(`Failed to upload file to MinIO: ${error.message}`);
      throw new InternalServerErrorException('Error al subir el archivo');
    }
  }

  /**
   * Obtiene una URL pre-firmada válida por 1 hora.
   * Útil si el bucket es privado.
   */
  async getPresignedUrl(objectName: string, expiryInSeconds = 3600): Promise<string> {
    try {
      // Eliminar el prefijo del bucket si viene en la URL
      let cleanObjectName = objectName;
      if (cleanObjectName.startsWith(`/${this.bucketName}/`)) {
        cleanObjectName = cleanObjectName.replace(`/${this.bucketName}/`, '');
      }

      return await this.minioClient.presignedGetObject(
        this.bucketName,
        cleanObjectName,
        expiryInSeconds
      );
    } catch (error) {
      this.logger.error(`Failed to generate presigned URL: ${error.message}`);
      throw new InternalServerErrorException('Error al generar link del archivo');
    }
  }

  /**
   * Elimina un archivo de MinIO.
   */
  async deleteFile(objectName: string): Promise<void> {
    try {
      let cleanObjectName = objectName;
      if (cleanObjectName.startsWith(`/${this.bucketName}/`)) {
        cleanObjectName = cleanObjectName.replace(`/${this.bucketName}/`, '');
      }
      await this.minioClient.removeObject(this.bucketName, cleanObjectName);
    } catch (error) {
      this.logger.error(`Failed to delete file from MinIO: ${error.message}`);
      throw new InternalServerErrorException('Error al eliminar el archivo');
    }
  }
}
