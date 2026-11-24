# Refactor SOLID y mitigación de vulnerabilidades — Estado

| | |
|---|---|
| **Rama** | `dev-lucas` (base: `develop` + `dev-santi`) |
| **Autor** | Lucas Zigaran |
| **Última actualización** | 24/11/2026 |
| **Estado** | Fase 0 y Módulo 1 **terminados**. Módulos 2 a 8 **pendientes**. |
| **Seguimiento detallado** | [`odd/tasks/refactor-solid.md`](../../odd/tasks/refactor-solid.md) |
| **Análisis de origen** | [`analisis-buenas-practicas.pdf`](analisis-buenas-practicas.pdf) (en esta carpeta) |
| **Relevamiento de seguridad** | [`../seguridad/relevamiento-owasp-2025.md`](../seguridad/relevamiento-owasp-2025.md) |

Este documento resume qué se hizo y qué falta. Está pensado para que cualquier integrante del equipo pueda retomar el trabajo sin depender de quien lo empezó.

---

## 1. Por qué existe este refactor

El análisis de buenas prácticas (PDF en esta carpeta) concluyó que el proyecto **no es código espagueti**: tiene una arquitectura por módulos clara, una capa de API y de hooks bien separada en el frontend y una batería de tests de seguridad muy completa. Pero encontró puntos concretos para mejorar:

- **Clases que hacen demasiado:** `InscriptionsService` (1.182 líneas; su método `createTeam` tiene ~490) y `MetricsService` (1.082).
- **Escrituras N+1:** consultas a la base dentro de bucles, en el alta de planteles y en la generación del fixture.
- **Incumplimientos de `AGENTS.md`:** `any` sin justificar (§6.1), identificadores en español (§3) y comentarios muy largos con historial de tickets (§6.9).
- **22 vulnerabilidades del relevamiento OWASP** que no están cerradas del todo: 16 mitigadas en parte, 5 aceptadas y 1 pendiente.

Como el sistema **todavía no está en producción** y nadie más está modificando el código al mismo tiempo, se decidió refactorizar ahora, de forma ordenada y módulo por módulo.

---

## 2. Lo que ya está hecho

### 2.1 Preparación

| Commit | Qué se hizo |
|---|---|
| `269f6e2` | Se instaló la skill `solid` (`.claude/skills/solid`), con guías de SOLID, clean code y code smells para revisar el código. Se revisó entera antes de instalarla: solo contiene Markdown. |
| `2dd98a6` | Se creó la rama `dev-lucas` desde `develop` y se le integró `dev-santi` (156 commits, la versión más actual del proyecto), sin conflictos. |
| — | Análisis de buenas prácticas en PDF (en esta carpeta): 17 hallazgos ordenados por prioridad, con ejemplos, la forma de corregir cada uno y referencias a la documentación oficial de NestJS, Prisma, TanStack Query, React Hook Form, React y Vitest. |
| — | Plan de refactor por módulos, ordenados por riesgo (resumido en la sección 3). |

### 2.2 Fase 0 — Red de seguridad (terminada)

El objetivo era que cualquier cambio posterior quede verificado automáticamente y que la mejora de rendimiento se pueda **medir**.

| Paso | Commit | Resultado |
|---|---|---|
| CI completo | `1e85627`, `66350e8` | Jobs separados: auditoría de dependencias; backend (lint sin `--fix`, build, tests unitarios y e2e); frontend (lint, build y los 14 checks); Playwright contra el stack aislado, que corre en los PR y a mano. Corre también en las ramas `dev-*`. Acciones v7 (Node 24) fijadas por SHA, sin credenciales persistidas. **Mitiga VULN-15.** |
| Dependabot | `1e85627` | Ahora también vigila las imágenes de Docker y los archivos compose. **Mitiga VULN-16.** |
| Scripts nuevos | `1e85627` | `npm run lint:check` (backend, sin autocorrección) y `npm run check:all` (frontend, corre todos los `check:*` y lista los que fallan). |
| Avisos de `any` | `51e63fd` | ESLint y oxlint marcan cada `any` como aviso, sin cortar el CI: hoy hay **15 en el backend y 28 en el frontend**. Los tests quedan excluidos. |
| Dobles de Prisma | `7c9d5c2` | Los dobles de los tests ahora soportan `createMany`, `createManyAndReturn` y `updateMany`, y rechazan el lote entero si hay un DNI repetido, como Postgres. Los necesitan los módulos 1 y 4. |
| Contador de consultas | `b3e892b` | `backend/test/mocks/query-budget.ts` cuenta cuántas consultas a la base hace un flujo. |
| Línea base de rendimiento | `4b6eda6` | Tests con un techo de consultas medido sobre el código actual (tabla abajo). Si alguien vuelve a meter un N+1, el test falla. |

**Línea base de rendimiento (consultas a la base):**

| Flujo | Hoy | Meta | Módulo que lo baja |
|---|---|---|---|
| Alta de un plantel de 16 integrantes | 68 → **7** ✓ | ≤ 8 | 1 |
| Fixture round robin de 16 competidores | 244 | ≤ 5 | 4 |
| Métricas `overview` con la caché ya cargada | 1 | 0 | 3 |

### 2.3 Módulo 1 — Inscripciones y participantes (terminado)

| Commit | Qué se hizo |
|---|---|
| `1862c57` | Reglas puras con su spec (21 tests): `inscription-eligibility.ts` (edad o año de nacimiento y sexo, con `Sex.MIXTO` en lugar del texto) y `roster-rules.ts` (DNI repetidos, capitán único, cupo de titulares y suplentes). |
| `3180f86` | `InscriptionsService` (1.182 líneas) dividido por responsabilidad: `InscriptionsService` (alta individual, listado y detalle), `TeamInscriptionsService` (planteles), `InscriptionReviewService` (revisar, aprobar y rechazar) e `InscriptionQrService` (código, imagen y consulta pública). El alta de un plantel escribe en lote: **de 68 a 7 consultas** para 16 integrantes, y el costo ya no crece con el tamaño del plantel. La revisión, aprobación y rechazo dejan de devolver la fila completa del participante (que incluía el domicilio). |
| (este) | Comentarios del controller recortados según `AGENTS.md` §6.9. |

Las rutas, los mensajes de error y el orden de las validaciones no cambiaron. Ningún test de comportamiento se modificó.

**Dos pasos del plan quedaron diferidos, con motivo:**
- **VULN-28 (sacar los IDs internos de las vistas públicas):** el UUID del participante no sale solo en `participantId`, sino también en `participant.id` y como `id` de cada fila del ranking, y la suite de Playwright lo usa para cargar resultados. Hacerlo bien requiere separar la proyección pública de la de administración en `GET /competitions/:id` (con el patrón `OptionalJwtAuthGuard`, como en noticias y calendario), y depende de la decisión pendiente sobre qué se publica de los menores.
- **Listado de participantes con `PARTICIPANT_SUMMARY`:** el formulario de edición se rellena con la fila del listado. Si el listado dejara de traer email, teléfono y domicilio, esos campos aparecerían vacíos al editar y se podrían borrar al guardar. Pasa al Módulo 7: el formulario tiene que cargar el detalle antes de editar.

### 2.4 Problemas que encontró la red de seguridad (corregidos)

Al correr todo con el CI nuevo aparecieron problemas que ya existían y que el CI anterior no detectaba. Ninguno era del código de la aplicación:

| Commit | Problema | Corrección |
|---|---|---|
| `4528599` | El CI corría el linter con `--fix` y escondía 8 errores de formato. | Se aplicó el formato. |
| `ce93f10` | La suite `seguridad-auth-rutas` importaba `app.module`, que valida el `.env` al cargarse: **fallaba siempre en cualquier máquina sin `.env`**, como el CI. | Importa `urlParaLog` desde su propio archivo. |
| `f56c1cd` | Los tests de login hacen 10 o más `argon2` (lento a propósito) y superaban los 5 s de Jest con varios workers: fallos intermitentes. | Timeout de 30 s para la suite e2e. |
| `4b6eda6` | La suite de planteles tardaba ~2 minutos renderizando imágenes QR reales y a veces pasaba su timeout. | Usa un QR simulado: ese spec prueba la atomicidad, no el render. La suite e2e completa bajó de ~176 s a ~78 s. |
| `9bd3260` | Playwright en celular: el clic sobre "Encuesta" caía mientras el menú todavía se desplegaba. | El helper espera a que el menú se vea entero antes del clic. |

### 2.5 Estado verificado

Todo en verde en GitHub Actions (corrida `45433399536`) y en local:

| Suite | Resultado |
|---|---|
| Backend: lint | 0 errores (15 avisos de `any`) |
| Backend: tests unitarios | 330 / 330 |
| Backend: tests e2e | 1.062 / 1.062 |
| Frontend: lint, build y checks | OK, 14 / 14 checks |
| Playwright (API, escritorio y celular) | 409 OK, 1 omitido a propósito (`content.spec.ts:130`: el stack aislado no tiene noticias del portal) |

---

## 3. Lo que falta hacer

### 3.1 Pendiente menor

- `documentacion/analisis-buenas-practicas.pdf` (la versión vieja del análisis) quedó sin commitear porque estaba abierta en Acrobat y no se podía mover. **Se puede borrar:** la versión vigente es la de esta carpeta.

### 3.2 Reglas para todos los módulos

1. **Usar los patrones que ya existen**, sin inventar otros (`AGENTS.md` §1.4 y §8.7):
   - lógica pura en archivos junto al servicio, con su `*.spec.ts` (modelo: `bracket.ts`, `standings.ts`, `metrics-aggregation.ts`);
   - módulos con varios providers (modelo: `news/`, `venues/`);
   - el tipo `ClienteFixture` de `bracket.ts` para escribir con `prisma` o dentro de una transacción;
   - proyecciones de `common/prisma-selects.ts` y alcance territorial con `ScopeService`.
2. **Sin capa de repositorios y sin dependencias nuevas** (`AGENTS.md` §8.5).
3. **Primero tests de caracterización, después mover código.** Un commit por paso; un PR de `dev-lucas` a `develop` por módulo.
4. **Nombres en inglés, comentarios cortos y enums de Prisma** en lugar de textos sueltos: se corrigen dentro de cada módulo, en el mismo cambio, para no tocar dos veces el mismo código.
5. **Cambios funcionales** (VULN-20, 23 y 35): primero un ítem en `spec.md` y una tarea en `tasks.md` (`AGENTS.md` §1.1).
6. **Verificación de cada paso:** `npm run lint:check`, `npm run build`, `npx jest` y `npm run test:e2e` en `backend/`; `npm run lint`, `npm run build` y `npm run check:all` en `frontend/`. Al cerrar cada módulo, Playwright (`cd e2e && npm run stack:up && npm test && npm run stack:down`, o a mano desde Actions).

### 3.3 Módulos, ordenados de mayor a menor riesgo

#### Módulo 1 — Inscripciones y participantes ✓ terminado (ver 2.3)
Pendientes que salieron de este módulo: VULN-28 (sección 3.4) y el listado de participantes (Módulo 7).

#### Módulo 2 — Autenticación y usuarios (2–3 días)
1. Tipar `request.user` (extender `Request` de Express), `jwt-auth.guard` y `expiresIn`, y quitar los `any`.
2. **VULN-22:** throttler sobre Redis implementando la interfaz `ThrottlerStorage` con el `RedisCacheService` existente (sin paquetes nuevos), leyendo la configuración desde `ConfigService`.
3. Extraer `TokenService` de `AuthService` (generación, rotación y detección de reuso de tokens).
4. **VULN-23 (funcional):** `mustChangePassword` y `POST /auth/change-password`, con su pantalla en el frontend.
5. **VULN-27:** registrar en la auditoría los accesos denegados (401/403), con un tope por IP. Script de purga listo para cuando se decida la retención.
6. **VULN-47:** quitar la aceptación transitoria de tokens sin `iss`/`aud`.

#### Módulo 3 — Encuesta y métricas (3 días)
1. `SurveyVersionCache`: una sola implementación de la caché por versión, compartida por encuesta y métricas.
2. Dividir `MetricsService` en `MetricsQueryService` (lectura), `MetricsKpisService` y `MetricsHighlightsService`, más un filtro puro `buildResponseWhere`.
3. Rendimiento:
   - consultar la caché **antes** que la base (**meta: 0 consultas con caché**);
   - `Promise.all` en las consultas independientes;
   - sacar el `findMany` recursivo de `corteCoherente`;
   - leer las respuestas por lotes con cursor;
   - `select` en los listados.
4. Extraer de `submitResponse` la función pura `validateAnswers`.
5. **VULN-20 (funcional):** tope diario de respuestas por IP, con el mismo storage de Redis del módulo 2.
6. **VULN-35 (funcional):** guardar `enviadaEn` truncada a la hora.

#### Módulo 4 — Competencias y resultados (1½ días)
1. Motores de fixture puros: calculan los cruces y no usan Prisma.
2. `EngineFactory` con un mapa por formato en lugar del `switch`: agregar un formato no toca la fábrica.
3. Escritura del fixture en lote (`createManyAndReturn` + un `createMany`) y sin el timeout de 60 s. **Meta: de 244 a ≤ 5 consultas.**
4. Condición de carrera: el primer paso de la transacción cambia la competencia de `BORRADOR` a `ACTIVA` solo si sigue en `BORRADOR`; si no, responde 409.
5. `Promise.all` en `competitions.create`, enums de Prisma y nombres en inglés.

#### Módulo 5 — Plataforma transversal (1½ días)
1. Todas las lecturas de `process.env` pasan por `ConfigService`. **VULN-13:** `NODE_ENV` obligatorio. **VULN-17:** `MINIO_PUBLIC_USE_SSL` obligatorio en producción.
2. `redact` en los logs de pino para tokens, contraseñas y datos personales.
3. `DashboardService` y `StatsService` usan el `RedisCacheService` compartido en vez de abrir su propia conexión a Redis.
4. Paginación por cursor común en `common/`, reutilizada por reportes y métricas.
5. **VULN-29, 46 y 16:** Prisma 7.10.1 y `overrides`, `SCARF_ANALYTICS=false`, `npm ci --ignore-scripts` e imágenes fijadas por digest.

#### Módulo 6 — Reportes y documentos (1 día)
1. Cada reporte en su propio archivo (`reports/definitions/`) y los escritores CSV/Excel aparte: un reporte nuevo es un archivo nuevo.
2. `where` tipados con Prisma y `status` validado como enum.
3. `select` en lugar de traer la fila completa del participante (que incluye el domicilio).
4. `documents.findByParticipant` con `select` y paginación; proyecciones en los listados de sedes, calendario y noticias.

#### Módulo 7 — Frontend de administración (2–3 días)
1. Formularios con `useForm<z.input, unknown, z.output>`: quitar los ~28 `as any` y los `as Resolver`.
2. El formulario de edición de participantes carga el detalle (`useParticipant(id)`) en vez de usar la fila del listado; recién entonces el listado puede bajar a `PARTICIPANT_SUMMARY` (pendiente del Módulo 1).
3. Hook `useCrudPageState` para el estado repetido en las 6 páginas de administración, con el layout de Teams/Venues como modelo.
4. Rendimiento:
   - memoizar las columnas de las tablas;
   - guardar los borradores con debounce;
   - borrar el barrel muerto `pages/admin/index.tsx`;
   - una sola fuente para el prefetch de rutas.
5. Partir `schemas/index.ts`, `types/index.ts` y `lib/utils.ts` por dominio, manteniendo un `index.ts` que reexporte.

#### Módulo 8 — Frontend público y componentes grandes (2 días)
1. `ImpactMapSvg`: extraer los hooks `useMapView`, `useMapGestures` y `useElementSize`.
2. `DocumentUploader`: extraer el hook `useDocumentUpload`.
3. `NewsPage`: hook `useNewsPageData` y subcomponentes en su carpeta.
4. Partir `metricsRules.ts` por tema.
5. Vitest: solo si el equipo lo aprueba (ver 3.4).

### 3.4 Decisiones que necesitan al equipo o al cliente

No bloquean el resto del trabajo.

| Tema | Qué hay que decidir |
|---|---|
| VULN-07 | Si se modela la asignación árbitro ↔ partido (hoy un árbitro puede cargar cualquier partido). |
| VULN-19 | Si el rol COORDINADOR puede ver métricas de toda la provincia. |
| VULN-20 | Si se agrega un token de un solo uso o Turnstile a la encuesta (el tope por IP se hace igual). |
| VULN-23 | Si se fuerza el cambio de contraseña a todas las cuentas existentes. |
| VULN-27 | Cuánto tiempo se conservan los registros de auditoría. |
| VULN-28 | Qué datos de los menores se publican en fixtures y rankings. Con eso se separa la proyección pública de la de administración en `GET /competitions/:id` y en el ranking (los IDs internos hoy salen en `participantId`, `participant.id` y el `id` de cada fila). |
| VULN-03 / 11 | Topología de producción y TLS. |
| Vitest | Si se suma al stack para reemplazar los scripts `check-*.mjs` (requiere actualizar `AGENTS.md` y `plan.md`). |

Quedan aceptados y no se tocan: VULN-21, 36 y 44 (inherentes al diseño) y VULN-31 (Jest 30 rompe PGlite).

---

## 4. Cómo retomar

1. `git checkout dev-lucas && git pull`.
2. Instalar las dependencias en `backend/` y `frontend/` (`npm ci`) y confirmar que todo está en verde con los comandos de la sección 3.2.
3. Abrir [`odd/tasks/refactor-solid.md`](../../odd/tasks/refactor-solid.md), tomar el primer módulo pendiente y seguir sus pasos en orden.
4. Al terminar cada paso: commit (`refactor(<módulo>): …`, en español), actualizar el tracker y, al cerrar el módulo, bajar el techo correspondiente del presupuesto de consultas y abrir el PR a `develop`.
