# Refactor SOLID y mitigación de vulnerabilidades — Estado

| | |
|---|---|
| **Rama** | `dev-lucas` (base: `develop` + `dev-santi`) |
| **Autor** | Lucas Zigaran |
| **Última actualización** | 26/11/2026 |
| **Fases del plan** | **9**: Fase 0 (red de seguridad) + Módulos 1 a 8 |
| **Estado** | Fases 0, 1 y 4 **terminadas**. Fases 2 y 3 **en curso**: solo les faltan cambios funcionales (VULN-23, VULN-20 y VULN-35) que primero necesitan `spec.md`/`tasks.md` y una decisión. Fases 5 a 8 **pendientes**. |
| **Avance global** | 3 fases cerradas, 2 en curso y 4 pendientes. 25 de 49 pasos hechos, 2 diferidos con motivo, 22 pendientes. |
| **Seguimiento detallado** | [`odd/tasks/refactor-solid.md`](../../odd/tasks/refactor-solid.md) |
| **Análisis de origen** | [`analisis-buenas-practicas.pdf`](analisis-buenas-practicas.pdf) (en esta carpeta) |
| **Relevamiento de seguridad** | [`../seguridad/relevamiento-owasp-2025.md`](../seguridad/relevamiento-owasp-2025.md) |

Este documento resume qué se hizo, con qué commits, qué se midió y qué falta en cada fase. Está pensado para que cualquier integrante del equipo pueda retomar el trabajo sin depender de quien lo empezó.

---

## 1. Por qué existe este refactor

El análisis de buenas prácticas (PDF en esta carpeta, sobre el merge `2dd98a6`) concluyó que el proyecto **no es código espagueti**: tiene una arquitectura por módulos clara, una capa de API y de hooks bien separada en el frontend, transacciones donde importan y una batería de tests de seguridad muy completa. El código nuevo (`bracket.ts`, `standings.ts`, `metrics-aggregation.ts`) ya sigue el patrón recomendado de funciones puras con tests.

Los problemas estaban concentrados en pocos puntos:

- **Clases que hacen demasiado:** `InscriptionsService` (1.182 líneas; su método `createTeam` tenía ~490) y `MetricsService` (1.082).
- **Escrituras N+1:** consultas a la base dentro de bucles, en el alta de planteles y en la generación del fixture.
- **Un CI que no cubría el frontend, los tests e2e del backend ni Playwright.**
- **Incumplimientos de `AGENTS.md`:** `any` sin justificar (§6.1), identificadores en español (§3) y comentarios muy largos con historial de tickets (§6.9).
- **22 vulnerabilidades del relevamiento OWASP** que no estaban cerradas del todo: 16 mitigadas en parte, 5 aceptadas y 1 pendiente.

El análisis registró **17 hallazgos abiertos** (4 de prioridad alta, 8 media y 5 baja; ver la sección 5). Como el sistema **todavía no está en producción** y nadie más está modificando el código al mismo tiempo, se decidió refactorizar ahora, de forma ordenada y módulo por módulo.

### 1.1 Cómo se organizó el trabajo: 9 fases

El plan del PDF (sección 8) proponía 9 pasos ordenados por impacto. Se reorganizaron en **9 fases** ordenadas por riesgo, de mayor a menor, para que cada una quede cerrada y verificada antes de pasar a la siguiente:

| Fase | Alcance | Estimación | Estado | Pasos |
|---|---|---|---|---|
| **0** | Red de seguridad: CI, avisos de `any`, presupuesto de consultas | 1 día | ✅ Terminada | 5 / 5 |
| **1** | Inscripciones y participantes | 2–3 días | ✅ Terminada | 6 / 8 (2 diferidos) |
| **2** | Autenticación y usuarios | 2–3 días | 🟡 En curso | 5 / 6 |
| **3** | Encuesta y métricas | 3 días | 🟡 En curso | 4 / 6 |
| **4** | Competencias y resultados | 1½ días | ✅ Terminada | 5 / 5 |
| **5** | Plataforma transversal | 1½ días | ⬜ Pendiente | 0 / 5 |
| **6** | Reportes y documentos | 1 día | ⬜ Pendiente | 0 / 4 |
| **7** | Frontend de administración | 2–3 días | ⬜ Pendiente | 0 / 5 |
| **8** | Frontend público y componentes grandes | 2 días | ⬜ Pendiente | 0 / 5 |

Cada fase se verifica con la misma batería (sección 4.2): lint, build, tests unitarios y e2e del backend, lint, build y checks del frontend y, al cerrar, Playwright contra el stack aislado.

---

## 2. Lo que ya está hecho

### 2.1 Preparación

| Commit | Qué se hizo |
|---|---|
| `269f6e2` | Se instaló la skill `solid` (`.claude/skills/solid`), con guías de SOLID, clean code y code smells para revisar el código. Se revisó entera antes de instalarla: solo contiene Markdown. |
| `2dd98a6` | Se creó la rama `dev-lucas` desde `develop` y se le integró `dev-santi` (156 commits, ~19.500 líneas nuevas, la versión más actual del proyecto), sin conflictos. |
| `b46e0fd` | Análisis de buenas prácticas en PDF (en esta carpeta): 17 hallazgos ordenados por prioridad, con ejemplos, la forma de corregir cada uno y referencias a la documentación oficial de NestJS, Prisma, TanStack Query, React Hook Form, React y Vitest. Reemplaza a una versión anterior que analizaba `develop`. |
| `4010998` | Plan de refactor por fases, ordenadas por riesgo, con su tracker en `odd/tasks/refactor-solid.md`. |

**Metodología del análisis:** métricas automáticas (tamaño de archivos y métodos, dependencias por constructor, usos de `any`, `process.env`, `console.*`, `catch` vacíos y patrones repetidos), lectura manual de los archivos con peores métricas y de todo el código nuevo grande, revisión de cada hallazgo de la versión anterior contra el código nuevo y cruce con el relevamiento OWASP para no duplicar hallazgos.

### 2.2 Fase 0 — Red de seguridad ✅ terminada

**Objetivo:** que cualquier cambio posterior quede verificado automáticamente y que la mejora de rendimiento se pueda **medir**. Resuelve el hallazgo **A4** del PDF y mitiga **VULN-15** y **VULN-16**.

| Paso | Commit | Resultado |
|---|---|---|
| F0.1 CI completo | `1e85627`, `66350e8` | Jobs separados: auditoría de dependencias; backend (lint sin `--fix`, build, tests unitarios y e2e con un servicio de PostgreSQL); frontend (lint, build y los 14 checks); Playwright contra el stack aislado de `e2e/docker-compose.e2e.yml`, que corre en los PR y a mano (`workflow_dispatch`). Corre también en las ramas `dev-*`, no solo en `main` y `develop`. Acciones v7 (Node 24) fijadas por SHA y con `persist-credentials: false`. **Mitiga VULN-15.** |
| F0.1 Dependabot | `1e85627` | Ahora también vigila las imágenes de Docker y los archivos compose. **Mitiga VULN-16.** |
| F0.1 Scripts nuevos | `1e85627` | `npm run lint:check` (backend, sin autocorrección: el CI ya no esconde errores) y `npm run check:all` (frontend, corre todos los `check:*` y lista los que fallan). |
| F0.2 Avisos de `any` | `51e63fd` | ESLint (backend) y oxlint (frontend) marcan cada `any` como aviso, sin cortar el CI. Línea base: **15 en el backend y 28 en el frontend**. Los tests quedan excluidos. Resuelve la parte de la regla del hallazgo **M2**. |
| F0.3 Contador de consultas | `b3e892b` | `backend/test/mocks/query-budget.ts` cuenta cuántas consultas a la base hace un flujo sobre los dobles de Prisma. |
| F0.3 Línea base de rendimiento | `4b6eda6` | Tests con un techo de consultas medido sobre el código sin tocar (tabla abajo). Si alguien vuelve a meter un N+1, el test falla. |
| F0.4 Dobles de Prisma | `7c9d5c2` | Los dobles de los tests soportan `createMany`, `createManyAndReturn` y `updateMany`, y rechazan el lote entero si hay un DNI repetido, como Postgres. Los necesitan los módulos 1 y 4. |
| F0.5 Documentación | `4010998`, `f3a47b2`, `bfbc6b3`, `b46e0fd` | Tracker del refactor, este resumen y el PDF del análisis en `documentacion/refactor/`. |

**Línea base de rendimiento (consultas a la base):**

| Flujo | Línea base | Hoy | Meta | Fase que lo baja |
|---|---|---|---|---|
| Alta de un plantel de 16 integrantes | 68 | **7** ✅ | ≤ 8 | 1 |
| Fixture round robin de 16 competidores | 244 | 244 | ≤ 5 | 4 |
| Métricas `overview` con la caché ya cargada | 1 | 1 | 0 | 3 |

**Primera corrida de Playwright en CI** (`45430171554`): 408 OK, 1 fallo, 1 omitido. El fallo era de la prueba, no de la app (ver 2.5). Re-corrida `45433399536`: todo verde. El job de Playwright dura unos 14 minutos.

### 2.3 Fase 1 — Inscripciones y participantes ✅ terminada

**Objetivo:** partir la "clase dios" `InscriptionsService` y el método `createTeam`, y eliminar el N+1 del alta de planteles. Resuelve los hallazgos **A1** y **A2**, y la parte de inscripciones de **B2**, **B3** y **B4**.

| Paso | Commit | Qué se hizo |
|---|---|---|
| 1.1 Reglas de elegibilidad puras | `1862c57` | `inscription-eligibility.ts`: edad o año de nacimiento contra la categoría y sexo, usando `Sex.MIXTO` del enum de Prisma en lugar del texto `'MIXTO'`. Reemplaza a `calculateAge` + `validarElegibilidad`. Spec propio. |
| 1.2 Reglas de plantel puras | `1862c57` | `roster-rules.ts`: DNI repetidos, capitán único y cupo de titulares y suplentes. Spec propio. Entre 1.1 y 1.2 suman **21 tests** que no necesitan base de datos. |
| 1.3 `InscriptionQrService` | `3180f86` | Generación del código y de la imagen QR (antes duplicada entre `create` y `createTeam`) y consulta pública por QR. 107 líneas. |
| 1.4 `InscriptionReviewService` | `3180f86` | `review`, `approve` y `reject`. 126 líneas. Dejan de devolver la fila completa del participante (que incluía el domicilio): ahora usan `PARTICIPANT_CONTACT` de `prisma-selects.ts`. |
| 1.5 `TeamInscriptionsService` con escritura en lote | `3180f86` | El alta de planteles queda como un orquestador corto que llama a las reglas puras y escribe con `createMany` / `createManyAndReturn` dentro de la transacción. **De 68 a 7 consultas** para 16 integrantes; con 11 y con 16 integrantes cuesta lo mismo, así que el costo ya no crece con el tamaño del plantel. 543 líneas. `InscriptionsService` queda con el alta individual, el listado y el detalle (333 líneas, antes 1.182). |
| 1.6 Comentarios y nombres | `23d65a4` | Comentarios del controller recortados según `AGENTS.md` §6.9 (la regla vigente en 1–3 líneas; la historia queda en los commits). Identificadores nuevos en inglés. |
| 1.7 VULN-28 | — | **Diferido** (ver abajo). |
| 1.8 Listado con `PARTICIPANT_SUMMARY` | — | **Diferido al Módulo 7** (ver abajo). |

Las rutas, los mensajes de error y el orden de las validaciones no cambiaron. **Ningún test de comportamiento se modificó**: solo el cableado de providers en los specs y una aserción que contaba "13 `create`" y ahora cuenta "1 lote de 13".

**Verificación:** backend unitarios 330/330, e2e 1.062/1.062, lint 0 errores. Cierre verificado en CI contra el stack real (`45447753101`): backend 1m27s, frontend OK, Playwright 409 OK + 1 omitido a propósito. Las escrituras en lote funcionan igual sobre Postgres que sobre los dobles.

**Dos pasos quedaron diferidos, con motivo:**
- **1.7 — VULN-28 (sacar los IDs internos de las vistas públicas):** el UUID del participante no sale solo en `participantId`, sino también en `participant.id` (`PARTICIPANT_NAME`) y como `id` de cada fila del ranking, y la suite de Playwright lo usa para cargar resultados. Hacerlo bien requiere separar la proyección pública de la de administración en `GET /competitions/:id` (con el patrón `OptionalJwtAuthGuard`, como en noticias y calendario), y depende de la decisión pendiente sobre qué se publica de los menores (sección 6).
- **1.8 — Listado de participantes con `PARTICIPANT_SUMMARY`:** el formulario de edición se rellena con la fila del listado. Si el listado dejara de traer email, teléfono y domicilio, esos campos aparecerían vacíos al editar y se podrían borrar al guardar. Pasa al Módulo 7: el formulario tiene que cargar el detalle antes de editar.

### 2.4 Fase 2 — Autenticación y usuarios 🟡 en curso (5 de 6 pasos)

**Objetivo:** quitar los `any` de autenticación, separar la emisión de tokens y cerrar las vulnerabilidades de autenticación abiertas. Resuelve la parte de auth del hallazgo **B5** y parte de **M4**.

| Paso | Estado | Commit | Qué se hizo |
|---|---|---|---|
| 2.1 Tipado del request y del guard | ✅ | `e4d4c37` | Tipo `RequestWithUser` (`auth/interfaces/request-with-user.interface.ts`) en lugar de `(request as any).user`; `jwt-auth.guard` sin `handleRequest(err: any, …, _info: any)`. |
| 2.2 VULN-22 — throttler en Redis | ✅ (falta probar contra Redis real) | `6bce3ca` | `RedisThrottlerStorage` (`common/cache/redis-throttler.storage.ts`, con spec) implementa la interfaz `ThrottlerStorage` sobre el `RedisCacheService` existente, con un script Lua atómico y el namespace `throttle`. El límite de pedidos queda compartido entre instancias. Si Redis no está, sigue funcionando en memoria. Sin dependencias nuevas. `ThrottlerModule.forRootAsync` lee la configuración desde `ConfigService` (antes `parseInt(process.env…)` en `app.module.ts`). |
| 2.3 `AuthTokensService` | ✅ | `b138e1b` | Generación, rotación y detección de reuso de tokens separadas de `AuthService` (500 → 394 líneas; el nuevo servicio tiene 122). `expiresIn` tipado en segundos y calculado con el mismo parser que la cookie, para que no puedan desalinearse. Sin los `as any` en las opciones de firma. |
| 2.4 VULN-23 — cambio de contraseña | ⬜ Pendiente | — | Ver abajo. |
| 2.5 VULN-27 — auditar accesos denegados | ✅ | `c28f7dd` | Cada 401/403 fuera de `/auth/*` queda en `audit_logs` como `ACCESS_DENIED` (ruta sin query, método, usuario, IP). El filtro global depende de un puerto en `common/security` (`ACCESS_DENIED_RECORDER`) y `AuditModule` provee la implementación (DIP). Tope de 10 filas por IP y minuto; fire-and-forget; sin migración. El panel muestra "Acceso denegado". 13 tests nuevos. Falta solo la purga, que espera la decisión de retención. |
| 2.6 VULN-47 — `iss` y `aud` obligatorios | ✅ **cerrada** | `ed139e9` | `JwtStrategy` ya no acepta tokens sin `iss`/`aud` (se quitó la aceptación transitoria). Los 16 specs que firman tokens usan `ACCESS_SIGN_OPTIONS`, igual que la app. |

**Resultados hasta ahora:** avisos de `any` en el backend de 15 a 6 (los que quedan están en reportes y en el DTO de documentos, y se resuelven en el Módulo 6). Backend unitarios 334/334, e2e 1.062/1.062.

**Lo que falta del Módulo 2, en detalle:**
- **2.4 — VULN-23 (cambio funcional):** columna `mustChangePassword` en el usuario, endpoint `POST /auth/change-password` (contraseña actual + nueva, con las reglas de fortaleza existentes y revocación de las otras sesiones) y una pantalla en el frontend a la que se redirige mientras la marca esté activa. Antes de programarlo: un ítem en `spec.md` y una tarea en `tasks.md` (`AGENTS.md` §1.1), y la decisión de si se fuerza a todas las cuentas existentes (sección 6). Requiere migración de Prisma.
- **Throttler contra Redis real:** ✅ verificado con Playwright en CI (corrida `45829533809`, 409 OK).
- **Verificar el throttler contra Redis real:** el script Lua solo se probó con el doble; se confirma corriendo Playwright en CI (el stack aislado tiene Redis).
- **Cerrar la fase:** correr Playwright, actualizar el tracker y abrir el PR de `dev-lucas` a `develop`.

### 2.5 Fase 3 — Encuesta y métricas 🟡 en curso (4 de 6 pasos)

**Objetivo:** dividir `MetricsService`, tener una sola caché por versión y que un acierto de caché no toque la base. Resuelve el hallazgo **A3** y la parte de métricas de **B3** y **B4**.

| Paso | Estado | Commit | Qué se hizo |
|---|---|---|---|
| 3.1 `SurveyVersionCache` | ✅ | `3597358` | Una sola implementación de la versión de campaña (leer, subir, armar la clave, leer y escribir agregados) en `survey/survey-version.cache.ts`. La usan la encuesta y los tres servicios de métricas; antes cada uno tenía su propia versión. |
| 3.2 Dividir `MetricsService` | ✅ | `dde2e3b` | 1.082 líneas → `MetricsQueryService` (lectura, 791), `MetricsKpisService` (98) y `MetricsHighlightsService` (100), más `response-filter.ts` (puro: el `where` del corte y los filtros informados) y `metrics-campaign.ts` (cuestionario y mapeo del catálogo). Los ABM invalidan por `SurveyVersionCache` sin llamarse entre sí y ya no traen el cuestionario entero para verificar que la campaña existe. Identificadores nuevos en inglés; se corrigió el comentario que citaba un método inexistente. |
| 3.3 Rendimiento | ✅ (con dos ajustes, ver abajo) | `dde2e3b`, `3597358` | La caché se consulta **antes** que la base en resumen, cruce, KPIs y destacados: **`overview` con caché pasa de 1 consulta a 0**. Los cortes padre de la verificación de k-anonimato se memoizan: con dos filtros, **de 9 a 8 consultas** (el corte sin filtros se leía dos veces). KPIs y destacados leen definiciones y respuestas en paralelo; la encuesta valida disciplina, localidad y categoría en paralelo. |
| 3.4 Validación pura de respuestas | ✅ | `3597358` | `survey/survey-answers.ts` (`answersError`, `isAudienceCompatible`) con su spec (10 tests). Mismos mensajes y mismo orden que antes. |
| 3.5 VULN-20 — tope diario por IP | ⬜ Pendiente | — | Cambio funcional: ver abajo. |
| 3.6 VULN-35 — hora truncada | ⬜ Pendiente | — | Cambio funcional: ver abajo. |

**Ajustes respecto del plan en 3.3, con motivo:**
- **La recursión de la verificación de k-anonimato no se eliminó, se memoizó.** Reemplazarla por otra estrategia cambia la lógica que protege el anonimato, y los 76 tests de k-anonimato fijan ese comportamiento exacto. La memoización da la mejora sin tocar la regla.
- **La lectura por lotes con cursor pasa a la Fase 5**, que crea el helper de cursor común en `common/`. Los listados de KPIs y destacados se dejan sin `select`: el ABM usa la fila completa.

**Resultados:** avisos de `any` sin cambios (6). Backend unitarios 344/344, e2e 1.063/1.063, con los mismos 308 tests de métricas, encuesta y permisos sin cambios de comportamiento.

**Lo que falta de la Fase 3:**
- **3.5 — VULN-20 (funcional):** tope diario de respuestas por IP en `POST /survey/responses`, con un throttler con nombre de 24 h sobre el storage de Redis del paso 2.2. Antes: ítem en `spec.md` y `tasks.md`. Si además se agrega un token de un solo uso o Turnstile, lo decide el equipo (sección 6).
- **3.6 — VULN-35 (funcional):** guardar `enviadaEn` truncada a la hora, con una migración que trunque las existentes. Antes de hacerlo hay que confirmar que la serie temporal del panel no necesite más resolución que la hora. Antes: ítem en `spec.md` y `tasks.md`.
- **Cerrar la fase:** correr Playwright en CI y abrir el PR.

### 2.6 Problemas que encontró la red de seguridad (corregidos)

Al correr todo con el CI nuevo aparecieron problemas que ya existían y que el CI anterior no detectaba. Ninguno era del código de la aplicación:

| Commit | Problema | Corrección |
|---|---|---|
| `4528599` | El CI corría el linter con `--fix` y escondía 8 errores de formato. | Se aplicó el formato de Prettier. |
| `ce93f10` | La suite `seguridad-auth-rutas` importaba `app.module`, que valida el `.env` al cargarse: **fallaba siempre en cualquier máquina sin `.env`**, como el CI. | Importa `urlParaLog` desde su propio archivo. |
| `f56c1cd` | Los tests de login hacen 10 o más `argon2` (lento a propósito) y superaban los 5 s de Jest con varios workers: fallos intermitentes (3 a 5 por corrida, distintos cada vez). | Timeout de 30 s para la suite e2e. |
| `4b6eda6` | La suite de planteles tardaba ~2 minutos renderizando imágenes QR reales y a veces pasaba su timeout. | Usa un QR simulado: ese spec prueba la atomicidad, no el render. La suite e2e completa bajó de ~176 s a ~78 s. |
| `9bd3260` | Playwright en celular: el clic sobre "Encuesta" caía mientras el menú todavía se desplegaba (enlace recortado por `overflow-hidden` durante la transición de `max-height`). | El helper espera a que el último enlace del menú se vea entero (`toBeInViewport({ ratio: 1 })`) antes del clic. |

### 2.7 Estado verificado

Todo en verde en GitHub Actions y en local:

| Suite | Línea base (antes del refactor) | Hoy |
|---|---|---|
| Backend: lint | 8 errores escondidos por `--fix`, regla de `any` apagada | 0 errores (6 avisos de `any`) |
| Backend: tests unitarios | 309 / 309 | 344 / 344 |
| Backend: tests e2e | 1.046, con 3–5 fallos intermitentes; ~176 s | 1.063 / 1.063; ~78 s |
| Frontend: lint, build y checks | OK, 14 / 14 (no corrían en CI) | OK, 14 / 14 (28 avisos de `any`) |
| Playwright (API, escritorio y celular) | No corría en CI | 409 OK, 1 omitido a propósito (`content.spec.ts:130`: el stack aislado no tiene noticias del portal) |

---

## 3. Lo que falta hacer, fase por fase

### Fase 2 — Autenticación y usuarios (resto)
Pasos 2.4 (VULN-23) y 2.5 (VULN-27), verificación del throttler contra Redis real y PR. Detalle en la sección 2.4.

### Fase 3 — Encuesta y métricas (resto)
Pasos 3.5 (VULN-20) y 3.6 (VULN-35), los dos funcionales, y cierre con Playwright y PR. Detalle en la sección 2.5.

### Fase 4 — Competencias y resultados ✅ terminada (`ced316a`)
| Paso | Qué se hizo |
|---|---|
| 4.1 Motores puros | Los tres motores ya no dependen de `PrismaService`: cada formato solo define `pairings(ids)` y una clase base escribe con el cliente que recibe (el de la transacción). |
| 4.2 `EngineFactory` con mapa | `Record<CompetitionFormat, IFixtureEngine>` en lugar del `switch`: un formato nuevo en el esquema no compila hasta registrar su motor (OCP). |
| 4.3 Fixture en lote | `createManyAndReturn` de partidos + un `createMany` de resultados. **Fixture de 16: de 244 consultas a 7** (+ el `FOR UPDATE`), y 4 y 16 competidores cuestan lo mismo. Sin el timeout de 60 s. La llave de eliminación directa (`avanzarLlave`) también escribe en lote. |
| 4.4 Condición de carrera | **Ajuste respecto del plan:** en vez de condicionar por estado (`BORRADOR` → `ACTIVA`), la transacción bloquea la competencia con `FOR UPDATE`, el mismo patrón que ya usa `ResultsService`, y vuelve a contar los partidos adentro. El estado se puede editar por `PATCH`, así que un chequeo por estado no era confiable. |
| 4.5 Limpieza | `Promise.all` en `competitions.create`; enums de Prisma en lugar de textos (`'ACTIVA'`, `'PROGRAMADO'`, `'FINALIZADO'` y los formatos) en competencias y resultados. **Queda pendiente** el renombre a inglés de las funciones de `bracket.ts` y `standings.ts` (se usan en varios specs; conviene hacerlo en un commit propio). |

VULN-07 (vínculo árbitro ↔ partido) sigue esperando la decisión del cliente (sección 6).

### Fase 5 — Plataforma transversal (1½ días) ⬜
Resuelve el hallazgo **M4** y las vulnerabilidades **VULN-13**, **VULN-17**, **VULN-29**, **VULN-46** y el resto de **VULN-16**.

| Paso | Qué hay que hacer |
|---|---|
| 5.1 `ConfigService` en todos lados | Quedan **7 lecturas de `process.env`** fuera de la configuración (`prisma.service.ts`, `global-exception.filter.ts`, `main.ts`, `image.util.ts`, entre otras). Pasan a `ConfigService` y al esquema de `config.validation.ts`. **VULN-13:** `NODE_ENV` obligatorio. **VULN-17:** `MINIO_PUBLIC_USE_SSL` obligatorio en producción. |
| 5.2 `redact` en los logs | Configurar `redact` de pino para tokens, contraseñas, cookies y datos personales. |
| 5.3 Caché unificada | `DashboardService` y `StatsService` usan el `RedisCacheService` compartido en vez de abrir su propia conexión a Redis. |
| 5.4 Paginación por cursor común | Un helper en `common/`, reutilizado por reportes y métricas. |
| 5.5 Dependencias e imágenes | **VULN-29, 46 y 16:** Prisma 7.10.1 y `overrides`, `SCARF_ANALYTICS=false`, `npm ci --ignore-scripts` e imágenes de Docker fijadas por digest. |

### Fase 6 — Reportes y documentos (1 día) ⬜
Resuelve los hallazgos **M2** (parte de `where: any`), **M3** y lo que queda de **B5**. Con esta fase el backend debería quedar en **0 avisos de `any`**.

| Paso | Qué hay que hacer |
|---|---|
| 6.1 Definiciones de reporte | Cada reporte en su propio archivo (`reports/definitions/`) y los escritores CSV/Excel aparte: un reporte nuevo es un archivo nuevo (OCP). `reports.service.ts` tiene hoy 978 líneas. |
| 6.2 `where` tipados | `Prisma.InscriptionWhereInput` en lugar de `const where: any` (`reports.service.ts:732` y `:877`), y `status` validado como `InscriptionStatus`. Tipar también los listeners de `once` / `removeListener` (`reports.service.ts:63-64`). |
| 6.3 `select` en reportes | Constante `PARTICIPANT_REPORT` en `prisma-selects.ts` con solo los campos del Excel, en lugar de `include: { participant: true }` (que trae el domicilio). |
| 6.4 Documentos y listados | `documents.findByParticipant` con `select` y paginación; `file?: any` → `Express.Multer.File` en `documents.dto.ts:45`; proyecciones en los listados de sedes, calendario y noticias. |

### Fase 7 — Frontend de administración (2–3 días) ⬜
Resuelve los hallazgos **M1**, **M5** y **M6**, y el paso 1.8 diferido.

| Paso | Qué hay que hacer |
|---|---|
| 7.1 Formularios tipados | `useForm<z.input, unknown, z.output>` y mappers tipados para `defaultValues`: quitar los **28 `as any`** de `CategoryForm`, `DisciplineForm`, `NewsForm`, `TeamForm` y los `as Resolver`. |
| 7.2 Edición de participantes | El formulario carga el detalle (`useParticipant(id)`) en vez de usar la fila del listado; recién entonces el listado del backend puede bajar a `PARTICIPANT_SUMMARY` (paso 1.8). |
| 7.3 `useCrudPageState` | Hook para el estado repetido (filtros, modal, selección, paginación) en las 6 páginas de administración, con el layout de Teams/Venues como modelo. |
| 7.4 Rendimiento | Memoizar las columnas de las tablas; guardar los borradores con debounce; borrar el barrel muerto `pages/admin/index.tsx`; una sola fuente para el prefetch de rutas. |
| 7.5 Archivos por dominio | Partir `schemas/index.ts`, `types/index.ts` y `lib/utils.ts` por dominio, manteniendo un `index.ts` que reexporte para no romper imports. |

### Fase 8 — Frontend público y componentes grandes (2 días) ⬜
Resuelve el hallazgo **M8** (si el equipo lo aprueba) y los componentes grandes del frontend público.

| Paso | Qué hay que hacer |
|---|---|
| 8.1 `ImpactMapSvg` | Extraer los hooks `useMapView`, `useMapGestures` y `useElementSize`. |
| 8.2 `DocumentUploader` | Extraer el hook `useDocumentUpload`. |
| 8.3 `NewsPage` | Hook `useNewsPageData` y subcomponentes en su carpeta. |
| 8.4 `metricsRules.ts` | Partir por tema. |
| 8.5 Vitest | Solo si el equipo lo aprueba: primero actualizar `AGENTS.md` y `plan.md`, y después migrar los 14 `check-*.mjs` de a uno a `*.test.ts`. |

### Pendiente menor
- `documentacion/analisis-buenas-practicas.pdf` (la versión vieja del análisis) sigue sin versionar porque estaba abierta en Acrobat y no se podía mover. **Se puede borrar:** la versión vigente es la de esta carpeta.

---

## 4. Reglas para todas las fases

### 4.1 Cómo se trabaja
1. **Usar los patrones que ya existen**, sin inventar otros (`AGENTS.md` §1.4 y §8.7):
   - lógica pura en archivos junto al servicio, con su `*.spec.ts` (modelo: `bracket.ts`, `standings.ts`, `metrics-aggregation.ts`);
   - módulos con varios providers (modelo: `news/`, `venues/`);
   - el tipo `ClienteFixture` de `bracket.ts` para escribir con `prisma` o dentro de una transacción;
   - proyecciones de `common/prisma-selects.ts` y alcance territorial con `ScopeService`.
2. **Sin capa de repositorios y sin dependencias nuevas** (`AGENTS.md` §8.5). Por eso el hallazgo **B1** no se implementa como lo sugiere el PDF: se usa `ClienteFixture` como paso intermedio.
3. **Primero tests de caracterización, después mover código.** Un commit por paso; un PR de `dev-lucas` a `develop` por fase.
4. **Nombres en inglés, comentarios cortos y enums de Prisma** en lugar de textos sueltos: se corrigen dentro de cada fase, en el mismo cambio, para no tocar dos veces el mismo código.
5. **Cambios funcionales** (VULN-20, 23 y 35): primero un ítem en `spec.md` y una tarea en `tasks.md` (`AGENTS.md` §1.1).

### 4.2 Verificación de cada paso
- `backend/`: `npm run lint:check`, `npm run build`, `npx jest` y `npm run test:e2e`.
- `frontend/`: `npm run lint`, `npm run build` y `npm run check:all`.
- Al cerrar cada fase: Playwright (`cd e2e && npm run stack:up && npm test && npm run stack:down`, o a mano desde Actions) y bajar el techo correspondiente del presupuesto de consultas.

---

## 5. Hallazgos del análisis: dónde se resuelve cada uno

| # | Hallazgo | Prioridad | Fase | Estado |
|---|---|---|---|---|
| A1 | `createTeam()` de 492 líneas | Alta | 1 | ✅ Resuelto |
| A2 | `InscriptionsService` "clase dios" (1.182 líneas) | Alta | 1 | ✅ Resuelto (4 servicios de 107 a 543 líneas) |
| A3 | `MetricsService` mezcla consultas, dos CRUD y caché | Alta | 3 | ⬜ Pendiente |
| A4 | El CI no cubre frontend ni e2e | Alta | 0 | ✅ Resuelto |
| M1 | `as any` en formularios de React Hook Form (28) | Media | 7 | ⬜ Pendiente |
| M2 | `no-explicit-any` apagado y `where: any` en reportes | Media | 0 y 6 | 🟡 Regla activa como aviso; `where` tipados pendientes |
| M3 | Reportes traen la fila completa del participante | Media | 6 | ⬜ Pendiente |
| M4 | `process.env` fuera del `ConfigService` | Media | 2 y 5 | 🟡 Throttler resuelto; quedan 7 lecturas |
| M5 | Páginas CRUD de admin con el mismo estado copiado | Media | 7 | ⬜ Pendiente |
| M6 | Archivos "cajón de sastre" | Media | 7 | ⬜ Pendiente |
| M7 | Fixture: inserts uno por uno y condición de carrera | Media | 4 | ⬜ Pendiente |
| M8 | El frontend no tiene runner de tests | Media | 8 | ⬜ Espera decisión del equipo |
| B1 | Servicios atados a `PrismaService` concreto | Baja | — | No se hace capa de repositorios (regla 4.1.2); se usa `ClienteFixture` |
| B2 | Strings mágicos en lugar de enums de Prisma | Baja | 1 y 4 | 🟡 `Sex.MIXTO` resuelto; faltan competencias |
| B3 | Identificadores en español | Baja | 1 a 4 | 🟡 Inscripciones resuelto; faltan métricas y competencias |
| B4 | Comentarios muy extensos o desactualizados | Baja | todas | 🟡 Controller de inscripciones resuelto; se corrige en cada fase |
| B5 | `any` en guard, interceptor, auth y DTO | Baja | 2 y 6 | 🟡 Guard, request y auth resueltos; falta el DTO de documentos |

**Resumen:** 3 resueltos, 6 en parte, 7 pendientes y 1 que se reemplaza por un patrón existente.

---

## 6. Decisiones que necesitan al equipo o al cliente

No bloquean el resto del trabajo.

| Tema | Qué hay que decidir | Afecta a |
|---|---|---|
| VULN-07 | Si se modela la asignación árbitro ↔ partido (hoy un árbitro puede cargar cualquier partido). | Fase 4 |
| VULN-19 | Si el rol COORDINADOR puede ver métricas de toda la provincia. | Fase 3 |
| VULN-20 | Si se agrega un token de un solo uso o Turnstile a la encuesta (el tope por IP se hace igual). | Paso 3.5 |
| VULN-23 | Si se fuerza el cambio de contraseña a todas las cuentas existentes. | Paso 2.4 |
| VULN-27 | Cuánto tiempo se conservan los registros de auditoría. | Paso 2.5 (purga) |
| VULN-28 | Qué datos de los menores se publican en fixtures y rankings. Con eso se separa la proyección pública de la de administración en `GET /competitions/:id` y en el ranking (los IDs internos hoy salen en `participantId`, `participant.id` y el `id` de cada fila). | Paso 1.7 |
| VULN-03 / 11 | Topología de producción y TLS. | Despliegue |
| Vitest | Si se suma al stack para reemplazar los scripts `check-*.mjs` (requiere actualizar `AGENTS.md` y `plan.md`). | Paso 8.5 |

Quedan aceptados y no se tocan: VULN-21, 36 y 44 (inherentes al diseño) y VULN-31 (Jest 30 rompe PGlite).

---

## 7. Cómo retomar

1. `git checkout dev-lucas && git pull`.
2. Instalar las dependencias en `backend/` y `frontend/` (`npm ci`) y confirmar que todo está en verde con los comandos de la sección 4.2.
3. Abrir [`odd/tasks/refactor-solid.md`](../../odd/tasks/refactor-solid.md), tomar el primer paso pendiente (hoy: 2.4 o 2.5 del Módulo 2, o pasar al Módulo 3 si esas decisiones siguen abiertas) y seguir en orden.
4. Al terminar cada paso: commit (`refactor(<módulo>): …`, en español), actualizar el tracker y este documento y, al cerrar la fase, bajar el techo correspondiente del presupuesto de consultas y abrir el PR a `develop`.
