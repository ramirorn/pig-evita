// ===========================================
// Bloqueo temporal de login por cuenta (VULN-22)
// ===========================================
import { createHash } from 'node:crypto';
import type { RedisCacheService } from '../../common/cache';

const PREFIJO = 'auth:login-fallos:';

/** Tope de cuentas seguidas en memoria, para que un barrido de emails no la agote. */
const MAX_ENTRADAS_LOCALES = 10_000;

interface Contador {
  fallos: number;
  /** Epoch ms en que vence la ventana (y con ella el bloqueo). */
  venceEn: number;
}

export interface OpcionesBloqueo {
  maxFallos: number;
  ventanaMs: number;
}

/**
 * Contador de logins fallidos por email.
 *
 * El `ThrottlerGuard` del login limita por IP; con IPs rotativas un credential
 * stuffing prueba contraseñas contra todas las cuentas sin tocarlo. Acá se
 * cuenta por cuenta: tras `maxFallos` fallos dentro de la ventana, todo intento
 * para ese email se rechaza (sin verificar la contraseña) hasta que la ventana
 * venza. Un login correcto reinicia el contador.
 *
 * - Se cuenta por el email **pedido**, exista o no la cuenta: el bloqueo no
 *   revela qué cuentas existen (VULN-37).
 * - La clave es un SHA-256 del email normalizado: ni la memoria ni Redis
 *   guardan direcciones en claro.
 * - El incremento local es síncrono y por lo tanto atómico dentro del proceso
 *   (N intentos concurrentes cuentan N). Redis, cuando está, agrega
 *   persistencia ante reinicios y lo comparte entre réplicas; su
 *   lectura-escritura no es atómica entre réplicas (el servicio de cache no
 *   expone `INCR` con vencimiento), así que entre réplicas es un mínimo
 *   garantizado, no un conteo exacto.
 * - Riesgo aceptado: un tercero puede bloquear una cuenta legítima durante la
 *   ventana con `maxFallos` intentos. Por eso la ventana es corta y el umbral
 *   holgado.
 */
export class BloqueoPorCuenta {
  private readonly locales = new Map<string, Contador>();

  constructor(
    private readonly opciones: OpcionesBloqueo,
    private readonly cache?: RedisCacheService,
  ) {}

  private clave(email: string): string {
    return (
      PREFIJO +
      createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
    );
  }

  private vigente(c: Contador | null | undefined, ahora: number) {
    return c && typeof c.fallos === 'number' && c.venceEn > ahora ? c : null;
  }

  private async remoto(clave: string, ahora: number): Promise<Contador | null> {
    if (!this.cache?.disponible) return null;
    return this.vigente(await this.cache.get<Contador>(clave), ahora);
  }

  /** `true` si la cuenta alcanzó el tope de fallos dentro de la ventana. */
  async estaBloqueada(email: string): Promise<boolean> {
    const ahora = Date.now();
    const clave = this.clave(email);
    const local = this.vigente(this.locales.get(clave), ahora)?.fallos ?? 0;
    if (local >= this.opciones.maxFallos) return true;
    const remoto = (await this.remoto(clave, ahora))?.fallos ?? 0;
    return remoto >= this.opciones.maxFallos;
  }

  /** Suma un fallo y devuelve el total vigente. */
  async registrarFallo(email: string): Promise<number> {
    const ahora = Date.now();
    const clave = this.clave(email);

    // Primero lo local, sin `await` en el medio: atómico dentro del proceso.
    let local = this.vigente(this.locales.get(clave), ahora);
    if (!local) {
      this.podar(ahora);
      local = { fallos: 0, venceEn: ahora + this.opciones.ventanaMs };
      this.locales.set(clave, local);
    }
    local.fallos += 1;

    if (this.cache?.disponible) {
      const remoto = await this.remoto(clave, ahora);
      if (remoto && remoto.fallos + 1 > local.fallos) {
        local.fallos = remoto.fallos + 1;
        local.venceEn = Math.max(local.venceEn, remoto.venceEn);
      }
      await this.cache.setex(
        clave,
        Math.max(1, Math.ceil((local.venceEn - ahora) / 1000)),
        { fallos: local.fallos, venceEn: local.venceEn },
      );
    }
    return local.fallos;
  }

  /** Login correcto: el contador vuelve a cero. */
  async limpiar(email: string): Promise<void> {
    const clave = this.clave(email);
    this.locales.delete(clave);
    if (this.cache?.disponible) {
      // Sin `DEL` en el servicio de cache: se pisa con un contador vencido.
      await this.cache.setex(clave, 1, { fallos: 0, venceEn: 0 });
    }
  }

  private podar(ahora: number): void {
    if (this.locales.size < MAX_ENTRADAS_LOCALES) return;
    for (const [clave, c] of this.locales) {
      if (c.venceEn <= ahora) this.locales.delete(clave);
    }
    // Si sigue lleno, se descartan los más viejos (orden de inserción).
    for (const clave of this.locales.keys()) {
      if (this.locales.size < MAX_ENTRADAS_LOCALES) break;
      this.locales.delete(clave);
    }
  }
}
