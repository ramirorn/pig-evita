// ===========================================
// RolesGuard — deny-by-default (VULN-45)
// ===========================================
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AnyAuthenticated, Public, Roles } from '../decorators';
import { Role } from '../constants';

/** Arma un ExecutionContext mínimo con el handler decorado y el usuario. */
function contexto(
  decoradores: MethodDecorator[],
  user: unknown,
): ExecutionContext {
  class Controlador {
    handler() {}
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    Controlador.prototype,
    'handler',
  )!;
  for (const d of decoradores) d(Controlador.prototype, 'handler', descriptor);

  return {
    getHandler: () => Controlador.prototype.handler,
    getClass: () => Controlador,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard (VULN-45)', () => {
  const guard = new RolesGuard(new Reflector());
  const delegado = { sub: 'u', role: Role.DELEGADO };

  it('rechaza (403) una ruta autenticada que no declara @Roles, @Public ni @AnyAuthenticated', () => {
    expect(() => guard.canActivate(contexto([], delegado))).toThrow(
      ForbiddenException,
    );
  });

  it('deja pasar una ruta @Public sin usuario', () => {
    expect(guard.canActivate(contexto([Public()], undefined))).toBe(true);
  });

  it('deja pasar a cualquier rol autenticado en una ruta @AnyAuthenticated', () => {
    expect(
      guard.canActivate(
        contexto([AnyAuthenticated()], { sub: 'e', role: Role.ENTRENADOR }),
      ),
    ).toBe(true);
  });

  it('@AnyAuthenticated sin usuario se rechaza', () => {
    expect(() =>
      guard.canActivate(contexto([AnyAuthenticated()], undefined)),
    ).toThrow(ForbiddenException);
  });

  it('comportamiento previo: @Roles deja pasar al rol listado y rechaza al resto', () => {
    const ctx = (user: unknown) =>
      contexto([Roles(Role.SUPER_ADMIN, Role.DELEGADO)], user);
    expect(guard.canActivate(ctx(delegado))).toBe(true);
    expect(() =>
      guard.canActivate(ctx({ sub: 'a', role: Role.ARBITRO })),
    ).toThrow(ForbiddenException);
  });

  it('comportamiento previo: @Public con @Roles sigue exigiendo el rol', () => {
    expect(() =>
      guard.canActivate(
        contexto([Public(), Roles(Role.SUPER_ADMIN)], undefined),
      ),
    ).toThrow(ForbiddenException);
  });
});
