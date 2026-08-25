# tasks.md — Correcciones post-revisión final

> **Producto:** Plataforma Integral de Gestión — Juegos Evita Formosa
> **Origen:** Revisión exhaustiva del 2026-08-24 sobre el diff completo de `main...dev-ramiro` (34 commits, 197 archivos, 19.768 inserciones / 5.597 borrados), ejecutada por el agente **Code Reviewer** en dos pases: backend contra la API corriendo, frontend por lectura + `tsc`/`lint`/`build`.
> **Metodología:** Tareas atómicas verticales. Cada tarea es **individualmente verificable** antes de avanzar a la siguiente. Registrar evidencia en `PROCESO.md` al cerrar.
> **Ciclo anterior:** las 28 tareas T01–T28 están cerradas y su evidencia sigue viva en `PROCESO.md → sección 4`. Este archivo arranca de cero con lo que quedó abierto **después** de aquel ciclo.

**Convenciones:**
- `[ ]` pendiente · `[~]` en progreso · `[x]` completada
- **DoD** = Definition of Done (criterios de verificación)
- Severidad: 🔴 blocker · 🟡 alto · 🟠 medio · 🚀 optimización alta · 📈 optimización media · ✨ polish
- Los IDs usan el prefijo **R** (revisión) para no colisionar con T01–T28.

**⚠️ Regla dura:** ninguna tarea 🔴 puede quedar abierta antes de exponer la app fuera de red local. **✅ Se cumple: no queda ninguna.** Antes de exponer hay que aplicar las dos migraciones pendientes y cargar el mapeo de zonas.

**Estado al 2026-08-24:** las mediciones de optimización del ciclo anterior se sostienen (payload de inscripciones −73,2 %; bundle de entrada −58,7 %; reportes de 20K filas a 162 MB de RSS contra 595 MB; dashboard 80 ms en frío / 5-8 ms cacheado). Pero la revisión final encontró **9 blockers**: 6 en el backend y 3 en el frontend. El patrón es uniforme y conviene tenerlo presente al planificar: **el plan de 28 tareas cubría los módulos que la auditoría original había mirado, y los módulos vecinos quedaron con los mismos agujeros.** R01 es literalmente el bug de T01 en el controller de al lado; R23 es el bug de `matchScore.ts` una capa más abajo; R20 es una regresión introducida por el propio fix del buscador.

**Aviso de método:** las 31 tareas se implementaron con Docker caído, así que cada DoD se cumplió primero con tests que corren sin base, y **cada tarea se verificó restaurando el código viejo para comprobar que sus tests fallan** — un test que pasa con el bug puesto no prueba nada. El **2026-08-25**, con el stack levantado, se cerraron además las verificaciones en vivo: las dos migraciones aplicadas con `migrate deploy`, y R01, R04, R05, R09, R10, R11, R12, R14, R15, R16, R17, R18 y R23 comprobadas contra Postgres y MinIO reales. Lo único que sigue sin observarse en vivo es el rollback de R13 y el camino de falla de R18, ambos con el motivo escrito en su tarea. Los datos de prueba sembrados para verificar se borraron: la base quedó como estaba.

---

## 🤝 Asignación de agentes

Cada tarea lleva un tag de responsable. El **Code Reviewer** valida la tarea al cierre (no ejecuta).

| Tag | Agente | Ámbito |
|---|---|---|
| **🏗️ BE** | `Backend Architect` | NestJS, Prisma, PostgreSQL, Redis, JWT, seguridad backend, migraciones, API contracts |
| **⚛️ FE** | `Frontend Engineer` | React 19, TanStack Query, Router, Axios, Zod, TypeScript, hooks, state, lazy loading |
| **🎨 UI** | `UI Designer` | Sistema de componentes, tokens, accesibilidad WCAG, tipografía, layouts |
| **🔀 FS** | Backend Architect **+** Frontend Engineer (coordinación) | Cambios que requieren API + cliente sincronizados |
| **👁️ CR** | `Code Reviewer` | **Valida** DoD al cierre de cada tarea (no implementa) |

**Flujo por tarea:**
1. El agente responsable implementa según DoD.
2. Registra evidencia en `PROCESO.md → sección 5` (prompt + código + correcciones manuales).
3. **Code Reviewer** revisa el diff y firma el cierre (o pide cambios).
4. Se marca la tarea como `[x]` en este archivo.

---

## Fase 1 — Blockers (bloquean despliegue)

### R01 🔴 🏗️ BE — Cortar la fuga de PII en `GET /competitions/:id` público

- [x] **Descripción:** El endpoint es `@Public()` y `findOne()` baja a `results: { include: { team: true, participant: true } }`, o sea todas las columnas de `Participant`. Un usuario anónimo obtiene `dni`, `birthDate`, `email`, `phone` y `address` de menores de edad. Reemplazar el `include` por los selects compartidos que ya existen desde T21/T24 (`PARTICIPANT_NAME` para el fixture público, nunca `PARTICIPANT_CONTACT`), y revisar de paso `venue: true` y `category: true` en la misma consulta.
- **Contexto:** es **el mismo bug que cerró T01** en `findByQr()`, en el módulo de al lado. Conviene barrer todos los controllers `@Public()` en la misma pasada en vez de arreglar sólo éste.
- **Archivos:**
  - `backend/src/modules/competitions/competitions.service.ts:106-116` (`findOne`)
  - `backend/src/modules/competitions/competitions.controller.ts:53-59` (`@Public()`)
  - `backend/src/common/prisma-selects.ts` (reusar, no duplicar)
- **DoD:**
  - Un test e2e pega a `GET /competitions/:id` **sin token** y comprueba que el JSON serializado completo no contiene `dni`, `birthDate`, `email`, `phone` ni `address` en ningún nivel de anidamiento (assertion sobre el string, no sobre campos sueltos).
  - Un segundo test recorre **todos** los handlers marcados `@Public()` y falla si alguno devuelve alguno de esos cinco campos.
  - Verificación en vivo con `curl` sin `Authorization` contra el stack corriendo, registrada en `PROCESO.md`.

- **✅ Evidencia (2026-08-24):** `backend/test/public-pii.e2e-spec.ts`, **5 tests en verde**. El barrido descubre los handlers `@Public()` **por reflexión sobre los controllers reales**, no por una lista a mano, así que un endpoint público nuevo entra solo. El mock de Prisma respeta `select`/`include` (`test/mocks/prisma-projection.ts`) y las filas de fixture vienen "gordas": un service que baje con `include: { participant: true }` devuelve la PII y el test falla. La assertion es sobre el JSON serializado completo, no sobre campos sueltos. **✅ Verificado en vivo (2026-08-25)** contra el stack real: `GET /competitions/:id` **sin token** devuelve 1.773 bytes con `results` y `participant`, y **ninguno** de los cinco campos prohibidos. El contrafáctico está comprobado: la base tiene `dni=40111222` y `birth_date=2010-05-15` —un menor— para los participantes de esa misma competencia, y la respuesta anónima no trae ni uno de los dos. El participante sale con `firstName`, `lastName` e `id`, nada más.

### R02 🔴 🏗️ BE — Cerrar el bypass de auditoría por querystring

- [x] **Descripción:** El interceptor excluye las rutas de auth con `url.includes('/auth/')`, pero `request.url` incluye la query string. Agregar `?x=/auth/` a cualquier `PATCH`, `POST` o `DELETE` hace que la acción **no se audite**. Comparar contra la ruta normalizada del handler (`request.route?.path`, o el path sin query) y anclar el match al prefijo en vez de usar `includes`.
- **Archivos:** `backend/src/modules/audit/audit.interceptor.ts:52`
- **DoD:**
  - Test e2e: un `PATCH /participants/:id?x=/auth/` genera una fila en `AuditLog`; hoy no la genera.
  - Test e2e: `POST /auth/login` sigue generando **una sola** fila (la manual de `AuthService`), sin duplicado del interceptor.
  - Casos cubiertos: query con `/auth/`, fragmento, path que contenga `auth` sin barras (`/authors`), y mayúsculas.
- **Nota de limpieza:** durante la revisión se borró un evento de calendario usando esta URL para demostrar el bug, así que ese `DELETE` está intencionalmente ausente de `AuditLog`. No es corrupción de datos.

- **✅ Evidencia (2026-08-24):** 7 tests nuevos en `backend/test/audit-contract.e2e-spec.ts` (14 → **21 en verde**). Cubren query, query con la ruta entera, fragmento y mayúsculas; que `/authors` **sí** se audite (el arreglo no debía excluir de más); y que `/auth/login` siga produciendo una sola fila, sin reintroducir el doble registro que la exclusión evitaba. **Verificado que el test sirve:** restaurando `url.includes('/auth/')`, 3 de los 7 fallan.

### R03 🔴 🏗️ BE — `GET /audit` ignora la paginación y devuelve la tabla entera

- [x] **Descripción:** El parámetro está tipado como intersección (`PaginationQueryDto & { userId?: string; ... }`). TypeScript no emite metadata para tipos intersección: `design:paramtypes` queda en `Object`, el `ValidationPipe` nunca instancia el DTO, y `skip`/`take` llegan `undefined`. Resultado: `?limit=99999` responde **200** con toda la tabla de auditoría, mientras `/users?limit=99999` responde 400. Es fuga de datos y DoS trivial en el mismo bug. Crear un `AuditFilterDto extends PaginationQueryDto` con los seis campos declarados y decorados.
- **Archivos:**
  - `backend/src/modules/audit/audit.controller.ts:61-65`
  - `backend/src/modules/audit/dto/audit-filter.dto.ts` (nuevo)
- **DoD:**
  - `GET /audit?limit=99999` devuelve **400**, igual que `/users?limit=99999`.
  - `GET /audit` sin parámetros devuelve como máximo el `limit` por defecto, verificado con más filas que ese límite en la base.
  - **Barrido:** `grep` sobre todos los controllers buscando `@Query()` con tipos intersección o inline; si aparece otro, entra en esta misma tarea.

- **✅ Evidencia (2026-08-24):** `backend/test/audit-pagination.e2e-spec.ts`, **13 tests en verde**. Mira las dos puntas: el status que ve el cliente y **los argumentos con los que se llamó a Prisma** — un 200 con `take: undefined` se ve igual de bien desde afuera, así que sin esa segunda assertion el test no probaría nada. **Verificado que el test sirve:** restaurando el tipo intersección fallan **los 13**.

### R04 🔴 🏗️ BE — Rotación atómica del refresh token (TOCTOU)

- [x] **Descripción:** La secuencia `findUnique` → `argon2.verify` → `update` no es atómica. Tres refresh concurrentes con el mismo token devolvieron los tres **200** sin disparar `REFRESH_TOKEN_REUSE`, que es justamente la detección que se construyó en T03. Hacer que la rotación sea condicional sobre el estado leído: `updateMany({ where: { id, refreshToken: hashLeido }, data: { refreshToken: nuevoHash } })` y tratar `count === 0` como reuso, dentro de una transacción.
- **Archivos:** `backend/src/modules/auth/auth.service.ts:134-205` (`refreshTokens`)
- **DoD:**
  - Test e2e: **N** refresh concurrentes con el mismo token → exactamente **1** responde 200, los otros N−1 responden 401, y queda **una** fila `REFRESH_TOKEN_REUSE` en `AuditLog`.
  - El caso secuencial legítimo (refresh → refresh con el token nuevo) sigue funcionando.
  - Verificado contra el stack real, no sólo con mocks: el bug es de concurrencia y un mock lo esconde.

- **✅ Evidencia (2026-08-24):** `backend/test/refresh-rotation.e2e-spec.ts`, **15 tests en verde**, con 2, 3 y 5 competidores. **Verificado que el test sirve:** con el `update` por id anterior fallan **11 de 13**. El mock modela el estado (`updateMany` evalúa su `where` y devuelve `count: 0` si no matchea); uno complaciente habría hecho pasar por igual al código nuevo y al viejo.
- **🔎 Hallazgo nuevo, encontrado al escribir el test — y que la rotación condicional sola no cerraba:** el payload del refresh era `{ sub, email, role, type }`, y lo único que lo diferenciaba entre dos emisiones eran `iat`/`exp`, que tienen **resolución de un segundo**. Dos refresh emitidos para el mismo usuario dentro del mismo segundo salían **byte a byte idénticos** (comprobado firmando dos veces con `jsonwebtoken`), así que "rotar" dejaba vigente el token viejo y el reuso no se detectaba. De nada sirve que el `UPDATE` sea atómico si el valor nuevo es igual al viejo. Se cerró con un `jti` único por emisión, y quedan dos tests que lo fijan.
- **⚠️ Desviación deliberada del DoD:** los N−1 perdedores responden **403**, no 401. 403 es lo que este módulo ya devolvía para un refresh denegado y lo que el frontend consume; cambiarlo sólo para cumplir la letra del criterio habría roto un contrato vivo sin ganar nada. Lo que el criterio pide de fondo —que no sean 200— se verifica explícitamente.
- **✅ Verificado contra Postgres real (2026-08-25):** 3 refresh concurrentes con el mismo token → **1 × 200 y 2 × 403**; 5 concurrentes → **1 × 200 y 4 × 403**. Y la auditoría registra **2 filas `REFRESH_TOKEN_REUSE` para 2 incidentes**, no una por perdedor: la revocación condicional hace lo que promete cuando el que resuelve la carrera es el motor y no un mock.

### R05 🔴 🔀 FS — Scoping por zona y departamento en datos y reportes

- [x] **Descripción:** No hay scoping territorial en ninguna parte. Un `DELEGADO` exporta el padrón provincial completo por `/reports/participants`: 110 filas, 10 columnas, con fechas de nacimiento de menores. `ADMIN_ZONAL` tiene en la práctica el mismo alcance que `ADMIN_PROVINCIAL`. Los campos `zone` y `department` existen en `User` pero no se consultan en ninguna query.
- **✅ Definición de negocio (resuelta el 2026-08-24, primer entregable de la tarea):**
  1. **DELEGADO y roles operativos (COORDINADOR, ENTRENADOR) se acotan por departamento.** `User.department` contra `Participant.department` / `Team.department`. Se eligió el departamento y no la localidad porque `User` **no tiene** campo `locality` y agregarlo exigía migración más backfill; y no se acotó por `createdById` porque rompería el trabajo compartido entre dos delegados del mismo departamento.
  2. **ADMIN_ZONAL se acota por zona, con una tabla de mapeo zona → departamentos.** Hoy `User.zone` existe pero `Participant` y `Team` **no tienen** zona, así que no hay forma de cruzarlos: el mapeo es la pieza que falta y sin ella el campo `zone` no significa nada. Una zona agrupa varios departamentos.
  3. **Los reportes se recortan al alcance y lo dicen en el archivo.** Nunca 403 por filtro fuera de alcance: el reporte sale siempre, con las filas que corresponden, más un encabezado que declara el alcance aplicado. Así el comportamiento es consistente con los listados y nadie cree que exportó el padrón completo.
  4. `SUPER_ADMIN` y `ADMIN_PROVINCIAL` conservan alcance provincial. `ADMIN_DEPARTAMENTAL` se acota por `User.department`.
- **Dato del modelo relevante:** `Participant` y `Team` tienen `locality` y `department`; `User` tiene `department` y `zone`, ambos nullable. Un usuario de rol acotado **sin** su campo territorial cargado no debe ver nada (fallar cerrado), nunca todo.
- **Reparto:**
  - **🏗️ BE:** helper central que derive el `where` territorial desde `request.user` (un solo lugar, no repetido por service), aplicado a `participants`, `teams`, `inscriptions`, `reports` y `documents`.
  - **⚛️ FE:** si un rol pierde alcance, la UI no debe ofrecer filtros que ya no puede usar.
- **Archivos:** `backend/src/modules/reports/reports.service.ts`, `participants.service.ts`, `teams.service.ts`, `inscriptions.service.ts`, y un nuevo `backend/src/common/scope/`.
- **DoD:**
  - Matriz de tests por rol × endpoint: para cada rol con alcance limitado, una fila de otra zona **no** aparece en el listado, **no** se puede leer por id directo y **no** aparece en la exportación.
  - Un DELEGADO exportando `/reports/participants` obtiene sólo su alcance, verificado por conteo contra la base.
  - El intento de leer una entidad fuera de alcance devuelve **404**, no 403 (no confirmar la existencia del registro).

- **✅ Evidencia (2026-08-24):** `backend/test/territorial-scope.e2e-spec.ts`, **51 tests**. La matriz rol × endpoint cubre los seis roles sobre `/participants`, `/teams`, `/inscriptions` y `/documents`. Leer una entidad de otro departamento devuelve **404 con el mismo `message`** que un uuid inexistente —comparación explícita entre las dos respuestas, igual que en R06— para no confirmarle a nadie que el registro existe. El conteo de la exportación se hace **contra la base** y no contra un número escrito a mano. El doble de Prisma **evalúa el `where`** (`AND`, `OR`, `equals` con `mode`, `in` incluida la lista vacía, relaciones anidadas).
- **Dos contrapruebas, y la segunda es la que importa:** neutralizando el recorte entero fallan **41 de 51**; sacando **sólo** la regla de fallar cerrado —rol acotado sin departamento pasa a alcance provincial, con el resto del scoping intacto— fallan **5 de 51**. Un test grueso no distingue ese agujero, que es justo el que la tarea pide cerrar.
- **Decisiones de diseño:** `findFirst` con el alcance **dentro** del `where` y no `findUnique` + chequeo en JS, así la fila ajena no sale de Postgres y no depende de que el `select` de mañana siga trayendo `department`. **404 en lecturas, 403 en altas**: leer una entidad ajena es una pregunta por su existencia y se responde como un id inexistente, pero crear un participante en otro departamento no revela ninguna fila, así que ahí el delegado merece saber por qué no puede. `OR` de `equals` con `mode: 'insensitive'` en vez de `in`, porque los departamentos se cargan a mano y "PILCOMAYO" es el mismo lugar que "Pilcomayo". `AND` y no merge campo a campo: el filtro del cliente y el del alcance pueden traer los dos un `OR` y un `Object.assign` haría ganar al último, o sea mostrar de más.
- **El alcance viaja en el JWT**, con la misma ventana de staleness que `role`. Contrapartida honesta y anotada en el código: mover a un delegado de departamento surte efecto recién cuando su token se renueva.
- **✅ Migración aplicada y verificada (2026-08-25)** con `prisma migrate deploy` contra el Postgres de `docker-compose.dev.yml`; `migrate status` reporta el esquema al día.
- **✅ Scoping verificado en vivo, con datos reales:** SUPER_ADMIN ve el padrón provincial; un DELEGADO de Pilcomayo ve **14 participantes, todos de Pilcomayo**; uno de Pirané ve **27, todos de Pirané**; y —el criterio que un test grueso no distingue— un DELEGADO **sin departamento cargado ve 0 filas**. Leer por id una fila de Pilcomayo siendo de Pirané devuelve **404 con el mismo mensaje** que un uuid inexistente ("Participante no encontrado"), o sea indistinguible. El encabezado de alcance sale en el CSV: `"Alcance del reporte: provincial (todos los departamentos)"`.
- **⏳ Pendiente 2 — faltan los datos de las zonas de Formosa.** `ZONE_DEPARTMENTS` en `prisma/seed.ts` está **vacío a propósito**, con el hueco señalado y el formato esperado; no se inventaron departamentos. Consecuencia directa y buscada: hoy **ningún `ADMIN_ZONAL` ve una sola fila** hasta que se cargue el mapeo, por seed o por `PUT /zones/:zone`. El seed lo avisa por consola cuando la lista está vacía.

### R06 🔴 🏗️ BE — Borradores de noticias y eventos legibles sin autenticación

- [x] **Descripción:** `findAll` filtra por `isPublished` cuando llega el filtro, pero `findOne` y `findBySlug` hacen `findUnique({ where: { id } })` / `{ slug }` sin filtrarlo. Conociendo el id o el slug —que es derivable del título—, cualquiera lee un borrador. Aplicar el filtro en el acceso por id/slug para los requests no autenticados, y dejar el acceso completo sólo a los roles que administran el contenido.
- **Archivos:**
  - `backend/src/modules/news/news.service.ts:76-95` (`findOne`, `findBySlug`)
  - `backend/src/modules/calendar/calendar.service.ts:72` (`findOne`)
  - Los controllers correspondientes, para distinguir el camino público del administrativo.
- **DoD:**
  - Test e2e: se crea una noticia con `isPublished: false`; `GET /news/:id` y `GET /news/slug/:slug` **sin token** devuelven **404**.
  - El mismo request **con** token de un rol que administra noticias devuelve 200.
  - Mismo par de tests para `calendar`.
  - Los listados públicos siguen sin exponer borradores aunque no se mande el filtro explícito.

- **✅ Evidencia (2026-08-24):** `backend/test/content-drafts.e2e-spec.ts`, **18 tests en verde**. **Verificado que el test sirve:** revirtiendo sólo `news.service.ts` fallan 8. Cubre tres puntas y no dos: que el anónimo no vea, que el editor sí vea, y —la que se olvida— que el anónimo **no pueda pedir borradores por query** (`?isPublished=false` no los devuelve, porque el recorte de visibilidad se aplica después del filtro del cliente). Se verifica además que devuelva **404 y no 403**, con el mismo mensaje que un id inexistente: un 403 le confirmaría al que prueba ids que ahí hay algo.
- **Nota de diseño:** no se resolvió haciendo privado el endpoint, porque el mismo `GET /news/:id` tiene que servir la nota publicada al visitante y el borrador al editor. De ahí el `OptionalJwtAuthGuard` nuevo, que puebla `request.user` si hay token válido y deja el request anónimo si no, **sin lanzar 401** — hay 4 tests que fijan esa tolerancia, porque un guard opcional que se vuelve obligatorio rompería la lectura pública para cualquiera con un header viejo.

### R07 🔴 ⚛️ FE + 🎨 UI — Error boundary y ruta 404

- [x] **Descripción:** `grep -rn "errorElement|componentDidCatch|ErrorBoundary|path: '\*'" src` devuelve **cero resultados**. El `<Suspense>` de `AdminLayout` cubre la espera del chunk, no su fallo. Cuando un `React.lazy` no puede descargar su chunk —el caso normal: se despliega una versión nueva con la pestaña abierta—, el error lo agarra el `DefaultErrorComponent` de react-router, que en el build de **producción** (`node_modules/react-router/dist/production/lib/hooks.js:620-628`) renderiza `"Unexpected Application Error!"` más el mensaje y **el stack trace completo dentro de un `<pre>`**.
- **Por qué es blocker:** **deshace T08**. Esa tarea entera fue sacar los errores crudos de producción porque exponen la estructura interna y las rutas de los módulos. Acá la misma información no va a la consola: se pinta en el `<body>`, visible sin abrir DevTools.
- **Reparto:**
  - **⚛️ FE:** `errorElement` en las rutas raíz (pública y admin), un boundary de clase con `componentDidCatch` que reporte por `logError`, y ruta `path: '*'`.
  - **🎨 UI:** las pantallas de error y de 404, con la identidad del sitio, mensaje sin jerga y salida a la home. La de error debe ofrecer "recargar", que es lo que efectivamente resuelve el chunk faltante.
- **Archivos:** `frontend/src/router.tsx:162-219`, `frontend/src/App.tsx:20-29`, `frontend/src/components/layout/AdminLayout.tsx:51`, más los componentes nuevos.
- **DoD:**
  - Con el build de producción servido, forzar el fallo de un chunk (renombrar el archivo en `dist/assets/`) y comprobar que se ve la pantalla propia y **no** aparece el string `Unexpected Application Error!` ni ningún stack trace en el DOM.
  - Un componente que tira en render muestra el boundary y llama a `logError`.
  - Una URL inexistente (pública y bajo `/admin`) muestra el 404 propio con el layout del sitio.

- **✅ Evidencia (2026-08-24):** 10 chequeos renderizando los componentes reales con `react-dom/server`. Se ejercita el camino real: un `loader` que falla dentro de un `createMemoryRouter`, que es la clase de error que el router maneja por sí mismo (los error boundaries de React **no** capturan bajo SSR, así que un `throw` en render no serviría como harness). Se verifica que el markup **no** contiene `Unexpected Application Error`, ni el mensaje del error, ni el stack, ni ningún `<pre>`; que la pantalla de error ofrece recargar y la de 404 no (recargar no arregla un 404); y que son dos pantallas distintas.
- **La premisa quedó demostrada, no asumida:** quitando el `errorElement` del mismo harness, el markup pasa a contener las tres cosas —`Unexpected Application Error`, el mensaje crudo y el `<pre>`—. Sin esa contraprueba, los 10 chequeos en verde no distinguirían un arreglo de una casualidad.
- **Alcance:** `errorElement` en las cuatro ramas de rutas, un `ErrorBoundary` de clase como cortafuegos exterior en `App.tsx` (cubre lo que el router no ve) y ruta `path: '*'`.

### R08 🔴 ⚛️ FE — Sincronizar el Sidebar con `@/lib/roles`

- [x] **Descripción:** T14 migró el router a `allowedRoles` desde `@/lib/roles`, pero el `Sidebar` no fue migrado: sigue importando un `ADMIN_ROLES` **duplicado** de `@/lib/constants:73` y armando listas inline. Quedaron dos fuentes de verdad, y divergen en las dos direcciones. Siete ítems (`Dashboard`, `Participantes`, `Inscripciones`, `Equipos`, `Documentos`, `Resultados`, `Reportes`) no declaran `roles`, así que se muestran a todo `ADMIN_AREA_ROLES`.
- **Divergencias medidas:**

  | Ítem del sidebar | Lo muestra a | La ruta exige | Rol que ve el link y no puede entrar |
  |---|---|---|---|
  | Dashboard (`:47`) | todos | `DASHBOARD_VIEWERS` | ARBITRO |
  | Participantes (`:49`) | todos | `PARTICIPANT_MANAGERS` | ARBITRO |
  | Inscripciones (`:50`) | todos | `INSCRIPTION_MANAGERS` | ARBITRO, COORDINADOR |
  | Equipos (`:52`) / Documentos (`:53`) | todos | `PARTICIPANT_MANAGERS` | ARBITRO |
  | Resultados (`:58`) | todos | `RESULT_LOADERS` | DELEGADO, COORDINADOR |
  | Reportes (`:65`) | todos | `REPORT_VIEWERS` | ARBITRO, COORDINADOR |
  | Usuarios (`:64`) | sólo SUPER_ADMIN | `SYSTEM_MANAGERS` | *(al revés: ADMIN_PROVINCIAL entra y nunca ve el link)* |

- **Escenario que lo hace blocker:** un ARBITRO se loguea, `LoginPage.tsx:36,39` lo manda a `/admin/dashboard`, `DASHBOARD_VIEWERS` no lo incluye → "Acceso Denegado". Mira el sidebar: siete ítems, seis dan lo mismo. Su única pantalla real (Resultados) queda enterrada. **No es un problema de seguridad** —el backend decide y `ProtectedRoute.tsx:41` sólo pinta un cartel— pero deja a un rol entero sin camino usable.
- **Alcance:** incluye el redirect post-login (hoy incondicional al dashboard para todos los roles) y los cuatro accesos rápidos de `DashboardPage.tsx:104-115`, que se pintan sin filtrar.
- **Archivos:** `frontend/src/components/layout/Sidebar.tsx:27,46-67`, `frontend/src/lib/constants.ts:73` (borrar el duplicado), `frontend/src/pages/auth/LoginPage.tsx:35-39`, `frontend/src/pages/admin/dashboard/DashboardPage.tsx:104-115`
- **DoD:**
  - Test que, para **cada** rol, cruce los ítems visibles del sidebar contra los `allowedRoles` del router y falle ante cualquier divergencia en las dos direcciones. Este test es el entregable que impide que vuelva a pasar.
  - `grep ADMIN_ROLES src/lib/constants.ts` no devuelve nada: una sola fuente de verdad.
  - Cada rol aterriza post-login en una ruta a la que efectivamente puede entrar.

- **✅ Evidencia (2026-08-24):** `frontend/scripts/check-nav-roles.mjs`, **260 chequeos en verde**, corriendo con `npm run check:nav`. Bundlea el fuente real con esbuild, no una copia de la lógica.
- **El arreglo terminó siendo estructural y no un filtro mejor:** `NAV_ITEMS` **ya no declara roles**. Cada ítem lleva un `path` tipado como `AdminRoutePath` y la visibilidad se deriva de `ADMIN_ROUTE_ROLES`, que es la misma tabla que consume el router. La divergencia deja de ser posible por construcción; el chequeo fija esa propiedad para que nadie la deshaga agregando un `roles:` inline.
- **Corrección durante la verificación:** la primera versión del chequeo recorría `NAV_ITEMS` para la dirección "puede entrar pero no lo ve", y por eso **no detectaba** el caso de un ítem que directamente no existe — comprobado borrando "Reportes" del menú: pasaba en verde. Ahora recorre las rutas del **router** y contrasta contra el menú, con una lista explícita de las rutas que a propósito no tienen link (las de detalle y la raíz del área). Repetida la mutación, falla con 5 divergencias nombrando rol y ruta.
- **Cubre además:** que `constants.ts` ya no exporte el `ADMIN_ROLES` duplicado, que cada rol aterrice post-login donde puede entrar (ARBITRO cae en Resultados, no en el dashboard), que la ruta intentada antes del login se descarte si el rol no la puede ver —incluidas las rutas con `:id`—, los accesos rápidos del dashboard, y el nit de los separadores de R31, que se arrastran al primer ítem visible del grupo.

### R09 🔴 ⚛️ FE — El wizard de inscripción se rompe en silencio con más de 100 categorías

- [x] **Descripción:** `useCategories({ limit: 100 })` pide **todas** las categorías del sistema sin filtrar por disciplina y filtra en el cliente. El backend tiene un tope duro `@Max(100)` (`pagination.dto.ts:39`), así que 100 **ya es el máximo posible**: la página 2 nunca se pide. Con 20 disciplinas × 6 categorías (sub-14/16/18 × M/F) son 120: las disciplinas que el backend devuelve al final muestran el `<select>` **vacío**, sin error, sin toast y sin skeleton, porque `loadingCategories` es `false` y la query salió bien. `useDisciplines({ limit: 100 })` tiene el mismo problema con menos probabilidad.
- **Por qué es blocker:** es la ruta pública principal del sistema, la falla es total y no degradada, y es **silenciosa** — el mismo criterio con el que el commit `59e2b60` clasificó el bug del seed y el del marcador.
- **Arreglo:** pedir las categorías **de la disciplina elegida** (`useCategories({ disciplineId })`), como ya hace bien `ParticipantsPage.tsx:40-42`. La pieza existe; el wizard no la usa.
- **Archivos:** `frontend/src/pages/public/inscription/useInscriptionWizard.ts:66-67,85-90`
- **DoD:**
  - **✅ Reproducido y cerrado en vivo (2026-08-25).** Se sembraron 100 categorías de prueba hasta llegar a **105 en la base** (el estado normal son 5, así que el bug estaba latente, no activo). Con esas 105, la consulta **vieja** —`limit: 100` sin filtrar y filtrado en cliente— dejaba a la última disciplina con **0 categorías visibles**: el `<select>` vacío, sin error ni toast, exactamente la falla silenciosa descrita. La consulta **nueva**, acotada por `disciplineId`, devuelve sus categorías. Los datos de prueba se borraron después: la base quedó en 5 categorías y 110 participantes, como estaba.
  - Ningún `limit` fijo queda en el wizard: la consulta se acota por `disciplineId`.

- **✅ Evidencia (2026-08-24):** el wizard pasó a `useAllCategories({ disciplineId })`, acotado a la disciplina elegida, y no queda ningún `limit` fijo. `npx tsc --noEmit`, `npm run lint` y `npm run build` en verde.
- **Se resolvió también el caso de las disciplinas**, que no se podían acotar por nada: se agregó `fetchAllPages`, que recorre las páginas hasta el final en vez de pedir 100 y rezar. Lleva un freno de mano de 20 páginas, con el motivo escrito: un catálogo de más de 2.000 filas no se arregla trayéndolo entero a un `<select>`, ahí el problema es de diseño de pantalla.
- **✅ Cerrado en vivo (2026-08-25):** ver la evidencia del DoD más arriba — la base normal tiene 5 categorías (bug latente, no activo), y sembrando hasta 105 la consulta vieja dejaba la última disciplina en **0 categorías visibles** contra las que sí devuelve la nueva.

---

## Fase 2 — Altos

### R10 🟡 🏗️ BE — Filtros booleanos invertidos por `enableImplicitConversion`

- [x] **Descripción:** Con `enableImplicitConversion: true`, el string `"false"` se convierte a `true` (todo string no vacío es truthy). `?isActive=false` devuelve los activos. Afecta a todos los DTOs de filtro con booleanos. Usar `@Transform` explícito que mapee `'true'`/`'false'`, o desactivar la conversión implícita y declarar cada transformación.
- **DoD:** test que recorra los DTOs de filtro con campos booleanos y verifique `'false' → false`, `'true' → true`, `'0'`/`'1'`, y valor ausente → `undefined`. Verificación en vivo con `?isActive=false` sobre al menos dos endpoints.
- **✅ Verificado en vivo (2026-08-25):** con **5 disciplinas, las 5 activas**, `?isActive=true` devuelve **5** y `?isActive=false` devuelve **0**. Antes del arreglo `false` devolvía las 5, porque el string se convertía a `true`.

- **✅ Evidencia (2026-08-24):** `backend/test/boolean-filters.e2e-spec.ts`, **76 tests**. Capa DTO: los 7 filtros × (`'false'`→false, `'true'`→true, `'0'`, `'1'`, mayúsculas, ausente→`undefined`, vacío→`undefined`, booleano real intacto, basura→400). Capa HTTP sobre `/disciplines` y `/venues` contra un Prisma que **aplica el `where`**: los conjuntos `isActive=true` e `isActive=false` son **disjuntos y suman el total**. **Contraprueba:** quitando `@ToBoolean()` fallan **39 de 76**.
- **⚠️ No se tocó `enableImplicitConversion`, a propósito.** Apagarlo globalmente arregla 16 campos y rompe en silencio las coerciones numéricas y de fecha de otros DTOs de query que viven de esa conversión y no declaran transformación propia. El `@Transform` acotado además es más preciso: lee `obj[key]` —el valor **crudo**— y no `value`, porque class-transformer corre la conversión implícita *antes* que las transformaciones custom. Verificado con una sonda: con `isActive` en `'false'`, `value` llega como `true` y `obj[key]` sigue siendo `'false'`.

### R11 🟡 🏗️ BE — `sortBy` sin validar filtra rutas del filesystem y fuente en el 500

- [x] **Descripción:** `orderBy: { [filterDto.sortBy || 'createdAt']: ... }` pasa el valor del cliente directo a Prisma. Una columna inexistente produce un 500 cuyo stack trace incluye rutas absolutas del servidor y fragmentos de código. Restringir `sortBy` a una whitelist por entidad (`@IsIn([...])`) y verificar que el filtro global de excepciones no serialice el stack en producción.
- **Archivos:** el patrón se repite en varios services; `competitions.service.ts:96-98` es uno.
- **DoD:** `?sortBy=noExiste` devuelve **400** con mensaje genérico; con `NODE_ENV=production` ninguna respuesta 5xx contiene `at ` de stack, rutas `C:\` o `/app/`, ni nombres de archivo `.ts`.
- **✅ Verificado en vivo (2026-08-25):** `?sortBy=noExiste` y `?sortBy=passwordHash` devuelven **400**; `?sortBy=name` sigue en 200. El cuerpo del 400 es accionable y no filtra nada: *"El campo de orden debe ser uno de: createdAt, updatedAt, name, sortOrder, type, isActive"*, sin stack ni rutas.

- **✅ Evidencia (2026-08-24):** `backend/test/sort-whitelist.e2e-spec.ts`, **18 tests**. Un `sortBy` inexistente devuelve 400 genérico y **Prisma ni se llama**; `passwordHash`, `user.email`, un path traversal, un `DROP TABLE` y `__proto__` → 400; el cuerpo del 400 no contiene `.ts`, rutas de Windows, `/app/` ni `prisma.`. Con `NODE_ENV=production` ningún 5xx lleva stack, rutas ni `errors`.
- **El doble de Prisma reproduce el error real** (texto calcado del `PrismaClientValidationError`, con ruta absoluta y fragmento de código), así que si la whitelist no cortara, el test vería el 500 filtrado. **Contraprueba:** con los DTOs y services viejos fallan **9 de 18**; revirtiendo sólo el filtro de excepciones falla 1 — la del detalle envuelto en `InternalServerErrorException`, que era justo el caso que el filtro viejo dejaba pasar entero.
- **Defensa en profundidad:** además de la whitelist en el DTO, `buildOrderBy()` manda lo desconocido al default en vez de dejar que explote. `sortOrder` pasó de `@IsString()` a `@IsIn(['asc','desc'])`.

### R12 🟡 🏗️ BE — El sanitizador de auditoría no clasifica varios campos de PII

- [x] **Descripción:** El sanitizador de T25 enmascara bien secretos y algunos campos, pero **no** clasifica `firstName`, `lastName`, `locality` ni `department`. Además, las filas históricas de `AuditLog` guardan PII cruda de antes del sanitizador. Ampliar la clasificación y decidir qué hacer con lo histórico (migración de enmascarado o purga con retención declarada).
- **Archivos:** `backend/src/modules/audit/audit-sanitizer.ts`, más una migración.
- **DoD:** test que pase un payload con los cuatro campos y verifique el enmascarado; conteo de filas históricas con PII cruda antes y después de la migración, registrado en `PROCESO.md`.
- **✅ Backfill corrido contra Postgres real (2026-08-25):** **20 filas con PII cruda → 0**. Leídas 56, reescritas 21. Segunda corrida: **0 reescritas**, o sea idempotente de verdad. Antes: `{"email": "ramiroroman306@gmail.com", "lastName": "Roman", "firstName": "Juan", …}`. Después: `{"dni": "******78", "email": "r***@gmail.com", "phone": "********48", "address": "[PII]", "lastName": "G***", "locality": "P***", …}`.
- **🐛 Bug encontrado al correrlo por primera vez:** el runner construía `new PrismaClient()` sin argumentos y **Prisma 7 exige un driver adapter**, así que fallaba al construirse — el script nunca había podido ejecutarse porque se escribió con Docker caído. Se corrigió armando el cliente como en `seed.ts` (`PrismaPg` sobre un `pg.Pool`), más el `pool.end()` que faltaba.

- **✅ Evidencia (2026-08-24):** `backend/test/audit-pii-fields.e2e-spec.ts`, **18 tests**. Los cuatro campos se enmascaran conservando la inicial (`Gómez` queda en `G***`), también anidados y dentro de arrays. La migración corre contra una tabla en memoria que **guarda de verdad los updates**: filas con PII cruda **antes = 3, después = 0**; la segunda corrida reescribe 0, o sea que es idempotente y segura de reintentar si se corta a mitad. **Contraprueba:** sin la clasificación nueva fallan **7 de 18**; con la migración que no escribe, **5 de 18**.
- **Se enmascara y no se borra**, por la misma razón que el resto del módulo: la tabla tiene que seguir sirviendo para correlacionar ("¿las 200 altas de la madrugada son de la misma persona o de 200?"). El campo `name` a secas **no** se toca: es el nombre de una disciplina o una sede, no de una persona.
- **Decisión sobre lo histórico: re-enmascarado, no purga**, vía `npm run audit:backfill-pii` (con `--dry` para contar sin escribir). La purga dejaría `changes` en null, que tira el único registro de *qué* cambió en cada operación y convierte `AuditLog` en un mero log de accesos. **Retención declarada:** no se borra ninguna fila ni columna — `userId`, `action`, `entity`, `entityId`, `ipAddress`, `userAgent` y `createdAt` quedan íntegros; lo único que se reemplaza es el valor sensible dentro de `changes`. Se hizo en TypeScript y no en SQL porque el enmascarado por clave a profundidad arbitraria en SQL es frágil, y así además es testeable sin Postgres.
- **Se ajustó un test existente:** `audit-contract.e2e-spec.ts` esperaba el nombre en claro; ahora espera el enmascarado y además que el nombre completo no aparezca en el JSON.

### R13 🟡 🏗️ BE — `InscriptionsService.create` no es transaccional

- [x] **Descripción:** La creación toca varias tablas sin `$transaction`. Un fallo a mitad deja la inscripción sin sus registros asociados, y el estado parcial no es detectable después. Envolver en `prisma.$transaction`.
- **DoD:** test que fuerce un fallo en el último paso y compruebe que no queda ninguna fila de la operación.

- **✅ Evidencia (2026-08-24):** `backend/test/inscriptions-transaction.e2e-spec.ts`, **8 tests**. El doble modela `$transaction` con **rollback real** (snapshot de las tablas y restauración si el callback tira). Forzando el fallo en el último paso: **0 participantes y 0 inscripciones**. Se verifica además que el error se propague, que el reintento parta de base limpia, que el duplicado siga dando 409 y que las validaciones previas no abran transacción. **Contraprueba:** desarmando el `$transaction` fallan **2 de 8**, una de ellas la del DoD.
- **Lo que no toca la base quedó afuera de la transacción** —validaciones de edad y sexo, generación del QR, render de la imagen— para no tenerla abierta de más. Efecto de yapa: la ventana de carrera del chequeo de duplicado ahora la cierra la unique `participantId_categoryId` **dentro** de la transacción.
- **⏳ Pendiente, y con motivo:** el rollback contra Postgres real sigue sin ejercerse. Forzar una falla **a mitad** de la transacción en vivo exige inyectar un fallo en el código, o sea dejar un hook de prueba en producción, que es peor que la deuda que cierra. El test modela la semántica con snapshot y restauración reales y falla con el `$transaction` desarmado; se deja anotado que la garantía es por test, no por observación.

### R14 🟡 🏗️ BE — El tipo de archivo se valida contra el mimetype que manda el cliente

- [x] **Descripción:** La validación de subida confía en `file.mimetype`, que lo declara el cliente y se falsifica con un header. Validar por *magic bytes* del contenido y contrastar con la extensión sanitizada.
- **Archivos:** `backend/src/modules/documents/`
- **DoD:** subir un ejecutable con `Content-Type: application/pdf` es rechazado con 400; un PDF legítimo sigue pasando.

- **✅ Evidencia (2026-08-24):** `backend/test/upload-magic-bytes.e2e-spec.ts`, **14 tests**, con multipart real por HTTP. Un ejecutable declarado como PDF → **400** y `minio.uploadFile` **sin llamar**; PDF, PNG y JPEG legítimos → 201; script PHP con nombre `.jpg`, texto plano declarado PDF, archivo vacío y poliglota → 400; PNG con extensión `.pdf` → 400; el `mimeType` que se persiste es el **detectado**, no el declarado. **Contraprueba:** con el validador viejo fallan **13 de 14**.
- **⚠️ Corrección al hallazgo, con evidencia.** La tarea afirmaba que `addFileTypeValidator` "confía en `file.mimetype`". **Eso no es cierto en `@nestjs/common` 11.1.28**: desde Nest 11 el validador detecta por magic numbers con el paquete `file-type`. Verificado con una sonda directa contra el validador viejo: ejecutable declarado PDF → inválido; poliglota HTML+PDF → inválido; PDF real → válido. El camino "mimetype del cliente" sólo se activa degradado: sin `buffer`, con `skipMagicNumbersValidation`, o si falla la carga ESM dinámica de `file-type` (bajo Jest falla **siempre**, y ahí rechaza todo). El agujero es real pero **condicional**, y depende de un `import()` dinámico que degrada en silencio hacia cualquiera de los dos extremos.
- **Por qué el pipe propio se justifica igual:** es síncrono y determinístico (sin import dinámico por request), responde **400** como pide el DoD (el de Nest daba 422) y **contrasta contra la extensión**, que el de Nest no hace — comprobado que acepta un PDF real subido como `documento.exe`.
- **🐛 Bug encontrado fuera de toda tarea, y grave:** `UploadDocumentDto` declaraba `file: any` sin decoradores. Con `target: ES2023` TypeScript emite los campos de clase como propiedades reales, así que el DTO instanciado tenía `file` en `undefined` y `forbidNonWhitelisted` respondía **400 "property file should not exist" a TODA subida**, incluida la de un PDF impecable. O sea que `POST /documents/upload` estaba **caído para todo el mundo**. Lo destapó el primer test que mandó un archivo legítimo. Cerrado con `@Allow()` y el mecanismo explicado en el código.
- **✅ Verificado contra MinIO real (2026-08-25):** ejecutable declarado `application/pdf` → **400** *"El contenido del archivo no corresponde a un PDF, PNG o JPEG"*; PNG con extensión `.pdf` → **400** *"El contenido del archivo (png) no coincide con su extensión (.pdf)"* —el chequeo que el validador de Nest no hace—; script PHP con nombre `.jpg` → **400**; y **un PDF legítimo sube: 201**, con `mimeType: application/pdf` detectado del contenido. Ese 201 confirma además el arreglo del `UploadDocumentDto`: antes **toda** subida daba 400. El objeto aterrizó en MinIO con el nombre saneado (`participants/<id>/<uuid>-dni.pdf`) y se borró al terminar.

### R15 🟡 🏗️ BE — Inyección de fórmulas en la exportación CSV

- [x] **Descripción:** Un participante cuyo apellido empiece con `=`, `+`, `-` o `@` se convierte en fórmula al abrir el CSV en Excel. Prefijar esas celdas con `'` en la exportación.
- **Archivos:** `backend/src/modules/reports/reports.service.ts`
- **DoD:** exportar con un registro sembrado cuyo nombre sea `=1+1` y verificar que la celda del archivo generado no arranca con `=`. Cubrir los cuatro caracteres y también el caso con espacios o tab por delante.

- **✅ Evidencia (2026-08-24):** `backend/test/csv-formula-injection.e2e-spec.ts`, **18 tests**. Se genera el CSV completo con el `escribirCsv` real y se lee la celda del archivo: una fórmula queda prefijada con comilla simple; se cubren los cuatro caracteres y las variantes con espacio, doble espacio, tab y retorno de carro por delante, más el `HYPERLINK` que exfiltra la fila. **Contraprueba:** con el `aLineaCsv` viejo fallan **12 de 18**.
- **Los números puros quedan intactos** para no romper las columnas numéricas, pero un `+1` precedido de tabs **sí** se prefija: ahí la interpretación depende del programa que abra el archivo. El `.xlsx` no lo necesita — ExcelJS escribe estos valores como celdas de tipo string.
- **✅ Verificado en vivo (2026-08-25):** se sembró un participante con `firstName: "=1+1"` y `lastName: "@SUM(A1:A9)"`, se exportó `/reports/participants?format=csv` contra la API real y las celdas del archivo salen como `"'=1+1"` y `"'@SUM(A1:A9)"` — prefijadas, así que ninguna arranca con un carácter que una planilla evalúe. Queda sin hacer la comprobación **visual** abriendo el archivo en Excel o LibreOffice; lo que sí está verificado es el byte que se escribe.

### R16 🟡 🏗️ BE — Respuestas privadas sin `no-store`

- [x] **Descripción:** El `CacheControlInterceptor` de T18 es opt-in y se saltea los requests autenticados, pero no marca las respuestas privadas con `no-store`. Un proxy intermedio o el back/forward cache del navegador puede retener datos de una sesión.
- **DoD:** toda respuesta a un request con `Authorization` lleva `Cache-Control: no-store`; los endpoints públicos con `@CacheControl` conservan su `public, max-age` y su `Vary`.
- **✅ Verificado en vivo (2026-08-25):** `/disciplines` **sin token** → `Cache-Control: public, max-age=600, stale-while-revalidate=600` y `Vary: Origin, Accept-Encoding`; el **mismo endpoint con token** → `no-store`; `/users` con token → `no-store`.

- **✅ Evidencia (2026-08-24):** `backend/test/private-no-store.e2e-spec.ts`, **10 tests**. Con token: listado privado, detalle, endpoint público consultado con credenciales, 404 del handler, 401 de token inválido y PATCH → todos con `no-store`. Sin token: `/disciplines` conserva su `public, max-age=600` y su `Vary`; un público sin decorador sigue sin encabezado. **Contraprueba:** revirtiendo interceptor y filtro fallan **6 de 10**. **`http-cache.e2e-spec.ts` sigue en verde (17/17).**
- **La marca se pone *antes* de ejecutar el handler**, así sale también en sus errores; y como los guards corren antes que los interceptores, el `GlobalExceptionFilter` cubre el hueco de los 401 y 403 de guard, sin pisar un `Cache-Control` ya puesto.
- **⚠️ Desviación registrada:** `http-cache.e2e-spec.ts` tenía un test que afirmaba `cache-control` **ausente** en el request autenticado — exactamente lo que R16 viene a corregir. Los dos criterios no pueden ser ciertos a la vez. Se cambió esa única assertion, con el motivo escrito en el propio test: ausencia de encabezado **no** es prohibición de cachear (un proxy puede aplicar su heurística de frescura); el espíritu del test es el mismo y lo que cambió es que ahora se dice explícitamente. El `public, max-age` y el `Vary` de los públicos no se tocaron.

### R17 🟡 🏗️ BE — `PATCH /participants/:id` permite a un DELEGADO cambiar el DNI

- [x] **Descripción:** El DNI es el identificador con el que se valida la identidad del participante y se cruzan padrones. Que un rol operativo lo edite sin traza diferenciada habilita sustitución de persona sobre una inscripción ya aprobada. Sacarlo del DTO de update para los roles operativos, o exigir un endpoint aparte con auditoría explícita.
- **DoD:** un DELEGADO enviando `dni` en el PATCH recibe 400 (o el campo se ignora, con test que lo demuestre); el cambio por el rol habilitado queda auditado con valor anterior y nuevo.
- **✅ Verificado en vivo (2026-08-25):** un DELEGADO recibe **400** con mensaje accionable —*"No tiene permisos para modificar el DNI... Solicitá el cambio a un admin"*—, el DNI **no cambia en la base**, y el `phone` que venía en el mismo PATCH **tampoco se aplica**: rechazo total, no parcial. Un SUPER_ADMIN sí lo cambia (200) y queda la fila `DNI_CHANGE` con `{"nuevo": {"dni": "******01"}, "anterior": {"dni": "******33"}}` — distinguibles entre sí y **sin ningún documento en claro**, o sea R12 y R17 funcionando juntos.

- **✅ Evidencia (2026-08-24):** `backend/test/participant-dni-change.e2e-spec.ts`, **15 tests**. Un DELEGADO recibe **400**, el DNI **no cambió en la tabla** del doble, y **tampoco se aplicó el resto del PATCH** (rechazo total, no parcial); puede seguir editando otros campos. ADMIN_DEPARTAMENTAL tampoco puede. SUPER_ADMIN y ADMIN_PROVINCIAL sí cambian el DNI y queda la fila `DNI_CHANGE` con anterior y nuevo distinguibles y **sin ningún documento en claro**. **Contraprueba:** sin el corte por rol ni la auditoría fallan **7 de 15**.
- **400 explícito y no descarte mudo:** ignorar el campo en silencio deja al delegado convencido de que corrigió el documento.
- **El corte sólo se dispara si el valor cambia.** Los formularios mandan el objeto completo, así que rechazar un PATCH que reenvía el mismo DNI rompería la edición de teléfono justo para el rol que hace la mayoría de las ediciones.
- **Detalle que evita reintroducir el bug de R12:** el `changes` va anidado bajo la clave `dni` a propósito — el sanitizador clasifica por nombre de clave, así que un `dniAnterior` plano habría guardado el documento en claro.

### R18 🟡 🏗️ BE — `ensureBucketIsPrivate` se traga los fallos

- [x] **Descripción:** Si la llamada que quita la policy pública falla, el error se captura y la app arranca igual, con el bucket público. El endurecimiento de T02 se pierde en silencio justo cuando falla.
- **Archivos:** `backend/src/modules/documents/minio.service.ts`
- **DoD:** con MinIO respondiendo error a `setBucketPolicy`, el arranque **falla** con mensaje claro (o el módulo queda deshabilitado de forma explícita y visible en los logs), nunca continúa como si hubiera funcionado.
- **✅ Camino feliz verificado contra el MinIO real (2026-08-25):** la app arranca sin abortar y `mc anonymous get` sobre el bucket responde **`private`**, o sea que el endurecimiento de T02 sigue en pie y el gate nuevo no lo rompe. El camino de falla (MinIO rechazando `setBucketPolicy`) queda cubierto sólo por los 13 tests: provocarlo en vivo exige romper a propósito las credenciales del contenedor.

- **✅ Evidencia (2026-08-24):** `backend/test/minio-bucket-private.e2e-spec.ts`, **13 tests**. Con `setBucketPolicy` fallando: `onModuleInit()` rechaza, `app.init()` tira y el log dice `ARRANQUE ABORTADO`. Con MinIO caído: la app levanta, el log dice `DESHABILITADO`, subir responde **503 sin llamar a `putObject`**, y cuando MinIO vuelve el módulo se rehabilita solo, sin redeploy. **Contraprueba:** con el `catch` que sólo logueaba fallan **7 de 13**.
- **El caso se partió en dos desenlaces según qué se sabe del estado del bucket**, y el DoD admite las dos formas: si **sabemos que puede estar público** (había policy y falló al quitarla, o no se pudo ni leer) el arranque **falla**; si **el estado es desconocido** porque MinIO no contesta, la app arranca con el módulo explícitamente deshabilitado. Tumbar inscripciones, competencias y reportes porque el almacén de archivos está abajo es peor que degradarlo; un bucket que puede estar sirviendo documentos de menores, no.
- **Se cerró de paso un `catch` pelado** en `removeBucketPolicy` que trataba **cualquier** error de `getBucketPolicy` como la buena noticia "ya es privado": ante un `AccessDenied` la app daba por verificado algo que no había podido mirar.
- **Se ajustó `minio.service.spec.ts`:** su `beforeEach` deja el bucket verificado antes de los tests de retry y sanitizado, que no miran el bootstrap. Los dos tests de T02 que exigen que la app **no** se caiga con MinIO caído siguen tal cual y en verde.

### R19 🟡 ⚛️ FE — Puerta trasera en el single-flight del refresh

- [x] **Descripción:** `refreshPromise` en `client.ts:89-112` deduplica los refresh que dispara el *interceptor*, pero `authApi.refresh()` (`auth.api.ts:31`) hace su propio `apiClient.post('/auth/refresh')` **sin pasar por `refreshAccessToken()`**, y `auth.store.tsx:59` lo llama en el arranque. Son dos caminos independientes al mismo endpoint que rota el token, o sea la condición exacta que T03 vino a cerrar. La alcanzabilidad es angosta (`ProtectedRoute` bloquea a los hijos mientras `isLoading`, y el loader corta si no hay token), por eso no es blocker — pero es un agujero en una defensa construida a propósito, y se cierra en una línea.
- **DoD:** `grep` muestra un único lugar en el frontend que hace `POST /auth/refresh`; test que dispare `restoreSession()` y un 401 concurrente y compruebe **una sola** llamada al endpoint. **Se cierra junto con R04**, que es la otra mitad del mismo problema.

- **✅ Evidencia (2026-08-24):** 7 chequeos ejecutando el `client.ts` real bundleado contra un servidor HTTP de prueba que cuenta las llamadas. Tres pedidos simultáneos de refresh —uno de ellos por `authApi.refresh()`, que era el camino paralelo— producen **1 sola** llamada a `/auth/refresh`. El single-flight clásico sigue en pie: ráfaga de 5 requests con el token vencido → **1** refresh, las 5 terminan bien, y el reintento sale con el token nuevo y no con el vencido.

### R20 🟡 ⚛️ FE — Debounce en los buscadores (regresión de `59e2b60`)

- [x] **Descripción:** El commit `59e2b60` movió la búsqueda de inscripciones al servidor —correctamente, el filtrado local sólo alcanzaba la página traída— pero `search` va directo al `queryKey` sin amortiguar. `grep -rn "debounce|useDebounce" src` devuelve **un solo match, y es un comentario**. Escribir "Gonzalez" son **ocho requests**, siete obsoletas al salir. Lo mismo en los tres inputs de texto de `ParticipantsToolbar` (search, departamento, localidad). No hay race condition —React Query cancela las anteriores— pero es carga sobre el backend y parpadeo, y es una regresión neta que introdujo el propio fix.
- **Archivos:** `frontend/src/pages/admin/InscriptionsPage.tsx:34-40`, `frontend/src/pages/admin/participants/ParticipantsToolbar.tsx:45,91,99`, `frontend/src/pages/admin/TeamsAdminPage.tsx`, más un `useDebounce` compartido.
- **DoD:** un hook `useDebounce` reutilizable; el `<input>` sigue controlado **sin** retardo (no se tipea con lag) y sólo el valor que entra al `queryKey` se amortigua 300 ms; test que simule 8 pulsaciones y verifique **1** request.

- **✅ Evidencia (2026-08-24):** 6 chequeos sobre el hook real, ejecutado con un stub de React que corre efectos y cleanups. Escribir "Gonzalez" hace que **la queryKey vea 2 valores en vez de 9**: el inicial y el final. Con teclas cada 250 ms no emite nada (el temporizador se reinicia) y al parar emite el último valor.
- **El riesgo del debounce era el input, y está cubierto:** `value={search}` sigue atado al estado crudo y sólo el valor que entra al `queryKey` se amortigua, así que no se tipea con lag.
- **Nota de método:** la primera versión del harness daba 3 fallas que parecían del hook y eran mías — esbuild metía una copia del stub dentro del bundle, así que el harness y el hook manipulaban instancias distintas del módulo. Se corrigió bundleando todo junto.

### R21 🟡 ⚛️ FE — Aplicar `getFriendlyError` en los 11 archivos de hooks que faltan

- [x] **Descripción:** El helper de T16 (`utils.ts:250-269`) está bien pensado —whitelist de status, patrones de leak, corte que no parte mensajes al medio— pero se usa en **3 de 14** archivos de hooks (`useCalendar`, `useCompetitions`, `useInscriptions`). Los otros once siguen con literales genéricos, y hay 34 `toast.error` en `src/hooks`. No es un problema de seguridad —el genérico es el lado seguro— sino la pérdida de UX que la tarea quería evitar: un delegado que carga un DNI ya registrado recibe "Error al crear el participante" en vez del 409 que le dice cuál es el problema.
- **DoD:** los 14 archivos usan el helper, o los que no lo usen lo documentan con motivo en el propio código. Test con un 409 real que verifique que el mensaje del backend llega al toast.

- **✅ Evidencia (2026-08-24):** **12 de 15** archivos de `src/hooks/` usan el helper, y —lo que cierra el criterio— **no queda ninguno con `toast.error` que no lo use**: los 3 restantes no muestran errores. `grep` verificado.

### R22 🟡 🔀 FS — Las acciones dentro de las páginas no filtran por rol

- [x] **Descripción:** `grep -rn "hasRole|user.role" src/pages src/components` devuelve **sólo el Sidebar**. Las rutas usan grupos más anchos que los endpoints: la ruta `PARTICIPANTS` exige `PARTICIPANT_MANAGERS`, pero `participants.controller.ts:35-42` restringe `POST` a admins + DELEGADO (sin COORDINADOR) y `@Patch(':id')` (`:82-88`) excluye COORDINADOR **y** ADMIN_ZONAL; `teams.controller.ts:69-70,79-80` limita PATCH y DELETE a admins + DELEGADO. Un ADMIN_ZONAL ve "Editar", abre el diálogo, corrige un domicilio, guarda, y recibe "Error al actualizar el participante" sin que nada le diga que jamás iba a poder.
- **Contracara de R08:** lo que se muestra tiene que coincidir con lo que el backend acepta, en las dos direcciones.
- **Reparto:** **🏗️ BE** publica los permisos por acción de forma consultable (o se derivan de una constante compartida); **⚛️ FE** los consume en los botones de acción.
- **DoD:** matriz rol × acción; ningún botón visible produce un 403; ninguna acción permitida queda oculta. Se cierra después de R05, que puede cambiar los grupos.

- **✅ Evidencia (2026-08-24):** `backend/test/action-permissions.e2e-spec.ts`, **213 tests**: 18 acciones × 9 roles = 162 chequeos contra HTTP real verificando que el endpoint responda 403 **exactamente** cuando el permiso dice que no, y no-403 cuando dice que sí —las dos direcciones—, más 46 chequeos por reflexión de que ningún handler declara roles inline, con una red de seguridad que falla si el barrido deja de encontrar handlers.
- **Fuente de verdad única:** `ACCIONES` en las constantes del backend, y los 15 controllers declaran `@Roles(...ACCIONES.X)`. El permiso que se aplica y el que se publica son el **mismo objeto**, no dos listas parecidas. `GET /auth/permissions` lo hace consultable.
- **El chequeo del frontend se extendió en vez de duplicarse:** `npm run check:nav` pasó de 260 a **402 chequeos**, y ahora **bundlea el archivo real del backend** para comparar acción por acción. No es "acordate de actualizar el espejo": es un chequeo que falla.
- **Cuatro contrapruebas, cada una aislando un chequeo distinto:** un `@Roles` inline en un controller → 6 de 213 en rojo; el espejo del frontend desincronizado → `check:nav` en rojo con el diff exacto de roles; la página volviendo a pintar los botones sin filtrar (el bug original) → 2 divergencias; un permiso de acción sobre una pantalla que el rol no puede abrir → detectado.
- **🐛 Dos bugs encontrados fuera del enunciado:** el alta de usuarios mostraba el botón a `ADMIN_PROVINCIAL` cuando el endpoint es sólo del `SUPER_ADMIN`; y `RESULT_LOADERS` **ya estaba desincronizado** —listaba COORDINADOR y OPERADOR_MESA, que el `@Roles` real de `results.controller.ts` nunca tuvo—, o sea exactamente la trampa que R22 viene a cerrar.
- **Decisión:** el frontend deriva de la constante espejada y **no** consulta el endpoint, porque pintar un botón no puede depender de un request en vuelo; el endpoint queda para que el permiso efectivo sea auditable sin leer código. Se mantuvieron separados los dos niveles —`adminRoutes` decide pantallas, `adminActions` decide acciones— porque un COORDINADOR tiene que seguir viendo el padrón sin poder editarlo.
- **Donde no queda ninguna acción se omite la columna entera** en vez de mostrar el ítem deshabilitado: un "Editar" gris sigue insinuando que el rol podría llegar a poder.

### R23 🟡 🔀 FS — `results[0]`/`results[1]` como local y visitante, sin orden garantizado

- [x] **Descripción:** `MatchCard.tsx:21-23` toma `results[0]` como local y `results[1]` como visitante. `model Result` (`schema.prisma:360-379`) **no tiene ningún campo que distinga localía** —ni `isHome`, ni `side`, ni `order`— y la consulta del fixture (`competitions.service.ts:112-120`) no lleva `orderBy`. Postgres no garantiza orden sin `ORDER BY` y Prisma no lo impone en la relación anidada.
- **Es el mismo modo de falla que `59e2b60` arregló en `matchScore.ts`**, una capa más abajo: ahí era el orden de las claves de un JSON, acá el de las filas de una relación. Severidad matizada con honestidad: el nombre y el marcador salen del *mismo* índice, así que el par nombre↔puntaje siempre es coherente y no se muestra un marcador equivocado. Lo que se invierte es qué equipo va a la izquierda: el mismo partido puede leerse "San Martín 3 : 1 Belgrano" en un refetch y "Belgrano 1 : 3 San Martín" en el siguiente. Y los fallbacks "Equipo Local"/"Equipo Visitante" (`:43`, `:53`) **mienten sobre un dato que el sistema no tiene**.
- **Reparto:** **🏗️ BE** agrega el campo al modelo con su migración y un `orderBy` determinista; **⚛️ FE** lee por el campo, no por índice.
- **DoD:** el fixture muestra el mismo orden en 10 refetchs consecutivos; con localía cargada, el local siempre a la izquierda; sin el dato, los textos por defecto dicen "Equipo A"/"Equipo B" y no afirman una localía inexistente.

- **✅ Evidencia (2026-08-24):** 11 chequeos sobre `ordenarLados` y 5 más renderizando el `MatchCard` real con `react-dom/server`. El mismo partido rinde **markup byte a byte idéntico** venga el arreglo en el orden que venga; el local queda a la izquierda; el marcador acompaña al equipo correcto; y sin el dato la tarjeta usa "Equipo A"/"Equipo B" en vez de afirmar una localía inexistente.
- **Contraprueba:** volviendo a `results[0]`/`results[1]`, el mismo partido rinde **distinto** según el orden del arreglo, los equipos se invierten y la tarjeta dice "Equipo Local" sin tener el dato.
- **El campo es `isHome Boolean?`, nullable a propósito:** en las disciplinas individuales un partido tiene N resultados y la localía no significa nada. `null` es "no aplica", y las filas que ya existen quedan así — es lo correcto, porque de ellas no se puede deducir quién era local.
- **La localía sólo se rotula si están las dos puntas.** Un partido con el dato a medias no alcanza para nombrar los lados, y hay un test que lo fija.
- **El `orderBy` pasó a ser parte del contrato del select**, no un detalle: `isHome` desc con desempate por `createdAt` e `id`, para que las disciplinas individuales —donde `isHome` es null en todas las filas— también tengan orden estable entre refetchs.
- **✅ Migración aplicada (2026-08-25)** con `prisma migrate deploy`, y verificado en vivo que `GET /competitions/:id` ya devuelve `isHome` en cada resultado.
- **⏳ Pendiente:** falta que el motor de competencia **escriba** `isHome` al generar fixtures. El campo existe, viaja en la API y la UI lo respeta, pero nadie lo carga todavía, así que en la práctica los partidos se muestran con etiquetas neutras ("Equipo A"/"Equipo B") hasta que se complete esa parte — que es el comportamiento correcto mientras el dato no exista, no una regresión.

### R24 🟡 ⚛️ FE — `setAccessToken` puede quedar envenenado con `undefined`

- [x] **Descripción:** `const token = data.data?.accessToken ?? data.accessToken; setAccessToken(token);` — el tipo dice `string`, pero si la respuesta no trae el campo en ninguna de las dos formas, se guarda `undefined` en la variable de módulo y el `refreshPromise` **resolvió con éxito**. El `originalRequest` se reintenta con `Authorization: Bearer undefined` (`:151` lo asigna sin chequear), ese reintento 401ea, `_retry` ya es `true`, y el usuario recibe un 401 crudo sin que se dispare `handleSessionExpired`.
- **Archivos:** `frontend/src/api/client.ts:100-104,151`
- **DoD:** un `/auth/refresh` que responda 200 con body vacío produce un logout limpio (`handleSessionExpired`), no un estado zombie. Test contra un servidor de prueba con el `client.ts` real.

- **✅ Evidencia (2026-08-24):** verificado contra el servidor de prueba respondiendo **200 con body vacío**. El refresh termina en error y no en éxito, no queda token envenenado en memoria, y **ningún request sale con `Bearer undefined`**. Antes ese 200 vacío dejaba la promesa resuelta, el reintento salía con `Bearer undefined`, el 401 resultante ya no disparaba el refresh porque `_retry` estaba en `true`, y el usuario quedaba en una sesión zombie: sin token y sin logout.

### R25 🟡 ⚛️ FE — `handleSessionExpired` deja estado inconsistente fuera de `/admin`

- [x] **Descripción:** La función vive fuera del árbol de React, así que no puede tocar `setUser(null)` ni `resetQueryCache()`. Dentro de `/admin` no importa (el `window.location.href` recarga y limpia la memoria), pero **fuera** de `/admin` el token se borra y nada más: `AuthProvider` sigue con `user` poblado, `isAuthenticated` en `true`, `useQueryScope` devolviendo el `userId` viejo y la cache con los datos de esa sesión. Si el usuario vuelve al admin con el router, sin recarga, `ProtectedRoute` lo deja pasar con un usuario fantasma y cada query rebota en 401.
- **Nota verificada ejecutando** (test con `@tanstack/query-core` real): `resetQueryCache()` vacía la cache, pero los observers montados la **repueblan de inmediato** con la clave del usuario anterior. En el flujo real de `logout()` es inofensivo —`authApi.logout()` ya llamó a `clearAccessToken()` en su `finally` antes que el store, así que ese refetch sale sin token y trae 401, no datos: **no hay fuga**— pero sí hay una ráfaga de requests condenadas compitiendo con el redirect. El `resetQueryCache()` del **login** (`auth.store.tsx:84`) es el que sí protege contra el cruce de sesiones, y está bien puesto.
- **DoD:** expirar la sesión estando en una página pública y navegar al admin con el router deja al usuario en el login, sin usuario fantasma y sin ráfaga de 401.

- **✅ Evidencia (2026-08-24):** resuelto con una suscripción (`onSessionExpired`) a la que el `AuthProvider` se engancha en un `useEffect`, así el store se entera y suelta el usuario aunque la función viva fuera del árbol de React. Se avisa **antes** del redirect y no sólo después: si la navegación se demora o no ocurre, el estado igual queda consistente con el token vacío.

### R26 🟡 ⚛️ FE — `clipboard.writeText` sin `catch`, y el toast miente

- [x] **Descripción:** `navigator.clipboard.writeText(code); toast.success('Código copiado al portapapeles');` — la promesa rechaza si el contexto no es seguro (`http://` en una demo o en la red interna), si el permiso está denegado o si el documento no tiene foco. Resultado: una unhandled rejection **y** un toast verde que le dice al participante que su código de inscripción se copió cuando el portapapeles quedó vacío. Después lo pega en WhatsApp y manda cualquier cosa.
- **Archivos:** `frontend/src/pages/public/inscription/useInscriptionWizard.ts:196-199`, `frontend/src/pages/public/NewsDetailPage.tsx:56`
- **DoD:** el toast de éxito sólo aparece si la promesa resolvió; el rechazo muestra un error accionable y no queda unhandled. Verificado sirviendo el frontend por `http://` en una IP de red local.

- **✅ Evidencia (2026-08-24):** 5 chequeos ejecutando el helper real. Se agregó `src/lib/clipboard.ts`, único lugar del frontend que llama a `writeText`. Un detalle que la tarea no anticipaba y sí importa: en `http://` contra una IP de red la API **no existe**, no es que rechace — así que además del `try/catch` hay que chequear que `navigator.clipboard?.writeText` esté. El cuarto chequeo es un listener de `unhandledRejection` sobre los tres escenarios: **0 rechazos sin atender**. El mensaje de error es accionable ("Seleccioná el texto y copialo a mano").
- **Alcance real mayor al enunciado:** en `NewsDetailPage` el tilde de "copiado" también se prendía siempre; ahora depende del resultado.
- **⏳ Pendiente:** la demo sirviendo por `http://` en una IP de red local. El caso está cubierto por el test que simula exactamente esa condición, pero es simulación.

---

## Fase 3 — Optimizaciones

### R27 🚀 ⚛️ FE — `lazy()` sobre `recharts` en el dashboard

- [x] **Descripción:** Medido con `npm run build`: `DashboardPage-BmjpRhUx.js` pesa **322,80 kB (95,26 kB gzip)**, contra 14,53 kB del siguiente admin más pesado — **22×**. Son 42 ocurrencias de `recharts` en el chunk, todas desde `InscriptionsStatusCard.tsx:6`. `DashboardPage` es el destino post-login de **todos** los roles: 95 kB gzip en el camino crítico de cada login, por un donut de cuatro porciones.
- **Crédito donde corresponde:** el comentario de `InscriptionsStatusCard.tsx:10-20` documenta el problema con precisión y declara que el `lazy()` es otra tarea. Es deuda declarada, no escondida — y el corte ya está servido por T10.
- **DoD:** el chunk de `DashboardPage` baja por debajo de 50 kB; el donut carga en un chunk aparte con su propio fallback; cifras de `npm run build` antes y después en `PROCESO.md`.

- **✅ Evidencia (2026-08-24), medida con `npm run build`:**

  | | antes | después |
  |---|---|---|
  | `DashboardPage` | 322,80 kB / **95,31 kB gzip** | **8,12 kB / 2,77 kB gzip** |
  | `InscriptionsStatusDonut` | *(dentro del anterior)* | 315,73 kB / 93,03 kB gzip, diferido |

  El DoD pedía bajar de 50 kB: quedó en **8,12 kB**. Los 93 kB gzip salen del camino crítico del login de todos los roles.
- **El corte quedó dentro de la card y no en la página:** la leyenda y el marco no dependen de `recharts`, así que se pintan de entrada y sólo el hueco del gráfico espera. El contenedor de 140 px queda **fuera** del `<Suspense>` y el fallback es un anillo con `role="status"`, así que la card no salta al cargar.
- **Sin regresión visual:** comparación de markup contra un worktree de `HEAD` — la leyenda de la card rinde idéntica; lo único que cambia es el donut por su fallback, que es el cambio buscado.

### R28 🚀 ⚛️ FE — Code splitting de las páginas públicas

- [x] **Descripción:** Medido con `npm run build`: `index-CVXHwlVk.js` pesa **442,63 kB (128,47 kB gzip)**. T20 lazificó las 20 páginas admin, con el buen detalle de importar cada una desde su archivo y no desde el barrel — pero las nueve públicas se importan de forma estática (`router.tsx:35-46`) y **desde el barrel** `@/pages/public/index`, que es justo el error que el comentario de `router.tsx:49-52` explica que hay que evitar. Un ciudadano que entra a ver el calendario se descarga las nueve páginas públicas, el `LoginPage`, `AuthProvider`, `QueryClientProvider` y los layouts: 128 kB gzip en un móvil formoseño.
- **DoD:** el chunk de entrada baja por debajo de 60 kB gzip; cada página pública tiene su chunk; ningún import desde el barrel en `router.tsx`; el `lazy()` no rompe la primera pintura de la home (medir LCP antes y después).

- **✅ Evidencia (2026-08-24), medida con `npm run build`:**

  | | antes | después |
  |---|---|---|
  | chunk de entrada | 412,44 kB / **120,33 kB gzip** | **285,40 kB / 90,02 kB gzip** |
  | JS de la primera pintura (entry + `modulepreload`) | 558,80 kB / **167,17 kB gzip** | **472,39 kB / 150,92 kB gzip** |
  | chunks JS | 44 | 102 |

  Se borró el barrel `pages/public/index.tsx` y `grep` sobre `router.tsx` da **0** imports desde barriles. Se lazificaron además `LoginPage`, `InscriptionInfoPage` y `AdminLayout` — el shell del panel viajaba en el entry, o sea que un ciudadano se bajaba el sidebar y el botón de cerrar sesión. Efecto colateral: mover los `lazy()` a su módulo apagó **20 warnings** de `only-export-components`.
- **⚠️ Desviación deliberada 1 — la home queda estática.** Lazificarla saca 2,80 kB gzip del entry y a cambio mete un round-trip entre el parseo del entry y el primer render, que es exactamente el intervalo que mide el LCP de la ruta de aterrizaje. En un móvil formoseño la latencia pesa más que 2,8 kB. Queda argumentado en el comentario del import.
- **⚠️ Desviación deliberada 2 — no se llegó al "&lt; 60 kB gzip" del DoD, y no se forzó.** Los 90 kB que quedan no son páginas: son `react-dom`, react-router, react-query, axios, sonner y los layouts, o sea lo que necesita cualquier ruta. Un `manualChunks` que moviera `react`/`react-dom` a un `vendor-react` dejaría el número en ~30 kB y el criterio "cumplido", pero **el navegador descargaría exactamente lo mismo**: es maquillar la métrica. La cifra que sí mide lo que le pasa al usuario es la de primera pintura, **−16,25 kB gzip (−9,7 %)**, y para quien entra a `/calendario` la caída es mayor porque ya no arrastra las otras ocho páginas.
- **⏳ Pendiente:** medir LCP en un navegador real. La decisión sobre la home se tomó con la cifra de transferencia y el razonamiento de cascada, no con una medición de Lighthouse; hacerlo requiere un navegador headless que hoy no está en el toolchain del proyecto.

### R29 📈 🔀 FS — Topes de paginación silenciosos en el frontend público

- [x] **Descripción:** Mismo patrón que R09, con menos daño pero igual de invisible:
  - `NewsPage.tsx:16-19` — `limit: 50` y el buscador filtra **en el cliente** sobre esas 50. La noticia 51 no se encuentra buscándola, y el `EmptyState` dice "No se encontraron artículos que coincidan con tu búsqueda", que es literalmente falso.
  - `CalendarPage.tsx:23` — `limit: 100`, filtrado local en `calendarFilters.ts:37-57`. El evento 101 no existe para el calendario público.
- **DoD:** con más registros que el tope, la búsqueda y los filtros alcanzan a **todo** el conjunto (búsqueda server-side o paginación real). Ningún `EmptyState` afirma "no hay resultados" cuando lo cierto es "no hay resultados en lo que trajimos".

- **✅ Evidencia (2026-08-24):** 5 chequeos. El calendario alcanza los 250 eventos donde antes cortaba en 100 (3 requests vía `fetchAllPages`), y el filtro de mes ve eventos que estaban más allá del tope.
- **Las dos pantallas se resolvieron distinto, a propósito.** El calendario usa `fetchAllPages`. Noticias **no**: el backend ya soporta `search` sobre título y copete, y traerse el archivo entero de noticias para filtrarlo en el cliente sería el mismo error con otro disfraz. Así que la búsqueda viaja al servidor —con `useDebounce`, el patrón de R20— y la página pagina de verdad. El `EmptyState` que afirmaba "no se encontraron artículos que coincidan con tu búsqueda" pasó a ser cierto.
- **Los dos chequeos de noticias interceptan el adapter de la instancia real de Axios**, no un stub del módulo, así que ejercitan `news.api.ts` con sus interceptores y muestran los query params que salen al aire.

---

## Fase 4 — Polish

### R30 ✨ ⚛️ FE — `SafeNewsImage` no resetea `hasError` al cambiar `src`

- [x] **Descripción:** `hasError` es estado derivado que nunca se sincroniza con la prop. Si el componente se reutiliza con otra imagen sin desmontarse, sigue mostrando el placeholder de la anterior. **Hoy no se dispara** —`NewsPage.tsx:103` y `LatestNewsSection` keyean por `news.id`, así que cambiar de noticia desmonta— pero queda armado para el día que alguien agregue paginación o un `key` por índice.
- **Archivos:** `frontend/src/pages/public/news/SafeNewsImage.tsx:49-57`
- **DoD:** re-renderizar el mismo componente con un `src` distinto vuelve a intentar la carga. `key={safeSrc}` desde el padre es una solución aceptable si se documenta.

- **✅ Evidencia (2026-08-24):** resuelto **sin `useEffect`**, que era la solución que sugería la tarea. En vez de un booleano que hay que recordar sincronizar, se guarda `failedSrc` y `hasError` se **deriva** comparándolo con el `src` vigente: si la prop cambia, la comparación da `false` sola. La desincronización deja de ser posible por construcción en vez de quedar corregida por un efecto.

### R31 ✨ ⚛️ FE — Nits agrupados de la revisión final

- [x] **Descripción:** Ocho hallazgos menores que no justifican una tarea cada uno:
  - `CompetitionPublicPage.tsx:96` — `key={idx}` sobre datos dinámicos (el único del diff; los demás son constantes estáticas o skeletons). En una tabla de posiciones que reordena al cargar resultados, React reusa DOM por posición. Con celdas de texto plano el daño es cosmético, pero es la misma tabla cuya correctitud se acaba de endurecer en `matchScore.ts`.
  - `public/calendar/calendarFilters.ts:44,52` — el filtro de mes usa `getMonth()` sin mirar el año: un evento de marzo de 2025 matchea "Marzo" junto con los de 2026.
  - `public/inscription/TrackInscription.tsx:45-51` — el input de código QR tiene `placeholder` pero ni `<label>` ni `aria-label`. Se marca porque el resto del diff es notablemente bueno en esto (`ParticipantsToolbar` etiqueta sus cinco filtros, `Pagination` sus cuatro botones, `DataTable` maneja `scope`, `caption` y live regions con cuidado real); éste quedó suelto.
  - `schemas/index.ts:206` (`loginSchema`) y `:279` (`participantSchema`) — definidos y sin usar donde corresponde: `LoginPage.tsx:45-48` valida a mano y `useInscriptionWizard.ts:129-136` reimplementa la regla del DNI con un regex inline. T15 endureció los schemas y dos caminos de entrada no los consultan.
  - `api/client.ts:144` — `!originalRequest._retry` sin optional chaining, mientras `:140` sí usa `originalRequest?.url`. No explota, pero la inconsistencia sugiere que uno de los dos está mal y no se sabe cuál.
  - `components/shared/DataTable.tsx:317` — `meta && onPageChange && meta.totalPages > 1` esconde el bloque entero cuando hay una sola página, y con él el selector de "Por página": con `limit: 10` y 12 registros el usuario ve dos páginas, baja a 10, quedan 8, y pierde el control para volver a subirlo.
  - `components/layout/Sidebar.tsx:119` — `item.separator && idx > 0` se evalúa sobre `visibleItems`, no sobre `NAV_ITEMS`: si el ítem que porta el flag se filtra por rol, el grupo pierde su separador. **Se cierra con R08.**
  - `pages/admin/CompetitionDetailPage.tsx:86` — indentación rota en el `resultType={...}` que agregó `59e2b60`.
  - `pages/public/NewsPage.tsx:22-30` — el único warning real de `npm run lint` (`useMemo depends on 'allNews', which changes every render`). Es inofensivo, pero conviene resolverlo con intención en vez de dejarlo pasar.
- **DoD:** `npm run lint` sin warnings; `npx tsc --noEmit` limpio; los cuatro puntos con impacto funcional (mes sin año, `key`, `DataTable`, schemas) con un test cada uno.

- **✅ Evidencia (2026-08-24):** 22 chequeos entre los cuatro nits con impacto funcional, más comparación de markup del `DataTable` con 2 y 3 páginas (idéntico: el arreglo sólo toca el caso de una sola página).
- **El filtro de mes** pasó de `'0'..'11'` a clave `'YYYY-MM'`, y las opciones se derivan **de los eventos que hay** ("Marzo 2025", "Marzo 2026") en vez de listar doce meses fijos: con el año en juego, ofrecer un mes vacío sólo puede terminar en una lista vacía.
- **Los schemas de Zod** que estaban definidos y sin usar ahora se usan, y eso destapó reglas que el código a mano dejaba pasar: `participantSchema` rechaza `00000000` y el 31 de febrero, que el regex inline aceptaba.
- **El nit del `originalRequest._retry`** se resolvió determinando cuál de los dos lugares estaba mal: el que faltaba chequear era el segundo, porque sin `config` no hay request que reenviar.
- **Corrección sobre el informe del agente:** dio por cerrada la indentación de `CompetitionDetailPage.tsx:86` sin tocarla, y seguía rota (10 espacios contra 8 de las props hermanas). Se arregló al verificar.
- **⚠️ Desviación del DoD:** quedan **6 warnings** de lint (el criterio pedía cero), todas `react(only-export-components)` en primitivas de `ui/` que exportan sus variantes de `cva` junto al componente, más `auth.store` y `StepPersonalData`. Ninguna es de los archivos de R31 y sacarlas obliga a partir cada primitiva en dos módulos, que es una refactorización con su propia superficie de riesgo. Se bajó de **36 a 6**.

---

## 🗺️ Orden de ejecución recomendado

1. **R01, R06** (🏗️ BE) — fugas de datos, y las dos son un `select`/`where`. Máximo impacto por línea tocada.
2. **R02, R03** (🏗️ BE) — bypass de auditoría y DoS del `/audit`. Mecánicos y acotados.
3. **R04 + R19** (🏗️ BE + ⚛️ FE) — juntas: son las dos mitades del mismo problema de rotación del refresh.
4. **R07** (⚛️ FE + 🎨 UI) — error boundary y 404. Media hora y elimina el peor modo de falla del frontend.
5. **R08** (⚛️ FE) — sidebar. Mecánico, y el test cruzado es lo que impide que se vuelva a desincronizar.
6. **R09** (⚛️ FE) — wizard. **Requiere Docker** para medir el conteo real primero.
7. **R05** (🔀 FS) — scoping territorial. Va acá porque necesita definición de negocio y puede cambiar los grupos de roles que consume R22.
8. **R10 → R18** (🏗️ BE) — altos de backend, en cualquier orden entre sí.
9. **R20, R21, R24, R25, R26** (⚛️ FE) — altos de frontend.
10. **R22, R23** (🔀 FS) — necesitan coordinación y R23 toca el schema; después de R05.
11. **R27, R28, R29** — optimización, con cifras de `npm run build` antes y después.
12. **R30, R31** — polish de cierre.

---

## 📊 Estado de las tareas

> Actualizado el 2026-08-24. Cada tarea tendrá su bloque de evidencia en
> `PROCESO.md → sección 5` y su propio commit.

**Progreso: 31 de 31 tareas completadas.**
Blockers 🔴: **9 de 9** — la regla dura se cumple. Quedan dos migraciones sin aplicar (R05 y R23) y la carga de las zonas de Formosa, ambas anotadas en su tarea.

| Tarea | Sev. | Agente | Título | Estado |
|---|---|---|---|---|
| **R01** | 🔴 | 🏗️ BE | Cortar la fuga de PII en `GET /competitions/:id` público | ✅ Completada |
| **R02** | 🔴 | 🏗️ BE | Cerrar el bypass de auditoría por querystring | ✅ Completada |
| **R03** | 🔴 | 🏗️ BE | `GET /audit` ignora la paginación y devuelve la tabla entera | ✅ Completada |
| **R04** | 🔴 | 🏗️ BE | Rotación atómica del refresh token (TOCTOU) | ✅ Completada |
| **R05** | 🔴 | 🔀 FS | Scoping por zona y departamento en datos y reportes | ✅ Completada |
| **R06** | 🔴 | 🏗️ BE | Borradores de noticias y eventos legibles sin autenticación | ✅ Completada |
| **R07** | 🔴 | ⚛️ FE + 🎨 UI | Error boundary y ruta 404 | ✅ Completada |
| **R08** | 🔴 | ⚛️ FE | Sincronizar el Sidebar con `@/lib/roles` | ✅ Completada |
| **R09** | 🔴 | ⚛️ FE | El wizard de inscripción se rompe con más de 100 categorías | ✅ Completada |
| **R10** | 🟡 | 🏗️ BE | Filtros booleanos invertidos por `enableImplicitConversion` | ✅ Completada |
| **R11** | 🟡 | 🏗️ BE | `sortBy` sin validar filtra rutas y fuente en el 500 | ✅ Completada |
| **R12** | 🟡 | 🏗️ BE | El sanitizador de auditoría no clasifica varios campos de PII | ✅ Completada |
| **R13** | 🟡 | 🏗️ BE | `InscriptionsService.create` no es transaccional | ✅ Completada |
| **R14** | 🟡 | 🏗️ BE | Tipo de archivo validado contra el mimetype del cliente | ✅ Completada |
| **R15** | 🟡 | 🏗️ BE | Inyección de fórmulas en la exportación CSV | ✅ Completada |
| **R16** | 🟡 | 🏗️ BE | Respuestas privadas sin `no-store` | ✅ Completada |
| **R17** | 🟡 | 🏗️ BE | `PATCH /participants/:id` permite cambiar el DNI | ✅ Completada |
| **R18** | 🟡 | 🏗️ BE | `ensureBucketIsPrivate` se traga los fallos | ✅ Completada |
| **R19** | 🟡 | ⚛️ FE | Puerta trasera en el single-flight del refresh | ✅ Completada |
| **R20** | 🟡 | ⚛️ FE | Debounce en los buscadores (regresión de `59e2b60`) | ✅ Completada |
| **R21** | 🟡 | ⚛️ FE | Aplicar `getFriendlyError` en los 11 hooks que faltan | ✅ Completada |
| **R22** | 🟡 | 🔀 FS | Las acciones dentro de las páginas no filtran por rol | ✅ Completada |
| **R23** | 🟡 | 🔀 FS | `results[0]`/`results[1]` como local y visitante | ✅ Completada |
| **R24** | 🟡 | ⚛️ FE | `setAccessToken` puede quedar envenenado con `undefined` | ✅ Completada |
| **R25** | 🟡 | ⚛️ FE | `handleSessionExpired` deja estado inconsistente fuera de `/admin` | ✅ Completada |
| **R26** | 🟡 | ⚛️ FE | `clipboard.writeText` sin `catch`, y el toast miente | ✅ Completada |
| **R27** | 🚀 | ⚛️ FE | `lazy()` sobre `recharts` en el dashboard | ✅ Completada |
| **R28** | 🚀 | ⚛️ FE | Code splitting de las páginas públicas | ✅ Completada |
| **R29** | 📈 | 🔀 FS | Topes de paginación silenciosos en el frontend público | ✅ Completada |
| **R30** | ✨ | ⚛️ FE | `SafeNewsImage` no resetea `hasError` al cambiar `src` | ✅ Completada |
| **R31** | ✨ | ⚛️ FE | Nits agrupados de la revisión final | ✅ Completada |

### Resumen por severidad

| Severidad | Completadas | Total |
|---|---|---|
| 🔴 Blocker | 9 | 9 |
| 🟡 Alto | 17 | 17 |
| 🚀 Optimización alta | 2 | 2 |
| 📈 Optimización media | 2 | 2 |
| ✨ Polish | 2 | 2 |

### Distribución de carga por agente

| Agente | Tareas asignadas | Total |
|---|---|---|
| **🏗️ Backend Architect** | R01, R02, R03, R04, R06, R10, R11, R12, R13, R14, R15, R16, R17, R18 | **14** |
| **⚛️ Frontend Engineer** | R08, R09, R19, R20, R21, R24, R25, R26, R27, R28, R30, R31 | **12** |
| **⚛️ FE + 🎨 UI Designer** | R07 | **1** |
| **🔀 Full-stack (BE + FE)** | R05, R22, R23, R29 | **4** |
| **👁️ Code Reviewer** | Todas al cierre | **31** |

---

## 🧭 Trazabilidad hallazgo → tarea

| Hallazgo de la revisión final | Tarea | Severidad | Agente |
|---|---|---|---|
| PII de menores en `GET /competitions/:id` anónimo | R01 | 🔴 | 🏗️ BE |
| Auditoría salteable con `?x=/auth/` | R02 | 🔴 | 🏗️ BE |
| `@Query()` con tipo intersección → sin validación ni paginación | R03 | 🔴 | 🏗️ BE |
| TOCTOU en la rotación del refresh token | R04 | 🔴 | 🏗️ BE |
| Padrón provincial completo exportable por un DELEGADO | R05 | 🔴 | 🔀 FS |
| Borradores de news/calendar por id y slug sin auth | R06 | 🔴 | 🏗️ BE |
| Sin error boundary → stack trace renderizado en producción | R07 | 🔴 | ⚛️ FE + 🎨 UI |
| Sidebar con fuente de verdad duplicada de roles | R08 | 🔴 | ⚛️ FE |
| Wizard de inscripción contra el techo de `@Max(100)` | R09 | 🔴 | ⚛️ FE |
| `?isActive=false` devuelve los activos | R10 | 🟡 | 🏗️ BE |
| `sortBy` sin whitelist → 500 con rutas y fuente | R11 | 🟡 | 🏗️ BE |
| Sanitizador de auditoría incompleto + PII histórica | R12 | 🟡 | 🏗️ BE |
| Alta de inscripción no transaccional | R13 | 🟡 | 🏗️ BE |
| Tipo de archivo por mimetype del cliente | R14 | 🟡 | 🏗️ BE |
| Inyección de fórmulas en CSV | R15 | 🟡 | 🏗️ BE |
| Respuestas autenticadas sin `no-store` | R16 | 🟡 | 🏗️ BE |
| DNI editable por rol operativo | R17 | 🟡 | 🏗️ BE |
| `ensureBucketIsPrivate` con fallo silencioso | R18 | 🟡 | 🏗️ BE |
| Segundo camino a `/auth/refresh` fuera del single-flight | R19 | 🟡 | ⚛️ FE |
| Búsqueda server-side sin debounce | R20 | 🟡 | ⚛️ FE |
| `getFriendlyError` aplicado a 3 de 14 hooks | R21 | 🟡 | ⚛️ FE |
| Botones de acción sin filtro de rol | R22 | 🟡 | 🔀 FS |
| Localía inferida del orden de `results[]` | R23 | 🟡 | 🔀 FS |
| Token de módulo envenenable con `undefined` | R24 | 🟡 | ⚛️ FE |
| Sesión expirada fuera de `/admin` deja usuario fantasma | R25 | 🟡 | ⚛️ FE |
| Toast de "copiado" sin verificar el portapapeles | R26 | 🟡 | ⚛️ FE |
| `recharts` en el chunk de aterrizaje post-login | R27 | 🚀 | ⚛️ FE |
| Páginas públicas sin code splitting | R28 | 🚀 | ⚛️ FE |
| `limit` fijo con filtrado local en news y calendar | R29 | 📈 | 🔀 FS |
| `hasError` sin sincronizar con la prop `src` | R30 | ✨ | ⚛️ FE |
| Nits varios (key por índice, mes sin año, label, schemas) | R31 | ✨ | ⚛️ FE |

---

## ✅ Lo que la revisión confirmó que quedó bien

Se deja escrito para no volver a auditar lo ya verificado:

- **Backend:** los payloads reducidos por `select` explícito (−73,2 % en `/inscriptions?limit=50`), el streaming de reportes (162 MB de RSS para 20K filas contra 595 MB), el endpoint único `/dashboard/stats` (80 ms en frío, 5-8 ms cacheado), el contrato de la cookie httpOnly, los guardrails de secrets en env, el rate limiting con `trust proxy 1`, y Swagger fuera de producción.
- **Frontend:** cero `console.*` fuera de `logger.ts`, cero `localStorage`/`sessionStorage` con datos de sesión, cero `document.cookie`; **cero `dangerouslySetInnerHTML`** en todo el proyecto; **46 de 46 `useMutation` con `onError`**; `tsc --noEmit` limpio con `noUncheckedIndexedAccess`; **un solo `React.memo`** y ninguno inútil (lo contrario del antipatrón de memoizar por las dudas); el reset de paginación centralizado en `patchFilters`/`clearFilters` en los tres listados que paginan; `safeImageSrc`/`safeExternalUrl` validando sobre el resultado parseado y no sobre substrings; y el `DataTable` con `scope`, `caption` en sr-only, live region con debounce y un solo tab stop por fila.
- **`matchScore.ts`** quedó como arreglo ejemplar: convierte un modo de falla silencioso en un guion visible, distingue el `0` legítimo del dato ausente, y el comentario deja escrito el bug original para que nadie lo reintroduzca.
