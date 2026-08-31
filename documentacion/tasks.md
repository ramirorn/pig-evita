# tasks.md — Correcciones de la tercera revisión

> **Producto:** Plataforma Integral de Gestión — Juegos Evita Formosa
> **Origen:** Revisión exhaustiva del 2026-08-25 sobre `git diff 7166b6c~1...HEAD`, ejecutada por el agente **Code Reviewer** en dos pases —backend y frontend— **contra el stack real corriendo**, más un barrido de dependencias.
> **Ciclo anterior:** las 31 tareas R01–R31 están cerradas, con su evidencia y sus desviaciones en `documentacion/tasks-R01-R31-cerradas.md`. Este archivo arranca con lo que quedó abierto **después** de aquel ciclo.
> **Metodología:** Tareas atómicas verticales, individualmente verificables. Registrar evidencia en `PROCESO.md` al cerrar.

**Convenciones:**
- `[ ]` pendiente · `[~]` en progreso · `[x]` completada
- **DoD** = Definition of Done (criterios de verificación)
- Severidad: 🔴 blocker · 🟡 alto · 🟠 medio · ✨ polish
- Los IDs usan el prefijo **S** (tercera ronda) para no colisionar con T01–T28 ni R01–R31.

**⚠️ Regla dura:** ninguna tarea 🔴 puede quedar abierta antes de exponer la app fuera de red local. **✅ Se cumple: los 6 blockers están cerrados.**

---

## 🔬 El patrón, que es el hallazgo más importante de esta revisión

Van tres rondas y las tres encontraron **la misma clase de bug, siempre en el módulo de al lado**:

| Clase | 1ª ronda | 2ª ronda | 3ª ronda (ahora) |
|---|---|---|---|
| Datos personales sin recortar | inscripciones (T01) | competencias (R01) | **dashboard, PATCH, alta de inscripción** |
| Orden de una colección sin garantizar | claves de JSON (`matchScore`) | filas de una relación (R23) | **exportación de resultados** |
| Escritura multi-paso sin transacción | — | alta de inscripción (R13) | **generación de fixture** |

**Ninguna tarea anterior falló**: cada una cerró exactamente lo que decía cerrar, y está verificado. Lo que falló es el **criterio de alcance**: se definió por archivo ("arreglar `competitions.service.ts`") en vez de por propiedad ("ningún endpoint devuelve datos de personas sin recortar").

Por eso este plan invierte el orden: **S01 es una red que detecta la clase entera**, y recién después vienen los tres arreglos puntuales que esa red va a marcar en rojo. Si se arreglan primero los tres y no se construye la red, la cuarta revisión va a encontrar el cuarto módulo.

---

## 🤝 Asignación de agentes

| Tag | Agente | Ámbito |
|---|---|---|
| **🏗️ BE** | `Backend Architect` | NestJS, Prisma, PostgreSQL, Redis, JWT, seguridad backend, migraciones |
| **⚛️ FE** | `Frontend Engineer` | React 19, TanStack Query, Router, Axios, Zod, TypeScript, hooks, bundle |
| **🎨 UI** | `UI Designer` | Componentes, tokens, accesibilidad WCAG |
| **🔀 FS** | BE **+** FE (coordinación) | Cambios que requieren API + cliente sincronizados |
| **👁️ CR** | `Code Reviewer` | **Valida** el DoD al cierre (no implementa) |

**Flujo:** el responsable implementa → registra evidencia en `PROCESO.md` → el Code Reviewer firma el cierre → se marca `[x]`.

**Regla de verificación, aprendida en las dos rondas anteriores:** un test que pasa con el bug puesto no prueba nada. **Cada tarea se cierra restaurando el código viejo y comprobando que sus tests fallan**, con el conteo anotado. Y los mocks tienen que modelar el estado real: uno que devuelve una constante hace pasar por igual al código nuevo y al viejo.

---

## Fase 1 — Blockers

### S01 🔴 🏗️ BE — Red que detecta la clase entera: ningún endpoint devuelve datos de personas sin recortar

- [x] **Descripción:** Construir un test que **descubra por reflexión** todos los handlers que devuelven `Participant`, `Team` o `Inscription` (directo o anidado) y verifique, para cada uno y para cada rol acotado, que el recorte territorial se aplica. Es el equivalente al barrido de `@Public()` que R01 dejó en `test/public-pii.e2e-spec.ts`, que funcionó: descubre los endpoints en vez de listarlos a mano, así que **un endpoint nuevo entra solo**.
- **Por qué va primero:** los tres blockers siguientes son instancias de esta clase. Sin la red, se arreglan los tres y la próxima revisión encuentra el cuarto.
- **Se espera que arranque en rojo** marcando al menos S02, S03 y S04. Ese rojo inicial **es el entregable**: demuestra que la red detecta lo que tiene que detectar. Anotar cuántos handlers marca antes de arreglar nada.
- **Archivos:** `backend/test/` (nuevo), apoyándose en `src/common/scope/`.
- **DoD:**
  - El test enumera los handlers por reflexión, no por lista escrita a mano, y falla si el barrido deja de encontrar handlers (red de seguridad contra un cambio que lo vuelva vacío).
  - Cubre las **tres vías**: listado, lectura por id y **respuesta de una escritura** — la tercera es la que se escapó en S04.
  - Para cada rol acotado, una fila fuera del alcance no aparece por ninguna de las tres vías.
  - Un handler nuevo sin recorte hace fallar el test sin tocar el test.

- **✅ Evidencia (2026-08-31):** `backend/test/scope-sweep.e2e-spec.ts`, **10 tests**, apoyado en un doble de Prisma nuevo (`test/mocks/prisma-territorial.ts`) que **evalúa el `where` de verdad** y modela las columnas `unique` del esquema.
- **La red arrancó en rojo, que era el entregable.** Antes de tocar nada marcó **3 handlers**, cada uno con el escenario y **el dato concreto que se filtró**:
  - `[ESCRITURA] InscriptionsController.create` — *"alta con el DNI de un participante ajeno declarando el departamento propio"* → devolvió `"Pirané"`, el uuid, el DNI, `"Insaurralde"` y `"Calle Rivadavia 900"`.
  - `[ESCRITURA] ParticipantsController.update` — *"mudando el propio al departamento ajeno"* → devolvió `"Pirané"`.
  - `[ESCRITURA] TeamsController.update` — ídem.
- **Los tres son de la vía ESCRITURA**, que es exactamente la que se escapó en las dos rondas anteriores: los barridos previos miraban listados y lecturas por id. Cubrir la respuesta de una escritura era el punto del DoD y es lo que encontró todo.
- **🐛 Hallazgo del propio harness:** la primera versión del doble aceptaba un DNI repetido, así que el `create` "tenía éxito" y devolvía al participante ajeno — el test habría pasado con la fuga puesta. Se modelaron las `unique` (`participant.dni`, `user.email`) y recién ahí el escenario se comportó como Postgres. Es el mismo principio que ya nos costó caro: un mock complaciente hace pasar por igual al código nuevo y al viejo.
- **Estado final: 10/10 en verde**, tras S02, S03 y S04.

### S02 🔴 🏗️ BE — El dashboard ignora el recorte territorial por completo

- [x] **Descripción:** `getStats()` no recibe el usuario, el service no tiene **ni una** cláusula `where`, y el cache es una clave global única. `DASHBOARD_READ` incluye `ADMIN_DEPARTAMENTAL`, `ADMIN_ZONAL` y `COORDINADOR`, que son los tres roles acotados.
- **El código ya lo avisaba.** El comentario de `dashboard.service.ts:41-49` dice: *"Hoy ningún service filtra por department o zone… Si algún día se implementa ese recorte, esta clave tiene que pasar a incluir el scope"*. Ese día fue R05 y el comentario quedó viejo. **Reescribirlo en la misma pasada.**
- **Verificado en vivo:** el mismo ADMIN_ZONAL al que `/participants` le devuelve `total=0` obtiene del dashboard `totalParticipants: 110`, `totalInscriptions: 108` y los nombres de las últimas 5 inscripciones, de Bermejo, Formosa y Pirané. Un COORDINADOR de Pilcomayo (alcance real: 14) ve los mismos 110.
- **Archivos:** `backend/src/modules/dashboard/dashboard.service.ts:40-50,119-145,168-171`, `dashboard.controller.ts:22-35`
- **DoD:**
  - Los conteos, los `groupBy` y las inscripciones recientes se recortan al alcance.
  - **La clave del cache se deriva del alcance.** Arreglar sólo las queries no alcanza: con una clave global, el primero que pida el dashboard le deja su vista a todos los demás. Un test tiene que cubrir específicamente esto —dos roles distintos pidiendo en secuencia— porque es el error que se comete al arreglar esta clase de bug.
  - Un rol acotado sin campo territorial cargado ve ceros, no el total.

- **✅ Evidencia (2026-08-31):** el controller pasó a recibir `@CurrentUser()` y a derivar el alcance; el service recorta los contadores, los `groupBy` y las inscripciones recientes; y la clave del cache la arma `claveDeCache(alcance)`. La red de S01 dejó de marcar el dashboard.
- **El cache era la mitad del arreglo, y sin él lo demás no servía:** con una clave global, el primero que pide el dashboard le deja su vista cacheada a todos los demás y el recorte se evapora en el segundo request. El test de cache ahora fija la clave derivada.
- **Se actualizaron dos assertions de `dashboard-stats.e2e-spec.ts` que afirmaban el comportamiento anterior** —la clave global y el `groupBy` sin filtro—, con el motivo escrito en el propio test. No se pueden sostener las dos cosas a la vez: eran justo lo que S02 vino a cambiar. Lo que ese spec cuida —que sea **un solo** `count` y **un solo** `groupBy`, no uno por estado— se conservó intacto.
- **El comentario viejo de `dashboard.service.ts:41-49` se reescribió.** Anticipaba este bug textualmente: *"si algún día se implementa ese recorte, esta clave tiene que pasar a incluir el scope"*.

### S03 🔴 🏗️ BE — Editar permite mover filas fuera de la jurisdicción

- [x] **Descripción:** El alta valida el departamento del body con `permiteDepartamento()`; **la edición no**. `UpdateParticipantDto` y `UpdateTeamDto` heredan `department` vía `PartialType` y el `update` hace `data: { ...updateDto }` sin mirarlo.
- **Verificado en vivo, en las dos entidades:** `PATCH /participants/:id {"department":"Pirané"}` → **200**, la fila se mudó, y acto seguido el mismo token recibe **404** sobre ella. Es una operación de un solo sentido: **irreversible para quien la hace**, porque después no puede verla para corregirla. Con un script son 14 requests para vaciar un departamento dentro de otro, y la auditoría lo registra como catorce ediciones de rutina.
- **El argumento ya está escrito en el código**, en `participants.service.ts:40-46`, justificando por qué el **alta** se acota: *"un delegado no podría ver los participantes de otro departamento pero sí crearlos ahí"*. Aplica idéntico a la edición, que además es peor porque **saca** filas de una jurisdicción.
- **Archivos:** `backend/src/modules/participants/participants.service.ts:212-275` (contrastar con `:47`), `backend/src/modules/teams/teams.service.ts:182-202` (contrastar con `:42`)
- **DoD:**
  - Si el PATCH trae `department` y difiere del actual, se exige `permiteDepartamento()` sobre el **valor nuevo** → 403, mismo criterio que el alta.
  - Reenviar el mismo departamento no rompe la edición de otros campos (mismo cuidado que R17 tuvo con el DNI: los formularios mandan el objeto completo).
  - Cubierto en participantes **y** equipos.

- **✅ Evidencia (2026-08-31):** el `update` de participantes y el de equipos exigen `permiteDepartamento()` sobre el **valor nuevo** cuando el departamento cambia, y responden **403**. La red de S01 dejó de marcar los dos handlers. **Contraprueba:** quitando los dos guards, la red vuelve a marcar `ParticipantsController.update` y `TeamsController.update` por nombre.
- **Sólo se corta si el valor cambia**, con el mismo cuidado que R17 tuvo con el DNI: los formularios mandan el objeto completo, así que rechazar un PATCH que reenvía el mismo departamento habría roto la edición de cualquier otro campo para el rol que hace la mayoría de las ediciones.
- **403 y no 404**, a diferencia de las lecturas: acá no se está revelando ninguna fila ajena —el `findOne` ya validó que la fila es propia—, sólo se rechaza el destino. El delegado tiene que entender por qué no puede.

### S04 🔴 🏗️ BE — Inscribir reutiliza un participante ajeno y devuelve su ficha completa

- [x] **Descripción:** El corte territorial se aplica sobre el `department` **del body**. Adentro de la transacción, el paso 4 busca por DNI con `findUnique({ where: { dni } })` **sin recorte** y, si existe, lo reutiliza; el `create` final baja con `include: { participant: true }`, la fila entera.
- **Verificado en vivo:** un DELEGADO de Pilcomayo mandó el DNI de un chico de Pirané declarando su propio departamento. La respuesta le entregó nombre, apellido, fecha de nacimiento, sexo, localidad y departamento del menor. A continuación, con el mismo token: `GET /participants/:id` → **404**. El endpoint scopeado se la niega; el que no lo está se la entrega. De yapa queda una inscripción en el padrón de Pirané que su autor no puede ver ni corregir.
- **El DNI no es una barrera:** figura en cualquier planilla de escuela, así que enumerarlo es trivial.
- **Archivos:** `backend/src/modules/inscriptions/inscriptions.service.ts:73-78,139-159,188`
- **DoD:**
  - La búsqueda por DNI corre con el alcance adentro del `where`.
  - Un DNI que existe **fuera** del alcance responde **igual** que un DNI ajeno cualquiera: no se puede distinguir "existe pero no es tuyo" de "no existe".
  - La respuesta deja de bajar la ficha completa (ver S10).

- **✅ Evidencia (2026-08-31):** la búsqueda por DNI pasó a `findFirst` con `whereParticipant(alcance)` adentro del `where`, y la respuesta del alta dejó de bajar `participant: true` para usar `PARTICIPANT_CONTACT`. La red de S01 dejó de marcarlo. **Contraprueba:** volviendo al `findUnique` pelado, la red vuelve a marcar `InscriptionsController.create`.
- **Un DNI fuera del alcance responde igual que uno inexistente:** cae en la rama de creación, donde la unique de `dni` corta. Es deliberado que no se pueda distinguir "existe pero no es tuyo" de "no existe", por la misma razón por la que R06 devuelve 404 y no 403.
- **🐛 El arreglo obvio introducía un 500, y hubo que cerrarlo:** sin manejo de `P2002`, ese alta terminaba en un error crudo de Prisma. Cambiar una fuga de datos por un 500 no es arreglarla. Ahora devuelve **409** con un mensaje **deliberadamente neutro** —no dice en qué departamento está ni si existe, porque eso reintroduciría por texto la distinción que el `findFirst` acotado vino a borrar— y que dice qué hacer, que es lo que el delegado necesita.
- **Se actualizó el mock de `inscriptions-transaction.e2e-spec.ts`** para que su `findFirst` evalúe el filtro territorial además del DNI: si sólo matcheara por DNI, ese spec seguiría en verde con la fuga puesta.

### S05 🔴 ⚛️ FE — El chequeo de permisos no mira el archivo donde los permisos se aplican

- [x] **Descripción:** `check:nav` bundlea `adminRoutes.ts`, `adminActions.ts`, `navItems.tsx` y hasta el archivo real del backend — pero **no tiene una sola referencia a `router.tsx`**, que es donde la protección efectivamente se declara. Toda la garantía es sobre el *mapa*; nada comprueba que el router lo aplique.
- **Verificado mutando:** borrando el `conRoles(...)` de la ruta de Usuarios, `npx tsc --noEmit` queda limpio y los **402 chequeos siguen en verde**. Con esa línea borrada, cualquier rol del área admin entra a `/admin/usuarios`. No es una brecha —el backend sigue devolviendo 403 en los datos— pero es exactamente la divergencia que el script existe para impedir, y pasa muda.
- **Archivos:** `frontend/scripts/check-nav-roles.mjs`
- **DoD:**
  - El chequeo lee `router.tsx` como fuente (igual que ya hace con `navItems.tsx`, `Sidebar.tsx` y `constants.ts`) y exige que cada ruta admin aparezca envuelta en su `conRoles(ADMIN_ROUTE_ROLES[...])`. Alcanza una regex sobre el fuente; no hace falta montar el router.
  - **Contraprueba obligatoria:** repetir la mutación de arriba y comprobar que ahora se pone en rojo.

- **✅ Evidencia (2026-08-31):** sección nueva en `check:nav` que lee `router.tsx` como fuente y exige que cada ruta admin se monte envuelta en `conRoles(ADMIN_ROUTE_ROLES[ROUTES.<clave>])`. Los chequeos pasaron de **402 a 469**.
- **Contraprueba reproducida por mí, no sólo por el agente:** borrando el `conRoles(...)` de la ruta de Usuarios —la mutación exacta que la revisión usó— `npx tsc --noEmit` queda **limpio** (el compilador no ve el problema) y el chequeo ahora **falla**, con el mensaje `[router] /admin/usuarios se monta envuelta en conRoles(...) — el router monta \`<UsersPage /> },\`: cualquier rol del área admin entra`. Antes esa misma mutación pasaba en verde. Se probó también la variante de reemplazarlo por una lista inline: 2 divergencias.
- **Incluye una red de seguridad del propio barrido:** si un refactor de la forma de las rutas deja la regex sin matchear, el chequeo falla en vez de quedarse con 63 comprobaciones vacías — que es el mismo modo de falla que esta tarea denuncia, un nivel más arriba.

### S06 🔴 ⚛️ FE — Cinco pantallas del admin cortan en 20 filas y buscan en memoria

- [x] **Descripción:** El límite por defecto del backend es **20**, no 100 (`pagination.dto.ts:41`) — dato que se dio por mal en la ronda anterior. Estas cinco pantallas llaman al hook paginado **sin `page` ni `limit`**, no pasan `meta` al `DataTable` y **no tienen ningún control de paginación**:

  | Pantalla | Qué pasa |
  |---|---|
  | `UsersPage.tsx:34,36-45,162-165` | 20 usuarios; el buscador filtra con `.includes()` sobre esos 20 |
  | `NewsAdminPage.tsx:36,41-49,171-174` | 20 noticias; filtrado en memoria |
  | `VenuesAdminPage.tsx:31,35,63-66` | 20 sedes |
  | `DisciplinesAdminPage.tsx:38,176-179` | 20 disciplinas |
  | `CategoriesAdminPage.tsx:44-45,172-175` | 20 categorías |

- **Escenario:** el sistema llega a 25 usuarios. Un SUPER_ADMIN busca el apellido del número 23 y la pantalla dice que no hay coincidencias. Sin error, sin toast, sin página 2. Es la frase exacta que R29 corrigió en las noticias públicas, reproducida en el admin con 20 en vez de 50.
- **Hoy no se ve** porque el seed es chico (3 usuarios, 3 sedes, 5 disciplinas), pero participantes ya está en 110 con 6 páginas — y esa pantalla **sí** pagina bien. La diferencia es que a `ParticipantsPage` y `TeamsAdminPage` se les puso `page`/`limit`/`meta` y a estas cinco no.
- **Alcance adicional — los selectores de filtro:** también salen del hook paginado y ofrecen como mucho 20 opciones (`ParticipantsPage:44-45`, `TeamsAdminPage:47-48`, `ReportsPage:21-22`, `CalendarAdminPage:32`, `TeamForm:60`, `useCompetitionForm:75`, `DisciplineDetailPage:14`). Los `useAllDisciplines`/`useAllCategories` que R29 creó se usan **sólo** en el asistente público.
- **DoD:** con más registros que el tope, la búsqueda y los filtros alcanzan a **todo** el conjunto en las cinco pantallas, y ningún `EmptyState` afirma "no hay resultados" cuando lo cierto es "no hay resultados en lo que trajimos". Los selectores ofrecen el catálogo completo.

- **✅ Evidencia (2026-08-31), medida sembrando por encima del tope:**

  | Pantalla | total | la request vieja traía | buscar la aguja (antes → ahora) |
  |---|---|---|---|
  | Usuarios | 25 | 20 | **0 coincidencias → "no hay resultados"** → 1 |
  | Noticias | 25 | 20 | 0 → 1 |
  | Sedes | 25 | 20 | 0 → 1 |
  | Disciplinas | 27 | 20 | 0 → 1 |
  | Categorías | 27 | 20 | 0 → 1 |

  Las cinco paginan de a 10 y devuelven el total completo. Los selectores, con 27 disciplinas, pasaron de ofrecer **20 de 27** a **27 de 27**.
- **Se corrigieron dos textos que mentían:** el placeholder de Usuarios decía "o depto" y el backend busca por nombre/apellido/email; el de Sedes prometía dirección y localidad cuando el `search` compara contra el nombre. Y un comentario en Noticias afirmaba que "el listado viene completo del backend", que era falso.
- **El prefetch de catálogos del router se corrigió de paso:** precargaba las claves paginadas, que ya no lee nadie desde que los combos usan `listAll`.
- **⏳ Pendiente:** no se recorrieron las pantallas en un navegador — no hay Playwright ni jsdom en el repo. La evidencia es de la API con datos sembrados por encima del tope, no de un click manual.

---

## Fase 2 — Altos

### S07 🟡 🏗️ BE — La edad y el sexo se validan contra el formulario, no contra el participante real

- [ ] **Descripción:** Los pasos 2 y 3 validan `birthDate` y `sex` **del body**, antes de la transacción. El paso 4 después descarta esos valores si el participante ya existe. Nadie vuelve a validar contra la fila real.
- **Verificado en vivo:** se inscribió a un varón de 12 años en la categoría **Sub-16 Femenino** declarando `birthDate: "2010-01-01"` y `sex: "FEMENINO"` → **201**, apuntando al participante real con su edad y su sexo reales.
- **No hace falta mala fe:** alcanza un tipeo en la fecha de un chico ya cargado. Las validaciones que protegen la equidad de la competencia son inoperantes en el camino de reutilización, que es el mayoritario a mitad de temporada.
- **Archivos:** `backend/src/modules/inscriptions/inscriptions.service.ts:94-109` vs `:139-159`
- **DoD:** el cálculo de edad y el chequeo de sexo corren **dentro** de la transacción, sobre `participant.birthDate` / `participant.sex`. Decidir explícitamente qué pasa cuando el body contradice a la fila existente: hoy se ignora en silencio, que es el mismo criterio que R17 rechazó para el DNI.

### S08 🟡 🏗️ BE — `generateFixture` sin transacción deja la competencia muerta y sin salida

- [ ] **Descripción:** Deuda anotada al cerrar R23, y **peor de lo que decía la nota**. El motor hace `match.create` + `result.createMany` en un loop suelto y el service después pasa el estado a `ACTIVA`; nada de eso está en una transacción. Además **no valida que los ids existan** ni que pertenezcan a la disciplina/categoría de la competencia: van directo a la foreign key.
- **Verificado en vivo:** con cinco `teamIds` donde el tercero es un uuid inexistente → **500**, quedan 2 partidos huérfanos, la competencia atrapada en `BORRADOR`, y el reintento del camino feliz devuelve **409 "La competencia ya tiene un fixture generado"**. Ese 409 es **permanente**: no existe `DELETE /competitions/:id/fixture` ni `DELETE /matches/:id` en toda la API. La única salida es un `DELETE` a mano contra Postgres. Un id mal pegado en el frontend deja una competencia muerta el día de la jornada.
- **Archivos:** `backend/src/modules/competitions/competitions.service.ts:173-215`, `backend/src/modules/competitions/engine.factory.ts:83-111`
- **DoD:**
  - El motor entero **más** el cambio de estado, dentro de un `prisma.$transaction` (mismo tratamiento que R13 le dio al alta de inscripciones).
  - Los ids se validan **antes**: que existan y que correspondan a la disciplina y categoría de la competencia, así el caso normal ni llega a la foreign key.
  - **Existe una salida para una competencia trabada.** Sin esto, el arreglo evita el estado roto nuevo pero deja sin remedio a las que ya lo estén.
  - Oportunidad de paso: `match.create` con `results: { create: [...] }` anidado baja los round-trips.

### S09 🟡 🏗️ BE — La exportación de resultados invierte local y visitante (reincidencia de R23)

- [ ] **Descripción:** El mismo bug que R23, un módulo más allá y con el arreglo ya disponible sin usar. El `findMany` incluye `results` **sin `orderBy`** y el mapeo hace `results[0]` / `results[1]` para llenar las columnas "Local" y "Visitante". `isHome` existe, está poblado, y este archivo no lo lee — mientras `prisma-selects.ts:170-173` tiene el `orderBy` bien puesto y comentado como *"parte del contrato, no un detalle"*.
- **Reproducido en vivo:** se generó un fixture, se exportó, se cargó un resultado (el ciclo de vida normal de un partido) y se volvió a exportar. **Los tres partidos salieron invertidos.** La columna "Ganador" sigue bien —sale del mismo índice—, así que el error **no se nota leyendo**: sólo la localía miente, y el archivo se archiva como acta.
- **Archivos:** `backend/src/modules/reports/reports.service.ts:836-846,858-882`
- **DoD:** seleccionar por `find(r => r.isHome === true)` y no por índice, con el mismo `orderBy` y el mismo fallback de R23 (sin las dos puntas, no se rotula localía). Test que exporte dos veces con una escritura en el medio y compare.

### S10 🟡 🏗️ BE — Cinco respuestas de mutación bajan la ficha completa del participante

- [ ] **Descripción:** `create`, `review`, `approve`, `reject` y `addMember` devuelven `include: { participant: true }` — la fila entera, incluido `address`, que ni siquiera `PARTICIPANT_CONTACT` expone. Contrasta con `findOne`/`findAll` del mismo archivo, donde R01 dejó `select` explícitos y argumentados.
- **Por qué importa aunque el alcance lo gatee:** es exactamente el mecanismo que `prisma-selects.ts:9-13` describe como el motivo de existir del archivo — *"`include` arrastra columnas nuevas automáticamente: si mañana `Participant` suma un campo sensible, aparece solo en todas las respuestas"*. Y una de estas cinco puertas es la que hace explotable la fuga de S04.
- **Archivos:** `backend/src/modules/inscriptions/inscriptions.service.ts:188,405,437,479`, `backend/src/modules/teams/teams.service.ts:264`
- **DoD:** los cinco pasan a `PARTICIPANT_CONTACT` (o `PARTICIPANT_SUMMARY` en `addMember`, que sólo necesita nombre y DNI). Cubierto por la red de S01.

### S11 🟡 ⚛️ FE — Los tres puntos ciegos de `check:nav`

- [ ] **Descripción:** Aparte de S05, el chequeo tiene tres agujeros, **todos comprobados mutando el código**:
  1. **`PANTALLAS_QUE_FILTRAN` está escrita a mano** (`:332-341`). La condición es derivable (`roles de la ruta ⊋ roles de la acción`) pero el script no la calcula. Mutación: sacar `ADMIN_ZONAL` de `NEWS_MANAGE` en el backend **y** en el espejo —una sincronización perfectamente correcta— deja el chequeo en **verde**, y un ADMIN_ZONAL sigue viendo "Nueva noticia" y comiendo 403 al guardar. Es el bug de R22, textual. Hoy no muerde por **coincidencia**: los roles de ruta y de acción de las siete pantallas restantes coinciden exactamente.
  2. **La sección 9 es un `includes()` de string** (`:346-358`). Mutación: invertir el gate (`= !puede('USER_MANAGE')`), o sea mostrarle el botón exactamente al rol que no puede → **verde**. Un test de render con un usuario falso por rol es lo que cierra esto.
  3. **La dirección A de la sección 1 es tautológica** (`:124-130`): recorre `navItemsParaRol(role)` y verifica con la misma función que ya filtró. Son ~100 de los 402 chequeos que **no pueden ponerse en rojo**, e inflan el número que se usa como medida de cobertura.
- **Además, tres acciones quedaron sin ninguna pantalla:** `PARTICIPANT_UPDATE_DNI`, `DOCUMENT_UPLOAD` y `ZONE_WRITE`. `ACCIONES_POR_PANTALLA` está tipado como `Partial<Record<...>>`, así que omitir una es silencioso, y la sección 8 sólo recorre lo que ese mapa declara: la dirección que el propio comentario del script llama *"la que se olvida"* tiene su propio punto ciego.
- **DoD:** derivar `PANTALLAS_QUE_FILTRAN`; que las tres mutaciones de arriba pongan el chequeo en rojo; que el conteo de chequeos deje de incluir los tautológicos, o que el output no los presente como cobertura.

### S12 🟡 🔀 FS — Toda la funcionalidad de cambio de DNI es código muerto

- [ ] **Descripción:** El backend tiene la feature completa de R17: `DNI_EDITORS`, la validación, y una acción de auditoría propia `DNI_CHANGE` que guarda valor anterior y nuevo enmascarados. En el frontend, `ParticipantForm.tsx:54` pone `disabled={isEditing}` en el campo DNI **para todos los roles**, SUPER_ADMIN y ADMIN_PROVINCIAL incluidos.
- **Verificado:** `PARTICIPANT_UPDATE_DNI` aparece **una sola vez en todo el frontend** — en la declaración del permiso. Ninguna pantalla lo consulta.
- **Resultado:** los dos roles que tienen el permiso no tienen forma de ejercerlo, y todo el andamiaje de auditoría del cambio de DNI nunca se dispara.
- **DoD:** el campo se habilita según el permiso; un test cubre las dos direcciones (el rol habilitado puede, el resto no lo ve editable) y que el cambio deja su fila `DNI_CHANGE`.

### S13 🟡 ⚛️ FE — Topes silenciosos que sobrevivieron a R29

- [ ] **Descripción:** Dos casos, y el segundo escribe datos:
  1. **`fetchAllPages` trunca en 2.000 filas sin decir nada** (`src/lib/fetchAllPages.ts:20,43`). Ejercitado con un backend simulado que reporta 5.000: devuelve 2.000 como si fueran todas, sin excepción, sin log, sin flag. Es el mismo modo de falla de R29 corrido de 100 a 2.000, y quien lo sufre es el calendario público.
  2. **`CompetitionDetailPage.tsx:28`** — `useTeams({ ..., limit: 100 })`, y ese `availableTeams` **no es sólo para mostrar**: `handleGenerateFixture` hace `teamIds = availableTeams.map(t => t.id)` y lo manda al backend. Una competencia con más de 100 equipos elegibles **genera un fixture al que le faltan equipos**, sin que nada lo indique. Es el único `limit: 100` sobreviviente con consecuencia sobre datos escritos.
- **DoD:** `fetchAllPages` avisa por `logError` (o lanza) al alcanzar el tope con páginas pendientes — un corte silencioso a los 2.000 no es mejor que uno a los 100, sólo más difícil de reproducir. Y la generación del fixture no puede depender de una página.

### S14 🟡 🔀 FS — Consumir la matriz de permisos en vez de duplicarla

- [ ] **Descripción:** El backend **ya publica** `GET /auth/permissions` con `{ role, actions, matrix }`, y se verificó contra la API viva que **coincide exactamente** con el espejo de `adminActions.ts`. O sea: existe un endpoint que hace innecesaria toda la clase de bug "el espejo se desincronizó", y el frontend mantiene igual la copia a mano más 400 líneas de script para custodiarla.
- **Contrapartida a resolver, no a ignorar:** pintar un botón no puede depender de un request en vuelo. La forma probable es consumir la matriz al arranque de la sesión y dejar el espejo como fallback.
- **DoD:** el permiso efectivo viene del servidor; la sección 7 del chequeo desaparece; la 8 pasa a ser derivable; y las tres acciones huérfanas de S11 se hacen visibles solas. Se decide y documenta qué pasa si el endpoint falla.

---

### S19 🟠 🔀 FS — Sincronizar las noticias de Juegos Evita desde formosa.gob.ar

- [x] **Descripción:** El portal oficial publica las noticias de los Juegos Evita y hoy hay que copiarlas a mano. Traerlas automáticamente al listado propio, **enlazando al original en vez de republicar el contenido**.
- **✅ Autorización:** la Secretaría de Deportes dio permiso (es la misma fuente que figura en las notas).

#### Lo que se investigó antes de diseñar — y por qué el camino obvio no sirve

Tres vías que parecían razonables y **no funcionan**, verificadas contra el sitio real el 2026-08-31:

1. **El sitemap de noticias está muerto.** `sitemap_formosa_noticias_gov.xml` tiene 23.912 URLs, **todas con fecha `2019-09-09`** y IDs hasta 24358, cuando las noticias actuales van por el 34700. Lleva siete años sin actualizarse. Un sync apoyado ahí correría a diario sin traer nada **y sin avisar**.
2. **El número del medio de la URL no es la categoría.** `/noticia/33163/671/dia_de_la_escarapela` y `/noticia/34709/671/las_chicas_de_belgrano_campeonas` comparten el `671`, pero la primera declara "Información Pública" y la segunda "Juegos Evita Formoseños".
3. **El listado por categoría no filtra.** `/noticias/{N}/pagina/1` acepta **cualquier** número —probado con `999` y `4242` inventados— y devuelve resultados estables pero sin relación con la sección real. El enlace de categoría que la propia nota genera (`/noticias/categoria///juegos_evita_formosenos`) responde **302 a error**.

**No hay RSS, Atom ni JSON.**

#### Los dos hallazgos que sí habilitan la solución

1. **Sólo el ID importa en la URL.** `/noticia/34709/0/x` devuelve la nota correcta: los otros dos segmentos son cosméticos. Eso convierte el descubrimiento en **recorrer IDs secuenciales**, que es determinista, en vez de depender de un listado roto.
2. **La nota trae Open Graph y un slug de sección.** `og:title`, `og:description` y `og:image` —la imagen sale por **https** desde `archivos.formosa.gob.ar`, así que pasa el `safeImageSrc` de T17—. Y el "Cargada en" enlaza a un href que contiene **`juegos_evita_formosenos`**: ese slug es la señal de clasificación, más estable que el texto visible con acentos.

#### Diseño

- **Descubrimiento:** desde el último ID sincronizado hacia adelante, hasta N fallos consecutivos.
- **Clasificación:** se queda sólo con las notas cuyo "Cargada en" apunte al slug `juegos_evita_formosenos`.
- **Extracción:** de los tags Open Graph, no del DOM.
- **Almacenamiento — enlaza, no republica.** Título, bajada, imagen, fecha y **link al original**. Dos motivos: el legal (republicar contenido ajeno es otra cosa que enlazarlo, aun con permiso) y uno técnico — **T11 sacó `dangerouslySetInnerHTML` de todo el proyecto** tras confirmar que las noticias son texto plano; traer el cuerpo HTML de otro sitio reabriría justo esa superficie.
- **Frecuencia:** una corrida diaria, más un botón en el panel para forzarla cuando alguien acaba de publicar algo.
- **Modelo:** `News` necesita `sourceUrl` y un marcador de externa — una nota que enlaza afuera no se edita ni se despublica como una propia, y en la tarjeta tiene que notarse de dónde viene.

- **DoD:**
  - El sync trae la nota `34709` ("Las chicas de Belgrano, campeonas") y **descarta** una de otra sección con el mismo número en la URL, como la `33163`.
  - Correr el sync dos veces seguidas no duplica filas (idempotente).
  - **Falla ruidosamente:** si el sitio cambia y deja de haber notas clasificables, o si los tags OG desaparecen, el sync **registra el problema**; no puede terminar en verde trayendo cero. Es el modo de falla que este proyecto ya cometió tres veces.
  - Las noticias externas se distinguen de las propias en el listado público y llevan al portal oficial.
  - Un test cubre el parseo contra **HTML real guardado como fixture**, no contra un string inventado: si cambian el markup, el test lo dice.


- **✅ Evidencia (2026-08-31):** módulo nuevo en `backend/src/modules/news/sync/`, con el parseo separado de la red y de la base para poder testearlo contra HTML real. **32 tests nuevos** (unitarios 99 → **131**); e2e 640 con la única falla conocida, en dos corridas.
- **Verificado en vivo contra el portal:** recorriendo los IDs 34701–34712 encontró 9 notas reales, clasificó **1** (la 34709) y **descartó 8** por sección, sin errores de red. Segunda corrida sobre los mismos IDs: `creadas: 0, actualizadas: 1` — idempotente de verdad.
- **Falla ruidosamente por tres vías**, y la que importa es el **canario**: antes de recorrer, baja la nota 34709 y verifica que siga parseando y clasificando. Eso mata el caso "cero noticias para siempre y en verde", porque dispara aunque no haya nada nuevo que traer. Las otras dos son markup inesperado (páginas sin OG o sin "Cargada en") y vejez (más de 30 días sin una nota clasificable).
- **Contraprueba:** con un clasificador ingenuo que mira el número del medio de la URL —el error que la investigación había descartado— fallan **5 tests**, incluido el del canario. Con la detección de ID inexistente por status code, fallan **4**.

#### 🐛 Tres cosas del sitio ajeno que sólo aparecen implementando

1. **Un ID inexistente devuelve HTTP 200**, no 404: sirve la plantilla sin rellenar, con `og:title` = "Portal Oficial del Gobierno de la Provincia de Formosa". **Verificado de forma independiente:** la 34709 pesa 40.872 bytes y la 34710 y la 99999 pesan exactamente 35.396 cada una. Confiar en el status code habría insertado el título del portal como noticia **una vez por cada ID recorrido**.
2. **Una nota real también trae marcadores del CMS sin rellenar** (`{sysnoti02_titulo_alt}`). La primera versión usó el patrón genérico `{...}` para detectar la plantilla vacía y **descartó todas las notas, la 34709 incluida**. Lo cazó el test contra fixture real en el primer intento — que es exactamente para lo que se pidió el fixture y no un string inventado.
3. **El sitio declara ISO-8859-1 y lo cumple, incluso dentro de los tags Open Graph.** `response.text()` de fetch asume UTF-8 y deja el título lleno de caracteres de reemplazo; hay que decodificar desde los bytes.

- **✅ Migración aplicada y sync verificado de punta a punta (2026-08-31).** `prisma migrate deploy` contra el Postgres real; las tres columnas y la tabla `sync_state` confirmadas en la base.
- **Corrida real contra el portal:** recorrió los IDs 34709–34720 en 11 páginas, encontró 2 notas, **clasificó 1 y descartó 1 por sección**, y persistió el cursor en 34714. La fila quedó con título, fuente ("Secretaría de Deportes y Recreación Comunitaria"), URL original, imagen `https`, fecha y bajada.
- **Los acentos salen bien** ("Juárez", "campeón"): la decodificación ISO-8859-1 funciona contra el sitio real, no sólo contra el fixture.
- **Enlaza y no republica, comprobado en la API pública:** la nota externa viaja con **190 caracteres** de contenido y **sin una sola etiqueta HTML**, marcada con `isExternal` y su `sourceUrl`.
- **La falla ruidosa se disparó sola en la primera corrida real:** un ID no se pudo leer por un error de red y el sync devolvió `estado: "alerta"` con el motivo escrito —*"el cursor no avanzó sobre ellos y se vuelven a intentar"*— en vez de terminar en verde. Es exactamente el comportamiento que la tarea pedía, y no hubo que provocarlo.
- **Dos decisiones que conviene revisar:**
  - **Las externas no se pueden eliminar, ni sólo editar.** Borrar la fila no saca la noticia: la corrida siguiente la recrea por el `upsert`. Se cerró el botón en vez de dejar uno que promete y no cumple. Ocultar una nota puntual va a necesitar una lista de exclusión propia.
  - **El permiso `NEWS_SYNC` es más acotado que `NEWS_MANAGE`** (sólo SUPER_ADMIN y ADMIN_PROVINCIAL), porque la acción sale a golpear un sitio ajeno.
  - **No se agregó `@nestjs/schedule`** por una sola tarea programada, teniendo S15 abierta por deuda de dependencias.

---

## Fase 3 — Mantenimiento

### S15 🟡 🔀 FS — Dependencias con vulnerabilidades conocidas

- [ ] **Descripción:** `npm audit --omit=dev`: **14 en el backend (8 altas)** y **3 en el frontend (2 altas)**. No es código que alguien escribió mal: es deuda que se acumula sola y hay que revisar periódicamente.
- **Triaje ya hecho — no todas pesan igual:**
  - **`fast-xml-parser`** (alta), vía `minio@8.0.7`: es lo que interpreta las respuestas del servidor de archivos. **La más alcanzable de todas**, porque toca un camino por el que pasan datos en cada subida y descarga.
  - **`js-yaml`** (alta), vía `@nestjs/swagger`: Swagger está apagado en producción desde T06.
  - **`deepmerge-ts`, `hono`, `@hono/node-server`**: entran por herramientas de Prisma que sólo corren en desarrollo.
  - **`uuid`** (media), vía `exceljs`: en funciones v3/v5/v6 que el código no usa.
  - **`react-router` 8.0–8.2** (alta), evasión de CSRF: el aviso dice ser específico del "modo RSC", que el proyecto no usa — **confirmarlo, no asumirlo**.
- **DoD:** cada vulnerabilidad queda clasificada como *aplicada*, *no alcanzable con motivo escrito*, o *aceptada con fecha de revisión*. `npm audit fix` corrido donde no rompa; lo que exija un salto mayor de versión, evaluado aparte. Registrar el conteo antes y después.

### S16 🟠 ⚛️ FE — `DocumentsPage` es una maqueta y está en el menú de producción

- [ ] **Descripción:** `pendingReviews` es un arreglo hardcodeado de tres filas con nombres inventados ("Pérez, Juan", "López, María"), y las tarjetas de arriba muestran **12 / 845 / 3 fijos**. La pantalla está en el menú y la ven administradores, delegados y coordinadores. R22 le puso un control de permisos correcto a un botón que no hace nada sobre datos que no existen.
- **DoD:** o se saca del menú hasta que esté lista, o se conecta a datos reales. **El 845 en pantalla es una afirmación falsa** frente a un usuario, y es lo que hay que resolver primero.

---

## Fase 4 — Polish

### S17 ✨ 🏗️ BE — Nits del backend agrupados

- [ ] **Descripción:**
  - **`zone` se compara insensible en un lado y sensible en el otro.** `scope.service.ts:124-128` usa `mode: 'insensitive'`; `zones.service.ts:43,96,113` usa igualdad exacta. Consecuencia: `PUT /zones/Norte` y `PUT /zones/norte` crean dos mapeos que el scope después une, y `DELETE /zones/Norte` deja vivas las de `norte` — el ADMIN_ZONAL sigue viendo datos después de un borrado que la API reportó exitoso. **Con el mapeo todavía vacío no muerde a nadie: conviene normalizar antes de cargarlo.**
  - **Borrar `test/app.e2e-spec.ts`.** Es el scaffold de `nest new` esperando `"Hello World!"` en `/`, una ruta que esta app nunca tuvo. No aporta cobertura —`/health` ya está cubierto— y una falla permanente entrena al equipo a leer "1 failed" como normal, que es justo la condición para que la segunda falla pase desapercibida.
  - **`esRutaDeDocs(req.url)` mira la URL cruda** (`security.ts:205-214`). Impacto nulo hoy (Express no rutea el path y Swagger está apagado en producción), pero es la forma —chequeo sobre `url` en vez de sobre la ruta normalizada— que R02 vino a erradicar, y quedó una instancia.
  - **Staleness del alcance en el JWT.** Mover a un delegado de departamento, o desactivarlo, no surte efecto hasta que venza el access token. Está documentado con honestidad; un `tokenVersion` en `User` chequeado en la estrategia lo cierra.
  - **Confirmar que `NODE_ENV=production` esté efectivamente puesto en el deploy.** De ese string cuelga el corte que evita que un 500 devuelva rutas absolutas y código fuente.

### S18 ✨ ⚛️ FE — Nits del frontend agrupados

- [ ] **Descripción:**
  - **El barrel de `pages/admin` sigue existiendo** y no lo importa nadie. Es la misma trampa que se desactivó borrando el barrel público (documentada en `lazyPages.ts:12-18`), todavía cargada: un `import { UsersPage } from '@/pages/admin'` arrastra los 20 chunks al de entrada.
  - **`rutaAdminQueMatchea` no matchea si el pathname trae query string** (`adminRoutes.ts:97-111`), y cae en "fuera del panel, se respeta tal cual". Hoy **no es alcanzable** porque sólo se le pasa `from.pathname`. Queda latente para el día que alguien pase `pathname + search`.
  - **`auth.api.ts:19` escribe el token sin validar**, mientras `refreshAccessToken()` sí valida (R24). El daño es chico y se auto-repara, pero la asimetría invita a copiarla mal.
  - **`CompetitionDetailPage.tsx:24-29`**: el `useTeams` sin `enabled`, así que el primer render dispara una request sin filtros que trae 100 equipos arbitrarios y se descarta. Un round-trip de más por apertura.
  - **El `errorElement` está en la ruta padre de la rama pública**, así que un error dentro de una página desmonta el layout entero y el usuario pierde header y footer. Es defendible, pero el comentario de `ErrorScreen.tsx:17` sugiere lo contrario.
  - **`ErrorScreen` como fallback de sí misma**: si falla siendo el fallback del boundary de clase, React re-lanza y la pantalla queda en blanco. Riesgo bajo (sólo depende de `cn`, `ROUTES` y cuatro íconos), pero el fallback último debería ser HTML sin dependencias.

---

## 🗺️ Orden de ejecución recomendado

1. **S01** — primero, siempre. Es la red, y su rojo inicial es lo que demuestra que sirve.
2. **S02, S03, S04** (🏗️ BE) — los tres agujeros del recorte que S01 va a marcar. Cerrarlos hasta que S01 quede en verde.
3. **S05** (⚛️ FE) — el chequeo que no mira el router. Media hora, y la contraprueba está escrita.
4. **S06** (⚛️ FE) — las cinco pantallas sin paginar.
5. **S07, S10** (🏗️ BE) — se tocan los mismos archivos que S04; conviene hacerlos en la misma pasada.
6. **S08, S09** (🏗️ BE) — competencias y reportes.
7. **S11, S12, S13** (⚛️ FE / 🔀 FS).
8. **S14** (🔀 FS) — después de S11, porque lo simplifica.
9. **S15** (🔀 FS) — antes de exponer la app.
10. **S16, S17, S18** — cierre.

---

## 📊 Estado de las tareas

**Progreso: 7 de 19 tareas completadas.**
Blockers 🔴: **6 de 6** — la regla dura se cumple. Lo que queda es alto, medio y polish.

| Tarea | Sev. | Agente | Título | Estado |
|---|---|---|---|---|
| **S01** | 🔴 | 🏗️ BE | Red: ningún endpoint devuelve datos de personas sin recortar | ✅ Completada |
| **S02** | 🔴 | 🏗️ BE | El dashboard ignora el recorte territorial | ✅ Completada |
| **S03** | 🔴 | 🏗️ BE | Editar permite mover filas fuera de la jurisdicción | ✅ Completada |
| **S04** | 🔴 | 🏗️ BE | Inscribir reutiliza un participante ajeno y devuelve su ficha | ✅ Completada |
| **S05** | 🔴 | ⚛️ FE | `check:nav` no lee `router.tsx` | ✅ Completada |
| **S06** | 🔴 | ⚛️ FE | Cinco pantallas del admin cortan en 20 filas | ✅ Completada |
| **S07** | 🟡 | 🏗️ BE | Edad y sexo validados contra el formulario, no contra la fila | ⬜ Pendiente |
| **S08** | 🟡 | 🏗️ BE | `generateFixture` sin transacción y sin salida | ⬜ Pendiente |
| **S09** | 🟡 | 🏗️ BE | La exportación invierte local y visitante | ⬜ Pendiente |
| **S10** | 🟡 | 🏗️ BE | Cinco mutaciones bajan la ficha completa | ⬜ Pendiente |
| **S11** | 🟡 | ⚛️ FE | Los tres puntos ciegos de `check:nav` | ⬜ Pendiente |
| **S12** | 🟡 | 🔀 FS | El cambio de DNI es código muerto | ⬜ Pendiente |
| **S13** | 🟡 | ⚛️ FE | Topes silenciosos que sobrevivieron a R29 | ⬜ Pendiente |
| **S14** | 🟡 | 🔀 FS | Consumir la matriz de permisos en vez de duplicarla | ⬜ Pendiente |
| **S15** | 🟡 | 🔀 FS | Dependencias con vulnerabilidades conocidas | ⬜ Pendiente |
| **S16** | 🟠 | ⚛️ FE | `DocumentsPage` es una maqueta en el menú | ⬜ Pendiente |
| **S19** | 🟠 | 🔀 FS | Sincronizar las noticias de Juegos Evita desde formosa.gob.ar | ✅ Completada |
| **S17** | ✨ | 🏗️ BE | Nits del backend agrupados | ⬜ Pendiente |
| **S18** | ✨ | ⚛️ FE | Nits del frontend agrupados | ⬜ Pendiente |

### Resumen por severidad

| Severidad | Completadas | Total |
|---|---|---|
| 🔴 Blocker | 6 | 6 |
| 🟡 Alto | 0 | 9 |
| 🟠 Medio | 1 | 2 |
| ✨ Polish | 0 | 2 |

### Reparto por agente

| Agente | Tareas | Total |
|---|---|---|
| 🏗️ **BE** | S01, S02, S03, S04, S07, S08, S09, S10, S17 | **9** |
| ⚛️ **FE** | S05, S06, S11, S13, S16, S18 | **6** |
| 🔀 **FS** | S12, S14, S15 | **3** |
| 👁️ **CR** | Todas al cierre | **18** |

---

## ✅ Lo que la revisión confirmó que quedó bien

Verificado contra el stack corriendo. No hace falta volver a mirarlo:

- **`ScopeService` no tiene fisuras propias.** Fue atacado y aguantó: `findFirst` con el alcance dentro del `where`, `AND` en vez de merge campo a campo, `{ in: [] }` para el alcance vacío, 404 en lecturas y 403 en altas. En vivo: SUPER_ADMIN 110 participantes / delegado de Pilcomayo 14 / delegado de Pirané 27 / **delegado sin departamento 0** / **ADMIN_ZONAL sin mapeo 0**. Igual en equipos e inscripciones. Los blockers S02–S04 son endpoints que **no lo usan**, no fallas del helper.
- **R22 sin excepciones:** ningún `@Roles` escrito a mano en los 15 controllers, ningún handler de escritura sin protección. Los únicos sin `@Roles` son `/auth/logout`, `/auth/me` y `/auth/permissions`, que es lo correcto.
- **R01, R02, R03, R06, R10, R11, R14, R16, R17, R18** y el motor de **R23**: cerrados y comprobados en vivo.
- **Frontend:** cero XSS y todos los `href`/`src` dinámicos por los validadores; un solo camino a `/auth/refresh`; ningún `lazy()` sin su `Suspense`; las cuatro ramas del router con `errorElement`; `matchSides.ts` correcto en los seis casos incluido el patológico; y **ninguna reincidencia** del patrón "orden de una colección que el backend no ordena" en todo `src/`.
