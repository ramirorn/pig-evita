// ===========================================
// Audit Module
// ===========================================
import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditAccessDeniedRecorder } from './audit-access-denied.recorder';
import { ACCESS_DENIED_RECORDER } from '../../common/security/access-denied';

@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditInterceptor,
    // VULN-27 — el filtro global depende del puerto, no de este módulo.
    { provide: ACCESS_DENIED_RECORDER, useClass: AuditAccessDeniedRecorder },
  ],
  exports: [AuditService, AuditInterceptor, ACCESS_DENIED_RECORDER],
})
export class AuditModule {}
