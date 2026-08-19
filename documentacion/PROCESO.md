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
