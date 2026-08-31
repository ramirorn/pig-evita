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
import { decodificarHtml, urlDeNota } from './formosa-news.parser';

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
  async traerNota(id: number): Promise<RespuestaDelPortal> {
    const url = urlDeNota(id);

    try {
      const respuesta = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-AR,es;q=0.9',
        },
      });

      if (!respuesta.ok) {
        return { ok: false, error: `HTTP ${respuesta.status} en ${url}` };
      }

      // El portal sirve ISO-8859-1: hay que decodificar desde los bytes, no
      // usar `respuesta.text()`, que asume UTF-8 y rompe todos los acentos.
      const bytes = Buffer.from(await respuesta.arrayBuffer());
      return { ok: true, html: decodificarHtml(bytes) };
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.warn(`No se pudo leer ${url}: ${detalle}`);
      return { ok: false, error: `${detalle} en ${url}` };
    }
  }
}
