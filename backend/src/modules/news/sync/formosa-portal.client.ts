// ===========================================
// S19 — Cliente HTTP del portal oficial
// ===========================================
//
// Es un sitio ajeno, así que la regla es ser un invitado educado:
//
//   · **User-Agent identificable**, con el nombre de la plataforma y un contacto:
//     si el recorrido molesta, el administrador del portal tiene a quién
//     escribirle en vez de banear una IP a ciegas.
//   · **Una pausa entre requests** (`NEWS_SYNC_DELAY_MS`, 1s por defecto). El
//     recorrido es secuencial a propósito: no hay concurrencia.
//   · **Tope de IDs por corrida** (lo aplica el service): el sync no puede
//     convertirse en un barrido del portal entero.
//   · **Timeout por request**, para que una corrida no quede colgada.
//
// `robots.txt` del portal (verificado el 2026-08-31) dice `User-agent: * /
// Allow: /`: no hay ninguna regla que prohíba `/noticia/`.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BASE_PORTAL, decodificarHtml, urlDeNota } from './formosa-news.parser';

/**
 * VULN-34 — tope del cuerpo de una respuesta del portal. Una nota real pesa
 * unos 35 KB y la portada unas decenas más: 2 MB deja margen de sobra y evita
 * que una respuesta hostil (o un tercero alcanzado por redirección o DNS) se
 * junte entera en memoria y después pase por el parser.
 */
export const MAX_BYTES_RESPUESTA = 2 * 1024 * 1024;

/** Redirecciones que se siguen a lo sumo, siempre dentro del mismo sitio. */
const MAX_REDIRECCIONES = 5;

/** `www.formosa.gob.ar` y `formosa.gob.ar` son el mismo sitio. */
function sitioDe(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

export type RespuestaDelPortal =
  { ok: true; html: string } | { ok: false; error: string };

@Injectable()
export class FormosaPortalClient {
  private readonly logger = new Logger(FormosaPortalClient.name);

  constructor(private readonly config: ConfigService) {}

  private get userAgent(): string {
    return this.config.get<string>(
      'NEWS_SYNC_USER_AGENT',
      'JuegosEvitaFormosa-SyncBot/1.0 (+https://www.formosa.gob.ar/; Secretaria de Deportes y Recreacion Comunitaria)',
    );
  }

  /**
   * O-3 — base del portal de donde se descargan portada y notas. Por defecto
   * el portal oficial; `NEWS_SYNC_PORTAL_URL` permite apuntar a un portal
   * simulado para probar el sync de punta a punta sin salir a Internet.
   */
  get basePortal(): string {
    return this.config
      .get<string>('NEWS_SYNC_PORTAL_URL', BASE_PORTAL)
      .replace(/\/+$/, '');
  }

  private get timeoutMs(): number {
    return Number(this.config.get('NEWS_SYNC_TIMEOUT_MS', 15000));
  }

  /** Pausa entre requests, en milisegundos. */
  get delayMs(): number {
    return Number(this.config.get('NEWS_SYNC_DELAY_MS', 1000));
  }

  async esperarEntreRequests(): Promise<void> {
    const ms = this.delayMs;
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Baja una nota por ID.
   *
   * Ojo: un `ok: true` **no** significa que la nota exista. El portal responde
   * 200 con la plantilla sin rellenar para cualquier ID inventado; eso lo
   * detecta el parser (`esPlantillaSinNota`), no el status code.
   */
  traerNota(id: number): Promise<RespuestaDelPortal> {
    return this.traer(urlDeNota(id, this.basePortal));
  }

  /**
   * Baja la portada del portal. El sync la usa para saber cuál es la nota más
   * nueva publicada y recorrer desde ahí hacia atrás. Mismo User-Agent, mismo
   * timeout y misma decodificación que una nota: es un request más de la
   * corrida, no una excepción a las reglas de invitado.
   */
  traerPortada(): Promise<RespuestaDelPortal> {
    return this.traer(`${this.basePortal}/`);
  }

  private async traer(url: string): Promise<RespuestaDelPortal> {
    try {
      const sitio = sitioDe(new URL(this.basePortal));
      let actual = url;
      let respuesta: Response | null = null;

      // VULN-34 — las redirecciones se siguen a mano: con `redirect: 'follow'`
      // el portal (o quien responda por él) podía mandar el request a cualquier
      // host, incluidas direcciones internas. Sólo se sigue dentro del sitio.
      for (let saltos = 0; ; saltos++) {
        respuesta = await fetch(actual, {
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'text/html,application/xhtml+xml',
            'Accept-Language': 'es-AR,es;q=0.9',
          },
        });

        const location = respuesta.headers.get('location');
        if (respuesta.status < 300 || respuesta.status >= 400 || !location) {
          break;
        }
        await respuesta.body?.cancel();
        if (saltos >= MAX_REDIRECCIONES) {
          return { ok: false, error: `Demasiadas redirecciones en ${url}` };
        }
        const destino = new URL(location, actual);
        if (
          !['http:', 'https:'].includes(destino.protocol) ||
          sitioDe(destino) !== sitio
        ) {
          return {
            ok: false,
            error: `Redirección fuera del portal (${destino.host}) en ${url}`,
          };
        }
        actual = destino.toString();
      }

      if (!respuesta.ok) {
        return { ok: false, error: `HTTP ${respuesta.status} en ${url}` };
      }

      // El portal sirve ISO-8859-1: hay que decodificar desde los bytes, no
      // usar `respuesta.text()`, que asume UTF-8 y rompe todos los acentos.
      const bytes = await this.leerConTope(respuesta);
      if (!bytes) {
        return {
          ok: false,
          error: `La respuesta supera el tamaño máximo de ${MAX_BYTES_RESPUESTA} bytes en ${url}`,
        };
      }
      return { ok: true, html: decodificarHtml(bytes) };
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo leer ${url}: ${detalle}`);
      return { ok: false, error: `${detalle} en ${url}` };
    }
  }

  /**
   * Lee el cuerpo por stream y corta apenas pasa `MAX_BYTES_RESPUESTA`, en vez
   * de `arrayBuffer()`, que junta todo antes de poder mirar el tamaño. Si el
   * servidor declara un `content-length` mayor, ni siquiera se empieza.
   * Devuelve `null` si se pasó del tope.
   */
  private async leerConTope(respuesta: Response): Promise<Buffer | null> {
    const declarado = Number(respuesta.headers.get('content-length'));
    if (Number.isFinite(declarado) && declarado > MAX_BYTES_RESPUESTA) {
      await respuesta.body?.cancel();
      return null;
    }
    if (!respuesta.body) return Buffer.alloc(0);

    const lector = respuesta.body.getReader();
    const trozos: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES_RESPUESTA) {
        await lector.cancel();
        return null;
      }
      trozos.push(value);
    }
    return Buffer.concat(trozos);
  }
}
