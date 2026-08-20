// ===========================================
// Contrato de auditoría (T25 / hallazgo Q10)
// ===========================================
import { SetMetadata, applyDecorators } from '@nestjs/common';

/** Clave de metadata que lee el `AuditInterceptor`. */
export const AUDIT_KEY = 'audit:options';

/**
 * Opciones de refinamiento de la auditoría automática de un endpoint.
 */
export interface AuditOptions {
  /**
   * Nombre de entidad a registrar. Sólo hace falta cuando el primer segmento
   * de la URL no es el nombre correcto (por ejemplo un endpoint anidado que
   * en realidad escribe sobre otra tabla).
   */
  entity?: string;

  /**
   * Acción a registrar. Sólo hace falta cuando el verbo HTTP no describe lo
   * que pasó: un `PATCH /inscriptions/:id/approve` es un UPDATE para HTTP
   * pero un APPROVE_INSCRIPTION para el negocio.
   */
  action?: string;

  /**
   * Excluye el endpoint de la auditoría automática. Ver `@NoAudit()`.
   */
  skip?: boolean;
}

/**
 * ============================================================
 * CONTRATO DE AUDITORÍA DEL SISTEMA — leer antes de tocar nada
 * ============================================================
 *
 * Hay exactamente dos vías para que una fila entre en `AuditLog`, y son
 * mutuamente excluyentes. Esta separación es lo que garantiza el DoD de T25:
 * una operación produce **una** fila, nunca dos, nunca cero.
 *
 * --- Vía 1: el `AuditInterceptor` (CRUD) ---------------------
 *
 * Cubre automáticamente **toda** request POST / PATCH / PUT / DELETE que
 * termine bien, y la registra como CREATE / UPDATE / UPDATE / DELETE.
 * La entidad sale del primer segmento de la URL (`/api/v1/teams/:id` →
 * `teams`) y el `entityId` del primer UUID que aparezca en la ruta o, si es
 * una creación, del `id` que devuelve el controller.
 *
 * **El comportamiento por defecto es auditar.** No hace falta decorar nada
 * para que un endpoint de escritura quede registrado, y por eso un endpoint
 * nuevo nace auditado aunque quien lo escriba no conozca este archivo.
 *
 * Se eligió este esquema *opt-out* por encima de un *opt-in* estricto —donde
 * sólo se auditaría lo decorado con `@Audit()`— porque los dos modos fallan de
 * maneras muy distintas cuando alguien se olvida del decorador:
 *
 *   - opt-in  → el endpoint queda **sin auditar y en silencio**. El agujero es
 *               invisible: nadie mira una tabla para buscar filas que no están.
 *               Es una regresión de seguridad que se descubre recién cuando
 *               hay que investigar un incidente y no hay rastro.
 *   - opt-out → el endpoint queda auditado con un nombre de entidad derivado
 *               de la URL, que en el peor caso es impreciso. El defecto es
 *               ruido, no ceguera, y se ve a simple vista en la tabla.
 *
 * Entre perder evidencia y guardar evidencia mal etiquetada, esta base elige
 * lo segundo. El test `test/audit-contract.e2e-spec.ts` recorre todas las
 * rutas de escritura registradas y falla si alguna derivara una entidad
 * inservible (`unknown`), que es la única forma en que el default puede
 * degradarse sin que nadie se entere.
 *
 * --- Vía 2: llamadas manuales a `AuditService.log()` ---------
 *
 * Reservadas **exclusivamente** para eventos que no son CRUD y que el
 * interceptor no puede ver: LOGIN, LOGIN_FAILED, LOGOUT y los eventos de
 * refresh token. Todos ellos viven en `AuthService`, y las rutas `/auth/*`
 * están excluidas del interceptor justamente para que no haya doble registro.
 *
 * **Regla dura: un service nunca llama a `auditService.log()` para registrar
 * un CREATE / UPDATE / DELETE.** Eso ya lo hace el interceptor; agregarlo a
 * mano duplica la fila. Si lo que falta es un nombre de acción más expresivo,
 * la solución es `@Audit({ action })` sobre el handler, no una llamada extra.
 *
 * @example Corregir la acción de un endpoint de negocio
 * ```ts
 * @Patch(':id/approve')
 * @Audit({ action: AuditAction.APPROVE_INSCRIPTION })
 * approve(...) {}
 * ```
 *
 * @example Corregir la entidad cuando la URL engaña
 * ```ts
 * @Post(':id/members')
 * @Audit({ entity: 'team_members' })
 * addMember(...) {}
 * ```
 *
 * @see NoAudit para excluir un endpoint.
 * @see AuditService.log — sanitiza `changes` para las dos vías por igual.
 */
export const Audit = (options: AuditOptions | string = {}) =>
  applyDecorators(
    SetMetadata(
      AUDIT_KEY,
      typeof options === 'string' ? { entity: options } : options,
    ),
  );

/**
 * Excluye explícitamente un endpoint de escritura de la auditoría automática.
 *
 * Existe para que "este endpoint no se audita" sea una decisión escrita y
 * revisable en el diff, en lugar de un olvido. Usarlo con cuentagotas: sólo
 * para escrituras sin valor forense (health checks, webhooks idempotentes de
 * terceros, endpoints de altísima frecuencia que inundarían la tabla). Si se
 * usa, dejar al lado el motivo.
 */
export const NoAudit = () => Audit({ skip: true });
