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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { JwtPayload } from './interfaces';
import { LoginDto, AuthResponseDto } from './dto';

/**
 * Origen de la request, para enriquecer los eventos de auditoría de auth
 * (A-06). El interceptor global no cubre `/auth/*` — esas rutas se auditan a
 * mano acá —, así que la IP y el User-Agent tienen que viajar desde el
 * controller. Son justo los eventos donde el dato más importa: sin IP no se
 * distingue un credential stuffing de un usuario que se olvidó la contraseña.
 * TODO(T25): unificar este contrato con el de `AuditService.log()`.
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
      await this.logAuditAction(
        null,
        'LOGIN_FAILED',
        'User',
        null,
        { email },
        context,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar que esté activo
    if (!user.isActive) {
      await this.logAuditAction(
        user.id,
        'LOGIN_FAILED',
        'User',
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
      await this.logAuditAction(
        user.id,
        'LOGIN_FAILED',
        'User',
        user.id,
        { email },
        context,
      );
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
    await this.logAuditAction(user.id, 'LOGIN', 'User', user.id, null, context);

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
   */
  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken || !user.isActive) {
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

    await this.logAuditAction(userId, 'LOGOUT', 'User', userId, null, context);
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
   * Helper para registrar acciones de auditoría.
   */
  private async logAuditAction(
    userId: string | null,
    action: string,
    entity: string,
    entityId: string | null,
    changes: Record<string, unknown> | null,
    context: AuthRequestContext = {},
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entity,
          entityId,
          changes: changes ? (changes as Prisma.InputJsonValue) : undefined,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to create audit log: ${error}`);
    }
  }
}
