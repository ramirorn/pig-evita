// ===========================================
// GlobalExceptionFilter — qué queda en el log (VULN-27, VULN-43)
// ===========================================
import {
  ArgumentsHost,
  ForbiddenException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function host(url: string, user?: { sub: string }): ArgumentsHost {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    getHeader: jest.fn(),
  };
  const request = { url, method: 'GET', headers: {}, user };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

describe('GlobalExceptionFilter — log', () => {
  const filtro = new GlobalExceptionFilter();
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  const escrito = (spy: jest.SpyInstance) => JSON.stringify(spy.mock.calls);

  it('VULN-27: un 403 queda registrado como acceso denegado, sin datos de la query', () => {
    filtro.catch(
      new ForbiddenException(),
      host('/api/v1/participants?search=40123456', { sub: 'u-1' }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(escrito(warn)).toContain('Acceso denegado');
    expect(escrito(warn)).toContain('403');
    expect(escrito(warn)).toContain('u-1');
    expect(escrito(warn)).not.toContain('40123456');
  });

  it('VULN-27: un 401 también queda registrado', () => {
    filtro.catch(new UnauthorizedException(), host('/api/v1/users'));
    expect(escrito(warn)).toContain('401');
  });

  it('comportamiento previo: un 404 no se registra como acceso denegado', () => {
    filtro.catch(new NotFoundException(), host('/api/v1/news/x'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('VULN-43: un error no controlado se registra sin el mensaje (que trae los valores de la consulta)', () => {
    const prisma = new Error(
      'Invalid `prisma.participant.create()` invocation: Unique constraint failed on dni = "40123456"',
    );
    prisma.name = 'PrismaClientKnownRequestError';
    (prisma as Error & { code?: string }).code = 'P2002';
    filtro.catch(prisma, host('/api/v1/participants'));
    expect(error).toHaveBeenCalledTimes(1);
    expect(escrito(error)).toContain('PrismaClientKnownRequestError');
    expect(escrito(error)).toContain('P2002');
    expect(escrito(error)).not.toContain('40123456');
  });

  it('VULN-43: algo que no es un Error también se registra (antes se perdía)', () => {
    filtro.catch('se rompió algo', host('/api/v1/news'));
    expect(error).toHaveBeenCalledTimes(1);
  });

  describe('base de datos caída', () => {
    const respuesta = (h: ArgumentsHost) =>
      h.switchToHttp().getResponse<{ status: jest.Mock; json: jest.Mock }>();

    it.each([
      ['no se pudo conectar (P1001)', 'PrismaClientKnownRequestError', 'P1001'],
      [
        'se agotó el pool de conexiones (P2024)',
        'PrismaClientKnownRequestError',
        'P2024',
      ],
      [
        'falló la inicialización del cliente',
        'PrismaClientInitializationError',
        undefined,
      ],
    ])('%s ⇒ 503 con un mensaje que dice qué pasa', (_caso, nombre, codigo) => {
      const e = new Error("Can't reach database server at `localhost:5434`");
      e.name = nombre;
      if (codigo) (e as Error & { code?: string }).code = codigo;
      const h = host('/api/v1/news');
      filtro.catch(e, h);
      expect(respuesta(h).status).toHaveBeenCalledWith(503);
      const cuerpo = respuesta(h).json.mock.calls[0][0];
      expect(cuerpo.message).toBe(
        'La base de datos no está disponible en este momento',
      );
      expect(JSON.stringify(cuerpo)).not.toContain('localhost:5434');
    });

    it('comportamiento previo: otro error de Prisma sigue siendo 500', () => {
      const e = new Error('Unique constraint failed');
      e.name = 'PrismaClientKnownRequestError';
      (e as Error & { code?: string }).code = 'P2002';
      const h = host('/api/v1/news');
      filtro.catch(e, h);
      expect(respuesta(h).status).toHaveBeenCalledWith(500);
    });
  });
});

describe('GlobalExceptionFilter — auditoría de accesos denegados (VULN-27)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  const conRecorder = () => {
    const record = jest.fn();
    return { record, filtro: new GlobalExceptionFilter({ record }) };
  };

  it('un 403 se manda a la auditoría con la ruta sin query', () => {
    const { record, filtro } = conRecorder();
    filtro.catch(
      new ForbiddenException(),
      host('/api/v1/participants?search=40123456', { sub: 'u-1' }),
    );
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({
      status: 403,
      method: 'GET',
      userId: 'u-1',
    });
    expect(JSON.stringify(record.mock.calls)).not.toContain('40123456');
  });

  it('las rutas de /auth no se duplican: las audita AuthService', () => {
    const { record, filtro } = conRecorder();
    filtro.catch(new UnauthorizedException(), host('/api/v1/auth/refresh'));
    expect(record).not.toHaveBeenCalled();
  });

  it('un 404 no es un acceso denegado', () => {
    const { record, filtro } = conRecorder();
    filtro.catch(new NotFoundException(), host('/api/v1/news/x'));
    expect(record).not.toHaveBeenCalled();
  });
});
