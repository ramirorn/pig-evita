// ===========================================
// Accesos denegados en la auditoría (VULN-27)
// ===========================================
import { Injectable } from '@nestjs/common';
import { AuditAction } from '../../common/constants';
import {
  AccessDeniedEvent,
  AccessDeniedRecorder,
  PerKeyRateCap,
} from '../../common/security/access-denied';
import { AuditService } from './audit.service';

/** Como mucho 10 filas por IP y minuto; el resto queda sólo en el log. */
const MAX_PER_IP_PER_MINUTE = 10;

/**
 * Guarda cada 401/403 como `ACCESS_DENIED` en `audit_logs`, para poder ver
 * desde el panel intentos repetidos de una cuenta o una IP. Antes sólo
 * quedaban en el log de aplicación, sin retención definida.
 */
@Injectable()
export class AuditAccessDeniedRecorder implements AccessDeniedRecorder {
  private readonly cap = new PerKeyRateCap(MAX_PER_IP_PER_MINUTE, 60_000);

  constructor(private readonly audit: AuditService) {}

  record(event: AccessDeniedEvent): void {
    if (!this.cap.allow(event.ipAddress ?? 'sin-ip')) return;
    // `AuditService.log` no lanza: si la fila no entra, avisa por log.
    void this.audit.log({
      userId: event.userId,
      action: AuditAction.ACCESS_DENIED,
      entity: 'Route',
      entityId: null,
      changes: {
        status: event.status,
        method: event.method,
        path: event.path ?? null,
      },
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    });
  }
}
