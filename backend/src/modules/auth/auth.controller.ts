// ===========================================
// Auth Controller
// ===========================================
import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Ip,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, AuthResponseDto, RefreshResponseDto } from './dto';
import { JwtAuthGuard, JwtRefreshGuard } from './guards';
import {
  REFRESH_TOKEN_COOKIE,
  buildRefreshCookieOptions,
  buildClearCookieOptions,
} from './auth.cookies';
import { Public, CurrentUser } from '../../common/decorators';
import type { JwtPayload } from './interfaces';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 intentos cada 15 min
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autenticación con email y contraseña. El access token se devuelve en el ' +
      'body (el cliente lo mantiene en memoria) y el refresh token se setea como ' +
      'cookie httpOnly: nunca es accesible desde JavaScript.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 403, description: 'Usuario desactivado' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos de login' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    // El origen se toma acá y no en el service: el service no conoce la request.
    // `@Ip()` devuelve `request.ip`, que respeta X-Forwarded-For gracias al
    // `trust proxy` de main.ts (A-06).
    const { refreshToken, ...authResponse } = await this.authService.login(
      loginDto,
      { ipAddress: ip, userAgent },
    );

    this.setRefreshCookie(response, refreshToken);

    return authResponse;
  }

  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar token',
    description:
      'Genera un nuevo access token a partir del refresh token de la cookie ' +
      '`evita_refresh_token`. Rota el refresh token y actualiza la cookie.',
  })
  @ApiResponse({
    status: 200,
    description: 'Token renovado',
    type: RefreshResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Refresh token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Refresh token revocado' })
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  async refresh(
    @CurrentUser() user: JwtPayload & { refreshToken: string },
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<RefreshResponseDto> {
    // El origen viaja igual que en login/logout: si acá se detecta reuso de
    // refresh token, la IP es el único dato que permite ubicar de dónde salió
    // la copia robada.
    const tokens = await this.authService.refreshTokens(
      user.sub,
      user.refreshToken,
      { ipAddress: ip, userAgent },
    );

    this.setRefreshCookie(response, tokens.refreshToken);

    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar sesión',
    description:
      'Invalida el refresh token del usuario y borra la cookie del navegador.',
  })
  @ApiResponse({ status: 200, description: 'Sesión cerrada' })
  @ApiBearerAuth('access-token')
  async logout(
    @CurrentUser('sub') userId: string,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.authService.logout(userId, { ipAddress: ip, userAgent });

    response.clearCookie(
      REFRESH_TOKEN_COOKIE,
      buildClearCookieOptions(this.configService),
    );

    return { message: 'Sesión cerrada exitosamente' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener usuario actual',
    description:
      'Retorna el perfil del usuario autenticado. El cliente lo usa para ' +
      'rehidratar la sesión al arrancar, en lugar de leerlo de localStorage.',
  })
  @ApiBearerAuth('access-token')
  async me(@CurrentUser('sub') userId: string) {
    return this.authService.getProfile(userId);
  }

  /** Setea la cookie httpOnly con el refresh token recién emitido. */
  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      buildRefreshCookieOptions(this.configService),
    );
  }
}
