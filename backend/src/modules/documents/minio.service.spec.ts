// ===========================================
// MinioService — hardening (C-02 bucket público / C-04 path traversal)
// ===========================================
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { MinioService, isTransientMinioError } from './minio.service';

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
  'minio.secretKey': 'K7pQx2vNfR9tLmYw3bZc8Ghd',
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
        () => new MinioService(buildConfigService({ 'minio.accessKey': 'abc12' })),
      ).toThrow(/al menos 8 caracteres/);
    });

    it('rechaza un secret key que contenga la palabra "secret"', () => {
      expect(
        () =>
          new MinioService(
            buildConfigService({ 'minio.secretKey': 'un-secreto-largo-y-random' }),
          ),
      ).toThrow(/valor por defecto/);
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

  // -------------------------------------------------
  // T28 — retry con backoff acotado sobre fallas transitorias
  // -------------------------------------------------
  describe('clasificación de errores transitorios', () => {
    it('considera transitorios los cortes de conexión', () => {
      expect(isTransientMinioError({ code: 'ECONNREFUSED' })).toBe(true);
      expect(isTransientMinioError({ code: 'ECONNRESET' })).toBe(true);
      expect(isTransientMinioError({ code: 'ETIMEDOUT' })).toBe(true);
    });

    it('considera transitorios los 5xx y el 429 de MinIO', () => {
      expect(isTransientMinioError({ statusCode: 503 })).toBe(true);
      expect(isTransientMinioError({ statusCode: 500 })).toBe(true);
      expect(isTransientMinioError({ statusCode: 429 })).toBe(true);
      expect(isTransientMinioError({ code: 'SlowDown' })).toBe(true);
    });

    it('NO considera transitorios los errores permanentes', () => {
      // Credenciales mal puestas, objeto/bucket inexistente: reintentar no los
      // arregla, sólo agrega latencia a una falla segura.
      expect(
        isTransientMinioError({ statusCode: 403, code: 'AccessDenied' }),
      ).toBe(false);
      expect(
        isTransientMinioError({ statusCode: 404, code: 'NoSuchKey' }),
      ).toBe(false);
      expect(isTransientMinioError({ code: 'NoSuchBucket' })).toBe(false);
      expect(isTransientMinioError({ code: 'InvalidAccessKeyId' })).toBe(false);
      expect(isTransientMinioError({ code: 'SignatureDoesNotMatch' })).toBe(
        false,
      );
      expect(isTransientMinioError(new Error('boom'))).toBe(false);
      expect(isTransientMinioError(undefined)).toBe(false);
    });
  });

  describe('retry en uploadFile', () => {
    const file = {
      buffer: Buffer.from('contenido'),
      size: 9,
      mimetype: 'application/pdf',
      originalname: 'dni.pdf',
    } as Express.Multer.File;

    /** Error con la forma de los que tira el cliente de minio. */
    function errorConCodigo(code: string, statusCode?: number) {
      return Object.assign(new Error(code), { code, statusCode });
    }

    it('se recupera de un fallo transitorio y termina subiendo', async () => {
      mockMinioClient.putObject
        .mockRejectedValueOnce(errorConCodigo('ECONNREFUSED'))
        .mockResolvedValueOnce(undefined);

      const objectName = await service.uploadFile(
        file,
        'participants',
        file.originalname,
      );

      expect(objectName).toMatch(/^participants\//);
      expect(mockMinioClient.putObject).toHaveBeenCalledTimes(2);
    });

    it('reintenta sobre la MISMA clave y el mismo buffer', async () => {
      // Si cada intento generara una clave nueva, un retry que "falló" pero el
      // servidor sí escribió dejaría objetos huérfanos en el bucket.
      mockMinioClient.putObject
        .mockRejectedValueOnce(errorConCodigo('ECONNRESET'))
        .mockResolvedValueOnce(undefined);

      await service.uploadFile(file, 'participants', file.originalname);

      const [primero, segundo] = mockMinioClient.putObject.mock.calls;
      expect(segundo[1]).toBe(primero[1]);
      expect(segundo[2]).toBe(file.buffer);
      expect(segundo[3]).toBe(file.size);
    });

    it('agota como máximo 3 intentos si la falla transitoria persiste', async () => {
      mockMinioClient.putObject.mockRejectedValue(
        errorConCodigo('ECONNREFUSED'),
      );

      await expect(
        service.uploadFile(file, 'participants', file.originalname),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(mockMinioClient.putObject).toHaveBeenCalledTimes(3);
    });

    it('NO reintenta un error permanente: falla en el primer intento', async () => {
      mockMinioClient.putObject.mockRejectedValue(
        errorConCodigo('AccessDenied', 403),
      );

      await expect(
        service.uploadFile(file, 'participants', file.originalname),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(mockMinioClient.putObject).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry en deleteFile', () => {
    function errorConStatus(statusCode: number, code?: string) {
      return Object.assign(new Error(String(statusCode)), { statusCode, code });
    }

    it('se recupera de un 503 transitorio', async () => {
      mockMinioClient.removeObject
        .mockRejectedValueOnce(errorConStatus(503, 'ServiceUnavailable'))
        .mockResolvedValueOnce(undefined);

      await expect(
        service.deleteFile('participants/abc/file.pdf'),
      ).resolves.toBeUndefined();

      expect(mockMinioClient.removeObject).toHaveBeenCalledTimes(2);
    });

    it('NO reintenta un 404 de objeto inexistente', async () => {
      mockMinioClient.removeObject.mockRejectedValue(
        errorConStatus(404, 'NoSuchKey'),
      );

      await expect(
        service.deleteFile('participants/abc/file.pdf'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(mockMinioClient.removeObject).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPresignedUrl no se reintenta', () => {
    it('falla al primer intento: firmar es un cálculo local, no I/O', async () => {
      mockMinioClient.presignedGetObject.mockRejectedValue(
        Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
      );

      await expect(
        service.getPresignedUrl('participants/abc/file.pdf'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(mockMinioClient.presignedGetObject).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry en el bootstrap del bucket', () => {
    it('reintenta el chequeo cuando MinIO todavía no levantó', async () => {
      // Caso típico de docker-compose: la API arranca antes que MinIO.
      mockMinioClient.bucketExists
        .mockRejectedValueOnce(
          Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
        )
        .mockResolvedValueOnce(true);
      mockMinioClient.getBucketPolicy.mockRejectedValue(
        new Error('NoSuchBucketPolicy'),
      );

      await service.onModuleInit();

      expect(mockMinioClient.bucketExists).toHaveBeenCalledTimes(2);
    });

    it('sigue sin tumbar la app si MinIO nunca responde (T02)', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(
        Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
      );

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(mockMinioClient.bucketExists).toHaveBeenCalledTimes(3);
    });
  });
});
