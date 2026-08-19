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
