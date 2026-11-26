import { AuditAction } from '../../common/constants';
import type { AccessDeniedEvent } from '../../common/security/access-denied';
import { AuditAccessDeniedRecorder } from './audit-access-denied.recorder';
import type { AuditService } from './audit.service';

const evento = (ip: string | null = '1.2.3.4'): AccessDeniedEvent => ({
  status: 403,
  method: 'PATCH',
  path: '/api/v1/venues/x',
  userId: 'u-1',
  ipAddress: ip,
  userAgent: 'jest',
});

function recorder() {
  const log = jest.fn().mockResolvedValue(undefined);
  return {
    log,
    recorder: new AuditAccessDeniedRecorder({ log } as unknown as AuditService),
  };
}

describe('AuditAccessDeniedRecorder (VULN-27)', () => {
  it('guarda el acceso denegado como ACCESS_DENIED, con ruta y sin query', () => {
    const { log, recorder: r } = recorder();
    r.record(evento());
    expect(log).toHaveBeenCalledWith({
      userId: 'u-1',
      action: AuditAction.ACCESS_DENIED,
      entity: 'Route',
      entityId: null,
      changes: { status: 403, method: 'PATCH', path: '/api/v1/venues/x' },
      ipAddress: '1.2.3.4',
      userAgent: 'jest',
    });
  });

  it('con más de 10 por IP y minuto deja de escribir (no se llena la tabla)', () => {
    const { log, recorder: r } = recorder();
    for (let i = 0; i < 25; i++) r.record(evento());
    r.record(evento('5.6.7.8'));
    expect(log).toHaveBeenCalledTimes(11);
  });
});
