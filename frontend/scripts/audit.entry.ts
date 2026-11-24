// ===========================================
// Punto de entrada del chequeo de la auditoría (scripts/check-audit.mjs).
// Sólo reexporta código real: el de las etiquetas del frontend y el enum
// `AuditAction` del backend, que `common/constants/index.ts` declara sin
// importar nada (se bundlea sin arrastrar Nest ni Prisma).
// ===========================================
export {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_ENTITY_FILTERS,
  etiquetaAccion,
  etiquetaEntidad,
  tonoAccion,
  autorAuditoria,
  rangoAuditoria,
} from '@/lib/audit/auditLabels';
export { AuditAction } from '../../backend/src/common/constants';
