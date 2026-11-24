// ===========================================
// Auth Service
// ===========================================
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../common/constants';
import { RedisCacheService } from '../../common/cache';
import { AuthTokensService, identityOf } from './auth-tokens.service';
import { LoginDto, AuthResponseDto } from './dto';
import { parseDurationToMs } from './auth.cookies';
import { BloqueoPorCuenta } from './login-lockout';
import {
  DEFAULT_LOGIN_LOCKOUT_MAX_ATTEMPTS,
  DEFAULT_LOGIN_LOCKOUT_WINDOW,
  DEFAULT_SESSION_MAX_AGE,
} from './auth.constants';

/** Mensaje único de login fallido (VULN-37): no distingue la causa. */
const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';

/**
 * Origen de la request, para enriquecer los eventos de auditoría de auth
 * (A-06). El interceptor global no cubre `/auth/*` — esas rutas se auditan a
 * mano acá —, así que la IP y el User-Agent tienen que viajar desde el
 * controller. Son justo los eventos donde el dato más importa: sin IP no se
 * distingue un credential stuffing de un usuario que se olvidó la contraseña.
 *
 * T25: el helper privado que escribía en `auditLog` a mano desapareció; estos
 * eventos ahora pasan por `AuditService.log()` como todos los demás, así el
 * saneamiento de `changes` y el formato de la fila son uno solo.
 */
export interface AuthRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bloqueo: BloqueoPorCuenta;

  /**
   * Hash Argon2 de un valor aleatorio, contra el que se verifica la contraseña
   * cuando el email no existe (VULN-37). Se calcula una sola vez, en segundo
   * plano, con los mismos parámetros que los hashes reales: así "no existe"
   * cuesta lo mismo que "contraseña incorrecta".
   */
  private readonly hashFicticio: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: AuthTokensService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    @Optional() cache?: RedisCacheService,
  ) {
    const maxFallos = Number(
      this.configService.get<string>('LOGIN_LOCKOUT_MAX_ATTEMPTS') ??
        DEFAULT_LOGIN_LOCKOUT_MAX_ATTEMPTS,
    );
    this.bloqueo = new BloqueoPorCuenta(
      {
        maxFallos:
          Number.isInteger(maxFallos) && maxFallos > 0
            ? maxFallos
            : DEFAULT_LOGIN_LOCKOUT_MAX_ATTEMPTS,
        ventanaMs: parseDurationToMs(
          this.configService.get<string>('LOGIN_LOCKOUT_WINDOW'),
          parseDurationToMs(DEFAULT_LOGIN_LOCKOUT_WINDOW),
        ),
      },
      cache,
    );
    this.hashFicticio = argon2.hash(randomUUID());
    // Si fallara, se vuelve a intentar en el primer login que lo necesite.
    this.hashFicticio.catch(() => undefined);
  }

  /**
   * Login con email y contraseña.
   * Retorna access token + refresh token + datos del usuario.
   */
  async login(
    loginDto: LoginDto,
    context: AuthRequestContext = {},
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    const { email, password } = loginDto;
    const emailNormalizado = email.toLowerCase().trim();

    // VULN-22 — bloqueo temporal por cuenta. Se resuelve antes de tocar la
    // base o Argon2: un intento contra una cuenta bloqueada no cuesta nada y
    // no da información (se bloquea igual un email que no existe).
    if (await this.bloqueo.estaBloqueada(emailNormalizado)) {
      await this.audit(
        AuditAction.LOGIN_FAILED,
        null,
        { email, reason: 'account_locked' },
        context,
      );
      throw new HttpException(
        'Demasiados intentos fallidos para esta cuenta. Intente nuevamente en unos minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: emailNormalizado },
    });

    // VULN-37 — la contraseña se verifica **siempre** y primero, también
    // cuando el email no existe (contra un hash ficticio) o la cuenta está
    // inactiva. El resultado es un único 401 genérico: ni el mensaje ni el
    // tiempo de respuesta distinguen "no existe", "inactiva" o "contraseña
    // incorrecta". La causa real queda en la auditoría.
    const hash = user?.passwordHash ?? (await this.obtenerHashFicticio());
    const passwordValid = await argon2
      .verify(hash, password)
      .catch(() => false);

    if (!user || !passwordValid || !user.isActive) {
      await this.bloqueo.registrarFallo(emailNormalizado);
      await this.audit(
        AuditAction.LOGIN_FAILED,
        user?.id ?? null,
        user && !user.isActive ? { reason: 'inactive' } : { email },
        context,
      );
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    await this.bloqueo.limpiar(emailNormalizado);

    // El inicio de la sesión viaja en el refresh (VULN-39).
    const tokens = await this.tokens.issue(
      identityOf(user),
      Math.floor(Date.now() / 1000),
    );

    // Guardar refresh token hasheado
    const hashedRefreshToken = await argon2.hash(tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: hashedRefreshToken,
        lastLoginAt: new Date(),
      },
    });

    // Log de login exitoso
    await this.audit(AuditAction.LOGIN, user.id, null, context);

    // VULN-25 — el id interno alcanza para correlacionar; el email no va al log.
    this.logger.log(`User logged in: ${user.id}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Rota el par de tokens. Cada uso invalida el refresh anterior: si llega uno
   * ya rotado, alguien tiene una copia vieja —el indicio más fuerte de robo de
   * sesión— y se revocan las sesiones y se audita con IP y User-Agent (T25).
   */
  async refreshTokens(
    userId: string,
    refreshToken: string,
    context: AuthRequestContext = {},
    inicioSesion?: number,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken || !user.isActive) {
      // Token bien firmado contra una sesión que ya no existe (o una cuenta
      // desactivada). No prueba robo, pero en volumen delata el uso de tokens
      // viejos, así que se registra con su propia acción para no confundirlo
      // con el caso grave de abajo.
      await this.audit(
        AuditAction.REFRESH_TOKEN_DENIED,
        user ? userId : null,
        {
          reason: !user
            ? 'user_not_found'
            : !user.isActive
              ? 'user_inactive'
              : 'no_active_session',
        },
        context,
      );
      throw new ForbiddenException('Acceso denegado');
    }

    // Verificar que el refresh token coincida
    const refreshTokenValid = await argon2.verify(
      user.refreshToken,
      refreshToken,
    );

    if (!refreshTokenValid) {
      // Posible robo de token — invalidar todos los refresh tokens
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });

      // Se audita *después* de revocar, no antes: si la escritura de la fila
      // fallara, la sesión igual queda cerrada. La seguridad no depende de que
      // la auditoría funcione.
      await this.audit(
        AuditAction.REFRESH_TOKEN_REUSE,
        userId,
        { reason: 'token_mismatch', sessionsRevoked: true },
        context,
      );
      this.logger.warn(
        `Refresh token reuse detected for user ${userId} — sessions revoked`,
      );

      throw new ForbiddenException(
        'Refresh token inválido. Sesión cerrada por seguridad.',
      );
    }

    // VULN-39 — vida absoluta: el inicio de la sesión (`auth_time`) viaja de
    // refresh en refresh y, pasada la vida máxima, se cierra aunque el token
    // esté vigente. Va después de verificar el hash para cerrar sólo la vigente.
    const ahoraSeg = Math.floor(Date.now() / 1000);
    const inicio = inicioSesion ?? ahoraSeg;
    if (ahoraSeg - inicio > this.vidaMaximaSesionSeg()) {
      await this.prisma.user.updateMany({
        where: { id: userId, refreshToken: user.refreshToken },
        data: { refreshToken: null },
      });
      await this.audit(
        AuditAction.REFRESH_TOKEN_DENIED,
        userId,
        { reason: 'session_expired' },
        context,
      );
      throw new ForbiddenException('Sesión vencida. Inicie sesión nuevamente.');
    }

    const tokens = await this.tokens.issue(identityOf(user), inicio);

    // R04 — rotación condicional sobre el hash leído: un solo
    // `UPDATE ... WHERE id AND refresh_token`, atómico. Con N refresh
    // concurrentes del mismo token sólo uno encuentra la fila; `count === 0`
    // significa que dos portadores del mismo refresh están vivos: reuso.
    const hashedRefreshToken = await argon2.hash(tokens.refreshToken);
    const rotacion = await this.prisma.user.updateMany({
      where: { id: userId, refreshToken: user.refreshToken },
      data: { refreshToken: hashedRefreshToken },
    });

    if (rotacion.count === 0) {
      // Perdió la carrera: se revocan todas las sesiones, incluida la del
      // ganador. La revocación es condicional para que, entre N perdedores,
      // uno solo audite: un incidente, una fila.
      const revocacion = await this.prisma.user.updateMany({
        where: { id: userId, refreshToken: { not: null } },
        data: { refreshToken: null },
      });

      if (revocacion.count > 0) {
        await this.audit(
          AuditAction.REFRESH_TOKEN_REUSE,
          userId,
          { reason: 'concurrent_rotation', sessionsRevoked: true },
          context,
        );
        this.logger.warn(
          `Refresh token reuse detected for user ${userId} (rotación concurrente) — sessions revoked`,
        );
      }

      throw new ForbiddenException(
        'Refresh token inválido. Sesión cerrada por seguridad.',
      );
    }

    return tokens;
  }

  /**
   * Perfil del usuario autenticado.
   *
   * El cliente ya no guarda el objeto `user` en `localStorage` (hallazgo F17):
   * lo rehidrata llamando a este endpoint en cada arranque, de modo que el
   * servidor es la única fuente de verdad sobre nombre, email y rol.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const { isActive: _isActive, ...profile } = user;
    return profile;
  }

  /**
   * Logout: invalida el refresh token del usuario.
   */
  async logout(
    userId: string,
    context: AuthRequestContext = {},
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    await this.audit(AuditAction.LOGOUT, userId, null, context);
    this.logger.log(`User logged out: ${userId}`);
  }

  /** Vida absoluta de la sesión en segundos (`JWT_SESSION_MAX_AGE`, 12 h). */
  private vidaMaximaSesionSeg(): number {
    return Math.floor(
      parseDurationToMs(
        this.configService.get<string>('JWT_SESSION_MAX_AGE'),
        parseDurationToMs(DEFAULT_SESSION_MAX_AGE),
      ) / 1000,
    );
  }

  /** El hash ficticio; si su cálculo inicial falló, se reintenta acá. */
  private async obtenerHashFicticio(): Promise<string> {
    try {
      return await this.hashFicticio;
    } catch {
      return argon2.hash(randomUUID());
    }
  }

  /**
   * Registra un evento no-CRUD de autenticación.
   *
   * Es un envoltorio fino sobre `AuditService.log()` —no una implementación
   * paralela— que sólo fija lo que en auth es siempre igual: la entidad es
   * `User` y el `entityId` es el usuario del evento. Todo lo demás (formato de
   * la fila, saneamiento de `changes`, tolerancia a fallos) vive en un solo
   * lugar.
   */
  private async audit(
    action: AuditAction,
    userId: string | null,
    changes: Record<string, unknown> | null,
    context: AuthRequestContext = {},
  ): Promise<void> {
    await this.auditService.log({
      userId,
      action,
      entity: 'User',
      entityId: userId,
      changes,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
  }
}
