# tasks.md — Refactorización post-auditoría DevSecOps

> **Producto:** Plataforma Integral de Gestión — Juegos Evita Formosa
> **Origen:** Hallazgos de la auditoría DevSecOps del 2026-08-19 (ver `PROCESO.md → sección 4`).
> **Metodología:** Tareas atómicas verticales. Cada tarea es **individualmente verificable** antes de avanzar a la siguiente. Registrar evidencia en `PROCESO.md` al cerrar.

**Convenciones:**
- `[ ]` pendiente · `[~]` en progreso · `[x]` completada
- **DoD** = Definition of Done (criterios de verificación)
- Severidad: 🔴 crítico · 🟡 alto · 🟠 medio · 🚀 optimización alta · 📈 optimización media · ✨ polish

**⚠️ Regla dura:** ninguna tarea 🔴 puede quedar abierta antes de exponer la app fuera de red local.

**Estado al 2026-08-19:** Bloque 1 (críticos) **cerrado** — T01, T02, T03, T04, T11 y T12 completadas y verificadas. La regla dura se cumple: no queda ninguna tarea 🔴 abierta. Bloque 2 en curso: **T18, T19, T20, T21, T13, T14, T05, T06 y T07 completadas**; siguen T08 → T09.

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
2. Registra evidencia en `PROCESO.md → sección 4` (prompt + código + correcciones manuales).
3. **Code Reviewer** revisa el diff y firma el cierre (o pide cambios).
4. Se marca la tarea como `[x]` en este archivo.

---

## Fase 1 — Críticos (bloquean despliegue)

### T01 🔴 🔀 FS — Cerrar exposición de PII en endpoint público QR (C-01)

- [x] **Descripción:** Refactorizar `InscriptionsService.findByQr()` para devolver únicamente `firstName + lastName + disciplina + categoría + estado`. Nunca DNI, email, teléfono, fecha de nacimiento ni dirección. Ajustar el frontend `InscriptionInfoPage` a los nuevos campos.
- **Reparto:**
  - **🏗️ BE:** modificar `select` en `findByQr()` y actualizar el tipo de respuesta en el DTO.
  - **⚛️ FE:** actualizar consumidor en `InscriptionInfoPage.tsx` y el tipo en `src/types/`.
- **Archivos:**
  - `backend/src/modules/inscriptions/inscriptions.service.ts:241-257`
  - `frontend/src/pages/public/InscriptionInfoPage.tsx` (si existe consumidor)
- **DoD:** un test e2e comprueba que la respuesta pública **no contiene** `dni`, `email`, `phone`, `birthDate`, `address`. ✅ `backend/test/inscriptions-public.e2e-spec.ts` (4 tests, en verde). Evidencia en `PROCESO.md → sección 4 → T01 (post-auditoría)`.

### T02 🔴 🏗️ BE — Endurecer módulo de documentos MinIO (C-02, C-04)

- [x] **Descripción:** (a) Remover la policy pública del bucket; (b) sanitizar `filename` con regex + `randomUUID()`; (c) validar en constructor que las credenciales no sean `minioadmin`; (d) `uploadFile` devuelve `objectName` y el consumidor sirve todo vía `getPresignedUrl()`.
- **Alternativa aceptable:** dado que MinIO es Out of Scope MVP (ver `spec.md`), desactivar `DocumentsModule` en `app.module.ts` hasta V2 y documentar la decisión en `PROCESO.md`.
- **Archivos:**
  - `backend/src/modules/documents/minio.service.ts`
  - `backend/src/modules/documents/documents.controller.ts`
- **DoD:** intentar acceder a un objeto sin URL presignada devuelve 403 desde MinIO; test unitario cubre el sanitizado de filename (`../../etc/passwd.pdf` → `___.._etc_passwd.pdf`). ✅ Sanitizado cubierto por `backend/src/modules/documents/minio.service.spec.ts` (21 tests). ✅ 403 sin URL pre-firmada verificado contra el MinIO real de `docker-compose.dev.yml` (evidencia en `PROCESO.md → sección 4 → T02 (post-auditoría)`).

### T03 🔴 🔀 FS — Migrar tokens a cookie httpOnly + access token en memoria (C-03, A-03, F17)

- [x] **Descripción:**
  - **🏗️ BE:** modificar `AuthController` para que `login` y `refresh` seteen el `refreshToken` como cookie `httpOnly + secure + sameSite=strict` con `path: /api/v1/auth`. `logout` limpia la cookie. Verificar que `credentials: true` esté en CORS.
  - **⚛️ FE:** eliminar `localStorage.setItem` para tokens **y para `evita_user`** (`auth.store.tsx:97`). `accessToken` vive solo en memoria (variable de módulo en `client.ts`). El objeto `user` se rehidrata al arranque llamando a `/auth/me`, no leyendo `localStorage`. Interceptor 401 llama a `/auth/refresh` con `withCredentials: true`. Reemplazar la lógica de `isRefreshing + failedQueue` por una única `refreshPromise` singleton.
- **Coordinación:** BE mergea primero (contrato de cookie); FE valida en dev con el nuevo backend antes de mergear.
- **Archivos:**
  - `backend/src/modules/auth/auth.controller.ts`
  - `backend/src/modules/auth/auth.service.ts`
  - `frontend/src/api/client.ts`
  - `frontend/src/store/auth.store.tsx`
- **DoD:**
  - `localStorage.getItem('evita_refresh_token')` y `localStorage.getItem('evita_user')` devuelven `null` post-login.
  - `document.cookie` no muestra el refresh token (por `httpOnly`).
  - Requests concurrentes con token expirado disparan **una sola** llamada a `/auth/refresh`.
  - ✅ Los tres criterios verificados: contrato de la cookie con 10 tests e2e (`backend/test/auth-cookies.e2e-spec.ts`, incluye que el refresh por header `Authorization` ahora dé 401), y la deduplicación del refresh ejecutando el `client.ts` real contra un servidor de prueba (5 requests concurrentes → **1** llamada a `/auth/refresh`). Evidencia en `PROCESO.md → sección 4 → T03 (post-auditoría)`.

### T04 🔴 🏗️ BE — Guardrails contra secrets default en env (C-05)

- [x] **Descripción:** Agregar al Zod schema de `config.validation.ts` un `refine` que rechace patrones `change-me`, `minioadmin`, `Admin123`, `password`, `secret`. Regenerar `.env` local con `crypto.randomBytes(64).toString('base64url')`. Actualizar `.env.example` con placeholders explícitos (`<GENERAR-CON-crypto-randomBytes-64>`).
- **Archivos:**
  - `backend/src/config/config.validation.ts`
  - `backend/.env.example`
- **DoD:** intentar levantar el backend con cualquier default histórico falla con mensaje claro apuntando a la variable inválida. ✅ Verificado con 19 tests (`backend/src/config/config.validation.spec.ts`) que cubren los 5 defaults que estuvieron realmente en el repo, y ejecutando `validateEnv` contra el `.env` real. Evidencia en `PROCESO.md → sección 4 → T04 (post-auditoría)`.

---

## Fase 2 — Altos

### T05 🟡 🏗️ BE — Rate limiting en endpoints públicos scrapeables (A-01)

- [x] **Descripción:** Aplicar `@Throttle({ default: { limit: 20, ttl: 60_000 } })` a `inscriptions.findByQr`, `competitions.findAll`, `results.rankings`, `disciplines.findAll` y demás endpoints `@Public()` de lectura.
- **Archivos:** cada controller con endpoints `@Public()` de lectura.
- **DoD:** un script de 30 requests seguidas al mismo endpoint desde la misma IP recibe `429` a partir de la #21. ✅ Verificado con el `ThrottlerGuard` real (`backend/test/public-throttle.e2e-spec.ts`): **20 OK, primer 429 en la #21**. Aplicado a 15 endpoints públicos vía `@PublicReadThrottle()`; `/health` y los de `auth` quedan fuera a propósito. ⚠️ **Depende de T07**: detrás del reverse proxy, sin `trust proxy` el guard ve la IP del proxy y limitaría a todos los visitantes juntos. Evidencia en `PROCESO.md → sección 4 → T05 (post-auditoría)`.

### T06 🟡 🏗️ BE — Ocultar Swagger en producción (A-02)

- [x] **Descripción:** Envolver el bloque `SwaggerModule.createDocument/setup` en `main.ts` con `if (nodeEnv !== 'production')`.
- **Archivos:** `backend/src/main.ts:88-96`
- **DoD:** con `NODE_ENV=production`, `GET /api/docs` devuelve 404. ✅ Verificado con 6 tests e2e (`backend/test/swagger-production.e2e-spec.ts`): 404 en `/api/docs` y en `/api/docs-json` bajo producción, disponible en desarrollo, y `NODE_ENV` ausente tratado como desarrollo. Implementada por el agente **🏗️ Backend Architect**, que extrajo `setupSwagger()` a `src/swagger.ts` para poder testear el DoD. Evidencia en `PROCESO.md → sección 4 → T06 (post-auditoría)`.

### T07 🟡 🏗️ BE — Enriquecer `AuditInterceptor` con IP y User-Agent (A-06)

- [x] **Descripción:** El interceptor debe leer `request.ip` y `request.headers['user-agent']` y pasarlos al `auditService.log()`. Habilitar `app.set('trust proxy', 1)` en `main.ts` para respetar `X-Forwarded-For` detrás del reverse proxy.
- **Archivos:**
  - `backend/src/modules/audit/audit.interceptor.ts` *(la ruta original de esta lista, `common/interceptors/`, estaba desactualizada)*
  - `backend/src/main.ts`
- **DoD:** un registro en `AuditLog` posterior al cambio muestra ambos campos poblados. ✅ Verificado con 6 tests e2e (`backend/test/audit-request-context.e2e-spec.ts`). El interceptor y el modelo **ya registraban ambos campos**; lo que faltaba era `trust proxy` (sin él, detrás de nginx se guardaba la IP del proxy) y los eventos `LOGIN`/`LOGIN_FAILED`/`LOGOUT`, que se auditan a mano en `AuthService` y no llevaban origen. Se usa `trust proxy 1` y no `true` para que un cliente no pueda falsificar su IP; verificado que `docker/nginx/nginx.conf:50` anexa `X-Forwarded-For`. **Con esto queda destrabada T05.** Evidencia en `PROCESO.md → sección 4 → T07 (post-auditoría)`.

### T08 🟡 ⚛️ FE — Silenciar `console.error` en producción del frontend (A-04, F14)

- [ ] **Descripción:** La segunda pasada detectó **20+ ubicaciones** con `console.error` sin condicional. Reemplazar todos por `toast.error(...)` + `if (import.meta.env.DEV) console.error(err)`. Incluir también los `.catch(console.error)` (ej. `NewsDetailPage.tsx:42`).
- **Archivos afectados (parciales):**
  - `frontend/src/pages/public/InscriptionPage.tsx:167`
  - `frontend/src/pages/public/NewsDetailPage.tsx:42`
  - `frontend/src/pages/admin/CompetitionDetailPage.tsx:63`
  - `frontend/src/pages/admin/InscriptionDetailPage.tsx:55, 63, 76`
  - `frontend/src/pages/admin/CategoriesAdminPage.tsx:79`
  - `frontend/src/pages/admin/ReportsPage.tsx:179`
  - `frontend/src/pages/admin/VenuesAdminPage.tsx:108`
  - Resto: grep exhaustivo al ejecutar la tarea.
- **DoD:** grep `console\.(error|log|debug|info)` en `frontend/src/` fuera de bloques `if (import.meta.env.DEV)` no arroja resultados.

---

## Fase 3 — Medios

### T09 🟠 🏗️ BE — Endurecer CORS y CSP (M-02, M-03)

- [ ] **Descripción:** En `main.ts` (a) fallar si `CORS_ORIGINS` no está seteado en producción; (b) configurar `helmet` con CSP explícito, HSTS y `crossOriginResourcePolicy: same-site`.
- **Archivos:** `backend/src/main.ts:23-36` (CORS) y `:28` (helmet)
- **DoD:** curl con `Origin: https://evil.com` recibe respuesta sin `Access-Control-Allow-Origin`. Headers de respuesta incluyen `Content-Security-Policy` y `Strict-Transport-Security`.

### T10 🟠 ⚛️ FE + 🎨 UI — Descomponer componentes React monolíticos (M-01)

- [ ] **Descripción:** Refactorizar los 3 archivos >300 líneas extrayendo custom hooks y sub-componentes.
  - `CalendarEventForm.tsx` (555 → objetivo <200) → extraer `useCalendarEventForm`, `EventFormFields`, `EventVenuePicker`.
  - `InscriptionPage.tsx` (433 → objetivo <200) → extraer `useInscriptionWizard`, `ParticipantStep`, `DisciplineStep`, `ConfirmationStep`.
  - `VenuesAdminPage.tsx` (385 → objetivo <200) → extraer `VenuesTable`, `VenueFormDialog`.
- **Reparto:**
  - **⚛️ FE** lidera la separación en hooks + sub-componentes y el manejo de estado.
  - **🎨 UI** asegura consistencia visual entre los sub-componentes extraídos y aporta variantes accesibles si se descubren huecos.
- **Archivos:**
  - `frontend/src/pages/admin/components/CalendarEventForm.tsx`
  - `frontend/src/pages/public/InscriptionPage.tsx`
  - `frontend/src/pages/admin/VenuesAdminPage.tsx`
- **DoD:** ningún archivo en `frontend/src/pages/` supera 250 líneas. Ninguna página llama a `apiClient` directamente (todo vía hooks).

---

## Fase 4 — Hallazgos frontend (segunda pasada 2026-08-19)

### T11 🔴 ⚛️ FE — Sanitizar HTML del backend antes de renderizar con `dangerouslySetInnerHTML` (F1, F2)

- [x] **Descripción:** Dos páginas públicas renderizan HTML del backend sin sanitizar (`discipline.rules` y `news.content`). Un admin comprometido puede inyectar `<script>` que se ejecuta en el browser de cualquier visitante. Instalar `dompurify` (`npm i dompurify` + `@types/dompurify`) y sanitizar antes del render. Además, evaluar si los campos son texto plano (usar `<p style={{ whiteSpace: 'pre-wrap' }}>` es más seguro que HTML) o realmente necesitan HTML rico (entonces usar DOMPurify).
- **Archivos:**
  - `frontend/src/pages/public/DisciplineDetailPage.tsx:73`
  - `frontend/src/pages/public/NewsDetailPage.tsx:130`
- **DoD:**
  - Un `news.content` con `<img src=x onerror=alert(1)>` NO ejecuta el script tras el render.
  - Test manual con payload XSS estándar (`<script>alert('xss')</script>`, `<svg onload=alert(1)>`, `<iframe src=javascript:alert(1)>`) confirma sanitización.
  - ✅ **Resuelto sin DOMPurify:** se verificó que ambos campos son texto plano (se cargan desde `<textarea>`, columnas `Text`, y se renderizaban con `replace(/
/g, '<br/>')`), así que se eliminó `dangerouslySetInnerHTML` por completo a favor del componente `PlainTextContent` con `whitespace-pre-wrap`. Los 5 payloads se verificaron renderizando los componentes reales con `react-dom/server`. Evidencia en `PROCESO.md → sección 4 → T11 (post-auditoría)`.

### T12 🔴 ⚛️ FE — Limpiar cache de React Query en logout (F3)

- [x] **Descripción:** Cuando el usuario A hace logout y luego el usuario B loguea en el mismo navegador, B ve datos cacheados de A porque `queryClient.clear()` nunca se llama. En `auth.store.tsx:100-107`, después de `authApi.logout()` y antes de limpiar el user, invocar `queryClient.clear()`. Exponer `queryClient` desde `App.tsx` (o crear un módulo `lib/queryClient.ts` singleton) y consumirlo desde el store.
- **Archivos:**
  - `frontend/src/store/auth.store.tsx:100-107`
  - `frontend/src/App.tsx:7-15` (extraer `queryClient` a módulo compartido)
  - `frontend/src/lib/queryClient.ts` (nuevo, singleton)
- **DoD:** flujo manual: login como A → visitar `/admin/inscripciones` → logout → login como B → visitar `/admin/inscripciones` → el Network tab muestra request nuevo (no cache hit); React Query DevTools muestra 0 queries en el momento del logout. ✅ Invariante verificado de forma automatizada sobre el módulo real (`lib/queryClient.ts`): tras el cambio de sesión quedan **0 queries** en cache y una request en vuelo que resuelve *después* del logout ya no la repuebla. El flujo manual en navegador queda como verificación de aceptación. Evidencia en `PROCESO.md → sección 4 → T12 (post-auditoría)`.

### T13 🟡 ⚛️ FE — Namespace de queryKeys por userId (F4, F5, F6, F7)

- [x] **Descripción:** Los `queryKey` de `useInscriptions`, `useParticipants`, `useUsers`, `useTeams` no incluyen el `userId` del usuario autenticado. Aunque T12 mitiga el problema con `clear()` en logout, si dos usuarios comparten sesión el hijack sigue latente. Refactor: convertir `INSCRIPTION_KEYS.list(filters)` en `INSCRIPTION_KEYS.list(userId, filters)` — el hook lee `user.id` del `authStore` y lo pasa al key. Repetir para `PARTICIPANT_KEYS`, `USER_KEYS`, `TEAM_KEYS`.
- **Archivos:**
  - `frontend/src/hooks/useInscriptions.ts:14-26`
  - `frontend/src/hooks/useParticipants.ts:13-34`
  - `frontend/src/hooks/useUsers.ts:13-34`
  - `frontend/src/hooks/useTeams.ts:8-20`
- **DoD:** `queryKey` inspeccionado en React Query DevTools muestra el `userId` como primer segmento. Test manual: dos usuarios distintos que consulten el mismo endpoint con los mismos filtros generan **dos entradas separadas** en el cache. ✅ Verificado con las key factories y un `QueryClient` reales: clave `['inscriptions', <userId>, 'list', {filtros}]`, hash distinto por usuario en los 4 dominios, y **2 entradas separadas** cuando A y B consultan con los mismos filtros. **Desvío deliberado:** el `userId` va en la posición 1 y no en la 0, para no romper `invalidateQueries({ queryKey: ['inscriptions'] })` — hay un chequeo dedicado a eso. Evidencia en `PROCESO.md → sección 4 → T13 (post-auditoría)`.

### T14 🟡 ⚛️ FE — `ProtectedRoute`: exigir `allowedRoles` explícito por ruta admin (F8)

- [x] **Descripción:** Actualmente `ProtectedRoute` renderiza `<>{children}</>` cuando `allowedRoles` es `undefined`. Esto significa que cualquier usuario autenticado (incluso `ARBITRO` u `OPERADOR_MESA`) puede navegar a `/admin/usuarios` o `/admin/auditoria` — el backend rechaza con 403, pero la ruta es alcanzable y el intento queda en logs de error. Fix: (a) hacer `allowedRoles` obligatorio en el tipo TS del componente; (b) en `router.tsx`, envolver cada `/admin/*` con `<ProtectedRoute allowedRoles={[...]}>` explícito basado en los mismos roles que el backend exige.
- **Archivos:**
  - `frontend/src/components/shared/ProtectedRoute.tsx:33-47`
  - `frontend/src/router.tsx` (todas las rutas `/admin/*`)
- **DoD:** un usuario `ARBITRO` navegando a `/admin/usuarios` ve la pantalla "Acceso Denegado" sin que se dispare ninguna request al backend. ✅ Verificado renderizando el `ProtectedRoute` real: `ARBITRO` en `/admin/usuarios` ve "Acceso Denegado" y el contenido de la página **no se renderiza** (por eso no se dispara ninguna request: los hooks sólo corren al montarse). Las **21** rutas admin declaran roles espejados de los `@Roles(...)` del backend, y el tipo TS ahora obliga a declararlos. Evidencia en `PROCESO.md → sección 4 → T14 (post-auditoría)`.

### T15 🟠 ⚛️ FE — Fortalecer schemas Zod (F10, F11, F12)

- [ ] **Descripción:** Endurecer las validaciones cliente para reducir 400s y mejorar UX:
  - `dni`: agregar refine que rechace `00000000`, `11111111`, etc. (dígitos repetidos).
  - `phone`: si viene, exigir `.min(8).max(20)` y regex `^[\d+\s\-()]+$`.
  - `birthDate`: exigir año entre 1920 y hoy - 5 años (ningún participante nace en el futuro ni tiene 100 años).
  - Auditar el resto de `schemas/index.ts` con el mismo criterio.
- **Archivos:** `frontend/src/schemas/index.ts:47-58`
- **DoD:** todos los schemas tienen constraints mínimas + máximas + refinamientos lógicos donde aplica.

### T16 🟠 ⚛️ FE — Sanitizar mensajes de error del backend antes de mostrarlos al usuario (F13)

- [ ] **Descripción:** Los `onError` de los mutations muestran `error?.response?.data?.message` crudo en el toast. Si el backend filtra mensajes de Prisma, stack traces o detalles internos, se exponen al usuario. Fix: crear helper `getFriendlyError(error, fallback: string)` en `lib/utils.ts` que:
  - Solo muestre el `message` si el `error.response.status` está en un whitelist seguro (400, 409, 422 son safe; 500/502 muestra `fallback`).
  - Trunque el mensaje a 200 chars.
  - Bloquee mensajes que contengan patrones de leak (`prisma`, `Error:`, `at Object.`, `sql`, etc.) → usa `fallback`.
- **Archivos:**
  - `frontend/src/lib/utils.ts` (nuevo helper)
  - `frontend/src/hooks/useCalendar.ts:66-70`
  - `frontend/src/hooks/useCompetitions.ts:58-62`
  - `frontend/src/hooks/useInscriptions.ts:57-59`
  - Resto de hooks con `onError` en callbacks.
- **DoD:** simular respuesta 500 con `{ message: "PrismaClientKnownRequestError: ..." }` → el toast muestra el fallback, no el mensaje crudo.

### T17 🟠 ⚛️ FE — Validar schema de URLs dinámicas en `href` (F15)

- [ ] **Descripción:** Los `href` construidos con datos del backend (`venue.address`, `venue.locality`) van a Google Maps. Aunque `encodeURIComponent()` mitiga la mayoría, no valida schema. Fix: crear helper `safeExternalUrl(base: string, params: Record<string,string>): string | null` que retorna `null` si el resultado no empieza con `https://` o si algún parámetro contiene `javascript:`, `data:`, `vbscript:`. El componente muestra el link solo si el helper devuelve string.
- **Archivos:**
  - `frontend/src/lib/utils.ts` (nuevo helper)
  - `frontend/src/pages/admin/VenuesAdminPage.tsx:207-208`
  - `frontend/src/pages/public/VenuesPage.tsx:66`
- **DoD:** inyectar `javascript:alert(1)` en el campo `address` de una sede → el link "Ver en Google Maps" no se renderiza (o se renderiza deshabilitado).

---

## Fase 5 — Optimizaciones (auditoría de performance/DRY 2026-08-19)

> Todas las tareas de esta fase son **ganancias netas** — no degradan funcionalidad, no cambian la API pública ni empeoran claridad del código. Impacto: 🚀 alto · 📈 medio · ✨ polish.

### T18 🚀 🏗️ BE — Quick wins backend: `compression` + `Cache-Control` en endpoints públicos (Q1, Q4, Q7, Q8)

- [x] **Descripción:**
  - Agregar `compression` middleware en `main.ts` antes de `app.listen()`. Reduce 60-70% el payload JSON.
  - Crear `@CacheControl(maxAgeSeconds)` decorator + interceptor que setea header `Cache-Control: public, max-age=N` y aplicarlo a `disciplines.findAll`, `categories.findAll`, `venues.findAll`, `news.findAll` (5-10 min de TTL).
- **Archivos:**
  - `backend/src/main.ts` (agregar `app.use(compression())`)
  - `backend/src/common/decorators/cache-control.decorator.ts` (nuevo)
  - `backend/src/common/interceptors/cache-control.interceptor.ts` (nuevo)
  - Controllers públicos con endpoints casi-estáticos.
- **DoD:**
  - Response headers de un endpoint público muestran `Content-Encoding: gzip` (con `Accept-Encoding: gzip`) y `Cache-Control: public, max-age=600`.
  - Ningún endpoint privado o mutable recibe caché.
  - ✅ Verificado con 7 tests e2e (`backend/test/http-cache.e2e-spec.ts`): payload de 13.830 B → 513 B con gzip, `Cache-Control: public, max-age=600` en el listado público, y tres tests negativos (endpoint sin decorador, endpoint mutable, y request con `Authorization`). Evidencia en `PROCESO.md → sección 4 → T18 (post-auditoría)`.

### T19 🚀 ⚛️ FE — Ajustar `staleTime` de React Query por dominio (Q4, Q14)

- [x] **Descripción:** El `staleTime` global es 30s — demasiado corto para datos casi estáticos. Refactor:
  - Global default: 5 min.
  - Override por dominio: `disciplines`, `categories`, `venues`, `news` → 10 min. `inscriptions`, `participants` → 1-2 min. `results`, `matches` → 30s (más volátil).
  - Agregar `prefetchQuery` en `router.tsx` (loader) para `disciplines` y `categories` — se comparten en muchas páginas admin.
- **Archivos:**
  - `frontend/src/App.tsx:7-15` (defaults globales)
  - `frontend/src/hooks/useDisciplines.ts`, `useCategories.ts`, `useVenues.ts`, `useNews.ts` (overrides)
  - `frontend/src/router.tsx` (loaders con prefetch)
- **DoD:** Network tab de DevTools: al navegar entre pantallas admin en 2-3 min, `disciplines` y `categories` no se re-fetchean. ✅ Verificado ejecutando el `queryClient` y las key factories reales: 6 navegaciones admin seguidas generan **1** request de `disciplines` y **1** de `categories` (contra **6** con el `staleTime: 0` anterior), los datos volátiles siguen revalidando a los 30 s, y ningún hook quedó sin declarar frescura. Evidencia en `PROCESO.md → sección 4 → T19 (post-auditoría)`.

### T20 🚀 ⚛️ FE — Code splitting: lazy loading de rutas admin (Q6)

- [x] **Descripción:** Actualmente `router.tsx` importa las 20+ admin pages estáticamente → el visitante público descarga ~150-200KB de JS admin innecesario. Refactor a `React.lazy()` + `Suspense` boundary por sección admin (`AdminLayout` envuelve el `Outlet` con `<Suspense fallback={<PageSkeleton />}>`).
- **Archivos:**
  - `frontend/src/router.tsx`
  - `frontend/src/components/layout/AdminLayout.tsx` (agregar Suspense)
  - `frontend/src/components/shared/PageSkeleton.tsx` (nuevo, si no existe)
- **DoD:**
  - `npm run build` genera chunks separados por página admin (`DashboardPage-<hash>.js`, `InscriptionsPage-<hash>.js`, etc.).
  - Bundle de entrada para ruta pública `/` no incluye código de admin (verificar con `npm run build -- --report` o `rollup-plugin-visualizer`).
  - ✅ **Entry: 1.269.368 B → 524.305 B (58,7% menos; 358 → 155 kB gzip)**, con 501 KB de código admin repartido en 20 chunks diferidos. Verificado por contenido además de por tamaño: marcadores exclusivos de páginas admin ausentes del entry y presentes en su chunk. Evidencia en `PROCESO.md → sección 4 → T20 (post-auditoría)`.

### T21 🚀 🏗️ BE — Reemplazar `include: X: true` por `select` en services (Q2, Q9, Q11, Q17)

- [x] **Descripción:** Múltiples services traen entidades completas cuando la UI solo necesita 3-4 campos. Aplicar `select` explícito en:
  - `inscriptions.findAll` y `findOne` (participant, category, team, createdBy/reviewedBy/approvedBy).
  - `teams.findAll` y `findOne` (members.participant).
  - `results.rankings` (participant/team).
- Además, extraer los `select` reusables a `backend/src/common/prisma-selects.ts` (`PARTICIPANT_SUMMARY`, `USER_SUMMARY`, `CATEGORY_WITH_DISCIPLINE`) para evitar drift entre módulos.
- **Archivos:**
  - `backend/src/modules/inscriptions/inscriptions.service.ts:194-229`
  - `backend/src/modules/teams/teams.service.ts:92-120`
  - `backend/src/modules/results/results.service.ts`
  - `backend/src/common/prisma-selects.ts` (nuevo)
- **DoD:** payload JSON de `GET /inscriptions?pageSize=50` se reduce ≥30%. Ninguna funcionalidad UI se rompe. ✅ **127.451 B → 34.218 B (73,2% menos)** medido con el `select` real del service aplicado sobre filas completas (`backend/test/payload-size.e2e-spec.ts`). Se recorrieron los consumidores del frontend campo por campo antes de recortar; único ajuste necesario: el listado de equipos pasa a `_count.members`. Evidencia en `PROCESO.md → sección 4 → T21 (post-auditoría)`.

### T22 📈 🔀 FS — Endpoint único `/dashboard/stats` reemplaza 8 queries paralelas (Q3)

- [ ] **Descripción:** `DashboardPage` dispara 8 `useQuery` para contar inscripciones por estado, participantes, teams, competitions. Consolidar en un endpoint backend `GET /dashboard/stats` que ejecute todas las cuentas en una sola query Prisma con `count` + `groupBy`. Cachear el resultado en Redis con TTL 60s. Frontend consume con un solo `useDashboardStats()`.
- **Reparto:**
  - **🏗️ BE:** crea el endpoint + cache Redis.
  - **⚛️ FE:** crea el hook `useDashboardStats` y refactoriza `DashboardPage`.
- **Archivos:**
  - `backend/src/modules/dashboard/dashboard.service.ts` (nuevo o refactor)
  - `backend/src/modules/dashboard/dashboard.controller.ts`
  - `frontend/src/hooks/useDashboardStats.ts` (nuevo)
  - `frontend/src/pages/admin/DashboardPage.tsx:27-34` (reemplazar 8 hooks por 1)
- **DoD:** Network tab: cargar el Dashboard genera **1 request** (contra 8+). Tiempo total <200ms.

### T23 📈 🏗️ BE — Streaming + paginación en reports Excel/CSV (Q5, Q23)

- [ ] **Descripción:** `reports.service.ts` construye todo el workbook en memoria antes de enviar. Con 10K+ filas, riesgo de OOM. Refactor:
  - Cambiar `writeBuffer()` por `workbook.xlsx.write(res)` stream directo al response.
  - Para queries grandes, iterar con cursor Prisma (`prisma.$queryRaw` con `LIMIT/OFFSET` o `cursor`-based pagination) y escribir filas al workbook de a lotes de 1000.
- **Archivos:** `backend/src/modules/reports/reports.service.ts:26-97` y demás métodos `getXxxData`.
- **DoD:** generar un reporte de 20K filas mantiene RSS del proceso <300MB (medir con `process.memoryUsage()`).

### T24 📈 🏗️ BE — DRY backend: validators, DTOs con `PartialType`, includes reusables (Q13, Q15)

- [ ] **Descripción:**
  - Extraer validadores repetidos (DNI regex, phone regex, email) a `backend/src/common/validators/` y crear decorators `@IsDni()`, `@IsPhone()` que envuelvan `@Matches` + `@IsString`.
  - Verificar que todos los `UpdateXxxDto` usen `PartialType(CreateXxxDto)` en lugar de duplicar campos.
  - Consolidar objetos `include`/`select` repetidos en `common/prisma-selects.ts` (ya cubierto por T21).
- **Archivos:**
  - `backend/src/common/validators/dni.validator.ts` (nuevo)
  - `backend/src/common/validators/phone.validator.ts` (nuevo)
  - `backend/src/modules/*/dto/*.dto.ts` (aplicar)
- **DoD:** grep `Matches\(\/\^\\d\{7,8\}\$` en `backend/src/modules/` retorna 0 resultados (todo usa `@IsDni()`).

### T25 📈 🏗️ BE — Consolidar auditoría: interceptor vs llamadas manuales (Q10)

- [ ] **Descripción:** El `AuditInterceptor` audita CRUD genérico, pero varios services también invocan `auditService.log()` manualmente → doble registro o registros huérfanos. Definir contrato:
  - Interceptor cubre CREATE / UPDATE / DELETE automáticamente vía decorador `@Audit(entity)`.
  - Services solo llaman manual para eventos no-CRUD (LOGIN, LOGOUT, REFRESH_TOKEN, APPROVE_INSCRIPTION, REJECT_INSCRIPTION).
- Documentar el contrato en `common/decorators/audit.decorator.ts` con JSDoc.
- **Archivos:**
  - `backend/src/modules/audit/audit.interceptor.ts`
  - Todos los services que llaman `auditService.log()` (revisar auth, users, inscriptions).
- **DoD:** al crear una inscripción, `SELECT COUNT(*) FROM AuditLog WHERE entityId = 'X'` devuelve exactamente 1 registro (no 2).

### T26 ✨ ⚛️ FE — Memoización de valores derivados en páginas admin (Q18, Q19, Q20)

- [ ] **Descripción:** Varios páginas construyen arrays/objetos inline en cada render (causan re-renders de hijos memoizados):
  - `DashboardPage.tsx:38-43` — array `stats` → `useMemo`.
  - `InscriptionsPage.tsx:45-56` — función `getStatusBadge` inline → extraer a componente memoizado `<InscriptionStatusBadge>` (cubre también Q28).
  - `CompetitionDetailPage.tsx:67-74` — `matchesByRound` inline → `useMemo`.
- **Archivos:** los tres mencionados.
- **DoD:** React DevTools Profiler muestra reducción medible de re-renders al cambiar filtros en `InscriptionsPage`.

### T27 ✨ 🎨 UI + ⚛️ FE — DRY frontend: `<DataTable>`, `<ConfirmDialog>`, `<TableSkeleton>` reusables

- [ ] **Descripción:** Todas las páginas admin de listado (`ParticipantsPage`, `VenuesPage`, `NewsPage`, `UsersPage`, `InscriptionsPage`) reimplementan la misma tabla con paginación, skeleton, empty state y confirmación de borrado. Extraer a:
  - `components/shared/DataTable.tsx` — recibe `columns`, `data`, `pagination`, `isLoading`.
  - `components/shared/ConfirmDialog.tsx` — dialog genérico para "¿Confirmás borrar X?".
  - `components/shared/TableSkeleton.tsx` — skeleton estándar.
- **Reparto:**
  - **🎨 UI** define el sistema de tokens, estados (default/hover/disabled/loading/empty), variantes y accesibilidad (foco, ARIA, contraste WCAG AA).
  - **⚛️ FE** implementa la API tipada, integra con TanStack Query, migra una página de prueba.
- Migrar 1 página a modo de prueba (recomiendo `VenuesAdminPage` porque también beneficia a T10).
- **Archivos:** `frontend/src/components/shared/*` (nuevos), 1 página migrada.
- **DoD:** LOC total del frontend en `pages/admin/` disminuye ≥15% tras migrar 3 páginas. Componentes cumplen WCAG AA (contraste + navegación por teclado).

### T28 ✨ 🔀 FS — Polish: `noUncheckedIndexedAccess`, límites en pagination, retry en MinIO (Q24, Q26, Q27)

- [ ] **Descripción:**
  - **⚛️ FE:** `tsconfig.app.json` agregar `"noUncheckedIndexedAccess": true` y arreglar los TS errors que aparezcan (usualmente `arr[0]` pasa a `arr[0] | undefined`).
  - **🏗️ BE:** `PaginationQueryDto` agregar `@Min(1) @Max(200)` a `pageSize` (evita `?pageSize=99999`).
  - **🏗️ BE:** `MinioService` envolver operaciones críticas con retry (max 3, exponential backoff) usando `p-retry` o implementación propia.
- **Archivos:**
  - `frontend/tsconfig.app.json`
  - `backend/src/common/dto/pagination.dto.ts`
  - `backend/src/modules/documents/minio.service.ts`
- **DoD:** frontend compila con la flag nueva. `GET /participants?pageSize=99999` devuelve 400. Test unit de MinIO que forza fallo transitorio pasa tras retries.

---

## Distribución de carga por agente

| Agente | Tareas asignadas | Total |
|---|---|---|
| **🏗️ Backend Architect** | T02, T04, T05, T06, T07, T09, T18, T21, T23, T24, T25 | **11** |
| **⚛️ Frontend Engineer** | T08, T11, T12, T13, T14, T15, T16, T17, T19, T20, T26 | **11** |
| **🎨 UI Designer** | T10 (co-lidera con FE), T27 (co-lidera con FE) | **2** |
| **🔀 Full-stack (BE + FE)** | T01, T03, T22, T28 | **4** |
| **👁️ Code Reviewer** | Todas al cierre | **28** |

---

## Trazabilidad hallazgo → tarea

| Hallazgo auditoría | Tarea | Severidad | Agente |
|---|---|---|---|
| C-01 (PII en QR público) | T01 | 🔴 | 🔀 FS |
| C-02 (bucket MinIO público) | T02 | 🔴 | 🏗️ BE |
| C-04 (path traversal filename) | T02 | 🔴 | 🏗️ BE |
| C-03 (tokens en localStorage) | T03 | 🔴 | 🔀 FS |
| A-03 (race condition refresh) | T03 | 🔴 | 🔀 FS |
| F17 (user object en localStorage) | T03 | 🔴 | 🔀 FS |
| C-05 (secrets default en env) | T04 | 🔴 | 🏗️ BE |
| A-01 (sin throttle en públicos) | T05 | 🟡 | 🏗️ BE |
| A-02 (Swagger en producción) | T06 | 🟡 | 🏗️ BE |
| A-06 (audit sin IP/UA) | T07 | 🟡 | 🏗️ BE |
| A-04 (console.error en prod) | T08 | 🟡 | ⚛️ FE |
| F14 (console.error extendido) | T08 | 🟡 | ⚛️ FE |
| M-02 (CORS default) | T09 | 🟠 | 🏗️ BE |
| M-03 (Helmet sin CSP) | T09 | 🟠 | 🏗️ BE |
| M-01 (componentes >300 LOC) | T10 | 🟠 | ⚛️ FE + 🎨 UI |
| F1, F2 (XSS `dangerouslySetInnerHTML`) | T11 | 🔴 | ⚛️ FE |
| F3 (queryClient no se limpia en logout) | T12 | 🔴 | ⚛️ FE |
| F4–F7 (queryKeys sin userId) | T13 | 🟡 | ⚛️ FE |
| F8 (ProtectedRoute sin allowedRoles) | T14 | 🟡 | ⚛️ FE |
| F10–F12 (schemas Zod débiles) | T15 | 🟠 | ⚛️ FE |
| F13 (errores backend crudos al usuario) | T16 | 🟠 | ⚛️ FE |
| F15 (href sin validación de schema) | T17 | 🟠 | ⚛️ FE |
| Q1, Q4, Q7, Q8 (compression + cache headers) | T18 | 🚀 | 🏗️ BE |
| Q4, Q14 (staleTime + prefetch) | T19 | 🚀 | ⚛️ FE |
| Q6 (lazy loading rutas admin) | T20 | 🚀 | ⚛️ FE |
| Q2, Q9, Q11, Q17 (include → select) | T21 | 🚀 | 🏗️ BE |
| Q3 (dashboard 8→1 query) | T22 | 📈 | 🔀 FS |
| Q5, Q23 (streaming reports) | T23 | 📈 | 🏗️ BE |
| Q13, Q15 (DRY validators + DTOs) | T24 | 📈 | 🏗️ BE |
| Q10 (auditoría duplicada) | T25 | 📈 | 🏗️ BE |
| Q18, Q19, Q20, Q28 (memoización + StatusBadge) | T26 | ✨ | ⚛️ FE |
| DRY frontend (DataTable, ConfirmDialog) | T27 | ✨ | 🎨 UI + ⚛️ FE |
| Q24, Q26, Q27 (tsconfig, pagination max, retry) | T28 | ✨ | 🔀 FS |

---

## Orden de ejecución recomendado

**Bloque 1 — Seguridad crítica (bloquean despliegue fuera de red local):**
1. **T11** (⚛️ FE — XSS en HTML público) — trivial, cierra ejecución de código arbitrario en visitantes anónimos.
2. **T12** (⚛️ FE — cache leak en logout) — chico y bloqueante para uso multi-usuario del mismo navegador.
3. **T03** (🔀 FS — tokens en cookies httpOnly) — mayor blast radius, cierra vector de account takeover vía XSS.
4. **T01** (🔀 FS — PII en QR) — chico, cierra fuga activa de datos personales.
5. **T02** (🏗️ BE) o **desactivar `DocumentsModule`** — MinIO es Out of Scope MVP.
6. **T04** (🏗️ BE — guardrails env) — evita regresiones futuras.

**Bloque 2 — Seguridad alta/media + quick wins de optimización:**
7. **T18** (🏗️ BE — compression + cache headers) — 15 min, gana 60-70% de payload.
8. **T19** (⚛️ FE — staleTime React Query) — 1h, corta 50-100 requests innecesarios por sesión.
9. **T20** (⚛️ FE — lazy loading admin) — 1-2h, corta 150-200KB del bundle público.
10. **T21** (🏗️ BE — include → select) — 1h, reduce payload 30%.
11. **T13, T14** (⚛️ FE — namespace de cache + ProtectedRoute) — completan la fortaleza post-T03.
12. **T05 → T09** (🏗️ BE + ⚛️ FE — rate limiting, Swagger prod, audit IP/UA, console.error, CORS/CSP).

**Bloque 3 — Optimizaciones estructurales:**
13. **T22** (🔀 FS — dashboard stats único) — mejor UX al abrir /admin.
14. **T23** (🏗️ BE — reports streaming) — evita OOM cuando crezca la base.
15. **T24, T25** (🏗️ BE — DRY + auditoría consolidada) — mantenibilidad.

**Bloque 4 — Polish final:**
16. **T15 → T17** (⚛️ FE — validación Zod, sanitización errores, URLs) — polish de seguridad.
17. **T26, T27** (⚛️ FE + 🎨 UI — memoización + componentes reutilizables frontend).
18. **T10** (⚛️ FE + 🎨 UI — descomposición monolitos) — beneficia a T27.
19. **T28** (🔀 FS — tsconfig strict, pagination max, MinIO retry) — cierre.

---

## 📊 Estado de las tareas

> Actualizado el 2026-08-19. Cada tarea completada tiene su bloque de evidencia
> en `PROCESO.md → sección 4` y su propio commit.

**Progreso: 15 de 28 tareas completadas.**
Críticos 🔴: **6 de 6** — la regla dura se cumple, no queda ninguna abierta.

| Tarea | Sev. | Agente | Título | Estado |
|---|---|---|---|---|
| **T01** | 🔴 | 🔀 FS | Cerrar exposición de PII en endpoint público QR | ✅ Completada |
| **T02** | 🔴 | 🏗️ BE | Endurecer módulo de documentos MinIO | ✅ Completada |
| **T03** | 🔴 | 🔀 FS | Migrar tokens a cookie httpOnly + access token en memoria | ✅ Completada |
| **T04** | 🔴 | 🏗️ BE | Guardrails contra secrets default en env | ✅ Completada |
| **T05** | 🟡 | 🏗️ BE | Rate limiting en endpoints públicos scrapeables | ✅ Completada |
| **T06** | 🟡 | 🏗️ BE | Ocultar Swagger en producción | ✅ Completada |
| **T07** | 🟡 | 🏗️ BE | Enriquecer `AuditInterceptor` con IP y User-Agent | ✅ Completada |
| **T08** | 🟡 | ⚛️ FE | Silenciar `console.error` en producción del frontend | ⬜ Pendiente |
| **T09** | 🟠 | 🏗️ BE | Endurecer CORS y CSP | ⬜ Pendiente |
| **T10** | 🟠 | ⚛️ FE + 🎨 UI | Descomponer componentes React monolíticos | ⬜ Pendiente |
| **T11** | 🔴 | ⚛️ FE | Sanitizar HTML del backend antes de renderizar con `dangerouslySetInnerHTML` | ✅ Completada |
| **T12** | 🔴 | ⚛️ FE | Limpiar cache de React Query en logout | ✅ Completada |
| **T13** | 🟡 | ⚛️ FE | Namespace de queryKeys por userId | ✅ Completada |
| **T14** | 🟡 | ⚛️ FE | `ProtectedRoute`: exigir `allowedRoles` explícito por ruta admin | ✅ Completada |
| **T15** | 🟠 | ⚛️ FE | Fortalecer schemas Zod | ⬜ Pendiente |
| **T16** | 🟠 | ⚛️ FE | Sanitizar mensajes de error del backend antes de mostrarlos al usuario | ⬜ Pendiente |
| **T17** | 🟠 | ⚛️ FE | Validar schema de URLs dinámicas en `href` | ⬜ Pendiente |
| **T18** | 🚀 | 🏗️ BE | Quick wins backend: `compression` + `Cache-Control` en endpoints públicos | ✅ Completada |
| **T19** | 🚀 | ⚛️ FE | Ajustar `staleTime` de React Query por dominio | ✅ Completada |
| **T20** | 🚀 | ⚛️ FE | Code splitting: lazy loading de rutas admin | ✅ Completada |
| **T21** | 🚀 | 🏗️ BE | Reemplazar `include: X: true` por `select` en services | ✅ Completada |
| **T22** | 📈 | 🔀 FS | Endpoint único `/dashboard/stats` reemplaza 8 queries paralelas | ⬜ Pendiente |
| **T23** | 📈 | 🏗️ BE | Streaming + paginación en reports Excel/CSV | ⬜ Pendiente |
| **T24** | 📈 | 🏗️ BE | DRY backend: validators, DTOs con `PartialType`, includes reusables | ⬜ Pendiente |
| **T25** | 📈 | 🏗️ BE | Consolidar auditoría: interceptor vs llamadas manuales | ⬜ Pendiente |
| **T26** | ✨ | ⚛️ FE | Memoización de valores derivados en páginas admin | ⬜ Pendiente |
| **T27** | ✨ | 🎨 UI + ⚛️ FE | DRY frontend: `<DataTable>`, `<ConfirmDialog>`, `<TableSkeleton>` reusables | ⬜ Pendiente |
| **T28** | ✨ | 🔀 FS | Polish: `noUncheckedIndexedAccess`, límites en pagination, retry en MinIO | ⬜ Pendiente |

### Resumen por severidad

| Severidad | Completadas | Total |
|---|---|---|
| 🔴 Crítico | 6 | 6 |
| 🟡 Alto | 5 | 6 |
| 🟠 Medio | 0 | 5 |
| 🚀 Optimización alta | 4 | 4 |
| 📈 Optimización media | 0 | 4 |
| ✨ Polish | 0 | 3 |
