# Refactor SOLID y mitigación de vulnerabilidades — Estado

| | |
|---|---|
| **Rama** | `dev-lucas` (base: `develop` + `dev-santi`) |
| **Autor** | Lucas Zigaran |
| **Última actualización** | 26/11/2026, commit `ce007b8` |
| **Fases del plan** | **9**: Fase 0 (red de seguridad) + Fases 1 a 8 |
| **Estado** | Fases 0, 1 y 4 **terminadas**. Fases 2, 3 y 5 **casi completas**: a las dos primeras solo les faltan cambios funcionales que esperan `spec.md`/`tasks.md` y una decisión. Fases 6 a 8 **pendientes**. |
| **Avance global** | 28 de 49 pasos hechos, 2 diferidos con motivo, 19 pendientes. |
| **Verificación** | CI completo en verde sobre `0cc47a7` (corrida `45835145010`): backend, frontend y Playwright 409 OK. |
| **PR** | Todavía **no** hay PR abierto hacia `develop` (ver la guía, sección 6). |
| **Para retomar** | 👉 [`GUIA-DE-TRASPASO.md`](GUIA-DE-TRASPASO.md): entorno, método, herramientas, trampas y recetas paso a paso. |
| **Seguimiento detallado** | [`odd/tasks/refactor-solid.md`](../../odd/tasks/refactor-solid.md) (log L1 a L12) |
| **Análisis de origen** | [`analisis-buenas-practicas.pdf`](analisis-buenas-practicas.pdf) (en esta carpeta) |
| **Relevamiento de seguridad** | [`../seguridad/relevamiento-owasp-2025.md`](../seguridad/relevamiento-owasp-2025.md) |

Este documento dice **qué se hizo**, con qué commits y qué se midió en cada fase, y **qué falta**. El **cómo** (entorno, método y recetas para seguir) está en la guía de traspaso.

---

## 1. Por qué existe este refactor

El análisis de buenas prácticas (PDF en esta carpeta, sobre el merge `2dd98a6`) concluyó que el proyecto **no es código espagueti**: tiene una arquitectura por módulos clara, una capa de API y de hooks bien separada en el frontend, transacciones donde importan y una batería de tests de seguridad muy completa. Pero había problemas concentrados en pocos puntos:

- **Clases que hacían demasiado:** `InscriptionsService` (1.182 líneas; su método `createTeam` tenía ~490) y `MetricsService` (1.082).
- **Escrituras N+1:** consultas a la base dentro de bucles, en el alta de planteles (68 consultas para 16 integrantes) y en la generación del fixture (244 para 16 competidores).
- **Un CI que no cubría** el frontend, los tests e2e del backend ni Playwright.
- **Incumplimientos de `AGENTS.md`:** `any` sin justificar (§6.1), identificadores en español (§3) y comentarios muy largos con historial de tickets (§6.9).
- **22 vulnerabilidades del relevamiento OWASP** que no estaban cerradas del todo.

Como el sistema **todavía no está en producción** y nadie más estaba modificando el código, se decidió refactorizar de forma ordenada, por fases, de mayor a menor riesgo.

### 1.1 Las 9 fases

| Fase | Alcance | Estado | Pasos |
|---|---|---|---|
| **0** | Red de seguridad: CI, avisos de `any`, presupuesto de consultas | ✅ Terminada | 5 / 5 |
| **1** | Inscripciones y participantes | ✅ Terminada | 6 / 8 (2 diferidos con motivo) |
| **2** | Autenticación y usuarios | 🟡 Casi completa | 5 / 6 (falta VULN-23, funcional) |
| **3** | Encuesta y métricas | 🟡 Casi completa | 4 / 6 (faltan VULN-20 y VULN-35, funcionales) |
| **4** | Competencias y resultados | ✅ Terminada | 5 / 5 |
| **5** | Plataforma transversal | 🟡 Casi completa | 4 / 5 (falta dependencias e imágenes, PR aparte) |
| **6** | Reportes y documentos | ✅ Terminada | 4 / 4 (paginación de documentos descartada con motivo) |
| **7** | Frontend de administración | ✅ Terminada | 5 / 5 (debounce de borradores descartado con motivo) |
| **8** | Frontend público y componentes grandes | ✅ Terminada | 4 / 5 (Vitest espera decisión) |

### 1.2 Resultados medidos

**Rendimiento (consultas a la base, medidas con el presupuesto de consultas):**

| Flujo | Antes | Ahora |
|---|---|---|
| Alta de un plantel de 16 integrantes | 68 | **7** (11 y 16 integrantes cuestan lo mismo) |
| Fixture round robin de 16 competidores | 244 | **7** + el bloqueo `FOR UPDATE` (4 y 16 competidores cuestan lo mismo) |
| Métricas `overview` con la caché cargada | 1 | **0** |
| Métricas `overview` con 2 filtros, sin caché | 9 | **8** |

**Tamaño de las clases que hacían demasiado:**

| Antes | Ahora |
|---|---|
| `InscriptionsService` (1.182) | `InscriptionsService` 333, `TeamInscriptionsService` 543, `InscriptionReviewService` 126, `InscriptionQrService` 107, más 2 archivos de reglas puras |
| `MetricsService` (1.082) | `MetricsQueryService` 791, `MetricsKpisService` 98, `MetricsHighlightsService` 100, más `response-filter.ts` y `metrics-campaign.ts` |
| `AuthService` (500) | `AuthService` 394 + `AuthTokensService` 122 |
| `ReportsService` (978) | Fachada de 105, `ReportWriter` 345, `report-format.ts` 141 y un archivo por reporte (84–144) |

**Calidad y pruebas:**

| | Antes | Ahora |
|---|---|---|
| Backend: lint | 8 errores escondidos por `--fix`, regla de `any` apagada | 0 errores, **0** avisos de `any` (eran 15) |
| Backend: tests unitarios | 309 | **361** |
| Backend: tests e2e | 1.046, con 3–5 fallos intermitentes; ~176 s | **1.064**, estables; ~80 s |
| Frontend: lint, build y checks | 14/14, pero no corrían en CI | 14/14 en CI, **0** avisos de `any` (eran 28) |
| Playwright | No corría en CI | **409 OK** + 1 omitido a propósito, en CI |

---

## 2. Lo que ya está hecho

### 2.1 Preparación

| Commit | Qué se hizo |
|---|---|
| `269f6e2` | Skill `solid` (`.claude/skills/solid`) con guías de SOLID, clean code y code smells. Se revisó entera antes de instalarla: solo contiene Markdown. |
| `2dd98a6` | Rama `dev-lucas` desde `develop`, con `dev-santi` integrada (156 commits, ~19.500 líneas, la versión más actual), sin conflictos. |
| `b46e0fd` | Análisis de buenas prácticas en PDF: 17 hallazgos por prioridad, con ejemplos, la forma de corregirlos y referencias a la documentación oficial. |
| `4010998` | Plan por fases y tracker en `odd/tasks/refactor-solid.md`. |

### 2.2 Fase 0 — Red de seguridad ✅

**Objetivo:** que todo cambio quede verificado automáticamente y que la mejora de rendimiento se pueda **medir**. Resuelve el hallazgo **A4** y mitiga **VULN-15** y **VULN-16**.

| Paso | Commit | Qué se hizo |
|---|---|---|
| CI completo | `1e85627`, `66350e8` | Jobs separados: auditoría, backend (lint sin `--fix`, build, unitarios, e2e), frontend (lint, build, 14 checks) y Playwright contra el stack aislado (en PRs y a mano). Corre también en `dev-*`. Acciones v7 fijadas por SHA, con `persist-credentials: false`. **VULN-15.** |
| Dependabot | `1e85627` | También vigila las imágenes de Docker y los compose. **VULN-16** (en parte). |
| Scripts | `1e85627` | `npm run lint:check` (backend) y `npm run check:all` (frontend). |
| Avisos de `any` | `51e63fd` | ESLint y oxlint marcan cada `any` como aviso, sin cortar el CI. |
| Presupuesto de consultas | `b3e892b`, `4b6eda6` | `test/mocks/query-budget.ts` y techos medidos en 3 flujos. Si alguien vuelve a meter un N+1, el test falla. |
| Dobles de Prisma | `7c9d5c2` | Soportan `createMany` y `createManyAndReturn`, atómicos como Postgres. |

### 2.3 Fase 1 — Inscripciones y participantes ✅

Resuelve **A1** y **A2**, y la parte de inscripciones de **B2**, **B3** y **B4**.

| Paso | Commit | Qué se hizo |
|---|---|---|
| Reglas puras | `1862c57` | `inscription-eligibility.ts` (edad o año y sexo, con `Sex.MIXTO`) y `roster-rules.ts` (DNI repetidos, capitán único, cupos). 21 tests sin base de datos. |
| División del servicio | `3180f86` | `InscriptionsService` (alta individual, listado, detalle), `TeamInscriptionsService` (planteles), `InscriptionReviewService` (revisar, aprobar, rechazar) e `InscriptionQrService` (código, imagen, consulta pública). Mismas rutas, mensajes y orden de validaciones. |
| Planteles en lote | `3180f86` | `findMany` por DNI, `createManyAndReturn` de participantes y de inscripciones, `createMany` de miembros: **de 68 a 7 consultas**. El 409 por DNI fuera de alcance se arma después del rollback. |
| Datos personales | `3180f86` | Revisar, aprobar y rechazar ya no devuelven la fila completa del participante (con domicilio): usan `PARTICIPANT_CONTACT`. |
| Comentarios | `23d65a4` | Controller según `AGENTS.md` §6.9. |

**Diferidos con motivo:**
- **VULN-28:** el UUID del participante sale también en `participant.id` y en el ranking. Depende de la decisión sobre qué se publica de los menores (sección 4).
- **Listado de participantes con `PARTICIPANT_SUMMARY`:** el formulario de edición usaba la fila del listado, así que recortarlo borraba datos al editar. **Resuelto en la Fase 7** (`62b0525`, `62c6514`).

Verificado en CI con Playwright (`45447753101`).

### 2.4 Fase 2 — Autenticación y usuarios 🟡 (5 de 6)

Resuelve la parte de auth de **B5** y parte de **M4**.

| Paso | Commit | Qué se hizo |
|---|---|---|
| Tipado | `e4d4c37` | `RequestWithUser` en lugar de `(request as any).user`; guard JWT y `Observable` del interceptor sin `any`. |
| **VULN-47 cerrada** | `ed139e9` | `JwtStrategy` exige `iss` y `aud`. Los 16 specs firman con `ACCESS_SIGN_OPTIONS` (`test/mocks/jwt-test.ts`). |
| **VULN-22** | `6bce3ca` | `RedisThrottlerStorage` implementa `ThrottlerStorage` sobre `RedisCacheService` (script Lua atómico, cae a memoria sin Redis). Límite compartido entre instancias, sin dependencias nuevas. Verificado contra Redis real en CI (`45829533809`). |
| `AuthTokensService` | `b138e1b` | Emisión de tokens separada de `AuthService`; `expiresIn` en segundos con el mismo parser que la cookie. |
| **VULN-27** | `c28f7dd` | Cada 401/403 fuera de `/auth/*` queda en `audit_logs` como `ACCESS_DENIED`. Puerto `ACCESS_DENIED_RECORDER` en `common/security` (DIP), tope de 10 filas por IP y minuto, fire-and-forget, sin migración. El panel muestra "Acceso denegado". Falta solo la purga, que espera la decisión de retención. |
| VULN-23 | — | **Pendiente:** cambio funcional (guía 5.6). |

### 2.5 Fase 3 — Encuesta y métricas 🟡 (4 de 6)

Resuelve **A3** y la parte de métricas de **B3** y **B4**.

| Paso | Commit | Qué se hizo |
|---|---|---|
| `SurveyVersionCache` | `3597358`, `cfa53f4` | Una sola implementación de la versión de campaña, compartida por encuesta y métricas. |
| División de `MetricsService` | `dde2e3b` | Lectura, ABM de KPIs y ABM de destacados en servicios separados, más funciones puras para el filtro y el catálogo. |
| Rendimiento | `dde2e3b`, `3597358` | Caché antes que la base (**overview con caché: 1 → 0**); memo de los cortes padre de k-anonimato (**9 → 8**); lecturas en paralelo. La recursión de k-anonimato se **memoizó, no se reemplazó**, para no tocar la regla de anonimato. |
| Validación pura | `3597358` | `survey-answers.ts` con 10 tests. |
| VULN-20 y VULN-35 | — | **Pendientes:** cambios funcionales (guía 5.6). |

Verificado en CI con Playwright (`45829533809`).

### 2.6 Fase 4 — Competencias y resultados ✅

Resuelve **M7** y la parte de competencias de **B2**.

| Paso | Commit | Qué se hizo |
|---|---|---|
| Motores puros | `ced316a` | Sin `PrismaService`: cada formato define `pairings(ids)` y una clase base escribe con el cliente que recibe (template method + DIP). |
| `EngineFactory` | `ced316a` | `Record<CompetitionFormat, IFixtureEngine>` en lugar del `switch` (OCP). |
| Fixture en lote | `ced316a` | **De 244 a 7 consultas**, sin el timeout de 60 s. La llave de eliminación directa también escribe en lote. |
| Condición de carrera | `ced316a` | `FOR UPDATE` sobre la competencia y recuento dentro de la transacción (mismo patrón que `ResultsService`). No se hizo "por estado" porque el estado se edita por PATCH. |
| Enums | `ced316a` | Enums de Prisma en lugar de textos en competencias y resultados. |

**Pendiente menor:** renombrar a inglés las funciones de `bracket.ts` y `standings.ts`. VULN-07 espera decisión.

### 2.7 Fase 5 — Plataforma transversal 🟡 (4 de 5)

| Paso | Commit | Qué se hizo |
|---|---|---|
| `ConfigService` + **VULN-13** | `8eda7bd` | `NODE_ENV` obligatorio (antes caía en `development`: falla abierta). Logger, `PrismaService` y Swagger leen de `ConfigService`. Quedan 2 `process.env` con motivo: el filtro global (los specs lo crean con `new`) y una constante de `image.util.ts`. |
| `redact` | `8eda7bd` | Pino oculta authorization, cookies, contraseñas, tokens, DNI, email, teléfono y domicilio. |
| Caché unificada | `9412492` | Dashboard y Stats usan `RedisCacheService`: dos conexiones a Redis menos. |
| Cursor común | `4985957` | `common/prisma/batch-pagination.ts`: `paginateByCursor`, `paginateByOffset` y `mapBatches`, con spec. Los usan los cuatro reportes. En métricas no se aplicó: `projectResponses` necesita **todas** las respuestas del corte (k-anonimato y cruces), así que leer por lotes no baja la memoria total. Cerrado así. |
| Dependencias e imágenes | — | **Pendiente**, en un PR aparte (guía 5.2). VULN-17 espera la topología. |

Verificado en CI con Playwright (`45835145010`), que confirma que la app arranca bien con los cambios de configuración.

### 2.7 bis Fase 6 — Reportes y documentos ✅

Resuelve **M2**, **M3** y **B5**. El backend queda con **0 avisos de `any`**.

| Paso | Commit | Qué se hizo |
|---|---|---|
| Definiciones de reporte (OCP) | `5d650fa` | `reports/definitions/<x>.report.ts` para participantes, inscripciones, equipos y resultados. Un reporte nuevo es un archivo nuevo. `ReportsService` queda como fachada con la misma API y reexporta lo que importan los tests. |
| Escritor y formato (SRP) | `5d650fa` | `ReportWriter` (CSV y Excel en streaming, sin cambios de formato) y `report-format.ts` (etiquetas, puntajes, neutralización de fórmulas, `toCsvLine`). |
| `where` tipados | `5d650fa` | `Prisma.InscriptionWhereInput` y `Prisma.MatchWhereInput`; `status` como `InscriptionStatus` (el DTO ya lo validaba con `@IsEnum`). |
| Proyecciones | `5d650fa` | `select` explícito en los cuatro reportes. `PARTICIPANT_REPORT` en `prisma-selects.ts`: los reportes ya no leen el domicilio. |
| **Bug corregido** | `5d650fa` | El reporte de resultados tomaba `results[0]` como local sin `orderBy`: Postgres podía invertir local y visitante. Ahora ordena por `isHome desc`, como el fixture público (R23). Lo cubre `report-definitions.spec.ts`. |
| DTO sin `any` | `08c13cf` | `file?: Express.Multer.File` en documentos y `config?: Record<string, unknown>` en competencias. |
| Documentos | — | `findByParticipant` **no** se paginó: un participante tiene pocos documentos (uno por tipo) y paginar cambia la forma de la respuesta que consume el frontend. Ya devuelve solo lo necesario (sin `fileKey`). |

### 2.7 ter Fase 7 — Frontend de administración ✅

Resuelve **M1**, **M5** y **M6**. El frontend queda con **0 avisos de `any`** (eran 28).

| Paso | Commit | Qué se hizo |
|---|---|---|
| Formularios tipados | `62b0525` | `useForm<z.input<S>, unknown, z.output<S>>` con un mapper `toFormValues(entity)` en Category, Discipline, News y Team. `FormField` (shadcn) acepta el tercer genérico de RHF, que era lo que obligaba a castear cada `control`. Se quitaron 6 de los 8 `as Resolver<X>`: quedan el de usuarios (elige el schema en runtime) y el diálogo de preguntas de la encuesta, los dos documentados. |
| Bug latente | `62b0525` | Al tipar la entrada, TypeScript mostró que la hora de fin del calendario podía llegar `null` a `ClockTimePicker`, que hace `.split` sobre el valor. Ahora llega `undefined` y aplica su default. |
| Edición de participantes (paso 1.8) | `62b0525`, `62c6514` | El modal carga el detalle con `useParticipant(id)` (con estado de carga y de error) en vez de usar la fila del listado. Recién entonces el backend recorta el listado con `PARTICIPANT_LIST_ROW`: sin domicilio ni contacto. Tipo `ParticipantListItem` en el frontend: el compilador ya no deja editar desde una fila. |
| `useCrudPageState` | `62b0525` | Un hook para filtros (que vuelven a la página 1), paginación, modal y registro a eliminar, con handlers estables. Lo usan Categories, Disciplines, News, Users, Venues, Teams y Participants. Las columnas de las cuatro primeras pasan a `<dominio>/<x>Columns.tsx`, como equipos y sedes. |
| Rendimiento | `62b0525` | Columnas con `useMemo` en las 7 páginas y en Survey; las de Audit e Inscriptions no dependen del estado y pasan a nivel de módulo. `pageLoaders.ts` es la única fuente de los `import()` de rutas (lo usan `lazyPages` y `routePrefetch`). Se borró el barrel muerto `pages/admin/index.tsx`. |
| Archivos por dominio | `62b0525` | `schemas/` (12 módulos), `types/` (5) y `lib/utils/` (4). Cada `index.ts` reexporta exactamente la misma API: se comparó la lista de exports antes y después. |
| Descartado: debounce de borradores | — | La encuesta guarda en cada cambio a propósito, para sobrevivir a un cierre abrupto del navegador; demorar la escritura perdería las últimas teclas y el costo ahorrado (una escritura chica en `localStorage`) es despreciable. Lo mismo para el plantel. |
| Pendiente menor | — | Las toolbars de Categories, Disciplines, News y Users siguen dentro de la página (son un solo control cada una). La tabla del calendario no se memoizó: la página le pasa handlers no estables. |

### 2.7 quater Fase 8 — Frontend público y componentes grandes ✅ (4 de 5)

| Paso | Commit | Qué se hizo |
|---|---|---|
| Mapa de impacto | `cf1f730` | `useMapView` (zoom con transiciones), `useMapGestures` (rueda, arrastre, pellizco, doble clic y teclado) y `useElementSize` (`ResizeObserver`). `ImpactMapSvg`: 796 → 556 líneas, queda con el dibujo. |
| Uploader de documentos | `ae56599` | `useDocumentUpload` con el ciclo de la subida (preparar, validar, previsualizar, progreso, cancelar, error). Va junto al componente y no en `@/hooks/`: `check:documents` exige que el uploader no importe de ahí (no hace HTTP). 532 → 414 líneas. |
| Noticias | `2b071a6` | `useNewsPageData` (búsqueda, filtro, vista y las cuatro consultas) y `NewsSections` / `NewsResults` en `pages/public/news/`. El `useEffect` que volvía a la página 1 se reemplazó por guardar la página junto con la clave del filtro: un render menos y sin pedir la página vieja. 495 → 271 líneas. |
| `metricsRules` por tema | `977938a` | 8 módulos (`chartData`, `chartLayout`, `plainLanguage`, `period`, `heatmap`, `kpis`, `csv`, `filters`); el index reexporta las mismas 57 exportaciones. |
| Vitest | — | **Espera decisión del equipo** (dependencia nueva; `AGENTS.md` pide confirmación). |

Dos `check:*` leían archivos por ruta y se actualizaron en el mismo commit: `check:cards` mira `NewsPage` y su hook.

### 2.8 Problemas que destapó la red de seguridad (corregidos)

| Commit | Problema | Corrección |
|---|---|---|
| `4528599` | El CI corría el lint con `--fix` y escondía 8 errores. | Formato aplicado; el CI usa `lint:check`. |
| `ce93f10` | Una suite importaba `app.module` y fallaba en cualquier máquina sin `.env`. | Importa solo lo que usa. |
| `f56c1cd` | Fallos intermitentes por `argon2` con varios workers. | Timeout de 30 s en la suite e2e. |
| `5d650fa` | La regla `reports/` de `backend/.gitignore` (pensada para reportes generados con PII) también ignoraba `src/modules/reports/`: los archivos nuevos del módulo no aparecían en `git status`. | Excepción `!src/modules/reports/`; la regla sigue protegiendo los archivos generados. |
| `4b6eda6` | La suite de planteles tardaba ~2 min por los QR reales. | QR simulado en ese spec; la suite e2e bajó de ~176 s a ~78 s. |
| `9bd3260` | Playwright móvil hacía clic con el menú a medio desplegar. | Espera a que el menú se vea entero. |
| `cfa53f4` | Tres archivos nuevos de la encuesta no entraron en `3597358` (`git commit <rutas>` no incluye archivos sin versionar). | Se agregaron; quedó como trampa documentada en la guía. |

---

## 3. Lo que falta

El detalle y la receta de cada punto están en la [guía de traspaso](GUIA-DE-TRASPASO.md), sección 5.

| Fase | Pendiente | Necesita decisión | Receta |
|---|---|---|---|
| 2 | VULN-23: cambio de contraseña obligatorio | Sí: forzar a las cuentas existentes | 5.6 |
| 3 | VULN-20: tope diario por IP en la encuesta | N diario; token o Turnstile | 5.6 |
| 3 | VULN-35: hora truncada en las respuestas | Confirmar la resolución del panel | 5.6 |
| 4 | Nombres en inglés en `bracket.ts`/`standings.ts` | No | 5.7 |
| 5 | Dependencias e imágenes (VULN-29, 46, 16) | No (PR aparte) | 5.2 |
| 8 | Vitest en el frontend | Sí: aprobación del equipo | 5.5 |
| — | VULN-07, VULN-17, VULN-28, purga de auditoría | Sí | 5.7 |

**Próximo paso recomendado:** abrir el PR de lo hecho (guía, sección 6). Lo que queda sin decisiones es chico (dependencias e imágenes en un PR aparte, renombrar `bracket.ts`/`standings.ts`); el resto espera las decisiones de la sección 4.

---

## 4. Decisiones que necesitan al equipo o al cliente

No bloquean el resto del trabajo.

| Tema | Qué hay que decidir | Afecta a |
|---|---|---|
| VULN-07 | Si se modela la asignación árbitro ↔ partido (hoy un árbitro puede cargar cualquier partido). | Fase 4 |
| VULN-17 | Si MinIO va detrás de un proxy con TLS o se exige SSL propio en producción. | Fase 5 |
| VULN-19 | Si el rol COORDINADOR puede ver métricas de toda la provincia. | Fase 3 |
| VULN-20 | El tope diario por IP (N) y si se agrega token de un solo uso o Turnstile. | Fase 3 |
| VULN-23 | Si se fuerza el cambio de contraseña a todas las cuentas existentes. | Fase 2 |
| VULN-27 | Cuánto tiempo se conservan los registros de auditoría (para la purga). | Fase 2 |
| VULN-28 | Qué datos de los menores se publican en fixtures y rankings. | Fase 1 |
| VULN-03 / 11 | Topología de producción y TLS. | Despliegue |
| Vitest | Si se suma al stack (requiere actualizar `AGENTS.md` y `plan.md`). | Fase 8 |

Quedan aceptados y no se tocan: VULN-21, 36 y 44 (inherentes al diseño) y VULN-31 (Jest 30 rompe PGlite).

---

## 5. Hallazgos del análisis: estado de cada uno

| # | Hallazgo | Prioridad | Fase | Estado |
|---|---|---|---|---|
| A1 | `createTeam()` de 492 líneas | Alta | 1 | ✅ Resuelto |
| A2 | `InscriptionsService` "clase dios" | Alta | 1 | ✅ Resuelto |
| A3 | `MetricsService` mezcla consultas, dos CRUD y caché | Alta | 3 | ✅ Resuelto |
| A4 | El CI no cubre frontend ni e2e | Alta | 0 | ✅ Resuelto |
| M1 | `as any` en formularios (28) | Media | 7 | ✅ Resuelto |
| M2 | `no-explicit-any` apagado y `where: any` en reportes | Media | 0 y 6 | ✅ Resuelto: regla activa y 0 `any` en el backend |
| M3 | Reportes traen la fila completa del participante | Media | 6 | ✅ Resuelto |
| M4 | `process.env` fuera del `ConfigService` | Media | 2 y 5 | 🟡 De 9 lecturas a 2, ambas con motivo |
| M5 | Páginas CRUD con el mismo estado copiado | Media | 7 | ✅ Resuelto (`useCrudPageState`) |
| M6 | Archivos "cajón de sastre" | Media | 7 | ✅ Resuelto |
| M7 | Fixture: inserts uno por uno y carrera | Media | 4 | ✅ Resuelto |
| M8 | El frontend no tiene runner de tests | Media | 8 | ⬜ Espera decisión |
| B1 | Servicios atados a `PrismaService` concreto | Baja | — | Sin capa de repositorios: se usan tipos acotados (`ClienteFixture`) y puertos |
| B2 | Strings mágicos en lugar de enums | Baja | 1 y 4 | 🟡 Inscripciones, competencias y resultados resueltos |
| B3 | Identificadores en español | Baja | 1 a 4 | 🟡 Código nuevo en inglés; faltan `bracket.ts`, `standings.ts` y `metrics-aggregation.ts` |
| B4 | Comentarios muy extensos o desactualizados | Baja | todas | 🟡 Se corrige en cada fase |
| B5 | `any` en guard, interceptor, auth y DTO | Baja | 2 y 6 | ✅ Resuelto |

**Resumen:** 11 resueltos, 5 en parte, 0 pendientes, 1 esperando decisión y 1 reemplazado por un patrón existente.

---

## 6. Cómo retomar

Seguí la [guía de traspaso](GUIA-DE-TRASPASO.md):
1. Entorno y verificación (sección 1).
2. Método de trabajo (sección 2).
3. Herramientas para reutilizar (sección 3).
4. Trampas conocidas (sección 4).
5. Receta del paso siguiente (sección 5).
6. PR (sección 6).

Al terminar cada paso, sumá una línea al tracker y actualizá la fase en este documento.
