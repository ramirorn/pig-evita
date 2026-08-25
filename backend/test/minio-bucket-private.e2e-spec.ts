// ===========================================
// E2E — El bucket privado no se da por sentado (R18)
// ===========================================
//
// `ensureBucketIsPrivate()` terminaba en un `catch` que logueaba y seguía. O
// sea que si la llamada que saca la policy pública fallaba —credenciales sin
// permiso de policy, MinIO devolviendo 500— la app arrancaba igual, aceptaba
// subidas de documentos de menores y el bucket podía estar sirviéndolos a
// cualquiera. El endurecimiento de T02 se perdía **justo cuando fallaba**, que
// es el único momento en que importa.
//
// Ahora hay dos desenlaces, y los dos se testean acá:
//
//   1. Sabemos que el bucket puede estar público (había policy y no se pudo
//      sacar, o no se pudo ni leer) → **el arranque falla**. `app.init()` tira.
//   2. MinIO no contesta y el estado es desconocido → la app arranca (no tiene
//      sentido tumbar inscripciones y reportes porque el almacén de archivos
//      esté abajo) pero el módulo queda **deshabilitado y visible en los
//      logs**: cada subida y cada URL firmada responden 503 hasta que la
//      verificación pase.
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger, ServiceUnavailableException } from '@nestjs/common';

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

// El import va después del `jest.mock` a propósito.
import { MinioService } from '../src/modules/documents/minio.service';

const CONFIG: Record<string, unknown> = {
  'minio.endpoint': 'localhost',
  'minio.port': 9000,
  'minio.useSSL': false,
  'minio.accessKey': 'evita-dev-access-key',
  'minio.secretKey': 'K7pQx2vNfR9tLmYw3bZc8Ghd',
  'minio.bucket': 'juegos-evita',
};

const configService = {
  get: jest.fn((key: string) => CONFIG[key]),
} as unknown as ConfigService;

/** La policy pública heredada que T02 vino a sacar. */
const POLICY_PUBLICA = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Action: ['s3:GetObject'],
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Resource: ['arn:aws:s3:::juegos-evita/*'],
    },
  ],
});

const SIN_POLICY = Object.assign(new Error('NoSuchBucketPolicy'), {
  code: 'NoSuchBucketPolicy',
});

const ARCHIVO = {
  buffer: Buffer.from('%PDF-1.4 contenido'),
  size: 18,
  mimetype: 'application/pdf',
  originalname: 'dni.pdf',
} as Express.Multer.File;

/** Levanta un módulo Nest con el MinioService real y corre `init()`. */
async function iniciarModulo() {
  const moduleRef = await Test.createTestingModule({
    providers: [
      MinioService,
      { provide: ConfigService, useValue: configService },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init(); // dispara onModuleInit
  return app;
}

describe('Verificación de bucket privado (R18)', () => {
  let errores: string[];

  beforeEach(() => {
    jest.clearAllMocks();
    errores = [];
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((mensaje: unknown) => {
        errores.push(String(mensaje));
      });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------
  // 1. El caso del DoD: `setBucketPolicy` falla
  // -------------------------------------------------
  describe('setBucketPolicy falla', () => {
    beforeEach(() => {
      mockMinioClient.bucketExists.mockResolvedValue(true);
      mockMinioClient.getBucketPolicy.mockResolvedValue(POLICY_PUBLICA);
      mockMinioClient.setBucketPolicy.mockRejectedValue(
        Object.assign(new Error('Access Denied'), {
          code: 'AccessDenied',
          statusCode: 403,
        }),
      );
    });

    it('el arranque del módulo FALLA', async () => {
      const service = new MinioService(configService);

      await expect(service.onModuleInit()).rejects.toThrow(
        /no se pudo eliminar la policy existente/i,
      );
    });

    it('la app entera no levanta', async () => {
      // `app.init()` propaga lo que tire `onModuleInit`: el proceso muere en el
      // bootstrap en vez de quedar sirviendo con el bucket abierto.
      await expect(iniciarModulo()).rejects.toThrow();
    });

    it('el log dice claramente qué pasó', async () => {
      const service = new MinioService(configService);
      await expect(service.onModuleInit()).rejects.toThrow();

      expect(errores.join('\n')).toMatch(/ARRANQUE ABORTADO/);
      expect(errores.join('\n')).toMatch(/puede estar público/);
    });
  });

  // -------------------------------------------------
  // 2. `getBucketPolicy` que falla por algo que no es "no hay policy"
  // -------------------------------------------------
  it('un AccessDenied al LEER la policy también aborta', async () => {
    // El `catch {}` pelado de antes trataba cualquier error como la buena
    // noticia "el bucket ya es privado". Con credenciales sin permiso de
    // policy, la app daba por verificado algo que no pudo mirar.
    mockMinioClient.bucketExists.mockResolvedValue(true);
    mockMinioClient.getBucketPolicy.mockRejectedValue(
      Object.assign(new Error('Access Denied'), {
        code: 'AccessDenied',
        statusCode: 403,
      }),
    );

    const service = new MinioService(configService);
    await expect(service.onModuleInit()).rejects.toThrow(
      /no se pudo leer la policy/i,
    );
  });

  // -------------------------------------------------
  // 3. Lo que tiene que seguir andando igual (T02)
  // -------------------------------------------------
  describe('camino feliz', () => {
    it('bucket sin policy: arranca y no toca nada', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);
      mockMinioClient.getBucketPolicy.mockRejectedValue(SIN_POLICY);

      const service = new MinioService(configService);
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(mockMinioClient.setBucketPolicy).not.toHaveBeenCalled();
    });

    it('bucket con policy pública: la saca y sigue', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);
      mockMinioClient.getBucketPolicy.mockResolvedValue(POLICY_PUBLICA);
      mockMinioClient.setBucketPolicy.mockResolvedValue(undefined);

      const service = new MinioService(configService);
      await service.onModuleInit();

      expect(mockMinioClient.setBucketPolicy).toHaveBeenCalledWith(
        'juegos-evita',
        '',
      );
    });

    it('verificado el bucket, las subidas funcionan', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);
      mockMinioClient.getBucketPolicy.mockRejectedValue(SIN_POLICY);
      mockMinioClient.putObject.mockResolvedValue(undefined);

      const service = new MinioService(configService);
      await service.onModuleInit();

      await expect(
        service.uploadFile(ARCHIVO, 'participants/p1', 'dni.pdf'),
      ).resolves.toMatch(/^participants\/p1\//);
    });
  });

  // -------------------------------------------------
  // 4. MinIO caído: arranca, pero deshabilitado y a los gritos
  // -------------------------------------------------
  describe('MinIO no responde', () => {
    const caido = Object.assign(new Error('ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });

    beforeEach(() => {
      mockMinioClient.bucketExists.mockRejectedValue(caido);
    });

    it('la app arranca igual (no se cae el sistema entero)', async () => {
      const app = await iniciarModulo();
      await app.close();
    });

    it('pero lo dice en el log, con la palabra DESHABILITADO', async () => {
      const service = new MinioService(configService);
      await service.onModuleInit();

      expect(errores.join('\n')).toMatch(/DESHABILITADO/);
      expect(errores.join('\n')).toMatch(/no se pudo verificar/i);
    });

    it('subir un archivo responde 503, no se guarda nada', async () => {
      const service = new MinioService(configService);
      await service.onModuleInit();

      await expect(
        service.uploadFile(ARCHIVO, 'participants/p1', 'dni.pdf'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      // Lo importante: no llegó a escribir en un bucket que no sabemos si es
      // privado. Antes de R18 esto subía el archivo sin chistar.
      expect(mockMinioClient.putObject).not.toHaveBeenCalled();
    });

    it('pedir una URL firmada también responde 503', async () => {
      const service = new MinioService(configService);
      await service.onModuleInit();

      await expect(
        service.getPresignedUrl('participants/p1/dni.pdf'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(mockMinioClient.presignedGetObject).not.toHaveBeenCalled();
    });

    it('cuando MinIO vuelve, la verificación se reintenta sola', async () => {
      const service = new MinioService(configService);
      await service.onModuleInit();

      // MinIO vuelve.
      mockMinioClient.bucketExists.mockResolvedValue(true);
      mockMinioClient.getBucketPolicy.mockRejectedValue(SIN_POLICY);
      mockMinioClient.putObject.mockResolvedValue(undefined);

      await expect(
        service.uploadFile(ARCHIVO, 'participants/p1', 'dni.pdf'),
      ).resolves.toContain('participants/p1/');
      expect(mockMinioClient.putObject).toHaveBeenCalledTimes(1);
    });

    it('si al volver el bucket resulta público y no se puede cerrar, la subida falla', async () => {
      const service = new MinioService(configService);
      await service.onModuleInit();

      mockMinioClient.bucketExists.mockResolvedValue(true);
      mockMinioClient.getBucketPolicy.mockResolvedValue(POLICY_PUBLICA);
      mockMinioClient.setBucketPolicy.mockRejectedValue(
        new Error('Access Denied'),
      );

      await expect(
        service.uploadFile(ARCHIVO, 'participants/p1', 'dni.pdf'),
      ).rejects.toThrow(/policy/i);
      expect(mockMinioClient.putObject).not.toHaveBeenCalled();
    });
  });
});
