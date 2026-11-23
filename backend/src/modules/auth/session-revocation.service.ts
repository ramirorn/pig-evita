// ===========================================
// Revocación de access tokens ya emitidos (VULN-05)
// ===========================================
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../../common/cache';
import { parseDurationToMs } from './auth.cookies';
import { DEFAULT_ACCESS_EXPIRATION } from './auth.constants';

const PREFIJO = 'auth:revocado:';

/**
 * Registro de "todo lo emitido hasta acá para este usuario ya no vale".
 *
 * El access token es autocontenido: `JwtStrategy` no consulta la base, así que
 * cambiarle la contraseña, el rol, el alcance o el estado a un usuario no
 * cortaba los access tokens que ya tenía (hasta 15 min con un rol o un estado
 * viejo). Releer el usuario en cada request costaría una consulta a Postgres
 * por llamada; en su lugar, quien hace el cambio marca al usuario acá, y
 * `JwtStrategy` rechaza los tokens con `iat` igual o anterior a la marca.
 *
 * - La marca vive lo mismo que un access token: pasado ese tiempo no queda
 *   ningún token viejo vivo y la entrada sobra.
 * - Se guarda en memoria **y** en Redis cuando está disponible. Memoria basta
 *   con una sola réplica; Redis la comparte entre réplicas y sobrevive a un
 *   reinicio. Si Redis cae, queda la memoria local (falla hacia lo que había
 *   antes, nunca hacia un 500).
 * - Costo por request: una búsqueda en un `Map` y, con Redis, un GET.
 * - Resolución de un segundo (la del `iat`): un token emitido en el mismo
 *   segundo que la revocación también se rechaza. Es preferible a dejar pasar
 *   uno robado; el costo es que un login en ese mismo segundo tenga que
 *   repetirse.
 */
@Injectable()
export class RevocacionSesionesService {
  private readonly locales = new Map<
    string,
    { revocadoEn: number; venceEn: number }
  >();

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly cache?: RedisCacheService,
  ) {}

  private vidaMs(): number {
    return parseDurationToMs(
      this.configService.get<string>('jwt.accessExpiration'),
      parseDurationToMs(DEFAULT_ACCESS_EXPIRATION),
    );
  }

  /** Invalida todos los access tokens emitidos hasta este momento. */
  async revocar(userId: string): Promise<void> {
    const ahora = Date.now();
    const vida = this.vidaMs();
    this.podar(ahora);
    this.locales.set(userId, { revocadoEn: ahora, venceEn: ahora + vida });
    await this.cache?.setex(
      `${PREFIJO}${userId}`,
      Math.ceil(vida / 1000),
      ahora,
    );
  }

  /**
   * `true` si el token con ese `iat` (segundos) fue emitido antes o en el
   * mismo segundo de la última revocación del usuario.
   */
  async estaRevocado(userId: string, iat?: number): Promise<boolean> {
    const ahora = Date.now();
    let revocadoEn = 0;

    const local = this.locales.get(userId);
    if (local && local.venceEn > ahora) revocadoEn = local.revocadoEn;

    if (this.cache?.disponible) {
      const remoto = await this.cache.get<number>(`${PREFIJO}${userId}`);
      if (typeof remoto === 'number' && remoto > revocadoEn) {
        revocadoEn = remoto;
      }
    }

    if (!revocadoEn) return false;
    // Sin `iat` no se puede probar que sea posterior: se rechaza.
    if (typeof iat !== 'number') return true;
    return iat <= Math.floor(revocadoEn / 1000);
  }

  private podar(ahora: number): void {
    for (const [id, entrada] of this.locales) {
      if (entrada.venceEn <= ahora) this.locales.delete(id);
    }
  }
}
