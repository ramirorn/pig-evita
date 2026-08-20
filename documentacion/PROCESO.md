# PROCESO.md — Bitácora del desarrollo

> **Producto:** Plataforma Integral de Gestión — Juegos Evita Formosa
> **Propósito:** Este documento es la **bitácora viva** del proyecto. Aquí se registra el proceso real de construcción: qué se investigó, qué prompts se usaron, qué código produjo el agente, qué correcciones manuales fueron necesarias, y qué se aprendió al final.
>
> **Regla de oro:** todo lo que un futuro miembro del equipo (o auditor) necesitaría para reconstruir el "por qué" de una decisión debe estar acá. La trazabilidad prompt → código → corrección es no negociable.

---

## 1. Investigación

> Registrar la investigación previa que fundamenta las decisiones tomadas: benchmarking, análisis de la Secretaría de Deportes, consultas a stakeholders, revisión de sistemas similares.

### 1.1 Contexto del dominio

*(pendiente de completar)*

### 1.2 Referencias consultadas

*(pendiente de completar — links, documentos, entrevistas)*

### 1.3 Restricciones identificadas

*(pendiente de completar — legales, técnicas, de infraestructura del Ministerio)*

---

## 2. Especificación y planificación

> Registrar el proceso de definición del alcance del MVP y las decisiones arquitectónicas mayores.

### 2.1 Decisiones de alcance

*(pendiente — por qué se dejó afuera MinIO, dashboard, reportes, etc.)*

### 2.2 Decisiones arquitectónicas (bitácora complementaria a `plan.md`)

*(pendiente — discusiones que llevaron a los ADR)*

### 2.3 Validación de la spec con el usuario

*(pendiente — fecha, participantes, cambios propuestos, aprobación)*

---

## 3. Setup de infraestructura

> Registrar la instalación paso a paso del stack de desarrollo y cualquier tropiezo enfrentado.

### 3.1 Preparación del entorno local

*(pendiente — versión de Node instalada, Docker Desktop, editor)*

### 3.2 Levantamiento del Docker Compose

*(pendiente — comandos ejecutados, tiempo, errores)*

### 3.3 Configuración de Prisma y primera migración

*(pendiente)*

### 3.4 Configuración de CI/CD

*(pendiente)*

---

## 4. Desarrollo

> **Formato obligatorio:** por cada tarea (T01, T02, ...) de `tasks.md` completada, se agrega un bloque usando la plantilla de abajo. Nada se da por sentado: si se copió un prompt del chat, se pega; si el agente generó código que luego se editó a mano, se documenta.

### Plantilla por tarea

Copiar el bloque siguiente y completarlo cada vez que se cierra una tarea:

```
### T## — <Título de la tarea>

- **Fecha:** YYYY-MM-DD
- **Responsable:** <nombre>
- **Historia(s) cubierta(s):** HU-XX
- **Duración estimada / real:** Xh / Yh

#### Prompt utilizado

> Pegar el prompt (o resumen) enviado al agente de IA. Si hubo varios intentos,
> incluir los iterativos más significativos.

#### Código generado

- **Archivos creados/modificados:**
  - `backend/src/modules/xxx/xxx.service.ts`
  - `frontend/src/hooks/useXxx.ts`
- **Resumen del cambio:** <qué hizo el código generado>

#### Correcciones manuales

> Todo lo que el humano tuvo que ajustar sobre lo generado. Aunque sea trivial,
> se documenta. Ejemplos: cambiar nombre de variable, corregir tipo, agregar
> manejo de un caso borde no cubierto por el prompt, ajustar estilos.

- <correción 1 con path y línea>
- <correción 2>

#### Verificación (DoD)

- [ ] Criterio 1 verificado (cómo)
- [ ] Criterio 2 verificado (cómo)

#### Notas / aprendizajes

> Cualquier observación que ayude al equipo en tareas futuras.
```

---

### T01 — Estructura del monorepo y `.gitignore`

*(pendiente de ejecución — ver `tasks.md`)*

---

### T02 — `docker-compose.dev.yml` con Postgres 16 y Redis 7

*(pendiente de ejecución — ver `tasks.md`)*

---

### T01 (post-auditoría DevSecOps) — Cerrar exposición de PII en endpoint público QR (C-01)

> Corresponde a `tasks.md → Fase 1 → T01`. La numeración de la refactorización
> post-auditoría es independiente de la de setup (T01/T02 de arriba).

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente 🔀 FS: Backend Architect + Frontend Engineer)
- **Hallazgo cubierto:** C-01 (PII en endpoint público QR)
- **Duración estimada / real:** 1h / ~0,5h

#### Prompt utilizado

> @documentacion/tasks.md Procede con la task 01

Contexto derivado de la propia tarea T01: refactorizar `InscriptionsService.findByQr()`
para devolver únicamente `firstName + lastName + disciplina + categoría + estado`,
ajustar el consumidor del frontend y cubrir con un test e2e que verifique la
ausencia de `dni`, `email`, `phone`, `birthDate` y `address`.

#### Código generado

- **Archivos creados/modificados:**
  - `backend/src/modules/inscriptions/inscriptions.service.ts` — `findByQr()` pasa de `include` a `select` mínimo + mapeo explícito de la respuesta.
  - `backend/src/modules/inscriptions/dto/inscriptions.dto.ts` — nuevos `PublicInscriptionDto`, `PublicInscriptionParticipantDto`, `PublicInscriptionCategoryDto`, `PublicInscriptionDisciplineDto`.
  - `backend/src/modules/inscriptions/dto/index.ts` — exports de los DTOs públicos.
  - `backend/src/modules/inscriptions/inscriptions.controller.ts` — tipo de retorno + `@ApiResponse({ type: PublicInscriptionDto })` y descripción del contrato público.
  - `backend/test/inscriptions-public.e2e-spec.ts` *(nuevo)* — 4 casos e2e sobre el endpoint público.
  - `backend/test/jest-e2e.json` — `moduleNameMapper` para `uuid`.
  - `backend/test/mocks/uuid.cjs` *(nuevo)* — shim CJS de `uuid` (v14 es ESM puro y Jest corre en CommonJS).
  - `frontend/src/types/index.ts` — nueva interface `PublicInscription`.
  - `frontend/src/api/inscriptions.api.ts` — `findByQr()` devuelve `PublicInscription`.
  - `frontend/src/pages/public/inscription/TrackInscription.tsx` — consume `PublicInscription`; se eliminan las filas de DNI y Departamento y el detalle del motivo de rechazo.
- **Resumen del cambio:** el endpoint público `GET /inscriptions/qr/:qrCode` ya no
  devuelve el registro completo del participante. El `select` de Prisma pide sólo
  `qrCode`, `status`, `createdAt`, `participant.firstName/lastName`, `category.name`
  y `category.discipline.name`, y el service arma la respuesta con un mapeo
  explícito (segunda barrera ante cambios futuros del `select`).

#### Correcciones manuales

- `backend/test/jest-e2e.json` + `backend/test/mocks/uuid.cjs`: la primera corrida del
  test e2e falló con `SyntaxError: Unexpected token 'export'` porque `uuid@14` es ESM
  puro y Jest transpila a CommonJS. Se intentó primero `transformIgnorePatterns` +
  `allowJs`, que chocó con `moduleResolution: nodenext` del `tsconfig.json`
  (`TS5098`); la solución final fue mapear `uuid` a un shim CJS basado en
  `node:crypto.randomUUID()`, sin tocar código de producción.
- `TrackInscription.tsx`: se decidió **no** exponer `rejectionNote` en la vista
  pública (el código QR no es un secreto: cualquiera que lo escanee puede
  consultarlo, y las notas de rechazo son texto libre escrito por el back-office).
  Se reemplazó por un mensaje genérico que deriva al delegado.
- `TrackInscription.tsx`: también se quitó `department`, que no está en la lista de
  campos permitidos por T01 aunque no figure entre los explícitamente prohibidos.
- Encadenamiento opcional (`participant?.`) reemplazado por acceso directo, ya que
  el nuevo tipo `PublicInscription` garantiza la presencia de esos objetos.

#### Verificación (DoD)

- [x] **Test e2e que comprueba que la respuesta pública no contiene `dni`, `email`, `phone`, `birthDate`, `address`** — `backend/test/inscriptions-public.e2e-spec.ts`. El mock de Prisma devuelve a propósito la fila completa con toda la PII; el test verifica que ni las claves ni los valores aparecen en el JSON de respuesta, que el `select` enviado a Prisma no pide esos campos y que un QR inexistente sigue dando 404.
  - Comando: `npx jest --config ./test/jest-e2e.json --testPathPatterns inscriptions-public`
  - Resultado: `Test Suites: 1 passed` · `Tests: 4 passed`.
- [x] **Backend compila:** `npx tsc --noEmit -p tsconfig.json` sin errores.
- [x] **Frontend compila:** `npx tsc --noEmit -p tsconfig.app.json` sin errores.

#### Notas / aprendizajes

- El mapeo explícito del objeto de respuesta (en lugar de devolver directamente el
  resultado de Prisma) es la barrera que evita que un `select` ampliado por descuido
  vuelva a filtrar PII. El test lo cubre con un mock que devuelve datos de más.
- El shim de `uuid` para Jest es reutilizable por futuros tests e2e; si en algún
  momento se migra `uuidv4()` a `crypto.randomUUID()` en el service, el shim puede
  eliminarse.
- `test/app.e2e-spec.ts` (boilerplate de Nest, espera `GET /` → `Hello World!`) sigue
  fallando desde antes de esta tarea; por eso se corrió el spec nuevo de forma
  focalizada. Conviene borrarlo o adaptarlo en una tarea futura.

---

### T02 (post-auditoría DevSecOps) — Endurecer módulo de documentos MinIO (C-02, C-04)

> Corresponde a `tasks.md → Fase 1 → T02`.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente 🏗️ BE: Backend Architect)
- **Hallazgos cubiertos:** C-02 (bucket MinIO público), C-04 (path traversal en filename)
- **Duración estimada / real:** 2h / ~1h

#### Prompt utilizado

> Procede con la task 02

#### Decisión de alcance: endurecer en vez de desactivar el módulo

`tasks.md` ofrecía como alternativa aceptable desactivar `DocumentsModule` hasta V2,
dado que MinIO figura como Out of Scope MVP en `spec.md` (línea 169). Se optó por
**endurecer** el módulo por tres razones:

1. El hallazgo se cierra de verdad; desactivar el módulo sólo lo esconde y el código
   inseguro volvería intacto en V2.
2. `DocumentsModule` no tiene hoy ningún consumidor real en el frontend
   (`DocumentsPage.tsx` es una maqueta con datos hardcodeados; `useDocuments.ts` y
   `documents.api.ts` no se importan desde ninguna pantalla), así que endurecerlo no
   arriesga romper funcionalidad en uso.
3. El endurecimiento deja el módulo listo para V2 sin deuda pendiente.

Queda registrado que **desactivar el módulo sigue siendo una opción válida** si se
decide reducir superficie de ataque antes del despliegue: basta con quitar
`DocumentsModule` de `app.module.ts`.

#### Código generado

- **Archivos creados/modificados:**
  - `backend/src/modules/documents/minio.service.ts` — reescritura completa del servicio.
  - `backend/src/modules/documents/minio.service.spec.ts` *(nuevo)* — 21 tests unitarios.
  - `backend/src/modules/documents/documents.service.ts` — guarda `objectName` en `fileKey`, sin DNI en la clave; `type` tipado como `DocumentType`.
  - `backend/src/modules/documents/documents.controller.ts` — `@Body()` tipado con `UploadDocumentDto` (validación de UUID + enum antes de Prisma).
  - `backend/.env` — credenciales MinIO propias generadas con `crypto.randomBytes`.
  - `backend/.env.example` — placeholders explícitos + instrucción de generación.
  - `backend/docker-compose.dev.yml` — el contenedor MinIO toma las credenciales de `backend/.env` (`${MINIO_ACCESS_KEY:?...}`), ya no `minioadmin` hardcodeado.
  - `backend/.github/workflows/ci.yml` — las credenciales de CI dejan de ser `minioadmin`.

- **Resumen del cambio (los 4 puntos del DoD):**
  - **(a) Policy pública removida:** se eliminó el bloque que aplicaba
    `s3:GetObject` con `Principal: *` al crear el bucket. Además, en cada arranque
    `ensureBucketIsPrivate()` consulta la policy vigente y, si encuentra una, la borra
    con `setBucketPolicy(bucket, '')` — esto repara buckets ya provisionados por la
    versión anterior del servicio, no sólo los nuevos.
  - **(b) Filename sanitizado:** `sanitizeFilename()` descarta todo componente de
    ruta (basename), quita diacríticos, reemplaza cualquier carácter fuera de
    `[a-zA-Z0-9._-]` por `_`, colapsa los puntos del nombre (no sobrevive ninguno
    salvo el de la extensión), antepone `randomUUID()` y fuerza la extensión a la
    lista permitida (`.jpg/.jpeg/.png/.pdf`, si no `.bin`). La carpeta destino se
    sanitiza segmento por segmento con el mismo criterio.
  - **(c) Credenciales validadas en el constructor:** `assertStrongCredential()`
    rechaza vacías, de menos de 8 caracteres o pertenecientes a la lista de defaults
    (`minioadmin`, `admin`, `password`, `secret`, `changeme`, ...). Al correr en el
    constructor, un despliegue mal configurado falla en el bootstrap y no en el
    primer upload.
  - **(d) `uploadFile` devuelve `objectName`:** ya no devuelve `/<bucket>/<key>` (una
    ruta que sólo servía con bucket público). `documents.service` guarda esa clave en
    `fileKey` y `findByParticipant` sigue sirviendo todo vía `getPresignedUrl()`.

- **Hardening adicional detectado durante la tarea (no pedido explícitamente):**
  - Bug de configuración: el constructor leía `minio.endPoint` (con P mayúscula) pero
    `config/index.ts` registra `endpoint`. El valor real de `MINIO_ENDPOINT` se
    ignoraba y siempre caía al fallback `localhost`. Corregido.
  - `getPresignedUrl()` y `deleteFile()` normalizan la clave (aceptan el formato
    histórico `/<bucket>/<key>`) y rechazan con 400 cualquier clave con `..`.
  - Expiración de las URLs pre-firmadas: default de 3600s → 300s, acotada a `[60, 3600]`.
  - Los objetos se suben con `Content-Disposition: attachment` para que el navegador
    no renderice inline un archivo malicioso.
  - La clave del objeto ya no incluye el DNI del participante (viajaba en cada URL firmada).

#### Correcciones manuales

- Se decidió que un fallo al verificar la privacidad del bucket **no** tumbe la API
  (se registra como `logger.error`): MinIO caído dejaría sin servicio a toda la
  plataforma por una feature que el MVP no usa. Contrapartida documentada: mientras
  ese chequeo no corra OK no hay garantía de bucket privado.
- `docker-compose.dev.yml` usa la sintaxis `${VAR:?mensaje}` (sin default) a
  propósito: si alguien borra las credenciales de `.env`, compose falla con un
  mensaje claro en vez de volver silenciosamente a `minioadmin`.
- Hubo que actualizar `ci.yml`: sus dos jobs exportaban `MINIO_*=minioadmin` y, con
  la validación nueva, cualquier test que instancie `AppModule` habría fallado.
- El ejemplo del DoD (`../../etc/passwd.pdf` → `___.._etc_passwd.pdf`) aplanaba la
  ruta conservando los separadores como `_`. Se implementó la variante más segura y
  estándar: descartar los componentes de ruta y quedarse con el basename, de modo que
  `../../etc/passwd.pdf` → `participants/<id>/<uuid>-passwd.pdf`. El test cubre esta
  expectativa.

#### Verificación (DoD)

- [x] **Test unitario del sanitizado de filename** — `backend/src/modules/documents/minio.service.spec.ts`,
  bloque *"sanitizado del nombre de archivo"*: path traversal POSIX, separadores de
  Windows, caracteres peligrosos (`<script>`), extensión no permitida → `.bin`,
  nombre que queda vacío, unicidad entre dos subidas del mismo nombre y normalización
  de acentos.
  - Comando: `npx jest src/modules/documents`
  - Resultado: `Test Suites: 1 passed` · `Tests: 21 passed`.
- [x] **Cobertura de la policy pública y de las credenciales** — mismo spec: se
  verifica que al crear el bucket **nunca** se llama a `setBucketPolicy` con una
  policy, que una policy pública pre-existente se elimina con `setBucketPolicy(bucket, '')`,
  y que `minioadmin` / vacío / menos de 8 chars hacen fallar el constructor.
- [x] **Suite completa en verde:** `npx jest` → 24 tests (los 3 previos + 21 nuevos).
  El e2e de T01 sigue pasando. `npm run build` sin errores.
- [x] **Acceder a un objeto sin URL pre-firmada devuelve 403 desde MinIO** — verificado
  contra el MinIO real de `docker-compose.dev.yml` (2026-08-19). Se corrió un script de
  verificación que primero **reproduce el estado vulnerable** y después comprueba el fix:

  | # | Chequeo | Resultado |
  |---|---|---|
  | 1 | Bucket con la policy pública vieja → `GET /juegos-evita/participants/demo/legacy-dni.pdf` | **200** (vulnerabilidad reproducida) |
  | 2 | `MinioService.onModuleInit()` → `getBucketPolicy` | **NoSuchBucketPolicy** (policy eliminada; log `WARN` emitido) |
  | 3 | Mismo objeto, mismo GET directo | **403** |
  | 4 | `uploadFile(..., '../../etc/passwd.pdf')` | `participants/demo/3b0306d1-…-passwd.pdf` (sin `..`, dentro de la carpeta) |
  | 5 | GET directo del objeto recién subido | **403** |
  | 6 | GET con `getPresignedUrl()` | **200**, contenido íntegro, `Content-Disposition: attachment` |
  | 7 | `getPresignedUrl('/juegos-evita/<key>')` (formato histórico) | **200** |

  El contenedor `evita-minio` se recreó con `docker compose -f docker-compose.dev.yml up -d
  --force-recreate minio` para que tomara las credenciales nuevas: el arranque limpio
  confirma que la parametrización del compose funciona. Los objetos de prueba se
  eliminaron del bucket al terminar.

#### Notas / aprendizajes

- El chequeo de credenciales en el constructor tiene efecto de bola de nieve: obliga a
  tocar `.env`, `.env.example`, `docker-compose.dev.yml` y CI en la misma tarea. Vale
  la pena hacerlo así (no queda ningún `minioadmin` en el repo) pero conviene preverlo.
- Buena parte de lo que valida este spec es *ausencia* de comportamiento (que no se
  aplique una policy pública). Afirmarlo con `expect(setBucketPolicy).not.toHaveBeenCalled()`
  documenta la intención mucho mejor que un comentario.
- T04 (guardrails de secrets en el schema Zod) va a solapar parcialmente con la
  validación del constructor: al implementarla conviene centralizar la lista de
  patrones prohibidos en un solo lugar y que `MinioService` la reutilice.

---

### T11 (post-auditoría DevSecOps) — Eliminar el XSS de `dangerouslySetInnerHTML` en páginas públicas (F1, F2)

> Corresponde a `tasks.md → Fase 4 → T11`. Primer ítem del Bloque 1 del orden de
> ejecución recomendado.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente ⚛️ FE: Frontend Engineer)
- **Hallazgos cubiertos:** F1 (`discipline.rules`), F2 (`news.content`)
- **Duración estimada / real:** 1h / ~0,5h

#### Prompt utilizado

> Procede con la siguiente task

#### Decisión de alcance: texto plano en vez de DOMPurify

`tasks.md` proponía instalar `dompurify` y sanitizar, pero pedía explícitamente
**evaluar antes si los campos son texto plano**. Se verificó que lo son:

| Campo | Cómo se carga | Tipo en Prisma | Cómo se renderizaba |
|---|---|---|---|
| `news.content` | `<Textarea>` plano en `NewsForm.tsx:143` | `String @db.Text` | `content.replace(/\n/g, '<br/>')` |
| `discipline.rules` | ni siquiera hay input en `DisciplineForm.tsx` (sólo viaja en `defaultValues`); se carga por seed/DB | `String? @db.Text` | `rules.replace(/\n/g, '<br/>')` |

Ese `replace(/\n/g, '<br/>')` es la prueba de que el contenido es texto plano: lo
único que aportaba el HTML era el salto de línea. Ninguno de los dos campos tiene
editor de texto enriquecido en el panel admin.

Por eso se optó por **eliminar `dangerouslySetInnerHTML` por completo** en vez de
sanitizarlo. Es estrictamente mejor en este caso:

- El vector desaparece; no queda superficie de bypass de sanitizador que mantener
  al día (DOMPurify acumula CVEs de bypass con regularidad).
- Cero dependencias nuevas.
- `whitespace-pre-wrap` conserva saltos de línea **y párrafos en blanco**, que el
  `<br/>` manejaba peor.

Queda documentado en el JSDoc del componente que, si en el futuro se agrega un
editor rico en el admin, la vía correcta es DOMPurify con allowlist explícita.

#### Código generado

- **Archivos creados/modificados:**
  - `frontend/src/components/shared/PlainTextContent.tsx` *(nuevo)* — componente
    compartido que renderiza texto plano multilínea con `whitespace-pre-wrap` +
    `break-words`, con `fallback` para contenido vacío. El JSDoc explica por qué
    no se usa `dangerouslySetInnerHTML`.
  - `frontend/src/pages/public/DisciplineDetailPage.tsx:73` — reemplazado el
    render de `discipline.rules`; el estado vacío (antes un ternario inline) ahora
    lo cubre el `fallback` del componente.
  - `frontend/src/pages/public/NewsDetailPage.tsx:131` — reemplazado el render de
    `news.content`.

- **Resumen del cambio:** `grep -rn "dangerouslySetInnerHTML" frontend/src/` ya no
  devuelve ningún uso real (la única coincidencia es la advertencia en el JSDoc del
  componente nuevo).

#### Correcciones manuales

- El script de verificación marcaba dos falsos positivos: buscaba substrings como
  `onerror=` en la salida, que aparecen **escapados e inertes** dentro de
  `&lt;img src=x onerror=alert(1)&gt;`. Se corrigió el criterio: extraer el
  contenido interno del wrapper y verificar que **no sobreviva ningún `<` sin
  escapar** — un tag vivo es exactamente eso.
- El estado vacío del reglamento se movió del ternario de la página al `fallback`
  del componente, para que las dos páginas se comporten igual.

#### Verificación (DoD)

- [x] **Un `news.content` con `<img src=x onerror=alert(1)>` NO ejecuta el script.**
- [x] **Payloads XSS estándar confirmados.** Se renderizaron los componentes reales
  con `react-dom/server` (`renderToStaticMarkup`) y se inspeccionó el HTML de salida.
  El script bundlea el componente con esbuild resolviendo el alias `@` y **primero
  reproduce el comportamiento anterior** como control:

  | Payload | Antes (`dangerouslySetInnerHTML`) | Después (`PlainTextContent`) |
  |---|---|---|
  | `<img src=x onerror=alert(1)>` | `<div><img src=x onerror=alert(1)></div>` — tag vivo | `&lt;img src=x onerror=alert(1)&gt;` — texto inerte |
  | `<script>alert('xss')</script>` | — | `&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;` |
  | `<svg onload=alert(1)>` | — | `&lt;svg onload=alert(1)&gt;` |
  | `<iframe src=javascript:alert(1)>` | — | `&lt;iframe src=javascript:alert(1)&gt;` |
  | `<a href="javascript:alert(1)">` | — | `&lt;a href=&quot;javascript:alert(1)&quot;&gt;` |

- [x] **No hay regresión visual:** el texto multilínea conserva saltos de línea y
  párrafos en blanco; el fallback de contenido vacío se renderiza igual que antes.
- [x] `npx tsc --noEmit -p tsconfig.app.json` sin errores · `npm run build` OK ·
  `npm run lint` sin errores nuevos en los archivos tocados.

#### Notas / aprendizajes

- Antes de instalar un sanitizador conviene mirar **cómo se carga el dato**. Acá el
  `replace(/\n/g, '<br/>')` delataba que el HTML nunca fue un requisito: era un
  atajo para los saltos de línea, y pagaba con un XSS a visitantes anónimos.
- Verificar ausencia de XSS por substrings (`onerror=`, `<script`) da falsos
  positivos sobre texto escapado. El criterio correcto sobre HTML renderizado es
  buscar `<` sin escapar en el contenido.
- Renderizar el componente real con `react-dom/server` + esbuild permitió obtener
  evidencia concreta sin agregar un runner de tests al frontend (que hoy no tiene).
  Si en algún momento se suma Vitest, estos casos son el primer test obvio a portar.

---

### T12 (post-auditoría DevSecOps) — Limpiar la cache de React Query al cambiar de sesión (F3)

> Corresponde a `tasks.md → Fase 4 → T12`. Segundo ítem del Bloque 1.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente ⚛️ FE: Frontend Engineer)
- **Hallazgo cubierto:** F3 (la cache de TanStack Query sobrevive al logout)
- **Duración estimada / real:** 1h / ~0,5h

#### Prompt utilizado

> commitea y luego procede a la siguiente task segun el orden correspondiente

#### Código generado

- **Archivos creados/modificados:**
  - `frontend/src/lib/queryClient.ts` *(nuevo)* — singleton del `QueryClient` con
    los mismos defaults que tenía `App.tsx`, más el helper `resetQueryCache()`.
  - `frontend/src/App.tsx` — deja de crear el cliente y consume el singleton.
  - `frontend/src/store/auth.store.tsx` — invoca `resetQueryCache()` en los tres
    puntos donde cambia la sesión.

- **Resumen del cambio:** el `QueryClient` vivía dentro de `App.tsx`, así que nada
  fuera del árbol de React podía vaciarlo y `queryClient.clear()` no se llamaba
  nunca. Ahora vive en su propio módulo y el store de autenticación lo limpia.

#### Decisiones de implementación

**1. `cancelQueries()` antes de `clear()`.** `resetQueryCache()` no se limita a
`clear()`: primero cancela las requests en vuelo. Sin eso queda una carrera real —
una request lanzada *antes* del logout que resuelve *después* de `clear()` vuelve a
poblar la cache con datos del usuario anterior, que es exactamente la fuga que la
tarea busca cerrar. El chequeo 4 de la verificación cubre este caso.

**2. Tres puntos de limpieza, no uno.** La tarea pedía limpiar en el logout. Se
agregaron dos más porque el logout explícito no es la única forma de terminar una
sesión:

| Punto | Por qué |
|---|---|
| `logout()` | El caso del hallazgo. Va en el `finally` para que también limpie si la request de logout falla. |
| `login()` | Si la sesión anterior murió por token vencido (el interceptor hace `clearTokens()` y sólo redirige cuando la ruta empieza con `/admin`), la cache queda poblada y el login siguiente la heredaría. |
| `checkSession()` (token inválido al montar) | Mismo motivo: se descarta la sesión, hay que descartar sus datos. |

**3. Orden dentro del logout.** Se vacía la cache **antes** de `setUser(null)`, como
indicaba la tarea. Vaciarla después dejaría una ventana en la que los componentes
todavía montados podrían leer datos del usuario anterior.

#### Correcciones manuales

- Ninguna sobre lo generado. El único ajuste de criterio fue extender la limpieza a
  `login()` y `checkSession()`, que la tarea no mencionaba.

#### Verificación (DoD)

El DoD describe un flujo manual de navegador (login A → logout → login B →
verificar en Network/DevTools). Se verificó el **invariante que ese flujo observa**
—que la cache queda vacía al cambiar de sesión— de forma automatizada, importando
el módulo real `lib/queryClient.ts` (bundleado con esbuild resolviendo el alias `@`)
y ejecutándolo en Node:

| # | Chequeo | Resultado |
|---|---|---|
| 1 | Sesión de A: 3 queries en cache con sus datos | 3 queries, datos presentes |
| 2 | `resetQueryCache()` | **0 queries**, 0 mutaciones |
| 3 | B lee `inscriptions`, `participants`, `users` | `undefined` en los tres |
| 4 | Request en vuelo que resuelve **después** del logout | la `queryFn` alcanzó a resolver, pero **no repobló la cache** |

Con 0 queries en cache, cualquier pantalla que B abra dispara necesariamente una
request nueva, que es lo que el flujo manual verifica en el Network tab.

- [x] `queryClient.clear()` se ejecuta en el logout (antes no se llamaba nunca).
- [x] React Query DevTools mostraría 0 queries en el momento del logout —
  equivalente al chequeo 2.
- [x] El usuario B no lee datos de A — chequeo 3.
- [ ] Flujo manual en navegador con dos usuarios reales: **no ejecutado**. El
  invariante está probado arriba; queda como verificación de aceptación.
- [x] `npx tsc --noEmit -p tsconfig.app.json` sin errores · `npm run build` OK ·
  `npm run lint` sin errores nuevos.

#### Notas / aprendizajes

- `clear()` a secas deja abierta la carrera de la request en vuelo. La combinación
  `cancelQueries()` + `clear()` es la que realmente garantiza que no quede nada del
  usuario anterior, y el chequeo 4 lo demuestra: la `queryFn` **sí** resolvió después
  del logout y aun así la cache quedó vacía.
- `lib/queryClient.ts` es ahora el lugar natural para los defaults de React Query:
  T19 (ajustar `staleTime` por dominio) va a modificar este mismo archivo.
- T13 (namespacear los `queryKey` por `userId`) sigue siendo necesaria: esta tarea
  cierra la fuga entre sesiones sucesivas, pero no protege el caso de dos usuarios
  compartiendo el mismo cliente sin pasar por login/logout.

---

### T03 (post-auditoría DevSecOps) — Refresh token en cookie httpOnly + access token en memoria (C-03, A-03, F17)

> Corresponde a `tasks.md → Fase 1 → T03`. Tercer ítem del Bloque 1 y el de mayor
> blast radius: cambia el contrato de autenticación entre backend y frontend.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agentes 🔀 FS: Backend Architect + Frontend Engineer)
- **Hallazgos cubiertos:** C-03 (tokens en localStorage), A-03 (race condition en el refresh), F17 (objeto `user` en localStorage)
- **Duración estimada / real:** 4h / ~1,5h

#### Prompt utilizado

> procede con la t03

#### Código generado

**Backend**

- `backend/src/modules/auth/auth.cookies.ts` *(nuevo)* — nombre y opciones de la
  cookie en un solo lugar, más `parseDurationToMs()` para mantener el `maxAge`
  alineado con `JWT_REFRESH_EXPIRATION`.
- `backend/src/modules/auth/auth.controller.ts` — `login` y `refresh` setean la
  cookie con `@Res({ passthrough: true })` (los interceptores globales siguen
  funcionando); `logout` la borra; `me` pasa a `GET` y devuelve el perfil completo.
- `backend/src/modules/auth/auth.service.ts` — nuevo `getProfile(userId)` con
  `select` acotado; lanza 401 si el usuario fue desactivado.
- `backend/src/modules/auth/strategies/jwt-refresh.strategy.ts` — extrae el token
  **sólo** de la cookie, sin fallback al header `Authorization`.
- `backend/src/modules/auth/strategies/jwt.strategy.ts` — se elimina el fallback
  `'default-access-secret'`; ahora falla al arrancar si falta el secreto.
- `backend/src/main.ts` — `app.use(cookieParser())`.
- `backend/package.json` — se agrega `cookie-parser` + `@types/cookie-parser`.
- `backend/test/auth-cookies.e2e-spec.ts` *(nuevo)* — 10 tests del contrato.

**Frontend**

- `frontend/src/api/client.ts` — access token en variable de módulo;
  `withCredentials: true`; `refreshPromise` singleton en reemplazo de
  `isRefreshing` + `failedQueue`; purga de las claves viejas de `localStorage`.
- `frontend/src/api/auth.api.ts` — `login` guarda el token en memoria, `me` pasa a
  `GET`, `refresh` actualiza el token.
- `frontend/src/store/auth.store.tsx` — sin `localStorage`; al montar intenta
  `refresh()` + `me()` para rehidratar la sesión.
- `frontend/src/types/index.ts` — `AuthResponse` sin `refreshToken`, nuevo
  `AuthUserProfile`.

#### Decisiones de implementación

**1. La cookie no tiene fallback por header.** `JwtRefreshStrategy` dejó de leer
`Authorization`. Mantener el fallback habría sido retrocompatible, pero dejaba vivo
exactamente el vector que la tarea cierra: un cliente podría seguir guardando el
refresh token en JavaScript. Hay un test que verifica que el header ya no alcanza.

**2. `path` acotado a `/api/v1/auth`.** La cookie no se adjunta al resto de la API,
así que un endpoint cualquiera nunca la ve. El path se arma desde
`app.apiPrefix`, no hardcodeado.

**3. `secure` sólo en producción.** En dev se sirve por HTTP plano; con `secure`
fijo la cookie no se setearía nunca y el login parecería roto.
`sameSite: 'strict'` sí es fijo: dev usa `localhost:5173` → `localhost:3000`, que
para el navegador es same-site (el puerto no cuenta).

**4. `me` pasó de POST a GET.** Es una lectura y ahora se llama en cada arranque.
Se cambió junto con el resto del contrato, no en una tarea aparte.

**5. Rehidratación: `refresh()` y después `me()`.** Con el access token en memoria,
un F5 lo pierde. El arranque pide uno nuevo con la cookie y recién ahí consulta el
perfil. Para un visitante anónimo es una sola request que falla con 401 y deja la
sesión en null.

**6. Purga de `localStorage` heredado.** Las sesiones abiertas antes del cambio
dejaron `evita_access_token`, `evita_refresh_token` y `evita_user` en el navegador.
Ya no se leen, pero un refresh token olvidado sigue siendo un secreto expuesto a
cualquier XSS, así que se borran al cargar el cliente. La función está marcada como
eliminable después de un ciclo de release.

#### Correcciones manuales

- El mock de Prisma del spec nuevo devolvía un snapshot congelado de la fila, así
  que el `refresh` fallaba con 403 (el `refreshToken` rotado en el login no se veía)
  y `getProfile` parecía filtrar `passwordHash`. Se reescribió el mock para que
  devuelva el estado actual **y respete el `select`**, como hace Prisma — con eso el
  test además verifica que `getProfile` no pida columnas de más.
- Se quitó el fallback `'default-access-secret'` de `JwtStrategy`, que no estaba en
  el alcance de T03 pero es el mismo problema que C-05: con ese default, cualquiera
  que lea el repo puede firmar tokens válidos si la variable no está seteada.

#### Verificación (DoD)

**Contrato del backend — `backend/test/auth-cookies.e2e-spec.ts`, 10 tests en verde**
(`npx jest --config ./test/jest-e2e.json --testPathPatterns auth-cookies`):

| Chequeo | Resultado |
|---|---|
| El body del login no contiene `refreshToken` | ✅ (ni la clave ni el valor) |
| `Set-Cookie` con `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth`, `Max-Age` | ✅ |
| La cookie transporta un JWT con `type: 'refresh'` | ✅ |
| Sin `Secure` fuera de producción | ✅ |
| `/auth/refresh` renueva leyendo la cookie y **rota** la cookie | ✅ |
| `/auth/refresh` con el token en el header `Authorization` | ✅ **401** (vector viejo cerrado) |
| `/auth/refresh` sin cookie | ✅ 401 |
| `/auth/logout` borra la cookie y anula el refresh token en BD | ✅ |
| `GET /auth/me` devuelve el perfil sin `passwordHash` ni `refreshToken` | ✅ |
| `GET /auth/me` sin access token | ✅ 401 |

**A-03 — un solo refresh por ráfaga de 401.** Se ejecutó el `client.ts` real
(bundleado con esbuild) contra un servidor HTTP de prueba que cuenta los hits a
`/auth/refresh` y responde con una demora deliberada para ensanchar la ventana de
carrera:

| Chequeo | Resultado |
|---|---|
| 5 requests concurrentes con el token vencido | las 5 terminan OK |
| Llamadas a `/auth/refresh` | **1** (10 hits al endpoint protegido = 5 fallidos + 5 reintentos) |
| Token en memoria actualizado | ✅ |
| Segunda ráfaga posterior | 1 refresh más (el singleton se libera, no queda trabado) |

**C-03 / F17 — nada en localStorage.** `grep -rn "localStorage" frontend/src/`
devuelve únicamente comentarios explicativos y la función de purga; no queda ninguna
lectura ni escritura de `evita_access_token`, `evita_refresh_token` ni `evita_user`.

- [x] `localStorage.getItem('evita_refresh_token')` y `evita_user` devuelven `null`
  post-login: ya no se escriben, y la purga borra los heredados.
- [x] `document.cookie` no muestra el refresh token: la cookie se emite con
  `HttpOnly` (verificado sobre el header real en el test).
- [x] Requests concurrentes con token expirado disparan **una sola** llamada a
  `/auth/refresh`.
- [x] `npx tsc --noEmit` limpio en backend y frontend · `npm run build` OK en ambos ·
  24 unit + 14 e2e de backend en verde · lint del frontend sin errores nuevos.
- [ ] **Smoke test contra el stack levantado: no ejecutado.** Se intentó, pero
  Docker Desktop se detuvo y Postgres dejó de responder en `127.0.0.1:5434`
  (`Can't reach database server`). El contrato de la cookie está cubierto por los
  tests e2e sobre el controller y la strategy reales; lo que faltaría comprobar es
  el login del usuario semilla, que esta tarea no modifica.

#### Notas / aprendizajes

- La carrera de A-03 sólo aparece con una demora en el refresh: sin ella, las 5
  requests fallan y se reintentan tan rápido que el bug no se manifiesta. El
  servidor de prueba introduce 60 ms a propósito.
- `@Res({ passthrough: true })` es lo que permite setear cookies **sin** perder los
  interceptores globales de Nest (el wrapper `{ success, data }` sigue aplicándose).
  Con `@Res()` a secas habría que escribir la respuesta a mano.
- El singleton de refresh usa `refreshPromise ??= ...` y se limpia en un `finally`:
  si no se limpiara, un refresh fallido dejaría la promesa rechazada cacheada y
  ninguna request posterior podría recuperarse. El chequeo de la segunda ráfaga
  existe para cubrir justamente eso.
- Queda una diferencia de comportamiento visible para el usuario: al recargar la
  página hay un instante de `isLoading` mientras se rehidrata la sesión. Es el costo
  de no tener el token en `localStorage`.

---

### T04 (post-auditoría DevSecOps) — Guardrails contra secrets por defecto en env (C-05)

> Corresponde a `tasks.md → Fase 1 → T04`. Último ítem del Bloque 1: cierra la
> fase de críticos.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente 🏗️ BE: Backend Architect)
- **Hallazgo cubierto:** C-05 (secretos por defecto en `.env`)
- **Duración estimada / real:** 1h / ~0,75h

#### Prompt utilizado

> Procede con la siguiente task, no te olvides marcar como completadas las que ya
> hiciste en el archivo tasks.md

#### Código generado

- `backend/src/common/security/forbidden-secrets.ts` *(nuevo)* — lista única de
  patrones prohibidos + `findForbiddenPattern()`, `assertStrongSecret()` y el
  armador del mensaje de error.
- `backend/src/config/config.validation.ts` — `superRefine` sobre el schema Zod
  que audita las variables sensibles y emite los issues con `path: [VARIABLE]`.
- `backend/src/config/config.validation.spec.ts` *(nuevo)* — 19 tests.
- `backend/src/modules/documents/minio.service.ts` — deja de tener su propia lista
  y reutiliza `assertStrongSecret()` (pendiente que dejé anotado al cerrar T02).
- `backend/prisma/seed.ts` — se elimina el fallback `'Admin123!@#'`.
- `backend/.env` — `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` y
  `SEED_ADMIN_PASSWORD` regenerados con `crypto.randomBytes`.
- `backend/.env.example` — placeholders explícitos + comando de generación.
- `backend/.github/workflows/ci.yml` — los secretos de CI dejan de contener la
  palabra `secret`, que ahora está prohibida.

#### Decisiones de implementación

**1. El chequeo mira el contenido, no sólo el largo.** Los `.min()` que ya existían
no servían para esto: `change-me-access-secret-at-least-32-chars` tiene 41
caracteres y pasaba sin objeción. El `superRefine` rechaza el *valor*.

**2. Dos niveles de estrictez.**

| Variables | Cuándo se auditan | Por qué |
|---|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `SEED_ADMIN_PASSWORD` | siempre | Son secretos de la aplicación; nada justifica un default en ningún entorno. |
| `DATABASE_URL`, `REDIS_PASSWORD`, `CORS_ORIGINS` | sólo en producción | La contraseña de Postgres quedó grabada en el volumen de Docker: cambiarla en dev implica recrear el volumen y perder los datos locales. En producción un default es inaceptable, y `CORS_ORIGINS` apuntando a `localhost` es un error de despliegue. |

**3. Coincidencia por substring, con lista de excepciones exactas.** `admin`,
`root`, `test` o `evita` son fragmentos demasiado comunes para prohibirlos dentro
de un valor, pero sí se rechazan cuando **son** el secreto completo. El resto
(`change-me`, `minioadmin`, `admin123`, `password`, `secret`, `qwerty`, `123456`,
`default`, ...) se busca como substring: un valor de `randomBytes(64)` no contiene
ninguno salvo por casualidad astronómica.

**4. Una sola lista, dos consumidores.** `MinioService` validaba credenciales con
su propia lista desde T02. Ahora ambos leen de `common/security/forbidden-secrets.ts`,
como quedó anotado en las notas de aquella tarea. El chequeo en el constructor de
MinIO se conserva igual: el `ConfigService` puede recibir valores por vías que no
pasan por el schema.

**5. El seed también dejó de tener default.** `prisma/seed.ts` caía en
`'Admin123!@#'` si la variable faltaba, o sea que creaba un `SUPER_ADMIN` con
contraseña publicada en el repositorio. Ahora falla con un mensaje explícito.

#### Correcciones manuales

- Efecto colateral esperable: el fixture del spec de MinIO usaba
  `'un-secreto-largo-y-random'` como secret key válida… que contiene `secret` y
  ahora se rechaza. Se cambió por un valor aleatorio y se agregó un test que
  documenta el caso.
- Los dos jobs de CI exportaban `test-access-secret-at-least-32-chars`: mismo
  problema. Se reemplazaron por valores aleatorios (siguen siendo descartables,
  pero ya no matchean la lista).

#### Verificación (DoD)

**19 tests unitarios** (`npx jest src/config`) sobre `validateEnv`:

| Grupo | Cubre |
|---|---|
| Defaults históricos | Los 5 valores que estuvieron realmente en el repo (`change-me-*` ×2, `minioadmin` ×2, `Admin123!@#`) hacen fallar el arranque |
| Mensaje | Nombra la variable, cita el patrón detectado y muestra el comando para generar uno nuevo |
| Múltiples fallas | Si hay dos variables inválidas, el error nombra las dos (no corta en la primera) |
| Otros patrones | `password`, `secret`, `default`, `qwerty` y secretos cortos |
| Producción | `DATABASE_URL` con `evita_password` y `CORS_ORIGINS` con `localhost` fallan; en desarrollo se toleran |
| Regresión | `DATABASE_URL` sigue siendo obligatoria; los defaults de las opcionales se siguen aplicando |

**Verificación contra los archivos reales** (ejecutando `validateEnv` compilado):

```
OK   | backend/.env pasa la validacion
OK   | el entorno de CI pasa la validacion
OK   | el default historico falla ->  JWT_ACCESS_SECRET: JWT_ACCESS_SECRET contiene
       un valor por defecto ("change-me"). Generá uno propio:
       node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"
```

- [x] Levantar el backend con cualquier default histórico falla con un mensaje
  claro que apunta a la variable inválida.
- [x] `.env` local regenerado con `crypto.randomBytes(64).toString('base64url')`.
- [x] `.env.example` con placeholders explícitos.
- [x] Suite completa: 44 unit + 14 e2e en verde · `npm run build` OK.

#### Notas / aprendizajes

- Prohibir la palabra `secret` dentro de un secreto suena exagerado hasta que uno
  ve que los tres lugares del repo que tenían un valor de ejemplo la usaban
  (`.env.example`, los dos jobs de CI y el fixture de MinIO). Es justamente el
  patrón que delata un valor copiado de una plantilla.
- El `superRefine` emite los issues con `path: [VARIABLE]`, que es lo que hace que
  `flatten().fieldErrors` los agrupe por variable y el mensaje de arranque quede
  legible. Sin el `path`, todo caía en `formErrors` sin decir qué variable revisar.
- **Acción pendiente para el operador:** el `SEED_ADMIN_PASSWORD` nuevo no cambia
  la contraseña del admin que ya existe en la base. El `upsert` del seed actualiza
  el `passwordHash`, así que hay que correr `npm run db:seed` para que tome efecto;
  hasta entonces, el login sigue siendo con la contraseña anterior.
- Con esta tarea queda cerrado el Bloque 1 (T11, T12, T03, T01, T02, T04) y con él
  la regla dura de `tasks.md`: ninguna tarea 🔴 abierta antes de exponer la app
  fuera de la red local.

---

### T18 (post-auditoría DevSecOps) — `compression` + `Cache-Control` en endpoints públicos (Q1, Q4, Q7, Q8)

> Corresponde a `tasks.md → Fase 5 → T18`. Primer ítem del Bloque 2 y primera
> tarea de optimización, ya cerrado el bloque de críticos.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente 🏗️ BE: Backend Architect)
- **Hallazgos cubiertos:** Q1 (sin compresión), Q4/Q7/Q8 (sin caché HTTP en endpoints casi estáticos)
- **Duración estimada / real:** 15 min / ~40 min

#### Prompt utilizado

> procede con la siguiente task

#### Código generado

- `backend/src/main.ts` — `app.use(compression())`.
- `backend/src/common/decorators/cache-control.decorator.ts` *(nuevo)* —
  `@CacheControl(segundos)` + constantes `CACHE_TTL.CATALOG` (10 min) y
  `CACHE_TTL.CONTENT` (5 min).
- `backend/src/common/interceptors/cache-control.interceptor.ts` *(nuevo)* —
  aplica el header sólo donde corresponde.
- `backend/src/app.module.ts` — registra el interceptor como `APP_INTERCEPTOR`.
- Controllers con el decorador aplicado a `findAll`:
  `disciplines` y `categories` y `venues` (CATALOG, 600 s), `news` (CONTENT, 300 s).
- `backend/test/http-cache.e2e-spec.ts` *(nuevo)* — 7 tests.
- `backend/package.json` — `compression` + `@types/compression`.

#### Decisiones de implementación

**1. Opt-in, no opt-out.** El interceptor es global pero no hace nada sin el
decorador. Un `Cache-Control` por defecto con excepciones sería una fuente de
fugas: alcanzaría con olvidarse de excluir un endpoint nuevo con datos privados.

**2. Tres guardas que dependen del request, no del endpoint.** El decorador dice
"esto es cacheable"; el interceptor decide si *este* request lo es:

| Guarda | Motivo |
|---|---|
| Sólo `GET` | Un `POST` cacheable no tiene sentido. |
| Nunca con `Authorization` o `req.user` | Aunque el endpoint sea público, la respuesta podría variar para un usuario logueado, y `public` habilitaría a un proxy compartido a servírsela a otra persona. Después de T01/T12, esta es la guarda que evita reintroducir por HTTP la fuga que cerramos en la app. |
| Sólo respuestas < 400 | Un 404 cacheado 10 minutos es una fuente inagotable de reportes de bugs. |

**3. `Vary: Origin, Accept-Encoding`.** La respuesta depende del `Origin` (CORS) y
de la codificación negociada; sin el `Vary`, un proxy podría servir la variante
equivocada (por ejemplo, un cuerpo gzip a un cliente que no lo acepta).

**4. `stale-while-revalidate` igual al `max-age`.** El navegador puede seguir
mostrando la copia vieja mientras revalida en segundo plano: la navegación se
siente instantánea y el contenido se actualiza igual.

#### Correcciones manuales

- El test que compara tamaños daba `NaN`: las respuestas gzip van *chunked*, así
  que no traen `Content-Length`, y supertest además descomprime en el camino. Se
  reescribió con `node:http` crudo, contando los bytes que realmente viajan.

#### Verificación (DoD)

**7 tests e2e** (`npx jest --config ./test/jest-e2e.json --testPathPatterns http-cache`):

| Chequeo | Resultado |
|---|---|
| `Accept-Encoding: gzip` → `Content-Encoding: gzip` | ✅ |
| `Accept-Encoding: identity` → sin compresión | ✅ |
| Reducción de payload | **13.830 B → 513 B (96,3% menos)** |
| Listado público → `Cache-Control: public, max-age=600` + `Vary` | ✅ |
| Endpoint **sin** decorador (`GET /disciplines/:id`) | ✅ sin `Cache-Control` |
| Endpoint **mutable** (`POST /disciplines`) | ✅ sin `Cache-Control` |
| Mismo endpoint público **con** `Authorization` | ✅ sin `Cache-Control` |

- [x] Los headers de un endpoint público muestran `Content-Encoding: gzip` y
  `Cache-Control: public, max-age=600`.
- [x] Ningún endpoint privado o mutable recibe caché (tres tests negativos).
- [x] 44 unit + 21 e2e en verde · `npm run build` OK.

#### Notas / aprendizajes

- El 96,3% del test es optimista: el fixture repite la misma cadena 40 veces y
  gzip la aprovecha al máximo. En payloads reales la reducción esperable es la que
  estimaba la auditoría, 60-70%, que sigue siendo enorme para conexiones móviles.
- **Compensación aceptada:** con `max-age=300` en noticias, una nota recién
  publicada puede tardar hasta 5 minutos en aparecerle a un visitante que ya tenía
  la lista cacheada. Si eso molesta durante los Juegos, bajar `CACHE_TTL.CONTENT`
  es cambiar una constante.
- La guarda de `Authorization` no estaba en la tarea original. Se agregó porque el
  decorador y el uso real están separados en el tiempo: dentro de seis meses
  alguien puede marcar como cacheable un endpoint que devuelve datos distintos
  según quién pregunta, y el interceptor lo cubre.

---

### T19 (post-auditoría DevSecOps) — `staleTime` de React Query por dominio (Q4, Q14)

> Corresponde a `tasks.md → Fase 5 → T19`. Segundo ítem del Bloque 2.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente ⚛️ FE: Frontend Engineer)
- **Hallazgos cubiertos:** Q4 (staleTime global demasiado corto), Q14 (sin prefetch de catálogos compartidos)
- **Duración estimada / real:** 1h / ~0,5h

#### Prompt utilizado

> procede con la siguiente task

#### Código generado

- `frontend/src/lib/queryClient.ts` — default global 30 s → **5 min** y nuevas
  constantes `STALE_TIME` (`CATALOG` 10 min · `OPERATIONAL` 2 min · `LIVE` 30 s).
- Hooks con `staleTime` explícito (24 queries en 12 archivos):

  | Grupo | Hooks |
  |---|---|
  | `CATALOG` (10 min) | `useDisciplines`, `useCategories`, `useVenues`, `useNews` |
  | `OPERATIONAL` (2 min) | `useInscriptions`, `useParticipants`, `useTeams`, `useUsers`, `useCalendar`, `useDocuments` |
  | `LIVE` (30 s) | `useResults`, `useCompetitions` |

- `frontend/src/router.tsx` — `loader: prefetchCatalogosAdmin` en la rama
  `/admin/*`, que precarga disciplinas y categorías.

#### Decisiones de implementación

**1. Constantes por dominio, no números sueltos.** `STALE_TIME.CATALOG` en cada
hook dice *por qué* ese dato dura 10 minutos. Ajustar la política de un dominio es
tocar una constante, no 24 llamadas.

**2. El prefetch no bloquea la navegación.** El loader lanza los `prefetchQuery`
sin `await` y devuelve `null` de inmediato. Si esperara, la pantalla admin no
pintaría hasta que respondieran los catálogos — el efecto contrario al buscado.

**3. El loader no pide nada sin sesión.** Si `getAccessToken()` es `null`, la ruta
admin va a redirigir al login, así que no tiene sentido pedir catálogos. Como
efecto secundario, en el primer render tras un F5 la sesión todavía se está
rehidratando (T03) y el prefetch se saltea; el beneficio aparece en las
navegaciones siguientes, que es el caso que describe el DoD.

**4. Se precargan dos variantes de disciplinas.** Las pantallas de listado llaman
`useDisciplines()` (filtros `{}`) y los formularios `useDisciplines({ isActive: true })`.
Son dos entradas distintas de cache y ambas se usan en casi todas las pantallas.

#### Correcciones manuales

- El chequeo estructural del script de verificación (punto 5) encontró que
  `useDocuments.ts` había quedado sin `staleTime`. No estaba en la lista de la
  tarea, pero dejarlo afuera rompía el invariante "toda query declara su dominio".
  Se sumó a `OPERATIONAL`.

#### Verificación (DoD)

Se ejecutó el `queryClient` real y las *key factories* reales de los hooks
(bundleados con esbuild), simulando la navegación entre pantallas admin:

| # | Chequeo | Resultado |
|---|---|---|
| 1 | Configuración | global 5 min · CATALOG 600 s · OPERATIONAL 120 s · LIVE 30 s |
| 2 | 6 pantallas admin seguidas | **1** request de `disciplines`, **1** de `categories` |
| 3 | Contraste con el comportamiento anterior (`staleTime: 0`) | **6** requests |
| 4 | Dato volátil envejecido más allá de 30 s | se vuelve a pedir ✅ |
| 5 | Hooks con `useQuery` sin `staleTime` | **0** |

- [x] Al navegar entre pantallas admin, `disciplines` y `categories` no se
  re-fetchean (chequeo 2, contra el chequeo 3 que reproduce el comportamiento viejo).
- [x] Los datos volátiles siguen revalidándose (chequeo 4): la optimización no
  congela resultados ni fixtures.
- [x] `npx tsc --noEmit` limpio · `npm run build` OK · `npm run lint` sin errores nuevos.
- [ ] Comprobación manual en el Network tab del navegador: **no ejecutada**. El
  invariante que observa está probado arriba.

#### Notas / aprendizajes

- El chequeo 3 es el que le da sentido al número: sin el contraste, "1 request"
  no dice nada. Con `staleTime: 0` las mismas 6 navegaciones cuestan 6 requests
  por catálogo — y son dos catálogos en casi todas las pantallas.
- El punto 5 del script no prueba comportamiento sino **consistencia**: recorre
  `src/hooks/` y compara la cantidad de `useQuery({` con la de `staleTime:`. Es un
  chequeo barato que evita que el próximo hook nazca sin política de frescura.
- `prefetchQuery` respeta el `staleTime`: si el dato está fresco no dispara
  request, así que el loader corriendo en cada navegación no genera tráfico extra.
- Junto con T18 (`Cache-Control` de 10 min en los mismos catálogos), el navegador
  tiene ahora dos niveles de caché: React Query evita el request, y si igual
  ocurre, el HTTP cache puede resolverlo sin llegar al servidor.

---

### T20 (post-auditoría DevSecOps) — Code splitting: lazy loading de rutas admin (Q6)

> Corresponde a `tasks.md → Fase 5 → T20`. Tercer ítem del Bloque 2.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente ⚛️ FE: Frontend Engineer)
- **Hallazgo cubierto:** Q6 (el visitante público descarga el JS del panel admin)
- **Duración estimada / real:** 1-2h / ~0,5h

#### Prompt utilizado

> procede con la siguiente task

#### Código generado

- `frontend/src/router.tsx` — las 20 páginas admin pasan de import estático a
  `lazy(() => import('@/pages/admin/<Página>'))`.
- `frontend/src/components/layout/AdminLayout.tsx` — `<Suspense>` alrededor del
  `<Outlet />`.
- `frontend/src/components/shared/PageSkeleton.tsx` *(nuevo)* — fallback del
  Suspense, con encabezado, tarjetas y tabla para minimizar el salto de layout.
- `frontend/src/pages/admin/index.tsx` — advertencia de no importar el barrel
  desde el router.

#### Decisiones de implementación

**1. Import archivo por archivo, no desde el barrel.** Es el detalle del que
depende toda la tarea: `lazy(() => import('@/pages/admin/index').then(...))`
compila igual pero arrastra las 20 páginas al mismo chunk, y el split queda en
nada. Cada `lazy()` apunta al archivo concreto. Se dejó una advertencia en el
propio barrel, porque el error es fácil de cometer y silencioso: no rompe nada,
sólo devuelve los 500 KB al visitante público.

**2. Un solo `<Suspense>` en el layout, no uno por ruta.** Envolver el `<Outlet />`
mantiene sidebar y header montados mientras baja el chunk: sólo parpadea el área
de contenido.

**3. El fallback imita la estructura real.** Un spinner centrado haría saltar el
layout cuando llega el contenido. El esqueleto reproduce encabezado + tarjetas +
tabla, que es la forma de casi todas las pantallas admin. Lleva `role="status"` y
`aria-busy` para que un lector de pantalla anuncie la carga.

#### Correcciones manuales

- El primer script de verificación dio un falso positivo: usaba el título
  `"Sedes de Competencia"` como marcador exclusivo de `VenuesAdminPage`, pero la
  página **pública** `VenuesPage` usa exactamente el mismo título, así que la
  cadena aparece legítimamente en el bundle de entrada. Se cambió por
  `"¿Eliminar Sede?"`, que sí es exclusivo del admin.

#### Verificación (DoD)

**Salida real de `npm run build`:**

| | Antes | Después |
|---|---|---|
| Bundle de entrada | **1.269.368 B** (358 kB gzip) | **524.305 B** (155 kB gzip) |
| Reducción del entry | — | **58,7%** |
| Chunks admin diferidos | 0 | **501.178 B** en 20 chunks |

Chequeos automatizados sobre `dist/`:

| # | Chequeo | Resultado |
|---|---|---|
| 1 | Cada una de las 20 páginas admin tiene su chunk (`DashboardPage-<hash>.js`, `InscriptionsPage-<hash>.js`, …) | ✅ 0 faltantes |
| 2 | Marcadores exclusivos de 4 páginas admin **ausentes** del bundle de entrada | ✅ |
| 3 | Esos mismos marcadores **presentes** en su chunk correspondiente | ✅ |
| 4 | Entry por debajo de 600 KB | ✅ 524 KB |

- [x] `npm run build` genera chunks separados por página admin.
- [x] El bundle de entrada de la ruta pública `/` no incluye código de admin
  (verificado por contenido, no sólo por tamaño).
- [x] `npx tsc --noEmit` limpio · `npm run lint` sin errores nuevos.

#### Notas / aprendizajes

- El chequeo 2 vale más que el tamaño: un entry más chico podría deberse a
  cualquier cosa. Buscar cadenas que **sólo** existen en páginas admin prueba que
  el código no está ahí. Y el chequeo 3 evita el error opuesto: que el marcador
  haya desaparecido del build por otra razón y el test pase por accidente.
- `DashboardPage` quedó en 322 KB, con diferencia el chunk más pesado: se lleva
  `recharts`. Ahora al menos sólo lo descarga quien entra al dashboard. Si molesta,
  el siguiente paso sería cargar los gráficos con `lazy()` dentro de la página.
- **Hallazgo fuera del alcance de T20:** el entry sigue en 524 KB porque las
  páginas **públicas** también se importan estáticamente desde
  `@/pages/public/index`. Aplicarles el mismo tratamiento (dejando `HomePage`
  estática, que es la que se ve primero) bajaría bastante más el arranque. No se
  hizo porque T20 dice explícitamente "rutas admin"; queda anotado como
  candidato para el Bloque 4.

---

### T21 (post-auditoría DevSecOps) — `include` → `select` en los services (Q2, Q9, Q11, Q17)

> Corresponde a `tasks.md → Fase 5 → T21`. Cuarto ítem del Bloque 2.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente 🏗️ BE: Backend Architect)
- **Hallazgos cubiertos:** Q2, Q9, Q11, Q17 (entidades completas donde la UI usa 3-4 campos)
- **Duración estimada / real:** 1h / ~1h

#### Prompt utilizado

> procede con la siguiente task

#### Código generado

- `backend/src/common/prisma-selects.ts` *(nuevo)* — proyecciones compartidas:
  `USER_SUMMARY`, `PARTICIPANT_SUMMARY`, `PARTICIPANT_CONTACT`,
  `DISCIPLINE_SUMMARY`, `CATEGORY_WITH_DISCIPLINE`, `TEAM_SUMMARY`,
  `TEAM_MEMBER_WITH_PARTICIPANT`. Tipadas con `satisfies Prisma.XxxSelect`.
- `backend/src/modules/inscriptions/inscriptions.service.ts` — `findAll` y
  `findOne` con `select` explícito.
- `backend/src/modules/teams/teams.service.ts` — ídem.
- `backend/src/modules/results/results.service.ts` — `getRankings` deja de traer
  `team` y `participant` completos.
- `backend/test/payload-size.e2e-spec.ts` *(nuevo)* — 3 tests.
- `frontend/src/types/index.ts` y `frontend/src/pages/admin/TeamsAdminPage.tsx` —
  el listado de equipos usa `_count.members`.

#### Decisiones de implementación

**1. Dos proyecciones de participante, no una.** `PARTICIPANT_SUMMARY`
(id, nombre, apellido, DNI) para listados y `PARTICIPANT_CONTACT` (agrega
nacimiento, sexo, localidad, departamento, email, teléfono) para el detalle. El
comentario del archivo advierte explícitamente que no se agreguen datos de
contacto al primero: es el mismo criterio de T01, pero para las pantallas admin.

**2. `include` no es sólo payload de más, es una decisión que se toma sola.**
`include: { participant: true }` arrastra automáticamente cualquier columna que
se agregue después al modelo. Con `select` explícito, exponer un campo nuevo pasa
a ser deliberado. Quedó anotado en el encabezado del archivo.

**3. La lista de inscripciones deja fuera `notes` y `rejectionNote`.** Son
columnas `Text` que sólo se muestran en el detalle y viajaban en cada una de las
50 filas.

**4. El plantel completo sale del listado de equipos.** `findAll` devuelve
`_count.members` en vez de los integrantes; el frontend pasa a leer ese contador.
`findOne` sí trae el plantel, que es donde se muestra.

#### Correcciones manuales

- **Bug preexistente encontrado al reescribir la query:** `teams.findAll`
  proyectaba `category.discipline` pero nunca la relación directa
  `Team.discipline`, así que en `TeamsAdminPage` la columna "Disciplina" mostraba
  siempre "—" y el cupo se veía como "0 / -". Se incorporó `discipline` al nuevo
  `select`. No estaba en la auditoría; apareció al comparar la proyección con lo
  que la UI lee.
- El primer intento del test leía `res.body.data` y fallaba: el módulo de prueba
  no registraba el `TransformInterceptor`, así que la respuesta no venía envuelta
  en `{ success, data, meta }`. Se agregó el interceptor al módulo de prueba para
  que la forma sea la de producción.

#### Verificación (DoD)

El test monta el `InscriptionsController` real con un mock de Prisma que **aplica
el `select` del service** sobre filas completas (mismo enfoque que en T03): el
payload "después" lo produce el código real, no el test.

| Chequeo | Resultado |
|---|---|
| Payload de `GET /inscriptions?limit=50` | **127.451 B → 34.218 B (73,2% menos)** — el DoD pedía ≥30% |
| La lista conserva qrCode, status, createdAt, participante (nombre + DNI), categoría, disciplina, equipo y autor | ✅ |
| La lista ya no incluye `notes`, `rejectionNote`, el reglamento de la disciplina ni el contacto del participante | ✅ |

- [x] Payload de `GET /inscriptions` reducido ≥30% (73,2% medido).
- [x] Ninguna funcionalidad UI se rompe: se recorrieron los consumidores
  (`InscriptionsPage`, `DashboardPage`, `InscriptionDetailPage`, `TeamsAdminPage`,
  `TeamDetailPage`) campo por campo antes de recortar. El único ajuste necesario
  fue `_count.members`.
- [x] 44 unit + 24 e2e en verde · `tsc` y `build` limpios en backend y frontend.

#### Notas / aprendizajes

- El 73% supera con holgura el 30% estimado porque el reglamento de la disciplina
  (`rules`, un `Text` largo) viajaba **repetido en cada fila**: 50 inscripciones de
  la misma disciplina traían 50 copias del mismo reglamento.
- La forma de medir importa: se comparan las mismas 50 filas antes y después,
  aplicando el `select` real del service. Escribir a mano las dos versiones
  habría medido lo que uno espera, no lo que el código hace.
- Recorrer los consumidores del frontend **antes** de recortar es lo que hizo que
  no se rompiera nada, y de paso destapó el bug de la disciplina faltante.
- `npm run test:e2e` sigue en rojo por `test/app.e2e-spec.ts`, el boilerplate de
  Nest que espera `GET /` → `Hello World!` (ruta que no existe) y que además
  levanta el `AppModule` completo con base de datos. Es previo a estas tareas, pero
  ahora tapa el resultado de las 4 suites e2e nuevas y deja rojo el job de CI:
  conviene borrarlo o adaptarlo.

---

### T13 (post-auditoría DevSecOps) — Namespace de `queryKey` por `userId` (F4, F5, F6, F7)

> Corresponde a `tasks.md → Fase 4 → T13`. Quinto ítem del Bloque 2; completa la
> fortaleza del cache junto con T12.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente ⚛️ FE: Frontend Engineer)
- **Hallazgos cubiertos:** F4-F7 (`queryKey` sin el usuario en inscriptions, participants, users, teams)
- **Duración estimada / real:** 1h / ~0,5h

#### Prompt utilizado

> procede con la siguiente task

#### Código generado

- `frontend/src/hooks/useQueryScope.ts` *(nuevo)* — hook que devuelve
  `user?.id ?? 'anon'`, con la explicación de por qué existe.
- `frontend/src/hooks/useInscriptions.ts`, `useParticipants.ts`, `useUsers.ts`,
  `useTeams.ts` — las *key factories* pasan a recibir el `userId`, y cada hook y
  cada mutación lo obtienen de `useQueryScope()`.

#### Decisiones de implementación

**1. El dominio va primero, el `userId` inmediatamente después.** La forma es
`['inscriptions', <userId>, 'list', filtros]`. El DoD pedía el `userId` como
"primer segmento", pero ponerlo antes del dominio rompería
`invalidateQueries({ queryKey: ['inscriptions'] })` y la agrupación por dominio en
las DevTools. La propiedad que importa —que dos usuarios nunca compartan
entrada— se cumple igual, y hay un chequeo dedicado a que la invalidación por
dominio siga funcionando.

**2. Un hook, no un parámetro.** `useQueryScope()` centraliza el
`user?.id ?? 'anon'`. Si mañana el ámbito tuviera que incluir el rol (un usuario
que cambia de rol vería datos distintos), se cambia en un solo lugar.

**3. La consulta pública por QR queda fuera del namespace.** `useInscriptionByQr`
usa `['inscriptions', 'public', 'qr', <código>]`: desde T01 esa respuesta es
idéntica para cualquiera, así que namespacearla sólo obligaría a re-pedirla en
cada sesión sin ganar nada.

**4. Ámbito `'anon'` para las sesiones sin usuario.** Evita que la clave quede
malformada mientras la sesión se rehidrata (T03) o en las pantallas públicas.

#### Correcciones manuales

- La reescritura automática de las *factories* también alcanzó a
  `useInscriptionByQr`, que había quedado con `INSCRIPTION_KEYS.details(scope)`.
  Se le dio su propia clave pública (punto 3).

#### Verificación (DoD)

Se ejecutaron las *key factories* reales y un `QueryClient` real:

| # | Chequeo | Resultado |
|---|---|---|
| 1 | Forma de la clave | `["inscriptions","aaaaaaaa-…-0001","list",{"filters":{…}}]` |
| 2 | Mismos filtros, dos usuarios → hash distinto en los 4 dominios | ✅ |
| 3 | A y B consultando con los mismos filtros | **2 entradas** en cache; B lee sus propios datos |
| 4 | `invalidateQueries({ queryKey: ['inscriptions'] })` | alcanza las 2 entradas ✅ |
| 5 | Clave pública del QR | compartida entre sesiones y sin `userId` ✅ |

- [x] El `queryKey` incluye el `userId` (posición 1, detrás del dominio).
- [x] Dos usuarios distintos con los mismos filtros generan **dos entradas
  separadas** en el cache.
- [x] `npx tsc --noEmit` limpio · `npm run build` OK · `npm run lint` sin errores.

#### Notas / aprendizajes

- El chequeo 4 es el que justifica la decisión de orden: sin él, "el userId está
  en la clave" podría haberse logrado rompiendo todas las invalidaciones del
  proyecto sin que ningún test se quejara.
- T12 (vaciar la cache en el logout) y T13 son complementarias: T12 limpia entre
  sesiones sucesivas; T13 hace que ni siquiera colisionen si aparece un camino que
  no pase por `logout()`. Ninguna vuelve redundante a la otra.
- Con `'anon'` como ámbito, las pantallas públicas que usan estos hooks siguen
  compartiendo cache entre visitantes anónimos, que es lo correcto: ven lo mismo.

---

### T14 (post-auditoría DevSecOps) — `ProtectedRoute` con `allowedRoles` obligatorio (F8)

> Corresponde a `tasks.md → Fase 4 → T14`. Cierra el refuerzo de acceso del
> Bloque 2 junto con T13.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente ⚛️ FE: Frontend Engineer)
- **Hallazgo cubierto:** F8 (`ProtectedRoute` sin `allowedRoles` deja la ruta abierta a cualquier autenticado)
- **Duración estimada / real:** 1h / ~0,75h

#### Prompt utilizado

> procede con la siguiente task

#### Código generado

- `frontend/src/lib/roles.ts` *(nuevo)* — grupos de roles espejados de los
  `@Roles(...)` del backend: `ADMIN_ROLES`, `CATALOG_MANAGERS`,
  `INSCRIPTION_MANAGERS`, `PARTICIPANT_MANAGERS`, `RESULT_LOADERS`,
  `REPORT_VIEWERS`, `DASHBOARD_VIEWERS`, `SYSTEM_MANAGERS` y `ADMIN_AREA_ROLES`.
- `frontend/src/components/shared/ProtectedRoute.tsx` — `allowedRoles` pasa a ser
  obligatorio y la comprobación deja de ser condicional.
- `frontend/src/router.tsx` — las 21 rutas admin declaran sus roles con el helper
  `conRoles(...)`.

#### Decisiones de implementación

**1. Dos niveles de control.** El `ProtectedRoute` exterior (el que envuelve
`AdminLayout`) usa `ADMIN_AREA_ROLES` y responde "¿podés entrar al área?"; cada
ruta agrega su propio `allowedRoles` y responde "¿podés ver *esta* pantalla?".
Un `ARBITRO` entra al área —carga resultados— y aun así no alcanza
`/admin/usuarios`.

**2. Los roles salen de los controllers, uno por uno.** Se recorrieron los
`@Roles(...)` de cada módulo del backend para armar la tabla:

| Ruta | Roles | Fuente en el backend |
|---|---|---|
| Dashboard | admins + coordinador | `dashboard.controller` |
| Participantes, equipos, documentos | admins + delegado + coordinador | `participants` / `teams` / `documents` |
| Inscripciones (incl. alta) | admins + delegado | `INSCRIPTION_REVIEWERS` / `INSCRIPTION_CREATORS` |
| Disciplinas y categorías | super admin + admin provincial | mutaciones de `disciplines` / `categories` |
| Competencias, noticias, calendario, sedes | admins | mutaciones de cada módulo |
| Resultados | admins + árbitro | `results.controller` |
| Reportes | admins + delegado | `reports.controller` |
| Usuarios y auditoría | super admin + admin provincial | `users` / `audit` |

Para las pantallas de gestión cuyo `GET` es público (disciplinas, categorías,
sedes, noticias, calendario, competencias) se tomaron los roles de **mutación**:
son pantallas de administración, no de consulta.

**3. `!user` cuenta como denegado.** La comprobación pasó de
`if (allowedRoles && user && ...)` a `if (!user || !allowedRoles.includes(...))`.
Antes, un estado raro con sesión "autenticada" pero sin objeto `user` caía en el
`return <>{children}</>`.

#### Correcciones manuales

- La verificación necesitó dos ajustes de andamiaje, no de código de producción:
  un stub del store de auth (aliasado con esbuild) para poder fijar el rol, y un
  `<MemoryRouter>` alrededor, porque `ProtectedRoute` usa `useLocation()`.

#### Verificación (DoD)

Renderizando el `ProtectedRoute` real con `react-dom/server`:

| # | Chequeo | Resultado |
|---|---|---|
| 1 | `ARBITRO` en `/admin/usuarios` | ve **"Acceso Denegado"**; la página **no** se renderiza |
| 2 | `ARBITRO` en `/admin/auditoria` | denegado |
| 2 | `ARBITRO` en `/admin/resultados` | permitido |
| 2 | `DELEGADO` en `/admin/usuarios` / `/admin/participantes` | denegado / permitido |
| 2 | `SUPER_ADMIN` en `/admin/usuarios` | permitido |
| 2 | `ENTRENADOR` en el área admin | denegado |
| 3 | Rutas admin sin `allowedRoles` | **0 de 21** |
| 4 | `allowedRoles?:` en el tipo | ya no existe; es requerido |

- [x] Un usuario `ARBITRO` que navega a `/admin/usuarios` ve "Acceso Denegado".
- [x] **Sin request al backend:** el chequeo 1 confirma que el contenido de la
  página no se renderiza. Como las páginas admin son lazy y sus hooks
  (`useUsers`, etc.) sólo corren al montarse, no llegan a dispararse.
- [x] `allowedRoles` obligatorio en el tipo TS: el compilador rechaza una ruta sin
  roles — de hecho, el primer `tsc` tras el cambio falló señalando exactamente el
  `ProtectedRoute` del router que faltaba completar.
- [x] `npm run build` OK · `npm run lint` sin errores.

#### Notas / aprendizajes

- Que el tipo sea obligatorio es la mitad más valiosa de la tarea: la lista de
  rutas de hoy queda cubierta por los tests, pero la ruta que alguien agregue en
  seis meses la cubre el compilador.
- El chequeo 3 (contar rutas contra usos de `conRoles`) protege el caso de agregar
  una ruta admin **fuera** del helper.
- Queda pendiente algo que esta tarea no cubre: el `Sidebar` sigue mostrando los
  links de todas las secciones. Un `ARBITRO` ve "Usuarios" en el menú y al hacer
  click recibe "Acceso Denegado". Funciona, pero es mala UX; filtrar el menú con
  las mismas constantes de `lib/roles.ts` sería el complemento natural.

---

### T05 (post-auditoría DevSecOps) — Rate limiting en endpoints públicos scrapeables (A-01)

> Corresponde a `tasks.md → Fase 2 → T05`. Arranca la tanda de severidad alta del
> Bloque 2.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro (asistido por agente 🏗️ BE: Backend Architect)
- **Hallazgo cubierto:** A-01 (endpoints públicos sin cupo propio)
- **Duración estimada / real:** 0,5h / ~0,5h

#### Prompt utilizado

> procede con la siguiente task y al final de archivo tasks.md agrega un cuadro
> con las tareas y su estado

#### Código generado

- `backend/src/common/decorators/throttle.decorator.ts` *(nuevo)* —
  `@PublicReadThrottle()` y la constante `PUBLIC_READ_RATE_LIMIT`.
- **15 endpoints públicos** decorados en 8 módulos: `inscriptions` (QR),
  `competitions` (2), `results` (rankings), `disciplines` (2), `categories` (2),
  `venues` (2), `news` (3), `calendar` (2).
- `backend/test/public-throttle.e2e-spec.ts` *(nuevo)* — 5 tests.

#### Decisiones de implementación

**1. Un decorador con nombre en lugar de repetir el literal.** La tarea pedía
`@Throttle({ default: { limit: 20, ttl: 60_000 } })` en cada endpoint.
`@PublicReadThrottle()` es exactamente eso, pero dice *por qué* está: ajustar el
cupo de todos los endpoints públicos pasa a ser cambiar una constante, y el
JSDoc explica el criterio en un solo lugar.

**2. `/health` queda fuera, a propósito.** Es `@Public()`, pero los chequeos de
disponibilidad consultan cada pocos segundos y quedarían bloqueados a los 20.
Está anotado como advertencia en el decorador.

**3. `/auth/login` y `/auth/refresh` tampoco se tocaron.** El login ya tiene su
propio cupo, más estricto y adecuado a un endpoint de credenciales
(`@Throttle({ default: { limit: 5, ttl: 900000 } })`, 5 intentos cada 15 min), y
limitar el refresh a 20/min podría cortar sesiones legítimas.

**4. Por qué 20/min alcanza.** Es el cupo para una persona navegando el sitio
público, y desde T19 React Query cachea los catálogos 10 minutos, así que una
sesión real hace muchas menos requests que eso. Un scraper que quiera bajarse el
padrón de disciplinas, sedes o competencias —o probar códigos QR por fuerza
bruta— se topa con el límite enseguida.

#### Correcciones manuales

- Ninguna sobre lo generado. La única decisión de criterio fue excluir `/health`
  y los endpoints de `auth`, que la tarea no mencionaba.

#### Verificación (DoD)

**5 tests e2e** con el `ThrottlerGuard` real montado como guard global:

| # | Chequeo | Resultado |
|---|---|---|
| 1 | El cupo público es 20/60 s | ✅ |
| 2 | **30 requests seguidas al listado público** | **20 OK y 10 rechazadas; el primer 429 llega en la #21** |
| 3 | El detalle público también está limitado (25 requests) | 5 rechazadas ✅ |
| 4 | Agotar el cupo del listado **no** deja sin servicio al detalle | ✅ contadores independientes |
| 5 | Un endpoint no decorado (`POST /disciplines`) | conserva el cupo global de 100/min ✅ |

- [x] Un script de 30 requests seguidas al mismo endpoint desde la misma IP
  recibe `429` a partir de la #21.
- [x] 44 unit + 29 e2e en verde · `npm run build` OK.

#### Notas / aprendizajes

- El chequeo 4 fue una duda real antes de escribirlo: si el contador fuera por IP
  y nada más, agotar el listado dejaría sin sitio público al visitante. El
  `ThrottlerGuard` lleva un contador por IP **y por handler**, así que el límite
  es por endpoint. Queda documentado con un test para que se note si eso cambia.
- El chequeo 5 es el contrapeso: confirma que el cupo estricto no se derramó sobre
  las operaciones de back-office, que necesitan el margen de 100/min.
- Detrás de un reverse proxy el `ThrottlerGuard` ve la IP del proxy y limitaría a
  **todos** los visitantes juntos. **T07 activa `trust proxy`**, que es lo que hace
  que `request.ip` sea la IP real del cliente: hasta entonces, este límite no está
  bien calibrado en producción. Conviene no desplegar T05 sin T07.

---

### T06 (post-auditoría DevSecOps) — Ocultar Swagger en producción (A-02)

> Corresponde a `tasks.md → Fase 2 → T06`. **Primera tarea ejecutada delegando en
> el agente `Backend Architect`** (`.claude/agents/engineering-backend-architect.md`),
> según el flujo por tarea de `tasks.md`.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro · implementación por el agente 🏗️ **Backend Architect**
- **Hallazgo cubierto:** A-02 (documentación de la API expuesta en producción)
- **Duración estimada / real:** 0,25h / ~0,3h

#### Prompt utilizado

Prompt enviado al agente `Backend Architect` (resumen de lo sustantivo):

> Te toca **T06** del backend NestJS. Descripción de `tasks.md`: envolver el bloque
> `SwaggerModule.createDocument/setup` de `main.ts` con `if (nodeEnv !== 'production')`.
> DoD: con `NODE_ENV=production`, `GET /api/docs` devuelve 404.
>
> Restricciones del proyecto: comentarios en español rioplatense explicando el
> **por qué**; no adelantar T07 (`trust proxy`) ni T09 (CORS/CSP); los tests van en
> `backend/test/*.e2e-spec.ts` siguiendo el estilo de `http-cache.e2e-spec.ts`.
>
> **Sobre la verificación:** cada tarea de este proyecto se cierra con evidencia
> ejecutable. Si levantar el `AppModule` completo no es viable (no hay base de datos
> disponible), extraé la lógica de Swagger a una función exportada y testeable y
> testeá esa función con una app Nest mínima. Elegí vos el enfoque; lo que no vale es
> cerrar la tarea sin evidencia ejecutable.
>
> Devolveme: archivos tocados, decisiones de diseño y por qué, comando de
> verificación con su salida, y lo que hayas encontrado fuera del alcance.

#### Código generado

- `backend/src/swagger.ts` *(nuevo)* — `setupSwagger(app, nodeEnv)` con todo el
  bloque `DocumentBuilder` / `createDocument` / `setup`. Corta temprano con
  `if (nodeEnv === 'production') return false;` y exporta `SWAGGER_PATH` para que
  ruta, log y test compartan una única fuente.
- `backend/src/main.ts` — se agrega `nodeEnv` a las lecturas del `ConfigService`,
  el bloque de ~40 líneas se reemplaza por `setupSwagger(app, nodeEnv)`, se
  elimina el import de `@nestjs/swagger` y el log `📚 Swagger docs` pasa a salir
  sólo si efectivamente se montó.
- `backend/test/swagger-production.e2e-spec.ts` *(nuevo)* — 6 casos e2e sin DB.

#### Decisiones del agente (y por qué)

**1. Función extraída en vez de un `if` inline.** El DoD pide evidencia de que
`/api/docs` da 404 en producción, y eso no se puede testear desde `main.ts`:
`bootstrap()` levanta el `AppModule` completo (Postgres, Redis, MinIO) y sólo se
ejecuta como *side effect* de `void bootstrap()`. Con la función exportada, el
test monta una app Nest mínima con un controller de prueba y pega HTTP real. El
comportamiento en runtime es idéntico; la diferencia es que ahora es verificable.

**2. Se omite el bloque entero, no se protege la ruta.** En producción no se
genera el documento: no queda spec en memoria ni ruta que puentear por un orden
de middlewares mal puesto.

**3. Se cubre también `/api/docs-json`.** El spec crudo filtra el mismo mapa de
endpoints que la UI y es la ruta que suele quedar olvidada. Con el early return
cae sola, pero queda cubierta contra regresiones.

**4. El log dejó de mentir.** Antes anunciaba `📚 Swagger docs: …` siempre,
incluso donde la doc no existía.

#### Correcciones manuales

- **Ninguna sobre el código entregado.** El rol acá fue de revisión: se leyó el
  diff completo y se **reejecutó la verificación de forma independiente** en vez de
  tomar el reporte del agente como válido. Los números coinciden.
- Detalle que el propio agente reportó de su proceso: su primer assert de la UI en
  desarrollo buscaba el título `'Juegos Evita'` en el HTML y falló, porque el
  título lo inyecta `swagger-ui-init.js` y no el shell. Lo corrigió buscando
  `swagger-ui`.

#### Verificación (DoD)

**6 tests e2e** (`npx jest --config ./test/jest-e2e.json --testPathPatterns swagger-production`):

| # | Chequeo | Resultado |
|---|---|---|
| 1 | `NODE_ENV=production` → `GET /api/docs` | **404** |
| 2 | `NODE_ENV=production` → `GET /api/docs-json` | 404 |
| 3 | La app sigue sirviendo sus rutas normales en producción | ✅ |
| 4 | En desarrollo la UI está disponible | ✅ |
| 5 | En desarrollo el JSON de OpenAPI lista los endpoints | ✅ |
| 6 | `NODE_ENV` ausente se trata como desarrollo | ✅ |

Reejecutado por fuera del agente: `npx tsc --noEmit` OK · `npm run build` OK ·
`npx jest` **44/44** · e2e completa **35/35** (29 previos + 6 nuevos).

- [x] Con `NODE_ENV=production`, `GET /api/docs` devuelve 404.

#### Notas / aprendizajes

- **Sobre delegar en el agente:** la instrucción que cambió el resultado fue la de
  exigir evidencia ejecutable dejando el *cómo* a criterio del agente. Con un `if`
  inline la tarea se cerraba en tres líneas y sin forma de probar el DoD; el
  agente eligió extraer la función justamente para poder verificarlo.
- Revisar el diff y reejecutar los comandos es parte del flujo, no un extra: el
  reporte de un agente es un insumo, no la evidencia.
- **Fuera de alcance, reportado por el agente:** `SwaggerModule.setup('api/docs', …)`
  ignora el prefijo global `api/v1`, así que la doc vive en `/api/docs` y no en
  `/api/v1/docs`. Es el comportamiento previo y el DoD nombra `/api/docs`, así que
  quedó igual.

---

### T07 (post-auditoría DevSecOps) — IP y User-Agent en la auditoría + `trust proxy` (A-06)

> Corresponde a `tasks.md → Fase 2 → T07`. Implementada por el agente
> 🏗️ **Backend Architect**. Destraba a T05.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro · implementación por el agente 🏗️ **Backend Architect**
- **Hallazgo cubierto:** A-06 (auditoría sin IP ni User-Agent)
- **Duración estimada / real:** 0,5h / ~0,5h

#### Diagnóstico previo (antes de delegar)

Se revisó el estado real y **buena parte de lo que pedía la tarea ya estaba hecho**:

| Pieza | Estado encontrado |
|---|---|
| `AuditInterceptor` lee `ip` y `User-Agent` y los pasa a `auditService.log()` | ✅ ya estaba |
| `AuditService.log()` persiste `ipAddress` / `userAgent` | ✅ ya estaba |
| Columnas `ip_address` / `user_agent` en el modelo `AuditLog` | ✅ ya existían (sin migración pendiente) |
| `app.set('trust proxy', 1)` en `main.ts` | ❌ **faltaba** |
| Eventos `LOGIN` / `LOGIN_FAILED` / `LOGOUT` con IP y User-Agent | ❌ **faltaba** |

Ese diagnóstico se le pasó al agente para que no reimplementara lo existente y
atacara lo que faltaba. La ruta del interceptor que indica `tasks.md`
(`src/common/interceptors/audit.interceptor.ts`) está desactualizada: el archivo
real es `src/modules/audit/audit.interceptor.ts`.

#### Prompt utilizado

Prompt enviado al agente (resumen de lo sustantivo):

> Te toca **T07**. Texto de `tasks.md`: el interceptor debe leer `request.ip` y el
> User-Agent y pasarlos al `auditService.log()`; habilitar `app.set('trust proxy', 1)`.
> DoD: un registro de `AuditLog` muestra ambos campos poblados.
>
> **Diagnóstico previo (partí de acá, no lo repitas):** el interceptor, el service y
> las columnas del modelo ya están. No hace falta migración y no la podrías correr
> (Docker apagado). Lo que falta de verdad es: **(a)** `trust proxy` —sin él,
> detrás de nginx `request.ip` es la IP del proxy, lo que además rompe el rate
> limiting de T05, que cuenta por IP—; y **(b)** los eventos de auth
> (`LOGIN`, `LOGIN_FAILED`, `LOGOUT`) que se auditan a mano en `AuthService` sin IP
> ni User-Agent, justo donde el dato más importa.
>
> Restricción: T25 va a consolidar el contrato entre el interceptor y las llamadas
> manuales; **no reestructures eso ahora**.
>
> El DoD literal pide mirar la tabla y no hay DB: la evidencia equivalente es un
> test que dispare una operación real por HTTP y verifique que `prisma.auditLog.create`
> recibió ambos campos, más un test con `X-Forwarded-For`.

#### Código generado

- `backend/src/main.ts` — la app se tipa como `NestExpressApplication` y se agrega
  `app.set('trust proxy', 1)`.
- `backend/src/modules/auth/auth.controller.ts` — `@Ip()` y
  `@Headers('user-agent')` en `login` y `logout`.
- `backend/src/modules/auth/auth.service.ts` — nueva interfaz
  `AuthRequestContext`, parámetro `context` en `login`, `logout` y
  `logAuditAction`, y persistencia de ambos campos.
- `backend/test/audit-request-context.e2e-spec.ts` *(nuevo)* — 6 tests.

#### Decisiones del agente (y por qué)

**1. `NestExpressApplication` en vez de `getHttpAdapter().getInstance()`.** El
segundo devuelve `any`, así que el `.set()` no se chequea en compilación. El
genérico deja la app tipada; el import es `import type`, o sea que no agrega nada
en runtime.

**2. `1` y no `true`.** `true` confía en toda la cadena de `X-Forwarded-For`, con
lo cual **cualquier cliente podría falsificar su IP** mandando su propio header —
y evadir el rate limiting de T05 con un header distinto por request. Con `1`
Express confía en un solo salto y toma la última entrada, que es la que anexa
nginx y el cliente no controla. Hay un test dedicado a esto.

**3. Un objeto `AuthRequestContext` en lugar de dos parámetros posicionales.** La
firma queda retrocompatible, es extensible sin cambiar aridad y coincide de forma
nombrada con el shape de `AuditService.log()`, lo que le deja el terreno servido a
T25. El agente dejó un `TODO(T25)` explícito.

#### Correcciones manuales

- **Ninguna sobre el código entregado.** Se revisó el diff y se reejecutó toda la
  verificación de forma independiente.
- **Sí se verificó por fuera el supuesto que el agente marcó como pendiente:**
  `trust proxy 1` sólo es correcto si nginx anexa la IP real. Se revisó
  `docker/nginx/nginx.conf` y en la línea 50 está
  `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`. Confirmado: la
  última entrada del header es la IP real del cliente, que es exactamente la que
  toma Express con `trust proxy 1`. **Sin ese `proxy_set_header`, la configuración
  habría sido peor que no hacer nada**, porque haría confiar en un header
  controlado por el cliente.

#### Verificación (DoD)

**6 tests e2e** (`npx jest --config ./test/jest-e2e.json --testPathPatterns audit-request-context`):

| # | Chequeo | Resultado |
|---|---|---|
| 1 | `POST /disciplines` real → `prisma.auditLog.create` | recibe `ipAddress` y `userAgent` poblados |
| 2 | `LOGIN` | ambos campos ✅ |
| 3 | `LOGIN_FAILED` (sirve para detectar credential stuffing) | ambos campos ✅ |
| 4 | `LOGOUT` | ambos campos ✅ |
| 5 | Con `trust proxy` y `X-Forwarded-For: 198.51.100.13, 203.0.113.77` | registra **203.0.113.77** (la que anexa nginx) e ignora la falsificada |
| 6 | **Regresión inversa:** sin `trust proxy`, la misma request | registra `::ffff:127.0.0.1`, la IP del proxy para todos por igual |

Reejecutado por fuera del agente: `tsc` OK · `build` OK · `npx jest` **44/44** ·
e2e **41/41** (35 previos + 6 nuevos).

- [x] Un registro de `AuditLog` posterior al cambio muestra ambos campos poblados.

#### Notas / aprendizajes

- El test 6 es el que le da valor al 5: sin el contraste, "se registra la IP
  correcta" no distingue entre que funcione el `trust proxy` y que el test corra
  sin proxy de por medio. Además falla si alguien saca la línea de `main.ts`.
- El interceptor llama a `auditService.log()` **sin `await`** (correcto: la
  auditoría no debe demorar la respuesta), así que el spec necesita un
  `flushAuditoria()` con `setImmediate` antes de mirar el mock.
- **Con esto queda destrabada T05:** el rate limiting ya cuenta por IP real.

#### Hallazgos fuera de alcance reportados por el agente

1. **`AuditInterceptor.sanitizeBody` es superficial**: borra `password`,
   `passwordHash` y `refreshToken` sólo en el primer nivel del body. Un DTO
   anidado —o campos como `token`, `secret`, `dni`— se guardan tal cual en
   `changes`. Es riesgo de PII y credenciales en la tabla de auditoría. **Encaja en
   T25 y conviene tratarlo ahí.**
2. **`refreshTokens` no audita el reuso de un refresh token**, que es la señal más
   fuerte de robo de sesión: hoy lo invalida en silencio y devuelve 403, sin dejar
   rastro. Es un hallazgo nuevo, no parte de A-06.
3. `AuthService.logAuditAction` y `AuditService.log` son código duplicado con
   contratos casi idénticos: es exactamente lo que T25 va a consolidar.
4. La ruta del interceptor en `tasks.md` está desactualizada (ver arriba).

---

### T08 (post-auditoría DevSecOps) — Silenciar `console.error` en producción (A-04, F14)

> Corresponde a `tasks.md → Fase 2 → T08`. Implementada por el agente
> ⚛️ **Frontend Engineer**.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro · implementación por el agente ⚛️ **Frontend Engineer**
- **Hallazgos cubiertos:** A-04, F14 (errores crudos en la consola de producción)
- **Duración estimada / real:** 1h / ~0,6h

#### Relevamiento previo (antes de delegar)

- **22 ocurrencias en 21 archivos**, todas `console.error`. No había ningún
  `console.log/debug/info/warn` en `src/`.
- Ninguna estaba condicionada.
- `NewsDetailPage` tenía la variante `.catch(console.error)` (el error va como
  callback); `InscriptionDetailPage` concentraba 3.

#### Prompt utilizado

Prompt enviado al agente (resumen de lo sustantivo):

> Te toca **T08**. `tasks.md` pide reemplazar los `console.error` por
> `toast.error(...)` + `if (import.meta.env.DEV) console.error(err)`. DoD: el grep
> de `console.*` fuera de bloques DEV no arroja resultados.
>
> **Relevamiento previo (partí de acá):** 22 ocurrencias en 21 archivos, todas
> `console.error`, ninguna condicionada. [lista completa]
>
> **1. Un helper, no 22 condicionales repetidos.** Creá `src/lib/logger.ts` que
> envuelva el `console.error` dentro del guard. Queda una sola aparición en todo el
> código y el DoD se cumple igual.
>
> **2. Cuidado con los toasts duplicados — esto es lo importante.** La tarea dice
> "reemplazar por `toast.error(...)`", pero **revisá caso por caso**: muchos de esos
> `catch` están en componentes cuyas mutaciones ya muestran un toast desde el
> `onError` de los hooks. Si el hook ya notifica, sólo reemplazá el `console.error`;
> si el error se traga en silencio, agregá el toast. Contame cuáles caían en cada caso.
>
> **3. No adelantes T16** (sanitizar los mensajes del backend).

#### Código generado

- `frontend/src/lib/logger.ts` *(nuevo)* — `logError(context, error)`, **única
  aparición de `console.error` en todo `src/`**, dentro del guard
  `import.meta.env.DEV`.
- **20 archivos** con el cambio mecánico: import del helper y
  `console.error(x)` → `logError('Componente.handler', x)`.
- `frontend/src/pages/public/NewsDetailPage.tsx` — tratamiento especial (abajo).

#### Decisión de criterio: el DoD literal habría empeorado la UX

`tasks.md` pedía "reemplazar **todos** por `toast.error(...)` + condicional". El
agente verificó hook por hook (`useCategories`, `useDisciplines`, `useNews`,
`useTeams`, `useVenues`, `useCompetitions`, `useInscriptions`, `useParticipants`,
`useUsers`) y encontró que **todas** las mutaciones ya tienen `onError` con
`toast.error(...)`.

| Situación | Sitios | Qué se hizo |
|---|---|---|
| El usuario **ya recibe** notificación (el `catch` envuelve un `mutateAsync` cuyo hook toastea) | **21 de 22** | Sólo se reemplazó el `console.error` por el helper |
| El error se **tragaba en silencio** | **1** (`NewsDetailPage.handleShare`) | Se agregó `toast.error(...)` |

Cumplir la letra habría mostrado **dos mensajes por el mismo error en 21 lugares**.
`ReportsPage.handleExport` es el caso más evidente: ya tenía su propio
`toast.error(...)` en la línea siguiente al `console.error`.

**El caso especial vale la pena:** `navigator.share` rechaza con `AbortError`
cuando la persona cierra la hoja de compartir, que es el caso dominante. Un toast
de error por una cancelación deliberada es ruido, no información. Quedó:

```ts
.catch((error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') return;
  logError('NewsDetailPage.handleShare', error);
  toast.error('No pudimos abrir el menú de compartir. Copiá el enlace desde la barra del navegador.');
});
```

El mensaje es accionable: la otra rama del mismo handler ya copia el enlace al
portapapeles.

#### Correcciones manuales

- **Ninguna sobre el código entregado.** Se revisó el diff y se reejecutó la
  verificación de forma independiente, incluido un contraste puntual: se confirmó
  en `useCategories.ts:43-45` que el `onError` del hook efectivamente toastea, que
  es el supuesto sobre el que descansa la decisión de no duplicar.
- **Beneficio lateral no pedido:** el helper recibe un `context`
  (`'CategoriesAdminPage.handleDeleteConfirm'`). Antes casi todos los sitios
  loggeaban el error pelado, sin decir de dónde venía.

#### Verificación (DoD)

```
$ grep -rn "console\.(error|log|debug|info|warn)" frontend/src/   # sólo código
src/lib/logger.ts:31:    console.error(`[${context}]`, error);
```

Esa única aparición vive dentro de `if (import.meta.env.DEV)`.

- [x] El grep de `console.*` fuera de bloques `import.meta.env.DEV` no arroja
  resultados.
- [x] `npx tsc --noEmit -p tsconfig.app.json` sin errores.
- [x] `npm run build` OK · `npm run lint` **0 errores** (siguen sólo los warnings
  preexistentes de `react(only-export-components)`).

#### Notas / aprendizajes

- La instrucción que evitó un resultado peor fue pedir explícitamente que
  **revisara caso por caso antes de agregar toasts**. Con la letra de `tasks.md`
  sola, el resultado "correcto" según el DoD habría sido 21 notificaciones
  duplicadas.
- Centralizar el guard en un helper es mejor que repetir el condicional: el DoD se
  cumple por construcción y no depende de que cada `catch` futuro se acuerde de
  envolver la llamada.

#### Hallazgos fuera de alcance reportados por el agente

1. **Mensajes crudos del backend en toasts (es T16):**
   - `hooks/useInscriptions.ts:83-85` — muestra `error.response.data.message` crudo.
     **Es el más sensible: lo ve el usuario público anónimo** en el alta de
     inscripción, no un admin.
   - `hooks/useCompetitions.ts:49-54` y `:70-75` — mismo patrón en crear y actualizar.
   - Son además los únicos tres `onError: (error: any)` que quedan; al implementar
     `getFriendlyError` conviene tiparlos de paso.
2. **`any` en los formularios:** los ocho comparten `form.handleSubmit(onSubmit as any)`
   y `ParticipantForm` tiene `form.reset({...} as any)`. Es un problema de tipado del
   resolver de Zod/RHF, ajeno a T08.
3. **`TeamDetailPage`** tiene un modal con el placeholder literal
   *"(Formulario de búsqueda de participantes pendiente)"*: funcionalidad incompleta,
   no un problema de consola.

---

### T09 (post-auditoría DevSecOps) — Endurecer CORS y CSP (M-02, M-03)

> Corresponde a `tasks.md → Fase 3 → T09`. **Cierra el Bloque 2.** Implementada
> por el agente 🏗️ **Backend Architect**.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro · implementación por el agente 🏗️ **Backend Architect**
- **Hallazgos cubiertos:** M-02 (CORS con default permisivo), M-03 (helmet sin CSP explícito)
- **Duración estimada / real:** 1h / ~0,75h

#### Relevamiento previo (antes de delegar)

- La parte (a) del enunciado —*"fallar si `CORS_ORIGINS` no está seteado en
  producción"*— **ya la cubría T04**: el schema le pone
  `default('http://localhost:5173')` y el `superRefine` rechaza `localhost` en
  producción, así que no setear la variable ya hacía fallar el arranque. Se le
  pidió al agente que lo verificara en vez de duplicarlo.
- `helmet()` estaba con la configuración por defecto.
- **Hay un segundo emisor de cabeceras:** `docker/nginx/nginx.conf` ya agrega CSP,
  HSTS y compañía, pensados para la SPA. Se le marcó al agente que decidiera el
  reparto de responsabilidades, sin tocar el nginx.

#### Prompt utilizado

Resumen de lo sustantivo del prompt enviado al agente:

> Te toca **T09**. (a) fallar si `CORS_ORIGINS` no está seteado en producción;
> (b) helmet con CSP explícito, HSTS y `crossOriginResourcePolicy: same-site`.
>
> **Relevamiento previo:** (a) ya lo cubre T04 [razonamiento completo].
> Verificalo y no lo dupliques; si encontrás un agujero real en ese razonamiento,
> arreglalo.
>
> **Puntos de criterio que quiero que resuelvas:** el CSP de una SPA no sirve para
> una API JSON — pensá qué directivas corresponden. **Cuidado con Swagger**: en
> desarrollo la UI de `/api/docs` necesita scripts y estilos inline, y un
> `default-src 'none'` global la rompería. Definí `maxAge`, `includeSubDomains` y
> evaluá `preload` para HSTS. Verificá qué recibe hoy un `Origin` no permitido y
> revisá si a `allowedHeaders` le falta algo **real** (no agregues por las dudas).
>
> `docker/nginx/nginx.conf` ya emite CSP para la SPA: decidí el reparto entre capas
> y explicá el criterio; si concluís que hay que tocarlo, decímelo pero no lo toques.

#### Código generado

- `backend/src/security.ts` *(nuevo)* — helmet (CSP por ruta, HSTS, CORP) y CORS
  en funciones puras + `setupSecurity(app, …)`.
- `backend/src/main.ts` — reemplaza `helmet()` y el bloque `enableCors` por una
  sola llamada a `setupSecurity`.
- `backend/src/swagger.ts` — se extrae `swaggerHabilitado(nodeEnv)` como única
  fuente de verdad sobre si hay docs.
- `backend/test/security-headers.e2e-spec.ts` *(nuevo)* — 23 tests.

#### Decisiones del agente (y por qué)

**1. Confirmó (a) y además encontró dos agujeros reales.**
- `CORS_ORIGINS=` **definida pero vacía** pasaba la validación (no contiene
  "localhost") y llegaba a `enableCors` como `['']`: la app quedaba arriba con
  CORS roto para todo el frontend y **sin ningún mensaje**. Ahora falla el
  arranque. *Fail-fast, no fail-silent.*
- El `split(',')` de `config/index.ts` no recorta espacios, así que
  `CORS_ORIGINS=https://a.gob.ar, https://b.gob.ar` producía el origen
  `" https://b.gob.ar"`, que **nunca matchea**: el segundo dominio quedaba afuera
  en silencio. `parseCorsOrigins` recorta y filtra vacíos.

**2. CSP de la API: `default-src 'none'`.** Una respuesta JSON no se renderiza
como documento, así que el `'self'` de la SPA sería permiso regalado. Se cierran
además `frame-ancestors 'none'` (clickjacking), `base-uri 'none'` y
`form-action 'none'`. `upgrade-insecure-requests` **sólo en producción**: en
desarrollo se sirve por HTTP plano.

**3. La excepción de Swagger, resuelta por ruta.** Un solo `app.use` que despacha:
helmet estricto para la API y uno relajado que aplica **sólo** a `/api/docs`,
`/api/docs/*` y `/api/docs-json`. Se prefirió esto a dos montajes de Express
porque helmet pisa cabeceras y el último registrado ganaría, anulando la
excepción o comiéndose el CSP estricto. El relajado **ni se construye** si
`swaggerHabilitado(nodeEnv)` es falso: en producción la excepción no existe como
código ejecutable.

**4. HSTS `max-age=31536000; includeSubDomains`, sin `preload`.** La lista de
precarga es prácticamente irreversible y aplica al dominio raíz **y todos sus
subdominios**: podría tumbar intranets o sistemas viejos de la provincia que
todavía andan por HTTP. Es una decisión de quien administra el dominio, no de
esta API. Se emite también en desarrollo porque el header sólo tiene efecto sobre
HTTPS y así dev y prod no divergen.

**5. `allowedHeaders`: no faltaba nada.** Revisó `frontend/src/api/*`: el cliente
sólo manda `Authorization` y `Content-Type`. No agregó nada "por las dudas".

**6. Reparto con nginx:** *nginx es dueño de las cabeceras del documento HTML de
la SPA; la app es dueña de las de sus propias respuestas JSON.*

#### Correcciones manuales

- **Ninguna sobre el código entregado.** Se revisó el diff y se reejecutó la
  verificación completa de forma independiente.

#### Verificación (DoD)

**23 tests e2e** (`npx jest --config ./test/jest-e2e.json --testPathPatterns security-headers`):

| Chequeo | Resultado |
|---|---|
| `Origin: https://evil.com` en GET | **sin** `Access-Control-Allow-Origin` |
| `Origin: https://evil.com` en preflight | sin el header |
| Origen permitido | con `credentials`, y **nunca** `*` |
| Toda respuesta | trae `Content-Security-Policy` y `Strict-Transport-Security` |
| Respuestas 404 | también los traen |
| La excepción de Swagger | no se filtra a la API |

Reejecutado por fuera del agente: `tsc` OK · `build` OK · `npx jest` **44/44** ·
e2e **64/64** (41 previos + 23 nuevos).

- [x] curl con `Origin: https://evil.com` recibe respuesta sin `Access-Control-Allow-Origin`.
- [x] Los headers incluyen `Content-Security-Policy` y `Strict-Transport-Security`.

#### Notas / aprendizajes

- El DoD de CORS **ya se cumplía** antes del cambio (el paquete `cors` con `origin`
  como array simplemente no emite el header para un origen no permitido). Lo que
  faltaba era evidencia ejecutable — y el valor real de la tarea terminó estando en
  los dos agujeros de parsing que aparecieron al escribirla.
- Pedirle al agente que **verificara** el punto (a) en vez de implementarlo evitó
  duplicar el guardrail de T04 y, de paso, destapó el caso `CORS_ORIGINS=` vacía.

#### Hallazgos fuera de alcance reportados por el agente

1. **⚠️ El nginx estampa el CSP de la SPA también sobre `/api/`.** Los `add_header`
   están en el bloque `http` y ningún `location` define los suyos, así que se
   heredan en el proxy de la API. Y `add_header` **no pisa** la cabecera del
   backend: la **agrega**. Las respuestas de la API van a salir con **dos**
   `Content-Security-Policy`. Por spec el navegador aplica la intersección, así que
   el resultado es más restrictivo y no inseguro, pero vuelve confuso el debug.
   **Recomendación (no aplicada):** mover los `add_header` del bloque `http` al
   `location /` del frontend y dejar `location /api/` sin cabeceras propias.
2. `config/index.ts:11` sigue haciendo el `split(',')` sin trim. Se normaliza en el
   borde de consumo, pero si mañana otro módulo lee `app.corsOrigins`, vuelve el bug.
3. **`CORS_ORIGINS` acepta orígenes `http://` en producción.** El guardrail de Zod
   sólo mira `localhost`; un `http://juegosevita.formosa.gob.ar` pasaría y anularía
   buena parte del beneficio de HSTS. Son dos líneas en `config.validation.ts`, pero
   es territorio de T04.
4. `X-XSS-Protection: 1; mode=block` en nginx está deprecado y tiene vectores
   conocidos; helmet 8 ya lo emite como `0` del lado de la app.

---

### T22 (post-auditoría DevSecOps) — Un solo `/dashboard/stats` en lugar de 8 queries (Q3)

> Corresponde a `tasks.md → Fase 5 → T22`. **Primera tarea full-stack ejecutada con
> los dos agentes coordinados**: 🏗️ Backend Architect definió el contrato y
> ⚛️ Frontend Engineer lo consumió.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro · implementación por 🏗️ **Backend Architect** + ⚛️ **Frontend Engineer**
- **Hallazgo cubierto:** Q3 (el Dashboard dispara 8 requests para 8 números)
- **Duración estimada / real:** 2h / ~1,25h

#### Relevamiento previo (antes de delegar)

Sorpresa útil: **el endpoint ya existía**. `src/modules/dashboard/` tenía
`GET /dashboard/stats` con cache Redis y degradación elegante. Pero:

1. **El frontend nunca lo consumía**: `DashboardPage` seguía con sus 8 `useQuery`.
2. **El payload no alcanzaba** para reemplazarlos: faltaban las inscripciones por
   estado (4 de los 8 requests, uno por estado, cada uno pidiendo `limit: 1` sólo
   para leer `meta.total`) y las 5 inscripciones recientes.
3. El TTL era de 300s; `tasks.md` pide 60s.

Ese diagnóstico se le pasó al agente de backend para que extendiera lo existente
en vez de crear un endpoint nuevo.

#### Prompts utilizados

**Al agente 🏗️ Backend Architect** (resumen):

> Te toca la mitad backend de T22. **El módulo ya existe**; lo que falta es
> `inscriptionsByStatus` (resolvelo con `groupBy(['status'])`, hoy son 4 queries) y
> `recentInscriptions`. Bajá el TTL de 300 a 60s.
>
> Mantené el `Promise.all`. Usá los selects compartidos de T21. **Asegurate de que
> los 4 estados aparezcan aunque tengan 0**: `groupBy` no devuelve filas para los
> estados sin registros, y si el frontend tiene que adivinar cuáles faltan, le
> trasladamos el problema. Confirmá que no haya filtrado por rol o delegación antes
> de cachear a ciegas con una sola clave. Documentá el contrato en Swagger.

**Al agente ⚛️ Frontend Engineer** (resumen), ya con el contrato cerrado:

> Te toca la mitad frontend. El contrato ya está implementado y verificado: [JSON
> completo + garantías]. **No lo cambies.**
>
> Convenciones que tenés que respetar: `staleTime` por dominio (T19), `queryKey`
> namespaceado con `useQueryScope()` (T13), nada de `console.error` (T08).
> **No rompas la UI**: 4 tarjetas, donut por estado, "Acción Requerida" y las 5
> recientes con link al detalle. Sacá los imports muertos pero no borres los hooks,
> que los usan otras pantallas.

#### Código generado

**Backend**
- `src/modules/dashboard/dashboard.service.ts` — `inscriptionsByStatus` y
  `recentInscriptions` dentro del mismo `Promise.all` (7 consultas en paralelo),
  TTL 60s, cache extraída a `leerCache`/`escribirCache`.
- `src/modules/dashboard/dto/dashboard-stats.dto.ts` *(nuevo)* + barrel.
- `src/modules/dashboard/dashboard.controller.ts` — `@ApiOkResponse` con el DTO.
- `src/common/prisma-selects.ts` — nuevos `PARTICIPANT_NAME` y `CATEGORY_NAME`.
- `backend/test/dashboard-stats.e2e-spec.ts` *(nuevo)* — 16 tests.

**Frontend**
- `src/hooks/useDashboardStats.ts` *(nuevo)* — `DASHBOARD_KEYS` namespaceada +
  el hook.
- `src/types/index.ts` — `DashboardStats` al día, más `DashboardStatusCount` y
  `DashboardRecentInscription`.
- `src/pages/admin/DashboardPage.tsx` — de 8 `useQuery` a 1.

#### Decisiones de los agentes (y por qué)

**BE — `PARTICIPANT_NAME` en vez de reutilizar `PARTICIPANT_SUMMARY`.** El
compartido incluye DNI por diseño (las tablas admin buscan por ahí), y un widget
de resumen no tiene por qué pasearlo. Agregó `PARTICIPANT_NAME` al archivo
compartido y redefinió `PARTICIPANT_SUMMARY` sobre él, así mantiene la disciplina
de T21 —una sola definición por proyección— sin llevar el DNI al dashboard. Mismo
criterio con `CATEGORY_NAME`, porque `CATEGORY_WITH_DISCIPLINE` arrastraría el
reglamento de la disciplina.

**BE — confirmó que la cache global es correcta.** Revisó `inscriptions.service` y
`participants.service`: **ningún** service filtra por `department`/`zone`, aunque
el modelo `User` tenga esos campos para roles zonales. Un `ADMIN_ZONAL` ve hoy los
mismos números que un `SUPER_ADMIN`, así que una única clave no filtra nada entre
usuarios. Dejó documentado que si algún día se implementa el recorte zonal, la
clave tiene que incluir el scope o **el primero que abra el dashboard le deja su
vista cacheada a todos**.

**BE — test de paralelismo.** Traba las consultas detrás de una compuerta y
verifica que todas arrancaron antes de que ninguna resuelva: si alguien convierte
el `Promise.all` en `await` secuenciales, el test **falla** en vez de simplemente
ponerse lento.

**FE — `STALE_TIME.OPERATIONAL` (2 min).** El backend ya sirve desde Redis con
hasta 60s de atraso: pedirlo más seguido no devuelve números más frescos, sólo más
tráfico contra la misma entrada de cache.

**FE — tipo propio `DashboardRecentInscription` en vez de reutilizar `Inscription`.**
El endpoint expone una superficie mínima a propósito; tiparlo como `Inscription`
sugeriría que el DNI y el contacto están disponibles cuando llegan `undefined`.
Efecto colateral bienvenido: `participant` y `category` pasan a ser obligatorios y
desaparecen los `?.` de la lista.

**FE — el error se muestra como `EmptyState`, no como toast.** React Query v5
sacó `onError` de `useQuery` (sólo existe en mutaciones), así que el fallo se
renderiza en la misma rama donde antes vivía el spinner.

#### Correcciones manuales

- **Ninguna sobre el código entregado por ninguno de los dos agentes.** Se revisó
  el diff y se reejecutó toda la verificación de forma independiente.
- El agente de frontend notó que el working tree tenía los cambios del backend sin
  commitear: es esperado, ambas mitades van en el mismo commit.

#### Verificación (DoD)

**Backend: 16 tests e2e** (`--testPathPatterns dashboard-stats`) — los 4 estados
con `groupBy` incompleto, vacío y desordenado; **un solo `groupBy`** en lugar de 4
`count` filtrados; segunda llamada servida del cache sin tocar la base;
`setex('dashboard:stats', 60, …)`; funcionamiento con Redis caído y con fallas de
lectura/escritura; y `recentInscriptions` sin DNI, email, teléfono, dirección,
`notes` ni `rejectionNote` —chequeado por campo **y** buscando los valores en el
JSON crudo—.

**Frontend: cadena mecánica verificada por grep** — `DashboardPage` importa **un
solo** hook de datos (`useDashboardStats`); ese hook tiene **un** `useQuery`; y
`dashboard.api.ts` hace **una** llamada (`GET /dashboard/stats`). De 8 `useQuery`
sobre 4 dominios a 1.

- [x] Cargar el Dashboard genera **1 request** (contra 8+).
- [ ] **Tiempo total <200ms: no medido.** Requiere base de datos y Docker está
  apagado. Queda como verificación de aceptación.
- [x] `tsc` y `build` limpios en ambos lados · `npx jest` **44/44** · e2e
  **80/80** (64 previos + 16 nuevos) · lint del frontend sin errores nuevos.

#### Notas / aprendizajes

- El relevamiento previo cambió la tarea: sin él, el agente habría creado un
  endpoint nuevo al lado de uno que ya existía y funcionaba.
- La garantía de "los 4 estados siempre presentes" es el tipo de detalle que
  decide quién carga con la complejidad. `groupBy` omite los estados sin filas; si
  el backend no completa los ceros, cada consumidor tiene que acordarse de hacerlo.
- Los dos agentes en secuencia funcionaron bien porque el contrato quedó cerrado y
  verificado **antes** de arrancar el frontend. Pasarle el JSON de ejemplo con sus
  garantías explícitas evitó ida y vuelta.

#### Hallazgos fuera de alcance reportados por los agentes

1. **`demographics` es código muerto end-to-end:** existe en el endpoint, en
   `dashboard.api.ts` y en el tipo, pero ningún componente lo lee. Se mantuvo
   —es una consulta barata y sacarlo sería un breaking change del tipo publicado—
   pero es candidato a limpieza.
2. **El cliente Redis se crea dentro de `DashboardService`.** Otros módulos
   (reports, calendar) probablemente quieran cache; un `RedisModule` global con un
   solo cliente sería lo correcto, pero excede T22.
3. **El TTL está hardcodeado**, no leído del `ConfigService`.
4. **El chunk `DashboardPage` pesa 322 KB (95 KB gzip)**, dominado por recharts: es
   el chunk admin más grande por lejos. Candidato a `React.lazy()` sobre el donut.
5. `DONUT_COLORS` duplica en hex tokens de Tailwind: si cambia la paleta, el donut
   queda desincronizado en silencio.
6. `lastUpdated` llega pero no se muestra; con hasta 60s de atraso, exhibirlo sería
   razonable.

---

### T23 (post-auditoría DevSecOps) — Streaming y paginación en los reportes Excel/CSV (Q5, Q23)

> Corresponde a `tasks.md → Fase 5 → T23`. Implementada por el agente
> 🏗️ **Backend Architect**, con **una ronda de devolución** por un test flaky.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro · implementación por el agente 🏗️ **Backend Architect**
- **Hallazgos cubiertos:** Q5, Q23 (workbook completo en memoria, riesgo de OOM)
- **Duración estimada / real:** 2h / ~1,5h (incluye la ronda de corrección)

#### Prompt utilizado

Resumen de lo sustantivo del prompt inicial:

> Te toca **T23**. `reports.service.ts` construye todo el workbook en memoria.
> DoD: 20K filas manteniendo RSS <300MB.
>
> **Decisiones que te toca tomar:** cursor vs OFFSET (justificá); si conviene
> `stream.xlsx.WorkbookWriter` en vez de `workbook.xlsx.write(res)`, considerando
> que hay estilos que quizás no sobrevivan; el CSV hoy arma un string completo;
> **qué pasa si la base falla en el lote 15**, cuando ya mandaste headers y no
> podés devolver un 500; y verificá que el `compression()` global de T18 no rompa
> el streaming.
>
> **El DoD se puede verificar sin base real:** mockeá 20.000 filas en lotes, generá
> contra un `Writable` que descarte, y medí. Lo que importa es demostrar que la
> memoria **no crece proporcionalmente al total de filas**.
>
> **El contrato HTTP no cambia**: mismos endpoints, headers y BOM.

#### Código generado

- `src/modules/reports/reports.service.ts` — reescrito: paginación por lotes +
  escritura en streaming. La API interna pasa de `generateXxxCsv/Excel()` a
  `especificacionXxx()` (hoja, headers, generador de lotes) +
  `escribirCsv(destino, espec)` / `escribirExcel(destino, espec)`.
- `src/modules/reports/reports.controller.ts` — un helper `enviar()` que fija
  headers y delega el streaming.
- `backend/test/reports-streaming.e2e-spec.ts` *(nuevo)* — 18 tests.
- `backend/test/reports-memoria-manual.js` *(nuevo)* — medición de RSS fuera de
  Jest, un proceso por caso, con la implementación vieja como testigo.

#### Decisiones del agente (y por qué)

**1. Cursor, con una excepción justificada.** `OFFSET n` obliga a Postgres a
generar y descartar n filas por página: recorrer 20K en lotes de 1000 descarta
~200.000 filas de más. Se usa cursor en participants, inscriptions y teams. Todos
los `orderBy` terminan en `{ id: 'asc' }` para que el orden sea **total**: sin ese
desempate, dos participantes con mismo apellido y nombre pueden **duplicarse en un
lote y faltar en otro**. `results` queda con OFFSET porque ordena por
`competition.name` —una columna de otra tabla— y Prisma no soporta cursor con
`orderBy` sobre relaciones; es además el caso donde no duele, porque `Match` tiene
órdenes de magnitud menos filas.

**2. `stream.xlsx.WorkbookWriter`, no `workbook.xlsx.write(res)`.** Lo que pedía la
tarea elimina sólo una copia —el Buffer serializado— pero el `Workbook` común
mantiene vivo todo el árbol de celdas hasta el final, que es la parte cara. El
trade-off real: el auto-ajuste de ancho de columna miraba todas las filas; se
resolvió calculando los anchos con el primer lote y seteándolos **antes** de la
primera fila, porque ExcelJS emite el bloque `<cols>` recién ahí.
`useSharedStrings: false` a propósito: la tabla de strings compartidas achica el
archivo pero obliga a acumular todos los textos distintos.

**3. Error a mitad del stream, con regla explícita.** Si falla **antes del primer
byte** se relanza y Nest devuelve un 500 con JSON normal —para eso, tanto el CSV
como el Excel piden el primer lote **antes** de escribir el encabezado—. Si falla
con la respuesta ya iniciada, se loguea y se **destruye el socket**: cerrar
prolijamente dejaría un padrón truncado que abre bien y no avisa nada, que es peor
que ningún padrón.

**4. Un bug real de convivencia con `compression` (T18).** `compression` parchea
`res.write` y `res.on` pero **no** `res.removeListener`. La primera versión
manejaba el *drain* a mano y dejaba un listener colgado por lote: a los 10 saltaba
`MaxListenersExceededWarning`, con fuga proporcional a los lotes. Se resolvió con
`Readable.from(generador)` + `pipeline`, que registra un único `on('drain')`.
Beneficio extra: si el cliente corta la descarga, `pipeline` destruye el Readable y
**la paginación se frena sola** en vez de seguir consultando la base.

#### Correcciones manuales — la ronda de devolución

**Se le devolvió la tarea por un test flaky.** Al reejecutar la verificación, el
test *"multiplicar por 10 las filas no multiplica la memoria"* falló **1 de cada 8
corridas**. Diagnóstico: `deltaHeap` medido dentro de Jest osciló entre **11,7 MB
y 64 MB** para el mismo caso, porque `global.gc?.()` es un no-op salvo que Jest
corra con `--expose-gc`. Medía *cuándo corrió el GC*, no cuánta memoria vive a la
vez.

La devolución fue explícita en un punto: **no subir el umbral hasta que deje de
fallar**, porque eso deja el test verde pero sin poder de detección — con un
umbral suficientemente alto también pasaría una implementación que bufferiza todo.

El agente sacó la medición de heap de Jest y la reemplazó por **invariantes
estructurales deterministas**, que cuentan bytes entregados en vez de páginas de
memoria:

| Invariante | Medición |
|---|---|
| Al pedir la última página ya se entregó casi todo el archivo | **100,0%** (3222KB de 3222KB) |
| El envío arranca antes de la segunda página, y crece monotónicamente | ✅ |
| El workbook no acumula filas (`_rows.length` en cada consulta) | máximo **0** filas sin commitear |
| La paginación no se adelanta al envío (con backpressure real) | máximo **1** lote |

Y —sin que se lo pidieran— **verificó que los tests detecten, no sólo que pasen**,
corriendo tres mutantes sobre el service:

| Mutante | ¿Detectado? |
|---|---|
| Sacar `row.commit()` del bucle xlsx | **sí** (20.000 filas sin commitear) |
| Juntar todas las páginas antes de escribir (= la implementación pre-T23) | **sí**, 3 de 4 tests |
| `Readable.from` sin acotar (objectMode) | **no** — ver abajo |

**Corrigió además dos afirmaciones propias**, que es lo que más valor tiene de la
ronda:
1. Su primer test decía que "el zip se va emitiendo durante la paginación".
   Sondeó los números: durante las 21 consultas salen **49 bytes**; el resto viaja
   en `workbook.commit()`. No invalida el DoD, pero cambia la explicación: lo que
   se ahorra al streamear el xlsx **no son los bytes comprimidos** (0,9 MB es
   calderilla) sino el **árbol de celdas**. Reemplazó el test por el de `_rows`.
2. Cambió `Readable.from` a `{ objectMode: false, highWaterMark: 64KB }` creyendo
   que evitaba bufferear 16 lotes; comprobó que `pipeline` usa `.pipe()`, que pausa
   la fuente apenas el destino devuelve `false`, así que **no era observable**.
   Mantuvo el cambio por semántica correcta, pero **corrigió el comentario para que
   diga lo que verificó y no lo que suponía**.

#### Verificación (DoD)

**Medición reejecutada de forma independiente** (`node test/reports-memoria-manual.js 20000`),
un proceso por caso, con la implementación anterior como testigo:

| Caso | Salida | RSS pico | ΔRSS |
|---|---|---|---|
| **NUEVA xlsx (streaming)** | 0.9 MB | **162 MB** | 86 MB |
| VIEJA xlsx (en memoria) | 0.8 MB | **595 MB** | 519 MB |
| NUEVA csv (streaming) | 3.1 MB | 97 MB | 20 MB |
| VIEJA csv (en memoria) | 3.1 MB | 140 MB | 63 MB |

Escalando (medición del agente): el Δheap de la nueva **se aplana** —44 → 52 → 55 MB
para 20k/50k/100k filas— mientras la vieja crece lineal (397 → 999 MB → no termina).
Lo que demuestra el DoD no es el número puntual sino que **lo vivo a la vez lo fija
el lote de 1000, no el total**.

- [x] Un reporte de 20K filas mantiene el RSS <300MB: **162 MB**, contra los
  **595 MB** de la implementación anterior, que **no** cumplía el DoD.
- [x] **10 corridas seguidas** de la suite de reportes, reejecutadas por fuera del
  agente: **18/18 en las 10**, con el número medido byte a byte idéntico.
- [x] Suite completa: `npx jest` 44/44 · e2e **98 tests en 10 suites**, todas verdes.
  (La única suite roja es `app.e2e-spec.ts`, el boilerplate de Nest previo a estas
  tareas.)
- [x] El contrato HTTP no cambió: mismos endpoints, `Content-Type`,
  `Content-Disposition` y BOM. Hay un test que compara el CSV **carácter por
  carácter**.

#### Notas / aprendizajes

- **Un test que falla al azar es peor que no tener el test**: rompe CI de forma
  intermitente y erosiona la confianza en toda la suite. Vale la ronda extra.
- La instrucción que hizo la diferencia en la devolución fue prohibir explícitamente
  la salida fácil (subir el umbral). El resultado no sólo dejó de ser flaky: pasó a
  medir el mecanismo real —bytes entregados, filas sin commitear— en vez de un
  proxy ruidoso.
- **Verificar que un test detecte su regresión** (correr mutantes) es la diferencia
  entre un test verde y un test útil. El propio agente descubrió así que uno de sus
  tests no detectaba nada.

#### Hallazgos fuera de alcance reportados por el agente

1. **Los cuatro reportes usan `include` en vez de `select`**: traen todas las
   columnas de participant/team/category, incluidas las que no van al archivo.
   Reducirlo bajaría el peso de cada lote; es criterio de T21.
2. **`getInscriptionsData` arma el `where` con `any`** y `status` entra como string
   sin validar contra el enum.
3. **No hay límite de filas ni timeout en los reportes.** Un `DELEGADO` puede pedir
   el padrón entero sin filtros: ahora no tumba el proceso, pero ocupa una conexión
   de Postgres y CPU por varios segundos. Un `@Throttle` específico sería razonable.
4. **`Match` no tiene índice que cubra `[competitionId, matchNumber]`** (sí
   `[competitionId, round]`); con el OFFSET del reporte de resultados, si esa tabla
   crece convendría revisarlo.
5. El .xlsx nuevo pesa ~12% más (0,9 vs 0,8 MB) por `useSharedStrings: false`: es el
   precio consciente de no acumular la tabla de strings.

---

### T24 (post-auditoría DevSecOps) — DRY backend: validadores y DTOs (Q13, Q15)

> Corresponde a `tasks.md → Fase 5 → T24`. Implementada por el agente
> 🏗️ **Backend Architect**, que **declinó dos de las tres abstracciones** que
> pedía el enunciado, con argumento.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro · implementación por el agente 🏗️ **Backend Architect**
- **Hallazgos cubiertos:** Q13, Q15 (validadores y DTOs duplicados)
- **Duración estimada / real:** 1h / ~0,5h

#### Relevamiento previo (antes de delegar)

La tarea resultó **más chica de lo que sugiere el enunciado**:

| Viñeta | Estado encontrado |
|---|---|
| Regex de DNI duplicado | Exactamente **2 lugares** (inscriptions y participants), los dos únicos `@Matches` de todo `src/modules/` |
| `UpdateXxxDto` con `PartialType` | **9 de 10 ya lo usaban**; el único que no es `UpdateResultDto` |
| Consolidar `include`/`select` | **Ya hecho en T21** y ampliado en T22 |

#### Prompt utilizado

Resumen de lo sustantivo:

> Te toca **T24**. [Relevamiento completo de arriba.]
>
> **Lo que quiero que resuelvas con criterio:** no inventes abstracción donde no
> hay repetición. La tarea nombra `@IsDni()` y `@IsPhone()`, pero con 2 usos de DNI
> decidí vos si se justifican. **Mi criterio:** el valor de `@IsDni()` no está sólo
> en evitar repetir un regex, está en que la regla de qué es un DNI válido **viva
> en un solo lugar** y no derive entre módulos. Si pensás distinto para `@IsPhone()`,
> argumentalo.
>
> **Mirá bien `UpdateResultDto` antes de tocarlo.** Si convertirlo a `PartialType`
> no es correcto, **no lo fuerces**: la tarea dice "verificar que usen `PartialType`",
> no "convertir todo a la fuerza".
>
> **Cuidado con T15** (pendiente, frontend): endurece los schemas Zod incluyendo
> rechazar DNIs de dígitos repetidos. Si el decorador puede alojar esa regla, es el
> lugar correcto —el cliente valida por UX, el servidor por seguridad— pero **no la
> implementes ahora**: dejá el decorador preparado y anotámelo.
>
> **Los mensajes de error son visibles para el usuario final.** No los cambies salvo
> que mejores la claridad, porque el frontend podría mostrarlos.

#### Código generado

- `src/common/validators/dni.validator.ts` *(nuevo)* — `@IsDni()` y `DNI_REGEX`.
- `src/common/validators/dni.validator.spec.ts` *(nuevo)* — 34 tests.
- `src/common/validators/index.ts` *(nuevo)* + export desde `src/common/index.ts`.
- `src/modules/inscriptions/dto/inscriptions.dto.ts` y
  `src/modules/participants/dto/participants.dto.ts` — usan `@IsDni()`.

Neto: **−8/+5 líneas** en los DTOs.

#### Decisiones del agente (y por qué)

**1. `@IsDni()` envuelve tres constraints, no dos.** La tarea pedía `@Matches` +
`@IsString`; el agente sumó `@IsNotEmpty`. Razón: si el `@IsNotEmpty` quedaba en el
call site, un `dni: ''` pasaría de devolver **dos** mensajes de error a devolver
**uno**, y como el frontend puede estar mostrando cualquiera de los dos, eso es un
cambio observable. Envolver las tres preserva el conjunto exacto de constraints, y
de paso deja de duplicarse también el string `'El DNI es obligatorio'`.

Verificó además que no rompe los `UpdateXxxDto`: `PartialType()` inyecta
`@IsOptional()` sobre cada propiedad heredada, así que un update sin `dni` sigue
siendo válido. Hay dos tests que lo fijan.

**2. `@IsPhone()` — NO lo hizo, y el argumento es correcto.** *"Hoy no hay ninguna
regla de teléfono"*: los dos usos son `@IsOptional() @IsString()`, sin regex. No
hay nada que centralizar, así que el decorador sería un alias de vocabulario con
cero contenido. Y peor: **sería una trampa**, porque el próximo que lo vea va a
asumir que valida algo y le va a meter un regex adentro, endureciendo en silencio
dos endpoints —incluido el público de inscripción por QR— y rechazando teléfonos
que hoy entran. Cuando T15 defina *cuál* es la regla, ahí el decorador tiene
contenido y se crea con un cambio de comportamiento consciente y testeado.

**3. Email — tampoco.** Los 4 usos son `@IsEmail(...)`: la regla ya vive en un solo
lugar (class-validator); lo único repetido es el **string del mensaje**. Envolver
un decorador built-in para deduplicar un mensaje es desproporcionado; si molesta la
deriva, la solución del tamaño correcto es una constante de mensaje.

**4. `UpdateResultDto` se queda como está, y por la razón correcta.** **No existe
`CreateResultDto` y no debería existir**: los `Result` no los crea nadie por API,
los crea el motor de competencia en `engine.factory.ts:91` con un `createMany()` al
generar el fixture. Convertirlo exigiría **inventar** un `CreateResultDto` que
ningún endpoint consume, sólo para que el update tenga de quién heredar — y que
además mentiría en Swagger sugiriendo una operación de creación que la API no
expone. Verificado: **9 de 10 usan `PartialType` correctamente, y el décimo no lo
usa por el motivo correcto.**

#### Correcciones manuales

- **Ninguna.** Se revisó el diff y se reejecutó la verificación de forma
  independiente.

#### Verificación (DoD)

```
grep -rn 'Matches(/^\d{7,8}$' src/modules/   → 0 resultados ✔
grep -rn '@Matches' src/modules/             → ninguno ✔
```

- [x] El grep del DoD retorna 0 resultados: todo usa `@IsDni()`.
- [x] **El comportamiento de validación no cambió.** El spec incluye una clase de
  control `LegacyInline` que replica los decoradores inline previos a T24, y un
  bloque de equivalencia que compara **mensaje por mensaje** sobre 14 casos
  (aceptados y rechazados). Si alguien endurece el decorador sin querer, ese test
  falla. Los mensajes en español quedaron idénticos.
- [x] Reejecutado por fuera del agente: `tsc` OK · `build` OK · `npx jest`
  **78/78** (44 previos + 34 nuevos) · e2e **98/98**.

#### Notas / aprendizajes

- **El mejor resultado de esta tarea fue lo que no se hizo.** De las tres
  abstracciones que nombraba el enunciado, sólo una tenía contenido real. Pedirle
  al agente el criterio —"no inventes abstracción donde no hay repetición"— en
  lugar de la implementación literal evitó dos indirecciones vacías, una de las
  cuales era además una trampa a futuro.
- La distinción que hace el agente es la correcta: **`@IsDni()` no vale por
  deduplicar un regex, vale porque la definición de DNI válido deja de poder
  divergir entre módulos.** `@IsPhone()` no tendría esa propiedad porque no hay
  definición que proteger.

#### Anotaciones para T15 (pedidas explícitamente)

1. `DNI_REGEX` está exportado desde `dni.validator.ts` y es **el único lugar** donde
   vive el formato. El JSDoc de `@IsDni()` tiene un `@remarks` que apunta a T15 y
   explica el reparto: el cliente valida por UX, el servidor por seguridad.
2. **Hay un test que documenta el hueco a propósito:**
   `'todavía acepta dígitos repetidos (pendiente de T15)'`, que afirma que
   `00000000` y `11111111` **pasan**. Está escrito para invertirse cuando T15
   agregue la regla, así nadie endurece el backend sin notar que cambió el
   contrato, ni endurece sólo el frontend dejando el backend permisivo.
3. **Advertencia concreta:** el DTO público de inscripción por QR comparte este
   decorador. Si T15 agrega la regla de dígitos repetidos, aplica también al
   endpoint público —que es lo deseable— pero conviene chequear que no haya
   inscripciones ya cargadas con DNIs de prueba tipo `12345678`, porque un update
   posterior de ese participante empezaría a rebotar.
4. El **teléfono queda sin validación en el servidor**. Si T15 valida sólo en Zod,
   el backend va a seguir aceptando cualquier string: no es un agujero de seguridad
   (campo opcional de contacto), pero es divergencia cliente/servidor consciente.

#### Hallazgos fuera de alcance (viñeta 3, verificada)

- No quedó ningún `select` inline duplicado *verbatim*. Lo único repetido son
  agregados triviales (`_count: { select: { members: true } }`) donde una constante
  sería peor que la repetición.
- `results.service.ts:101` tiene inline **exactamente** `PARTICIPANT_NAME`: es el
  único reemplazo 1-a-1 que queda, pero es criterio de T21.
- Dos casi-duplicados que **no** conviene consolidar a ciegas:
  `audit.service.ts:92` usa `USER_SUMMARY` **+ email**, y `documents.service.ts:124`
  usa `PARTICIPANT_SUMMARY` **− id**. Reemplazar el segundo por la constante
  **agregaría `id` al payload** — cambio de comportamiento, no cosmético.

---

### T25 (post-auditoría DevSecOps) — Consolidar el contrato de auditoría (Q10)

> Corresponde a `tasks.md → Fase 5 → T25`. **Cierra el Bloque 3.** Implementada
> por el agente 🏗️ **Backend Architect**, que **refutó la premisa del DoD** y
> encontró que era imposible de cumplir como estaba escrito.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro · implementación por el agente 🏗️ **Backend Architect**
- **Hallazgo cubierto:** Q10 (interceptor vs llamadas manuales)
- **Duración estimada / real:** 1h / ~1,25h

#### Relevamiento previo (antes de delegar)

Se buscaron todas las llamadas a auditoría y **la premisa del hallazgo no se
sostenía**: el interceptor excluía `/auth/` explícitamente y `AuthService` era el
único que auditaba a mano, así que las dos vías eran **disjuntas por
construcción**. No había doble registro. Eso se le pasó al agente pidiéndole que
lo verificara y, si lo confirmaba, lo dijera con todas las letras en vez de
cerrar un DoD trivial.

#### Prompt utilizado

Resumen de lo sustantivo:

> Te toca **T25**. [Relevamiento completo.] **Verificalo vos primero.** Si
> confirmás que no hay duplicación, decilo con todas las letras: cerrar el DoD
> literal sería trivial y engañoso, y el valor está en otro lado.
>
> **Dónde está el valor real:** (1) la duplicación de *código* entre
> `AuthService.logAuditAction` y `AuditService.log` —el `TODO(T25)` que pusiste vos
> en T07—; (2) **`sanitizeBody` es superficial**, el hallazgo más serio: mete PII y
> credenciales anidadas en una tabla de larga retención, y después de T01 y T21 es
> incoherente que la auditoría sea la puerta de atrás por donde entra todo lo que
> sacamos de las respuestas; (3) el **reuso de refresh token no se audita**, siendo
> la señal más fuerte de robo de sesión; (4) el contrato en sí.
>
> **Riesgo de diseño que quiero que resuelvas:** el enunciado pide que el
> interceptor cubra CRUD "vía decorador `@Audit(entity)`". Hoy audita todo
> (opt-out). Pasar a **opt-in** significa que todo lo que no decores **deja de
> auditarse en silencio**: una regresión de seguridad servida en bandeja. Elegí,
> justificá y documentá.

#### Código generado

- `src/common/decorators/audit.decorator.ts` *(nuevo)* — el contrato en JSDoc +
  `@Audit()` / `@NoAudit()`.
- `src/modules/audit/audit-sanitizer.ts` *(nuevo)* — saneamiento profundo.
- `src/modules/audit/audit.interceptor.ts` y `audit.service.ts` — refactorizados.
- `src/modules/auth/auth.service.ts` y `auth.controller.ts` — `logAuditAction`
  eliminado; eventos nuevos de refresh.
- `src/modules/inscriptions/inscriptions.controller.ts` — `@Audit({ action })` en
  review/approve/reject.
- `backend/test/audit-contract.e2e-spec.ts` *(nuevo)* — 14 tests.

#### Hallazgo principal: el DoD era imposible de cumplir

El agente confirmó que **no hay ni hubo doble registro**, y encontró algo que
nadie había visto: en un `POST` la URL todavía no tiene id, así que `parseUrl()`
devolvía **`entityId: null` para todo CREATE**. El
`SELECT COUNT(*) WHERE entityId = 'X'` del DoD no devolvía 2: **devolvía 0**. No
se podía rastrear ninguna entidad recién creada por su id.

Lo arregló tomando el `entityId` del `id` de la respuesta del controller — el
interceptor corre por dentro del `TransformInterceptor`, así que ve el objeto
crudo. El test del DoD quedó escrito y ejecutable, pero como **red contra
regresiones**, no como prueba de un arreglo que no hacía falta.

#### Decisiones del agente (y por qué)

**1. Se quedó en opt-out; `@Audit()` sólo refina.** El razonamiento, que quedó en
el JSDoc: los dos esquemas fallan igual de seguido —alguien se olvida del
decorador— pero **fallan distinto**. Con *opt-in* el endpoint queda sin auditar
**y en silencio**: nadie mira una tabla buscando filas que no están, y se descubre
recién cuando hay un incidente y no hay rastro. Con *opt-out* queda auditado con
una entidad quizás imprecisa: el defecto es **ruido, no ceguera**. Entre perder
evidencia y guardarla mal etiquetada, esta base elige lo segundo.

Sumó además una red: un test que reflexiona sobre `PATH_METADATA`/`METHOD_METADATA`
de los controllers reales y **falla si alguna ruta de escritura derivara una
entidad inservible o apareciera un `@NoAudit()` no discutido**.

**2. Los eventos de negocio salen por la misma vía.** `PATCH /inscriptions/:id/approve`
se registraba como `UPDATE` genérico; ahora lleva
`@Audit({ action: AuditAction.APPROVE_INSCRIPTION })`. Es **lo contrario** de
agregar un `auditService.log()` manual en el service, que habría creado justamente
la duplicación que T25 previene. La regla quedó dura en el contrato: *un service
nunca llama a `log()` para un CREATE/UPDATE/DELETE*.

**3. El saneamiento se movió al `AuditService.log()`**, punto de entrada único de
la tabla: las dos vías quedan saneadas **por construcción, no por disciplina**.
Con dos tratamientos distintos a propósito:
- **Secretos → `[REDACTED]`**, con match por fragmento (`password`, `token`,
  `secret`, `apikey`, `authorization`, …). Deliberadamente agresivo: mejor redactar
  un `tokenCount` inocente que dejar pasar un `csrfToken`.
- **PII → enmascarada, no borrada.** `ana.gomez@dominio` → `a***@dominio`,
  `40123456` → `******56`. Borrarla dejaba la auditoría inútil: **sin poder
  distinguir un `LOGIN_FAILED` contra una cuenta de otro contra mil cuentas, la
  tabla no sirve para detectar credential stuffing.** `address`, `birthDate` y
  notas médicas sí se eliminan enteras: no aportan nada forense.

**4. Refresh token.** `refreshTokens()` emite dos eventos nuevos:
`REFRESH_TOKEN_REUSE` (el caso grave, auditado **después** de revocar la sesión
para que un fallo escribiendo la fila no impida cerrarla) y
`REFRESH_TOKEN_DENIED` con `reason` discriminado. Separados a propósito para que
un `WHERE action = 'REFRESH_TOKEN_REUSE'` no se llene de ruido benigno.

#### Cambios de forma declarados

- **El `changes` de `LOGIN_FAILED` pasa de `{ email: "ana@x" }` a
  `{ email: "a***@x" }`.** Ningún evento dejó de auditarse; cambió el contenido de
  una columna. Para cruzar por identidad exacta está `userId`, que sigue entero.
- **El refresh exitoso NO se audita.** Una fila cada 15 minutos por usuario inunda
  una tabla de retención larga sin agregar información: el inicio de sesión ya
  quedó en `LOGIN`. Hay un test que lo fija, así que revertirlo es cambiar una
  línea. **Queda a revisión del equipo.**

#### Correcciones manuales

- **Ninguna sobre el código entregado.** Se revisó el diff y se reejecutó la
  verificación de forma independiente.
- El agente reportó que `eslint --fix` le tocó de rebote 10 archivos ajenos (sólo
  formato) y que los revirtió con `git checkout --`. Verificado: el diff final son
  sólo los archivos de T25.

#### Verificación (DoD)

- [x] Crear una inscripción produce **exactamente una** fila para esa entidad
  (test ejecutable), y ahora además **con el `entityId` poblado**, que era el bug
  real detrás del DoD.
- [x] Ningún evento que se auditaba dejó de auditarse: `LOGIN`, `LOGIN_FAILED`,
  `LOGOUT` siguen, más `REFRESH_TOKEN_REUSE` y `REFRESH_TOKEN_DENIED` nuevos.
- [x] Reejecutado por fuera del agente: `tsc` OK · `build` OK · `npx jest`
  **78/78** · e2e **112/112** en 11 suites (98 previos + 14 nuevos).

#### Notas / aprendizajes

- **Pedirle al agente que refutara la premisa fue lo que dio valor a la tarea.**
  El hallazgo —`entityId: null` en todo CREATE— sólo aparece si alguien va a
  verificar si el DoD se puede cumplir, en vez de asumir que describe la realidad.
- El argumento opt-in/opt-out es transferible: **frente a dos formas de fallar,
  preferir la que se ve.** Ruido mal etiquetado es recuperable; ceguera silenciosa
  no.
- Detalle del test de reuso: no dispara un refresh real para rotar, porque el JWT
  se firma con `iat` en segundos y dentro del mismo segundo el token rotado sale
  **idéntico**. Se simula el estado resultante. Es un artefacto del reloj de JWT,
  no un bug.

#### Hallazgos fuera de alcance reportados por el agente

1. **Nombres de entidad inconsistentes:** el interceptor guarda el segmento de URL
   (`inscriptions`, plural minúscula) y `AuthService` guarda `'User'`. Normalizarlo
   cambiaría el significado de filas históricas y rompería los filtros del panel.
2. **`AuditAction` no se usa en el interceptor**: sigue devolviendo strings
   literales, así que el enum y el código pueden divergir.
3. **`POST /teams/:id/members` y su DELETE** registran `entity: 'teams'` y, en el
   DELETE, el `entityId` es el del **equipo**, no el del miembro. Es el caso exacto
   para `@Audit({ entity: 'team_members' })`, pero decorarlo cambia datos que hoy
   consume el panel.
4. **`AuditLog` no tiene política de retención ni purga.** Con el saneamiento ya no
   guarda credenciales, pero crece sin techo.
5. **No hay métrica ni alerta sobre "la auditoría dejó de escribir":** `log()` traga
   la excepción con un `logger.warn`. Correcto para no voltear la operación, pero es
   el punto ciego que queda.

---

### T15 (post-auditoría DevSecOps) — Fortalecer los schemas Zod (F10, F11, F12)

> Corresponde a `tasks.md → Fase 4 → T15`. Abre el Bloque 4. Implementada por el
> agente ⚛️ **Frontend Engineer**.

- **Fecha:** 2026-08-19
- **Responsable:** Ramiro · implementación por el agente ⚛️ **Frontend Engineer**
- **Hallazgos cubiertos:** F10, F11, F12 (validaciones cliente débiles)
- **Duración estimada / real:** 1h / ~1h

#### Prompt utilizado

Resumen de lo sustantivo:

> Te toca **T15**: `dni` con refine anti-dígitos-repetidos, `phone` con min/max y
> regex, `birthDate` con año entre 1920 y hoy−5, y auditar los **11 schemas** del
> archivo con el mismo criterio.
>
> **Coherencia con el backend:** en T24 se centralizó el DNI en `@IsDni()`, que
> **no** rechaza dígitos repetidos. Tu refine deja al frontend más estricto, y está
> bien —la validación cliente es UX, la autoridad es el backend— pero **decilo**.
> Lo que **no** puede pasar es lo contrario: que el frontend acepte algo que el
> backend rechace, porque eso genera un 400 confuso.
>
> **Criterio para la auditoría:** no agregues límites arbitrarios. Para cada campo
> mirá qué lo restringe de verdad —la columna de Prisma, el DTO del backend, el
> sentido del dominio—. **Si no hay un límite justificable, dejalo y decilo**: es
> mejor que inventar un `.max(255)` porque sí.
>
> **Cuidado con no romper la UI:** un refine mal puesto vuelve un formulario
> imposible de enviar. Revisá los consumidores y mirá cómo llega `birthDate` desde
> `<input type="date">`.

#### Código generado

- `frontend/src/schemas/index.ts` — único archivo tocado. Los 11 schemas revisados.

#### Decisiones del agente (y por qué)

**Un dato transversal que condicionó todo:** ninguna columna de texto de Prisma
declara largo (`String` en Postgres es `text`) y **ningún DTO del backend usa
`@MaxLength`**. Así que los máximos no salen del esquema ni del backend: salen del
dominio, y quedaron documentados uno por uno.

**Lo que pedía la tarea:**

| Campo | Regla | Origen |
|---|---|---|
| `dni` | regex + refine anti-dígitos-repetidos | regex idéntico al `DNI_REGEX` del backend; el refine es nuevo |
| `birthDate` | formato `YYYY-MM-DD`, fecha real de calendario, año ≥ 1920, ≤ hoy−5 años | formato = lo que entrega `<input type="date">` |
| `phone` | opcional; 8–20 chars + `^[\d+\s()-]+$` | el piso de 8 = código de área + número de Formosa |

**Lo que apareció al auditar el resto** (selección):

- `venue.latitude` / `.longitude` sin ninguna validación → acotadas a los rangos
  **reales** de una coordenada (−90/90, −180/180). No es criterio de dominio.
- `discipline.maxPlayers >= minPlayers` y `competition.endDate >= startDate`:
  lógica que faltaba. Antes `'2026-04-31'` pasaba como fecha válida.
- `calendarEvent`: `startTime`/`endTime` con regex `HH:MM`, y un refine para que
  tildar "tiene fecha de fin" **exija** la fecha — antes se mandaba `endDate: null`
  en silencio.
- `discipline.sortOrder` aceptaba negativos siendo un orden de visualización.

**Campos que decidió NO tocar, y por qué** (esto era parte del pedido): los UUID
—`.uuid()` ya es la restricción real—, los `nativeEnum` —el enum es el límite—,
`news.imageKey` —la genera el backend, un máximo inventado sólo agregaría un modo
de falla— y `rules`/`description`/`content`, que son `@db.Text` sin límite de
dominio justificable.

#### Divergencias frontend/backend detectadas

**Frontend más estricto (aceptable, es UX):** el refine de DNI y todos los máximos
de largo. **`00000000` sigue siendo aceptable vía API directa**: `@IsDni()` sólo
aplica `/^\d{7,8}$/`. Cerrarlo es una línea en el backend.

**Frontend más laxo que el backend — eran 400s reales, corregidos acá:**

1. `loginSchema.password` estaba en `min(6)` contra el `@MinLength(8)` del backend.
2. **`participant.email = ''`**: `@IsOptional()` de class-validator **sólo saltea
   `null`/`undefined`**, así que un string vacío llegaba a `@IsEmail()` y devolvía
   400 "Debe ser un email válido" con el campo visualmente vacío. Ahora todos los
   opcionales de texto normalizan `''` → `undefined`.
3. `venue.capacity` aceptaba decimales y negativos contra `@IsInt() @Min(0)`.

#### Correcciones manuales

- **Ninguna sobre el código entregado.** Se revisó el diff y se reejecutó la
  verificación.
- **Se verificó por fuera el hallazgo más grave que reportó el agente** (equipos,
  ver abajo): se leyeron `CreateTeamDto`, `teams.api.ts` y `teams.service.create`.
  Confirmado.

#### Verificación (DoD)

Script temporal que importaba los **11 schemas reales** (bundleados con esbuild) y
corría **78 aserciones**: `78 OK / 0 fallas`. Cubre los casos del enunciado
(`00000000`, nacimiento futuro, teléfono con letras, nombre de 5.000 caracteres) y
los refinamientos nuevos (fin antes del inicio, 31 de abril, hora `25:00`,
latitud 200, capacidad decimal).

- [x] Todos los schemas tienen constraints mínimas + máximas + refinamientos
  lógicos donde aplica, **o una razón escrita de por qué no**.
- [x] `tsc` limpio · `build` OK · `lint` sin hallazgos en `schemas`.

#### Bug latente arreglado de paso

Prisma devuelve **`null`** (no `undefined`) para columnas `String?`, y los
formularios hacen `form.reset({...initialData})`. Un participante **sin teléfono
cargado** hacía fallar la validación al editarlo con un `expected string, received
null`, **imposible de corregir desde la pantalla**. Los helpers de opcionales
ahora normalizan `null` → `''` → `undefined`. Entraba en alcance porque el riesgo
explícito de la tarea era no romper los formularios.

#### 🔴 Hallazgo grave fuera de alcance: el alta de equipos está rota

`teamSchema` y `CreateTeamPayload` (`src/api/teams.api.ts:19`) envían
**`disciplineId`**, pero `CreateTeamDto` **no lo declara** — el service lo deriva
de la categoría (`category.discipline`). Con `forbidNonWhitelisted: true` en
`main.ts:63`, **todo `POST /teams` y `PATCH /teams/:id` devuelve 400 "property
disciplineId should not exist"**.

Verificado leyendo los tres archivos: el DTO (líneas 14-42: `name`, `categoryId`,
`institution?`, `locality`, `department` — sin `disciplineId`), el payload del
frontend, y `teams.service.create`, que efectivamente infiere la disciplina.

Es **anterior a estas tareas** y no se tocó porque el arreglo va en `teams.api.ts`
(sacar el campo del payload) o en el DTO del backend, no en `schemas/index.ts`.
`disciplineId` se necesita **en el formulario** para filtrar categorías, así que no
alcanza con borrarlo del schema. **Requiere tarea propia y verificación con la app
levantada.**

#### Otros hallazgos fuera de alcance

1. **El wizard de inscripción pública no usa Zod.**
   `src/pages/public/inscription/StepPersonalData.tsx` valida con `required` de
   HTML y un `replace(/\D/g,'')`; nunca importa `participantSchema`. **Ninguna
   mejora de T15 aplica al flujo público**, que es el de mayor volumen y el que más
   400s genera. Migrarlo es un refactor de la página.
2. **`loginSchema` está muerto**: `LoginPage` usa `useState` y un
   `if (!email || !password)`. Se alineó igual a 8 caracteres para no dejar una
   trampa a quien lo conecte.
3. `categorySchema` no cubre `maxParticipants` ni `teamSize`, que sí existen en
   `CreateCategoryDto` pero no en el formulario.
4. Deprecaciones de Zod 4 en el archivo (`z.nativeEnum()`, `z.string().uuid()`):
   funcionan, migrarlas sería ruido de diff.

---

<!--
Repetir bloque de plantilla arriba por cada tarea T03..T34 completada.
Se recomienda mantener las tareas cerradas en orden cronológico ascendente.
-->

---

## 5. Conclusiones

> Al cierre del MVP (T34), completar esta sección con la mirada retrospectiva del equipo.

### 5.1 Lo que funcionó bien

*(pendiente)*

### 5.2 Lo que revisaríamos

*(pendiente — decisiones que en retrospectiva cambiaríamos)*

### 5.3 Deuda técnica asumida

*(pendiente — atajos tomados conscientemente, con propuesta de cuándo/cómo pagarla)*

### 5.4 Métricas finales del MVP

- Tareas completadas: _ / 34
- Tiempo total invertido: _ horas
- Correcciones manuales / cambios generados por IA: _ (%)
- Bugs detectados en QA vs. producción: _ / _

### 5.5 Recomendaciones para la V2

*(pendiente — priorización sugerida de lo que quedó Out of Scope)*
