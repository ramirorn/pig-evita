# Auditoría funcional — Juegos Evita Formosa

| | |
|---|---|
| **Fecha** | 2026-11-07 |
| **Commit auditado** | `56d2736` (`feat: add NewsFormDialog and NewsImageSection components for news management`), rama `dev-ramiro` |
| **Alcance** | Backend (NestJS + Prisma + PostgreSQL + Redis + MinIO), frontend (React + Vite), stack Docker |
| **Criterio** | Se revisó, se probó y se documentó. **No se corrigió ningún defecto de la aplicación**: cada comportamiento incorrecto es un hallazgo con su prueba, que sigue afirmando el comportamiento *correcto* y está marcada como falla esperada. |

Este documento sólo afirma lo que se ejecutó y se observó. Los recuentos de la sección 2 salen de las salidas finales de cada comando (pegadas en el Apéndice A).

---

## 1. Cómo correr cada suite

### 1.1 Suites existentes (no requieren Docker)

```bash
# Backend — unitarias (Jest)
cd backend && npx jest

# Backend — e2e con Prisma/MinIO simulados (incluye 3 specs nuevos de esta auditoría)
cd backend && npm run test:e2e

# Frontend
cd frontend
npm run lint
npx tsc -b
npm run build
npm run check:nav && npm run check:cards && npm run check:survey && npm run check:roster \
  && npm run check:documents && npm run check:map && npm run check:venues \
  && npm run check:pickers && npm run check:news-images
```

### 1.2 Suites nuevas contra el stack aislado (`e2e/`)

Todo corre contra un proyecto Compose **separado** (`evita-e2e`), con volúmenes, red, secretos y puertos propios. No toca `pgd-evita`, su `.env` ni sus volúmenes.

```bash
cd e2e
npm install
npx playwright install chromium

npm run stack:up        # genera e2e/.env.e2e (secretos al azar, no se commitea), construye y levanta el stack
npm run test:api        # 162 pruebas API de caja negra
npx playwright test --project=desktop   # navegador, 1280 px
npx playwright test --project=mobile    # navegador, 375 px
# (npm run test:ui corre ambos proyectos de navegador seguidos)

npm run stack:empty     # recrea el stack con la base VACÍA (SEED_ON_START=false; borra sólo los volúmenes evita-e2e_*)
npm run test:empty      # pruebas de primer arranque con base vacía (desktop + mobile)

npm run stack:down      # borra el stack aislado y sus volúmenes
```

Variables útiles: `E2E_SHOW_BUGS=1` quita la marca de "falla esperada" para ver el fallo real de cada hallazgo; `E2E_JSON=ruta.json` cambia el reporte JSON; `node scripts/summarize.mjs reporte.json` resume un reporte.

**Diseño del entorno aislado** (`e2e/docker-compose.e2e.yml`, `e2e/edge.nginx.conf`):

- Puertos propios: `18080` (nginx real del frontend), `18081` (borde de pruebas), `19100` (MinIO para los links firmados). No chocan con `5435`, `8080`, `9100`, `9101`.
- La red `interna` es `internal: true`: **el backend no tiene salida a Internet**. La sincronización de noticias jamás puede llegar a `formosa.gob.ar`; las pruebas lo verifican (el sync responde 503 "el portal no responde").
- El borde de pruebas (`18081`) reenvía `/` al nginx real y `/api/` al backend, usando el header `x-test-ip` como IP de cliente. Así cada prueba tiene su propia cuota de los límites por IP (login 5 / 15 min, lecturas públicas 20 / min, encuesta 3 / min) y los límites se pueden medir de forma determinista. Es infraestructura de pruebas: no existe en producción.
- Cuentas de prueba: el seed crea un `SUPER_ADMIN`; `e2e/lib/global-setup.ts` crea un usuario por cada uno de los 9 roles y la zona `E2E-ZONA`. Existen sólo en el stack aislado.
- Las pruebas crean datos con prefijos únicos por corrida y borran lo que pueden; `globalTeardown` cierra encuestas activas y da de baja los usuarios que crearon las pruebas. Lo demás se descarta con `stack:down`.
- `e2e/` tiene su propio `package.json` (`@playwright/test`, `typescript`, `@types/node` como `devDependencies`). **No se modificó** ninguna dependencia de `frontend/` ni de `backend/`.

---

## 2. Resumen de resultados

"Falla esperada" = hallazgo documentado: la prueba afirma el comportamiento correcto, hoy falla, y así queda reportada (`test.fail` / `it.failing`). Cuando el defecto se corrija, la suite avisará ("expected to fail, but passed") y habrá que quitar la marca.

| Suite | Total | Pasaron | Fallaron | Falla esperada (hallazgo) | Omitidas |
|---|---:|---:|---:|---:|---:|
| Backend unitarias (`npx jest`) | 166 | 166 | 0 | 0 | 0 |
| Backend e2e (`npm run test:e2e`) | 837 | 826 | **1** (`app.e2e-spec.ts`, prueba obsoleta, F-43) | 10 (`it.failing`) | 0 |
| Frontend `npm run lint` | — | 0 errores, 5 advertencias (`react/only-export-components`) | — | — | — |
| Frontend `npx tsc -b` | — | sin errores | — | — | — |
| Frontend `npm run build` | — | OK | — | — | — |
| Guards `check:nav` / `cards` / `survey` / `roster` / `documents` / `map` / `venues` / `pickers` / `news-images` | 534 / 575 / 37 / 66 / 138 / 285 / 105 / 128 / 98 chequeos | todos | 0 | 0 | 0 |
| **E2E API** (Playwright, `e2e/tests/api`) | 162 | 128 | 0 | 33 | 1 |
| **E2E navegador, escritorio 1280 px** (`e2e/tests/ui`) | 116 | 101 | 0 | 15 | 0 |
| **E2E navegador, celular 375 px** (`e2e/tests/ui`) | 116 | 100 | 0 | 16 | 0 |
| **E2E primer arranque, base vacía** (`e2e/tests/empty`, escritorio + celular) | 32 | 32 | 0 | 0 | 0 |

Línea base de las suites existentes antes de agregar nada: unitarias 166/166; e2e backend 782 pruebas, 781 pasaron y 1 falló (`test/app.e2e-spec.ts`); lint, `tsc -b`, build y los 9 guards en verde. Las suites nuevas agregaron 55 pruebas Jest e2e (3 specs) y 394 pruebas Playwright (162 API + 116 en escritorio + 116 en celular) más 32 de base vacía.

**Flakes (reportados como hallazgo de las pruebas, no de la aplicación):** la penúltima corrida completa en celular tuvo 1 fallo en `ENTRENADOR: tras iniciar sesión recibe una explicación`. Se re-ejecutó una vez y pasó; era una carrera de la propia prueba (leía la URL y un `alert` genérico antes de que el panel terminara de redirigir a la portada). Se corrigió esperando a que la pantalla se asiente y afirmando sólo el texto explicativo, se repitió 5 veces seguidas (escritorio + celular) sin variación y se volvió a correr todo: la corrida final tiene 0 fallos y 0 `flaky`. Durante el desarrollo hubo otros fallos de temporización que eran defectos de las pruebas (esperas inmediatas sobre pantallas que aún mostraban "Cargando…", selectores ambiguos, carrera al deshabilitarse el botón de zoom, límites por IP compartidos entre pruebas) y se corrigieron. Un hallazgo de proceso: dos pruebas de paginación extrema pasaban por error cuando el cliente recibía un 429 (<500) por compartir IP; al darle una IP por request quedó a la vista que el defecto F-21 afecta a los 9 listados y no a 6 (tres de ellos —competencias, sedes y noticias— quedaban enmascarados por el 429).

Distribución de hallazgos: 6 altos, 17 medios, 13 bajos y 8 observaciones (sección 4).

---

## 3. Matriz de cobertura por funcionalidad

Leyenda: **Exist.** = ya cubierto antes de la auditoría. **Nuevo** = agregado ahora. **Brecha** = lo que sigue sin cubrir.

| Funcionalidad | Exist. | Nuevo | Brecha |
|---|---|---|---|
| Auth: login, refresh rotativo, logout, cookie httpOnly | `auth-cookies`, `refresh-rotation`, `audit-*` (mocks) | `api/auth.spec` (contra el stack real: login, límite 5/15 min, refresh, reuso, logout, usuario desactivado); `ui/admin-nav` (login por formulario, sesión tras recarga, sin JWT en `localStorage`) | Vencimiento real del access token (15 min) en la UI |
| Roles y permisos (9 roles) | `action-permissions`, `territorial-scope`, `scope-sweep`; `check:nav` | `api/auth` matriz de 9 roles × 9 rutas (401/403/200); `ui/admin-nav`: por rol, menú + acceso por URL a 18 pantallas | Matriz de escritura (POST/PATCH/DELETE) completa por rol |
| Alcance territorial | `territorial-scope` (30), `scope-sweep` | `api/people`, `api/documents`, `api/admin`: DELEGADO y ADMIN_ZONAL contra la base real; `ui/admin-lists` | Caché de 60 s del mapeo zona → departamentos; ADMIN_DEPARTAMENTAL a fondo |
| Usuarios | — | `api/admin` (alta, 409, baja lógica, contraseña, roles); `ui/admin-forms`, `ui/admin-lists` | Pantalla de edición de contraseña por UI |
| Zonas | `territorial-scope` | `api/admin` (PUT/GET/DELETE, validaciones) | No existe pantalla de zonas (sólo API) |
| Participantes | `participant-dni-change` | `api/people` (alta, 409, DNI, validaciones, paginación, alcance); `ui/admin-forms` (diálogo con selector y fecha); `ui/admin-lists` | Edición desde la UI |
| Equipos | `disciplines-roster` | `api/people` (CRUD, miembros), `ui/admin-forms` (alta), `ui/journey` (3 equipos por plantel) | Detalle de equipo: alta/baja de miembros por UI |
| Disciplinas / categorías | `disciplines-roster`, `boolean-filters` | `api/admin` (CRUD, soft delete, 409, rangos), `ui/admin-forms` | — |
| Inscripciones individual + QR público | `inscriptions-public`, `inscriptions-transaction` | `api/people` (CA-B2.x, B3.x: estados, motivo de rechazo, permisos de aprobación); `ui/admin-forms` (seguimiento QR) | Descarga/visualización del QR (CA-B2.5) |
| Inscripción por plantel / borrador | `inscriptions-team-roster` (22), `check:roster` | `api/people` (11+2, atomicidad, sexo/edad, DNI repetido); `ui/journey` (3 equipos por la pantalla) | Recuperación de borrador con la UI real |
| Documentos | `upload-magic-bytes`, `minio-bucket-private`, `minio.service.spec`, `check:documents` | `api/documents` (MinIO real: subida, firma, 5 MB, link firmado descarga los bytes, bucket privado, revisión, alcance); `ui/journey` (subir, revisar, abrir) | Rechazo por UI; vencimiento de links |
| Sedes (CRUD + foto) | `venue-image`, `check:venues` | `api/content`; `ui/admin-forms` (foto desde el panel y en `/sedes`) | — |
| Competencias y fixture | `engine.factory.spec`, `competitions.service.spec` | Jest `competitions-fixture` (24); `api/competitions` (round robin 2–8, equipos, formatos); `ui/journey` (crear con selectores + fecha, generar) | Fixture de eliminación / fase de grupos (no implementado, F-14) |
| Partidos, resultados, rankings | — | Jest `results-rankings` (16); `api/competitions` (carga, ranking, permisos); `ui/journey` | Carga desde la UI (no existe, F-32) |
| Calendario | — | Jest `calendar-dates` (15); `api/content`; `ui/admin-forms` (fecha, hora, etapa, sede, edición) | — |
| Noticias (CRUD, imagen archivo/URL, sync, orden, fecha real) | `news-image`, `content-drafts`, `news.service.spec`, `formosa-news.parser.spec`, `news-sync.service.spec`, `check:news-images` | `api/content` (borrador/publicación, `publishedAt`, orden, imagen, https, sync con el portal caído); `ui/admin-forms` | **Sync real contra un portal simulado** (la URL está fija en el código; ver O-3) |
| Reportes / exportaciones | `reports-streaming`, `csv-formula-injection` | `api/admin` (CSV y XLSX reales, cabeceras, alcance, filtros inválidos); `ui/journey` (descargas) | — |
| Auditoría | `audit-*` (50) | `api/admin` (filtros, PII, rangos); `ui/admin-forms` (filtro por día, búsqueda) | — |
| Dashboard / estadísticas / mapa | `dashboard-stats`, `stats-localities`, `check:map` | `api/admin` (coherencia de totales, alcance); `ui/map` (zoom, restablecer, detalle, **pantalla completa nativa**, salida externa); `ui/admin-lists` | Pantalla completa en iPhone (modo capa) |
| Encuesta: campañas, preguntas, publicación, k-anonimato | `survey-anonimato`, `check:survey` | `api/survey` (ciclo de vida, validaciones, audiencia, límite 3/min, métricas con umbral); `ui/survey` (flujo completo, borrador, cola), `ui/admin-forms` (campaña) | Tablero de métricas por UI |
| Encuesta: cola sin conexión | `check:survey` (funciones puras) | `ui/survey`: red caída (cola + reenvío al volver) y sin conexión real (F-27) | — |
| Páginas públicas (inicio, disciplinas, noticias, calendario, sedes, rankings, competencia, mapa, encuesta, inscripción) | `check:cards` | `ui/public` (9 páginas × 2 anchos: contenido, consola, desborde), navegación, 404 | — |
| `Select` y `DatePicker` propios | `check:pickers` | `ui/admin-forms`: ningún control nativo en 20 pantallas; teclado; lista dentro del ancho del celular; texto inválido; calendario (mes, año, bisiesto); alta de participante, evento, competencia, campaña, usuario, categoría, equipo, filtro de auditoría | — |
| Navegación por rol | `check:nav` | `ui/admin-nav` (9 roles × 2 anchos) | — |
| Health | — | `api/auth` (por el borde y por el nginx real) | Redis no se reporta en `/health` |
| Seguridad HTTP / robustez | `security-headers`, `sort-whitelist`, `pagination-limits`, `swagger-production`, `public-throttle` | `api/robustness` (13 listados × 7 valores basura, paginación extrema, body inválido/gigante, whitelist, mass-assignment, 429, CORS) | — |
| Primer arranque con base vacía | — | `empty/empty-boot` (API + 10 páginas públicas + login, 2 anchos) | — |

---

## 4. Hallazgos

Orden: severidad (alta, media, baja), luego observaciones. Los ID no son correlativos: F-02, F-03, F-23 y F-25 se descartaron al verificarlos (eran hipótesis equivocadas) y F-35, F-38 y F-39 pasaron a observaciones. `[test]` indica la prueba que lo cubre; todas están marcadas como falla esperada con el ID en el mensaje (`E2E_SHOW_BUGS=1` muestra el fallo real).

### Severidad ALTA — una función del producto no se puede usar

**F-32 — No existe ninguna pantalla para cargar resultados (HU-C3)**
- *Pasos:* iniciar sesión como `ADMIN_PROVINCIAL` → `/admin/resultados` → "Cargar Resultados" → detalle de la competencia con el fixture generado.
- *Esperado:* poder cargar el marcador de cada partido (la spec HU-C3 y el título "Carga de resultados deportivos").
- *Actual:* la tarjeta del partido sólo muestra el marcador; no hay campos ni botón. La mutación `useSubmitMatchResult` está definida y no la usa ningún componente. El único camino a `PATCH /results/match/:id` es la API.
- *Evidencia:* `frontend/src/pages/admin/competition-detail/MatchCard.tsx` (todo el archivo, sólo lectura); `frontend/src/hooks/useResults.ts:27` (sin referencias); `[test]` `ui/journey › 7a`.
- *Arreglo sugerido:* agregar a `MatchCard` un diálogo de carga que arme `MatchResultPayload[]` según `resultType` de la disciplina y use `useSubmitMatchResult`.

**F-37 — "Registrar Sede" siempre falla (400)**
- *Pasos:* `/admin/sedes` → "Nueva Sede" → completar nombre, dirección, localidad → "Registrar Sede".
- *Esperado:* se crea la sede y se ofrece cargar la foto ("Sede creada").
- *Actual:* el backend responde `400 property isActive should not exist`; el formulario manda `isActive` y `CreateVenueDto` no lo declara (con `forbidNonWhitelisted`). Es imposible crear sedes desde el panel (sí se pueden editar y por API).
- *Evidencia:* `frontend/src/pages/admin/components/venue/useVenueForm.ts:78` (payload con `isActive`); `backend/src/modules/venues/dto/venues.dto.ts` (`CreateVenueDto` sin `isActive`; sólo `UpdateVenueDto` lo tiene); `[test]` `ui/admin-forms › "Registrar Sede" crea la sede…`. `check:venues` no lo detecta porque no ejercita el POST real.
- *Arreglo sugerido:* no enviar `isActive` en el alta, o agregarlo (opcional) a `CreateVenueDto`.

**F-14 — Los formatos `ELIMINACION_DIRECTA` y `FASE_GRUPOS` no están implementados, y el primero es el valor por defecto del formulario**
- *Pasos:* `/admin/competencias` → "Crear Competencia" (el formato preseleccionado es "Eliminatoria Directa") → guardar → "Generar Fixture Automático".
- *Esperado:* fixture generado, o que el formulario no ofrezca formatos inexistentes.
- *Actual:* `POST /competitions/:id/fixture` responde `501 El formato … aún no está implementado`. Quien deja el valor por defecto crea una competencia que nunca podrá tener fixture.
- *Evidencia:* `backend/src/modules/competitions/engine.factory.ts:124-129`; `frontend/src/pages/admin/components/competition/useCompetitionForm.ts:41`; `CompetitionForm.tsx:185-186`; `[test]` `api/competitions › formato ELIMINACION_DIRECTA|FASE_GRUPOS`, Jest `competitions-fixture › F-14`.
- *Arreglo sugerido:* implementar los motores, o ocultar los formatos y dejar `ROUND_ROBIN` por defecto hasta entonces.

**F-29 — Las competencias de disciplinas individuales no pueden armar fixture desde el panel**
- *Pasos:* crear una competencia de Ajedrez (individual) con 3 inscripciones aprobadas → detalle → "Generar Fixture Automático".
- *Esperado:* botón habilitado y fixture entre los participantes inscriptos (el backend lo soporta con `participantIds`).
- *Actual:* el botón queda deshabilitado (`teamCount < 2`); el panel sólo envía `teamIds`. Ajedrez y Atletismo (sembrados) no pueden competir desde la interfaz.
- *Evidencia:* `frontend/src/pages/admin/CompetitionDetailPage.tsx:59-62`; `.../FixtureSection.tsx:59`; `[test]` `ui/journey › 10.`.
- *Arreglo sugerido:* tomar los participantes con inscripción `APROBADA` de la categoría cuando la disciplina es individual y enviar `participantIds`.

**F-31 — El ÁRBITRO no puede llegar a la pantalla donde se cargarían resultados**
- *Pasos:* iniciar sesión como `ARBITRO` → "Resultados" → "Cargar Resultados".
- *Esperado:* abrir la competencia.
- *Actual:* "Acceso Denegado": el enlace va a `/admin/competencias/:id`, ruta restringida a `ADMIN_ROLES`, mientras `RESULT_LOAD` sí incluye a `ARBITRO` en el backend.
- *Evidencia:* `frontend/src/lib/adminRoutes.ts:48` (`COMPETITION_DETAIL: ADMIN_ROLES`); `frontend/src/pages/admin/ResultsPage.tsx:93`; `[test]` `ui/journey › 7b`. `check:nav` no lo detecta porque compara menú y rutas, no los enlaces internos.
- *Arreglo sugerido:* una ruta de carga de resultados propia para `RESULT_LOADERS`, o permitir el detalle (sólo lectura + carga) a `ARBITRO`.

**F-28 — La fecha de nacimiento se muestra un día antes y en formato `m/d/aaaa`**
- *Pasos:* crear un participante con nacimiento `2012-05-05` (por API o por el diálogo) → `/admin/participantes` y el detalle.
- *Esperado:* `05/05/2012`.
- *Actual:* `4/5/2012`. `new Date("2012-05-05T00:00:00.000Z")` se formatea en la zona horaria del navegador (UTC-3 en Formosa) y retrocede un día; además `toLocaleDateString()` sin parámetros no fija el formato. Es el dato con el que se valida la edad de la categoría.
- *Evidencia:* `frontend/src/pages/admin/participants/participantColumns.tsx:62`; `frontend/src/pages/admin/ParticipantDetailPage.tsx:72`; `[test]` `ui/admin-forms › la fecha de nacimiento se ve … con el día correcto`.
- *Arreglo sugerido:* formatear fechas "de calendario" con `timeZone: 'UTC'` (o tomar `birthDate.slice(0, 10)`) y `es-AR`.

### Severidad MEDIA

**F-27 — Sin conexión, el envío de la encuesta queda en "Mandando…" y nunca se encola en el teléfono**
- *Pasos:* abrir `/encuesta/responder`, responder, cortar la conexión (modo avión / `navigator.onLine = false`), "Mandar mis respuestas".
- *Esperado:* "Quedaron guardadas en este teléfono" y la respuesta en `localStorage` (cola) para reenviarse sola.
- *Actual:* TanStack Query (`networkMode: 'online'` por defecto) pausa la mutación y nunca ejecuta el `catch` que encola. Si el usuario cierra la pestaña, la respuesta se pierde. La cola sí funciona cuando la request *falla* con el navegador "en línea" (probado con la request abortada y reenvío en el evento `online`).
- *Evidencia:* `frontend/src/hooks/useSurvey.ts:81-90` (sin `networkMode: 'always'`); `frontend/src/pages/public/survey/form/useSurveyWizard.ts:273-320`; `[test]` `ui/survey › sin conexión real`.
- *Arreglo sugerido:* `networkMode: 'always'` en esa mutación, o encolar al detectar `!navigator.onLine` antes de enviar.

**F-33 — La tabla de posiciones pública muestra "undefined, undefined"**
- *Pasos:* con un partido finalizado, abrir `/competencias/:id`.
- *Esperado:* nombre del equipo/participante y número de posición.
- *Actual:* "undefined, undefined" y la columna `#` vacía: la API devuelve filas `{ id, name, played, won, lost, points }` y la página lee `entry.team?.name` / `entry.participant`.
- *Evidencia:* `frontend/src/pages/public/CompetitionPublicPage.tsx:100`; `backend/src/modules/results/results.service.ts:119-149`; `[test]` `ui/journey › 8b`.
- *Arreglo sugerido:* alinear el tipo del frontend con la respuesta (`entry.name`) y numerar las filas.

**F-34 — "Fixture y Resultados" de la página pública es un marcador de posición**
- *Esperado:* lista de partidos con marcadores.
- *Actual:* "El detalle de los cruces y resultados de cada partido estará disponible próximamente".
- *Evidencia:* `frontend/src/pages/public/CompetitionPublicPage.tsx:125`; `[test]` `ui/journey › 8c`.

**F-40 — La página pública de una competencia desborda a 375 px**
- *Actual:* `scrollWidth 425 > clientWidth 375` (scroll horizontal) por la tabla de posiciones. Sin desborde en 1280 px.
- *Evidencia:* `[test]` `ui/journey › 8a` (sólo falla en el proyecto `mobile`).

**F-01 — `GET /inscriptions?status=<inválido>` responde 500 y filtra la consulta de Prisma**
- *Pasos:* `GET /api/v1/inscriptions?status=XX` con un token de admin.
- *Esperado:* `400` con mensaje de validación.
- *Actual:* `500`; el cuerpo contiene la invocación de Prisma con las rutas internas (`/app/dist/modules/inscriptions/inscriptions.service.js:190`) y la estructura de la consulta (divulgación de información).
- *Evidencia:* `backend/src/modules/inscriptions/inscriptions.service.ts:269` (`filterDto.status as InscriptionStatus` sin validar; el DTO de filtro no usa `@IsEnum`); `[test]` `api/people › filtro de estado inválido`, `api/robustness › GET /inscriptions`.
- *Arreglo sugerido:* `@IsEnum(InscriptionStatus)` en el DTO; y no devolver `message` crudo de Prisma en 500.

**F-20 — `GET /reports/*?disciplineId=<no-UUID>` responde 500**
- *Evidencia:* `backend/src/modules/reports/reports.controller.ts:84,119` (`@Query('disciplineId')` suelto, sin DTO ni `ParseUUIDPipe`); `[test]` `api/admin › reporte con filtro inválido nunca responde 500`. *Arreglo:* validar los filtros con un DTO.

**F-21 — Un número de página enorme (`?page=99999999999999999999`) responde 500 en los 9 listados paginados**
- *Evidencia:* `backend/src/common/dto/pagination.dto.ts:23,73` (sin `@Max` en `page`; el `skip` desborda el entero de Prisma); `[test]` `api/robustness › paginación extrema` (9 casos). *Arreglo:* `@Max` razonable en `page`.

**F-22 — Un body JSON mayor a ~100 KB responde 500 "request entity too large" en vez de 413**
- *Pasos:* `POST /news` con `content` de 150 KB.
- *Evidencia:* `backend/src/common/filters/global-exception.filter.ts:53` (los errores de `body-parser` no son `HttpException` y caen en la rama 500); `[test]` `api/robustness › payload gigante`. Nota: ninguna spec existente cubre este límite. *Arreglo:* respetar `err.status` / `err.type === 'entity.too.large'` en el filtro y fijar el límite del body de forma explícita.

**F-24 — `POST /calendar` con `venueId`/`disciplineId` inválidos: 500 con detalle de Prisma; con un UUID inexistente crea el evento igual**
- *Evidencia:* `backend/src/modules/calendar/dto/calendar.dto.ts:57-70` (sin `@IsUUID`); `[test]` `api/content › venueId/disciplineId inválidos`, Jest `calendar-dates › F-24`. *Arreglo:* `@IsUUID` y verificar existencia.

**F-13 — El fixture con un participante repetido o inexistente responde 500**
- *Evidencia:* `backend/src/modules/competitions/competitions.service.ts:173-205` y `engine.factory.ts` (la generación no es transaccional y no deduplica ni valida ids); `[test]` `api/competitions › el mismo participante repetido…`, `› participante inexistente…`, Jest `competitions-fixture › F-13`. *Arreglo:* validar ids únicos/existentes y envolver el fixture en una transacción.

**F-09 — El fixture acepta cualquier participante, aprobado o no (CA-C1.3)**
- *Esperado:* sólo inscripciones `APROBADA`; *actual:* un participante sin inscripción entra al fixture (`201`).
- *Evidencia:* `competitions.service.ts:185-200`; `[test]` `api/competitions › participantes sin inscripción APROBADA…`, Jest `competitions-fixture › F-09`.

**F-10 — Cargar resultados con `[]` o con un `resultId` ajeno marca el partido FINALIZADO**
- *Evidencia:* `backend/src/modules/results/results.service.ts:38` (`continue` silencioso) y `:64` (el partido se finaliza igual); `[test]` `api/competitions › cargar resultados: id de resultado ajeno o lista vacía`, Jest `results-rankings › F-10`. *Arreglo:* 400 si no se actualizó ningún resultado propio.

**F-11 — Un resultado ya cargado puede ser sobrescrito por un ÁRBITRO (CA-C3.4)**
- *Esperado:* la corrección la hace sólo `ADMIN_PROVINCIAL` o superior y queda auditada; *actual:* el segundo `PATCH` del árbitro responde 200.
- *Evidencia:* `backend/src/modules/results/results.controller.ts:29-30` (un único `@Roles(RESULT_LOAD)` para alta y corrección); `[test]` `api/competitions › un resultado ya cargado…`, Jest `results-rankings › F-11`.

**F-12 — El ranking cuenta un empate como derrota de ambos y no usa `resultType`**
- *Evidencia:* `results.service.ts:119-149` (sólo `isWinner`; comentario "Por simplicidad en este sprint"); `[test]` `api/competitions › ranking: un empate…`, Jest `results-rankings › F-12`. *Arreglo:* tratar `isWinner = null` en ambos como empate (1 punto) y ordenar según `resultType`.

**F-19 — Un SUPER_ADMIN puede desactivarse a sí mismo (o al último administrador)**
- *Evidencia:* `backend/src/modules/users/users.service.ts:144-195` (sin guardas); `[test]` `api/admin › un usuario no puede desactivarse a sí mismo…`. *Arreglo:* rechazar la auto-baja y la baja del último `SUPER_ADMIN`.

**F-18 — `toDate=YYYY-MM-DD` se interpreta como las 00:00 y excluye todo ese día (calendario y auditoría, vía API)**
- *Evidencia:* `backend/src/modules/calendar/calendar.service.ts:56-61` y `audit/audit.service.ts:91-100`; `[test]` `api/content › filtrar por un día`, `api/admin › fromDate/toDate con sólo la fecha`, Jest `calendar-dates › F-18`. El filtro por día de la UI de auditoría **sí funciona** (manda marcas de tiempo completas), por eso el impacto hoy es sólo para clientes de la API.

**F-42 — ENTRENADOR y OPERADOR_MESA pueden crearse e iniciar sesión pero no tienen ninguna pantalla; el login los deja en la portada sin explicación**
- *Evidencia:* `frontend/src/lib/roles.ts` (no figuran en ningún grupo); `[test]` `ui/admin-nav › ENTRENADOR|OPERADOR_MESA: tras iniciar sesión recibe una explicación`. *Arreglo:* mensaje de "tu rol todavía no tiene pantallas", o no permitir crearlos hasta que existan.

### Severidad BAJA

- **F-30 — "Aprobar" se ofrece en una inscripción PENDIENTE** aunque el backend exige revisarla antes (CA-B3.1) y respondería 400. `frontend/src/pages/admin/inscription-detail/InscriptionReviewPanel.tsx:109-124`; `[test]` `ui/journey › 4b`.
- **F-15 — El calendario acepta un evento que termina antes de empezar.** `calendar.dto.ts` / `calendar.service.ts:20`; `[test]` `api/content`, Jest `calendar-dates`.
- **F-16 — Las sedes aceptan `latitude = 999` / `longitude = 999`.** `venues.dto.ts:47` (sin `@Min/@Max`); `[test]` `api/content`.
- **F-17 — El orden por título usa la collation de la base (bytewise): "Árbol" queda después de "Zeta".** `[test]` `api/content › sortBy=title ordena en español`.
- **F-04 — La API no expone `age` en el participante (CA-B1.4).** `[test]` `api/people › la edad se calcula…` (la UI la calcula del lado del cliente).
- **F-05 — Un DELEGADO que cambia el DNI recibe 400 en vez de 403.** `backend/src/modules/participants/participants.service.ts:277` (lanza `BadRequestException`); `[test]` `api/people`.
- **F-06 / F-07 — Un motivo de rechazo con sólo espacios se acepta** (inscripción: `RejectInscriptionDto.rejectionNote`, `inscriptions.dto.ts:365`, sólo `@IsNotEmpty`; documento: `documents.service.ts:120`, `!reviewDto.notes` no recorta espacios). `[test]` `api/people`, `api/documents`.
- **F-08 — `PATCH /documents/:id/review` acepta `status = PENDIENTE`** aunque el contrato declara sólo `APROBADO | RECHAZADO` (`documents.dto.ts:51`). `[test]` `api/documents`.
- **F-26 — Cada visita anónima intenta `POST /auth/refresh` y deja "401 Unauthorized" en la consola.** `[test]` `ui/public › un visitante anónimo no genera errores 401`.
- **F-36 — Botones de sólo ícono sin nombre accesible** (el menú "⋮" de cada evento del calendario, 3–4 por pantalla) **y dos `<h1>` por pantalla del panel** ("Panel de Administración" + el título). `frontend/src/pages/admin/calendar/CalendarEventRow.tsx:104`; `[test]` `ui/admin-lists › accesibilidad básica` (2 pruebas).
- **F-41 — El detalle del participante dice "El módulo de documentos se encuentra en construcción"** aunque el módulo existe en `/admin/documentos`. `ParticipantDetailPage.tsx`; `[test]` `ui/admin-lists`.
- **F-43 — `backend/test/app.e2e-spec.ts` es la prueba plantilla de Nest** (espera `GET /` = "Hello World!"); falla con 404 desde siempre. Es el único rojo del e2e del backend. Borrarla o reescribirla como prueba de arranque.

### Observaciones (no son fallos de una prueba; riesgos o limitaciones)

- **O-1 — Los endpoints "públicos" comparten límite de 20 lecturas/min por IP incluso con sesión iniciada**, y las pantallas del panel los usan (disciplinas, categorías, sedes, noticias, competencias, calendario). Con `trust proxy = 1` y varios usuarios detrás de una misma salida a Internet (oficina, escuela, CGNAT móvil), el panel podría recibir 429. Recorrer las 16 pantallas del panel en un minuto produjo 52 requests y 0 respuestas 429; el riesgo aparece con varios usuarios simultáneos. El cliente de API de las pruebas llegó a recibir 429 por lecturas repetidas hasta que se le dio una IP por request.
- **O-2 — La encuesta admite 3 envíos/min por IP.** En una cancha con datos móviles (IP compartida) la cuarta persona del minuto recibe "Esperá un minuto". Es una decisión de diseño documentada; conviene medir el impacto en el evento.
- **O-3 — La URL del portal (`https://www.formosa.gob.ar`) está fija en el código** (`news/sync/formosa-news.parser.ts:28`). No se puede apuntar el sync a un portal simulado, así que el flujo completo del sync no es verificable de punta a punta sin salir a Internet. Sí está cubierto con fixtures reales en `formosa-news.parser.spec.ts` y `news-sync.service.spec.ts`, y la ruta de error (portal caído → 503, no inventa "0 noticias") se probó en el stack aislado.
- **O-4 — Con `SEED_ON_START=false` la base queda sin ningún usuario y no hay forma de crear el primer administrador** (no existe un endpoint de alta inicial; sólo la seed). Además el entrypoint imprime "La base ya tiene datos: se omite la seed" cuando en realidad la seed está deshabilitada y la base está vacía (`backend/docker/entrypoint.local.sh`).
- **O-5 — Al iniciar, Nest advierte `Unsupported route path: "/api/v1/*"`** (path-to-regexp nuevo). Funciona por la conversión automática; conviene migrar a `/api/v1/{*path}`.
- **O-6 — El login admite 5 intentos / 15 min por IP.** Detrás de una IP compartida, 5 intentos fallidos de cualquier usuario bloquean el login de toda la oficina.
- **O-7 — `GET /documents/participant/:id` devuelve `fileKey` (clave interna del objeto en MinIO)** a los roles autorizados. No es una fuga hacia roles sin permiso; se anota por higiene.
- **O-8 — La spec dice que el rechazo lleva `reason`; la API usa `rejectionNote`.** `documentacion/spec.md` (CA-B3.3) está desactualizada.

---

## 5. Qué NO se pudo probar y por qué

- **Sincronización de noticias contra un portal simulado:** la URL del portal está fija en el código (O-3). Se probó la ruta de error con el stack sin salida a Internet; nunca se contactó `formosa.gob.ar`.
- **Pantalla completa en iPhone/Safari (modo "capa"):** sólo hay Chromium. Se verificó la Fullscreen API nativa (entrar, usar el zoom adentro, salir por botón y por salida externa); el modo capa lo cubre únicamente `check:map` con funciones puras.
- **Otros navegadores y dispositivos reales:** Firefox, WebKit y teléfonos físicos. El "celular" es Chromium con viewport de 375 px, agente Android y táctil emulados.
- **Producción:** no se probó `backend/docker/Dockerfile` ni el nginx de producción, HTTPS, cookies `Secure`, HSTS ni la validación de CORS de producción (el stack local corre con `NODE_ENV=development`, igual que `docker-compose.yml`).
- **Vencimiento de tokens y de links firmados** (access 15 min, refresh 7 días, links de MinIO 1 h): no se esperó el tiempo real.
- **Carga y rendimiento:** no se hicieron pruebas de volumen ni de concurrencia más allá de los límites por IP.
- **Redis:** `/health` sólo informa la base; ninguna prueba ejercita Redis de forma directa.
- **Flujos de UI sin cubrir:** rechazo de inscripciones y de documentos por la interfaz, edición de participantes y equipos, descarga/visualización del QR (CA-B2.5), tablero de métricas de la encuesta, zonas (no tienen pantalla) y cambio de contraseña desde la UI.
- **Los scripts del repo que tocan el stack real** (`npm run setup`, `db:demo`, `db:demo:reset`) **no se ejecutaron**, a propósito.
- **Accesibilidad:** sólo hay comprobaciones puntuales (nombres de botones, `<h1>`, teclado en `Select`); no se corrió una auditoría completa.

---

## 6. Archivos agregados

- `backend/test/results-rankings.e2e-spec.ts`, `backend/test/competitions-fixture.e2e-spec.ts`, `backend/test/calendar-dates.e2e-spec.ts` (Jest e2e, mismo molde que los existentes; los defectos conocidos usan `it.failing`).
- `e2e/` (carpeta nueva y autónoma): `package.json`, `package-lock.json`, `playwright.config.ts`, `tsconfig.json`, `.gitignore`, `docker-compose.e2e.yml`, `edge.nginx.conf`, `lib/` (`api.ts`, `bugs.ts`, `env.ts`, `ui.ts`, `global-setup.ts`, `global-teardown.ts`), `scripts/` (`gen-env.mjs`, `stack-empty.mjs`, `run-empty.mjs`, `summarize.mjs`) y `tests/` (`api/`: auth, people, documents, competitions, content, admin, survey, robustness; `ui/`: public, map, survey, admin-nav, admin-forms, admin-lists, journey; `empty/`: empty-boot).
- Este documento.

No se modificó código de la aplicación ni dependencias de `frontend/` o `backend/`. No se hizo commit ni push.

---

## Apéndice A — Salidas finales de los comandos

Corridas finales sobre un stack aislado recién creado (`down -v` + `up`), en este orden: API, escritorio, celular. Los resúmenes salen de `node scripts/summarize.mjs` sobre el reporte JSON de Playwright y de la línea final del listado de cada comando.

```text
$ cd backend && npx jest
Test Suites: 8 passed, 8 total
Tests:       166 passed, 166 total

$ cd backend && npm run test:e2e
Test Suites: 1 failed, 37 passed, 38 total
Tests:       1 failed, 836 passed, 837 total        # el fallo: test/app.e2e-spec.ts (F-43); 10 de los 836 son it.failing (hallazgos)

$ cd frontend && npm run lint      -> 0 errores, 5 advertencias
$ cd frontend && npx tsc -b        -> sin salida (OK)
$ cd frontend && npm run build     -> "built" (OK)
$ npm run check:nav         -> Chequeos ejecutados: 534   OK
$ npm run check:cards       -> Chequeos ejecutados: 575   OK
$ npm run check:survey      -> Chequeos ejecutados: 37    OK
$ npm run check:roster      -> Chequeos ejecutados: 66    OK
$ npm run check:documents   -> Chequeos ejecutados: 138   OK
$ npm run check:map         -> Chequeos ejecutados: 285   OK
$ npm run check:venues      -> Chequeos ejecutados: 105   OK
$ npm run check:pickers     -> Chequeos ejecutados: 128   OK
$ npm run check:news-images -> Chequeos ejecutados: 98    OK

$ cd e2e && npx playwright test --project=api
  1 skipped
  161 passed (31.8s)
  resumen: {"total":162,"passed":128,"failed":0,"expectedFail":33,"skipped":1,"flaky":0}

$ cd e2e && npx playwright test --project=desktop
  116 passed (6.9m)
  resumen: {"total":116,"passed":101,"failed":0,"expectedFail":15,"skipped":0,"flaky":0}

$ cd e2e && npx playwright test --project=mobile
  116 passed (6.7m)
  resumen: {"total":116,"passed":100,"failed":0,"expectedFail":16,"skipped":0,"flaky":0}

$ cd e2e && npm run stack:empty && npm run test:empty        # base vacía, escritorio + celular
  32 passed (34.4s)
  resumen: {"total":32,"passed":32,"failed":0,"expectedFail":0,"skipped":0,"flaky":0}
```

Nota sobre la lectura de "passed": Playwright cuenta una falla esperada como "passed" en su línea final (por eso 161 = 128 + 33); la distinción entre pasadas y fallas esperadas está en los resúmenes. La única prueba omitida de la suite API es `una noticia importada del portal no se edita ni se borra desde la API`: el stack aislado no tiene noticias del portal (el sync está deshabilitado y sin salida a Internet).

Hallazgos con falla esperada por suite (cantidad de pruebas): API — F-01 ×2, F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-11, F-12, F-13 ×2, F-14 ×2, F-15, F-16, F-17, F-18 ×2, F-19, F-20, F-21 ×9, F-22, F-24; navegador (escritorio) — F-26, F-27, F-28, F-29, F-30, F-31, F-32, F-33, F-34, F-36 ×2, F-37, F-41, F-42 ×2; celular — los mismos más F-40; Jest e2e — F-09, F-10, F-11, F-12, F-13, F-14 ×2, F-15, F-18, F-24.
