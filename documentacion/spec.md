# spec.md — Especificación del MVP

> **Producto:** Plataforma Integral de Gestión — Juegos Evita Formosa
> **Versión objetivo:** MVP (V1)
> **Estado:** En desarrollo
> **Última actualización:** 2026-08-19

Este documento define **QUÉ** debe hacer el sistema en su primera versión productiva. El **CÓMO** se detalla en `plan.md` y el desglose de trabajo en `tasks.md`.

---

## 1. Objetivo del MVP

Entregar una plataforma web que permita a la Secretaría de Deportes de Formosa gestionar el ciclo esencial de los Juegos Evita: **autenticar usuarios con distintos niveles de responsabilidad**, **inscribir participantes generando un identificador QR único**, y **organizar competencias registrando resultados** consultables públicamente.

El MVP se considera terminado cuando un delegado puede inscribir a un participante, un administrador puede aprobar esa inscripción, la inscripción figura en una competencia y un árbitro puede cargar el resultado del partido correspondiente — todo end-to-end.

---

## 2. Actores del sistema

| Actor | Descripción |
|---|---|
| **Visitante público** | Cualquier persona que accede sin autenticarse |
| **Delegado** | Responsable de una delegación; inscribe participantes |
| **Administrador Departamental / Provincial / Super Admin** | Aprueba/rechaza inscripciones y gestiona el catálogo |
| **Árbitro / Operador de Mesa** | Carga resultados de partidos |

---

## 3. Historias de Usuario

### Épica A — Autenticación y RBAC

#### HU-A1 — Login de usuarios administrativos

> **Como** usuario del sistema (delegado, administrador, árbitro...)
> **quiero** iniciar sesión con mi email y contraseña
> **para** acceder a las funcionalidades correspondientes a mi rol.

**Criterios de aceptación:**

- **CA-A1.1** El sistema acepta email + contraseña y devuelve `accessToken` (JWT, 15 min) y `refreshToken` (7 días).
- **CA-A1.2** Tras 5 intentos fallidos en 15 minutos desde una misma IP, el endpoint responde `429 Too Many Requests`.
- **CA-A1.3** Las contraseñas se almacenan hasheadas con Argon2. Nunca en texto plano.
- **CA-A1.4** Con un `refreshToken` válido, el usuario puede obtener un nuevo `accessToken` sin volver a autenticarse.
- **CA-A1.5** El endpoint `POST /auth/logout` invalida el refresh token vigente.
- **CA-A1.6** El frontend persiste el `accessToken` en memoria y el `refreshToken` en cookie httpOnly (o localStorage si el backend no la setea).

#### HU-A2 — Autorización por rol (RBAC)

> **Como** propietario del sistema
> **quiero** que cada endpoint sea accesible solo por los roles autorizados
> **para** garantizar que un delegado no pueda aprobar sus propias inscripciones ni un árbitro modificar el catálogo.

**Criterios de aceptación:**

- **CA-A2.1** Existen al menos 5 roles funcionales en el MVP: `SUPER_ADMIN`, `ADMIN_PROVINCIAL`, `ADMIN_DEPARTAMENTAL`, `DELEGADO`, `ARBITRO`.
- **CA-A2.2** Un `JwtAuthGuard` global rechaza toda petición sin token válido salvo rutas marcadas `@Public()`.
- **CA-A2.3** Un `RolesGuard` global verifica el rol contra el decorador `@Roles(...)` y devuelve `403 Forbidden` si no coincide.
- **CA-A2.4** El frontend oculta las rutas del sidebar que el usuario no puede visitar según su rol.

#### HU-A3 — Gestión mínima de usuarios

> **Como** Super Admin
> **quiero** crear, listar y desactivar usuarios administrativos
> **para** dar/retirar accesos a mis colaboradores.

**Criterios de aceptación:**

- **CA-A3.1** Solo `SUPER_ADMIN` puede crear usuarios; los `ADMIN_PROVINCIAL` pueden listarlos.
- **CA-A3.2** El listado es paginado (default `pageSize = 20`) y filtrable por rol y estado activo.
- **CA-A3.3** La desactivación es soft delete (`isActive = false`). El usuario desactivado no puede iniciar sesión.

---

### Épica B — Participantes e Inscripciones con QR

#### HU-B1 — Registro de participantes

> **Como** delegado
> **quiero** registrar los datos personales de un participante
> **para** poder inscribirlo luego en una o más disciplinas.

**Criterios de aceptación:**

- **CA-B1.1** Se capturan como mínimo: nombre, apellido, DNI, fecha de nacimiento, sexo, localidad, departamento.
- **CA-B1.2** El DNI es único a nivel sistema. Un segundo alta con el mismo DNI devuelve `409 Conflict`.
- **CA-B1.3** El endpoint `GET /participants/dni/:dni` permite buscar antes de crear.
- **CA-B1.4** La edad se calcula automáticamente a partir de la fecha de nacimiento en cada consulta.

#### HU-B2 — Inscripción con generación de QR

> **Como** delegado
> **quiero** inscribir a un participante en una disciplina y categoría
> **para** que quede registrado como competidor y obtenga un código QR único que lo identifique.

**Criterios de aceptación:**

- **CA-B2.1** La inscripción se crea con estado `PENDIENTE` y genera un `qrCode` único (UUID codificado como string alfanumérico) al persistirse.
- **CA-B2.2** Se valida que la edad y sexo del participante correspondan a la categoría seleccionada; caso contrario, `400 Bad Request` con motivo claro.
- **CA-B2.3** El endpoint `GET /inscriptions/qr/:qrCode` es **público** y retorna: participante, disciplina, categoría y estado actual de la inscripción.
- **CA-B2.4** Un mismo participante no puede tener dos inscripciones activas (no rechazadas) en la misma categoría.
- **CA-B2.5** El frontend permite visualizar y descargar el QR generado (imagen PNG).

#### HU-B3 — Revisión y aprobación de inscripciones

> **Como** administrador (departamental o superior)
> **quiero** revisar las inscripciones pendientes y aprobarlas o rechazarlas
> **para** validar que la documentación y datos sean correctos.

**Criterios de aceptación:**

- **CA-B3.1** Flujo de estados: `PENDIENTE → REVISADA → APROBADA` o `REVISADA → RECHAZADA`.
- **CA-B3.2** Solo `INSCRIPTION_APPROVERS` (Super Admin, Provincial, Departamental) pueden ejecutar la transición a `APROBADA`.
- **CA-B3.3** El rechazo requiere un `reason` no vacío que se persiste y se muestra al delegado.
- **CA-B3.4** Cualquier cambio de estado se registra automáticamente en el log de auditoría (usuario, timestamp, estado anterior/nuevo).

---

### Épica C — Competencias y Resultados

#### HU-C1 — Creación de competencias

> **Como** administrador
> **quiero** crear una competencia asociada a una disciplina y categoría
> **para** organizar los partidos entre las inscripciones aprobadas.

**Criterios de aceptación:**

- **CA-C1.1** La competencia declara: disciplina, categoría, etapa (`ZONAL | DEPARTAMENTAL | PROVINCIAL`), formato (`ROUND_ROBIN | ELIMINACION_DIRECTA | FASE_GRUPOS`), fecha de inicio.
- **CA-C1.2** La competencia se crea en estado `BORRADOR`. Debe pasar a `ACTIVA` para generar fixture.
- **CA-C1.3** Solo se pueden asociar inscripciones con estado `APROBADA`.

#### HU-C2 — Generación de fixture

> **Como** administrador
> **quiero** generar automáticamente el fixture de una competencia
> **para** no tener que armar los partidos manualmente.

**Criterios de aceptación:**

- **CA-C2.1** El endpoint `POST /competitions/:id/fixture` genera los `Match` según el formato declarado.
- **CA-C2.2** Para `ROUND_ROBIN`, cada participante/equipo se enfrenta a todos los demás una única vez.
- **CA-C2.3** Los partidos se crean en estado `PROGRAMADO` sin fecha ni sede asignada (esos campos se editan luego).
- **CA-C2.4** Si la competencia no tiene al menos 2 inscripciones aprobadas, el endpoint responde `400 Bad Request`.

#### HU-C3 — Carga de resultados

> **Como** árbitro u operador de mesa
> **quiero** cargar el resultado de un partido
> **para** que el marcador quede reflejado en la tabla de posiciones pública.

**Criterios de aceptación:**

- **CA-C3.1** Solo `RESULT_LOADERS` pueden invocar `PATCH /results/match/:matchId`.
- **CA-C3.2** El partido cambia a estado `FINALIZADO` una vez cargado el resultado.
- **CA-C3.3** El endpoint `GET /results/rankings/competition/:competitionId` es **público** y devuelve la tabla de posiciones ordenada.
- **CA-C3.4** Un resultado ya cargado puede editarse solo por un `ADMIN_PROVINCIAL` o superior, y genera un registro de auditoría.

---

## 4. Fuera de Alcance (Out of Scope) para el MVP

Las siguientes funcionalidades **no forman parte del MVP** y se difieren a la V2 o posteriores. Documentarlas aquí evita scope creep:

| Funcionalidad | Motivo del diferimiento | Versión objetivo |
|---|---|---|
| **Integración con MinIO** para carga de documentos (DNI, certificado médico, autorización parental) | Requiere infra S3-compatible corriendo estable y flujo de validación de docs; el MVP acepta inscripciones sin documentos adjuntos. | V2 |
| **Reportes exportables complejos** (CSV/XLSX con múltiples filtros cruzados usando ExcelJS) | El MVP solo expone listados paginados vía API; la exportación se hará desde el propio listado en V2. | V2 |
| **Dashboard con estadísticas cacheadas en Redis y gráficos Recharts** | No es funcional-crítico para operar los juegos; los datos ya son consultables por listado. | V2 |
| **Módulo de Noticias públicas y Calendario público** | El MVP se enfoca en la operación interna, no en la comunicación pública. | V2 |
| **Gestión de Equipos** (disciplinas de tipo `EQUIPO` con miembros) | En el MVP solo se soportan disciplinas `INDIVIDUAL`. Las de equipo llegan en V2. | V2 |
| **Gestión de Sedes con geolocalización** | En el MVP, los partidos no requieren sede asignada; se resuelve por texto libre en V2 se estructura. | V2 |
| **Sistema completo de auditoría con filtros por fecha y entidad** | El MVP registra los cambios de estado críticos pero no expone la UI de consulta. | V2 |
| **Notificaciones por email** (aprobación/rechazo de inscripción) | Requiere proveedor de mail y plantillas; no bloquea la operación. | V3 |
| **PWA / soporte offline** | No hay requisito de operación sin conexión en el evento piloto. | V3 |

---

## 5. Métricas de éxito del MVP

- Un delegado puede inscribir un participante en menos de 2 minutos desde el login.
- Una inscripción con QR puede consultarse públicamente en menos de 500 ms.
- El sistema soporta 100 usuarios concurrentes sin degradación (medido en pruebas de carga previas al piloto).
- 0 credenciales en texto plano en la base de datos.
- 100% de los endpoints privados protegidos por RBAC (verificado por test automático).
