# Relevamiento de seguridad — OWASP Top 10:2025

| | |
|---|---|
| **Proyecto** | Sistema Integral Juegos Evita Formoseños |
| **Cliente** | Secretaría de Deportes y Recreación Comunitaria de Formosa |
| **Equipo de desarrollo** | 4 estudiantes de la Tecnicatura Superior en Desarrollo de Software Multiplataforma (Seminario de Actualización III – Ciberseguridad) |
| **Fecha** | 22/11/2026 |
| **Versión analizada** | rama `dev-santi`, commit `c3c3383` |
| **Versión del documento** | 1.1 (23/11/2026: estado de la mitigación) |
| **Estado** | Mitigación aplicada — ver el estado de cada hallazgo y la sección 10 |

## Contenido

1. [Resumen ejecutivo](#resumen-ejecutivo)
2. [Alcance y metodología](#alcance-y-metodologia)
   - [Pruebas dinámicas (DAST): no realizadas en esta iteración](#dast)
3. [Mapa de rutas y permisos](#mapa-de-rutas)
4. [Matriz de hallazgos](#matriz-de-hallazgos)
5. [Detalle de hallazgos](#detalle-de-hallazgos)
   - [A01 — Pérdida de control de acceso](#a01)
   - [A02 — Configuración de seguridad incorrecta](#a02)
   - [A03 — Fallas en la cadena de suministro de software](#a03)
   - [A04 — Fallas criptográficas](#a04)
   - [A05 — Inyección](#a05)
   - [A06 — Diseño inseguro](#a06)
   - [A07 — Fallas de autenticación](#a07)
   - [A08 — Fallas en la integridad del software o de los datos](#a08)
   - [A09 — Fallas en el registro, alerta y monitoreo](#a09)
   - [A10 — Manejo inadecuado de condiciones excepcionales](#a10)
6. [Controles de seguridad ya presentes](#controles-presentes)
7. [Limitaciones y aspectos no verificados](#limitaciones)
8. [Plan de mitigación priorizado](#plan-de-mitigacion)
9. [Referencias](#referencias)
10. [Estado de la mitigación y decisiones](#estado-y-decisiones)

---

<a id="resumen-ejecutivo"></a>
## 1. Resumen ejecutivo

**Qué se analizó.** Se revisó la plataforma en su rama `dev-santi` (commit `c3c3383`): el backend NestJS (25 controllers bajo `backend/src`), el frontend React (sesión, guards de ruta, almacenamiento local), los archivos de despliegue (`docker-compose` de la raíz, del backend, de desarrollo y del stack e2e; configuraciones de nginx; Dockerfiles), el pipeline de integración continua y las dependencias de los tres paquetes npm (`backend`, `frontend`, `e2e`). La revisión fue de lectura de código y configuración, más un análisis de componentes con `npm audit`. No se ejecutaron pruebas dinámicas (ver [DAST](#dast)).

**Cómo se consolidó.** Tres revisores produjeron 54 hallazgos (control de acceso y autenticación; inyección, criptografía, integridad, registro y excepciones; configuración y cadena de suministro). Seis grupos describían el mismo problema desde ángulos distintos y se fusionaron, por lo que el informe contiene **47 hallazgos únicos**, identificados como `VULN-01` a `VULN-47` y ordenados por riesgo. Cada hallazgo conserva sus identificadores originales (`AC-`, `IN-`, `CF-`) en la línea "Origen".

### Totales por nivel de riesgo

| Riesgo | Cantidad |
|---|---:|
| Crítico | 1 |
| Alto | 4 |
| Medio | 22 |
| Bajo | 16 |
| Informativo | 4 |
| **Total** | **47** |

Resumen de `npm audit` (2026-11-22): backend 48 avisos (2 críticos, 19 altos, 27 moderados; 28 en dependencias de producción), frontend 8 avisos (7 altos, 1 moderado) y e2e sin avisos. Detalle en VULN-04, VULN-29, VULN-30 y VULN-31.

### Los hallazgos más importantes

1. **VULN-01 (Crítico).** Cada respuesta de la encuesta "anónima" de bienestar de menores queda grabada en la tabla de auditoría con IP, User-Agent, hora exacta y todas las respuestas; anula las protecciones de anonimato del módulo Métricas.
2. **VULN-02 (Alto).** El backend publica el puerto 3000 directamente y confía en `X-Forwarded-For`: un cliente puede falsificar su IP y evadir el límite de intentos del login y de la encuesta.
3. **VULN-03 (Alto, probable).** El nginx de producción no tiene TLS configurado: credenciales y datos personales de menores viajarían en claro si no hay un terminador TLS delante (no verificado).
4. **VULN-04 (Alto).** Las librerías que procesan cada request (`body-parser`, `compression`, `multer`, `qs`) tienen avisos de denegación de servicio publicados y corregibles sin cambio de versión mayor.
5. **VULN-05 (Alto).** Cambiar la contraseña, el rol o el alcance de un usuario no revoca su refresh token: una sesión robada sobrevive hasta 7 días.
6. **VULN-06 y VULN-07 (Medio).** Un delegado puede colgar inscripciones de equipos de otros departamentos (IDOR por `teamId`) y cualquier árbitro puede cargar el resultado de cualquier partido de la provincia.
7. **VULN-25 y VULN-26 (Medio).** El DNI de menores y los emails se escriben en claro en el log de la aplicación, y las exportaciones masivas del padrón no dejan rastro en la auditoría.

### Valoración general

No se encontró una superficie de inyección crítica: no hay SQL armado con cadenas, las consultas son parametrizadas, los ordenamientos tienen lista blanca, no se usa `eval` ni `child_process`, el frontend no emplea `dangerouslySetInnerHTML` y las exportaciones CSV neutralizan fórmulas. Existen además puntos fuertes sólidos: matriz única de permisos con alcance territorial que falla cerrado, contraseñas con Argon2, refresh token rotativo con detección de reutilización, secretos validados al arrancar, cabeceras de seguridad en la API y documentos en un bucket privado con URLs firmadas de corta vida. Sin embargo, hay brechas reales de privacidad y autorización: la auditoría reconstruye por afuera el anonimato que el diseño de la encuesta protegía (VULN-01), el log de aplicación y las exportaciones tratan el DNI de menores sin los controles de la base de datos (VULN-25, VULN-26), varias acciones de escritura no aplican el alcance territorial (VULN-06, VULN-07, VULN-08), y la configuración de despliegue (puerto 3000, TLS, cabeceras de la SPA, Redis sin contraseña) depende de una topología de producción que el repositorio no documenta. Ninguna de las debilidades encontradas es de explotación remota anónima inmediata sobre los datos del padrón, pero varias se vuelven graves ante una cuenta comprometida o un despliegue con la configuración por defecto del repositorio.

---

<a id="alcance-y-metodologia"></a>
## 2. Alcance y metodología

### Fase del S-SDLC

Esta auditoría se ubica entre las fases de **Desarrollo** y **Pruebas** del ciclo de vida seguro (S-SDLC): corresponde al *análisis estático* de la fase de desarrollo (SAST) y a la *revisión de código* y el *análisis de componentes* de la fase de pruebas. Las pruebas de seguridad dinámicas (DAST) de la fase de pruebas quedan pendientes (ver más abajo).

### Técnicas utilizadas

| Técnica | Qué se hizo |
|---|---|
| **SAST** (análisis estático) | Revisión manual del código fuente asistida por herramientas de búsqueda, sin ejecutar la aplicación. Cuando una afirmación dependía del comportamiento de una librería se leyó su código en `node_modules` (por ejemplo, el `ValidationPipe` de Nest en VULN-24) o se reprodujo en aislamiento (el comportamiento de `X-Forwarded-For` de Express 5.2.1 en VULN-02). |
| **SCA** (análisis de componentes) | `npm audit` sobre `backend`, `frontend` y `e2e`, con y sin `--omit=dev`, ejecutado el 22/11/2026 con acceso al registro. Los resultados dependen de la base de avisos de esa fecha. |
| **STRIDE** | Cada hallazgo se clasifica con las letras de STRIDE (Suplantación, Manipulación, Repudio, Divulgación de información, Denegación de servicio, Elevación de privilegios), que indican qué propiedad de seguridad viola. |

### Actores de amenaza considerados

- **Anónimo de Internet:** sin credenciales; alcanza los endpoints públicos, la encuesta y los QR.
- **Usuario autenticado de bajo privilegio:** `DELEGADO`, `ARBITRO`, `OPERADOR_MESA`, `COORDINADOR` y roles similares.
- **Administrador malintencionado (insider):** un rol de administración que abusa de sus permisos o accede a la base, a los logs o a los respaldos.

### Escala de riesgo

El riesgo sigue la **OWASP Risk Rating Methodology**: se estima la *probabilidad* de que el problema sea aprovechado y el *impacto* si lo es, y se combinan. La tabla siguiente es la matriz de referencia (adaptación de la de OWASP: la celda "Nota" se fusiona con *Bajo*).

| Probabilidad \ Impacto | Bajo | Medio | Alto |
|---|---|---|---|
| **Alta** | Medio | Alto | Crítico |
| **Media** | Bajo | Medio | Alto |
| **Baja** | Bajo | Bajo | Medio |

El nivel **Informativo** no sale de la matriz: se reserva para observaciones de defensa en profundidad o riesgos aceptables que hoy no tienen una vía de ataque concreta (VULN-44, VULN-45, VULN-46 y VULN-47).

La matriz es una referencia y no una regla mecánica: cada revisor asignó el nivel final ponderando las condiciones de explotación descritas en el hallazgo, y esos niveles se conservaron en la consolidación. Seis hallazgos quedan **un escalón por debajo** de lo que daría la matriz: VULN-02 (Alta × Alto), VULN-22 (Media × Alto), VULN-17 (Media × Alto), VULN-25 (Alta × Medio), VULN-15 (Alta × Medio) y VULN-28 (Alta × Bajo). **VULN-01** es el caso inverso: los revisores lo estimaron Alto (Media × Alto) y en la consolidación se elevó a **Crítico** porque la fila de auditoría se escribe en cada envío (probabilidad cierta). Para los hallazgos fusionados se tomó el nivel más alto de los hallazgos de origen.

### Significado de "Confianza"

- **Confirmado:** el código o la configuración son inequívocos, o el comportamiento se reprodujo. No implica que se haya explotado contra el stack en ejecución (ver limitaciones).
- **Probable:** el hallazgo depende de una condición no verificada, que se indica en cada caso (por ejemplo, la topología real de producción).

<a id="dast"></a>
### Pruebas dinámicas (DAST): no realizadas en esta iteración

Estaba planificado un análisis dinámico automatizado contra el entorno aislado (stack e2e), pero **no pudo ejecutarse con las herramientas disponibles en esta iteración y queda pendiente**. La herramienta recomendada en el apunte de la materia es **OWASP ZAP**, apuntada al stack e2e aislado (que ya publica sus puertos sólo en `127.0.0.1` y tiene el backend en una red interna).

Como control compensatorio parcial, la suite de pruebas del proyecto ejercita los permisos por rol contra la API real: alrededor de 450 pruebas e2e en los proyectos `api`, `desktop` y `mobile`, además de pruebas e2e del backend como `action-permissions.e2e-spec.ts` y `scope-sweep.e2e-spec.ts`. Esto reduce, pero no reemplaza, el valor de un DAST: no cubre cabeceras efectivamente emitidas, configuración de TLS ni comportamiento ante entradas hostiles de forma sistemática.

---

<a id="mapa-de-rutas"></a>
## 3. Mapa de rutas y permisos

Los guards globales se registran en `backend/src/app.module.ts:162-176`, en este orden: `JwtAuthGuard` → `RolesGuard` → `ThrottlerGuard`. Toda ruta exige JWT salvo las marcadas `@Public()`. El prefijo es `/api/v1`. La columna "Alcance R05" indica si el service aplica `ScopeService` (recorte territorial por departamento o zona). Los roles salen de `ACCIONES` (`backend/src/common/constants/index.ts:113-357`). Abreviaturas: SA = `SUPER_ADMIN`, AP = `ADMIN_PROVINCIAL`.

| Módulo | Método y ruta | Acceso | Alcance R05 |
|---|---|---|---|
| auth | POST /auth/login | Público, 5/15 min por IP | — |
| auth | POST /auth/refresh | Público + `JwtRefreshGuard` (cookie) | — |
| auth | POST /auth/logout · GET /auth/me · GET /auth/permissions | JWT (cualquier rol) | — |
| users | POST · PATCH /:id · DELETE /:id | USER_MANAGE (SA) | n/a |
| users | GET · GET /:id | USER_READ (SA, AP) | n/a |
| audit | GET /audit | AUDIT_READ (SA, AP) | n/a |
| participants | POST | PARTICIPANT_CREATE | Sí (departamento del body) |
| participants | GET · GET /dni/:dni · GET /:id | PARTICIPANT_READ (incluye COORDINADOR) | Sí |
| participants | PATCH /:id | PARTICIPANT_UPDATE (DNI: sólo SA/AP) | Sí |
| inscriptions | POST · POST /team | INSCRIPTION_CREATE | Sí (salvo `teamId`, ver [VULN-06](#vuln-06)) |
| inscriptions | GET · GET /:id · PATCH /:id/review · /approve · /reject | INSCRIPTION_* | Sí |
| inscriptions | GET /qr/:qrCode | Público, 20/min | — |
| teams | POST · GET · GET /:id · PATCH · DELETE · POST/DELETE members | TEAM_* | Sí |
| documents | POST /upload · GET /participant/:id · PATCH /:id/review | DOCUMENT_* | Sí |
| reports | GET participants · inscriptions · teams · results | REPORT_EXPORT | Sí (results: sin recorte, por diseño) |
| dashboard | GET /dashboard/stats | DASHBOARD_READ | Sí |
| competitions | POST · PATCH /:id · POST /:id/fixture | COMPETITION_MANAGE (incluye ADMIN_DEPARTAMENTAL y ADMIN_ZONAL) | **No** ([VULN-08](#vuln-08)) |
| competitions | GET · GET /:id | Público, 20/min | — |
| results | PATCH /results/match/:matchId | RESULT_LOAD (incluye ARBITRO) | **No** ([VULN-07](#vuln-07)) |
| results | GET /rankings/competition/:id | Público, 20/min | — |
| venues | POST · PATCH · DELETE · POST/DELETE /:id/image | VENUE_MANAGE | **No** (`Venue.department` existe) |
| venues | GET · GET /:id · GET /:id/image | Público (20/min; imagen 120/min) | — |
| news | POST · PATCH · DELETE · POST/DELETE /:id/image | NEWS_MANAGE | No |
| news | GET · GET /slug/:slug · GET /:id · GET /:id/image | Público + `OptionalJwtAuthGuard` (borradores sólo ADMIN_ROLES) | — |
| news | POST /news/sync | NEWS_SYNC (SA, AP) | n/a |
| calendar | POST · PATCH · DELETE | CALENDAR_MANAGE | No |
| calendar | GET · GET /:id | Público + `OptionalJwtAuthGuard` | — |
| disciplines / categories | POST · PATCH · DELETE | DISCIPLINE/CATEGORY_MANAGE (SA, AP) | n/a |
| disciplines / categories | GET · GET /:id | Público, 20/min | — |
| survey | GET /survey/active | Público, 20/min | — |
| survey | POST /survey/responses | Público, 3/min por IP | — |
| survey | campañas, preguntas y opciones (CRUD, publish, close) | SURVEY_MANAGE (incluye ADMIN_ZONAL) | No |
| metrics | GET catalog · survey/:id/{version,overview,cross,kpis,highlights} · GET kpis/highlights | METRICS_READ (incluye COORDINADOR) | **No** ([VULN-19](#vuln-19)) |
| metrics | POST · PATCH · DELETE kpis/highlights | SURVEY_MANAGE | No |
| zones | GET · GET /:zone | ZONE_READ | n/a |
| zones | PUT · DELETE /:zone | ZONE_WRITE (SA, AP) | n/a |
| localities · stats/localities · health | GET | Público | — |

Los roles `ENTRENADOR` y `OPERADOR_MESA` no tienen ninguna acción asignada: sólo llegan a `/auth/me`, `/auth/permissions`, `/auth/logout` y a lo público. Todas las rutas no públicas declaran `@Roles(...)` salvo las de `/auth/*`; sin embargo, el `RolesGuard` no es deny-by-default ([VULN-45](#vuln-45)).

---

<a id="matriz-de-hallazgos"></a>
## 4. Matriz de hallazgos

Ordenada por riesgo y, dentro de cada nivel, por categoría OWASP (A01 a A10). STRIDE: S suplantación, T manipulación, R repudio, I divulgación de información, D denegación de servicio, E elevación de privilegios.

| ID | Título | Categoría OWASP | STRIDE | Riesgo | Confianza | Ubicación principal |
|---|---|---|---|---|---|---|
| [VULN-01](#vuln-01) | Las respuestas "anónimas" de la encuesta quedan en la auditoría con IP, User-Agent y hora | A09 | I | **Crítico** | Confirmado | `backend/src/modules/survey/survey.controller.ts:86-96`; `backend/src/modules/audit/audit.interceptor.ts:54-113` |
| [VULN-02](#vuln-02) | API publicada en el puerto 3000: IP del cliente falsificable y límite de intentos evadible | A02 | S, R, D | Alto | Confirmado | `backend/docker-compose.yml:12-13`; `backend/src/main.ts:30` |
| [VULN-03](#vuln-03) | Proxy de producción sin TLS y con cabeceras que contradicen a helmet | A02 | I, T | Alto | Probable | `backend/docker/nginx/nginx.conf:10-16, 33-38` |
| [VULN-04](#vuln-04) | Dependencias de runtime del backend con DoS alcanzable desde la red | A03 | D | Alto | Confirmado | `backend/package-lock.json` |
| [VULN-05](#vuln-05) | Cambios de contraseña, rol o alcance no revocan sesiones | A07 | S, E | Alto | Confirmado | `backend/src/modules/users/users.service.ts:171-222` |
| [VULN-06](#vuln-06) | `teamId` de la inscripción individual sin verificación de alcance (IDOR) | A01 | T, E | Medio | Confirmado | `backend/src/modules/inscriptions/inscriptions.service.ts:73, 234` |
| [VULN-07](#vuln-07) | Carga de resultados sin vínculo árbitro-partido ni alcance | A01 | T, R | Medio | Confirmado | `backend/src/modules/results/results.service.ts:85-104` |
| [VULN-08](#vuln-08) | Roles territoriales con escritura provincial | A01 | T, E | Medio | Confirmado | `backend/src/modules/venues/venues.controller.ts:64-79` |
| [VULN-09](#vuln-09) | La SPA se sirve sin cabeceras de seguridad | A02 | T, I | Medio | Confirmado | `frontend/docker/nginx.conf:2-43` |
| [VULN-10](#vuln-10) | Subida de documentos sin límites en multer y `fileKey` expuesto | A02 | D, I | Medio | Confirmado | `backend/src/modules/documents/documents.controller.ts:43-70` |
| [VULN-11](#vuln-11) | Redis sin autenticación; `REDIS_PASSWORD` opcional en producción | A02 | T, I | Medio | Confirmado | `docker-compose.yml:44-55`; `backend/src/config/config.validation.ts:142` |
| [VULN-12](#vuln-12) | Compose de desarrollo y local publican servicios en todas las interfaces | A02 | I, T | Medio | Confirmado | `backend/docker-compose.dev.yml:10-15, 44-46` |
| [VULN-13](#vuln-13) | `NODE_ENV` falla en abierto; stack de la raíz en desarrollo con Swagger expuesto | A02 | I, E | Medio | Confirmado | `backend/src/config/config.validation.ts:38-40`; `docker-compose.yml:96` |
| [VULN-14](#vuln-14) | La seed no tiene guarda de producción y es destructiva | A02 | T, E | Medio | Confirmado | `backend/prisma/seed.ts:864-867, 1072-1094, 1394` |
| [VULN-15](#vuln-15) | Sin análisis automatizado de dependencias y CI con higiene débil | A03 | T, E | Medio | Confirmado | `.github/workflows/ci.yml:1-68` |
| [VULN-16](#vuln-16) | Imágenes base sin digest, con tags móviles y nginx sin mantenimiento | A03 | T | Medio | Confirmado / Probable | `backend/docker-compose.yml:63, 80`; `frontend/docker/Dockerfile:20` |
| [VULN-17](#vuln-17) | Las URLs firmadas de documentos pueden emitirse por HTTP en producción | A04 | I | Medio | Probable | `backend/src/modules/documents/minio.service.ts:201-226` |
| [VULN-18](#vuln-18) | Borrador de plantel con PII de menores en `localStorage`, compartido entre usuarios | A06 | I | Medio | Confirmado | `frontend/src/pages/admin/inscription/rosterDraft.ts:28, 38, 103-140` |
| [VULN-19](#vuln-19) | Métricas: `/version` y reidentificación por usuarios internos | A06 | I | Medio | Confirmado | `backend/src/modules/metrics/metrics.controller.ts:52-62` |
| [VULN-20](#vuln-20) | Encuesta pública sin control de integridad de la muestra | A06 | T | Medio | Confirmado | `backend/src/modules/survey/survey.controller.ts:86-97` |
| [VULN-21](#vuln-21) | Resta entre cortes con dos filtros (inclusión-exclusión) | A06 | I | Medio | Confirmado | `backend/src/modules/metrics/metrics-aggregation.ts` |
| [VULN-22](#vuln-22) | Sin bloqueo por cuenta; límite de intentos por IP y en memoria | A07 | S, D | Medio | Confirmado | `backend/src/modules/auth/auth.controller.ts:49`; `backend/src/app.module.ts:102-107` |
| [VULN-23](#vuln-23) | Política de contraseñas débil y sin ciclo de vida de la credencial | A07 | S, R | Medio | Confirmado | `backend/src/modules/users/dto/users.dto.ts:35-36, 64-72` |
| [VULN-24](#vuln-24) | `PATCH /results/match/:matchId` recibe un array que el `ValidationPipe` no valida | A08 | T | Medio | Confirmado | `backend/src/modules/results/results.controller.ts:35-56` |
| [VULN-25](#vuln-25) | DNI de menores, emails y payloads de Prisma en el log de aplicación | A09 | I | Medio | Confirmado | `backend/src/modules/inscriptions/inscriptions.service.ts:186, 257-259` |
| [VULN-26](#vuln-26) | Exportaciones masivas del padrón y lectura de documentos sin auditar | A09 | R | Medio | Confirmado | `backend/src/modules/reports/reports.controller.ts:154-235` |
| [VULN-27](#vuln-27) | Sin alertas, accesos denegados no registrados y retención de logs no definida | A09 | R | Medio | Confirmado | `backend/src/common/filters/global-exception.filter.ts:62-77` |
| [VULN-28](#vuln-28) | Superficie pública con nombres de menores e identificadores internos | A01 | I | Bajo | Confirmado | `backend/src/common/prisma-selects.ts:34-38, 134-140` |
| [VULN-29](#vuln-29) | Dependencias de runtime del backend con avisos de baja alcanzabilidad (incluye `proxy-addr`) | A03 | D, S | Bajo | Confirmado | `backend/package.json` |
| [VULN-30](#vuln-30) | Dependencias del frontend que llegan al navegador con avisos publicados | A03 | T | Bajo | Confirmado | `frontend/package.json` |
| [VULN-31](#vuln-31) | Herramientas de desarrollo, build y prueba con avisos | A03 | E, D | Bajo | Confirmado | `backend/package.json`; `frontend/package.json` |
| [VULN-32](#vuln-32) | Código QR público con 32 bits de entropía | A04 | I | Bajo | Confirmado | `backend/src/modules/inscriptions/inscriptions.service.ts:1101-1103` |
| [VULN-33](#vuln-33) | Respuestas de la encuesta en `localStorage` en claro hasta la confirmación | A04 | I | Bajo | Confirmado | `frontend/src/pages/public/survey/form/surveyDraft.ts:1-60, 125-152` |
| [VULN-34](#vuln-34) | Sync de noticias: respuesta sin tope de tamaño y regex con backtracking | A05 | D | Bajo | Probable | `backend/src/modules/news/sync/formosa-portal.client.ts:87-103` |
| [VULN-35](#vuln-35) | Marca de tiempo exacta de cada respuesta correlacionable con logs de acceso | A06 | I | Bajo | Probable | `backend/prisma/schema.prisma:806` |
| [VULN-36](#vuln-36) | Combinación de tres cortes de fecha que vuelve a aislar una respuesta | A06 | I | Bajo | Confirmado | `backend/src/modules/metrics/metrics-aggregation.ts` (`publicarEnTandas`) |
| [VULN-37](#vuln-37) | Enumeración de cuentas en el login (mensaje y tiempo) | A07 | I | Bajo | Confirmado | `backend/src/modules/auth/auth.service.ts:58-87` |
| [VULN-38](#vuln-38) | El flag `Secure` de la cookie de refresh depende de `NODE_ENV` | A07 | I, S | Bajo | Probable | `backend/src/modules/auth/auth.cookies.ts:62` |
| [VULN-39](#vuln-39) | Sesión deslizante sin vida absoluta y un único refresh por usuario | A07 | S, D | Bajo | Confirmado | `backend/src/modules/auth/auth.service.ts:199-230, 327-345` |
| [VULN-40](#vuln-40) | Definiciones JSON de KPI y destacados se persisten crudas | A08 | T | Bajo | Confirmado | `backend/src/modules/metrics/metrics.service.ts:578-588, 645-655` |
| [VULN-41](#vuln-41) | Google Fonts sin SRI y con envío de la IP de los visitantes a un tercero | A08 | T, I | Bajo | Confirmado | `frontend/index.html:9-11` |
| [VULN-42](#vuln-42) | Logs del compose de producción sin rotación ni destino central | A09 | D, R | Bajo | Confirmado | `backend/docker-compose.yml:4-89` |
| [VULN-43](#vuln-43) | Huecos en el manejo global de excepciones | A10 | R, I | Bajo | Confirmado | `backend/src/common/filters/global-exception.filter.ts:62-77, 90-101, 117-123` |
| [VULN-44](#vuln-44) | Oráculo de existencia de DNI por la unicidad global | A01 | I | Informativo | Confirmado | `backend/src/modules/inscriptions/inscriptions.service.ts:163-213` |
| [VULN-45](#vuln-45) | Deny-by-default no estructural en `RolesGuard` | A01 | E | Informativo | Confirmado | `backend/src/common/guards/roles.guard.ts:24-26` |
| [VULN-46](#vuln-46) | Scripts de instalación de dependencias y telemetría en `npm ci` | A03 | T, I | Informativo | Confirmado | `backend/package.json`; `backend/docker/Dockerfile:11, 27` |
| [VULN-47](#vuln-47) | JWT sin algoritmo fijado ni `iss`/`aud` | A07 | S | Informativo | Probable | `backend/src/modules/auth/strategies/jwt.strategy.ts:21-25` |

---

<a id="detalle-de-hallazgos"></a>
## 5. Detalle de hallazgos

Los hallazgos se agrupan por categoría OWASP Top 10:2025, con los nombres de la traducción oficial al español usados en el apunte de la materia. Cada hallazgo muestra, en este orden: Origen, Categoría, CWE, STRIDE, Ubicación, Descripción, Evidencia, Probabilidad, Impacto, Riesgo, Confianza, Mitigación propuesta, Riesgo de mitigar y Estado. Todos los hallazgos están en estado **Pendiente**. Los hallazgos que ya figuran como "riesgo residual" en `documentacion/documentation.md` (§4.19) se indican como tales.

---

<a id="a01"></a>
### A01 — Pérdida de control de acceso

El usuario ve o hace algo que no le corresponde: es como si la tarjeta del hotel abriera también la habitación de otro huésped. En este proyecto el control de acceso está bien estructurado (matriz única de permisos y alcance territorial que falla cerrado), pero hay lugares donde el alcance no se aplica a un dato que llega en el cuerpo de la petición, a módulos enteros que actúan sobre toda la provincia, o a identificadores internos que el público no necesita. No se encontró SSRF (la categoría la incorpora desde 2025): el único `fetch` del servidor usa una URL base de configuración más un identificador numérico.

<a id="vuln-06"></a>
#### VULN-06 — `teamId` de la inscripción individual sin verificación de alcance (IDOR)

- **Origen:** AC-01
- **Categoría OWASP 2025:** A01 — Pérdida de control de acceso
- **CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key)
- **STRIDE:** T (Manipulación), E (Elevación de privilegios)
- **Ubicación:** `backend/src/modules/inscriptions/inscriptions.service.ts:73` y `:234` (`POST /api/v1/inscriptions`); DTO `backend/src/modules/inscriptions/dto/inscriptions.dto.ts:88-93`
- **Descripción:** el alta individual valida el departamento del participante (`permiteDepartamento`, línea 80) y busca el DNI dentro del alcance (líneas 163-168), pero el `teamId` del cuerpo pasa directo a `inscription.create` sin comprobar que el equipo exista dentro del alcance del actor ni que pertenezca a la misma categoría. Un DELEGADO de un departamento puede colgar inscripciones de un equipo de otro departamento. Los UUID de equipos son obtenibles sin iniciar sesión: el fixture público (`GET /competitions/:id`) y los rankings exponen `teamId` (`backend/src/common/prisma-selects.ts:134-140`, ver [VULN-28](#vuln-28)). La clave foránea sólo garantiza que el equipo exista.
- **Evidencia:**
  ```ts
  // inscriptions.service.ts:61-74 — teamId se desestructura del body
  const { dni, ..., categoryId, teamId } = createDto;
  // inscriptions.service.ts:230-236 — y se escribe sin chequeo
  return tx.inscription.create({ data: { participantId: participant.id, categoryId, teamId, qrCode, ... } });
  ```
  En cambio `teams.service.ts:235` (`addMember`) sí pasa por `findOne(teamId, alcance)`. `backend/test/scope-sweep.e2e-spec.ts` no cubre este campo.
- **Probabilidad:** Media — basta un usuario DELEGADO y un UUID público.
- **Impacto:** Medio — altera la integridad de equipos ajenos: suma inscripciones al `_count` del equipo (lo que convierte su borrado en desactivación, `teams.service.ts:330-342`), mezcla categorías y le muestra al atacante el nombre del equipo ajeno en el detalle de su inscripción.
- **Riesgo:** Medio
- **Confianza:** Confirmado (código inequívoco; no reproducido contra el stack)
- **Mitigación propuesta:** en `InscriptionsService.create`, si viene `teamId`, buscar el equipo con `ScopeService.conAlcance({ id: teamId, categoryId }, this.scope.whereTeam(alcance))` dentro de la transacción y responder 404 si no aparece. Agregar el caso a `scope-sweep.e2e-spec.ts`.
- **Riesgo de mitigar:** bajo. Si el frontend envía el `teamId` de un equipo de otra categoría, empezará a recibir 404. Probar el wizard de inscripción individual con y sin equipo, como DELEGADO y como ADMIN_PROVINCIAL.

**Estado:** Mitigado (commit 4e66dff). El `teamId` se valida contra el alcance territorial y la categoría.

<a id="vuln-07"></a>
#### VULN-07 — Carga de resultados sin vínculo árbitro-partido ni alcance

- **Origen:** AC-02
- **Categoría OWASP 2025:** A01 — Pérdida de control de acceso (con componente de A06 — Diseño inseguro)
- **CWE:** CWE-639 (Authorization Bypass Through User-Controlled Key); CWE-285 (Improper Authorization)
- **STRIDE:** T (Manipulación), R (Repudio, parcial)
- **Ubicación:** `backend/src/modules/results/results.service.ts:85-104` (`PATCH /api/v1/results/match/:matchId`); `backend/src/common/constants/index.ts:258` (`RESULT_LOAD`)
- **Descripción:** cualquier usuario con rol ARBITRO, ADMIN_DEPARTAMENTAL o ADMIN_ZONAL puede cargar el resultado de **cualquier** partido de la provincia: el service busca el partido por id y sólo distingue "primera carga" de "corrección". No hay asignación de árbitro a partido ni recorte territorial. La primera carga deja el partido en `FINALIZADO` y desde ese momento sólo SA y AP pueden corregir, de modo que un resultado falso queda firme hasta una intervención provincial. Los `matchId` son públicos en el fixture.
- **Evidencia:**
  ```ts
  const match = await this.prisma.match.findUnique({ where: { id: matchId }, ... });   // :85
  const esCorreccion = match.status === 'FINALIZADO';                                    // :99
  if (esCorreccion && !RESULT_CORRECT.includes(usuario.role)) { throw new ForbiddenException(...) } // :100
  ```
- **Probabilidad:** Media — ARBITRO es un rol operativo de bajo privilegio con muchas cuentas previsibles.
- **Impacto:** Medio — altera tablas de posiciones públicas y el avance de llaves de eliminación directa. Queda auditado, pero se corrige sólo a mano.
- **Riesgo:** Medio
- **Confianza:** Confirmado
- **Mitigación propuesta:** modelar la asignación (`Match.refereeId` o una tabla `match_officials`) y exigir en `updateMatchResults` que un ARBITRO esté asignado al partido; para ADMIN_DEPARTAMENTAL y ADMIN_ZONAL, limitar a partidos cuya sede (`Venue.department`) esté en su alcance. Como paliativo, dejar la primera carga en un estado `PENDIENTE_CONFIRMACION`.
- **Riesgo de mitigar:** cambia el flujo operativo del día de competencia: si no se cargan las asignaciones, ningún árbitro podrá cargar nada. Requiere migración y probar `results-rankings.e2e-spec.ts` y `competitions-fixture.e2e-spec.ts`.

**Estado:** Mitigado parcialmente (commit e920d37). Los admins territoriales sólo cargan partidos en sedes de su territorio. Los árbitros no tienen alcance territorial en el modelo: riesgo aceptado temporalmente (ver sección 10).

<a id="vuln-08"></a>
#### VULN-08 — Roles territoriales con escritura provincial sobre sedes, competencias, contenido y encuesta

- **Origen:** AC-03
- **Categoría OWASP 2025:** A01 — Pérdida de control de acceso (con componente de diseño, A06)
- **CWE:** CWE-285 (Improper Authorization)
- **STRIDE:** T (Manipulación), E (Elevación de privilegios)
- **Ubicación:** `backend/src/modules/venues/venues.controller.ts:64-79`; `backend/src/common/constants/index.ts:252` (COMPETITION_MANAGE), `:271` (NEWS_MANAGE), `:305` (SURVEY_MANAGE), `:311` (CALENDAR_MANAGE), `:317` (VENUE_MANAGE)
- **Descripción:** ADMIN_DEPARTAMENTAL y ADMIN_ZONAL tienen alcance acotado en el padrón (R05), pero en sedes, competencias, noticias, calendario y campañas de la encuesta actúan sobre toda la provincia: ningún service de esos módulos recibe el alcance. El caso más claro son las sedes, porque `Venue.department` existe y aun así un ADMIN_ZONAL de una zona puede editar, borrar o cambiar la foto de una sede de otro departamento. También puede publicar noticias en el sitio público, cerrar la campaña de la encuesta provincial o generar el fixture de una competencia provincial. **Requiere decisión de negocio:** la intención no está documentada y puede ser una decisión aceptada.
- **Evidencia:**
  ```ts
  // venues.controller.ts:64-72 — sin @CurrentUser ni alcance
  @Patch(':id') @Roles(...ACCIONES.VENUE_MANAGE)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateVenueDto) {
    return this.venuesService.update(id, updateDto);
  }
  ```
  `grep alcanceDe` sólo aparece en participants, inscriptions, teams, documents, reports y dashboard.
- **Probabilidad:** Media — requiere una cuenta administrativa territorial (actor interno o cuenta comprometida).
- **Impacto:** Medio — desfiguración del sitio público institucional y alteración de datos deportivos de otros territorios. No expone PII.
- **Riesgo:** Medio
- **Confianza:** Confirmado (código); la intención de negocio no está documentada.
- **Mitigación propuesta:** definir en `ACCIONES` qué es contenido provincial (NEWS, SURVEY, CALENDAR, COMPETITION: sólo SA y AP, o un flujo de aprobación) y, para sedes, filtrar con `permiteDepartamento(alcance, venue.department)` en `VenuesService.update/remove` y en `VenueImagesService`. Documentar la decisión en `documentation.md`.
- **Riesgo de mitigar:** quita capacidades a ADMIN_DEPARTAMENTAL y ADMIN_ZONAL que hoy pueden usarse en la operación. Hay que actualizar el espejo `frontend/src/lib/adminActions.ts` (lo verifica `npm run check:nav`) y `action-permissions.e2e-spec.ts`.

**Estado:** Mitigado (commit e920d37, f4a650a). Competencias, noticias, calendario y encuesta pasan a la línea provincial; sedes limitadas al territorio.

<a id="vuln-28"></a>
#### VULN-28 — Superficie pública con nombres de menores e identificadores internos

- **Origen:** AC-12
- **Categoría OWASP 2025:** A01 — Pérdida de control de acceso
- **CWE:** CWE-359 (Exposure of Private Personal Information to an Unauthorized Actor)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `backend/src/common/prisma-selects.ts:34-38` y `:134-140`; `backend/src/modules/results/results.service.ts:256-275`; `GET /competitions/:id`, `GET /results/rankings/competition/:id`
- **Descripción:** el fixture y los rankings públicos exponen nombre y apellido de participantes (menores) con su `participantId`, y `teamId` y `matchId`. Mostrar nombres en resultados deportivos es una decisión de negocio razonable, pero los UUID internos no le sirven al público y son justamente el insumo de [VULN-06](#vuln-06) y [VULN-07](#vuln-07). No hay forma de que un participante (o su tutor) pida aparecer anonimizado.
- **Evidencia:** `RESULT_PUBLIC = { id, matchId, teamId, participantId, ... }` (`prisma-selects.ts:134-140`)
- **Probabilidad:** Alta — es información pública.
- **Impacto:** Bajo — nombres ya visibles por diseño; los identificadores internos habilitan otros hallazgos.
- **Riesgo:** Bajo
- **Confianza:** Confirmado
- **Mitigación propuesta:** quitar `participantId` de las proyecciones públicas o reemplazarlo por un id opaco; documentar la base legal (consentimiento del tutor en la inscripción) para publicar nombres; evaluar iniciales para categorías infantiles. **Requiere decisión** sobre qué se publica de los menores.
- **Riesgo de mitigar:** el frontend público puede usar `participantId` como `key` o para agrupar; revisar las páginas de rankings y `public-pii.e2e-spec.ts`.

**Estado:** Pendiente. No se cambió: reducir nombres e identificadores de las vistas públicas requiere revisar qué muestra cada página pública con el cliente.

<a id="vuln-44"></a>
#### VULN-44 — Oráculo de existencia de DNI por la unicidad global

- **Origen:** AC-13
- **Categoría OWASP 2025:** A01 — Pérdida de control de acceso
- **CWE:** CWE-204 (Observable Response Discrepancy)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `backend/src/modules/inscriptions/inscriptions.service.ts:163-213`; `POST /participants` (misma restricción de unicidad)
- **Descripción:** la búsqueda por DNI va acotada al alcance (S04), pero la unicidad global de `dni` hace que un DELEGADO distinga "el DNI existe en otro departamento" (409 "Ya existe un participante con ese DNI") de "no existe" (el alta prospera). El comentario del código dice que no se puede distinguir, y eso vale sólo entre "ajeno" y "propio". La prueba tiene efecto lateral (crea la fila si no existe) y queda auditada, lo que la vuelve ruidosa.
- **Evidencia:** `throw new ConflictException('Ya existe un participante con ese DNI. Si es de tu departamento, ...')` (`:203-206`)
- **Probabilidad:** Baja
- **Impacto:** Bajo — revela si un DNI participa de los Juegos, sin datos asociados.
- **Riesgo:** Informativo
- **Confianza:** Confirmado
- **Mitigación propuesta:** aceptar y documentar el riesgo (lo impone la unicidad del DNI), o alertar en auditoría cuando un mismo usuario acumula 409 de DNI.
- **Riesgo de mitigar:** ninguno si sólo se documenta.

**Estado:** Aceptado (commit 4e66dff). La unicidad global del DNI no se puede ocultar sin perder la detección de duplicados; se registra quién provoca el rechazo para detectar un uso como oráculo.

<a id="vuln-45"></a>
#### VULN-45 — Deny-by-default no estructural en `RolesGuard`

- **Origen:** AC-17
- **Categoría OWASP 2025:** A01 — Pérdida de control de acceso
- **CWE:** CWE-276 (Incorrect Default Permissions)
- **STRIDE:** E (Elevación de privilegios)
- **Ubicación:** `backend/src/common/guards/roles.guard.ts:24-26`
- **Descripción:** si un handler no declara `@Roles`, el guard deja pasar a **cualquier** usuario autenticado, incluidos ENTRENADOR y OPERADOR_MESA. Hoy todas las rutas no públicas lo declaran salvo `/auth/*` (verificado en el mapa de rutas) y `action-permissions.e2e-spec.ts` lo controla. Aun así, un endpoint nuevo sin decorador queda abierto en silencio.
- **Evidencia:** `if (!requiredRoles || requiredRoles.length === 0) { return true; }`
- **Probabilidad:** Baja
- **Impacto:** Medio
- **Riesgo:** Informativo
- **Confianza:** Confirmado
- **Mitigación propuesta:** invertir el valor por defecto: rechazar si no hay `@Roles` ni `@Public`, y agregar un decorador explícito `@AnyAuthenticated()` para `/auth/me`, `/auth/permissions` y `/auth/logout`.
- **Riesgo de mitigar:** una ruta que hoy dependa del valor por defecto devolvería 403; correr todo el e2e.

**Estado:** Mitigado (commit 78f8ada). `RolesGuard` niega por defecto; `/auth/*` declara `@AnyAuthenticated`.

---

<a id="a02"></a>
### A02 — Configuración de seguridad incorrecta

Valores por defecto inseguros, servicios publicados de más, mensajes demasiado detallados: es como dejar la llave puesta en la puerta. Es la categoría que más subió en la edición 2025 (del 5.º al 2.º lugar). En este proyecto, el código de la aplicación está bien configurado (helmet, CORS con lista exacta, validación de entorno), pero los archivos de despliegue contienen decisiones pensadas para desarrollo que, si llegan a un servidor, dejan puertos abiertos, el TLS sin configurar y la SPA sin cabeceras de seguridad. Gran parte de la gravedad depende de la topología real de producción, que el repositorio no documenta.

<a id="vuln-02"></a>
#### VULN-02 — API publicada directamente en el puerto 3000 con `trust proxy` de un salto: IP del cliente falsificable

- **Origen:** CF-01. Ver también [VULN-22](#vuln-22) (AC-07 y CF-15): una IP falsificable anula el límite por IP que allí se describe.
- **Categoría OWASP 2025:** A02 — Configuración de seguridad incorrecta
- **CWE:** CWE-348 (Use of Less Trusted Source)
- **STRIDE:** S (Suplantación), R (Repudio), D (Denegación de servicio)
- **Ubicación:** `backend/docker-compose.yml:12-13` (servicio `app`), `backend/src/main.ts:30`; endpoints `POST /api/v1/auth/login` (`backend/src/modules/auth/auth.controller.ts:49`) y `POST /api/v1/survey/responses` (`backend/src/modules/survey/survey.controller.ts:86-88`)
- **Descripción:** el compose de producción publica el puerto 3000 del backend en todas las interfaces del host, además del nginx en 80/443. `main.ts` configura `trust proxy = 1`, que es correcto sólo si TODO el tráfico entra por nginx: Express confía en el socket y toma la última entrada de `X-Forwarded-For`. Un cliente que se conecta directo a `:3000` y envía su propio `X-Forwarded-For` elige su `request.ip`. Como `ThrottlerGuard` usa `req.ip` como clave (`@nestjs/throttler` 6.5.0, `getTracker` devuelve `req.ip`) y la auditoría guarda esa IP, el atacante anula el límite de 5 intentos por 15 minutos del login (fuerza bruta sobre cuentas con acceso a datos de menores) y el de 3 envíos por minuto de la encuesta anónima (relleno masivo de respuestas que contamina las métricas de bienestar), y registra IPs falsas en `AuditLog`. El acceso directo también saltea el `limit_req` y el `client_max_body_size` de nginx.
- **Evidencia:**
  ```yaml
  # backend/docker-compose.yml:12-15
      ports:
        - "3000:3000"
      environment:
        NODE_ENV: production
  ```
  ```ts
  // backend/src/main.ts:30
  app.set('trust proxy', 1);
  ```
  Reproducción aislada (Express 5.2.1 del propio `backend/node_modules`, conexión directa sin proxy):
  ```
  XFF= undefined -> {"ip":"127.0.0.1","ips":[]}
  XFF= 1.2.3.4 -> {"ip":"1.2.3.4","ips":["1.2.3.4"]}
  XFF= 9.9.9.9, 5.6.7.8 -> {"ip":"5.6.7.8","ips":["5.6.7.8"]}
  ```
  Rotando el valor del header en cada petición, cada intento cae en un contador nuevo del throttler.
- **Probabilidad:** Alta — si se despliega con este compose, el puerto queda expuesto y la técnica es un header HTTP trivial.
- **Impacto:** Alto — habilita fuerza bruta de credenciales administrativas, contaminación de la encuesta de menores y falseamiento de la pista de auditoría.
- **Riesgo:** Alto
- **Confianza:** Confirmado (configuración inequívoca y reproducción del comportamiento de Express)
- **Mitigación propuesta:** quitar `ports: "3000:3000"` del servicio `app` en `backend/docker-compose.yml` (dejar sólo `expose: ["3000"]` en la red interna) para que la única entrada sea nginx. Como defensa en profundidad, reemplazar `trust proxy = 1` por la subred de la red de Docker del proxy (por ejemplo `app.set('trust proxy', 'loopback, 172.16.0.0/12')` o la IP fija del contenedor nginx), de modo que un `X-Forwarded-For` que no venga del proxy se ignore. Si delante de nginx se agrega otro proxy o terminador TLS, ajustar los saltos o, mejor, la lista de subredes confiables. Actualizar antes `proxy-addr` ([VULN-29](#vuln-29)), porque la confianza por subred es el caso al que ese aviso aplica.
- **Riesgo de mitigar:** cualquier herramienta o monitoreo que hoy consulte `:3000` directo deja de funcionar (usar `/health` vía nginx). Con subredes confiables mal elegidas todos los clientes pueden quedar con la IP del proxy y compartir el contador del login (5 por 15 minutos), bloqueando a todos: probar con dos clientes distintos detrás de nginx y verificar en `AuditLog` que se registran IPs distintas.

**Estado:** Mitigado (commit fd0b2ee). El compose de producción publica la API sólo en `127.0.0.1:3000`; se entra por nginx.

<a id="vuln-03"></a>
#### VULN-03 — Reverse proxy de producción sin TLS y con cabeceras que contradicen a helmet

- **Origen:** CF-03. Ver también [VULN-17](#vuln-17) (IN-08): mismo tipo de exposición en claro para las URLs firmadas de documentos.
- **Categoría OWASP 2025:** A02 — Configuración de seguridad incorrecta
- **CWE:** CWE-319 (Cleartext Transmission of Sensitive Information)
- **STRIDE:** I (Divulgación de información), T (Manipulación)
- **Ubicación:** `backend/docker/nginx/nginx.conf:10-16, 33-38`; `backend/docker-compose.yml:83-87`
- **Descripción:** el nginx de producción sólo tiene `listen 80`; el compose publica también el 443 pero no existe ningún `server` con certificado, y la redirección a HTTPS está comentada. Si se despliega tal cual, credenciales, access tokens JWT y datos personales de menores (DNI, fechas de nacimiento, documentos) viajan en claro. HSTS enviado por HTTP es ignorado por los navegadores, y la cookie de refresh lleva `Secure` en producción (`auth.cookies.ts:62`), por lo que sobre HTTP el navegador la descarta y el refresco de sesión falla, lo que empuja a "arreglarlo" bajando `NODE_ENV`. Además, los `add_header` a nivel `http` se suman a los de helmet: salen dos `X-Frame-Options` contradictorios (`SAMEORIGIN` de nginx y `DENY` de helmet; con valores en conflicto los navegadores pueden ignorar el header), dos HSTS, `X-XSS-Protection` (obsoleto) y `server_tokens` queda por defecto (versión de nginx expuesta). Este nginx tampoco sirve la SPA: sólo `/api/` y `/health`.
- **Evidencia:**
  ```nginx
  # backend/docker/nginx/nginx.conf:11,16,33-38
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  server {
      listen 80;
      server_name _;
      # Redirect to HTTPS in production (uncomment when SSL is configured)
      # return 301 https://$host$request_uri;
  ```
  ```ts
  // backend/src/security.ts:190
  xFrameOptions: { action: 'deny' },
  ```
- **Probabilidad:** Media — depende de que no exista un terminador TLS delante (no documentado en el repositorio).
- **Impacto:** Alto — exposición de credenciales y PII de menores (Ley 25.326) a cualquiera en la ruta de red.
- **Riesgo:** Alto
- **Confianza:** Probable (condición no verificada: que la topología real de producción no tenga TLS en otro componente)
- **Mitigación propuesta:** agregar un `server { listen 443 ssl http2; ssl_certificate ...; ssl_protocols TLSv1.2 TLSv1.3; }`, activar `return 301 https://$host$request_uri;` en el `server` del puerto 80 (dejando `/.well-known/acme-challenge/` si se usa Let's Encrypt), agregar `server_tokens off;` y quitar del bloque `http` los headers que ya emite helmet para `/api/` (`X-Frame-Options`, HSTS, CSP, `X-XSS-Protection`) o usar `proxy_hide_header` para que haya una sola fuente. Documentar en `documentacion/` cuál es la topología de producción (qué sirve la SPA y dónde termina TLS).
- **Riesgo de mitigar:** requiere certificado y DNS reales; un HSTS con `includeSubDomains` sobre el dominio provincial afecta a subdominios que sigan en HTTP (coordinar con quien administra el dominio). Probar con `curl -I https://<host>/api/v1/health` que haya un único valor por header y que el login y el refresh funcionen con la cookie `Secure`.

**Estado:** Mitigado parcialmente (commit fd0b2ee). Cabeceras coherentes con helmet (`X-Frame-Options: DENY`) y bloque TLS listo para habilitar; falta configurar certificados (decisión de infraestructura).

<a id="vuln-09"></a>
#### VULN-09 — La SPA se sirve sin cabeceras de seguridad (CSP, frame-ancestors, HSTS, Referrer-Policy)

- **Origen:** CF-04
- **Categoría OWASP 2025:** A02 — Configuración de seguridad incorrecta
- **CWE:** CWE-1021 (Improper Restriction of Rendered UI Layers or Frames)
- **STRIDE:** T (Manipulación), I (Divulgación de información)
- **Ubicación:** `frontend/docker/nginx.conf:2-43` (pantallas: todo el panel administrativo y la encuesta pública)
- **Descripción:** el único nginx del repositorio que sirve el build de la SPA no emite ninguna cabecera de seguridad: ni `Content-Security-Policy`, ni `X-Frame-Options` o `frame-ancestors`, ni `X-Content-Type-Options`, ni `Referrer-Policy`, ni `Permissions-Policy`, ni HSTS; `server_tokens` queda activo. La API sí está bien cubierta por helmet, pero los documentos HTML que ejecutan el código con el access token en memoria y que muestran PII de menores no tienen defensa en profundidad contra XSS ni contra clickjacking (embeber el panel en un iframe de un sitio atacante y forzar clics en "validar documento" o "eliminar"). Las rutas de la SPA además incluyen la URL completa en el `Referer` hacia terceros (Google Fonts, enlaces a Google Maps).
- **Evidencia:**
  ```nginx
  # frontend/docker/nginx.conf:38-42 (sólo Cache-Control; no hay otro add_header en el archivo)
  location / {
      add_header Cache-Control "no-cache";
      try_files $uri $uri/ /index.html;
  }
  ```
- **Probabilidad:** Media — el clickjacking no requiere ninguna otra falla; la ausencia de CSP sólo agrava una XSS que tendría que existir.
- **Impacto:** Medio — acciones no deseadas de un administrador y mayor alcance de una eventual XSS sobre datos sensibles.
- **Riesgo:** Medio
- **Confianza:** Confirmado (configuración inequívoca)
- **Mitigación propuesta:** en `frontend/docker/nginx.conf`, a nivel `server` y repetido en cada `location` que use `add_header` (nginx no hereda `add_header` si el bloque define uno propio): `Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: <host de MinIO>; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, `Permissions-Policy "camera=(), microphone=(), geolocation=()"`, `X-Frame-Options DENY` y HSTS cuando haya TLS; `server_tokens off;`. Empezar con `Content-Security-Policy-Report-Only` para detectar recursos bloqueados.
- **Riesgo de mitigar:** una CSP estricta rompe Google Fonts (ver [VULN-41](#vuln-41)), las imágenes servidas desde MinIO por enlaces firmados (otro origen) y cualquier estilo en línea que inyecten Radix o Recharts. Probar con la suite Playwright `test:ui` (desktop y mobile) mirando errores de CSP en consola.

**Estado:** Mitigado (commit fd0b2ee, a29f378). CSP, `frame-ancestors`, HSTS, nosniff, Referrer-Policy y Permissions-Policy en todas las respuestas de la SPA.

<a id="vuln-10"></a>
#### VULN-10 — Subida de documentos sin límites en multer: el archivo se acumula en memoria antes de validar el tamaño, y `fileKey` expuesto

- **Origen:** AC-14 + IN-06 + CF-05 (tres hallazgos fusionados)
- **Categoría OWASP 2025:** A02 — Configuración de seguridad incorrecta (los hallazgos de origen lo clasificaron además como A06 y A10)
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling); CWE-200 (Exposure of Sensitive Information)
- **STRIDE:** D (Denegación de servicio), I (Divulgación de información)
- **Ubicación:** `backend/src/modules/documents/documents.controller.ts:43-70` (`POST /api/v1/documents/upload`); `backend/src/modules/documents/documents.service.ts:73-88`; `backend/src/modules/participants/participants.service.ts:187`; patrón correcto ya presente en `backend/src/modules/images/image-upload.interceptor.ts:20-33`
- **Descripción:** `FileInterceptor('file')` se usa sin `limits`, con el almacenamiento en memoria por defecto de multer. El `MaxFileSizeValidator` de `ParseFilePipeBuilder` corre después de que multer juntó el archivo entero en un `Buffer`. Un usuario con `DOCUMENT_UPLOAD` (incluye DELEGADO, `common/constants/index.ts:227-233`) puede mandar un archivo de varios GB, o varias subidas concurrentes, y agotar la memoria del proceso, tirando la API para todos (instancia única). nginx acota el cuerpo a 10 MB por petición, pero por el puerto 3000 publicado ([VULN-02](#vuln-02)) no hay ningún tope, y el límite de 1 MB del backend (`security.ts:281-290`) sólo aplica a JSON y urlencoded, no a multipart. El módulo de imágenes ya resolvió esto, pero documentos no. Por otro lado, el hallazgo O-7 sacó `fileKey` del listado de documentos, pero sigue saliendo en la respuesta de `POST /documents/upload` y en `GET /participants/:id` (`documents: true`); sin credenciales de MinIO la clave sola no da acceso, porque el bucket es privado.
- **Evidencia:**
  ```ts
  // documents.controller.ts:43-45, 62-64
  @UseInterceptors(FileInterceptor('file'))            // sin { limits }
  ...
  new ParseFilePipeBuilder().addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
  ```
  ```ts
  // image-upload.interceptor.ts:20-31 (el patrón correcto, ya presente en el repositorio)
  const MulterImagen = FileInterceptor('file', {
    limits: { fileSize: IMAGE_MAX_BYTES + 1, files: 1, fields: 5, fieldSize: 1024, parts: 6 },
  });
  ```
  También `return document;` con `fileKey` (`documents.service.ts:73-88`).
- **Probabilidad:** Baja a Media — requiere una cuenta con permiso de subida (AC-14 e IN-06: Baja); CF-05 la considera Media porque las cuentas DELEGADO son numerosas.
- **Impacto:** Medio a Alto — caída del backend completo por falta de memoria durante la competencia (IN-06: Alto; CF-05: Medio); la exposición de `fileKey` por sí sola es de impacto Bajo.
- **Riesgo:** Medio (el más alto de los hallazgos de origen: AC-14 Bajo, IN-06 Medio, CF-05 Medio)
- **Confianza:** Confirmado (código inequívoco; comportamiento conocido de multer con `memoryStorage`)
- **Mitigación propuesta:** `FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 + 1, files: 1, fields: 5, fieldSize: 1024, parts: 7 } })`, replicando el envoltorio de imágenes para mantener el 422; omitir `fileKey` en ambas respuestas con un `select`. Bajar `client_max_body_size` de nginx a unos 6 MB para `/api/v1/documents/upload`.
- **Riesgo de mitigar:** el exceso de tamaño pasa a cortarse en multer (413 si no se envuelve): los clientes que esperan 422 deben seguir recibiéndolo. Si `fields` o `parts` quedan cortos, el formulario de subida (que envía `participantId` y `type`) responde 400. Probar con el e2e de documentos y con archivos de 5 MB exactos y de 5 MB más 1 byte.

**Estado:** Mitigado (commit e981f4b). Límites de multer (6 MB), sin `fileKey` en las respuestas.

<a id="vuln-11"></a>
#### VULN-11 — Redis sin autenticación ni TLS, y `REDIS_PASSWORD` no es obligatoria en producción

- **Origen:** IN-09 + CF-06
- **Categoría OWASP 2025:** A02 — Configuración de seguridad incorrecta (IN-09 lo clasificó como A04, con componente de A08 por la integridad de la caché)
- **CWE:** CWE-306 (Missing Authentication for Critical Function); CWE-319 (Cleartext Transmission of Sensitive Information)
- **STRIDE:** T (Manipulación), I (Divulgación de información)
- **Ubicación:** `docker-compose.yml:44-55`, `backend/docker-compose.yml:49-59`, `backend/docker-compose.dev.yml:25-37`, `e2e/docker-compose.e2e.yml:29-36`; `backend/src/config/config.validation.ts:30-33, 46, 51, 142`; `backend/src/common/cache/redis-cache.service.ts:50-58`
- **Descripción:** ningún compose configura `requirepass` en Redis, y el esquema de entorno declara `REDIS_PASSWORD` como opcional: el chequeo "sólo en producción" se saltea cuando la variable está vacía (`continue` en la línea 142), así que el backend arranca en producción sin contraseña de Redis y sin ningún aviso. Redis guarda los agregados cacheados de las métricas de la encuesta, las estadísticas del dashboard y el contador de versión de campaña; el backend los deserializa con `JSON.parse` y los devuelve sin recalcular. Quien alcance Redis (por ejemplo, otro contenedor comprometido en la misma red) puede leer los agregados o escribir valores arbitrarios que el panel publicará como reales. En el compose de desarrollo el puerto 6379 se publica en `0.0.0.0`. La conexión a Postgres tampoco declara `sslmode`, y en producción la contraseña de la base sólo se valida como parte de la `DATABASE_URL` completa (mínimo 20 caracteres), por lo que una contraseña de un carácter pasa. En un único host con red Docker interna el riesgo es acotado.
- **Evidencia:**
  ```ts
  // config.validation.ts:30-33, 51, 142
  const PRODUCTION_ONLY_SECRETS = [
    { key: 'DATABASE_URL', minLength: 20 },
    { key: 'REDIS_PASSWORD', minLength: 16 },
  ];
      REDIS_PASSWORD: z.string().optional(),
        if (typeof value !== 'string' || value.trim() === '') continue;
  ```
  ```yaml
  # backend/docker-compose.dev.yml:25-30
    redis:
      image: redis:7-alpine
      ports:
        - "6379:6379"
  ```
- **Probabilidad:** Baja en producción (Redis no publica puertos al host; requiere presencia previa en la red interna) y Media en desarrollo (puerto expuesto a la red local).
- **Impacto:** Medio — manipulación de métricas publicadas y lectura de agregados de la encuesta de menores.
- **Riesgo:** Medio (CF-06: Medio; IN-09: Bajo, al considerar sólo producción)
- **Confianza:** Confirmado (configuración versionada); la configuración real de producción no se verificó.
- **Mitigación propuesta:** agregar `command: ["redis-server", "--requirepass", "${REDIS_PASSWORD:?definir REDIS_PASSWORD}"]` (y el healthcheck con `redis-cli -a`) en los compose; en `config.validation.ts`, convertir el `continue` en error para `PRODUCTION_ONLY_SECRETS` (hacer `REDIS_PASSWORD` obligatoria cuando `NODE_ENV === 'production'`) y validar la contraseña de `DATABASE_URL` por separado (`new URL(env.DATABASE_URL).password` con longitud mínima y patrones prohibidos). En `backend/docker-compose.dev.yml` publicar `127.0.0.1:6379:6379`. Si Redis o Postgres salen del host, usar TLS (`rediss://`, `sslmode=require`).
- **Riesgo de mitigar:** los entornos existentes sin `REDIS_PASSWORD` dejan de arrancar en producción y los scripts que se conectan a Redis (`prisma/seed-survey-responses.ts:178-180`) necesitan la variable. Actualizar `.env.example`, `backend/scripts/docker-dev.mjs` y `e2e/scripts/gen-env.mjs` para generarla, y correr `config.validation.spec.ts`.

**Estado:** Mitigado parcialmente (commit fd0b2ee, f11df18). Redis con `requirepass` y `REDIS_PASSWORD` obligatoria en producción; sin TLS (red interna de Docker).

<a id="vuln-12"></a>
#### VULN-12 — Compose de desarrollo y local publican servicios en todas las interfaces, uno con contraseña fija

- **Origen:** CF-07
- **Categoría OWASP 2025:** A02 — Configuración de seguridad incorrecta
- **CWE:** CWE-1188 (Initialization of a Resource with an Insecure Default)
- **STRIDE:** I (Divulgación de información), T (Manipulación)
- **Ubicación:** `backend/docker-compose.dev.yml:10-15` (Postgres), `:44-46` (MinIO API y consola); `docker-compose.yml:74-76` (MinIO 9100/9101), `:132-133` (web 8080); `backend/.env.example:15`
- **Descripción:** el compose de desarrollo publica Postgres en `0.0.0.0:5434` con la contraseña literal `evita_password` (la misma que figura en `backend/.env.example`), y MinIO en `0.0.0.0:9000/9001`. El compose de la raíz publica la consola de MinIO (9101) y la web (8080) también en todas las interfaces. Las notebooks de los desarrolladores se usan en redes del instituto o Wi-Fi compartidas: cualquiera en la misma red puede conectarse a la base de desarrollo con credenciales conocidas. Aunque la seed es ficticia, es habitual copiar datos reales para depurar, y la base contiene el esquema completo de PII. El compose de la raíz ya resolvió esto para Postgres (`127.0.0.1:5435`) y el stack e2e para todo, lo que muestra que es viable.
- **Evidencia:**
  ```yaml
  # backend/docker-compose.dev.yml:10-15
      ports:
        - "5434:5432"
      environment:
        POSTGRES_USER: evita_user
        POSTGRES_PASSWORD: evita_password
  ```
  ```yaml
  # docker-compose.yml:74-76
      ports:
        - "9100:9000"
        - "9101:9001"
  ```
- **Probabilidad:** Media — la contraseña es pública en el repositorio; la alcanzabilidad depende del firewall de Windows de cada equipo.
- **Impacto:** Medio — lectura y escritura completa de la base de desarrollo y de los documentos en el MinIO de desarrollo.
- **Riesgo:** Medio
- **Confianza:** Confirmado (configuración); la alcanzabilidad desde la LAN depende del firewall del host (no verificado).
- **Mitigación propuesta:** prefijar `127.0.0.1:` en todos los `ports` de `backend/docker-compose.dev.yml` y en MinIO y web de `docker-compose.yml` (salvo que se necesite probar desde un celular, caso en el que conviene un perfil explícito). Reemplazar `POSTGRES_PASSWORD: evita_password` por `${DB_PASSWORD:?definir DB_PASSWORD en backend/.env}` y quitar la contraseña del `DATABASE_URL` de `backend/.env.example`.
- **Riesgo de mitigar:** cambiar la contraseña de Postgres exige recrear el volumen de desarrollo (pérdida de datos locales, ya mencionado en `config.validation.ts:25-28`). Quien pruebe la web desde otro dispositivo de la red dejará de poder hacerlo sin el perfil alternativo.

**Estado:** Mitigado (commit fd0b2ee). Puertos de desarrollo en `127.0.0.1`; el stack de la raíz usa `BIND_HOST` (por defecto local).

<a id="vuln-13"></a>
#### VULN-13 — `NODE_ENV` falla en abierto y el stack completo de la raíz corre en modo desarrollo con Swagger expuesto

- **Origen:** CF-08. Ver también [VULN-38](#vuln-38) (AC-09): mismo origen para el flag `Secure` de la cookie.
- **Categoría OWASP 2025:** A02 — Configuración de seguridad incorrecta
- **CWE:** CWE-1188 (Initialization of a Resource with an Insecure Default)
- **STRIDE:** I (Divulgación de información), E (Elevación de privilegios)
- **Ubicación:** `backend/src/config/config.validation.ts:38-40`, `backend/src/config/index.ts:7`, `backend/src/swagger.ts:18-20`, `docker-compose.yml:96, 132-133`, `frontend/docker/nginx.conf:18-19`; endpoints `/api/docs` y `/api/docs-json`
- **Descripción:** si `NODE_ENV` falta, el sistema asume `development`: Swagger se monta, los logs van en nivel `debug`, la cookie de refresh pierde `Secure` y no se auditan `DATABASE_URL` ni `REDIS_PASSWORD`. El `docker-compose.yml` de la raíz, que es el único que levanta SPA y API juntas y el que documenta el README, fija `NODE_ENV: development` a propósito (para aceptar CORS a localhost) y publica la web en `0.0.0.0:8080`; como Swagger se monta en `/api/docs` y nginx reenvía todo `/api/`, el mapa completo de endpoints y DTOs queda accesible a cualquiera en la red. Si este stack "local" se usa para una demo o un servidor del evento, todas las protecciones condicionadas a producción quedan apagadas.
- **Evidencia:**
  ```ts
  // config.validation.ts:38-40
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ```
  ```yaml
  # docker-compose.yml:89-90, 96
      # NODE_ENV=development a propósito (abajo): la validación de producción
      # rechaza CORS a localhost. La imagen trae tini como PID 1.
      NODE_ENV: development
  ```
  ```nginx
  # frontend/docker/nginx.conf:18-19 — reenvía también /api/docs
  location /api/ {
      proxy_pass http://backend:3000;
  ```
- **Probabilidad:** Media — es el stack de uso documentado y está publicado en todas las interfaces.
- **Impacto:** Medio — reconocimiento completo de la API y debilitamiento de la cookie de sesión; no da acceso a datos por sí solo.
- **Riesgo:** Medio
- **Confianza:** Confirmado (configuración)
- **Mitigación propuesta:** hacer `NODE_ENV` obligatorio (sin `.default`) o que el valor por defecto sea `production` (fallar cerrado), y en `config/index.ts` leer el valor validado. Separar "permitir CORS a localhost" de `NODE_ENV` (por ejemplo `ALLOW_LOCALHOST_CORS=true` sólo en el compose local) para que el stack de la raíz pueda correr con `NODE_ENV=production`, o al menos publicar `127.0.0.1:8080:80`. Opcionalmente controlar Swagger con una variable explícita `SWAGGER_ENABLED`.
- **Riesgo de mitigar:** con `production` la cookie pasa a `Secure` y sobre `http://localhost` funciona en Chrome y Firefox, pero no sobre `http://<IP de la LAN>`; el e2e (`e2e/docker-compose.e2e.yml:60`) también usa `development`. Correr `config.validation.spec.ts`, `security-headers.e2e-spec.ts` y la suite Playwright.

**Estado:** Mitigado parcialmente (commit f11df18). Swagger sólo con `NODE_ENV=development|test` explícito y aviso al arrancar sin NODE_ENV; la configuración sigue cayendo en desarrollo para no romper el entorno local.

<a id="vuln-14"></a>
#### VULN-14 — La seed no tiene guarda de producción y es destructiva

- **Origen:** CF-09
- **Categoría OWASP 2025:** A02 — Configuración de seguridad incorrecta
- **CWE:** CWE-1188 (Initialization of a Resource with an Insecure Default)
- **STRIDE:** T (Manipulación), E (Elevación de privilegios)
- **Ubicación:** `backend/prisma/seed.ts:864-867, 1072-1094, 1394, 1716`; `backend/package.json` (scripts `db:seed`, `prisma.seed`); `backend/docker/entrypoint.local.sh:26-28`
- **Descripción:** `seed.ts` no verifica el entorno. Si se ejecuta contra la base de producción (`npx prisma db seed` con el `DATABASE_URL` equivocado, o el entrypoint local apuntado a un servidor), borra TODOS los eventos del calendario (`deleteMany({})`), elimina partidos y resultados de las competencias de prueba, inserta participantes, equipos e inscripciones ficticios mezclados con los reales, y hace `upsert` del SUPER_ADMIN restableciendo su contraseña, su rol y `isActive: true` (reactiva una cuenta que se hubiera desactivado). El script hermano `seed-survey-responses.ts` sí tiene la guarda, lo que muestra la inconsistencia.
- **Evidencia:**
  ```ts
  // seed.ts:1087-1094, 1394
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, firstName: 'Super', lastName: 'Administrador',
        role: UserRole.SUPER_ADMIN, isActive: true },
  ...
    await prisma.calendarEvent.deleteMany({});
  ```
  ```ts
  // seed-survey-responses.ts:197-201 (guarda presente sólo aquí)
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Este script genera respuestas inventadas: no se corre en producción.');
  ```
- **Probabilidad:** Baja — requiere un error de operación, pero no hay ningún freno.
- **Impacto:** Alto — pérdida de datos reales del calendario y resultados, contaminación del padrón con datos ficticios y reactivación de una cuenta privilegiada.
- **Riesgo:** Medio
- **Confianza:** Confirmado (código)
- **Mitigación propuesta:** al inicio de `main()` en `seed.ts`, abortar si `NODE_ENV === 'production'` salvo una variable explícita (`ALLOW_PROD_SEED=yes`), y separar la creación del primer administrador (sólo `create` si no existe, nunca `update` de rol, estado o contraseña) del resto de los datos de demostración.
- **Riesgo de mitigar:** el entrypoint local corre la imagen con el `NODE_ENV` del compose (`development`), así que no se ve afectado; si algún flujo de despliegue usa la seed para crear el primer admin, necesitará el script separado. Probar `npm run db:demo` y `npm run db:demo:reset`.

**Estado:** Mitigado (commit f11df18). La seed no corre en producción salvo `SEED_ALLOW_PRODUCTION=true`.

---

<a id="a03"></a>
### A03 — Fallas en la cadena de suministro de software

Categoría nueva en 2025 que amplía "componentes vulnerables" a toda la cadena: dependencias, procesos de compilación y de distribución. Es como un ingrediente contaminado que llega del proveedor. Para este proyecto se aplicó SCA con `npm audit` y se revisó el pipeline de CI, las imágenes base y los scripts de instalación.

| Paquete | Total | Crítica | Alta | Moderada | Sólo producción (`--omit=dev`) |
|---|---:|---:|---:|---:|---|
| backend | 48 | 2 | 19 | 27 | 28 (1 crítica, 18 altas, 9 moderadas) |
| frontend | 8 | 0 | 7 | 1 | 8 (npm las cuenta como "producción" porque `@tailwindcss/vite` declara `vite` como peer; al navegador sólo llegan `axios`, `react-router` y `zod`) |
| e2e | 0 | 0 | 0 | 0 | — |

Los resultados crudos están en la carpeta de trabajo de la auditoría y no se reproducen aquí. Los avisos se reparten entre VULN-04 (alcanzables desde la red), VULN-29 (baja alcanzabilidad), VULN-30 (navegador) y VULN-31 (herramientas de desarrollo); VULN-15 y VULN-16 tratan el proceso y las imágenes base.

<a id="vuln-04"></a>
#### VULN-04 — Dependencias de runtime del backend con vulnerabilidades de DoS alcanzables desde la red

- **Origen:** CF-02
- **Categoría OWASP 2025:** A03 — Fallas en la cadena de suministro de software
- **CWE:** CWE-1395 (Dependency on Vulnerable Third-Party Component)
- **STRIDE:** D (Denegación de servicio)
- **Ubicación:** `backend/package-lock.json` (versiones resueltas); uso en `backend/src/security.ts:288-290` (body parsers), `backend/src/main.ts:57` (compression), `backend/src/modules/documents/documents.controller.ts:45` y `backend/src/modules/images/image-upload.interceptor.ts:24` (multer)
- **Descripción:** las librerías que procesan cada petición entrante tienen avisos publicados de denegación de servicio: `body-parser` 2.3.0 (vía `express` 5.2.1) corre sobre todos los endpoints, incluidos los públicos anónimos como la encuesta, y descomprime cuerpos `Content-Encoding: gzip/deflate` por defecto; `compression` 1.8.1 se aplica a todas las respuestas; `qs` 6.15.3 parsea los cuerpos urlencoded (`extended: true`); `multer` 2.2.0 procesa las subidas (requiere usuario autenticado, porque los guards corren antes que los interceptores, pero DELEGADO tiene permiso de subida). El backend corre como una sola instancia: una caída deja sin inscripciones ni resultados en vivo durante los Juegos.
- **Evidencia:** `npm audit --omit=dev --json` en `backend/`:
  ```
  HIGH body-parser 2.0.0-2.3.0  GHSA-27r3-jxmh-p828 DoS via trailing bytes after a compressed request body (fix >=2.4.0)
  HIGH compression <1.8.2       GHSA-vc2v-76pw-4v95 DoS via memory leak on premature response close (fix 1.8.2)
  HIGH multer <=2.4.0           GHSA-wc9g-mqfw-jrwm, GHSA-535w-7cp7-47q4, GHSA-q7qp-rjg7-q26m (DoS por nombres de campo / fileFilter) (fix >=2.5.0)
  MODERATE qs 2.2.5-6.16.0      GHSA-4mjr-xmp4-gh2g, GHSA-x5fp-wj9c-mxmx
  HIGH zod <4.6.6               GHSA-mrhx-c7xc-m3w5 (en el backend sólo valida variables de entorno: no alcanzable desde la red)
  ```
  Árbol: `@nestjs/platform-express@11.1.28 → express@5.2.1 → body-parser@2.3.0, qs@6.15.3`; `@nestjs/platform-express → multer@2.2.0`; `compression@1.8.1` directo. Todos con `fixAvailable: true` sin cambio de versión mayor.
- **Probabilidad:** Media — los avisos son públicos y el vector (cuerpo comprimido o cierre prematuro de la conexión) se puede enviar de forma anónima; no se ejecutó una prueba de concepto.
- **Impacto:** Alto — indisponibilidad total de la plataforma (instancia única) en un evento con resultados en tiempo real.
- **Riesgo:** Alto
- **Confianza:** Confirmado (versiones vulnerables instaladas y código que las ejerce); la explotabilidad concreta de cada aviso no se reprodujo.
- **Mitigación propuesta:** en `backend/`, actualizar `@nestjs/platform-express` (y `@nestjs/common` y `@nestjs/core` en el mismo minor) a la última 11.x, `compression` a `^1.8.2`, `zod` a `^4.6.6`, y regenerar el lockfile con `npm audit fix` (sin `--force`) para que suban `express`, `body-parser`, `qs`, `multer` y `proxy-addr`. Verificar después con `npm ls body-parser multer qs compression proxy-addr`.
- **Riesgo de mitigar:** los cambios de minor de Nest y Express pueden alterar el parsing de multipart o los mensajes de error (413/422). Correr `npm test` y `npm run test:e2e` del backend (incluye `security-headers.e2e-spec.ts` y las pruebas de subida de imágenes y documentos) y la suite Playwright `test:api`.

**Estado:** Mitigado (commit a68415b). `npm audit fix --omit=dev`: body-parser, compression, multer, qs y proxy-addr actualizados.

<a id="vuln-15"></a>
#### VULN-15 — No hay análisis de dependencias automatizado y el pipeline de CI tiene una higiene débil

- **Origen:** CF-10
- **Categoría OWASP 2025:** A03 — Fallas en la cadena de suministro de software
- **CWE:** CWE-1104 (Use of Unmaintained Third Party Components)
- **STRIDE:** T (Manipulación), E (Elevación de privilegios)
- **Ubicación:** `.github/workflows/ci.yml:1-68`; `backend/.github/workflows/ci.yml` (no lo ejecuta GitHub); ausencia de `.github/dependabot.yml` o configuración de Renovate
- **Descripción:** el único workflow que GitHub ejecuta (`.github/workflows/ci.yml`) cubre sólo el backend: no compila ni prueba el frontend ni el e2e, no corre `npm audit` ni ninguna herramienta SCA o SAST, y no hay Dependabot ni Renovate. Por eso se acumularon 56 avisos (VULN-04, VULN-29, VULN-30 y VULN-31) sin que nadie se enterara. Las acciones se referencian por tag móvil (`actions/checkout@v4`, `actions/setup-node@v4`) en lugar de SHA, no hay bloque `permissions:` (el `GITHUB_TOKEN` toma el permiso por defecto del repositorio), y usa Node `20.x`, fuera de soporte desde abril de 2026, mientras las imágenes usan Node 22. `backend/.github/workflows/ci.yml` es un workflow muerto (GitHub sólo lee `.github/` de la raíz) que da una falsa impresión de cobertura (tests, migraciones, e2e, build de Docker).
- **Evidencia:**
  ```yaml
  # .github/workflows/ci.yml:39-44
      - uses: actions/checkout@v4
      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
  ```
  `ls .github` → sólo `workflows/ci.yml`; no existe `dependabot.yml`. `grep -n "permissions" .github/workflows/ci.yml` → sin resultados.
- **Probabilidad:** Alta — ya ocurrió: hay vulnerabilidades altas sin detectar en runtime.
- **Impacto:** Medio — no es explotable por sí mismo, pero permite que lleguen a producción componentes vulnerables y que una acción comprometida corra con el token del repositorio.
- **Riesgo:** Medio
- **Confianza:** Confirmado
- **Mitigación propuesta:** agregar `.github/dependabot.yml` para `npm` en `/backend`, `/frontend`, `/e2e`, `docker` y `github-actions`; sumar al workflow un paso `npm audit --omit=dev --audit-level=high` por paquete (fallando el build) y jobs de build y prueba para el frontend; declarar `permissions: { contents: read }` a nivel workflow; fijar las acciones por SHA con comentario de versión; subir a Node 22 (alineado con los Dockerfile); mover o borrar `backend/.github/workflows/ci.yml` integrando sus pasos útiles (migraciones, tests e2e) en el workflow raíz.
- **Riesgo de mitigar:** `npm audit` como puerta puede bloquear PRs por avisos sin parche (por ejemplo los de `minio`, [VULN-29](#vuln-29)): usar `--audit-level=high` y una lista de excepciones revisada. Fijar por SHA requiere que Dependabot actualice las acciones.

**Estado:** Mitigado parcialmente (commit 01f6ed4). Permisos mínimos, `npm audit` en CI y Dependabot; las acciones siguen fijadas por tag, no por SHA.

<a id="vuln-16"></a>
#### VULN-16 — Imágenes base sin digest, con tags móviles y una versión de nginx sin mantenimiento

- **Origen:** CF-11
- **Categoría OWASP 2025:** A03 — Fallas en la cadena de suministro de software
- **CWE:** CWE-1104 (Use of Unmaintained Third Party Components)
- **STRIDE:** T (Manipulación)
- **Ubicación:** `backend/docker-compose.yml:63, 80`; `frontend/docker/Dockerfile:5, 20`; `e2e/docker-compose.e2e.yml:98`; `backend/docker/Dockerfile:6, 19`; `backend/docker/Dockerfile.local:20-21`; `.github/workflows/ci.yml:15, 29`
- **Descripción:** ninguna imagen se fija por digest (`@sha256:`), por lo que el mismo Dockerfile puede producir imágenes distintas y un tag republicado entra sin revisión. El compose de producción usa `minio/minio:latest` (según el propio comentario de `docker-compose.yml:58-63`, esa imagen ya no se publica, así que `latest` apunta a una versión vieja y sin parches o no se puede bajar) y `nginx:alpine` sin versión. La SPA se sirve con `nginx:1.27-alpine`, rama mainline que dejó de recibir versiones cuando salieron 1.28 (estable) y 1.29 (mainline) en 2025. El CI usa `redis:alpine` y `postgres:15-alpine`, distintos de lo que corre en el resto de los entornos. MinIO y el proceso maestro de nginx corren como root dentro de sus contenedores.
- **Evidencia:**
  ```yaml
  # backend/docker-compose.yml:63, 80
      image: minio/minio:latest
      image: nginx:alpine
  ```
  ```dockerfile
  # frontend/docker/Dockerfile:20
  FROM nginx:1.27-alpine
  ```
- **Probabilidad:** Media — la deriva de versiones es segura con tags móviles; el compromiso de una imagen oficial es poco probable.
- **Impacto:** Medio — servidores web y almacenamiento de documentos con CVE sin parchear, despliegues no reproducibles.
- **Riesgo:** Medio
- **Confianza:** Confirmado para la falta de digest y los tags móviles; Probable para el fin de soporte de nginx 1.27 (según el ciclo de versiones de nginx, no verificado en línea en esta revisión).
- **Mitigación propuesta:** usar `pgsty/minio:RELEASE.2026-08-04T00-00-00Z` (como el compose de la raíz) y una versión explícita de nginx soportada (`nginx:1.28-alpine` o la mainline vigente) en `backend/docker-compose.yml` y `frontend/docker/Dockerfile`; fijar todas las imágenes por digest (`image: nginx:1.28-alpine@sha256:...`) y dejar que Dependabot (ecosistema `docker`) las actualice; alinear el CI con `postgres:16-alpine` y `redis:7-alpine`. Evaluar `nginxinc/nginx-unprivileged` para el frontend.
- **Riesgo de mitigar:** cambiar de nginx 1.27 a 1.28 o posterior puede requerir revisar directivas (bajo riesgo para esta configuración). Con digest fijo, los parches de seguridad sólo llegan cuando alguien acepta el PR de actualización. Probar `docker compose build` y la suite e2e.

**Estado:** Mitigado parcialmente (commit fd0b2ee). MinIO y nginx con versión fija (sin `latest`); sin fijar por digest.

<a id="vuln-29"></a>
#### VULN-29 — Dependencias de runtime del backend con avisos de baja alcanzabilidad (incluye la "crítica" de `proxy-addr`)

- **Origen:** CF-12
- **Categoría OWASP 2025:** A03 — Fallas en la cadena de suministro de software
- **CWE:** CWE-1395 (Dependency on Vulnerable Third-Party Component)
- **STRIDE:** D (Denegación de servicio), S (Suplantación)
- **Ubicación:** `backend/package.json` (`dependencies`) y `backend/package-lock.json`
- **Descripción:** el resto de los 28 avisos de producción del backend están en código que no recibe datos del atacante o en ramas no usadas, pero llegan a la imagen y deben actualizarse: (a) `proxy-addr` 2.0.7 (crítica, GHSA-jqcg-44mw-7w3h) sólo afecta la confianza por subred con direcciones IPv4 mapeadas en IPv6; con `trust proxy = 1` (conteo de saltos) no aplica, pero sí aplicaría si se adopta la mitigación de [VULN-02](#vuln-02) con subredes, por lo que debe actualizarse ANTES; (b) `prisma` 7.8.0 está en `dependencies` (necesario para `migrate deploy` en la imagen local) y arrastra `@prisma/dev` → `hono`, `@hono/node-server`, `mysql2`, `effect`, `deepmerge-ts`, `valibot`, `ajv → fast-uri` (no se ejecutan en el runtime de la API); (c) `minio` 8.0.7 → `fast-xml-parser` 5.9.3, `query-string`/`decode-uri-component`, `stream-json` (parsean respuestas del MinIO propio); (d) `exceljs` 4.4.0 → `uuid` (v3/v5/v6 con buffer, no usados) y `archiver` → `brace-expansion`; (e) `@nestjs/swagger` → `js-yaml` (Swagger apagado en producción); (f) `pino-pretty` → `fast-copy` (transporte sólo fuera de producción); (g) `zod` (sólo variables de entorno).
- **Evidencia:** `npm audit --omit=dev` en `backend/`: 1 crítica (`proxy-addr`), 18 altas, 9 moderadas. Corrección disponible: `prisma@7.10.1` y `@prisma/client@7.10.1` (juntos, hoy fijados exactos en 7.8.0), `npm audit fix` para `proxy-addr` 2.0.8, `fast-xml-parser`, `fast-uri`, `fast-copy`, `js-yaml`, `qs`; para `minio` y `exceljs` npm sólo propone bajar de versión mayor (`minio@7.1.3`, `exceljs@3.4.0`), lo que no es una solución.
- **Probabilidad:** Baja — no hay entrada del atacante a esos caminos en el uso actual.
- **Impacto:** Medio — si cambian los supuestos (por ejemplo, confianza por subred o un MinIO comprometido) los avisos pasan a ser explotables.
- **Riesgo:** Bajo
- **Confianza:** Confirmado (versiones instaladas); la no alcanzabilidad es un análisis de código, no una prueba.
- **Mitigación propuesta:** `npm audit fix` (sin `--force`) en `backend/`; subir `prisma` y `@prisma/client` a 7.10.1 a la vez; para `minio` y `exceljs` usar `overrides` en `package.json` sobre las transitivas con parche (`fast-xml-parser`, `decode-uri-component`, `stream-json`, `uuid`, `brace-expansion`) verificando compatibilidad, o esperar versiones nuevas de esas librerías.
- **Riesgo de mitigar:** un `override` de transitivas puede romper la firma de URLs de MinIO o la exportación a Excel; probar subida y descarga de documentos y la exportación de reportes. El salto de Prisma requiere `prisma generate` y correr migraciones en una base de prueba.

**Estado:** Mitigado parcialmente (commit a68415b). Quedan avisos que piden versión mayor (componentes internos de Prisma, MinIO, exceljs, uuid).

<a id="vuln-30"></a>
#### VULN-30 — Dependencias del frontend que llegan al navegador con avisos publicados

- **Origen:** CF-13
- **Categoría OWASP 2025:** A03 — Fallas en la cadena de suministro de software
- **CWE:** CWE-1395 (Dependency on Vulnerable Third-Party Component)
- **STRIDE:** T (Manipulación)
- **Ubicación:** `frontend/package.json` (`axios ^1.18.1`, `react-router ^8.2.0`, `zod ^4.4.3`); `frontend/package-lock.json`
- **Descripción:** del bundle que se entrega a los usuarios: `axios` 1.18.1 tiene 12 avisos (corrección en 1.20.0); la mayoría son exclusivos del adaptador HTTP/HTTP2 de Node (`follow-redirects`, `createConnection`, proxy, DNS) y no se incluyen en el build del navegador, pero los de "gadget de prototype pollution" y de inyección de headers sí aplican al adaptador XHR/fetch, aunque requieren una contaminación de prototipo previa. `react-router` 8.2.0 (GHSA-qwww-vcr4-c8h2) sólo afecta el modo RSC, que esta SPA no usa. `zod` anterior a 4.6.6 en el cliente sólo permite que un usuario se cause un DoS a sí mismo.
- **Evidencia:** `npm audit --json` en `frontend/`: `HIGH axios (direct) range=1.0.0-1.19.0 fix=true`, `HIGH react-router (direct) range=8.0.0-8.2.0`, `HIGH zod (direct) range=<4.6.6`. Versiones instaladas: axios 1.18.1, react-router 8.2.0.
- **Probabilidad:** Baja — requiere una primitiva adicional (prototype pollution) o un modo no usado.
- **Impacto:** Medio — alteración de peticiones autenticadas del panel.
- **Riesgo:** Bajo
- **Confianza:** Confirmado (versiones); la aplicabilidad parcial es análisis, no prueba.
- **Mitigación propuesta:** en `frontend/`: `npm install axios@^1.20.0 react-router@^8.3.0 zod@^4.6.6` y `npm audit fix` para el resto.
- **Riesgo de mitigar:** bajo (sin cambio de versión mayor). Probar `npm run build`, los `check:*` y la suite Playwright `test:ui`.

**Estado:** Mitigado (commit a29f378). axios, react-router y zod actualizados.

<a id="vuln-31"></a>
#### VULN-31 — Herramientas de desarrollo, build y prueba con avisos (incluye Handlebars crítica y el servidor de Vite en Windows)

- **Origen:** CF-14
- **Categoría OWASP 2025:** A03 — Fallas en la cadena de suministro de software
- **CWE:** CWE-1395 (Dependency on Vulnerable Third-Party Component)
- **STRIDE:** E (Elevación de privilegios), D (Denegación de servicio)
- **Ubicación:** `backend/package.json` (`devDependencies`), `frontend/package.json` (`vite ^8.1.1`)
- **Descripción:** sólo afectan las máquinas de desarrollo y el CI, no la imagen de producción. Backend (20 avisos exclusivos de desarrollo): `handlebars` 4.7.9 vía `ts-jest` (2 críticas de inyección de JavaScript al compilar plantillas; `ts-jest` no compila plantillas de terceros), cadena de `jest` 30 → `glob`/`minimatch`, `typescript-eslint`, `@nestjs/cli` → `glob`, `browserslist`, `baseline-browser-mapping`. Frontend: `vite` 8.1.5 con avisos de `launch-editor` (uno alto específico de Windows, GHSA-587h-7wmj-h5pm) y de lectura de archivos fuera de `server.fs.allow`, más `postcss`, `nanoid` y `source-map-js` en el build. El equipo desarrolla en Windows y el servidor de Vite queda en `localhost:5173`, por lo que el riesgo existe mientras `npm run dev` está corriendo. El paquete `e2e/` no tiene avisos.
- **Evidencia:** diferencia entre `npm audit` y `npm audit --omit=dev` en `backend/`: 1 crítica (`handlebars`), 1 alta (`browserslist`), 18 moderadas. `npm ls handlebars` → `ts-jest@29.4.11 → handlebars@4.7.9`. Frontend: `HIGH vite (direct) range=8.0.0-8.1.5`.
- **Probabilidad:** Baja — requiere que un desarrollador abra contenido malicioso con el servidor de desarrollo activo o que una dependencia de prueba reciba entrada no confiable.
- **Impacto:** Medio — ejecución de comandos en la máquina del desarrollador (con acceso al repositorio y a `.env`).
- **Riesgo:** Bajo
- **Confianza:** Confirmado (versiones); explotabilidad no probada.
- **Mitigación propuesta:** `npm audit fix` en ambos paquetes; `vite` a la última 8.x (posterior a 8.1.5). Para las cadenas que npm resuelve sólo con cambio mayor (`@nestjs/cli@12`, `jest@29`), preferir esperar la versión con parche o un `override` de `glob`/`minimatch` en lugar de bajar `jest`.
- **Riesgo de mitigar:** las actualizaciones de herramientas pueden cambiar reglas de lint o la configuración de Jest; correr `npm run lint`, `npm test` y `npm run build` en cada paquete.

**Estado:** Aceptado. Herramientas de build y prueba (vite, postcss, Jest): no llegan al navegador; actualizar Jest a 30.5 rompía un test con pglite. Las sigue Dependabot.

<a id="vuln-46"></a>
#### VULN-46 — Scripts de instalación de dependencias y telemetría en `npm ci`

- **Origen:** CF-18
- **Categoría OWASP 2025:** A03 — Fallas en la cadena de suministro de software
- **CWE:** CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)
- **STRIDE:** T (Manipulación), I (Divulgación de información)
- **Ubicación:** `backend/package.json` (`"postinstall": "prisma generate"`), `backend/package-lock.json` (`hasInstallScript`), `backend/docker/Dockerfile:11, 27`, `backend/docker/Dockerfile.local:40-50`, `.github/workflows/ci.yml:50`
- **Descripción:** `npm ci` ejecuta scripts de instalación en CI, en las imágenes Docker y en las máquinas de desarrollo: además del `postinstall` propio, tienen scripts `@prisma/engines` y `prisma` (descargan binarios), `argon2` (binario nativo), `@scarf/scarf` (vía `@nestjs/swagger → swagger-ui-dist`, envía telemetría de instalación a un tercero), `unrs-resolver` y `fsevents` (desarrollo). No es una vulnerabilidad en sí, pero es la vía típica de los ataques de cadena de suministro (un paquete comprometido ejecuta código en la instalación) y ninguna instalación usa `--ignore-scripts` ni deshabilita Scarf.
- **Evidencia:** lectura de `backend/package-lock.json`: paquetes con `hasInstallScript: true` → `@prisma/engines, @scarf/scarf, argon2, fsevents (dev), prisma, unrs-resolver (dev)`; `npm ls @scarf/scarf` → `@nestjs/swagger@11.4.5 → swagger-ui-dist@5.32.8 → @scarf/scarf@1.4.0`. Frontend: sólo `fsevents`; e2e: ninguno.
- **Probabilidad:** Baja
- **Impacto:** Medio
- **Riesgo:** Informativo
- **Confianza:** Confirmado
- **Mitigación propuesta:** agregar `ENV SCARF_ANALYTICS=false` en los Dockerfile y en el CI (o `"scarfSettings": { "enabled": false }` en `backend/package.json`). Evaluar `npm ci --ignore-scripts` seguido de `npx prisma generate` y `npm rebuild argon2` explícitos.
- **Riesgo de mitigar:** con `--ignore-scripts` hay que reproducir a mano cada paso necesario (generación del cliente Prisma, binarios de argon2); probar `docker build` de ambas imágenes y el arranque del backend.

**Estado:** Aceptado. `postinstall` de Prisma y el binario nativo de argon2 son necesarios para instalar.

---

<a id="a04"></a>
### A04 — Fallas criptográficas

Datos sensibles sin proteger o protegidos con mecanismos débiles: una caja fuerte con un candado de juguete. En este proyecto las contraseñas y los refresh tokens usan Argon2 y los secretos se validan al arrancar, pero hay tres puntos donde la protección es insuficiente: un código público con poco espacio de valores, un enlace firmado que puede salir por HTTP y respuestas de la encuesta guardadas en claro en el navegador.

<a id="vuln-17"></a>
#### VULN-17 — Las URLs firmadas de documentos de identidad pueden emitirse por HTTP en producción

- **Origen:** IN-08. Ver también [VULN-03](#vuln-03) (CF-03): el proxy de producción tampoco tiene TLS configurado.
- **Categoría OWASP 2025:** A04 — Fallas criptográficas
- **CWE:** CWE-319 (Cleartext Transmission of Sensitive Information)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `backend/src/modules/documents/minio.service.ts:201-226`; `backend/src/config/config.validation.ts` (`MINIO_USE_SSL` sin validación en producción); `docker-compose.yml` (MinIO publicado en `9100:9000` sobre todas las interfaces)
- **Descripción:** el cliente que firma las URLs públicas (`presignClient`) reutiliza `minio.useSSL`, el mismo flag del enlace interno backend-MinIO. En un despliegue típico (MinIO interno por HTTP en la red de Docker), las URLs firmadas que recibe el navegador salen como `http://<publico>:<puerto>/...`, y el documento (DNI escaneado, certificados de menores) viaja en claro junto con la firma. No hay ningún control que impida `NODE_ENV=production` con `MINIO_USE_SSL=false`.
- **Evidencia:**
  ```ts
  this.presignClient = publicEndpoint
    ? new Minio.Client({ endPoint: publicEndpoint, ...,
        useSSL: this.configService.get<boolean>('minio.useSSL') ?? false, ... })
    : this.minioClient;
  ```
- **Probabilidad:** Media — depende de la configuración de producción, que no se pudo ver.
- **Impacto:** Alto — documentos de identidad de menores interceptables en tránsito.
- **Riesgo:** Medio
- **Confianza:** Probable (requiere que producción use HTTP en el endpoint público de MinIO; no verificado)
- **Mitigación propuesta:** separar `MINIO_PUBLIC_USE_SSL` del flag interno y exigirlo `true` en producción desde `config.validation.ts`; alternativamente, servir los documentos por un endpoint del backend detrás de nginx con TLS (como ya se hace con las imágenes) en lugar de URLs firmadas directas a MinIO.
- **Riesgo de mitigar:** un despliegue sin TLS en MinIO dejaría de arrancar; requiere coordinar certificados. Probar con `minio.service.spec.ts` y abriendo un documento en el entorno de staging.

**Estado:** Mitigado parcialmente (commit f11df18). Aviso al arrancar en producción sin TLS hacia MinIO; la configuración TLS depende del despliegue.

<a id="vuln-32"></a>
#### VULN-32 — Código QR público con 32 bits de entropía que devuelve nombre y apellido del menor

- **Origen:** AC-11 + IN-07
- **Categoría OWASP 2025:** A04 — Fallas criptográficas (AC-11 lo clasificó como A01 — Pérdida de control de acceso)
- **CWE:** CWE-334 (Small Space of Random Values); CWE-330 (Use of Insufficiently Random Values); CWE-200 (Exposure of Sensitive Information)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `backend/src/modules/inscriptions/inscriptions.service.ts:1101-1103` y `:392-430`; `backend/src/modules/inscriptions/inscriptions.controller.ts:144-161` (`GET /api/v1/inscriptions/qr/:qrCode`, `@Public()`)
- **Descripción:** el código es `EVITA-` más los primeros 8 caracteres hexadecimales de un UUIDv4, es decir 2^32 valores. El endpoint público devuelve nombre y apellido del participante, disciplina, categoría (que acota la edad) y estado. Con N inscripciones, cada intento acierta con probabilidad N/2^32 (alrededor de 1,2·10⁻⁶ con 5000 inscripciones); el cupo de 20 req/min por IP lo hace lento para un solo origen, pero no para un atacante distribuido, y el código además figura impreso en papel. El espacio chico también aumenta la probabilidad de colisión (paradoja del cumpleaños), que el service atrapa como violación de unicidad.
- **Evidencia:** `return \`EVITA-${uuidv4().slice(0, 8).toUpperCase()}\`;` (`inscriptions.service.ts:1102`)
- **Probabilidad:** Baja — requiere enumeración distribuida sostenida.
- **Impacto:** Medio — nombre, disciplina y categoría de menores, sin DNI ni contacto (AC-11 lo valoró Bajo).
- **Riesgo:** Bajo
- **Confianza:** Confirmado (código inequívoco)
- **Mitigación propuesta:** generar el código con `crypto.randomBytes(16).toString('base64url')` (128 bits o más; UUID completo como alternativa) para las inscripciones nuevas, manteniendo la validez de los códigos ya impresos; evaluar devolver sólo iniciales (por ejemplo, la inicial del apellido) en la vista pública.
- **Riesgo de mitigar:** códigos más largos producen QR más densos (verificar la lectura en credenciales impresas); los códigos existentes siguen siendo cortos hasta que se regeneren, y siguen funcionando si se conserva la búsqueda exacta.

**Estado:** Mitigado parcialmente (commit 4e66dff). Códigos nuevos de 130 bits y el endpoint público devuelve sólo la inicial del apellido; los códigos ya impresos siguen valiendo.

<a id="vuln-33"></a>
#### VULN-33 — Las respuestas de la encuesta quedan en `localStorage` en claro hasta que el servidor confirma

- **Origen:** IN-14
- **Categoría OWASP 2025:** A04 — Fallas criptográficas
- **CWE:** CWE-922 (Insecure Storage of Sensitive Information)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `frontend/src/pages/public/survey/form/surveyDraft.ts:1-60`, `:125-152` (claves `evita_encuesta_borrador_v1`, `evita_encuesta_pendientes_v1`)
- **Descripción:** por requisito de conectividad, el borrador y la cola de envíos (contexto, sexo, disciplina y opciones elegidas) se guardan en `localStorage` del dispositivo hasta la confirmación. En un teléfono compartido (familiar, entrenador, tablet de la sede) otra persona puede leer las respuestas de bienestar de un menor. El diseño está justificado y documentado en el código; el riesgo residual es el dispositivo compartido. Es el mismo patrón que [VULN-18](#vuln-18) (borrador de plantel), con otros datos.
- **Evidencia:** comentario de cabecera: "el borrador y la cola de envíos, en `localStorage`"; `escribirCrudo(CLAVE_PENDIENTES, pendientes.slice(-MAX_PENDIENTES), 'surveyDraft')` (`surveyDraft.ts:130`).
- **Probabilidad:** Baja
- **Impacto:** Medio
- **Riesgo:** Bajo
- **Confianza:** Confirmado (código inequívoco)
- **Mitigación propuesta:** caducar borradores y pendientes (por ejemplo, a las 24-48 h) y ofrecer un botón "borrar mis respuestas de este dispositivo"; documentarlo como riesgo residual en §4.19 y en la sección de Encuestas.
- **Riesgo de mitigar:** una caducidad corta descarta envíos de quien estuvo sin señal varios días.

**Estado:** Mitigado (commit 324a95b). El borrador vence en 24 h, la cola en 48 h y el borrador se borra al encolar.

---

<a id="a05"></a>
### A05 — Inyección

Datos del usuario que el sistema interpreta como órdenes, por ejemplo inyección SQL o XSS: un formulario donde alguien escribe una orden en lugar de su nombre. **No se encontró una superficie de inyección crítica.** No hay SQL armado con cadenas (el único `Prisma.raw` interpola nombres de columna literales del propio archivo y los `$queryRaw` usan plantillas parametrizadas), los ordenamientos tienen lista blanca, el cuerpo de las peticiones pasa por un `ValidationPipe` global con `whitelist`, no se usa `child_process`, `eval` ni `new Function`, las exportaciones CSV neutralizan fórmulas, el frontend no usa `dangerouslySetInnerHTML` y las subidas se validan por firma de archivo (ver [controles presentes](#controles-presentes)). El apunte de la materia señala que esta categoría bajó de posición porque los frameworks y ORM modernos la previenen mejor, no porque sea menos peligrosa. El único hallazgo es de consumo de recursos en un parser con expresiones regulares.

<a id="vuln-34"></a>
#### VULN-34 — Sync de noticias: respuesta externa sin tope de tamaño y expresiones regulares con backtracking

- **Origen:** IN-12
- **Categoría OWASP 2025:** A05 — Inyección
- **CWE:** CWE-1333 (Inefficient Regular Expression Complexity); CWE-400 (Uncontrolled Resource Consumption)
- **STRIDE:** D (Denegación de servicio)
- **Ubicación:** `backend/src/modules/news/sync/formosa-portal.client.ts:87-103`; `backend/src/modules/news/sync/formosa-news.parser.ts:190-210`
- **Descripción:** el cliente sigue redirecciones y lee el cuerpo entero con `arrayBuffer()` sin comprobar `content-length` ni cortar a un máximo. Luego el parser aplica patrones como `<meta[^>]+property=...[^>]*content=...` sobre todo el HTML, cuyo costo crece de forma cuadrática con etiquetas `<meta` largas y sin cierre. La propiedad interpolada se escapa correctamente, por lo que no hay inyección de regex; el riesgo es de consumo de CPU y memoria si el portal (o un tercero vía redirección o DNS) devuelve contenido hostil. El sync está desactivado por defecto (`NEWS_SYNC_ENABLED=false`).
- **Evidencia:** `const bytes = Buffer.from(await respuesta.arrayBuffer());` (`formosa-portal.client.ts:103`); `new RegExp(\`<meta[^>]+property=["']og:${prop}["'][^>]*content=["']([^"']*)["']\`, 'i')` (`formosa-news.parser.ts:193-196`).
- **Probabilidad:** Baja — fuente gubernamental, sync opcional.
- **Impacto:** Bajo — bloqueo del event loop durante la corrida programada.
- **Riesgo:** Bajo
- **Confianza:** Probable (requiere contenido hostil desde el portal o una redirección; no reproducido)
- **Mitigación propuesta:** abortar si `content-length` supera 2 MB y leer el stream con tope; `redirect: 'manual'` o validar que el destino siga en `formosa.gob.ar`; recortar el HTML a la sección `<head>` antes de buscar `og:` o usar un parser HTML.
- **Riesgo de mitigar:** notas legítimas muy pesadas podrían descartarse; el canario del sync lo detectaría. Probar con `formosa-news.parser.spec.ts` y sus fixtures.

**Estado:** Mitigado (commit a79de02). Tope de 2 MB, redirecciones sólo del mismo sitio y expresiones regulares sin backtracking.

---

<a id="a06"></a>
### A06 — Diseño inseguro

La falla está en el plan, no en el código: es como un banco diseñado sin bóveda, que por bien que se construya falla. Se previene con modelado de amenazas. Esta categoría concentra los riesgos del módulo de encuesta anónima de bienestar de menores y de Métricas: el diseño de anonimato (modelo sin identificadores, publicación en tandas, umbral k de 5, regla de coherencia) es sólido, pero tiene bordes que permiten reidentificar a quien respondió combinando consultas o datos externos. Varios de estos puntos ya figuran como "riesgo residual" en `documentacion/documentation.md` (§4.19): se indican en cada caso. El hallazgo más grave de esa área, [VULN-01](#vuln-01), se clasifica en A09 pero anula este diseño. También tienen componente de diseño VULN-07, VULN-08 y VULN-10.

<a id="vuln-18"></a>
#### VULN-18 — Borrador de plantel con PII de menores en `localStorage`, compartido entre usuarios del navegador

- **Origen:** AC-04
- **Categoría OWASP 2025:** A06 — Diseño inseguro
- **CWE:** CWE-922 (Insecure Storage of Sensitive Information); CWE-524 (Use of Cache Containing Sensitive Information)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `frontend/src/pages/admin/inscription/rosterDraft.ts:28`, `:38`, `:103-140`; `frontend/src/store/auth.store.tsx:128-140` (pantalla de inscripción de planteles)
- **Descripción:** el wizard de planteles guarda hasta 16 fichas con DNI, nombre, fecha de nacimiento y domicilio de menores en `localStorage`, por 7 días. La clave es fija (`evita_plantel_borrador_v1`), no depende del usuario, y `logout()` no la borra (limpia la caché de consultas y el token, no este borrador). En una PC compartida de sede o de oficina, el siguiente usuario que entre (de otro departamento, o con un rol que no puede leer el padrón) recupera el borrador del anterior. Eso esquiva el recorte R05 en el cliente, y cualquier XSS del origen lo lee.
- **Evidencia:**
  ```ts
  const CLAVE_BORRADOR = 'evita_plantel_borrador_v1';   // rosterDraft.ts:28
  const DIAS_DE_VIDA = 7;                                // rosterDraft.ts:38
  // auth.store.tsx:128-140 — logout: resetQueryCache(); clearAccessToken(); olvidarSesion(); setUser(null);
  // borrarBorradorPlantel() sólo se llama en useTeamInscriptionWizard.ts:331 y :365 (alta confirmada / descarte manual)
  ```
- **Probabilidad:** Media — las PC compartidas son habituales en la operación de sedes.
- **Impacto:** Medio — datos personales de menores (Ley 25.326) visibles para un usuario no autorizado.
- **Riesgo:** Medio
- **Confianza:** Confirmado (código)
- **Mitigación propuesta:** llamar a `borrarBorradorPlantel()` en `logout()` y en `login()` cuando cambia el usuario; incluir el `user.id` en la clave y descartar el borrador si no coincide; considerar `sessionStorage` (sobrevive a F5, no al cierre de pestaña) o cifrar con una clave derivada de la sesión; bajar la vida a horas.
- **Riesgo de mitigar:** con `sessionStorage` o con borrado al cerrar sesión, el encargado pierde el borrador si cierra la pestaña o se le vence la sesión, que es lo que el borrador busca evitar. Probar F5, cambio de usuario y logout con el plantel a medio cargar.

**Estado:** Mitigado (commit 324a95b). El borrador de plantel es por usuario, vence y se borra al cerrar sesión.

<a id="vuln-19"></a>
#### VULN-19 — Métricas de la encuesta: `/version` y modelo de reidentificación por usuarios internos (riesgo residual documentado)

- **Origen:** AC-15 + IN-18. **Riesgo residual ya documentado** en `documentacion/documentation.md` §4.19 (la versión que sube con cada respuesta y la reidentificación por inclusión-exclusión); lo no documentado es que COORDINADOR consulta agregados de toda la provincia. Ver también [VULN-01](#vuln-01), [VULN-21](#vuln-21) y [VULN-36](#vuln-36).
- **Categoría OWASP 2025:** A06 — Diseño inseguro (AC-15 lo clasificó como A01 con componente de diseño)
- **CWE:** CWE-203 (Observable Discrepancy); CWE-359 (Exposure of Private Personal Information to an Unauthorized Actor)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `backend/src/modules/metrics/metrics.controller.ts:52-62` (`GET /metrics/survey/:id/version`); `backend/src/modules/survey/survey.service.ts:64-65`; `backend/src/common/constants/index.ts:337`; `documentacion/documentation.md:515-519`
- **Descripción:** `/metrics/survey/:id/version` sube con cada respuesta: consultada cada 10 s revela el momento de cada envío y, si Redis no está disponible, equivale al conteo exacto de respuestas, sin tandas. A eso se suman la resta por inclusión-exclusión con dos filtros y la combinación de cortes de fecha (VULN-21 y VULN-36). Se agrega algo no documentado: `METRICS_READ` incluye a COORDINADOR y el módulo no aplica alcance territorial, así que un rol departamental (presente en la sede y capaz de ver quién contesta) consulta agregados de toda la provincia, cuando su dashboard sí está recortado.
- **Evidencia:**
  ```ts
  async version(@Param('id', ParseUUIDPipe) id: string) { return { version: await this.metricsService.version(id) }; }  // metrics.controller.ts:61-62
  void this.cache?.incr(claveVersionCampania(campaignId));   // survey.service.ts:64-65
  ```
  `metrics.service.ts` no recibe actor ni alcance.
- **Probabilidad:** Baja para la reidentificación (requiere un actor interno que observe a quien responde, AC-15); Media para la señal de la versión, porque el panel la consulta automáticamente (IN-18).
- **Impacto:** Alto para la reidentificación de respuestas de bienestar de menores (AC-15); Bajo para la señal de la versión por sí sola (IN-18).
- **Riesgo:** Medio (el más alto de los hallazgos de origen: AC-15 Medio, IN-18 Bajo)
- **Confianza:** Confirmado (documentado como residual por el equipo)
- **Mitigación propuesta:** que `/version` devuelva un hash opaco del estado publicado (cambia sólo cuando cambia una tanda de 5, o cuando cambia algún corte publicado) en vez del contador crudo; evaluar quitar COORDINADOR de `METRICS_READ` o recortar sus cortes a su departamento. **Requiere decisión** sobre el alcance del rol COORDINADOR.
- **Riesgo de mitigar:** el panel en vivo se refrescaría de a tandas (con menos frecuencia); revisar `metrics-k-anonimato.e2e-spec.ts`.

**Estado:** Mitigado parcialmente (commit 5c7b88f). La versión de Métricas sube de a 5 respuestas. Que COORDINADOR lea toda la provincia queda para la revisión de roles (sección 10).

<a id="vuln-20"></a>
#### VULN-20 — Encuesta pública sin control de integridad de la muestra

- **Origen:** AC-16
- **Categoría OWASP 2025:** A06 — Diseño inseguro
- **CWE:** CWE-799 (Improper Control of Interaction Frequency)
- **STRIDE:** T (Manipulación)
- **Ubicación:** `backend/src/modules/survey/survey.controller.ts:86-97`; `backend/src/modules/survey/survey.constants.ts:49`
- **Descripción:** `POST /survey/responses` es anónimo y lo único que frena el inflado es 3 envíos por minuto por IP, en memoria (ver [VULN-22](#vuln-22), y [VULN-02](#vuln-02) para su evasión). Desde una IP salen unas 4.300 respuestas por día, y más con IPs rotativas. Las métricas y los KPI (por ejemplo, lesiones sin atención) informan decisiones sobre menores, y no hay forma de distinguir después las respuestas fabricadas. El propio controller lo reconoce en un comentario, pero `documentation.md` no lo registra como riesgo residual.
- **Evidencia:** `@Throttle({ default: { ...SURVEY_SUBMIT_RATE_LIMIT } })` con `{ limit: 3, ttl: 60_000 }`.
- **Probabilidad:** Media
- **Impacto:** Medio
- **Riesgo:** Medio
- **Confianza:** Confirmado
- **Mitigación propuesta:** token de un solo uso por participante o por sede (QR de la campaña con nonce firmado y canjeable una vez, sin guardar identidad), Turnstile o un desafío equivalente, y tope diario por IP en Redis. Documentarlo como riesgo residual si se acepta. **Requiere decisión** entre integridad de la muestra y fricción para quien responde.
- **Riesgo de mitigar:** fricción para chicos que contestan desde el teléfono con mala conexión; el token no puede vincularse a la identidad sin romper el anonimato.

**Estado:** Mitigado parcialmente (commit 5c7b88f). Alerta de volumen en el log (200 respuestas por hora y campaña); sin bloqueo, porque sin identidad no se distingue una respuesta fabricada de una real.

<a id="vuln-21"></a>
#### VULN-21 — Resta entre cortes con dos filtros (inclusión-exclusión) en Métricas

- **Origen:** IN-16. **Riesgo residual ya documentado** en `documentacion/documentation.md` §4.19 ("Fuera de esta protección (riesgo residual)").
- **Categoría OWASP 2025:** A06 — Diseño inseguro
- **CWE:** CWE-202 (Exposure of Sensitive Information Through Data Queries)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `backend/src/modules/metrics/metrics.service.ts`, `backend/src/modules/metrics/metrics-aggregation.ts` (regla de coherencia y tope de 2 filtros); `documentacion/documentation.md` §4.19
- **Descripción:** con dos filtros todavía se pueden combinar restas entre cortes cuyas filas pasan la regla de coherencia por separado; el registro `READ_METRICS` lo hace visible pero no lo impide.
- **Evidencia:** §4.19: "con 2 filtros todavía se pueden combinar restas entre cortes cuyas filas pasan la regla por separado (inclusión-exclusión con dos dimensiones)".
- **Probabilidad:** Baja — requiere rol COORDINADOR o de administración y un método deliberado.
- **Impacto:** Alto — reidentificación de respuestas de menores.
- **Riesgo:** Medio
- **Confianza:** Confirmado (documentado por el equipo)
- **Mitigación propuesta:** detección activa sobre `READ_METRICS` (alerta ante muchas combinaciones distintas sobre la misma campaña en poco tiempo) o un presupuesto de consultas por usuario y campaña.
- **Riesgo de mitigar:** restringe la exploración legítima del panel.

**Estado:** Aceptado. Riesgo residual documentado en `documentation.md` §4.19; el registro de consultas deja rastro.

<a id="vuln-35"></a>
#### VULN-35 — Marca de tiempo exacta de cada respuesta correlacionable con logs de acceso

- **Origen:** IN-15. Ver también [VULN-01](#vuln-01): este hallazgo subsiste aun después de corregirlo.
- **Categoría OWASP 2025:** A06 — Diseño inseguro
- **CWE:** CWE-359 (Exposure of Private Personal Information to an Unauthorized Actor)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `backend/prisma/schema.prisma:806` (`enviadaEn DateTime @default(now())`); `backend/src/modules/survey/survey.service.ts:259-271`; `backend/docker/nginx/nginx.conf` y `frontend/docker/nginx.conf` (sin `access_log off`)
- **Descripción:** aun corregido VULN-01, `survey_responses.enviada_en` guarda la hora con precisión de milisegundos, y el acceso de nginx (formato `combined` por defecto) registra IP, hora y `POST /api/v1/survey/responses`. Un insider con acceso a la base y a los logs de infraestructura puede emparejar ambos y atribuir una respuesta a una IP. El panel publica en tandas, pero la tabla cruda no.
- **Evidencia:** `enviadaEn DateTime @default(now()) @map("enviada_en")`; ninguna directiva `access_log` en los `nginx.conf`.
- **Probabilidad:** Baja — requiere acceso a infraestructura.
- **Impacto:** Medio
- **Riesgo:** Bajo
- **Confianza:** Probable (requiere que nginx conserve el access log con IP en producción; no verificado)
- **Mitigación propuesta:** truncar `enviadaEn` a la hora o al día al persistir (la publicación en tandas sólo necesita orden, que puede resolverse con un secuencial no temporal) y desactivar o anonimizar el access log de nginx para `location /api/v1/survey/responses`.
- **Riesgo de mitigar:** la serie temporal del panel pierde resolución; revisar `publicarEnTandas` y la serie diaria.

**Estado:** Mitigado parcialmente (commit fd0b2ee). El envío de la encuesta no queda en el access log de nginx; la precisión de `enviadaEn` no se redujo (degradaría la serie por hora).

<a id="vuln-36"></a>
#### VULN-36 — Combinación de tres cortes de fecha que vuelve a aislar una respuesta

- **Origen:** IN-17. **Riesgo residual ya documentado** en `documentacion/documentation.md` §4.19.
- **Categoría OWASP 2025:** A06 — Diseño inseguro
- **CWE:** CWE-202 (Exposure of Sensitive Information Through Data Queries)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `publicarEnTandas` en `backend/src/modules/metrics/metrics-aggregation.ts`; `documentacion/documentation.md` §4.19
- **Descripción:** como cada corte corta sus tandas en un lugar distinto, combinar "todo", "hasta ayer" y "desde hoy" puede aislar una respuesta cuando lo previo no es múltiplo de 5.
- **Evidencia:** §4.19, segundo ítem de "Fuera de esta protección".
- **Probabilidad:** Baja
- **Impacto:** Medio
- **Riesgo:** Bajo
- **Confianza:** Confirmado (documentado por el equipo)
- **Mitigación propuesta:** anclar las tandas a un corte global de la campaña (no por filtro) o exigir que cada ventana de fecha cierre en un día completo anterior a "hoy".
- **Riesgo de mitigar:** el panel en vivo pierde frescura.

**Estado:** Aceptado. Riesgo residual documentado en `documentation.md` §4.19.

---

<a id="a07"></a>
### A07 — Fallas de autenticación

Contraseñas débiles, intentos ilimitados o sesiones mal gestionadas: un portero que acepta cualquier credencial. El proyecto tiene una base sólida (Argon2, refresh token rotativo con detección de reutilización, cookie `httpOnly` con `SameSite=Strict`, access token sólo en memoria, secretos JWT validados), pero faltan el ciclo de vida de la credencial (cambio, revocación, caducidad), la defensa contra el credential stuffing distribuido y algunos detalles de configuración.

<a id="vuln-05"></a>
#### VULN-05 — Cambios de contraseña, rol o alcance no revocan sesiones; el access token no se revalida

- **Origen:** AC-05. Ver también [VULN-39](#vuln-39) (AC-10): el refresh token puede renovarse indefinidamente.
- **Categoría OWASP 2025:** A07 — Fallas de autenticación
- **CWE:** CWE-613 (Insufficient Session Expiration)
- **STRIDE:** S (Suplantación), E (Elevación de privilegios)
- **Ubicación:** `backend/src/modules/users/users.service.ts:171-222` (`PATCH /api/v1/users/:id`); `backend/src/modules/auth/strategies/jwt.strategy.ts:28-44`
- **Descripción:** `DELETE /users/:id` borra el `refreshToken` (línea 240), pero `PATCH` no lo hace cuando cambia `password`, `role`, `department`, `zone` o `isActive`. Si un administrador restablece la contraseña de una cuenta comprometida, el atacante conserva su refresh token, válido hasta 7 días y renovable (ver VULN-39). `refreshTokens()` relee rol, alcance e `isActive` de la base, lo que acota el daño en esos campos, pero no sirve para la contraseña. Además, `JwtStrategy.validate` no consulta la base: un usuario desactivado o degradado conserva rol y alcance anteriores durante la vida del access token (15 min por defecto). Para la vida del access token esto está documentado en `jwt-payload.interface.ts:13-19`; para el cambio de contraseña, no.
- **Evidencia:**
  ```ts
  // users.service.ts:208-218
  if (password) { data.passwordHash = await argon2.hash(password); }
  const user = await this.prisma.user.update({ where: { id }, data, select: userSelect }); // refreshToken intacto
  ```
- **Probabilidad:** Media — es el flujo normal de respuesta a una cuenta comprometida.
- **Impacto:** Alto — la sesión robada sobrevive al cambio de credenciales y, según el rol, da acceso a PII de menores.
- **Riesgo:** Alto
- **Confianza:** Confirmado (código)
- **Mitigación propuesta:** en `UsersService.update`, poner `refreshToken: null` cuando cambie `password`, `role`, `department`, `zone` o `isActive`. Para cortar también el access token, agregar un `tokenVersion` (o `passwordChangedAt`) al usuario y al JWT, y validarlo en `JwtStrategy` con caché Redis de pocos segundos; o bajar `JWT_ACCESS_EXPIRATION` a 5 min.
- **Riesgo de mitigar:** el usuario editado pierde la sesión, que es lo esperado. La validación por petición suma una lectura (Redis) a cada llamada. Probar con `refresh-rotation.e2e-spec.ts` y con un caso nuevo de "PATCH password ⇒ refresh 403".

**Estado:** Mitigado (commit 78f8ada). Cambiar contraseña, rol, alcance o estado borra el refresh token y revoca los access tokens ya emitidos.

<a id="vuln-22"></a>
#### VULN-22 — Sin bloqueo por cuenta; el límite de intentos es por IP y vive en la memoria del proceso

- **Origen:** AC-07 + CF-15. Ver también [VULN-02](#vuln-02) (CF-01): un `X-Forwarded-For` falsificable evade además el límite por IP.
- **Categoría OWASP 2025:** A07 — Fallas de autenticación (CF-15 lo clasificó como A02 — Configuración de seguridad incorrecta)
- **CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)
- **STRIDE:** S (Suplantación), D (Denegación de servicio)
- **Ubicación:** `backend/src/modules/auth/auth.controller.ts:49`; `backend/src/app.module.ts:102-107`
- **Descripción:** el login limita a 5 intentos cada 15 minutos **por IP** (`ThrottlerGuard`, clave `req.ip`). No hay contador por cuenta, bloqueo progresivo, CAPTCHA ni MFA, tampoco para SUPER_ADMIN. El almacenamiento del throttler es el de memoria por defecto (no se configura `storage`), así que un reinicio del backend lo vacía (incluido uno provocado por los DoS de [VULN-04](#vuln-04), que reabre de inmediato la ventana de 5 intentos) y los contadores no se comparten si algún día se escala a más de una réplica. Un credential stuffing distribuido (una botnet o IPs rotativas) prueba una lista de contraseñas contra todas las cuentas sin tocar el límite. `LOGIN_FAILED` se audita, pero no dispara ninguna alerta ([VULN-27](#vuln-27)). Ya existe Redis en la arquitectura y podría usarse como almacenamiento.
- **Evidencia:**
  ```ts
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 intentos cada 15 min   (auth.controller.ts:49)
  // app.module.ts:102-107 — sin storage → memoria
  ThrottlerModule.forRoot([
    { ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10) },
  ]),
  ```
- **Probabilidad:** Media — el sitio es público y gubernamental, y las listas de contraseñas filtradas abundan (AC-07); la parte de la memoria del proceso es Baja, porque necesita reinicios frecuentes o varias réplicas (CF-15).
- **Impacto:** Alto — una cuenta administrativa da acceso al padrón de menores (AC-07); CF-15 lo valoró Medio para la parte del almacenamiento.
- **Riesgo:** Medio (el más alto de los hallazgos de origen: AC-07 Medio, CF-15 Bajo)
- **Confianza:** Confirmado (código)
- **Mitigación propuesta:** contador de fallos por email en Redis (por ejemplo, demora exponencial o bloqueo temporal de 15 min tras 10 fallos); un `ThrottlerStorage` respaldado por Redis (por ejemplo `@nest-lab/throttler-storage-redis`, con la misma conexión autenticada de [VULN-11](#vuln-11)) para que el límite sobreviva a reinicios; alerta sobre picos de `LOGIN_FAILED` y MFA (TOTP) al menos para SUPER_ADMIN y ADMIN_PROVINCIAL. **Requiere decisión** sobre MFA y sobre la política de bloqueo.
- **Riesgo de mitigar:** el bloqueo por cuenta permite que un tercero bloquee a un usuario legítimo; conviene demora progresiva antes que bloqueo duro. Si Redis cae, hay que decidir si el throttler falla abierto o cerrado. Probar `public-throttle.e2e-spec.ts` con Redis y los e2e de límite de login y de encuesta (el stack e2e usa `x-test-ip` para eso).

**Estado:** Mitigado parcialmente (commit 78f8ada). Bloqueo temporal por cuenta tras 10 fallos (también para emails inexistentes). El límite por IP sigue en memoria del proceso.

<a id="vuln-23"></a>
#### VULN-23 — Política de contraseñas débil y sin ciclo de vida de la credencial

- **Origen:** AC-08
- **Categoría OWASP 2025:** A07 — Fallas de autenticación
- **CWE:** CWE-521 (Weak Password Requirements); CWE-620 (Unverified Password Change)
- **STRIDE:** S (Suplantación), R (Repudio)
- **Ubicación:** `backend/src/modules/users/dto/users.dto.ts:35-36` y `:64-72`
- **Descripción:** la única regla es `MinLength(8)`. No hay lista de contraseñas comunes o filtradas ni longitud mayor para cuentas administrativas. Tampoco hay endpoint para que un usuario cambie su propia contraseña, cambio obligatorio en el primer ingreso ni recuperación: el SUPER_ADMIN fija la contraseña de cada cuenta y la conoce. Así no hay no repudio (el SUPER_ADMIN podría actuar como cualquier usuario) y las contraseñas viajan por canales informales. No hay flujo de reset, así que no hay vulnerabilidades de reset que revisar.
- **Evidencia:** `@MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) password: string;` (`users.dto.ts:35-36`). En backend y frontend no aparecen `change-password`, `mustChange` ni `reset` (búsqueda sin resultados).
- **Probabilidad:** Media
- **Impacto:** Medio
- **Riesgo:** Medio
- **Confianza:** Confirmado
- **Mitigación propuesta:** mínimo 12 caracteres para roles administrativos, rechazo de las contraseñas más comunes (lista local), `POST /auth/change-password` con la contraseña actual (que también revoque sesiones, ver [VULN-05](#vuln-05)) y un flag `mustChangePassword` que obligue al cambio en el primer ingreso.
- **Riesgo de mitigar:** las cuentas existentes con contraseñas cortas siguen funcionando hasta el próximo cambio; el flag requiere una pantalla nueva en el frontend.

**Estado:** Mitigado parcialmente (commit 78f8ada, 4e3d928). Contraseñas nuevas de 12 o más caracteres y no comunes; las cuentas existentes no se fuerzan a cambiar.

<a id="vuln-37"></a>
#### VULN-37 — Enumeración de cuentas en el login (mensaje y tiempo)

- **Origen:** AC-06
- **Categoría OWASP 2025:** A07 — Fallas de autenticación
- **CWE:** CWE-204 (Observable Response Discrepancy); CWE-208 (Observable Timing Discrepancy)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `backend/src/modules/auth/auth.service.ts:58-87` (`POST /api/v1/auth/login`)
- **Descripción:** si el email no existe, se responde 401 sin ejecutar `argon2.verify`. Si existe y la cuenta está inactiva, se responde **403 "Usuario desactivado"** antes de verificar la contraseña. Si existe y está activa, se ejecuta `argon2.verify` (decenas de ms). Sin conocer ninguna contraseña, un atacante distingue "no existe", "existe e inactiva" (por el mensaje) y "existe y activa" (por el tiempo). Las cuentas son correos institucionales con un formato previsible, así que esto prepara el credential stuffing ([VULN-22](#vuln-22)).
- **Evidencia:**
  ```ts
  if (!user) { ...; throw new UnauthorizedException('Credenciales inválidas'); }            // :62-66, sin argon2
  if (!user.isActive) { ...; throw new ForbiddenException('Usuario desactivado. Contacte al administrador.'); } // :69-79
  const passwordValid = await argon2.verify(user.passwordHash, password);                  // :82
  ```
- **Probabilidad:** Media — se mide con pocos requests, aunque el límite de 5 por 15 min lo ralentiza.
- **Impacto:** Bajo — revela qué cuentas existen y su estado, no da acceso.
- **Riesgo:** Bajo
- **Confianza:** Confirmado (código); la diferencia de tiempo no se midió.
- **Mitigación propuesta:** verificar la contraseña siempre, primero (contra un hash ficticio precalculado si el usuario no existe), y revelar el estado "inactivo" sólo después de una contraseña correcta, o responder el mismo 401 genérico en todos los casos.
- **Riesgo de mitigar:** el frontend que muestra "Usuario desactivado" sólo lo mostraría con la contraseña correcta. Revisar `auth-cookies.e2e-spec.ts` y los tests unitarios de `AuthService`.

**Estado:** Mitigado (commit 78f8ada). Mismo mensaje y mismo costo para email inexistente, cuenta inactiva o contraseña incorrecta.

<a id="vuln-38"></a>
#### VULN-38 — El flag `Secure` de la cookie de refresh depende de `NODE_ENV`

- **Origen:** AC-09. Ver también [VULN-13](#vuln-13) (CF-08): el stack de la raíz corre con `NODE_ENV=development`.
- **Categoría OWASP 2025:** A07 — Fallas de autenticación (con componente de A02)
- **CWE:** CWE-614 (Sensitive Cookie in HTTPS Session Without 'Secure' Attribute)
- **STRIDE:** I (Divulgación de información), S (Suplantación)
- **Ubicación:** `backend/src/modules/auth/auth.cookies.ts:62`; `docker-compose.yml:89-96`
- **Descripción:** `secure` se activa sólo si `NODE_ENV === 'production'`. El `docker-compose.yml` de la raíz arranca el backend con `NODE_ENV: development` a propósito, y eso además habilita Swagger. Si ese compose se usa para una demo o un despliegue publicado por HTTPS, la cookie de refresh (7 días) se emite sin `Secure` y viaja por cualquier petición HTTP al mismo host. `backend/docker-compose.yml` sí usa `production`.
- **Evidencia:** `secure: nodeEnv === 'production',` (`auth.cookies.ts:62`); `NODE_ENV: development` (`docker-compose.yml:96`).
- **Probabilidad:** Baja — depende de qué compose se use para publicar.
- **Impacto:** Medio
- **Riesgo:** Bajo
- **Confianza:** Probable (requiere que el compose de la raíz se exponga por red)
- **Mitigación propuesta:** derivar `secure` de una variable explícita (`COOKIE_SECURE`, por defecto `true` salvo `localhost`) o de `req.secure` con `trust proxy`. Usar el prefijo `__Host-` cuando el path lo permita, o al menos `__Secure-`.
- **Riesgo de mitigar:** en desarrollo por HTTP plano la cookie dejaría de guardarse si `secure` queda en `true`; hace falta el valor por defecto por host.

**Estado:** Mitigado (commit 78f8ada). `Secure` también con `COOKIE_SECURE=true` o con HTTPS detrás de un proxy de confianza; nunca se quita en producción.

<a id="vuln-39"></a>
#### VULN-39 — Sesión deslizante sin vida absoluta y un único refresh por usuario

- **Origen:** AC-10
- **Categoría OWASP 2025:** A07 — Fallas de autenticación
- **CWE:** CWE-613 (Insufficient Session Expiration)
- **STRIDE:** S (Suplantación), D (Denegación de servicio)
- **Ubicación:** `backend/src/modules/auth/auth.service.ts:199-230` y `:327-345`; `backend/prisma/schema.prisma` (`User.refreshToken`)
- **Descripción:** cada `refresh` emite un refresh nuevo con 7 días de vida contados desde ese momento, así que una sesión (legítima o robada) que se renueva al menos una vez por semana no vence nunca. No hay `authTime` ni tope absoluto. Además, el usuario tiene un solo slot `refreshToken`: entrar desde un segundo dispositivo invalida el primero, y el siguiente refresh del primero se registra como `REFRESH_TOKEN_REUSE` y revoca todo. Los falsos positivos degradan la señal de detección de robo, que es justamente el control que la prueba T25 quiso auditar.
- **Evidencia:** `{ ...payload, type: 'refresh', jti: randomUUID() }, { expiresIn: jwt.refreshExpiration }` (`auth.service.ts:338-343`); `data: { refreshToken: hashedRefreshToken }` (`:101-108`, un único campo).
- **Probabilidad:** Media
- **Impacto:** Bajo
- **Riesgo:** Bajo
- **Confianza:** Confirmado
- **Mitigación propuesta:** guardar `sessionStartedAt` (o un `auth_time` en el refresh) y rechazar refresh pasadas N horas (por ejemplo 12 h para administración); modelar sesiones en una tabla (`user_sessions`, una fila por dispositivo y familia de tokens) para que la detección de reuso revoque la familia afectada y no a todas.
- **Riesgo de mitigar:** obliga a reingresar a diario; la tabla de sesiones requiere migración.

**Estado:** Mitigado (commit 78f8ada). Vida absoluta de la sesión en la rotación del refresh.

<a id="vuln-47"></a>
#### VULN-47 — JWT sin algoritmo fijado ni `iss`/`aud`

- **Origen:** AC-18
- **Categoría OWASP 2025:** A07 — Fallas de autenticación
- **CWE:** CWE-347 (Improper Verification of Cryptographic Signature)
- **STRIDE:** S (Suplantación)
- **Ubicación:** `backend/src/modules/auth/strategies/jwt.strategy.ts:21-25`; `backend/src/modules/auth/strategies/jwt-refresh.strategy.ts:82-87`; `backend/src/modules/auth/auth.service.ts:318-345`
- **Descripción:** las estrategias no pasan `algorithms: ['HS256']` ni validan `issuer`/`audience`. Con secreto simétrico, `jsonwebtoken` 9 ya restringe a la familia HS y rechaza `none`, así que hoy no hay un ataque concreto (hay además una prueba con `alg: none` en `e2e/tests/api/robustness.spec.ts:142`). Los secretos son distintos y se validan (largo de 32 o más, sin patrones de plantilla), y el claim `type` separa access de refresh. Fijar el algoritmo es defensa en profundidad ante un cambio futuro a claves asimétricas.
- **Evidencia:** `super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: secret });`
- **Probabilidad:** Baja
- **Impacto:** Alto
- **Riesgo:** Informativo
- **Confianza:** Probable (depende de la versión de `jsonwebtoken` resuelta; no verificada en el lockfile)
- **Mitigación propuesta:** `algorithms: ['HS256']`, `issuer: 'evita-api'` y `audience: 'evita-web'` en la firma y la verificación.
- **Riesgo de mitigar:** invalida los tokens vigentes al desplegar (los usuarios reingresan).

**Estado:** Mitigado parcialmente (commit 78f8ada). HS256 fijo e `iss`/`aud` propios; los access tokens viejos sin `iss`/`aud` se aceptan durante la transición.

---

<a id="a08"></a>
### A08 — Fallas en la integridad del software o de los datos

Confiar en actualizaciones o datos sin verificar su origen: es como aceptar un paquete sin precinto. Aquí aparecen dos formas: datos que llegan al sistema sin validar su forma (y luego se publican o se persisten tal cual) y contenido de terceros que el navegador carga sin garantía de integridad.

<a id="vuln-24"></a>
#### VULN-24 — `PATCH /results/match/:matchId` recibe un array que el `ValidationPipe` no valida

- **Origen:** IN-05
- **Categoría OWASP 2025:** A08 — Fallas en la integridad del software o de los datos
- **CWE:** CWE-20 (Improper Input Validation); CWE-1287 (Improper Validation of Specified Type of Input)
- **STRIDE:** T (Manipulación)
- **Ubicación:** `backend/src/modules/results/results.controller.ts:35-56` (`@Body() results: MatchResultDto[]`); `backend/src/modules/results/dto/results.dto.ts:38-49`; `backend/src/modules/results/results.service.ts:128-142`, `:186-208`
- **Descripción:** Nest no valida cuerpos cuyo metatipo es `Array`: `ValidationPipe.toValidate` excluye `Array` y `Object`, así que ni `whitelist`, ni `forbidNonWhitelisted`, ni los decoradores de `MatchResultDto`/`UpdateResultDto` se aplican. Además, `MatchResultDto.data` es `@IsObject()` sin `@ValidateNested()`/`@Type()`, por lo que aunque se validara, el objeto anidado no se revisaría. La validación manual del service sólo comprueba `resultId` y que `data` sea objeto. Resultado: `scoreData` acepta cualquier JSON (hasta 1 MB, con cualquier forma), y `ranking` o `isWinner` con tipos incorrectos llegan a Prisma, que responde con un error de validación que el filtro convierte en 500. No hay asignación masiva (el service toma tres campos explícitos), pero el contrato documentado (`{ goals: 3 }`) no se garantiza y las tablas públicas de posiciones leen ese `scoreData`.
- **Evidencia:**
  ```js
  // node_modules/@nestjs/common/pipes/validation.pipe.js:120-121
  const types = [String, Boolean, Number, Array, Object, Buffer, Date];
  return !types.some(t => metatype === t) && !isNil(metatype);
  ```
  ```ts
  async updateMatchResults(@Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() results: MatchResultDto[], ...)            // results.controller.ts:51-53
  @IsObject() @IsNotEmpty() data: UpdateResultDto;     // results.dto.ts:45-48
  ```
  Reproducción esperada (no ejecutada): `PATCH /api/v1/results/match/<id>` con `[{"resultId":"<id>","data":{"ranking":"x"}}]` → 500 en lugar de 400.
- **Probabilidad:** Media — requiere un rol con `RESULT_LOAD` (por ejemplo, operador de mesa), de uso habitual.
- **Impacto:** Medio — integridad de resultados publicados y errores 500 evitables; un `scoreData` malformado puede alterar el cálculo de posiciones.
- **Riesgo:** Medio
- **Confianza:** Confirmado (comportamiento de Nest verificado en `node_modules`; endpoint no invocado)
- **Mitigación propuesta:** recibir `@Body(new ParseArrayPipe({ items: MatchResultDto, whitelist: true, forbidNonWhitelisted: true }))` o envolver en un DTO `{ results: MatchResultDto[] }` con `@ValidateNested({ each: true }) @Type(() => MatchResultDto)`; en `MatchResultDto.data`, agregar `@ValidateNested() @Type(() => UpdateResultDto)`; validar la forma de `scoreData` por tipo de resultado (las claves ya están en `standings.ts:15`), con `@IsInt() @Min(0)` en `ranking`.
- **Riesgo de mitigar:** si el frontend manda campos extra en `data`, empezará a recibir 400. Cambiar la forma del cuerpo (envoltorio) rompe el contrato con el frontend. Probar con `results.service.spec.ts` y el e2e de resultados.

**Estado:** Mitigado (commit 9b518ba). `ParseArrayPipe` valida cada elemento; `scoreData` plano y acotado.

<a id="vuln-40"></a>
#### VULN-40 — Las definiciones JSON de KPI y destacados se persisten crudas

- **Origen:** IN-10
- **Categoría OWASP 2025:** A08 — Fallas en la integridad del software o de los datos
- **CWE:** CWE-915 (Improperly Controlled Modification of Dynamically-Determined Object Attributes)
- **STRIDE:** T (Manipulación)
- **Ubicación:** `backend/src/modules/metrics/dto/metrics.dto.ts:149-154`, `:191-196`; `backend/src/modules/metrics/metrics.service.ts:578-588`, `:645-655`; `backend/src/modules/metrics/metrics-aggregation.ts:696-729`
- **Descripción:** `definicion` se valida sólo como `@IsObject()` y luego con `validarDefinicionKpi`/`validarDefinicionDestacado`, que comprueban las claves esperadas pero no rechazan claves adicionales ni acotan el largo de las listas `valores`. Lo que se guarda es `dto.definicion` tal como llegó, no la versión normalizada; el `forbidNonWhitelisted` global no alcanza a los campos JSON. Hoy las claves extra no se usan, pero cualquier lectura futura (o el frontend) las tomaría como datos confiables.
- **Evidencia:** `definicion: dto.definicion as Prisma.InputJsonValue` (`metrics.service.ts:588`, `:655`).
- **Probabilidad:** Baja — sólo roles con `SURVEY_MANAGE`.
- **Impacto:** Bajo — sin efecto actual demostrado.
- **Riesgo:** Bajo
- **Confianza:** Confirmado (código inequívoco)
- **Mitigación propuesta:** que los validadores devuelvan un objeto reconstruido con sólo las claves permitidas (`{ numerador, denominador, formato }`, `{ opciones, top }`), con topes (`valores` de hasta 50 elementos, largo de string de hasta 100), y persistir ese objeto.
- **Riesgo de mitigar:** las definiciones existentes con claves extra se seguirían leyendo; probar con `metrics-aggregation.spec.ts`.

**Estado:** Mitigado (commit 5c7b88f). Las definiciones de KPI y destacados se guardan normalizadas y acotadas.

<a id="vuln-41"></a>
#### VULN-41 — Hoja de estilos de Google Fonts sin SRI, que además envía a un tercero la IP de quienes visitan la SPA y contestan la encuesta

- **Origen:** IN-13 + CF-17
- **Categoría OWASP 2025:** A08 — Fallas en la integridad del software o de los datos
- **CWE:** CWE-829 (Inclusion of Functionality from Untrusted Control Sphere); CWE-359 (Exposure of Private Personal Information)
- **STRIDE:** T (Manipulación), I (Divulgación de información)
- **Ubicación:** `frontend/index.html:9-11`
- **Descripción:** la SPA carga CSS de `fonts.googleapis.com` y fuentes de `fonts.gstatic.com` en todas las pantallas, incluida la encuesta anónima que contestan menores desde su teléfono, sin `integrity`: SRI no es aplicable porque Google sirve un CSS distinto según el navegador, de modo que el contenido no puede fijarse. Un CSS comprometido no ejecuta scripts, pero puede alterar la presentación (por ejemplo, ocultar o superponer elementos) o exfiltrar datos mediante selectores. Además, cada visita entrega IP, hora, User-Agent y `Referer` a Google, una transferencia internacional de datos de navegación de menores que la política de privacidad debería contemplar (Ley 25.326), contraria a la minimización de datos y a la promesa de anonimato de la encuesta. Cualquier CSP estricta ([VULN-09](#vuln-09), y la de `backend/docker/nginx/nginx.conf:15` con `font-src 'self'`) bloquearía estas fuentes. No se encontraron scripts de terceros.
- **Evidencia:** `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@600;700;800;900&display=swap" rel="stylesheet" />` (`frontend/index.html:11`)
- **Probabilidad:** Baja — requiere el compromiso del CDN para la parte de integridad; la parte de privacidad ocurre en cada visita.
- **Impacto:** Bajo — sin ejecución de scripts; exposición de metadatos de navegación.
- **Riesgo:** Bajo
- **Confianza:** Confirmado (código inequívoco)
- **Mitigación propuesta:** autoalojar las fuentes (paquetes `@fontsource/inter` y `@fontsource/montserrat`, o archivos `.woff2` en `frontend/public/`) y eliminar el `<link>` y los `preconnect` de `index.html`; con eso la CSP puede quedar en `font-src 'self'`.
- **Riesgo de mitigar:** aumenta levemente el tamaño del build; verificar visualmente tipografía y pesos (400-900) en las pantallas públicas y en la suite Playwright de UI.

**Estado:** Mitigado (commit a29f378). Fuentes servidas desde el sitio (@fontsource); la CSP ya no permite terceros.

---

<a id="a09"></a>
### A09 — Fallas en el registro, alerta y monitoreo

Los ataques ocurren y nadie se entera, ni puede investigarlos después: son cámaras de seguridad apagadas. En este proyecto el registro existe y está bien pensado en general (auditoría funcional saneada, eventos de autenticación, consultas de Métricas), pero el criterio de qué se registra tiene dos fallas graves de privacidad (se registra de más: VULN-01 y VULN-25) y dos de rendición de cuentas (se registra de menos: VULN-26 y VULN-27), más la falta de rotación en producción (VULN-42).

<a id="vuln-01"></a>
#### VULN-01 — La auditoría registra cada respuesta "anónima" de la encuesta con IP, User-Agent, hora y respuestas completas

- **Origen:** IN-01
- **Categoría OWASP 2025:** A09 — Fallas en el registro, alerta y monitoreo (con impacto en A06 — Diseño inseguro)
- **CWE:** CWE-359 (Exposure of Private Personal Information to an Unauthorized Actor); CWE-532 (Insertion of Sensitive Information into Log File)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `backend/src/modules/audit/audit.interceptor.ts:54-113` (interceptor global registrado en `backend/src/app.module.ts:152-155`); `backend/src/modules/survey/survey.controller.ts:86-96` (`POST /api/v1/survey/responses`); lectura en `GET /api/v1/audit` (`backend/src/modules/audit/audit.controller.ts:22-23`)
- **Descripción:** `AuditInterceptor` es un `APP_INTERCEPTOR` global que audita todo `POST` cuyo primer segmento no sea `auth`, salvo que el handler tenga `@NoAudit()`. `submitResponse` no lo tiene, por lo que cada envío de la encuesta de bienestar genera una fila en `audit_logs` con `changes` igual al cuerpo completo (campaña, etapa, disciplina, tipo de disciplina, localidad, categoría, sexo y la lista `respuestas` con las opciones elegidas), más `ipAddress`, `userAgent` y `createdAt`. El sanitizador no altera ninguna de esas claves (`localityId`, `sexo`, `respuestas`, `optionIds` se clasifican como `safe`). El servicio se cuida explícitamente de no loguear cortes ni id (`survey.service.ts:262-267`) y el modelo `SurveyResponse` no tiene IP ni UA, pero la tabla de auditoría reconstruye por afuera exactamente lo que el diseño evitó: una respuesta individual de un menor, con sus cortes, ligada a una IP y a un dispositivo, consultable sin umbral k ni supresión. Anula todas las protecciones de §4.19 (umbral de 5, tandas, regla de coherencia).
- **Evidencia:**
  ```ts
  // audit.interceptor.ts
  if (!WRITE_METHODS.includes(method)) { return next.handle(); }
  if (this.esRutaDeAuth(request)) { return next.handle(); }      // sólo excluye /auth
  ...
  if (options.skip) { return next.handle(); }                     // @NoAudit() no se usa en ningún controller
  ...
  this.auditService.log({ userId, action, entity, entityId: ...,
    changes: method !== 'DELETE' ? body : null,
    ipAddress: ip, userAgent: request.get('User-Agent') });
  ```
  ```ts
  // survey.controller.ts:86-96 — sin @NoAudit()
  @Post('responses')
  @Public()
  @Throttle({ default: { ...SURVEY_SUBMIT_RATE_LIMIT } })
  async submitResponse(@Body() dto: SubmitSurveyResponseDto) { ... }
  ```
  `grep -rn "NoAudit" backend/src` sólo encuentra la definición y el re-export (`common/decorators/index.ts:49`). El test `backend/test/survey-anonimato.e2e-spec.ts:250-290` sólo verifica el modelo `SurveyResponse` y lo que escribe el service, no `AuditLog`. En la consolidación se confirmó en el código que `POST responses` tiene `@Public()` pero no `@NoAudit()`, que `AuditInterceptor` está registrado globalmente en `app.module.ts` (`APP_INTERCEPTOR`) y que `@NoAudit()` no se usa en ninguna parte. Consulta de explotación por un usuario `SUPER_ADMIN` o `ADMIN_PROVINCIAL` (`ACCIONES.AUDIT_READ`, `common/constants/index.ts:349`): `GET /api/v1/audit?entity=survey&action=CREATE`.
- **Probabilidad:** Alta — la fila se escribe siempre, en cada envío (probabilidad cierta); leerla requiere un rol de administración (insider) o acceso a la base o a un respaldo. Los revisores la habían estimado Media por esa condición de lectura; se reevaluó en la consolidación porque la exposición existe desde el primer envío.
- **Impacto:** Alto — reidentificación de respuestas de bienestar y salud de menores; incumple la promesa de anonimato y la Ley 25.326 (dato sensible, finalidad); invalida la defensa de §4.19.
- **Riesgo:** **Crítico.** Los revisores lo asignaron como Alto; en la consolidación se eleva a Crítico por cuatro razones: (1) ocurre en cada envío, es decir, la probabilidad de que el dato quede registrado es cierta; (2) vincula las respuestas de bienestar y salud de menores con una IP y una hora exacta; (3) esos datos son sensibles según la Ley 25.326; (4) anula en silencio todas las protecciones de anonimato del módulo Métricas (umbral k, tandas, regla de coherencia), que son lo que el sistema promete a quienes responden.
- **Confianza:** Confirmado (código inequívoco; no se ejecutó contra el stack)
- **Mitigación propuesta:** agregar `@NoAudit()` a `submitResponse` (y, por defensa en profundidad, excluir en `AuditInterceptor` toda ruta `@Public()` de la encuesta). Extender `survey-anonimato.e2e-spec.ts` con un caso que monte `AuditInterceptor` global y afirme que `auditService.log` no se invoca (o que no se crea `AuditLog`) para `POST /survey/responses`. Purgar las filas ya grabadas (`entity = 'survey' AND action = 'CREATE' AND user_id IS NULL`) y revisar respaldos. Documentarlo en §4.19. **La purga requiere decisión explícita** (ver riesgo de mitigar).
- **Riesgo de mitigar:** bajo en el código (un decorador). La purga es una eliminación irreversible de datos de auditoría: requiere decisión explícita, respaldo previo y un `SELECT` de control para no borrar altas legítimas de otras entidades `survey` (las campañas se crean autenticadas, con `user_id` no nulo). Probar con el e2e nuevo y con `npm run test:e2e -- survey`.

**Estado:** Mitigado (commit 5c7b88f). `POST /survey/responses` con `@NoAudit()`; test que prueba que no se crea fila de auditoría.

<a id="vuln-25"></a>
#### VULN-25 — DNI de menores, emails y payloads de Prisma escritos en el log de aplicación

- **Origen:** IN-02
- **Categoría OWASP 2025:** A09 — Fallas en el registro, alerta y monitoreo
- **CWE:** CWE-532 (Insertion of Sensitive Information into Log File)
- **STRIDE:** I (Divulgación de información)
- **Ubicación:** `backend/src/modules/inscriptions/inscriptions.service.ts:186` y `:257-259`; `backend/src/modules/participants/participants.service.ts:353`; `backend/src/modules/auth/auth.service.ts:113`; `backend/src/modules/users/users.service.ts:71`, `:220`; `backend/src/common/filters/global-exception.filter.ts:91-94`; `backend/src/app.module.ts:90-93` (serializador `req.url` de pino-http)
- **Descripción:** el proyecto saneó con cuidado `AuditLog` (`audit-sanitizer.ts`), pero el log de la aplicación (stdout, recolectado por Docker) recibe en claro el DNI de participantes menores en cada alta de inscripción y actualización, y el email de cada usuario en login, alta y edición. Además, el filtro global loguea `exception.message` de errores no controlados: un `PrismaClientValidationError` incluye la invocación con los valores de los argumentos (por ejemplo, el `where` con un DNI o el `data` de un participante). El serializador de pino-http registra `req.url` con su query string, de modo que `GET /participants?search=<DNI>` deja el DNI en el log de acceso. Los logs no tienen control de acceso por rol: los lee cualquiera con acceso al host o a `docker logs`.
- **Evidencia:**
  ```ts
  this.logger.log(`New participant created: ${dni}`);                         // inscriptions.service.ts:186
  this.logger.log(`Inscription created: ${qrCode} for ${dni} in ${category.name}`); // :257-259
  this.logger.log(`Participant updated: ${participant.dni}`);                 // participants.service.ts:353
  this.logger.log(`User logged in: ${user.email}`);                           // auth.service.ts:113
  this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack); // global-exception.filter.ts:91-94
  serializers: { req: (req) => ({ method: req.method, url: req.url }) }       // app.module.ts:90-93
  ```
- **Probabilidad:** Alta — ocurre en el flujo normal, en cada inscripción.
- **Impacto:** Medio — copia no controlada de identificadores de menores fuera de la base, con retención y acceso no gobernados por la aplicación.
- **Riesgo:** Medio
- **Confianza:** Confirmado (código inequívoco)
- **Mitigación propuesta:** loguear ids internos (`participant.id`, `inscription.id`) en lugar de DNI o email; en el filtro global, loguear `exception.name`, el código de Prisma (`P2xxx`) y el stack, no el `message` completo de errores de Prisma; en pino, usar `redact` (`req.query.search`, etc.) o serializar `req.url` sin query string.
- **Riesgo de mitigar:** se pierde comodidad de diagnóstico (buscar por DNI en el log). Afecta al equipo de soporte. Probar con los unit tests existentes de los services y revisando la salida de `npm run start:dev` en un alta.

**Estado:** Mitigado (commit 78f8ada, 4e66dff, e981f4b, dcea974). Sin DNI ni emails en el log de aplicación; URL del log de acceso sin valores de la query; excepciones sin el mensaje de Prisma.

<a id="vuln-26"></a>
#### VULN-26 — Las exportaciones masivas del padrón y la lectura de documentos no quedan auditadas

- **Origen:** IN-03
- **Categoría OWASP 2025:** A09 — Fallas en el registro, alerta y monitoreo
- **CWE:** CWE-778 (Insufficient Logging)
- **STRIDE:** R (Repudio)
- **Ubicación:** `backend/src/modules/reports/reports.controller.ts:154-235` (`GET /api/v1/reports/participants`, `inscriptions`, `teams`, `results`); `backend/src/modules/reports/reports.service.ts:658-669` (columnas); `backend/src/modules/documents/documents.controller.ts:82-83` (`GET /documents/participant/:id`, URLs firmadas); `backend/src/modules/audit/audit.interceptor.ts:138` (lectura sólo con `lectura: true`)
- **Descripción:** el interceptor sólo audita lecturas marcadas con `@Audit({ lectura: true })`, y hoy únicamente lo están los cuatro endpoints de métricas. La exportación CSV/XLSX de participantes incluye DNI, fecha de nacimiento, teléfono, email y localidad de menores, y está disponible para DELEGADO y administradores territoriales (`ACCIONES.REPORT_EXPORT`, `common/constants/index.ts:243-249`). Ni la exportación ni la emisión de URLs firmadas de documentos de identidad dejan rastro en `AuditLog`. Ante una filtración del padrón no es posible determinar quién lo descargó ni cuándo.
- **Evidencia:** `grep -rn "lectura: true" backend/src` sólo devuelve `modules/metrics/metrics.controller.ts:66,82,98,113`. Encabezados del reporte: `'DNI', 'Nombre', 'Apellido', 'Sexo', 'Fecha Nacimiento', 'Departamento', 'Localidad', 'Teléfono', 'Email', 'Categorías'` (`reports.service.ts:658-669`).
- **Probabilidad:** Media — la exportación es una funcionalidad habitual de roles de bajo privilegio.
- **Impacto:** Medio — imposibilita la investigación y la rendición de cuentas sobre el dato más sensible del sistema.
- **Riesgo:** Medio
- **Confianza:** Confirmado (código inequívoco)
- **Mitigación propuesta:** agregar `@Audit({ action: 'EXPORT_REPORT', lectura: true })` a los cuatro endpoints de reportes y `@Audit({ action: 'READ_DOCUMENTS', lectura: true })` a la lectura de documentos (el mecanismo ya registra la query, que contiene los filtros). Para exportaciones, evaluar desactivar la ventana de deduplicación de 10 minutos.
- **Riesgo de mitigar:** crecimiento moderado de `audit_logs`; ninguna respuesta cambia. Probar con un e2e que exporte y consulte `GET /audit?action=EXPORT_REPORT`.

**Estado:** Mitigado (commit 5c7b88f, e981f4b). Exportaciones y lecturas de documentos auditadas (`READ`/`EXPORT_REPORT`).

<a id="vuln-27"></a>
#### VULN-27 — Sin alertas, accesos denegados no registrados y retención de logs no definida

- **Origen:** IN-04. Ver también [VULN-42](#vuln-42) (CF-16): la falta de rotación del compose de producción.
- **Categoría OWASP 2025:** A09 — Fallas en el registro, alerta y monitoreo
- **CWE:** CWE-778 (Insufficient Logging); CWE-223 (Omission of Security-relevant Information)
- **STRIDE:** R (Repudio)
- **Ubicación:** `backend/src/common/filters/global-exception.filter.ts:62-77` (las `HttpException` no se loguean); `backend/src/modules/audit/audit.interceptor.ts:115-118` (errores no auditados); `docker-compose.yml:15-19` (rotación `json-file` 3×10 MB); `backend/src/modules/audit/audit.service.ts` (sin purga ni retención)
- **Descripción:** los 401/403 de guards y los 4xx de negocio no se registran ni en el log de aplicación (sólo la línea de acceso de pino con el código) ni en `AuditLog`; el interceptor descarta explícitamente los errores. No existe ningún mecanismo de alerta: `REFRESH_TOKEN_REUSE`, ráfagas de `LOGIN_FAILED` o 403 repetidos quedan en una tabla que nadie vigila. El log de aplicación rota a unos 30 MB por servicio (pocas horas o días con nivel `debug` o `info`), mientras `AuditLog` no tiene política de retención (crece indefinidamente y conserva IP y User-Agent). La única "alerta" del sistema es el `logger.error` del sync de noticias.
- **Evidencia:** `error: () => { /* Los errores no se auditan ... */ }` (`audit.interceptor.ts:115-118`); `grep -rni "alert|sentry|webhook" backend/src` sólo devuelve el sync de noticias (`news-sync.service.ts:345-346`); `x-logging: driver json-file, max-size "10m"` (`docker-compose.yml:15-19`).
- **Probabilidad:** Media — un ataque de fuerza bruta o un abuso de permisos ocurriría sin que nadie lo note.
- **Impacto:** Medio — detección tardía o nula; pérdida de evidencia por rotación.
- **Riesgo:** Medio
- **Confianza:** Confirmado (código y configuración)
- **Mitigación propuesta:** loguear con nivel `warn` los 401/403 (usuario, ruta normalizada, IP) en el filtro global; auditar `ACCESS_DENIED` para rutas sensibles; definir un umbral de alerta (por ejemplo, un job que cuente `LOGIN_FAILED` y `REFRESH_TOKEN_REUSE` por ventana y notifique); enviar logs a un destino con retención definida; fijar una política de retención de `AuditLog` acorde a la Ley 25.326 (plazo y purga programada). **Requiere decisión** del responsable del dato sobre el plazo de retención.
- **Riesgo de mitigar:** más volumen de log; una alerta mal calibrada genera ruido. La purga de auditoría es destructiva y requiere decisión formal del responsable del dato.

**Estado:** Mitigado parcialmente (commit dcea974). Los 401/403 quedan en el log sin datos sensibles; alertas y retención dependen de la infraestructura de logs.

<a id="vuln-42"></a>
#### VULN-42 — Logs del compose de producción sin rotación ni envío a un destino central

- **Origen:** CF-16
- **Categoría OWASP 2025:** A09 — Fallas en el registro, alerta y monitoreo
- **CWE:** CWE-400 (Uncontrolled Resource Consumption)
- **STRIDE:** D (Denegación de servicio), R (Repudio)
- **Ubicación:** `backend/docker-compose.yml:4-89` (ningún servicio define `logging`); comparar con `docker-compose.yml:16-20`
- **Descripción:** la API loguea con Pino a stdout (JSON en producción) y Docker lo guarda con el driver `json-file`. El compose de la raíz limita a 3 archivos de 10 MB por servicio, pero el de producción no define `logging`, por lo que, salvo configuración del daemon, los logs crecen sin límite hasta llenar el disco (lo que también detiene Postgres). Tampoco hay envío a un sistema central: los logs de acceso de nginx y de la API se pierden al recrear los contenedores y no hay alertas.
- **Evidencia:** `grep -n "logging" backend/docker-compose.yml` → sin resultados; `docker-compose.yml:16-20` define `x-logging` con `max-size: "10m"`, `max-file: "3"`.
- **Probabilidad:** Media — es el comportamiento por defecto con tráfico sostenido o con un ataque de volumen.
- **Impacto:** Bajo — afecta la disponibilidad a largo plazo y la capacidad de investigación; la auditoría funcional está en la base.
- **Riesgo:** Bajo
- **Confianza:** Confirmado (configuración); la configuración del daemon de Docker del servidor no se pudo verificar.
- **Mitigación propuesta:** copiar el ancla `x-logging` del compose de la raíz a todos los servicios de `backend/docker-compose.yml`, y definir un destino central (syslog, Loki o un servicio provincial) con retención acorde a la política de datos personales.
- **Riesgo de mitigar:** con rotación se pierde historia más antigua que unos 30 MB por servicio; acordar el volumen de retención antes de aplicarlo.

**Estado:** Mitigado (commit fd0b2ee). Rotación `json-file` (10 MB × 5) en todos los servicios del compose de producción.

---

<a id="a10"></a>
### A10 — Manejo inadecuado de condiciones excepcionales

Categoría nueva en 2025: errores mal manejados que filtran información o dejan la aplicación en un estado inseguro; como un corte de luz que deja la puerta abierta. En este proyecto el filtro global de excepciones es correcto en lo esencial: nunca devuelve el mensaje crudo de un error no controlado, mapea los errores del parser de cuerpos a 4xx y la caché y la auditoría degradan sin tirar la operación. Hay un hallazgo menor de huecos en ese filtro. Relacionados con esta categoría: la subida de documentos sin límites ([VULN-10](#vuln-10), cuyos hallazgos de origen incluían un componente A10) y la validación de arrays que termina en 500 ([VULN-24](#vuln-24)).

<a id="vuln-43"></a>
#### VULN-43 — Huecos en el manejo global de excepciones

- **Origen:** IN-11
- **Categoría OWASP 2025:** A10 — Manejo inadecuado de condiciones excepcionales
- **CWE:** CWE-755 (Improper Handling of Exceptional Conditions); CWE-209 (Generation of Error Message Containing Sensitive Information)
- **STRIDE:** R (Repudio), I (Divulgación de información)
- **Ubicación:** `backend/src/common/filters/global-exception.filter.ts:62-77`, `:90-101`, `:117-123`; `backend/src/main.ts` (sin `enableShutdownHooks`)
- **Descripción:** (a) un valor lanzado que no es `Error` ni `HttpException` (un objeto o string arrojado por una librería) termina en 500 sin ninguna línea de log, porque el único `logger.error` está en la rama `instanceof Error`; (b) fuera de producción, una `HttpException` 5xx construida con texto del error (`new InternalServerErrorException(err.message)`) devuelve ese texto al cliente: el corte final sólo aplica con `NODE_ENV === 'production'`, y los entornos de prueba y staging corren con `development`; (c) sin `app.enableShutdownHooks()`, los `onModuleDestroy` (desconexión de Prisma, `quit` de Redis) no corren con SIGTERM.
- **Evidencia:**
  ```ts
  } else if (exception instanceof Error) { this.logger.error(...); message = 'Error interno del servidor'; }
  // sin rama else: cualquier otro valor -> 500 silencioso
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') { message = 'Error interno del servidor'; }
  ```
- **Probabilidad:** Baja
- **Impacto:** Bajo
- **Riesgo:** Bajo
- **Confianza:** Confirmado (código inequívoco)
- **Mitigación propuesta:** agregar una rama final que loguee `String(exception)`; aplicar el mensaje fijo para todo 5xx en cualquier entorno (el detalle va al log); llamar `app.enableShutdownHooks()` en `main.ts`.
- **Riesgo de mitigar:** en desarrollo se pierde el mensaje del 5xx en la respuesta (sigue en el log). Probar con los e2e `sort-whitelist` y `global-exception.filter` existentes.

**Estado:** Mitigado (commit dcea974). El filtro global registra nombre y código del error, nunca el mensaje con valores de la consulta, y también lo que no es un `Error`.

---

<a id="controles-presentes"></a>
## 6. Controles de seguridad ya presentes

Lo que está bien hecho en el área revisada, agrupado por categoría y sin repeticiones entre los tres informes de origen.

**A01 — Control de acceso**

- JWT global con `@Public()` explícito y `@Roles(...ACCIONES.X)` en todas las rutas no públicas (`backend/src/app.module.ts:162-176`).
- Matriz única de permisos `ACCIONES`, publicada en `GET /auth/permissions` y espejada en el frontend con chequeo `check:nav` (`backend/src/common/constants/index.ts:113`, `backend/src/modules/auth/auth.controller.ts:162-183`).
- Alcance territorial R05 que falla cerrado (rol sin departamento: no ve nada) y responde 404 en lugar de 403 fuera de alcance (`backend/src/common/scope/scope.types.ts:20-66`, `participants.service.ts:173-201`).
- Búsqueda de DNI acotada al alcance en el alta (S04) y bloqueo de mudanza de departamento en `PATCH` (S03) (`inscriptions.service.ts:163-168`, `participants.service.ts:276-291`).
- Cambio de DNI restringido a SA y AP, con auditoría propia (R17) (`participants.service.ts:293-300`).
- `addMember` y `createTeam` validan el alcance del equipo y de cada integrante (`teams.service.ts:235-257`, `inscriptions.service.ts:593-601`).
- Asignación masiva contenida: roles y alcance de usuarios sólo los edita SUPER_ADMIN (`constants/index.ts:348`).
- Protección contra quedarse sin SUPER_ADMIN y contra la autobaja (F-19) (`users.service.ts:147-188`).
- `userSelect` sin `passwordHash` ni `refreshToken` (`users.service.ts:24-35`).
- Borradores de noticias y calendario visibles sólo para ADMIN_ROLES vía `OptionalJwtAuthGuard` (`common/content-visibility.ts`, `common/guards/optional-jwt-auth.guard.ts`).
- Proyecciones públicas sin DNI, fecha de nacimiento ni contacto (`common/prisma-selects.ts:34-38`, `inscriptions.service.ts:392-430`).
- Guards de ruta del frontend (`ProtectedRoute`) sólo para experiencia de usuario: todo permiso se revalida en el backend.
- Sin SSRF: el único `fetch` del servidor usa una URL base de configuración más un id numérico, y la imagen externa no se descarga en el servidor (`news/sync/formosa-portal.client.ts:85-100`).
- Pruebas que cubren permisos y alcance: `backend/test/action-permissions.e2e-spec.ts` y `backend/test/scope-sweep.e2e-spec.ts`, y unas 450 pruebas e2e de Playwright que ejercitan roles contra la API real.

**A02 — Configuración de seguridad**

- Helmet con CSP de API `default-src 'none'`, `frame-ancestors 'none'`, `base-uri` y `form-action 'none'`, HSTS de 1 año sin preload, CORP `same-site`, `Referrer-Policy: no-referrer` y `X-Frame-Options: DENY` (`backend/src/security.ts:97-192`), cubierto por `backend/test/security-headers.e2e-spec.ts`.
- Excepción de CSP para Swagger acotada a `/api/docs` y sólo fuera de producción (`security.ts:157-174, 224-242`); Swagger no se genera en producción (`backend/src/swagger.ts:18-20, 36-42`, `main.ts:75`).
- CORS con lista exacta de orígenes, `credentials: true` sin comodín, headers permitidos mínimos, error de arranque si queda vacía en producción y `localhost` rechazado en producción (`security.ts:33-80`, `config/config.validation.ts:163-171`).
- `trust proxy` en un salto (no `true`), con la justificación documentada (`main.ts:20-30`); sólo es seguro si todo el tráfico pasa por nginx (ver [VULN-02](#vuln-02)).
- Límite explícito de 1 MB para JSON y urlencoded (`security.ts:281-291`).
- Validación de entorno con Zod que aborta el arranque ante secretos cortos o por defecto, con lista de patrones prohibidos (`config/config.validation.ts:14-172`, `common/security/forbidden-secrets.ts:14-66`).
- Secretos obligatorios con `${VAR:?}` en el compose de la raíz y en el e2e, y generación aleatoria con `crypto.randomBytes` (`docker-compose.yml:30, 70-71, 102-114`, `backend/scripts/docker-dev.mjs:207`, `e2e/scripts/gen-env.mjs:8`).
- Seed del SUPER_ADMIN sin contraseña por defecto (exige `SEED_ADMIN_PASSWORD`) que corre sólo si la base no tiene usuarios (`backend/prisma/seed.ts:1076-1085`, `backend/docker/entrypoint.local.sh:26`); guarda de producción en el generador de respuestas falsas de la encuesta (`seed-survey-responses.ts:197-201`). La ejecución manual de `seed.ts` no tiene guarda ([VULN-14](#vuln-14)).
- Postgres del compose de la raíz atado a `127.0.0.1` y stack e2e con todos los puertos en `127.0.0.1` y backend en red `internal: true` (`docker-compose.yml:35`, `e2e/docker-compose.e2e.yml:45, 92, 100, 108-111`).
- Imágenes del backend con usuario no root, `tini` como PID 1, healthcheck y runtime sin npm (`backend/docker/Dockerfile:36-46`, `Dockerfile.local:52-81`).
- Límites específicos de rate limiting: login 5 por 15 min, lecturas públicas 20 por min, imágenes 120 por min, envío de encuesta 3 por min, sync de noticias 3 por min (`common/decorators/throttle.decorator.ts:18-48`, `survey.constants.ts:49`, `news/sync/news-sync.controller.ts:51`); `limit_req` de 30 r/s por IP en el nginx de producción (`backend/docker/nginx/nginx.conf:26, 42`).
- Los nginx agregan `X-Forwarded-For` con `$proxy_add_x_forwarded_for`, lo que impide falsificar la IP cuando el tráfico pasa por ellos (`frontend/docker/nginx.conf:23`, `backend/docker/nginx/nginx.conf:50`); el borde de pruebas que inyecta `X-Forwarded-For` está limitado al stack e2e en `127.0.0.1` (`e2e/edge.nginx.conf:1-23`).
- `.env` ignorado por git y excluido de los contextos de Docker; ningún `.env` real en el historial (`.gitignore:55`, `backend/.dockerignore`, `frontend/.dockerignore`); `.env.e2e` ignorado.
- Build de Vite sin sourcemaps y una única variable `VITE_` expuesta (`VITE_API_BASE_URL`) (`frontend/vite.config.ts:17-31`).

**A03 — Cadena de suministro**

- Lockfiles v3 versionados en los tres paquetes, coherentes con su `package.json`, con todas las entradas resueltas desde `registry.npmjs.org` con `integrity` (salvo dependencias empaquetadas de un opcional de Tailwind) e instalación con `npm ci` en Docker y CI.
- `prisma` y `@prisma/client` fijados a la misma versión exacta (`backend/package.json`, `7.8.0`).
- MinIO fijado a un release concreto (no `latest`) en el compose de la raíz y en el e2e (`docker-compose.yml:64`, `e2e/docker-compose.e2e.yml:39`).
- El paquete `e2e/` no tiene avisos en `npm audit`.

**A04 — Criptografía**

- Contraseñas y refresh tokens con Argon2 (argon2id por defecto) (`backend/src/modules/auth/auth.service.ts:82, 101`, `users.service.ts:60`).
- Documentos: bucket privado, URL prefirmada de 5 minutos (máximo 1 hora), validación por firma de archivo y nombre de objeto con UUID y charset saneado, lo que impide path traversal (`documents/minio.service.ts:36-38, 408-452, 595-602`, `documents/file-signature.pipe.ts`).

**A05 — Inyección**

- Sin SQL armado con cadenas: el único `Prisma.raw` interpola nombres de columna literales del archivo (`backend/src/modules/stats/stats.service.ts:24-38`); `$queryRaw` con plantilla parametrizada (`results.service.ts:122`, `health.controller.ts:31`); no hay `$queryRawUnsafe` ni `$executeRawUnsafe`.
- Lista blanca de ordenamiento `@SortableBy` con `buildOrderBy` en los 9 listados con `sortBy` (`common/dto/pagination.dto.ts:157-185`), con test `sort-whitelist.e2e-spec.ts`; tope duro de paginación `@Max(100)` (`pagination.dto.ts:48`).
- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform` (`backend/src/main.ts:63-72`); booleanos con `@ToBoolean()` para evitar la conversión implícita de `"false"`. Limitación: no alcanza a cuerpos de tipo array ([VULN-24](#vuln-24)).
- No se usa `child_process`, `eval` ni `new Function` en el backend; las regex del parser escapan la parte interpolada (`formosa-news.parser.ts:191`).
- Neutralización de fórmulas CSV (`=`, `+`, `-`, `@` con caracteres de control previos) y escape de comillas (`reports.service.ts:108-155, 399`), con test `csv-formula-injection.e2e-spec.ts`; XLSX con celdas de texto (ExcelJS).
- Frontend sin `dangerouslySetInnerHTML`; texto de noticias renderizado como texto plano (`frontend/src/components/shared/PlainTextContent.tsx`); `sourceUrl` de noticias externas armada en el servidor desde `BASE_PORTAL` y no aceptada en los DTO; enlaces externos con `noopener noreferrer`; URLs de mapas con `safeExternalUrl` (`pages/public/venues/VenueCard.tsx:30`); imágenes de noticia sólo `https` (`news/dto/news.dto.ts:52-55`).
- Subidas validadas por firma de archivo (magic bytes) y no por el mimetype del cliente; sin SVG; imágenes servidas con `nosniff` (`images/image.util.ts:84-87`); documentos con `Content-Disposition: attachment`; nombres de objeto con `randomUUID()` (`minio.service.ts:405-453`); límites de multer en imágenes (`images/image-upload.interceptor.ts:20-33`, `images/image-signature.pipe.ts`).

**A06 — Diseño**

- Diseño de anonimato de la encuesta: modelo sin identificadores, handler sin request ni usuario, log del service sin cortes, k-anonimato y supresión documentados en §4.19 y test `backend/test/survey-anonimato.e2e-spec.ts` (con la salvedad de [VULN-01](#vuln-01)).

**A07 — Autenticación**

- Refresh rotativo con `jti` aleatorio, rotación condicional atómica y detección de reutilización auditada (R04/T25) (`auth.service.ts:139-264, 338`).
- Refresh token sólo en cookie `httpOnly`, `SameSite=Strict`, con `path` acotado a `/api/v1/auth` y `Secure` en producción; access token sólo en memoria y purga de restos legacy en `localStorage` (`auth.cookies.ts:53-67`, `frontend/src/api/client.ts:20-58`).
- Logout que revoca el refresh y vacía la caché de React Query (`auth.service.ts:297-308`, `frontend/src/store/auth.store.tsx:128-140`).
- `refreshTokens` relee rol, alcance e `isActive` de la base en cada renovación (`auth.service.ts:144-208`).
- Secretos JWT obligatorios, de 32 o más caracteres y sin patrones de plantilla, sin fallback en código (`config.validation.ts:14-57`, `forbidden-secrets.ts`, `jwt.strategy.ts:17-19`).
- JWT con `ignoreExpiration: false` y verificación del claim `type`; con secreto simétrico `jsonwebtoken` 9 sólo admite HS*, y hay un test con `alg: none` (`e2e/tests/api/robustness.spec.ts:142`).

**A09 — Registro y monitoreo**

- Saneamiento recursivo de `AuditLog` (secretos redactados, PII enmascarada, topes de profundidad y largo) (`backend/src/modules/audit/audit-sanitizer.ts`).
- Auditoría de eventos de autenticación con IP y User-Agent (`auth.service.ts`); lectura de auditoría restringida a SUPER_ADMIN y ADMIN_PROVINCIAL; registro de consultas `READ_METRICS`.
- La auditoría nunca voltea la operación que registra (`audit.service.ts:66-70`).
- Logs de pino-http sin headers ni cuerpo, sólo método, URL y status (`app.module.ts:89-97`).
- Rotación de logs de Docker (3 × 10 MB) en el compose de la raíz (`docker-compose.yml:15-19`).

**A10 — Condiciones excepcionales**

- Filtro global que nunca devuelve el mensaje crudo de un `Error` no controlado en ningún entorno (`global-exception.filter.ts:90-101`) y mapeo de errores de body-parser a 4xx (`:78-89`).
- Redis degrada sin fallar: toda operación atrapa el error y cae a la base (`backend/src/common/cache/redis-cache.service.ts`).

---

<a id="limitaciones"></a>
## 7. Limitaciones y aspectos no verificados

**Alcance de las pruebas**

- **DAST no ejecutado.** El análisis dinámico automatizado planificado contra el entorno aislado no pudo ejecutarse en esta iteración (ver [DAST](#dast)); toda la evidencia es estática, salvo la reproducción aislada del comportamiento de Express en VULN-02 y la lectura del código de Nest en `node_modules` en VULN-24.
- **Nada se reprodujo contra el stack en ejecución.** VULN-06 y VULN-07 están confirmados por código, no por una petición real; VULN-01 y VULN-24 se confirman por lectura de código (y, en el segundo caso, del código de Nest), no por reproducción HTTP. No se ejecutaron tests ni `npx tsc`, ni se construyeron imágenes ni se levantó el stack de Docker.
- **Explotabilidad de los avisos de `npm audit`.** No se ejecutaron pruebas de concepto; los resultados dependen de la base de avisos del registro al 22/11/2026.
- **Backend de desarrollo local con errores 500.** Durante la auditoría, el backend de desarrollo local en el puerto 3001 respondió HTTP 500 en `GET /api/v1/news`, `/calendar` y `/venues`. No se investigó la causa. El revisor de inyección y manejo de errores anotó los candidatos más probables: (1) esquema de la base desfasado respecto de `schema.prisma` (migraciones no aplicadas, por ejemplo `20260930120000_add_venue_image` o `20260831140000_add_external_news_and_sync_state`, que dan P2022 "column does not exist"); (2) `prisma generate` no ejecutado después de un cambio de esquema, o `dist/` compilado con un cliente viejo; (3) `DATABASE_URL` apuntando a otra base o `?schema=` sin esas tablas; (4) agotamiento del pool o timeout (P2024) por la base compartida con otro agente. Los tres handlers son consultas Prisma simples, sin Redis, MinIO ni SQL crudo, y `calendar_events` no cambió desde la migración inicial, lo que inclina hacia (2), (3) o (4) más que a una columna faltante. El filtro global deja la causa en el log del servidor (`Unhandled exception: ...`) y no la muestra en la respuesta, que es el comportamiento correcto. No se considera un hallazgo de seguridad; se registra por su efecto sobre la disponibilidad del entorno de pruebas.

**Despliegue y configuración real**

- **Topología de producción desconocida.** No se sabe qué compose o infraestructura se usa en el despliegue real, si hay un terminador TLS o un balanceador delante de nginx, ni qué sirve la SPA en producción (el nginx de `backend/docker/` sólo sirve `/api/` y `/health`; `frontend/docker/nginx.conf` no emite CSP y `backend/docker/nginx/nginx.conf` sí, con `font-src 'self'`). Condiciona VULN-02, VULN-03, VULN-09, VULN-35, VULN-38 y VULN-41.
- Valores reales de producción: `MINIO_USE_SSL`, `MINIO_PUBLIC_ENDPOINT`, `REDIS_PASSWORD`, `sslmode` de Postgres y retención del access log de nginx (VULN-11, VULN-17, VULN-35).
- Las cabeceras efectivamente emitidas en tiempo de ejecución por los nginx (sólo se leyó la configuración).
- La configuración del daemon de Docker del servidor (rotación global de logs, VULN-42) y la alcanzabilidad desde la LAN de los puertos publicados por Docker Desktop en las máquinas del equipo, que depende del firewall de Windows (VULN-11, VULN-12).
- La configuración del repositorio en GitHub: permisos por defecto del `GITHUB_TOKEN`, protección de ramas, alertas de Dependabot o escaneo de secretos activados desde la interfaz (VULN-15).
- No se leyeron `.env.example` ni `backend/.env.example`: una regla de permisos del entorno bloquea su lectura. No se pudo comprobar si contienen valores con apariencia real.
- No se comprobó que `backend/docker/Dockerfile` construya: `npm ci --only=production` (línea 27) dispararía el `postinstall` `prisma generate` antes de que se copie `prisma/` (línea 31).
- El fin de soporte de `nginx:1.27-alpine` no se confirmó en línea (VULN-16).

**Detalles de implementación no comprobados**

- La diferencia de tiempo del login no se midió (VULN-37).
- La versión exacta de `jsonwebtoken` resuelta (VULN-47) y los parámetros efectivos de `argon2` (se asumen los valores por defecto de `node-argon2`: m=64 MiB, t=3, p=4).
- La intención de negocio detrás de VULN-08 (si los administradores territoriales deben poder publicar contenido provincial).
- La validación de `department` y `zone` en `CreateUserDto` contra el catálogo: un valor mal escrito deja al usuario sin alcance (falla cerrado), pero no se verificó si hay validación.
- El contenido completo de Redis: sólo se identificaron por búsqueda los usos de caché de métricas, dashboard, estadísticas y contador de versión; `documentacion/documentation.md:48` menciona también "tokens", lo que no se encontró en el código.
- Si Prisma escapa `%` y `_` en los filtros `contains` (búsquedas con comodines): no se verificó; el impacto sería de rendimiento, no de inyección.
- El contenido HTML de noticias (XSS almacenado) y la inyección de fórmulas en CSV: el revisor de control de acceso los dejó fuera de su alcance; el de inyección los cubrió (frontend sin `dangerouslySetInnerHTML`, neutralización de fórmulas CSV con test) y no encontró hallazgos.

---

<a id="plan-de-mitigacion"></a>
## 8. Plan de mitigación priorizado

El plan agrupa los 47 hallazgos en tres olas. El esfuerzo es una **estimación** a partir de la mitigación propuesta (Bajo: un cambio local con pruebas; Medio: varios archivos, configuración o coordinación; Alto: modelo de datos, migración o infraestructura nueva) y debe confirmarlo el equipo. Los ítems marcados "Requiere decisión" necesitan una definición de producto o de negocio (por ejemplo, si los administradores territoriales pueden publicar contenido provincial, VULN-08) antes de implementarse.

### Ola 1 — Críticos, altos y victorias rápidas

| Orden | VULN-ID | Acción | Esfuerzo | Riesgo de la mitigación | Decisión |
|---:|---|---|---|---|---|
| 1 | VULN-01 | Agregar `@NoAudit()` a `submitResponse` y excluir en `AuditInterceptor` las rutas públicas de la encuesta; test e2e de que no se crea `AuditLog`; purgar las filas ya grabadas y revisar respaldos | Bajo | Bajo en el código; la purga es irreversible (respaldo previo y `SELECT` de control) | Requiere decisión (purga) |
| 2 | VULN-02 | Quitar `ports: "3000:3000"` del servicio `app` (usar `expose`); después, `trust proxy` por subredes | Bajo | Bajo: monitoreos que consulten `:3000` dejan de funcionar | — |
| 3 | VULN-04 | Actualizar `@nestjs/*`, `compression` y `zod`; `npm audit fix` sin `--force` en `backend/` | Medio | Medio: cambios de minor de Nest y Express en multipart y mensajes de error | — |
| 4 | VULN-05 | `refreshToken: null` en `PATCH /users/:id` al cambiar contraseña, rol, alcance o estado; evaluar `tokenVersion` | Bajo (Medio con `tokenVersion`) | Bajo: el usuario editado pierde la sesión | — |
| 5 | VULN-03 | TLS en el nginx de producción, redirección a HTTPS, `server_tokens off`, una sola fuente de cabeceras; documentar la topología | Medio | Medio: requiere certificados y DNS; coordinar HSTS con el dominio provincial | Requiere confirmar la topología de producción |
| 6 | VULN-06 | Verificar `teamId` con `ScopeService.conAlcance` y agregar el caso a `scope-sweep.e2e-spec.ts` | Bajo | Bajo: 404 si el frontend envía un equipo de otra categoría | — |
| 7 | VULN-10 | Límites de multer en documentos, omitir `fileKey` en las respuestas, `client_max_body_size` de nginx | Bajo | Bajo: mantener el 422 del exceso de tamaño | — |
| 8 | VULN-11 | `requirepass` en Redis, `REDIS_PASSWORD` obligatoria en producción, validar la contraseña de la base | Bajo | Medio: los entornos sin la variable dejan de arrancar | — |
| 9 | VULN-14 | Guarda de producción en `seed.ts` y separar la creación del primer administrador | Bajo | Bajo: el flujo que use la seed para el primer admin necesitará el script separado | — |
| 10 | VULN-18 | Borrar el borrador de plantel al cerrar sesión o cambiar de usuario; clave por usuario | Bajo | Bajo: se pierde el borrador al cerrar la pestaña | — |
| 11 | VULN-26 | `@Audit({ lectura: true })` en reportes y lectura de documentos | Bajo | Bajo: crece `audit_logs` | — |

### Ola 2 — Riesgo Medio

| Orden | VULN-ID | Acción | Esfuerzo | Riesgo de la mitigación | Decisión |
|---:|---|---|---|---|---|
| 12 | VULN-25 | Loguear ids internos en lugar de DNI y email; no loguear el `message` de errores de Prisma; `redact` o `req.url` sin query en pino | Bajo | Bajo: menos comodidad de diagnóstico | — |
| 13 | VULN-24 | `ParseArrayPipe` o DTO envoltorio con `@ValidateNested`/`@Type`; validar la forma de `scoreData` | Medio | Medio: el frontend recibe 400 si manda campos extra; el envoltorio cambia el contrato | — |
| 14 | VULN-07 | Modelar la asignación árbitro-partido y recortar por sede; paliativo con estado `PENDIENTE_CONFIRMACION` | Alto | Alto: cambia el flujo del día de competencia; requiere migración | Requiere decisión |
| 15 | VULN-08 | Definir qué es contenido provincial; filtrar sedes por alcance; actualizar `adminActions.ts` y e2e | Medio | Medio: quita capacidades a administradores territoriales | Requiere decisión |
| 16 | VULN-09 | Cabeceras de seguridad y CSP (primero en modo `Report-Only`) en el nginx de la SPA | Medio | Medio: una CSP estricta puede romper fuentes e imágenes de MinIO | — |
| 17 | VULN-12 | Prefijo `127.0.0.1:` en los puertos de desarrollo; contraseña de la base por variable | Bajo | Bajo: recrear el volumen de desarrollo | — |
| 18 | VULN-13 | `NODE_ENV` obligatorio o con valor por defecto `production`; separar el CORS a localhost | Medio | Medio: la cookie `Secure` no funciona sobre `http://<IP de la LAN>` | — |
| 19 | VULN-16 | Fijar versiones y digests de imágenes; MinIO a un release; nginx soportado | Bajo | Bajo: los parches llegan sólo al aceptar el PR de actualización | — |
| 20 | VULN-17 | `MINIO_PUBLIC_USE_SSL` obligatorio en producción, o servir documentos por el backend | Medio | Medio: un MinIO sin TLS deja de arrancar | — |
| 21 | VULN-19 | `/version` como hash opaco del estado publicado; evaluar COORDINADOR en `METRICS_READ` | Medio | Bajo: el panel se refresca de a tandas | Requiere decisión |
| 22 | VULN-20 | Token de un solo uso por participante o sede, desafío anti-bots y tope diario por IP | Alto | Medio: fricción para quien responde desde el teléfono | Requiere decisión |
| 23 | VULN-21 | Detección sobre `READ_METRICS` o presupuesto de consultas por usuario y campaña | Medio | Medio: restringe la exploración legítima del panel | — |
| 24 | VULN-22 | Contador de fallos por cuenta en Redis, almacenamiento del throttler en Redis, alertas de `LOGIN_FAILED`, MFA para administradores | Medio (MFA: Alto) | Medio: un bloqueo duro permite bloquear a usuarios legítimos | Requiere decisión (MFA y política de bloqueo) |
| 25 | VULN-23 | Mínimo de 12 caracteres para administradores, lista de contraseñas comunes, `change-password` y `mustChangePassword` | Medio | Bajo: pantalla nueva en el frontend | — |
| 26 | VULN-27 | Loguear 401/403, alertas por umbral, destino central de logs y política de retención de `AuditLog` | Alto | Medio: ruido por alertas mal calibradas; la purga es destructiva | Requiere decisión (plazo de retención) |

### Ola 3 — Riesgo Bajo, Informativo y ítems de proceso

| Orden | VULN-ID | Acción | Esfuerzo | Riesgo de la mitigación | Decisión |
|---:|---|---|---|---|---|
| 27 | VULN-15 | Proceso de CI: Dependabot, `npm audit --audit-level=high` por paquete, jobs del frontend, `permissions`, acciones por SHA, Node 22 (habilitar Dependabot puede adelantarse a la Ola 1) | Medio | Bajo: `npm audit` como puerta puede bloquear PRs por avisos sin parche | — |
| 28 | VULN-29 | `npm audit fix`; `prisma` y `@prisma/client` a 7.10.1; `overrides` para `minio` y `exceljs` | Medio | Medio: puede romper la firma de URLs de MinIO o la exportación a Excel | — |
| 29 | VULN-30 | Actualizar `axios`, `react-router` y `zod` en el frontend | Bajo | Bajo | — |
| 30 | VULN-31 | `npm audit fix` en ambos paquetes; `vite` a la última 8.x | Bajo | Bajo: cambios de lint o de configuración de Jest | — |
| 31 | VULN-46 | `SCARF_ANALYTICS=false`; evaluar `npm ci --ignore-scripts` | Bajo | Bajo | — |
| 32 | VULN-37 | Verificar la contraseña siempre y responder un 401 genérico | Bajo | Bajo: cambia el mensaje de "Usuario desactivado" | — |
| 33 | VULN-38 | Variable explícita `COOKIE_SECURE` o `req.secure` con `trust proxy` | Bajo | Bajo: en HTTP plano la cookie no se guarda sin valor por defecto por host | — |
| 34 | VULN-39 | Vida absoluta de la sesión y tabla `user_sessions` | Medio | Medio: reingreso diario; migración | — |
| 35 | VULN-42 | Ancla `x-logging` en todos los servicios del compose de producción; destino central | Bajo | Bajo: se pierde historia anterior a la rotación | — |
| 36 | VULN-43 | Rama final de log, mensaje fijo en todo 5xx, `app.enableShutdownHooks()` | Bajo | Bajo | — |
| 37 | VULN-33 | Caducidad de borradores y pendientes de la encuesta; botón "borrar mis respuestas" | Bajo | Bajo: se descartan envíos de quien estuvo días sin señal | — |
| 38 | VULN-35 | Truncar `enviadaEn`; anonimizar el access log de nginx para la encuesta | Medio | Medio: la serie temporal pierde resolución | — |
| 39 | VULN-36 | Anclar las tandas a un corte global de la campaña | Medio | Medio: el panel pierde frescura | — |
| 40 | VULN-34 | Tope de tamaño y lectura por stream en el sync de noticias; recortar el HTML al `<head>` | Bajo | Bajo: notas muy pesadas podrían descartarse | — |
| 41 | VULN-40 | Persistir la definición normalizada con topes | Bajo | Bajo | — |
| 42 | VULN-41 | Autoalojar las fuentes y quitar los `preconnect` | Bajo | Bajo: leve aumento del build | — |
| 43 | VULN-32 | Códigos QR de 128 bits para las inscripciones nuevas | Bajo | Bajo: QR más densos | — |
| 44 | VULN-28 | Quitar `participantId` de las proyecciones públicas; documentar la base legal | Bajo | Bajo: revisar `key` y agrupaciones del frontend | Requiere decisión (qué se publica de los menores) |
| 45 | VULN-44 | Aceptar y documentar el riesgo, o alertar ante 409 repetidos | Bajo | Ninguno si sólo se documenta | Requiere decisión (aceptación del riesgo) |
| 46 | VULN-45 | Invertir el valor por defecto de `RolesGuard` y agregar `@AnyAuthenticated()` | Bajo | Bajo: una ruta que dependa del valor por defecto devolvería 403 | — |
| 47 | VULN-47 | Fijar `algorithms`, `issuer` y `audience` en el JWT | Bajo | Bajo: invalida los tokens vigentes al desplegar | — |

---

<a id="referencias"></a>
## 9. Referencias

- OWASP Foundation. (2025). *OWASP Top 10:2025*. <https://top10.owasp.org/2025/> — versión en español: <https://owasp.org/Top10/2025/es>
- OWASP Foundation. *OWASP Risk Rating Methodology*. <https://owasp.org/www-community/OWASP_Risk_Rating_Methodology>
- OWASP Foundation. *Application Security Verification Standard (ASVS)*. <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP Foundation. *Cheat Sheet Series*. <https://cheatsheetseries.owasp.org>
- OWASP Foundation. *Web Security Testing Guide (WSTG)* y *OWASP ZAP* (herramienta DAST recomendada para la iteración pendiente).
- MITRE. *Common Weakness Enumeration (CWE)*. <https://cwe.mitre.org>
- Argentina. *Ley 25.326 de Protección de los Datos Personales* (2000). InfoLEG.
- Seminario de Actualización III – Ciberseguridad, Tecnicatura Superior en Desarrollo de Software Multiplataforma (2026). *Unidad 4: S-SDLC y OWASP Top 10* (apunte de la materia).
- Documentación del proyecto: `documentacion/documentation.md` (en particular §4.19, anonimato de la encuesta y riesgo residual).


---

<a id="estado-y-decisiones"></a>
## 10. Estado de la mitigación y decisiones

Mitigación aplicada entre el 22 y el 23/11/2026 en la rama `dev-santi` (commits `5c7b88f` a `a29f378`), con pruebas
nuevas para cada cambio de comportamiento y la batería completa del proyecto (backend, frontend y e2e aislado).

| Estado | Hallazgos |
|---|---:|
| Mitigado | 25 |
| Mitigado parcialmente | 16 |
| Aceptado | 5 |
| Pendiente | 1 |

### Decisiones de negocio tomadas durante la mitigación

- **Alcance territorial de escritura (VULN-07, VULN-08).** Decisión: "Limitar a su territorio". Como el modelo de datos no
  tiene territorio en las competencias (hay una por disciplina, categoría y etapa para toda la provincia) ni en los
  árbitros, se aplicó así: competencias, noticias, calendario y encuesta pasan a ser de la línea provincial
  (ADMIN_PROVINCIAL y SUPER_ADMIN); los admins territoriales gestionan sedes de su departamento o zona y cargan
  resultados sólo de partidos jugados en sedes de su territorio; los árbitros siguen cargando cualquier partido.
- **Pruebas dinámicas.** El análisis dinámico automatizado no pudo ejecutarse; se decidió seguir con SAST y SCA y
  dejarlo documentado (sección 2).
- **Severidad de VULN-01.** Se elevó de Alto a Crítico en la consolidación.

### Mitigaciones parciales o temporales que conviene revisar

- Contraseñas: la política nueva aplica sólo a contraseñas nuevas; falta forzar el cambio de las existentes (VULN-23).
- Códigos QR: los ya impresos (32 bits) siguen siendo válidos hasta que se reemplacen (VULN-32).
- JWT: los access tokens emitidos antes del despliegue se aceptan sin `iss`/`aud` hasta que vencen (VULN-47); los
  refresh tokens viejos se rechazan, así que todos vuelven a iniciar sesión una vez.
- TLS (VULN-03, VULN-11, VULN-17) y fijación por digest o SHA (VULN-15, VULN-16) dependen de cómo se despliegue.
- Dependencias con avisos que sólo se corrigen con una versión mayor (VULN-29, VULN-31).

### Incongruencias de roles para discutir con el equipo y el cliente

1. **Árbitros y operadores de mesa sin alcance territorial.** Pueden cargar o ver datos de toda la provincia porque el
   modelo no les asigna departamento ni zona. Tampoco existe un vínculo árbitro ↔ partido.
2. **Competencias sin territorio.** Una competencia zonal o departamental es única para toda la provincia; si cada
   departamento organiza la suya, el modelo necesita un campo de territorio.
3. **COORDINADOR lee Métricas de toda la provincia** sin recorte territorial (VULN-19).
4. **Encuesta y noticias ahora sólo provinciales.** La persona que redacta el cuestionario (psicóloga) debe tener una
   cuenta de la línea provincial; conviene evaluar un rol específico con permisos acotados.
5. **Vistas públicas con nombres de menores** (VULN-28): definir con el cliente qué datos de los participantes
   corresponde publicar en fixtures y rankings.
