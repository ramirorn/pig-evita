// ===========================================
// Swagger sólo en desarrollo explícito (VULN-13)
// ===========================================
import { swaggerHabilitado } from './swagger';

describe('swaggerHabilitado', () => {
  it('sin NODE_ENV no se publica (falla cerrado)', () => {
    expect(swaggerHabilitado(undefined)).toBe(false);
    expect(swaggerHabilitado('')).toBe(false);
  });

  it('un valor desconocido tampoco lo publica', () => {
    expect(swaggerHabilitado('staging')).toBe(false);
  });

  it('comportamiento previo: en desarrollo y en test se publica; en producción no', () => {
    expect(swaggerHabilitado('development')).toBe(true);
    expect(swaggerHabilitado('test')).toBe(true);
    expect(swaggerHabilitado('production')).toBe(false);
  });
});
