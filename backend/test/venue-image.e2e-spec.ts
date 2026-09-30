// ===========================================
// E2E — Foto principal de la sede
// ===========================================
//
// Contrato:
//   · POST   /venues/:id/image  (VENUE_MANAGE) multipart `file`, JPG/PNG/WebP
//            ≤ 5 MB validado por firma → 201 con la sede (imageUrl).
//   · DELETE /venues/:id/image  (VENUE_MANAGE) → 200 con la sede (imageUrl null).
//   · GET    /venues/:id/image  (público) → bytes + Content-Type +
//            Cache-Control immutable + nosniff; 404 sin foto.
//   · Todas las respuestas de sedes llevan `imageUrl` y nunca `imageKey`.
//
// MinIO se mockea en memoria (como en los specs de documentos); la auth es la
// real (JwtStrategy + JwtAuthGuard + RolesGuard) para medir 401 y 403.
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Readable } from 'node:stream';
import request from 'supertest';
import { App } from 'supertest/types';

import { VenuesController } from '../src/modules/venues/venues.controller';
import { VenuesService } from '../src/modules/venues/venues.service';
import { VenueImagesController } from '../src/modules/venues/venue-images.controller';
import { VenueImagesService } from '../src/modules/venues/venue-images.service';
import { VenueImageUploadInterceptor } from '../src/modules/venues/venue-image-upload.interceptor';
import { FileSignaturePipe } from '../src/modules/documents/file-signature.pipe';
import { ImageSignaturePipe } from '../src/modules/venues/image-signature.pipe';
import { MinioService } from '../src/modules/documents/minio.service';
import { PrismaService } from '../src/database/prisma.service';
import { JwtStrategy } from '../src/modules/auth/strategies';
import { JwtAuthGuard } from '../src/modules/auth/guards';
import { RolesGuard } from '../src/common/guards';
import {
  TransformInterceptor,
  CacheControlInterceptor,
} from '../src/common/interceptors';
import { AUDIT_KEY } from '../src/common/decorators';
import { AuditAction, Role } from '../src/common/constants';

const ACCESS_SECRET = 'test-access-secret-de-mas-de-32-caracteres';
const CONFIG: Record<string, unknown> = {
  'app.nodeEnv': 'test',
  'jwt.accessSecret': ACCESS_SECRET,
};

const SEDE_ID = '11111111-1111-4111-8111-111111111111';
const OTRA_SEDE_ID = '22222222-2222-4222-8222-222222222222';
const SEDE_INEXISTENTE = '99999999-9999-4999-8999-999999999999';

// -------------------------------------------------
// Archivos de prueba (firmas reales)
// -------------------------------------------------
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from(' JFIF ', 'binary'),
  Buffer.alloc(32, 1),
]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
  Buffer.alloc(32, 2),
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(32, 3),
]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 0x90)]);
/** WAV: mismo contenedor RIFF que WebP, pero no es una imagen. */
const WAV = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WAVEfmt '),
  Buffer.alloc(32),
]);

type Fila = {
  id: string;
  name: string;
  address: string;
  department: string;
  locality: string;
  isActive: boolean;
  imageKey: string | null;
};

describe('Foto de sede (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let sedes: Map<string, Fila>;
  let objetos: Map<string, Buffer>;
  let minio: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
    getObjectStream: jest.Mock;
  };

  const sede = (id: string, name: string): Fila => ({
    id,
    name,
    address: 'Av. Siempre Viva 123',
    department: 'Formosa',
    locality: 'Formosa',
    isActive: true,
    imageKey: null,
  });

  /** Aplica `select`/`include` lo justo para lo que usan los services. */
  const proyectar = (
    fila: Fila | undefined,
    args: { select?: Record<string, boolean>; include?: unknown },
  ) => {
    if (!fila) return null;
    if (args.select) {
      return Object.fromEntries(
        Object.keys(args.select).map((k) => [k, fila[k as keyof Fila]]),
      );
    }
    return args.include ? { ...fila, _count: { matches: 0 } } : { ...fila };
  };

  beforeEach(async () => {
    sedes = new Map([
      [SEDE_ID, sede(SEDE_ID, 'Polideportivo Municipal')],
      [OTRA_SEDE_ID, sede(OTRA_SEDE_ID, 'Estadio Centenario')],
    ]);
    objetos = new Map();
    let contador = 0;

    minio = {
      uploadFile: jest.fn(
        (file: Express.Multer.File, folder: string, filename: string) => {
          contador += 1;
          const clave = `${folder}/0000000${contador}-uuid-${filename}`;
          objetos.set(clave, file.buffer);
          return Promise.resolve(clave);
        },
      ),
      deleteFile: jest.fn((clave: string) => {
        objetos.delete(clave);
        return Promise.resolve();
      }),
      getObjectStream: jest.fn((clave: string) => {
        const bytes = objetos.get(clave);
        return Promise.resolve(bytes ? Readable.from([bytes]) : null);
      }),
    };

    const prisma = {
      venue: {
        findUnique: jest.fn(
          (args: {
            where: { id: string };
            select?: Record<string, boolean>;
            include?: unknown;
          }) => Promise.resolve(proyectar(sedes.get(args.where.id), args)),
        ),
        findMany: jest.fn(() =>
          Promise.resolve([...sedes.values()].map((f) => ({ ...f }))),
        ),
        count: jest.fn(() => Promise.resolve(sedes.size)),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: string; imageKey: string | null };
            data: Partial<Fila>;
          }) => {
            const fila = sedes.get(where.id);
            if (!fila || fila.imageKey !== where.imageKey) {
              return Promise.resolve({ count: 0 });
            }
            Object.assign(fila, data);
            return Promise.resolve({ count: 1 });
          },
        ),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [VenuesController, VenueImagesController],
      providers: [
        VenuesService,
        VenueImagesService,
        VenueImageUploadInterceptor,
        ImageSignaturePipe,
        JwtStrategy,
        { provide: MinioService, useValue: minio },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => CONFIG[key]) },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        // Los dos interceptores globales que tocan la respuesta: el GET de la
        // imagen tiene que salir como bytes, no envuelto en `{ success, data }`.
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    jwt = moduleFixture.get(JwtService);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const tokenDe = (role: Role) =>
    jwt.sign({
      sub: '44444444-4444-4444-8444-444444444444',
      email: `${role.toLowerCase()}@juegosevita.gob.ar`,
      role,
      department: null,
      zone: null,
      type: 'access',
    });

  const ADMIN = () => `Bearer ${tokenDe(Role.ADMIN_PROVINCIAL)}`;

  const subir = (
    contenido: Buffer,
    nombre: string,
    contentType = 'image/jpeg',
    id = SEDE_ID,
    auth: string | null = ADMIN(),
  ) => {
    const req = request(app.getHttpServer()).post(`/venues/${id}/image`);
    if (auth) req.set('Authorization', auth);
    return req.attach('file', contenido, { filename: nombre, contentType });
  };

  /** Pide la imagen como binario (supertest no parsea `image/*`). */
  const pedirImagen = (url: string) =>
    request(app.getHttpServer())
      .get(url.replace(/^\/api\/v1/, ''))
      .buffer(true)
      .parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () => cb(null, Buffer.concat(partes)));
      });

  // -------------------------------------------------
  // Subida
  // -------------------------------------------------
  it.each([
    ['JPG', JPEG, 'cancha.jpg', 'image/jpeg', /\.jpg$/],
    ['JPEG (.jpeg)', JPEG, 'cancha.JPEG', 'image/jpeg', /\.jpg$/],
    ['PNG', PNG, 'cancha.png', 'image/png', /\.png$/],
    ['WebP', WEBP, 'cancha.webp', 'image/webp', /\.webp$/],
  ])(
    'sube un %s y devuelve la sede con imageUrl',
    async (_n, buffer, nombre, tipo, extension) => {
      const res = await subir(buffer, nombre, tipo).expect(201);

      const venue = res.body.data;
      expect(venue.id).toBe(SEDE_ID);
      expect(venue.imageUrl).toMatch(
        new RegExp(`^/api/v1/venues/${SEDE_ID}/image\\?v=[0-9a-f]{12}$`),
      );
      expect(venue).not.toHaveProperty('imageKey');

      // La clave la arma el backend: carpeta de la sede y nombre fijo con la
      // extensión del tipo DETECTADO. El nombre del usuario no aparece.
      const [archivo, carpeta, nombreGuardado] = minio.uploadFile.mock
        .calls[0] as [Express.Multer.File, string, string];
      expect(carpeta).toBe(`venues/${SEDE_ID}`);
      expect(nombreGuardado).toMatch(/^foto\.(jpg|png|webp)$/);
      expect(nombreGuardado).toMatch(extension);
      expect(nombreGuardado).not.toContain('cancha');
      expect(archivo.mimetype).toBe(tipo);
      expect(sedes.get(SEDE_ID)?.imageKey).toMatch(/^venues\//);
    },
  );

  it('rechaza con 422 una imagen de más de 5 MB (lo corta multer)', async () => {
    const grande = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await subir(grande, 'enorme.jpg').expect(422);

    expect(res.body.message).toMatch(/5 MB/);
    expect(minio.uploadFile).not.toHaveBeenCalled();
  });

  it('acepta una imagen de exactamente 5 MB', async () => {
    const justa = Buffer.concat([
      JPEG,
      Buffer.alloc(5 * 1024 * 1024 - JPEG.length),
    ]);
    await subir(justa, 'justa.jpg').expect(201);
  });

  it.each([
    ['un ejecutable renombrado .jpg', EXE, 'foto.jpg', 'image/jpeg'],
    ['un PDF renombrado .png', PDF, 'foto.png', 'image/png'],
    ['un PDF con su extensión', PDF, 'foto.pdf', 'application/pdf'],
    ['un WAV (RIFF) renombrado .webp', WAV, 'foto.webp', 'image/webp'],
    ['un PNG renombrado .jpg', PNG, 'foto.jpg', 'image/jpeg'],
    ['un JPEG con extensión .gif', JPEG, 'foto.gif', 'image/gif'],
    ['un archivo vacío', Buffer.alloc(0), 'foto.jpg', 'image/jpeg'],
  ])('rechaza con 400 %s', async (_n, buffer, nombre, tipo) => {
    await subir(buffer, nombre, tipo).expect(400);
    expect(minio.uploadFile).not.toHaveBeenCalled();
  });

  it('sin archivo responde 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/venues/${SEDE_ID}/image`)
      .set('Authorization', ADMIN())
      .expect(400);
    expect(res.body.message).toMatch(/No se adjuntó ningún archivo/);
  });

  it('sede inexistente responde 404 y no deja objetos en el bucket', async () => {
    const res = await subir(JPEG, 'foto.jpg', 'image/jpeg', SEDE_INEXISTENTE);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Sede no encontrada');
    expect(objetos.size).toBe(0);
  });

  it('sin sesión responde 401', async () => {
    await subir(JPEG, 'foto.jpg', 'image/jpeg', SEDE_ID, null).expect(401);
    expect(minio.uploadFile).not.toHaveBeenCalled();
  });

  it.each([Role.COORDINADOR, Role.DELEGADO])(
    '%s (sin VENUE_MANAGE) responde 403 en POST y DELETE',
    async (role) => {
      const auth = `Bearer ${tokenDe(role)}`;
      await subir(JPEG, 'foto.jpg', 'image/jpeg', SEDE_ID, auth).expect(403);
      await request(app.getHttpServer())
        .delete(`/venues/${SEDE_ID}/image`)
        .set('Authorization', auth)
        .expect(403);
      expect(minio.uploadFile).not.toHaveBeenCalled();
      expect(minio.deleteFile).not.toHaveBeenCalled();
    },
  );

  // -------------------------------------------------
  // Reemplazo y borrado
  // -------------------------------------------------
  it('reemplazar borra el objeto viejo y cambia la versión de la URL', async () => {
    const primera = await subir(JPEG, 'a.jpg').expect(201);
    const claveVieja = sedes.get(SEDE_ID)?.imageKey as string;

    const segunda = await subir(PNG, 'b.png', 'image/png').expect(201);
    const claveNueva = sedes.get(SEDE_ID)?.imageKey as string;

    expect(claveNueva).not.toBe(claveVieja);
    expect(minio.deleteFile).toHaveBeenCalledWith(claveVieja);
    expect(objetos.has(claveVieja)).toBe(false);
    expect(objetos.has(claveNueva)).toBe(true);
    expect(segunda.body.data.imageUrl).not.toBe(primera.body.data.imageUrl);
  });

  it('DELETE borra el objeto y deja imageUrl en null', async () => {
    await subir(JPEG, 'a.jpg').expect(201);
    const clave = sedes.get(SEDE_ID)?.imageKey as string;

    const res = await request(app.getHttpServer())
      .delete(`/venues/${SEDE_ID}/image`)
      .set('Authorization', ADMIN())
      .expect(200);

    expect(res.body.data.imageUrl).toBeNull();
    expect(res.body.data).not.toHaveProperty('imageKey');
    expect(sedes.get(SEDE_ID)?.imageKey).toBeNull();
    expect(minio.deleteFile).toHaveBeenCalledWith(clave);
    expect(objetos.size).toBe(0);
  });

  it('DELETE sobre una sede sin foto es idempotente (200)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/venues/${SEDE_ID}/image`)
      .set('Authorization', ADMIN())
      .expect(200);
    expect(res.body.data.imageUrl).toBeNull();
    expect(minio.deleteFile).not.toHaveBeenCalled();
  });

  it('DELETE de una sede inexistente responde 404', async () => {
    await request(app.getHttpServer())
      .delete(`/venues/${SEDE_INEXISTENTE}/image`)
      .set('Authorization', ADMIN())
      .expect(404);
  });

  it('DELETE sin sesión responde 401', async () => {
    await request(app.getHttpServer())
      .delete(`/venues/${SEDE_ID}/image`)
      .expect(401);
  });

  // -------------------------------------------------
  // GET público
  // -------------------------------------------------
  it('GET público devuelve los bytes con los headers de caché', async () => {
    const subida = await subir(WEBP, 'foto.webp', 'image/webp').expect(201);

    const res = await pedirImagen(subida.body.data.imageUrl).expect(200);

    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(res.body as Buffer, WEBP)).toBe(0);
  });

  it('GET con sesión sigue siendo cacheable (la foto es igual para todos)', async () => {
    const subida = await subir(JPEG, 'foto.jpg').expect(201);
    const res = await pedirImagen(subida.body.data.imageUrl)
      .set('Authorization', ADMIN())
      .expect(200);
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(res.headers['content-type']).toBe('image/jpeg');
  });

  it('GET de una sede sin foto responde 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${SEDE_ID}/image`)
      .expect(404);
    expect(res.body.message).toBe('La sede no tiene foto');
  });

  it('GET de una sede inexistente responde 404', async () => {
    await request(app.getHttpServer())
      .get(`/venues/${SEDE_INEXISTENTE}/image`)
      .expect(404);
  });

  it('GET responde 404 si el objeto ya no está en el bucket', async () => {
    await subir(JPEG, 'foto.jpg').expect(201);
    objetos.clear();
    await request(app.getHttpServer())
      .get(`/venues/${SEDE_ID}/image`)
      .expect(404);
  });

  // -------------------------------------------------
  // imageUrl en las respuestas de sedes
  // -------------------------------------------------
  it('el listado trae imageUrl (string o null) y nunca imageKey', async () => {
    await subir(JPEG, 'foto.jpg').expect(201);

    const res = await request(app.getHttpServer()).get('/venues').expect(200);
    const porId = new Map(
      (res.body.data as Array<Record<string, unknown>>).map((v) => [v.id, v]),
    );

    expect(porId.get(SEDE_ID)?.imageUrl).toMatch(
      /^\/api\/v1\/venues\/.+\/image\?v=/,
    );
    expect(porId.get(OTRA_SEDE_ID)?.imageUrl).toBeNull();
    for (const v of porId.values()) {
      expect(v).not.toHaveProperty('imageKey');
    }
  });

  it('el detalle trae imageUrl y nunca imageKey', async () => {
    const res = await request(app.getHttpServer())
      .get(`/venues/${OTRA_SEDE_ID}`)
      .expect(200);
    expect(res.body.data.imageUrl).toBeNull();
    expect(res.body.data).not.toHaveProperty('imageKey');
  });

  // -------------------------------------------------
  // Auditoría y regresión de documentos
  // -------------------------------------------------
  it('la subida y el borrado se auditan como UPLOAD y UPDATE', () => {
    const reflector = new Reflector();
    const proto = VenueImagesController.prototype;
    expect(reflector.get(AUDIT_KEY, proto.upload)).toEqual({
      action: AuditAction.UPLOAD,
    });
    expect(reflector.get(AUDIT_KEY, proto.remove)).toEqual({
      action: AuditAction.UPDATE,
    });
  });

  it('documentos sigue sin aceptar WebP', () => {
    const pipe = new FileSignaturePipe();
    const archivo = {
      buffer: WEBP,
      originalname: 'dni.webp',
      mimetype: 'image/webp',
    } as Express.Multer.File;
    expect(() => pipe.transform(archivo)).toThrow(BadRequestException);
    expect(() => pipe.transform(archivo)).toThrow(/PDF, PNG o JPEG/);
  });
});
