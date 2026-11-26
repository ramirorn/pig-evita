# Guía de traspaso del refactor

| | |
|---|---|
| **Para quién** | Quien retome el refactor de la rama `dev-lucas`. |
| **Escrita por** | Lucas Zigaran, 26/11/2026, sobre el commit `ce007b8`. |
| **Qué cubre** | Cómo dejar el entorno listo, cómo se trabajó, las herramientas que se crearon, las trampas que aparecieron y una receta paso a paso para cada pendiente. |
| **Qué no cubre** | El detalle de cada cambio ya hecho y sus métricas: eso está en [`README.md`](README.md). El análisis original está en [`analisis-buenas-practicas.pdf`](analisis-buenas-practicas.pdf). |

---

## 0. En dos minutos

**Dónde quedó:** las Fases 0, 1 y 4 están terminadas. Las Fases 2, 3 y 5 están casi completas. Las Fases 6, 7 y 8 no empezaron. Todo está en `dev-lucas`, pusheado y con el CI completo en verde, incluido Playwright (corrida `45835145010`). **Todavía no hay PR abierto hacia `develop`.**

| Fase | Estado | Lo que falta |
|---|---|---|
| 0 — Red de seguridad | ✅ | — |
| 1 — Inscripciones | ✅ | VULN-28 (decisión) y el listado de participantes, que pasa a la Fase 7 |
| 2 — Autenticación | 🟡 5/6 | VULN-23 (cambio funcional + decisión) |
| 3 — Encuesta y métricas | 🟡 4/6 | VULN-20 y VULN-35 (cambios funcionales) |
| 4 — Competencias | ✅ | Renombrar `bracket.ts`/`standings.ts` a inglés; VULN-07 (decisión) |
| 5 — Plataforma | 🟡 3/5 | Cursor común (5.4) y dependencias/imágenes (5.5); VULN-17 (decisión) |
| 6 — Reportes y documentos | ⬜ | Todo |
| 7 — Frontend de administración | ⬜ | Todo |
| 8 — Frontend público | ⬜ | Todo |

**Próximo paso recomendado:** la **Fase 6**. No depende de ninguna decisión, deja el backend en **0 avisos de `any`** y su receta está en la sección 5.3.

Antes de empezar, conviene abrir el PR de lo hecho hasta ahora (sección 6).

---

## 1. Dejar el entorno listo

### 1.1 Requisitos
- **Node 22** (el del CI y de las imágenes). Con Node 24 también funciona localmente.
- **Git** y, opcional, **GitHub CLI (`gh`)** autenticado, para disparar el CI y leer sus logs.
- **Docker Desktop**, solo si querés correr Playwright localmente. El CI lo corre igual.

### 1.2 Instalar
```powershell
git checkout dev-lucas
git pull
cd backend; npm ci; cd ..
cd frontend; npm ci; cd ..
cd e2e; npm ci; cd ..
```
`npm ci` del backend corre `prisma generate` solo (está en `postinstall`).

### 1.3 Verificar que todo está en verde (línea base)
Estos son los comandos de cada paso. Así tiene que quedar **antes** de tocar nada:

| Dónde | Comando | Resultado esperado hoy |
|---|---|---|
| `backend/` | `npm run lint:check` | 0 errores, 6 avisos de `any` |
| `backend/` | `npm run build` | sin errores |
| `backend/` | `npx jest` | 354 / 354 |
| `backend/` | `npm run test:e2e` | 1.064 / 1.064 (~80 s) |
| `frontend/` | `npm run lint` | 0 errores, 28 avisos de `any` |
| `frontend/` | `npm run build` | sin errores |
| `frontend/` | `npm run check:all` | 14 / 14 checks OK |
| `e2e/` (Docker) | `npm run stack:up`, `npm test`, `npm run stack:down` | 409 OK, 1 omitido a propósito |

Los tests e2e del backend **no necesitan Postgres ni Redis**: usan dobles de Prisma en memoria (`backend/test/mocks/`) y PGlite para el SQL crudo de estadísticas.

- **`lint:check`:** no corrige nada (es lo que corre el CI).
- **`lint`:** corre con `--fix` y también formatea.

### 1.4 Cómo funciona el CI (`.github/workflows/ci.yml`)
- **En cada push a `dev-*`, `develop` o `main`:** auditoría, backend (lint, build, unitarios, e2e) y frontend (lint, build, checks). Tarda ~2–3 minutos.
- **Playwright** (~14 minutos) corre **solo en PRs a `develop`/`main` o a mano.** Para dispararlo a mano: pestaña Actions → "Juegos Evita Backend CI" → "Run workflow", o:
  ```powershell
  gh workflow run ci.yml --ref dev-lucas
  ```
- ⚠️ **Un push nuevo a la misma rama cancela la corrida en curso** (`concurrency` con `cancel-in-progress`). Si disparás Playwright y después pusheás, se cancela. **Dispará la corrida de cierre después del último push** y esperá a que termine.
- Para leer un fallo:
  ```powershell
  gh run view <id> --log-failed
  ```
  Si falla Playwright, el job sube las capturas y trazas como artefacto `playwright-results`:
  ```powershell
  gh run download <id> -n playwright-results
  ```

---

## 2. Cómo se trabajó (el método)

Cada fase siguió el mismo ciclo. Conviene mantenerlo, porque es lo que permitió refactorizar sin cambiar comportamiento:

1. **Leer antes de tocar.** El servicio entero, su controller, su módulo y **todos los specs que lo usan** (`grep -rln NombreDelServicio backend/test backend/src`). Varios specs arman el módulo a mano y se rompen si cambian los providers.
2. **Caracterizar.** Los e2e del backend ya cubren casi todo. Si un flujo no está cubierto, se agrega el test **antes** de mover código.
3. **Extraer la lógica pura** a un archivo junto al servicio, con su `*.spec.ts`. Las reglas devuelven el **mensaje de error o `null`**, no lanzan excepciones de Nest: el servicio decide la respuesta. Ejemplos: `inscription-eligibility.ts`, `roster-rules.ts`, `survey-answers.ts`, `response-filter.ts`.
4. **Dividir el servicio** por responsabilidad, con los **mismos mensajes y el mismo orden de validaciones**. Se exporta una constante `*_PROVIDERS` para que los specs no tengan que listar cada servicio (ver 3.3).
5. **Optimizar midiendo.** Con el presupuesto de consultas (sección 3.1):
   1. se pone el techo en `-1` para que el test falle y muestre cuántas consultas se hacen hoy;
   2. se optimiza;
   3. se vuelve a medir;
   4. se fija el techo en el valor nuevo, con un comentario que diga cuánto era antes.
6. **Verificar** con la tabla de 1.3 completa.
7. **Commitear por paso**, con Conventional Commits en español (`refactor(<módulo>): …`, `fix(...)`, `test(...)`, `docs(...)`) y un cuerpo que diga **qué**, **por qué** y **cuánto mejoró**.
8. **Documentar:** una línea `L<n>` en [`odd/tasks/refactor-solid.md`](../../odd/tasks/refactor-solid.md) y la fase en el [`README.md`](README.md).
9. **Pushear, disparar el CI completo y anotar el resultado** (número de corrida y conteo de Playwright).

**Criterio para SOLID:** se aplicó donde baja el costo de cambiar o mejora el rendimiento, no por ceremonia.
- **No hay capa de repositorios**, porque la receta oficial de NestJS + Prisma inyecta `PrismaService`.
- **No hay dependencias nuevas**, por `AGENTS.md` §8.5.
- **Inversión de dependencias:** se resolvió con tipos acotados (`ClienteFixture`) y puertos (`ACCESS_DENIED_RECORDER`).

---

## 3. Herramientas y patrones que se crearon (para reutilizar)

### 3.1 Presupuesto de consultas — `backend/test/mocks/query-budget.ts`
Cuenta las llamadas a los `jest.fn` de un doble de Prisma (ignora `$transaction` y `$queryRaw`).
```ts
const consultas = await medirConsultas(prismaFalso, () => service.createTeam(dto, user, alcance));
expect(consultas).toBeLessThanOrEqual(TECHO);
```
Techos vigentes:

| Flujo | Spec | Antes | Hoy |
|---|---|---|---|
| Plantel de 16 | `inscriptions-team-roster.e2e-spec.ts` | 68 | 7 (techo 8; 11 y 16 integrantes cuestan igual) |
| Fixture de 16 | `competitions-fixture.e2e-spec.ts` | 244 | 7 + `FOR UPDATE` (4 y 16 competidores cuestan igual) |
| `overview` con caché | `metrics-k-anonimato.e2e-spec.ts` | 1 | 0 |
| `overview` con 2 filtros, sin caché | `metrics-k-anonimato.e2e-spec.ts` | 9 | 8 |

### 3.2 Dobles de Prisma con escritura en lote — `backend/test/mocks/prisma-territorial.ts`
`tabla(modelo, filas)` soporta `createMany` y `createManyAndReturn`. Igual que Postgres, **si una fila viola una `unique`, no se inserta ninguna** (salvo con `skipDuplicates`). Su comportamiento está fijado en `backend/test/prisma-doubles.e2e-spec.ts`.

Los specs con doble propio (planteles, fixture, resultados, métricas) también se extendieron. Si cambiás una escritura a lote, **agregá la operación al doble del spec** y respetá la atomicidad.

### 3.3 Constantes de providers
- `backend/src/modules/inscriptions/inscriptions.providers.ts` → `INSCRIPTION_PROVIDERS`
- `backend/src/modules/metrics/metrics.providers.ts` → `METRICS_PROVIDERS` (a `SurveyVersionCache` hay que sumarlo aparte; lo provee `SurveyModule`)

Los specs que arman el controller a mano usan `...INSCRIPTION_PROVIDERS`. Si agregás un servicio al módulo, agregalo a la constante y los specs lo toman solos. Los specs que **simulan** los servicios (`action-permissions`, `audit-contract`) tienen que sumar un `{ provide: NuevoServicio, useValue: … }`.

### 3.4 Firma de tokens en tests — `backend/test/mocks/jwt-test.ts`
`JwtStrategy` exige `iss` y `aud` (VULN-47). Todo spec que firme access tokens registra:
```ts
JwtModule.register({ secret: ACCESS_SECRET, signOptions: ACCESS_SIGN_OPTIONS })
```

### 3.5 Patrones de producción nuevos
| Patrón | Dónde | Para qué |
|---|---|---|
| Reglas puras con mensaje o `null` | `inscriptions/inscription-eligibility.ts`, `inscriptions/roster-rules.ts`, `survey/survey-answers.ts` | Validaciones testeables sin base. |
| Escritura en lote + reordenar por clave única | `inscriptions/team-inscriptions.service.ts` (`writeRoster`), `competitions/bracket.ts` (`escribirCruces`) | `createManyAndReturn` **no garantiza el orden**: se reordena por una clave única (QR, o `ronda:número`). |
| Error tipado que sale de la transacción | `DniOutsideScopeError` en `team-inscriptions.service.ts` | Tras una violación de `unique`, Postgres deja la transacción abortada: no se puede consultar adentro. Se lanza un error propio, se hace rollback y la consulta para armar el 409 va afuera. |
| Bloqueo `FOR UPDATE` | `competitions.service.ts` (`generateFixture`), `results.service.ts` | Serializar dos escrituras concurrentes sobre la misma competencia. |
| Template method | `FixtureEngine` en `competitions/engine.factory.ts` | Cada formato define `pairings(ids)`; la base escribe con el cliente que recibe. |
| `Record<Enum, …>` en vez de `switch` | `EngineFactory` | Un valor nuevo del enum no compila hasta registrarse (OCP). |
| Caché por versión | `survey/survey-version.cache.ts` | Versión, claves y TTL de los agregados de métricas en un solo lugar. **La caché se consulta antes que la base.** |
| Storage de throttler en Redis | `common/cache/redis-throttler.storage.ts` | Límite de pedidos compartido entre instancias (VULN-22). Script Lua atómico; si Redis no está, cae a memoria. |
| Puerto en `common` | `common/security/access-denied.ts` + `audit/audit-access-denied.recorder.ts` | El filtro global no depende de `modules/audit` (VULN-27). |
| Caché compartida opcional | `@Optional() cache?: RedisCacheService` en dashboard, stats, métricas | Una sola conexión a Redis; los specs sin Redis funcionan igual. |

---

## 4. Trampas que aparecieron (para no repetirlas)

1. **`git commit <rutas>` no incluye archivos nuevos sin versionar.** Pasó en `3597358`: localmente compilaba y en el CI faltaban tres archivos (lo arregló `cfa53f4`). **Siempre `git add` de los archivos nuevos y revisar `git status` antes de commitear.**
2. **Un push cancela la corrida de CI en curso** de la misma rama. Ver 1.4.
3. **Transacción abortada tras una violación de `unique`** (Postgres): no se puede seguir consultando adentro. Ver `DniOutsideScopeError`.
4. **`createManyAndReturn` no garantiza el orden** de lo que devuelve. Hay que reordenar por clave única.
5. **Specs que instancian clases a mano con `new`** (por ejemplo `new GlobalExceptionFilter()` en `body-limit` y en el spec del filtro). Toda dependencia nueva de esas clases tiene que ser `@Optional()`.
6. **Dobles de Redis:** `RedisCacheService` llama a `quit()` al cerrar; los `FakeRedis` de los specs lo necesitan.
7. **Formato:** después de editar, corré `npx eslint --fix <archivos>` y después `npm run lint:check`.
8. **Tests lentos o intermitentes:**
   - `argon2` es lento a propósito: la suite e2e tiene un timeout de 30 s.
   - Renderizar QR bajo Jest tarda ~650 ms por imagen: el spec de planteles simula `qrcode`.
   - En Playwright móvil, esperá a que el menú termine de desplegarse (`toBeInViewport({ ratio: 1 })`).
9. **Supuestos del plan que no se sostuvieron al leer el código.** Por eso conviene leer antes de mover:
   - **Listado de participantes:** recortar su proyección habría borrado datos al editar, porque el formulario usa la fila del listado.
   - **VULN-28:** el UUID también sale en `participant.id` y en el ranking.
   - **Carrera del fixture:** cerrarla "por estado" no servía, porque el estado se edita por PATCH.
   - **Recursión de k-anonimato:** reemplazarla cambiaba la regla de anonimato; se memoizó.

---

## 5. Recetas para lo que falta

Cada receta dice qué tocar, cómo y cómo saber que quedó bien. Las líneas son las del commit `ce007b8`.

### 5.1 Fase 5 — Paso 5.4: paginación por cursor común
- **Hoy:** `paginarPorCursor` es un generador privado de `backend/src/modules/reports/reports.service.ts:250`.
- **Hacer:**
  1. Moverlo a `backend/src/common/prisma/cursor.ts` como función exportada (`paginateByCursor(fetchBatch, batchSize)`), con su spec (lote vacío, lote incompleto, varios lotes).
  2. Reemplazar su uso en reportes.
- **Métricas:** `projectResponses` (`metrics/metrics-query.service.ts`) carga todo el corte en memoria. Ojo: `publicarEnTandas` y los cruces necesitan **todas** las respuestas del corte. Leerlas por lotes baja el pico de cada consulta, pero no la memoria total. Evaluarlo con datos reales antes de cambiarlo; si no rinde, documentarlo y cerrarlo así.
- **Verificar:** los specs de reportes (`reports-streaming.e2e-spec.ts`) siguen en verde.

### 5.2 Fase 5 — Paso 5.5: dependencias e imágenes (PR aparte)
1. **VULN-29:**
   - subir `prisma` y `@prisma/client` a 7.10.1 (`backend/package.json`) y `npm install`;
   - agregar `overrides` para los avisos de `minio` y `exceljs` que `npm audit` informa;
   - correr toda la tabla 1.3 y Playwright.
2. **VULN-46:** en `backend/docker/Dockerfile`:
   - `ENV SCARF_ANALYTICS=false`;
   - `npm ci --ignore-scripts`;
   - `npx prisma generate` explícito **después** de copiar `prisma/`.
   Verificar que la imagen construye (`docker compose -f e2e/docker-compose.e2e.yml build`).
3. **VULN-16:** fijar las imágenes base por digest (`node:22-alpine@sha256:…`, `postgres`, `redis`, `nginx`, `minio`). Dependabot ya vigila Docker y compose.

### 5.3 Fase 6 — Reportes y documentos (recomendada como siguiente)
Deja el backend en **0 avisos de `any`**.

1. **Tipar los `where`**:
   - `backend/src/modules/reports/reports.service.ts:732` y `:877` (`const where: any = {}`) pasan a `Prisma.InscriptionWhereInput` (o el modelo que corresponda);
   - `status` validado como enum `InscriptionStatus` en el DTO.
2. **Listeners:** tipar `once` / `removeListener` de `reports.service.ts:63-64`. Son la interfaz mínima del stream; usar `(...args: unknown[]) => void`.
3. **Proyección:** crear `PARTICIPANT_REPORT` en `backend/src/common/prisma-selects.ts` con solo los campos del Excel (DNI, nombre, apellido, sexo, nacimiento, departamento, localidad, contacto si el reporte lo muestra). Usarla en lugar de `include: { participant: true }` (`reports.service.ts:769` y `:916`), que trae el domicilio.
4. **Definiciones de reporte (OCP):**
   - cada `especificacionX` (participantes, inscripciones, equipos, resultados) pasa a `reports/definitions/<x>.report.ts` implementando la interfaz `EspecificacionReporte` que ya existe;
   - los escritores CSV/Excel (`escribirCsv`, `escribirExcel`, `escribirLote`) pasan a `reports/report-writers.ts`;
   - `ReportsService` solo orquesta.
   Hoy tiene 978 líneas.
5. **Documentos:**
   - `file?: any` (`backend/src/modules/documents/dto/documents.dto.ts:45`) pasa a `Express.Multer.File`;
   - `documents.findByParticipant` (sin `select` ni límite) pasa a usar `select` y paginación.
6. **Otro `any`:** `backend/src/modules/competitions/dto/competitions.dto.ts:72`.
7. **Verificar:** `lint:check` con **0 avisos de `any` en el backend**; `reports-streaming`, `csv-formula-injection`, `public-pii`, `audit-pii-fields` y `scope-sweep` en verde.

### 5.4 Fase 7 — Frontend de administración
1. **Formularios tipados** (28 `as any`):
   - `frontend/src/pages/admin/components/CategoryForm.tsx` (3), `DisciplineForm.tsx` (11), `NewsForm.tsx` (7) y `TeamForm.tsx` (7);
   - usar `useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>` con un mapper tipado `toFormValues(entity)`;
   - quitar también los `as Resolver<X>` de los `use*Form.ts`.
   Referencia: README de `@hookform/resolvers`. Verificar con `npm run lint` (0 avisos) y `npm run build`.
2. **Edición de participantes** (pendiente del paso 1.8):
   - el formulario de `ParticipantsPage.tsx` tiene que cargar el detalle (`useParticipant(id)`) en vez de usar la fila del listado (`initialData={editingParticipant}`);
   - recién después, en el backend, `participants.service.ts` (`findAll`) puede usar `select: PARTICIPANT_SUMMARY` más los campos que muestra la tabla (sexo, nacimiento, departamento, localidad).
3. **`useCrudPageState`:** un hook en `frontend/src/hooks/` para page, limit, filtros que vuelven a la página 1, el modal y la fila a borrar. Migrar Categories, Disciplines, News, Venues, Teams y Users, con el layout de `pages/admin/venues/` y `pages/admin/teams/` como modelo.
4. **Rendimiento:**
   - `useMemo` en las columnas de las tablas;
   - debounce del guardado de borradores con el `useDebounce` existente (`useTeamInscriptionWizard.ts`, `useSurveyWizard.ts`);
   - borrar el barrel muerto `pages/admin/index.tsx`;
   - generar `lib/routePrefetch.ts` desde `lazyPages.tsx`.
5. **Archivos por dominio:** partir `schemas/index.ts`, `types/index.ts` y `lib/utils.ts`, dejando un `index.ts` que reexporte (no cambia ningún import).

### 5.5 Fase 8 — Frontend público
Extraer hooks:
- `useMapView`, `useMapGestures` y `useElementSize` de `components/localityMap/ImpactMapSvg.tsx`;
- `useDocumentUpload` de `components/shared/DocumentUploader.tsx`;
- `useNewsPageData` de `pages/public/NewsPage.tsx`.

También partir `lib/metrics/metricsRules.ts` por tema. **Vitest** solo si el equipo lo aprueba (requiere actualizar `AGENTS.md` y `plan.md`).

### 5.6 Cambios funcionales (VULN-23, VULN-20, VULN-35)
`AGENTS.md` §1.1: **primero un ítem en `documentacion/spec.md` y una tarea en `documentacion/tasks.md`**, después el código. Borradores para arrancar:

- **VULN-23 — cambio de contraseña obligatorio:**
  - Spec: *"El administrador puede marcar una cuenta para que cambie su contraseña en el próximo ingreso; mientras la marca esté activa, el usuario solo puede acceder a la pantalla de cambio. El usuario puede cambiar su contraseña indicando la actual."*
  - Implementación:
    - columna `mustChangePassword Boolean @default(false)` (migración de Prisma);
    - `POST /auth/change-password` con `@AnyAuthenticated()`, throttle propio, verificación de la contraseña actual con `argon2`, reglas de `users/password-policy.ts` y revocación de las otras sesiones con `RevocacionSesionesService`;
    - en el frontend, un guard que redirige a la pantalla de cambio.
  - **Decisión pendiente:** si la migración marca a todas las cuentas existentes.
- **VULN-20 — tope diario de respuestas por IP:**
  - Spec: *"Una misma IP puede enviar como máximo N respuestas por día a la encuesta"* (definir N con el equipo).
  - Implementación: un throttler con nombre (`@Throttle({ 'survey-daily': { ttl: 86_400_000, limit: N } })`) en `POST /survey/responses`. Ya usa el storage de Redis (`RedisThrottlerStorage`), así que el tope es compartido entre instancias.
  - **Decisión pendiente:** token de un solo uso o Turnstile.
- **VULN-35 — hora truncada:**
  - Spec: *"La fecha de envío de una respuesta se guarda truncada a la hora."*
  - Implementación: truncar `enviadaEn` al guardar en `survey.service.ts` (`submitResponse`), más una migración que trunque las existentes.
  - **Antes:** confirmar que la serie temporal del panel (`granularidadPara`/`serieTemporal` en `metrics-aggregation.ts`) no use resolución menor a la hora, y ajustar los tests de k-anonimato que filtran por hora exacta.

### 5.7 Pendientes menores
- **Renombrar a inglés** las funciones de `competitions/bracket.ts` (`escribirCruces`, `crucesTodosContraTodos`, `avanzarLlave`, …) y `results/standings.ts`. Usar el renombre del editor (F2), que actualiza los specs, en un commit propio.
- **VULN-17:** cuando se defina la topología, exigir `MINIO_USE_SSL=true` en producción en `config.validation.ts`, o servir los documentos a través del backend.
- **VULN-28:** cuando el cliente decida qué se publica de los menores, separar la proyección pública de la de administración en `GET /competitions/:id` y en el ranking (patrón `OptionalJwtAuthGuard`, como noticias y calendario). Los IDs salen en `participantId`, `participant.id` y el `id` de cada fila del ranking, y la suite de Playwright los usa para cargar resultados.
- **Purga de `audit_logs`** (resto de VULN-27): un script `audit:purge --older-than <días>` cuando se decida la retención.
- **PDF viejo:** `documentacion/analisis-buenas-practicas.pdf` está sin versionar y se puede borrar.

---

## 6. Cerrar y abrir el PR

Todavía **no hay PR** de `dev-lucas` a `develop`. El plan original proponía uno por fase; como varias fases ya están juntas en la rama, lo práctico es:

1. **Un PR con todo lo hecho** (Fases 0 a 5).
   - Título sugerido: `refactor: fases 0–5 del refactor SOLID y mitigaciones de seguridad`.
   - En la descripción: enlace a este documento y al README, la tabla de métricas y la lista de decisiones pendientes.
2. **El PR dispara Playwright solo.** Esperar el verde antes de pedir revisión.
3. **PRs siguientes:** uno por fase (6, 7, 8) y uno aparte para dependencias (5.5).

Antes de cada commit:
- `git status`: que no quede ningún archivo nuevo afuera;
- la tabla de 1.3 en verde;
- una línea en el tracker y la fase actualizada en el README.
