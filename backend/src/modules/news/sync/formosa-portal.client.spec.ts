// ===========================================
// VULN-34 — El cliente del portal no se traga cualquier respuesta
// ===========================================
//
// Se reemplaza `fetch` global por un doble: el cliente es lo único que sale a
// Internet y lo que se prueba es cómo reacciona a lo que vuelve (tamaño,
// redirecciones), no la red.
import { ConfigService } from '@nestjs/config';
import {
  FormosaPortalClient,
  MAX_BYTES_RESPUESTA,
} from './formosa-portal.client';

const BASE = 'https://www.formosa.gob.ar';

function cliente(): FormosaPortalClient {
  const config = {
    get: jest.fn((clave: string, porDefecto?: unknown) =>
      clave === 'NEWS_SYNC_PORTAL_URL' ? BASE : porDefecto,
    ),
  };
  return new FormosaPortalClient(config as unknown as ConfigService);
}

/** Respuesta 200 cuyo cuerpo llega en trozos (sin `content-length`). */
function respuestaEnTrozos(
  trozos: Buffer[],
  headers: Record<string, string> = {},
) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const t of trozos) controller.enqueue(new Uint8Array(t));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers });
}

function redireccion(location: string, status = 302) {
  return new Response(null, { status, headers: { location } });
}

describe('FormosaPortalClient (VULN-34)', () => {
  const fetchOriginal = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
  });

  it('una nota normal se sigue leyendo (y decodificando) igual que antes', async () => {
    fetchMock.mockResolvedValue(
      respuestaEnTrozos([
        Buffer.from('<html><head><meta charset="utf-8"></head>Juárez</html>'),
      ]),
    );

    const r = await cliente().traerNota(34709);

    expect(r).toEqual({ ok: true, html: expect.stringContaining('Juárez') });
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/noticia/34709/0/x`,
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('aborta sin leer el cuerpo si `content-length` supera el máximo', async () => {
    fetchMock.mockResolvedValue(
      respuestaEnTrozos([Buffer.from('x')], {
        'content-length': String(MAX_BYTES_RESPUESTA + 1),
      }),
    );

    const r = await cliente().traerPortada();

    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/supera el tamaño máximo/);
  });

  it('corta la lectura apenas el cuerpo (sin `content-length`) pasa el máximo', async () => {
    const mega = Buffer.alloc(1024 * 1024, 0x61);
    fetchMock.mockResolvedValue(respuestaEnTrozos([mega, mega, mega]));

    const r = await cliente().traerPortada();

    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/supera el tamaño máximo/);
  });

  it('un cuerpo de exactamente el máximo todavía se acepta', async () => {
    fetchMock.mockResolvedValue(
      respuestaEnTrozos([Buffer.alloc(MAX_BYTES_RESPUESTA, 0x61)]),
    );

    const r = await cliente().traerPortada();

    expect(r.ok).toBe(true);
  });

  it('sigue una redirección dentro del mismo sitio', async () => {
    fetchMock
      .mockResolvedValueOnce(redireccion('/noticia/34709/671/las-chicas'))
      .mockResolvedValueOnce(
        respuestaEnTrozos([Buffer.from('<html>ok</html>')]),
      );

    const r = await cliente().traerNota(34709);

    expect(r).toEqual({ ok: true, html: '<html>ok</html>' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${BASE}/noticia/34709/671/las-chicas`,
      expect.anything(),
    );
  });

  it('no sigue una redirección hacia otro host', async () => {
    fetchMock.mockResolvedValueOnce(
      redireccion('http://169.254.169.254/latest/meta-data/'),
    );

    const r = await cliente().traerNota(1);

    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/redirección fuera del portal/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('corta una cadena de redirecciones demasiado larga', async () => {
    fetchMock.mockResolvedValue(redireccion('/vuelta'));

    const r = await cliente().traerPortada();

    expect(r.ok).toBe(false);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('un error HTTP sigue informándose como antes', async () => {
    fetchMock.mockResolvedValue(new Response('no', { status: 500 }));

    const r = await cliente().traerPortada();

    expect(r).toEqual({ ok: false, error: `HTTP 500 en ${BASE}/` });
  });
});
