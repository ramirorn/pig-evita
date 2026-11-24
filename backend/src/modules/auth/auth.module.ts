// ===========================================
// Auth Module
// ===========================================
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthTokensService } from './auth-tokens.service';
import { AuthController } from './auth.controller';
import { JwtStrategy, JwtRefreshStrategy } from './strategies';
import { RevocacionSesionesService } from './session-revocation.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Secrets se pasan dinámicamente en el service
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokensService,
    JwtStrategy,
    JwtRefreshStrategy,
    // VULN-05 — una sola instancia, compartida con `UsersService` (que marca
    // las revocaciones) y `JwtStrategy` (que las aplica).
    RevocacionSesionesService,
  ],
  exports: [AuthService, RevocacionSesionesService],
})
export class AuthModule {}
