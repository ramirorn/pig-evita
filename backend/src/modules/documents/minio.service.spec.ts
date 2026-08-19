// ===========================================
// MinioService — hardening (C-02 bucket público / C-04 path traversal)
// ===========================================
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { MinioService } from './minio.service';

const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  getBucketPolicy: jest.fn(),
  setBucketPolicy: jest.fn(),
  putObject: jest.fn(),
  presignedGetObject: jest.fn(),
  removeObject: jest.fn(),
};

jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => mockMinioClient),
}));

const VALID_CONFIG: Record<string, unknown> = {
  'minio.endpoint': 'localhost',
  'minio.port': 9000,
  'minio.useSSL': false,
  'minio.accessKey': 'evita-dev-access-key',
  'minio.secretKey': 'un-secreto-largo-y-random',
  'minio.bucket': 'juegos-evita',
};

function buildConfigService(overrides: Record<string, unknown> = {}) {
  const values = { ...VALID_CONFIG, ...overrides };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

/** UUID v4 + guion, tal como lo antepone el sanitizador. */
const UUID_PREFIX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MinioService(buildConfigService());
  });

  // -------------------------------------------------
  // C-02 — credenciales por defecto
  // -------------------------------------------------
  describe('validación de credenciales en el constructor', () => {
    it('rechaza el default "minioadmin" en el access key', () => {
      expect(
        () => new MinioService(buildConfigService({ 'minio.accessKey': 'minioadmin' })),
      ).toThrow(/MINIO_ACCESS_KEY/);
    });

    it('rechaza el default "minioadmin" en el secret key', () => {
      expect(
        () => new MinioService(buildConfigService({ 'minio.secretKey': 'minioadmin' })),
      ).toThrow(/MINIO_SECRET_KEY/);
    });

    it('rechaza credenciales vacías', () => {
      expect(
        () => new MinioService(buildConfigService({ 'minio.secretKey': '   ' })),
      ).toThrow(/no está definida/);
    });

    it('rechaza credenciales demasiado cortas', () => {
      expect(
        () => new MinioService(buildConfigService({ 'minio.accessKey': 'abc123' })),
      ).toThrow(/al menos 8 caracteres/);
    });

    it('acepta credenciales propias', () => {
      expect(() => new MinioService(buildConfigService())).not.toThrow();
    });
  });

  // -------------------------------------------------
  // C-02 — bucket privado
  // -------------------------------------------------
  describe('ensureBucketIsPrivate (onModuleInit)', () => {
    it('crea el bucket sin aplicarle ninguna policy pública', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);
      mockMinioClient.getBucketPolicy.mockRejectedValue(
        new Error('NoSuchBucketPolicy'),
      );

      await service.onModuleInit();

      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith(
        'juegos-evita',
        'us-east-1',
      );
      expect(mockMinioClient.setBucketPolicy).not.toHaveBeenCalled();
    });

    it('elimina una policy pública pre-existente', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);
      mockMinioClient.getBucketPolicy.mockResolvedValue(
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Action: ['s3:GetObject'],
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Resource: ['arn:aws:s3:::juegos-evita/*'],
            },
          ],
        }),
      );
      mockMinioClient.setBucketPolicy.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockMinioClient.setBucketPolicy).toHaveBeenCalledWith(
        'juegos-evita',
        '',
      );
    });

    it('no tumba la app si MinIO no responde', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------
  // C-04 — path traversal en el filename
  // -------------------------------------------------
  describe('sanitizado del nombre de archivo', () => {
    it('neutraliza un intento de path traversal', () => {
      const objectName = service.buildObjectName(
        'participants/9f1c2b7e',
        '../../etc/passwd.pdf',
      );

      expect(objectName).not.toContain('..');
      expect(objectName.startsWith('participants/9f1c2b7e/')).toBe(true);

      const filename = objectName.split('/').pop() as string;
      expect(filename).toMatch(UUID_PREFIX);
      expect(filename.endsWith('-passwd.pdf')).toBe(true);
      // La ruta final tiene exactamente 3 segmentos: carpeta/carpeta/archivo.
      expect(objectName.split('/')).toHaveLength(3);
    });

    it('descarta rutas absolutas y separadores de Windows', () => {
      const objectName = service.buildObjectName(
        'participants',
        'C:\\Windows\\System32\\config.png',
      );

      expect(objectName).not.toContain('\\');
      expect(objectName.split('/')).toHaveLength(2);
      expect(objectName.endsWith('-config.png')).toBe(true);
    });

    it('reemplaza caracteres peligrosos y colapsa los puntos', () => {
      const objectName = service.buildObjectName(
        'participants',
        'foto<script>.perfil.jpg',
      );

      const filename = objectName.split('/').pop() as string;
      expect(filename).not.toMatch(/[<>]/);
      // Sólo sobrevive el punto de la extensión.
      expect(filename.split('.')).toHaveLength(2);
      expect(filename.endsWith('.jpg')).toBe(true);
    });

    it('fuerza la extensión a la lista permitida', () => {
      const objectName = service.buildObjectName('participants', 'shell.php');
      expect(objectName.endsWith('.bin')).toBe(true);
    });

    it('sigue devolviendo una clave válida si el nombre queda vacío', () => {
      const objectName = service.buildObjectName('participants', '../../');
      const filename = objectName.split('/').pop() as string;

      expect(objectName).not.toContain('..');
      expect(filename).toMatch(UUID_PREFIX);
    });

    it('genera claves distintas para el mismo nombre', () => {
      const a = service.buildObjectName('participants', 'dni.pdf');
      const b = service.buildObjectName('participants', 'dni.pdf');
      expect(a).not.toEqual(b);
    });

    it('normaliza acentos sin romper el nombre', () => {
      const objectName = service.buildObjectName(
        'participants',
        'certificación médica.pdf',
      );
      expect(objectName.endsWith('-certificacion_medica.pdf')).toBe(true);
    });
  });

  // -------------------------------------------------
  // uploadFile devuelve objectName, no una URL pública
  // -------------------------------------------------
  describe('uploadFile', () => {
    const file = {
      buffer: Buffer.from('contenido'),
      size: 9,
      mimetype: 'application/pdf',
      originalname: '../../etc/passwd.pdf',
    } as Express.Multer.File;

    it('devuelve el objectName sanitizado (sin prefijo de bucket)', async () => {
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const result = await service.uploadFile(file, 'participants/abc', file.originalname);

      expect(result.startsWith('/juegos-evita/')).toBe(false);
      expect(result.startsWith('participants/abc/')).toBe(true);
      expect(result).not.toContain('..');

      const [bucket, objectName] = mockMinioClient.putObject.mock.calls[0];
      expect(bucket).toBe('juegos-evita');
      expect(objectName).toBe(result);
    });

    it('guarda el objeto como adjunto para que el navegador no lo renderice', async () => {
      mockMinioClient.putObject.mockResolvedValue(undefined);

      await service.uploadFile(file, 'participants/abc', file.originalname);

      const metadata = mockMinioClient.putObject.mock.calls[0][4];
      expect(metadata['Content-Disposition']).toBe('attachment');
    });
  });

  // -------------------------------------------------
  // Acceso a objetos: sólo vía URL pre-firmada
  // -------------------------------------------------
  describe('getPresignedUrl', () => {
    beforeEach(() => {
      mockMinioClient.presignedGetObject.mockResolvedValue('https://signed.url');
    });

    it('acepta el formato histórico "/bucket/objectName"', async () => {
      await service.getPresignedUrl('/juegos-evita/participants/abc/file.pdf');

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'juegos-evita',
        'participants/abc/file.pdf',
        300,
      );
    });

    it('acota la expiración al máximo permitido', async () => {
      await service.getPresignedUrl('participants/abc/file.pdf', 999_999);

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledWith(
        'juegos-evita',
        'participants/abc/file.pdf',
        3600,
      );
    });

    it('rechaza claves con path traversal', async () => {
      await expect(
        service.getPresignedUrl('participants/../../etc/passwd'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockMinioClient.presignedGetObject).not.toHaveBeenCalled();
    });
  });

  describe('deleteFile', () => {
    it('rechaza claves con path traversal', async () => {
      await expect(service.deleteFile('../secrets')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mockMinioClient.removeObject).not.toHaveBeenCalled();
    });
  });
});
