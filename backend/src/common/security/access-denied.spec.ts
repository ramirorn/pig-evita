import { isAuthRoute, PerKeyRateCap } from './access-denied';

describe('isAuthRoute', () => {
  it('reconoce las rutas de /auth', () => {
    expect(isAuthRoute('/api/v1/auth/login')).toBe(true);
    expect(isAuthRoute('/api/v1/auth')).toBe(true);
  });

  it('no confunde /authors ni rutas sin auth', () => {
    expect(isAuthRoute('/api/v1/authors')).toBe(false);
    expect(isAuthRoute('/api/v1/participants')).toBe(false);
    expect(isAuthRoute(undefined)).toBe(false);
  });
});

describe('PerKeyRateCap', () => {
  it('deja pasar hasta el tope por clave dentro de la ventana', () => {
    let t = 0;
    const cap = new PerKeyRateCap(2, 1000, () => t);
    expect([cap.allow('ip'), cap.allow('ip'), cap.allow('ip')]).toEqual([
      true,
      true,
      false,
    ]);
    // Otra clave tiene su propio tope.
    expect(cap.allow('otra')).toBe(true);
    // Al vencer la ventana, vuelve a contar desde cero.
    t = 1000;
    expect(cap.allow('ip')).toBe(true);
  });
});
