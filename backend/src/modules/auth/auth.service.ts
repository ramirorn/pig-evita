// ===========================================
// Auth Service
// ===========================================
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../common/constants';
import { JwtPayload } from './interfaces';
import { LoginDto, AuthResponseDto } from './dto';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Login con email y contraseña.
   * Retorna access token + refresh token + datos del usuario.
   */
  async login(
    loginDto: LoginDto,
    context: AuthRequestContext = {},
  ): Promise<AuthResponseDto & { refreshToken: string }> {
    const { email, password } = loginDto;

    // Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      // Log de intento fallido
      await this.audit(AuditAction.LOGIN_FAILED, null, { email }, context);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar que esté activo
    if (!user.isActive) {
      await this.audit(
        AuditAction.LOGIN_FAILED,
        user.id,
        { reason: 'inactive' },
        context,
      );
      throw new ForbiddenException(
        'Usuario desactivado. Contacte al administrador.',
      );
    }

    // Verificar contraseña con Argon2
    const passwordValid = await argon2.verify(user.passwordHash, password);

    if (!passwordValid) {
      await this.audit(AuditAction.LOGIN_FAILED, user.id, { email }, context);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

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

    this.logger.log(`User logged in: ${user.email}`);

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
   * Refresh: genera un nuevo access token usando el refresh token.
   *
   * Los refresh se rotan: cada uso invalida el token anterior. Que llegue un
   * token que ya fue rotado significa que alguien tiene una copia vieja —el
   * indicio más fuerte de robo de sesión que produce el sistema—. Hasta T25
   * esa detección cortaba la sesión y devolvía 403 **sin dejar rastro**: el
   * incidente ocurría y la tabla de auditoría no se enteraba, así que era
   * imposible reconstruirlo después. Ahora queda registrado con IP y
   * User-Agent, que es lo único que permite decir desde dónde vino la copia.
   */
  async refreshTokens(
    userId: string,
    refreshToken: string,
    context: AuthRequestContext = {},
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

    // Generar nuevos tokens (rotación de refresh token)
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // Actualizar refresh token hasheado
    const hashedRefreshToken = await argon2.hash(tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });

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

  /**
   * Genera access token y refresh token.
   */
  private async generateTokens(payload: Omit<JwtPayload, 'type'>): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        {
          secret: this.configService.get<string>('jwt.accessSecret'),
          expiresIn: this.configService.get<string>(
            'jwt.accessExpiration',
          ) as any,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
          expiresIn: this.configService.get<string>(
            'jwt.refreshExpiration',
          ) as any,
        },
      ),
    ]);

    return { accessToken, refreshToken };
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
