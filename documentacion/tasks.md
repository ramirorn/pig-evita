# tasks.md — Refactorización post-auditoría DevSecOps

> **Producto:** Plataforma Integral de Gestión — Juegos Evita Formosa
> **Origen:** Hallazgos de la auditoría DevSecOps del 2026-08-19 (ver `PROCESO.md → sección 4`).
> **Metodología:** Tareas atómicas verticales. Cada tarea es **individualmente verificable** antes de avanzar a la siguiente. Registrar evidencia en `PROCESO.md` al cerrar.

**Convenciones:**
- `[ ]` pendiente · `[~]` en progreso · `[x]` completada
- **DoD** = Definition of Done (criterios de verificación)
- Severidad: 🔴 crítico · 🟡 alto · 🟠 medio · 🚀 optimización alta · 📈 optimización media · ✨ polish

**⚠️ Regla dura:** ninguna tarea 🔴 puede quedar abierta antes de exponer la app fuera de red local.

**Estado al 2026-08-19:** Bloque 1 (críticos) **cerrado** — T01, T02, T03, T04, T11 y T12 completadas y verificadas. La regla dura se cumple: no queda ninguna tarea 🔴 abierta. **Bloque 2 cerrado** — T18, T19, T20, T21, T13, T14, T05, T06, T07, T08 y T09 completadas. **Bloque 3 cerrado** — T22, T23, T24 y T25 completadas. Bloque 4 en curso: **T15, T16 y T17 completadas** — cerrado el polish de seguridad. **T26 completada** y **T27 en revisión** (implementada, pero con la mitad de LOC del DoD sin cumplir). **T10 en revisión** (los 3 archivos del alcance, pero el DoD abarca 15 más). **T28 completada.** Recorrido de tareas terminado. Después el Bloque 4: T15 → T17, T26/T27, T10 y T28.

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
  - ✅ Los tres criterios verificados: contrato de la cookie con 10 tests e2e (`backend/test/auth-cookies.e2e-spec.ts`, incluye que el refresh por header `Authorization` ahora dé 401), y la deduplicación del refresh ejecutando el `client.ts` real contra un servidor de prueba (5 requests concurrentes → **1** llamada a `/auth/refresh`). **Smoke test contra el stack real ejecutado el 2026-08-19**: login del usuario semilla devuelve 200 con `Set-Cookie ... Path=/api/v1/auth; HttpOnly; SameSite=Strict` y un body con sólo `accessToken` y `user`. Evidencia en `PROCESO.md → sección 4 → T03 (post-auditoría)`.

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

- [x] **Descripción:** La segunda pasada detectó **20+ ubicaciones** con `console.error` sin condicional. Reemplazar todos por `toast.error(...)` + `if (import.meta.env.DEV) console.error(err)`. Incluir también los `.catch(console.error)` (ej. `NewsDetailPage.tsx:42`).
- **Archivos afectados (parciales):**
  - `frontend/src/pages/public/InscriptionPage.tsx:167`
  - `frontend/src/pages/public/NewsDetailPage.tsx:42`
  - `frontend/src/pages/admin/CompetitionDetailPage.tsx:63`
  - `frontend/src/pages/admin/InscriptionDetailPage.tsx:55, 63, 76`
  - `frontend/src/pages/admin/CategoriesAdminPage.tsx:79`
  - `frontend/src/pages/admin/ReportsPage.tsx:179`
  - `frontend/src/pages/admin/VenuesAdminPage.tsx:108`
  - Resto: grep exhaustivo al ejecutar la tarea.
- **DoD:** grep `console\.(error|log|debug|info)` en `frontend/src/` fuera de bloques `if (import.meta.env.DEV)` no arroja resultados. ✅ Cumplido: queda **una sola** aparición de `console.error` en todo `src/`, dentro del guard, en el nuevo `src/lib/logger.ts`. **Desvío deliberado del enunciado:** no se agregó `toast.error(...)` en los 22 sitios — se verificó hook por hook que **21 de 22** ya notifican vía el `onError` de las mutaciones, así que hacerlo habría mostrado **dos mensajes por el mismo error**. Sólo se agregó toast en el único sitio que se tragaba el error en silencio (`NewsDetailPage.handleShare`, con `AbortError` exceptuado para no avisar cuando la persona cancela deliberadamente). Evidencia en `PROCESO.md → sección 4 → T08 (post-auditoría)`.

---

## Fase 3 — Medios

### T09 🟠 🏗️ BE — Endurecer CORS y CSP (M-02, M-03)

- [x] **Descripción:** En `main.ts` (a) fallar si `CORS_ORIGINS` no está seteado en producción; (b) configurar `helmet` con CSP explícito, HSTS y `crossOriginResourcePolicy: same-site`.
- **Archivos:** `backend/src/main.ts:23-36` (CORS) y `:28` (helmet)
- **DoD:** curl con `Origin: https://evil.com` recibe respuesta sin `Access-Control-Allow-Origin`. Headers de respuesta incluyen `Content-Security-Policy` y `Strict-Transport-Security`. ✅ Verificado con 23 tests e2e (`backend/test/security-headers.e2e-spec.ts`). El punto (a) **ya lo cubría T04**, pero al verificarlo aparecieron dos agujeros reales que sí se arreglaron: `CORS_ORIGINS=` vacía pasaba la validación y dejaba la app arriba con CORS roto **sin ningún mensaje**, y el `split(',')` sin trim descartaba en silencio todo origen escrito después de un espacio. CSP de la API: `default-src 'none'` (una respuesta JSON no renderiza nada), con excepción **por ruta** para la UI de Swagger que ni se construye en producción. HSTS de 1 año **sin `preload`**, por ser una decisión irreversible del dominio y no de la API. Evidencia en `PROCESO.md → sección 4 → T09 (post-auditoría)`.

### T10 🟠 ⚛️ FE + 🎨 UI — Descomponer componentes React monolíticos (M-01)

- [x] **Descripción:** Refactorizar los 3 archivos >300 líneas extrayendo custom hooks y sub-componentes.
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
- **DoD:** ningún archivo en `frontend/src/pages/` supera 250 líneas. Ninguna página llama a `apiClient` directamente (todo vía hooks). ⚠️ **DoD cumplido a medias.** ✅ Los 3 archivos del alcance quedaron **muy** por debajo del objetivo de 200: `CalendarEventForm` **555 → 122**, `VenuesAdminPage` **409 → 113**, `InscriptionPage` **434 → 130**. ✅ La segunda mitad (ninguna página llama a `apiClient`) **ya se cumplía** antes de empezar. ❌ **«Ningún archivo en `pages/` supera 250 líneas»: NO cumplido.** El DoD abarca mucho más que la descripción: eran **18** archivos por encima, no 3, y quedan **15** fuera del alcance de esta tarea (`ReportsPage` 349, `VenueForm` 348, `DelegateInscriptionPage` 331, `CalendarPage` 330, `UserForm` 326, `CompetitionForm` 326, `TeamsAdminPage` 322, `NewsPage` 311, `HomePage` 303, `CalendarAdminPage` 298, `ParticipantsPage` 272, `CompetitionDetailPage` 267, `ParticipantForm` 265, `InscriptionDetailPage` 252, `DashboardPage` 251). Verificado sin regresión comparando el markup **antes y después** con `renderToStaticMarkup`: **748 líneas idénticas**, y las 44 que difieren contienen todas un id de `useId`. Evidencia en `PROCESO.md → sección 4 → T10 (post-auditoría)`. **ACTUALIZACIÓN (2026-08-19): cumplido.** En cuatro rondas posteriores se descompusieron los 14 archivos restantes, con comparación de markup en cada una. Destacados: `ReportsPage` 349→**57**, `DelegateInscriptionPage` 331→**45**, `HomePage` 303→**34**, `CalendarPage` 330→**86**, `CompetitionDetailPage` 267→**99**. `DelegateInscriptionPage` bajó tanto porque **duplicaba línea por línea el asistente público** y las copias ya divergían. De paso se resolvió el problema de tipos RHF/Zod: `src/` pasó de **~69 `any` a 26**. **Única excepción, sostenida con argumento:** `EventScheduleFields` queda en 253 — una sola responsabilidad con estado compartido; la salida fácil de mover helpers a otro módulo se evaluó y se descartó por ser *«mover líneas para que dé el número»*.

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
- **DoD:** flujo manual: login como A → visitar `/admin/inscripciones` → logout → login como B → visitar `/admin/inscripciones` → el Network tab muestra request nuevo (no cache hit); React Query DevTools muestra 0 queries en el momento del logout. ✅ Invariante verificado de forma automatizada sobre el módulo real (`lib/queryClient.ts`): tras el cambio de sesión quedan **0 queries** en cache y una request en vuelo que resuelve *después* del logout ya no la repuebla. **Reverificado el 2026-08-19 contra el backend real**, contando las requests que salen: tras el logout la cache queda en 0 y la visita del usuario B dispara 3 requests nuevas. Evidencia en `PROCESO.md → sección 4 → T12 (post-auditoría)`.

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

- [x] **Descripción:** Endurecer las validaciones cliente para reducir 400s y mejorar UX:
  - `dni`: agregar refine que rechace `00000000`, `11111111`, etc. (dígitos repetidos).
  - `phone`: si viene, exigir `.min(8).max(20)` y regex `^[\d+\s\-()]+$`.
  - `birthDate`: exigir año entre 1920 y hoy - 5 años (ningún participante nace en el futuro ni tiene 100 años).
  - Auditar el resto de `schemas/index.ts` con el mismo criterio.
- **⚠️ Alineación con el backend (dejada por T24):** la regla de DNI vive ahora en `backend/src/common/validators/dni.validator.ts` (`DNI_REGEX` + `@IsDni()`), y hay un test que documenta el hueco a propósito (`'todavía acepta dígitos repetidos (pendiente de T15)'`) para que **la regla se endurezca en los dos lados a la vez**. Ojo: ese decorador lo comparte el endpoint público de inscripción por QR. El teléfono hoy **no tiene validación en el servidor**.
- **Archivos:** `frontend/src/schemas/index.ts:47-58`
- **DoD:** todos los schemas tienen constraints mínimas + máximas + refinamientos lógicos donde aplica. ✅ Los 11 schemas revisados, verificados con **78 aserciones** sobre los schemas reales (78 OK / 0 fallas). Se corrigieron además tres casos donde el frontend era **más laxo** que el backend y generaban 400s reales: `password` en `min(6)` contra `@MinLength(8)`, `capacity` aceptando decimales y negativos, y sobre todo `email: ''` — `@IsOptional()` sólo saltea `null`/`undefined`, así que un string vacío llegaba a `@IsEmail()` y devolvía 400 con el campo visualmente vacío. Los campos sin límite justificable quedaron sin tocar y documentados. ⚠️ Al auditar apareció un **bug grave preexistente**: el alta de equipos manda `disciplineId`, que `CreateTeamDto` no declara, así que con `forbidNonWhitelisted` devuelve 400 (ver `PROCESO.md`). Evidencia en `PROCESO.md → sección 4 → T15 (post-auditoría)`.

### T16 🟠 ⚛️ FE — Sanitizar mensajes de error del backend antes de mostrarlos al usuario (F13)

- [x] **Descripción:** Los `onError` de los mutations muestran `error?.response?.data?.message` crudo en el toast. Si el backend filtra mensajes de Prisma, stack traces o detalles internos, se exponen al usuario. Fix: crear helper `getFriendlyError(error, fallback: string)` en `lib/utils.ts` que:
  - Solo muestre el `message` si el `error.response.status` está en un whitelist seguro (400, 409, 422 son safe; 500/502 muestra `fallback`).
  - Trunque el mensaje a 200 chars.
  - Bloquee mensajes que contengan patrones de leak (`prisma`, `Error:`, `at Object.`, `sql`, etc.) → usa `fallback`.
- **Archivos:**
  - `frontend/src/lib/utils.ts` (nuevo helper)
  - `frontend/src/hooks/useCalendar.ts:66-70`
  - `frontend/src/hooks/useCompetitions.ts:58-62`
  - `frontend/src/hooks/useInscriptions.ts:57-59`
  - Resto de hooks con `onError` en callbacks.
- **DoD:** simular respuesta 500 con `{ message: "PrismaClientKnownRequestError: ..." }` → el toast muestra el fallback, no el mensaje crudo. ✅ Verificado con 37 casos sobre el helper real (todos OK). Whitelist ampliada a `400, 403, 404, 409, 422`: un 403 «no tenés permisos» y un 404 «no existe» dicen *qué* no se puede hacer sin revelar nada, y esconderlos deja al usuario sin saber si el problema es de permisos o de datos. El truncado **no parte mensajes**: agrega los que entran completos y avisa «(y N más)», porque un «La contraseña debe tener al me…» es peor que no mostrarlo. De los **34 `onError`**, sólo **6** mostraban el crudo; los otros 28 quedaron con su texto fijo. Efecto colateral: desaparecieron los últimos `any` de los hooks. **Nota:** el `GlobalExceptionFilter` ya reemplaza los 5xx por un genérico en producción, así que este helper es la segunda capa — cubre desarrollo y las `HttpException` con detalle interno que salgan con status «seguro». Evidencia en `PROCESO.md → sección 4 → T16 (post-auditoría)`.

### T17 🟠 ⚛️ FE — Validar schema de URLs dinámicas en `href` (F15)

- [x] **Descripción:** Los `href` construidos con datos del backend (`venue.address`, `venue.locality`) van a Google Maps. Aunque `encodeURIComponent()` mitiga la mayoría, no valida schema. Fix: crear helper `safeExternalUrl(base: string, params: Record<string,string>): string | null` que retorna `null` si el resultado no empieza con `https://` o si algún parámetro contiene `javascript:`, `data:`, `vbscript:`. El componente muestra el link solo si el helper devuelve string.
- **Archivos:**
  - `frontend/src/lib/utils.ts` (nuevo helper)
  - `frontend/src/pages/admin/VenuesAdminPage.tsx:207-208`
  - `frontend/src/pages/public/VenuesPage.tsx:66`
- **DoD:** inyectar `javascript:alert(1)` en el campo `address` de una sede → el link "Ver en Google Maps" no se renderiza (o se renderiza deshabilitado). ✅ Verificado renderizando las páginas reales con `react-dom/server`. **La premisa no era una vulnerabilidad activa:** los dos `href` ya usaban `encodeURIComponent()` sobre una base `https://` hardcodeada, así que el payload quedaba codificado en el query string (verificado *antes* de tocar el código). **El riesgo real estaba en otro lado:** `news.imageKey` es texto libre del backend usado como la URL **entera** en tres `<img src>` (`HomePage`, `NewsPage`, `NewsDetailPage`) — un `data:` URI llegaba entero al DOM; el `javascript:` sólo lo frenaba React, no código propio. Se agregó `safeImageSrc` además de `safeExternalUrl`. Los falsos positivos se resuelven por **borde de schema RFC 3986**, no por substring: «Barrio Los Datos 123» y «Avenida Nodata: 500» pasan. ⚠️ Cambio visible: `safeImageSrc` rechaza `http://` absolutas, así que una noticia con imagen por HTTP pasa a mostrar el placeholder. Evidencia en `PROCESO.md → sección 4 → T17 (post-auditoría)`.

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
- **DoD:** Network tab de DevTools: al navegar entre pantallas admin en 2-3 min, `disciplines` y `categories` no se re-fetchean. ✅ Verificado ejecutando el `queryClient` y las key factories reales: 6 navegaciones admin seguidas generan **1** request de `disciplines` y **1** de `categories` (contra **6** con el `staleTime: 0` anterior), los datos volátiles siguen revalidando a los 30 s, y ningún hook quedó sin declarar frescura. **Reverificado el 2026-08-19 contra el backend real**: 6 navegaciones admin seguidas generan **3 requests en total** (sin el `staleTime` serían 18). Evidencia en `PROCESO.md → sección 4 → T19 (post-auditoría)`.

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

- [x] **Descripción:** `DashboardPage` dispara 8 `useQuery` para contar inscripciones por estado, participantes, teams, competitions. Consolidar en un endpoint backend `GET /dashboard/stats` que ejecute todas las cuentas en una sola query Prisma con `count` + `groupBy`. Cachear el resultado en Redis con TTL 60s. Frontend consume con un solo `useDashboardStats()`.
- **Reparto:**
  - **🏗️ BE:** crea el endpoint + cache Redis.
  - **⚛️ FE:** crea el hook `useDashboardStats` y refactoriza `DashboardPage`.
- **Archivos:**
  - `backend/src/modules/dashboard/dashboard.service.ts` (nuevo o refactor)
  - `backend/src/modules/dashboard/dashboard.controller.ts`
  - `frontend/src/hooks/useDashboardStats.ts` (nuevo)
  - `frontend/src/pages/admin/DashboardPage.tsx:27-34` (reemplazar 8 hooks por 1)
- **DoD:** Network tab: cargar el Dashboard genera **1 request** (contra 8+). Tiempo total <200ms. ✅ **1 request** verificado por la cadena mecánica: la página importa un solo hook de datos, el hook tiene un solo `useQuery` y la API hace una sola llamada. ✅ **<200 ms medido contra el stack real: 80 ms en frío y 5-8 ms con cache de Redis.** El endpoint **ya existía** con cache Redis, pero el frontend nunca lo consumía y al payload le faltaban las inscripciones por estado (4 de los 8 requests) y las recientes; TTL bajado de 300s a 60s. 16 tests e2e nuevos en `backend/test/dashboard-stats.e2e-spec.ts`. Evidencia en `PROCESO.md → sección 4 → T22 (post-auditoría)`.

### T23 📈 🏗️ BE — Streaming + paginación en reports Excel/CSV (Q5, Q23)

- [x] **Descripción:** `reports.service.ts` construye todo el workbook en memoria antes de enviar. Con 10K+ filas, riesgo de OOM. Refactor:
  - Cambiar `writeBuffer()` por `workbook.xlsx.write(res)` stream directo al response.
  - Para queries grandes, iterar con cursor Prisma (`prisma.$queryRaw` con `LIMIT/OFFSET` o `cursor`-based pagination) y escribir filas al workbook de a lotes de 1000.
- **Archivos:** `backend/src/modules/reports/reports.service.ts:26-97` y demás métodos `getXxxData`.
- **DoD:** generar un reporte de 20K filas mantiene RSS del proceso <300MB (medir con `process.memoryUsage()`). ✅ **162 MB** contra los **595 MB** de la implementación anterior, que no cumplía el DoD (medido con `node backend/test/reports-memoria-manual.js 20000`, un proceso por caso y la versión vieja como testigo). El Δheap se aplana al escalar (44 → 52 → 55 MB para 20k/50k/100k filas): lo vivo a la vez lo fija el lote de 1000, no el total. 18 tests e2e deterministas, verificados en 10 corridas seguidas. Evidencia en `PROCESO.md → sección 4 → T23 (post-auditoría)`.

### T24 📈 🏗️ BE — DRY backend: validators, DTOs con `PartialType`, includes reusables (Q13, Q15)

- [x] **Descripción:**
  - Extraer validadores repetidos (DNI regex, phone regex, email) a `backend/src/common/validators/` y crear decorators `@IsDni()`, `@IsPhone()` que envuelvan `@Matches` + `@IsString`.
  - Verificar que todos los `UpdateXxxDto` usen `PartialType(CreateXxxDto)` en lugar de duplicar campos.
  - Consolidar objetos `include`/`select` repetidos en `common/prisma-selects.ts` (ya cubierto por T21).
- **Archivos:**
  - `backend/src/common/validators/dni.validator.ts` (nuevo)
  - `backend/src/common/validators/phone.validator.ts` (nuevo)
  - `backend/src/modules/*/dto/*.dto.ts` (aplicar)
- **DoD:** grep `Matches\(\/\^\\d\{7,8\}\$` en `backend/src/modules/` retorna 0 resultados (todo usa `@IsDni()`). ✅ 0 resultados; de hecho no queda ningún `@Matches` en `src/modules/`. **Se hizo sólo `@IsDni()`:** el agente declinó `@IsPhone()` y el de email con argumento — hoy no hay ninguna regla de teléfono que centralizar (los dos usos son `@IsOptional() @IsString()`), así que el decorador sería una trampa para el próximo que le meta un regex adentro y endurezca en silencio el endpoint público. `UpdateResultDto` se deja sin `PartialType` porque **no existe `CreateResultDto` y no debería**: los `Result` los crea el motor de competencia, no la API. 34 tests, incluida una clase de control que compara mensaje por mensaje contra los decoradores inline previos. Evidencia en `PROCESO.md → sección 4 → T24 (post-auditoría)`.

### T25 📈 🏗️ BE — Consolidar auditoría: interceptor vs llamadas manuales (Q10)

- [x] **Descripción:** El `AuditInterceptor` audita CRUD genérico, pero varios services también invocan `auditService.log()` manualmente → doble registro o registros huérfanos. Definir contrato:
  - Interceptor cubre CREATE / UPDATE / DELETE automáticamente vía decorador `@Audit(entity)`.
  - Services solo llaman manual para eventos no-CRUD (LOGIN, LOGOUT, REFRESH_TOKEN, APPROVE_INSCRIPTION, REJECT_INSCRIPTION).
- Documentar el contrato en `common/decorators/audit.decorator.ts` con JSDoc.
- **Archivos:**
  - `backend/src/modules/audit/audit.interceptor.ts`
  - Todos los services que llaman `auditService.log()` (revisar auth, users, inscriptions).
- **DoD:** al crear una inscripción, `SELECT COUNT(*) FROM AuditLog WHERE entityId = 'X'` devuelve exactamente 1 registro (no 2). ✅ Verificado con 14 tests e2e (`backend/test/audit-contract.e2e-spec.ts`). **La premisa del hallazgo no se sostenía:** nunca hubo doble registro, porque el interceptor excluía `/auth/` y las dos vías eran disjuntas por construcción. Y el DoD era **imposible de cumplir**: en un `POST` la URL no tiene id, así que `parseUrl()` devolvía `entityId: null` para **todo CREATE** — el `COUNT(*)` daba **0**, no 2. Corregido tomando el id de la respuesta. El valor real quedó en: saneamiento **profundo** de `changes` movido a `AuditService.log()` (punto de entrada único), con secretos redactados y PII **enmascarada y no borrada** para no perder la capacidad de detectar credential stuffing; `REFRESH_TOKEN_REUSE` y `REFRESH_TOKEN_DENIED` nuevos; y `AuthService.logAuditAction` eliminado. **Se mantiene opt-out**: con opt-in, un endpoint sin decorar deja de auditarse *en silencio* — ruido mal etiquetado es recuperable, ceguera no. Evidencia en `PROCESO.md → sección 4 → T25 (post-auditoría)`.

### T26 ✨ ⚛️ FE — Memoización de valores derivados en páginas admin (Q18, Q19, Q20)

- [x] **Descripción:** Varios páginas construyen arrays/objetos inline en cada render (causan re-renders de hijos memoizados):
  - `DashboardPage.tsx:38-43` — array `stats` → `useMemo`.
  - `InscriptionsPage.tsx:45-56` — función `getStatusBadge` inline → extraer a componente memoizado `<InscriptionStatusBadge>` (cubre también Q28).
  - `CompetitionDetailPage.tsx:67-74` — `matchesByRound` inline → `useMemo`.
- **Archivos:** los tres mencionados.
- **DoD:** React DevTools Profiler muestra reducción medible de re-renders al cambiar filtros en `InscriptionsPage`. ⚠️ **El Profiler no se pudo correr** (no hay navegador ni runner con DOM). Se verificó **el mecanismo que el Profiler observaría**, con 12 chequeos: `InscriptionStatusBadge` es un `memo` real con comparación shallow, todas sus props son primitivas y `shallowEqual` entre renders da **`true`** (el bailout ocurre) y `false` cuando cambia el estado. Se memoizaron **3** sitios y se **descartaron 10** con argumento escrito: los `filtered` de 7 páginas dependen de `search`, que es *exactamente* lo que dispara el re-render, así que el memo sería costo puro; y el array `stats` del dashboard tendría como única dep lo único que cambia, o sea que **nunca acertaría**. Cambio visible: `InscriptionDetailPage` mostraba el enum crudo (`PENDIENTE`) y ahora usa la etiqueta en castellano, igual que la tabla (Q28). Evidencia en `PROCESO.md → sección 4 → T26 (post-auditoría)`.

### T27 ✨ 🎨 UI + ⚛️ FE — DRY frontend: `<DataTable>`, `<ConfirmDialog>`, `<TableSkeleton>` reusables

- [x] **Descripción:** Todas las páginas admin de listado (`ParticipantsPage`, `VenuesPage`, `NewsPage`, `UsersPage`, `InscriptionsPage`) reimplementan la misma tabla con paginación, skeleton, empty state y confirmación de borrado. Extraer a:
  - `components/shared/DataTable.tsx` — recibe `columns`, `data`, `pagination`, `isLoading`.
  - `components/shared/ConfirmDialog.tsx` — dialog genérico para "¿Confirmás borrar X?".
  - `components/shared/TableSkeleton.tsx` — skeleton estándar.
- **Reparto:**
  - **🎨 UI** define el sistema de tokens, estados (default/hover/disabled/loading/empty), variantes y accesibilidad (foco, ARIA, contraste WCAG AA).
  - **⚛️ FE** implementa la API tipada, integra con TanStack Query, migra una página de prueba.
- Migrar 1 página a modo de prueba (recomiendo `VenuesAdminPage` porque también beneficia a T10).
- **Archivos:** `frontend/src/components/shared/*` (nuevos), 1 página migrada.
- **DoD:** LOC total del frontend en `pages/admin/` disminuye ≥15% tras migrar 3 páginas. Componentes cumplen WCAG AA (contraste + navegación por teclado). ⚠️ **DoD cumplido a medias — se registra el fallo.** ✅ **WCAG AA verificado** con 55 chequeos sobre el componente real (semántica, foco, `role="status"`/`alert`, y que vacío-por-filtro ≠ vacío-sin-datos). ❌ **La métrica de LOC NO se cumple y va en dirección contraria: 7238 → 7327 (+89 líneas)**, más 405 nuevas en `shared/DataTable.tsx`. Era además **aritméticamente imposible**: 15% de 7238 son 1086 líneas, y las 3 páginas de listado más grandes suman 940. De esas +89, ~55 son **funcionalidad que antes no existía** (estado de error con `refetch` —ninguna de las 8 páginas lo tenía, un backend caído se veía como «sin datos»—, la distinción vacío-por-filtro y los `aria-label`). La métrica que sí mide el valor: el **andamiaje repetido** de las 3 páginas migradas pasó de 35/42/35 líneas a **0/2/0**, y quedan **192 líneas** absorbibles en las 5 páginas sin migrar. **Queda a decisión del equipo:** migrar las 5 restantes (el equilibrio en LOC llegaría cerca de la 6ª-8ª página) o dar por buena la métrica de andamiaje. Evidencia en `PROCESO.md → sección 4 → T27 (post-auditoría)`. **ACTUALIZACIÓN (2026-08-19): se migraron las 8 páginas y el criterio de LOC quedó refutado empíricamente.** Las 5 restantes pasaron de 1080 a 1223 líneas; `pages/admin/` de 7297 a 7440. Balance de las 8: **+232**. Descontando comentarios y blancos tampoco baja. El agente refutó su propia estimación: *«mi estimación de 6ª u 8ª página estaba mal; no hay una 9ª que lo dé vuelta. T27 no se justifica por LOC y no debería haberse vendido así»*. El motivo: se borran ~40 líneas de andamiaje por página y entran ~30 de objetos de columna más ~22 de props — **da parejo antes de sumar funcionalidad**. **Lo que sí entregó:** listados con estado de error y reintento **0/8 → 8/8**; que distinguen vacío-por-filtro **1/8 → 8/8**; con semántica de tabla accesible **0/8 → 8/8**. `<DataTable>` no necesitó ni un cambio para las 5 nuevas. Se marca **completada con desviación documentada**: no queda trabajo que cumpla ese criterio.

### T28 ✨ 🔀 FS — Polish: `noUncheckedIndexedAccess`, límites en pagination, retry en MinIO (Q24, Q26, Q27)

- [x] **Descripción:**
  - **⚛️ FE:** `tsconfig.app.json` agregar `"noUncheckedIndexedAccess": true` y arreglar los TS errors que aparezcan (usualmente `arr[0]` pasa a `arr[0] | undefined`).
  - **🏗️ BE:** `PaginationQueryDto` agregar `@Min(1) @Max(200)` a `pageSize` (evita `?pageSize=99999`).
  - **🏗️ BE:** `MinioService` envolver operaciones críticas con retry (max 3, exponential backoff) usando `p-retry` o implementación propia.
- **Archivos:**
  - `frontend/tsconfig.app.json`
  - `backend/src/common/dto/pagination.dto.ts`
  - `backend/src/modules/documents/minio.service.ts`
- **DoD:** frontend compila con la flag nueva. `GET /participants?pageSize=99999` devuelve 400. Test unit de MinIO que forza fallo transitorio pasa tras retries. ✅ Los tres criterios. La flag dio **4 errores** y arreglarlos destapó un **bug de runtime que la flag no marcaba**: los atajos de duración del formulario de eventos protegían los minutos pero no las horas, así que con un `startTime` mal formado escribían literalmente `"NaN:00"`. Cero `!`, `as` o `any` agregados. **El tope de paginación NO se subió de 100 a 200:** ya existía sobre `limit` (el campo `pageSize` del enunciado no existe), y subirlo habría sido *aflojar* un límite — «una regresión de seguridad disfrazada de cumplimiento». `?limit=99999` da 400 por rango y `?pageSize=99999` da 400 por `forbidNonWhitelisted`: dos defensas distintas. Retry de MinIO con **allowlist** de errores transitorios (ante error desconocido **no** se reintenta), sin `p-retry` para no repetir el peaje de ESM que ya pagó `uuid`, y con jitter para que varias instancias no vuelvan a tirar MinIO al recuperarse. 12 tests nuevos (22 → 34). Evidencia en `PROCESO.md → sección 4 → T28 (post-auditoría)`.

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

> Actualizado el 2026-08-19. Cada tarea tiene su bloque de evidencia en
> `PROCESO.md → sección 4` y su propio commit.

**Progreso: 28 de 28 tareas completadas.**
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
| **T08** | 🟡 | ⚛️ FE | Silenciar `console.error` en producción del frontend | ✅ Completada |
| **T09** | 🟠 | 🏗️ BE | Endurecer CORS y CSP | ✅ Completada |
| **T10** | 🟠 | ⚛️ FE + 🎨 UI | Descomponer componentes React monolíticos | ✅ Completada |
| **T11** | 🔴 | ⚛️ FE | Sanitizar HTML del backend antes de renderizar con `dangerouslySetInnerHTML` | ✅ Completada |
| **T12** | 🔴 | ⚛️ FE | Limpiar cache de React Query en logout | ✅ Completada |
| **T13** | 🟡 | ⚛️ FE | Namespace de queryKeys por userId | ✅ Completada |
| **T14** | 🟡 | ⚛️ FE | `ProtectedRoute`: exigir `allowedRoles` explícito por ruta admin | ✅ Completada |
| **T15** | 🟠 | ⚛️ FE | Fortalecer schemas Zod | ✅ Completada |
| **T16** | 🟠 | ⚛️ FE | Sanitizar mensajes de error del backend antes de mostrarlos al usuario | ✅ Completada |
| **T17** | 🟠 | ⚛️ FE | Validar schema de URLs dinámicas en `href` | ✅ Completada |
| **T18** | 🚀 | 🏗️ BE | Quick wins backend: `compression` + `Cache-Control` en endpoints públicos | ✅ Completada |
| **T19** | 🚀 | ⚛️ FE | Ajustar `staleTime` de React Query por dominio | ✅ Completada |
| **T20** | 🚀 | ⚛️ FE | Code splitting: lazy loading de rutas admin | ✅ Completada |
| **T21** | 🚀 | 🏗️ BE | Reemplazar `include: X: true` por `select` en services | ✅ Completada |
| **T22** | 📈 | 🔀 FS | Endpoint único `/dashboard/stats` reemplaza 8 queries paralelas | ✅ Completada |
| **T23** | 📈 | 🏗️ BE | Streaming + paginación en reports Excel/CSV | ✅ Completada |
| **T24** | 📈 | 🏗️ BE | DRY backend: validators, DTOs con `PartialType`, includes reusables | ✅ Completada |
| **T25** | 📈 | 🏗️ BE | Consolidar auditoría: interceptor vs llamadas manuales | ✅ Completada |
| **T26** | ✨ | ⚛️ FE | Memoización de valores derivados en páginas admin | ✅ Completada |
| **T27** | ✨ | 🎨 UI + ⚛️ FE | DRY frontend: `<DataTable>`, `<ConfirmDialog>`, `<TableSkeleton>` reusables | ✅ Completada |
| **T28** | ✨ | 🔀 FS | Polish: `noUncheckedIndexedAccess`, límites en pagination, retry en MinIO | ✅ Completada |

### Resumen por severidad

| Severidad | Completadas | Total |
|---|---|---|
| 🔴 Crítico | 6 | 6 |
| 🟡 Alto | 6 | 6 |
| 🟠 Medio | 5 | 5 |
| 🚀 Optimización alta | 4 | 4 |
| 📈 Optimización media | 4 | 4 |
| ✨ Polish | 3 | 3 |

### Dos desviaciones documentadas

Ambas tareas están cerradas, pero con un criterio que se apartó del enunciado:

- **T27** — el criterio de LOC quedó **refutado empíricamente**: se migraron las 8
  páginas y el total subió igual. El valor entregado se mide en otra unidad
  (estado de error 0/8 → 8/8, vacío-por-filtro 1/8 → 8/8, semántica de tabla
  accesible 0/8 → 8/8).
- **T10** — cumplido salvo **`EventScheduleFields` (253 líneas)**, que se dejó así
  con argumento sostenido en dos rondas: partirlo daría dos archivos peores que uno.
