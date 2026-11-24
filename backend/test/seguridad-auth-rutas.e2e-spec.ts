// ===========================================
// E2E — Inventario de permisos de rutas (VULN-45) y saneamiento del log de
// acceso (VULN-25)
//
// `RolesGuard` es deny-by-default: un handler sin `@Roles`, `@Public` ni
// `@AnyAuthenticated` responde 403. Este spec recorre **todos** los controllers
// de `src/modules` (no una lista a mano que se desactualiza) y falla si alguno
// quedó sin declarar quién entra, para que el olvido se vea en CI y no como un
// 403 en producción.
// ===========================================
import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../src/common/constants';
import { ANY_AUTHENTICATED_KEY } from '../src/common/decorators';
// Desde su archivo y no desde `app.module`: importar el módulo raíz valida el
// entorno al cargarse y la suite fallaba en cualquier máquina sin `.env` (el CI).
import { urlParaLog } from '../src/common/logging/url-para-log';

function archivosDeControllers(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? archivosDeControllers(join(dir, e.name))
      : e.name.endsWith('.controller.ts')
        ? [join(dir, e.name)]
        : [],
  );
}

type Clase = { name: string; prototype: Record<string, unknown> };

function controllers(): Clase[] {
  const raiz = join(__dirname, '..', 'src', 'modules');
  return archivosDeControllers(raiz).flatMap((archivo) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const modulo = require(archivo) as Record<string, unknown>;
    return Object.values(modulo).filter(
      (v): v is Clase =>
        typeof v === 'function' &&
        Reflect.getMetadata(PATH_METADATA, v) !== undefined,
    );
  });
}

describe('VULN-45 — cada ruta declara quién entra', () => {
  const todos = controllers();

  it('encuentra los controllers del proyecto', () => {
    expect(todos.length).toBeGreaterThan(15);
  });

  it('ningún handler depende del valor por defecto de RolesGuard', () => {
    const sinDeclarar: string[] = [];
    for (const clase of todos) {
      const deClase = (k: string) => Reflect.getMetadata(k, clase) as unknown;
      for (const nombre of Object.getOwnPropertyNames(clase.prototype)) {
        const handler = clase.prototype[nombre];
        if (
          nombre === 'constructor' ||
          typeof handler !== 'function' ||
          Reflect.getMetadata(METHOD_METADATA, handler) === undefined
        ) {
          continue;
        }
        const de = (k: string) =>
          (Reflect.getMetadata(k, handler) as unknown) ?? deClase(k);
        const roles = de(ROLES_KEY) as unknown[] | undefined;
        const declarado =
          (Array.isArray(roles) && roles.length > 0) ||
          de(IS_PUBLIC_KEY) === true ||
          de(ANY_AUTHENTICATED_KEY) === true;
        if (!declarado) sinDeclarar.push(`${clase.name}.${nombre}`);
      }
    }
    expect(sinDeclarar).toEqual([]);
  });
});

describe('VULN-25 — la URL del log de acceso no lleva datos personales', () => {
  it('reemplaza el valor de los parámetros de la query (el nombre queda)', () => {
    expect(urlParaLog('/api/v1/participants?search=40123456&page=2')).toBe(
      '/api/v1/participants?search=[REDACTADO]&page=2',
    );
    expect(
      urlParaLog('/api/v1/users?search=ana.gomez%40gmail.com&limit=20'),
    ).toBe('/api/v1/users?search=[REDACTADO]&limit=20');
  });

  it('enmascara un DNI o un código QR en el path', () => {
    expect(urlParaLog('/api/v1/participants/dni/40123456')).toBe(
      '/api/v1/participants/dni/[REDACTADO]',
    );
    expect(urlParaLog('/api/v1/inscriptions/qr/EVITA-ABC123')).toBe(
      '/api/v1/inscriptions/qr/[REDACTADO]',
    );
  });

  it('comportamiento previo: una URL sin datos sensibles queda igual', () => {
    expect(urlParaLog('/api/v1/health')).toBe('/api/v1/health');
    expect(
      urlParaLog('/api/v1/participants/0b9f6a1e-2c3d-4e5f-8a9b-1c2d3e4f5a6b'),
    ).toBe('/api/v1/participants/0b9f6a1e-2c3d-4e5f-8a9b-1c2d3e4f5a6b');
    expect(urlParaLog(undefined)).toBeUndefined();
  });
});
