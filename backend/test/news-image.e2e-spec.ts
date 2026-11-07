// ===========================================
// E2E — Imagen subida de una noticia
// ===========================================
//
// Contrato:
//   · POST   /news/:id/image  (NEWS_MANAGE) multipart `file`, JPG/PNG/WebP
//            ≤ 5 MB validado por firma → 201 con la noticia (imageUrl).
//            Nota del portal (isExternal) → 403, sin subir nada.
//   · DELETE /news/:id/image  (NEWS_MANAGE) → 200 con imageUrl null.
//   · GET    /news/:id/image  público si está publicada (Cache-Control
//            immutable + nosniff); borrador → 404 sin sesión, 200 sin caché
//            con sesión de un rol que ve borradores.
//   · Las respuestas de noticias llevan `imageUrl` + `imageSource` y nunca
//     `imageKey`. Pasar de archivo a URL (PATCH) o borrar la noticia borra el
//     objeto de MinIO.
//
// MinIO y Prisma se mockean en memoria; la auth es la real (JwtStrategy +
// JwtAuthGuard + RolesGuard + OptionalJwtAuthGuard) para medir 401 y 403.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Prisma } from '@prisma/client';
import { Readable } from 'node:stream';
import request from 'supertest';
import { App } from 'supertest/types';

import { NewsController } from '../src/modules/news/news.controller';
import { NewsService } from '../src/modules/news/news.service';
import { NewsImagesController } from '../src/modules/news/news-images.controller';
import { NewsImagesService } from '../src/modules/news/news-images.service';
import { ImageUploadInterceptor } from '../src/modules/images/image-upload.interceptor';
import { ImageSignaturePipe } from '../src/modules/images/image-signature.pipe';
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

const PUBLICADA_ID = '11111111-1111-4111-8111-111111111111';
const BORRADOR_ID = '22222222-2222-4222-8222-222222222222';
const PORTAL_ID = '33333333-3333-4333-8333-333333333333';
const INEXISTENTE_ID = '99999999-9999-4999-8999-999999999999';
const URL_PORTAL =
  'https://archivos.formosa.gob.ar/media/uploads/imagenes_noticias/foto.jpg';

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

type Fila = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  imageKey: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  authorId: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  isExternal: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** `where` plano de Prisma: igualdad campo a campo (lo que usan los services). */
const coincide = (fila: Fila, where: Record<string, unknown> = {}) =>
  Object.entries(where).every(([k, v]) =>
    typeof v === 'object' && v !== null
      ? true // filtros compuestos (search) no se usan acá
      : fila[k as keyof Fila] === v,
  );

describe('Imagen de noticia (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let noticias: Map<string, Fila>;
  let objetos: Map<string, Buffer>;
  let minio: {
    uploadFile: jest.Mock;
    deleteFile: jest.Mock;
    getObjectStream: jest.Mock;
  };

  const noticia = (id: string, extra: Partial<Fila> = {}): Fila => ({
    id,
    title: `Noticia ${id.slice(0, 4)}`,
    slug: `noticia-${id.slice(0, 4)}`,
    content: 'Contenido de la noticia de prueba',
    excerpt: null,
    imageKey: null,
    isPublished: true,
    publishedAt: new Date('2026-09-01T12:00:00Z'),
    authorId: null,
    sourceUrl: null,
    sourceName: null,
    isExternal: false,
    createdAt: new Date('2026-09-01T12:00:00Z'),
    updatedAt: new Date('2026-09-01T12:00:00Z'),
    ...extra,
  });

  const proyectar = (
    fila: Fila | undefined,
    args: { select?: Record<string, boolean> },
  ) => {
    if (!fila) return null;
    if (args.select) {
      return Object.fromEntries(
        Object.keys(args.select).map((k) => [k, fila[k as keyof Fila]]),
      );
    }
    return { ...fila };
  };

  beforeEach(async () => {
    noticias = new Map([
      [PUBLICADA_ID, noticia(PUBLICADA_ID)],
      [
        BORRADOR_ID,
        noticia(BORRADOR_ID, { isPublished: false, publishedAt: null }),
      ],
      [
        PORTAL_ID,
        noticia(PORTAL_ID, {
          isExternal: true,
          imageKey: URL_PORTAL,
          sourceUrl: 'https://www.formosa.gob.ar/noticia/34709',
          sourceName: 'Portal Oficial',
        }),
      ],
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

    const noEncontrada = () =>
      new Prisma.PrismaClientKnownRequestError('No record', {
        code: 'P2025',
        clientVersion: 'test',
      });

    const prisma = {
      news: {
        findUnique: jest.fn(
          (args: {
            where: { id?: string; slug?: string };
            select?: Record<string, boolean>;
          }) =>
            Promise.resolve(
              args.where.id
                ? proyectar(noticias.get(args.where.id), args)
                : null,
            ),
        ),
        findFirst: jest.fn(
          (args: {
            where: Record<string, unknown>;
            select?: Record<string, boolean>;
          }) =>
            Promise.resolve(
              proyectar(
                [...noticias.values()].find((f) => coincide(f, args.where)),
                args,
              ),
            ),
        ),
        findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(
            [...noticias.values()]
              .filter((f) => coincide(f, where))
              .map((f) => ({ ...f })),
          ),
        ),
        count: jest.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(
            [...noticias.values()].filter((f) => coincide(f, where)).length,
          ),
        ),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Partial<Fila>;
          }) => {
            const fila = noticias.get(where.id as string);
            if (!fila || !coincide(fila, where)) {
              return Promise.resolve({ count: 0 });
            }
            Object.assign(fila, data);
            return Promise.resolve({ count: 1 });
          },
        ),
        update: jest.fn(
          ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Partial<Fila>;
          }) => {
            const fila = noticias.get(where.id as string);
            if (!fila || !coincide(fila, where)) {
              return Promise.reject(noEncontrada());
            }
            Object.assign(fila, data);
            return Promise.resolve({ ...fila });
          },
        ),
        delete: jest.fn(({ where }: { where: { id: string } }) => {
          const fila = noticias.get(where.id);
          if (!fila) return Promise.reject(noEncontrada());
          noticias.delete(where.id);
          return Promise.resolve({ ...fila });
        }),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: ACCESS_SECRET }),
      ],
      controllers: [NewsController, NewsImagesController],
      providers: [
        NewsService,
        NewsImagesService,
        ImageUploadInterceptor,
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
    id = PUBLICADA_ID,
    auth: string | null = ADMIN(),
  ) => {
    const req = request(app.getHttpServer()).post(`/news/${id}/image`);
    if (auth) req.set('Authorization', auth);
    return req.attach('file', contenido, { filename: nombre, contentType });
  };

  const quitar = (id = PUBLICADA_ID, auth: string | null = ADMIN()) => {
    const req = request(app.getHttpServer()).delete(`/news/${id}/image`);
    if (auth) req.set('Authorization', auth);
    return req;
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

  const URL_PROPIA = (id: string) =>
    new RegExp(`^/api/v1/news/${id}/image\\?v=[0-9a-f]{12}$`);

  // -------------------------------------------------
  // Subida
  // -------------------------------------------------
  it.each([
    ['JPG', JPEG, 'portada.jpg', 'image/jpeg', /\.jpg$/],
    ['JPEG (.jpeg)', JPEG, 'portada.JPEG', 'image/jpeg', /\.jpg$/],
    ['PNG', PNG, 'portada.png', 'image/png', /\.png$/],
    ['WebP', WEBP, 'portada.webp', 'image/webp', /\.webp$/],
  ])(
    'sube un %s y devuelve la noticia con imageUrl propia',
    async (_n, buffer, nombre, tipo, extension) => {
      const res = await subir(buffer, nombre, tipo).expect(201);

      const news = res.body.data;
      expect(news.id).toBe(PUBLICADA_ID);
      expect(news.imageUrl).toMatch(URL_PROPIA(PUBLICADA_ID));
      expect(news.imageSource).toBe('upload');
      expect(news).not.toHaveProperty('imageKey');

      // Clave armada por el backend: carpeta de la noticia, nombre fijo con la
      // extensión del tipo DETECTADO. El nombre del usuario no aparece.
      const [archivo, carpeta, nombreGuardado] = minio.uploadFile.mock
        .calls[0] as [Express.Multer.File, string, string];
      expect(carpeta).toBe(`news/${PUBLICADA_ID}`);
      expect(nombreGuardado).toMatch(/^foto\.(jpg|png|webp)$/);
      expect(nombreGuardado).toMatch(extension);
      expect(nombreGuardado).not.toContain('portada');
      expect(archivo.mimetype).toBe(tipo);
      expect(noticias.get(PUBLICADA_ID)?.imageKey).toMatch(
        new RegExp(`^news/${PUBLICADA_ID}/`),
      );
    },
  );

  it('rechaza con 422 una imagen de más de 5 MB (lo corta multer)', async () => {
    const grande = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await subir(grande, 'enorme.jpg').expect(422);
    expect(res.body.message).toMatch(/5 MB/);
    expect(minio.uploadFile).not.toHaveBeenCalled();
  });

  it.each([
    ['un ejecutable renombrado .jpg', EXE, 'foto.jpg', 'image/jpeg'],
    ['un PDF renombrado .png', PDF, 'foto.png', 'image/png'],
    ['un PNG renombrado .jpg', PNG, 'foto.jpg', 'image/jpeg'],
    ['un archivo vacío', Buffer.alloc(0), 'foto.jpg', 'image/jpeg'],
  ])('rechaza con 400 %s', async (_n, buffer, nombre, tipo) => {
    await subir(buffer, nombre, tipo).expect(400);
    expect(minio.uploadFile).not.toHaveBeenCalled();
  });

  it('noticia inexistente responde 404 y no deja objetos', async () => {
    const res = await subir(JPEG, 'f.jpg', 'image/jpeg', INEXISTENTE_ID);
    expect(res.status).toBe(404);
    expect(objetos.size).toBe(0);
  });

  it('sin sesión responde 401 en POST y DELETE', async () => {
    await subir(JPEG, 'f.jpg', 'image/jpeg', PUBLICADA_ID, null).expect(401);
    await quitar(PUBLICADA_ID, null).expect(401);
    expect(minio.uploadFile).not.toHaveBeenCalled();
  });

  it.each([Role.COORDINADOR, Role.DELEGADO])(
    '%s (sin NEWS_MANAGE) responde 403 en POST y DELETE',
    async (role) => {
      const auth = `Bearer ${tokenDe(role)}`;
      await subir(JPEG, 'f.jpg', 'image/jpeg', PUBLICADA_ID, auth).expect(403);
      await quitar(PUBLICADA_ID, auth).expect(403);
      expect(minio.uploadFile).not.toHaveBeenCalled();
      expect(minio.deleteFile).not.toHaveBeenCalled();
    },
  );

  // -------------------------------------------------
  // Notas del portal: no se tocan
  // -------------------------------------------------
  it('una nota del portal rechaza la subida con 403 y conserva su imagen', async () => {
    const res = await subir(JPEG, 'f.jpg', 'image/jpeg', PORTAL_ID).expect(403);
    expect(res.body.message).toMatch(/portal oficial/);
    expect(minio.uploadFile).not.toHaveBeenCalled();
    expect(noticias.get(PORTAL_ID)?.imageKey).toBe(URL_PORTAL);
  });

  it('una nota del portal rechaza quitar la imagen con 403', async () => {
    await quitar(PORTAL_ID).expect(403);
    expect(noticias.get(PORTAL_ID)?.imageKey).toBe(URL_PORTAL);
  });

  // -------------------------------------------------
  // Reemplazo, paso a URL y borrado
  // -------------------------------------------------
  it('reemplazar borra el objeto viejo y cambia la versión de la URL', async () => {
    const primera = await subir(JPEG, 'a.jpg').expect(201);
    const claveVieja = noticias.get(PUBLICADA_ID)?.imageKey as string;

    const segunda = await subir(PNG, 'b.png', 'image/png').expect(201);
    const claveNueva = noticias.get(PUBLICADA_ID)?.imageKey as string;

    expect(claveNueva).not.toBe(claveVieja);
    expect(minio.deleteFile).toHaveBeenCalledWith(claveVieja);
    expect(objetos.has(claveVieja)).toBe(false);
    expect(objetos.has(claveNueva)).toBe(true);
    expect(segunda.body.data.imageUrl).not.toBe(primera.body.data.imageUrl);
  });

  it('subir sobre una URL externa la reemplaza sin intentar borrar nada', async () => {
    noticias.get(PUBLICADA_ID)!.imageKey = 'https://example.org/vieja.jpg';
    await subir(JPEG, 'a.jpg').expect(201);
    expect(minio.deleteFile).not.toHaveBeenCalled();
    expect(noticias.get(PUBLICADA_ID)?.imageKey).toMatch(/^news\//);
  });

  it('pasar de archivo a URL (PATCH) borra el objeto y devuelve la URL tal cual', async () => {
    await subir(JPEG, 'a.jpg').expect(201);
    const clave = noticias.get(PUBLICADA_ID)?.imageKey as string;

    const res = await request(app.getHttpServer())
      .patch(`/news/${PUBLICADA_ID}`)
      .set('Authorization', ADMIN())
      .send({ imageKey: 'https://example.org/nueva.jpg' })
      .expect(200);

    expect(res.body.data.imageUrl).toBe('https://example.org/nueva.jpg');
    expect(res.body.data.imageSource).toBe('url');
    expect(res.body.data).not.toHaveProperty('imageKey');
    expect(minio.deleteFile).toHaveBeenCalledWith(clave);
    expect(objetos.size).toBe(0);
  });

  it('un PATCH sin imageKey no toca la imagen subida', async () => {
    await subir(JPEG, 'a.jpg').expect(201);
    const clave = noticias.get(PUBLICADA_ID)?.imageKey;

    await request(app.getHttpServer())
      .patch(`/news/${PUBLICADA_ID}`)
      .set('Authorization', ADMIN())
      .send({ excerpt: 'Nueva bajada' })
      .expect(200);

    expect(noticias.get(PUBLICADA_ID)?.imageKey).toBe(clave);
    expect(minio.deleteFile).not.toHaveBeenCalled();
  });

  it('PATCH con imageKey null quita la imagen subida y borra el objeto', async () => {
    await subir(JPEG, 'a.jpg').expect(201);
    const res = await request(app.getHttpServer())
      .patch(`/news/${PUBLICADA_ID}`)
      .set('Authorization', ADMIN())
      .send({ imageKey: null })
      .expect(200);
    expect(res.body.data.imageUrl).toBeNull();
    expect(res.body.data.imageSource).toBeNull();
    expect(objetos.size).toBe(0);
  });

  it.each([
    ['una clave de MinIO', `news/${BORRADOR_ID}/x-foto.jpg`],
    ['una ruta relativa', '/api/v1/venues/x/image'],
    ['http sin TLS', 'http://example.org/a.jpg'],
    ['javascript:', 'javascript:alert(1)'],
  ])(
    'el PATCH rechaza con 400 %s como imagen (sólo URLs https)',
    async (_n, valor) => {
      await request(app.getHttpServer())
        .patch(`/news/${PUBLICADA_ID}`)
        .set('Authorization', ADMIN())
        .send({ imageKey: valor })
        .expect(400);
      expect(noticias.get(PUBLICADA_ID)?.imageKey).toBeNull();
    },
  );

  it('DELETE borra el objeto y deja imageUrl en null', async () => {
    await subir(JPEG, 'a.jpg').expect(201);
    const clave = noticias.get(PUBLICADA_ID)?.imageKey as string;

    const res = await quitar().expect(200);

    expect(res.body.data.imageUrl).toBeNull();
    expect(res.body.data).not.toHaveProperty('imageKey');
    expect(noticias.get(PUBLICADA_ID)?.imageKey).toBeNull();
    expect(minio.deleteFile).toHaveBeenCalledWith(clave);
    expect(objetos.size).toBe(0);
  });

  it('DELETE sobre una URL externa la quita sin tocar MinIO', async () => {
    noticias.get(PUBLICADA_ID)!.imageKey = 'https://example.org/vieja.jpg';
    const res = await quitar().expect(200);
    expect(res.body.data.imageUrl).toBeNull();
    expect(minio.deleteFile).not.toHaveBeenCalled();
  });

  it('DELETE sin imagen es idempotente (200)', async () => {
    const res = await quitar().expect(200);
    expect(res.body.data.imageUrl).toBeNull();
    expect(minio.deleteFile).not.toHaveBeenCalled();
  });

  it('borrar la noticia borra su objeto', async () => {
    await subir(JPEG, 'a.jpg').expect(201);
    const clave = noticias.get(PUBLICADA_ID)?.imageKey as string;

    await request(app.getHttpServer())
      .delete(`/news/${PUBLICADA_ID}`)
      .set('Authorization', ADMIN())
      .expect(200);

    expect(minio.deleteFile).toHaveBeenCalledWith(clave);
    expect(objetos.size).toBe(0);
  });

  // -------------------------------------------------
  // GET público
  // -------------------------------------------------
  it('GET público de una publicada devuelve los bytes con caché inmutable', async () => {
    const subida = await subir(WEBP, 'f.webp', 'image/webp').expect(201);

    const res = await pedirImagen(subida.body.data.imageUrl).expect(200);

    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(res.body as Buffer, WEBP)).toBe(0);
  });

  it('la imagen de un borrador no se ve sin sesión (404)', async () => {
    const subida = await subir(JPEG, 'f.jpg', 'image/jpeg', BORRADOR_ID).expect(
      201,
    );
    const res = await request(app.getHttpServer())
      .get(subida.body.data.imageUrl.replace(/^\/api\/v1/, ''))
      .expect(404);
    expect(res.body.message).toBe('Noticia no encontrada');
  });

  it('la imagen de un borrador sí se ve con sesión de admin, sin caché', async () => {
    const subida = await subir(JPEG, 'f.jpg', 'image/jpeg', BORRADOR_ID).expect(
      201,
    );
    const res = await pedirImagen(subida.body.data.imageUrl)
      .set('Authorization', ADMIN())
      .expect(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['cache-control']).toBe('private, no-store');
  });

  it('un rol que no ve borradores tampoco ve su imagen', async () => {
    await subir(JPEG, 'f.jpg', 'image/jpeg', BORRADOR_ID).expect(201);
    await request(app.getHttpServer())
      .get(`/news/${BORRADOR_ID}/image`)
      .set('Authorization', `Bearer ${tokenDe(Role.DELEGADO)}`)
      .expect(404);
  });

  it('GET de una noticia con URL externa responde 404 (esa imagen se pide afuera)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/news/${PORTAL_ID}/image`)
      .expect(404);
    expect(res.body.message).toBe('La noticia no tiene una imagen subida');
  });

  it('GET responde 404 si el objeto ya no está en el bucket', async () => {
    await subir(JPEG, 'f.jpg').expect(201);
    objetos.clear();
    await request(app.getHttpServer())
      .get(`/news/${PUBLICADA_ID}/image`)
      .expect(404);
  });

  // -------------------------------------------------
  // imageUrl en las respuestas de noticias
  // -------------------------------------------------
  it('el listado trae imageUrl/imageSource y nunca imageKey', async () => {
    await subir(JPEG, 'f.jpg').expect(201);

    const res = await request(app.getHttpServer()).get('/news').expect(200);
    const porId = new Map(
      (res.body.data as Array<Record<string, unknown>>).map((n) => [n.id, n]),
    );

    expect(porId.get(PUBLICADA_ID)?.imageUrl).toMatch(URL_PROPIA(PUBLICADA_ID));
    expect(porId.get(PUBLICADA_ID)?.imageSource).toBe('upload');
    expect(porId.get(PORTAL_ID)?.imageUrl).toBe(URL_PORTAL);
    expect(porId.get(PORTAL_ID)?.imageSource).toBe('url');
    // El borrador no está en el listado público.
    expect(porId.has(BORRADOR_ID)).toBe(false);
    for (const n of porId.values()) {
      expect(n).not.toHaveProperty('imageKey');
    }
  });

  it('el detalle (por id y por slug) trae imageUrl y nunca imageKey', async () => {
    await subir(PNG, 'f.png', 'image/png').expect(201);

    const porId = await request(app.getHttpServer())
      .get(`/news/${PUBLICADA_ID}`)
      .expect(200);
    expect(porId.body.data.imageUrl).toMatch(URL_PROPIA(PUBLICADA_ID));
    expect(porId.body.data).not.toHaveProperty('imageKey');

    const slug = noticias.get(PUBLICADA_ID)?.slug as string;
    const porSlug = await request(app.getHttpServer())
      .get(`/news/slug/${slug}`)
      .expect(200);
    expect(porSlug.body.data.imageUrl).toBe(porId.body.data.imageUrl);
    expect(porSlug.body.data).not.toHaveProperty('imageKey');
  });

  it('sin imagen, imageUrl e imageSource son null', async () => {
    const res = await request(app.getHttpServer())
      .get(`/news/${PUBLICADA_ID}`)
      .expect(200);
    expect(res.body.data.imageUrl).toBeNull();
    expect(res.body.data.imageSource).toBeNull();
  });

  // -------------------------------------------------
  // Auditoría
  // -------------------------------------------------
  it('la subida y el borrado se auditan como UPLOAD y UPDATE', () => {
    const reflector = new Reflector();
    const proto = NewsImagesController.prototype;
    expect(reflector.get(AUDIT_KEY, proto.upload)).toEqual({
      action: AuditAction.UPLOAD,
    });
    expect(reflector.get(AUDIT_KEY, proto.remove)).toEqual({
      action: AuditAction.UPDATE,
    });
  });
});
