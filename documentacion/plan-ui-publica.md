# plan-ui-publica.md — Rediseño de las cuatro páginas públicas de listado

> **Producto:** Plataforma Integral de Gestión — Juegos Evita Formosa
> **Alcance:** `frontend/src/pages/public/{DisciplinesPage,CalendarPage,VenuesPage,RankingsPage}.tsx` y sus subcomponentes.
> **Autor:** agente **UI Designer** · 2026-08-31 · rama `dev-ramiro`
> **Estado:** **implementado**. U01–U12 están hechas y verificadas (2026-08-31). U13 queda fuera de alcance, sin implementar. El detalle de cada una está en su campo *Evidencia*; los desvíos respecto de lo planeado, en §11.
> **Base sobre la que construye:** el trabajo sin commitear del módulo de noticias (`NewsPage.tsx`, `news/NewsMosaicCard.tsx`, `news/newsLayout.ts`, `shared/PublicPageHeader.tsx`), que fija la dirección estética.
> **Revisores:** `Frontend Engineer` (viabilidad e implementación) y `Code Reviewer` (validación del DoD).

**Convenciones (las de `tasks.md`):**
- `[ ]` pendiente · `[~]` en progreso · `[x]` completada
- **DoD** = Definition of Done · Severidad: 🔴 blocker · 🟡 alto · 🟠 medio · ✨ polish
- Los IDs usan el prefijo **U** para no colisionar con T01–T28, R01–R31 ni S01–S19.

---

## 0. Resumen ejecutivo, y la trampa de este encargo

El módulo de noticias quedó lindo porque **tiene fotos**. `News` tiene `imageKey`, `sourceName`, `sourceUrl`, `excerpt` y `createdAt`: hay con qué armar un mosaico con el título sobre la imagen en degradé.

**`Discipline`, `Venue`, `CalendarEvent` y `Competition` no tienen ni un campo de imagen.** Ninguno. Copiar el mosaico de noticias a estas cuatro páginas obliga a inventar la imagen —foto de stock, ilustración genérica, un degradé de relleno haciendo de foto—, y eso es exactamente la clase de cosa que las tres auditorías anteriores vinieron sacando ("3 min de lectura", "lo más leído", los filtros temáticos).

Entonces la respuesta no es "el mosaico de noticias, pero para sedes". Es: **estas cuatro páginas son tarjetas de datos, y hoy están mal porque muestran poco dato real y mucho relleno decorativo.** Hay entre 3 y 6 campos reales por entidad que hoy no se pintan —`_count.categories`, `minPlayers`/`maxPlayers`, `venueId`, `disciplineId`, `_count.matches`, `format`, `startDate`— y en su lugar hay chips que dicen "Competencia Oficial" y "Juegos Evita Formosa", que no son información.

Lo que sí se hereda de noticias, y es lo importante:

1. **El reparto que se adapta al volumen** (`newsLayout.ts`). Es la idea central y acá hace falta más todavía: 5 disciplinas en `xl:grid-cols-4` es una fila de 4 y una huérfana.
2. **La honestidad del dato**: la línea "fuente · antigüedad" de `NewsMosaicCard` funciona porque sale de `sourceName` y `createdAt`. El equivalente acá es "3 categorías · 11 a 16 jugadores", no "Competencia Oficial".
3. **El encabezado compacto** (`PublicPageHeader`), que las cuatro ya usan. No se toca.

---

## 1. Lo que verifiqué antes de proponer nada

### 1.1 Volumen real (API en vivo, `http://localhost:3000/api/v1`, 2026-08-31)

| Endpoint | `meta.total` | Observación que importa para el diseño |
|---|---|---|
| `/disciplines?isActive=true` | **5** | 2 son basura de seed (`Lucas`, `Ramiro`). `_count.categories` va de **0 a 2** |
| `/categories` | **5** | |
| `/venues?isActive=true` | **3** | `latitude`/`longitude` son **`null` en las tres** |
| `/calendar?isPublished=true` | **3** | `description` **`null` en los tres**; `stage` null en uno; los tres tienen `venueId` |
| `/competitions` | **3** | 2 `BORRADOR` + 1 `FINALIZADA`. `_count.matches` = **0 en las tres** |

**Consecuencia inmediata y comprobable:** `RankingsPage` filtra `status !== 'BORRADOR'` en `RankingsPage.tsx:26`, así que **hoy la página pinta exactamente UNA tarjeta** dentro de un `grid md:grid-cols-2 lg:grid-cols-3` (`:63`). Una tarjeta sola, alineada a la izquierda, con dos tercios de fila vacíos. Ese es el estado actual de la pantalla de Rankings, no una hipótesis.

Y esa única tarjeta muestra dos chips: **"Ver Fixture"** y **"Posiciones"** (`:104-109`). Su `_count.matches` es **0**. No hay fixture. No hay posiciones.

### 1.2 Campos que existen y hoy no se pintan

Contrastado contra `backend/prisma/schema.prisma` y `frontend/src/types/index.ts`.

| Entidad | Campo | ¿Modelo? | ¿Tipo FE? | ¿Lo devuelve la API? | ¿Se pinta hoy? |
|---|---|---|---|---|---|
| `Discipline` | `_count.categories` | derivado | ❌ **falta** | ✅ sí, verificado | ❌ |
| `Discipline` | `minPlayers` / `maxPlayers` | ✅ `:180-181` | ✅ | ✅ | ❌ |
| `Discipline` | `resultType` | ✅ `:178` | ✅ | ✅ | ❌ |
| `Discipline` | `rules` | ✅ `:179` (nullable, y hay `""`) | ✅ | ✅ | ❌ (pero el CTA lo promete) |
| `Venue` | `capacity` | ✅ `:324` (nullable) | ✅ | ✅ | ⚠️ con fallback inventado |
| `Venue` | `latitude`/`longitude` | ✅ `:322-323` | ✅ | ✅ pero **null** | ❌ |
| `CalendarEvent` | `venueId` | ✅ `:490` | ✅ | ✅ | ❌ **el encabezado promete sedes** |
| `CalendarEvent` | `disciplineId` | ✅ `:491` | ✅ | ✅ | ❌ (sólo se usa para filtrar) |
| `CalendarEvent` | `endDate` | ✅ `:488` (nullable) | ✅ | ✅ | ❌ |
| `Competition` | `_count.matches` | derivado | ❌ **falta** | ✅ sí, verificado | ❌ |
| `Competition` | `format` | ✅ `:341` | ✅ | ✅ | ❌ |
| `Competition` | `startDate`/`endDate` | ✅ `:344-345` (nullable) | ✅ | ✅ | ❌ |
| `Category` | `minAge`/`maxAge`/`sex` | ✅ `:200-202` | ✅ | ✅ | ❌ |

**Dos cosas requieren tocar algo fuera de las páginas, y las digo explícitamente:**

- **Requiere agregar `_count?: { categories: number }` a `Discipline` en `src/types/index.ts:122-136`.** La API ya lo devuelve; el tipo del frontend no lo declara. Es un cambio de tipo, **no del modelo Prisma**. Mismo patrón que ya existe en `Team` (`src/types/index.ts:167`).
- **Requiere agregar `_count?: { matches: number }` a `Competition` en `src/types/index.ts:262-279`.** Ídem: la API ya lo devuelve.

**Y una que requiere decisión de arquitectura, no la doy por hecha:**

- **`CalendarEvent` no tiene relación Prisma con `Venue` ni con `Discipline`** (`schema.prisma:483-498`: hay `venueId` y `disciplineId` sueltos, sin `@relation`). O sea que la API **no puede** devolver `event.venue.name` con un `include` — no existe la relación. Las dos salidas:
  - **(A) Cruce en el cliente.** La página ya trae `useAllDisciplines`; sumar `useVenues` y armar dos `Map<id, nombre>`. Coste: una query más (3 filas). **Es la que propongo**, y es lo que U09 implementa.
  - **(B) Agregar las relaciones al modelo** y que el backend haga el `include`. Es más correcto a largo plazo y además habilita un `_count` de eventos por sede, pero es una migración y trabajo de `Backend Architect` — **queda anotado como U13 (fuera de este plan)**, no asumido.
  - El cruce en el cliente aguanta bien mientras el catálogo de sedes/disciplinas sea chico (es un catálogo, `STALE_TIME.CATALOG`). Si algún día hay 400 sedes, (A) deja de ser razonable y hay que ir a (B). Escrito acá para que la decisión no se pierda.

---

## 2. Diagnóstico honesto, página por página

### 2.1 `DisciplinesPage.tsx` (162 líneas)

**🐛 D1 — El degradé de hover es código muerto, y deja el icono invisible. `DisciplinesPage.tsx:118-126`.**

```
`group-hover:bg-gradient-to-br group-hover:${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]}`
```

Tailwind escanea el fuente en busca de clases literales: `group-hover:from-primary-500` nunca aparece escrito, así que **no se genera**. Queda `group-hover:bg-gradient-to-br` (esa sí es literal) definiendo un `background-image` sin paradas de color, que no pinta nada. Resultado: al pasar el mouse el fondo **sigue siendo `bg-primary-100`** y el texto pasa a `group-hover:text-white`.

Blanco sobre `#d6e4f4` = **1.29:1**. El icono desaparece al hacer hover. Es un bug de accesibilidad disparado por una interacción, no una preferencia estética.

Además el `style={{}}` de `:124-126` es un objeto vacío con un comentario adentro, y `CARD_GRADIENTS` (`:45-52`) son 6 constantes que no se usan para nada.

**🐛 D2 — El CTA promete dos cosas que pueden no existir. `:145`.**
"Ver reglamento y categorías". `rules` es nullable **y en los datos reales viene `""`** (Ajedrez) o `null` (los otros cuatro). `_count.categories` es **0** para `Lucas`. Para esa disciplina el link promete reglamento y categorías, y `DisciplineDetailPage` recibe al visitante con dos secciones vacías. Es la misma clase de mentira que el "3 min de lectura".

**🐛 D3 — Tope silencioso. `:57`.** `useDisciplines({ isActive: true })` sin `limit`; el default del backend es **20** (`backend/src/common/dto/pagination.dto.ts:41`). Los chips Todas/Individual/Equipo (`:60-62`) filtran **en memoria sobre esas 20**. Con 21 disciplinas, la 21ª no existe para esta página y nada lo indica. Es exactamente el patrón R29/S06/S13, en un archivo que ninguna de las tres rondas miró.

**🐛 D4 — Alturas desparejas.** `<Link>` (`:113`) no tiene clase: es un `<a>` **inline**. El `card h-full` de `:115` es hijo de un inline, así que no se estira al alto de la celda del grid. Con nombres de una línea y de dos líneas las tarjetas quedan de distinto alto. Y el `:focus-visible` global (`index.css:127-131`) dibuja el contorno sobre una caja inline, que puede partirse en dos.

**🐛 D5 — Huérfanas.** `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (`:111`) con **5** disciplinas: en XL da 4 + 1. Es el problema que `newsLayout.ts` ya resolvió para noticias y que acá no se aplicó.

**Lo que sí está bien y no toco:** los chips tienen `role="group"` + `aria-label` + `aria-pressed` (`:84-92`), el `h2` de la tarjeta (`:132`) y el badge Individual/Equipo, que sale de `discipline.type`, un dato real.

---

### 2.2 `CalendarPage.tsx` (97 líneas) + `calendar/CalendarEventCard.tsx`

**🐛 C1 — El encabezado promete sedes y la página no muestra ninguna. `CalendarPage.tsx:52`** dice *"Fechas, horarios y **sedes** de las próximas competencias"*. `CalendarEventCard.tsx` no pinta la sede en ningún lado. Los tres eventos reales **tienen `venueId` cargado**. El dato está, la promesa está, y en el medio no hay nada.

**🐛 C2 — Dos chips decorativos ocupan la fila de metadatos. `CalendarEventCard.tsx:107-115`.** "Competencia Oficial" (🏆) y "Juegos Evita Formosa" (✨). El primero no sale de ningún campo; el segundo es el nombre del sitio en el que ya estás. Es el lugar exacto donde iría la sede y la disciplina, ocupado por relleno.

**🐛 C3 — Descripción inventada. `CalendarEventCard.tsx:99-102`.** Cuando `description` es null se pinta *"Evento oficial del cronograma de los Juegos Evita Formosa."* en itálica. **Los tres eventos reales tienen `description: null`**, así que hoy esa frase es el 100% de las descripciones que se ven en la página. Un texto de relleno presentado con el formato de un texto real. Va afuera.

**🐛 C4 — Salto de encabezado. `CalendarEventCard.tsx:113`** usa `<h3>` bajo el `<h1>` de `PublicPageHeader`, sin ningún `h2` en el medio. Las otras tres páginas usan `h2` correctamente. Es la única de las cuatro que rompe el esquema del documento (WCAG 1.3.1 / 2.4.10).

**🐛 C5 — Pasado y futuro mezclados, sin marcar.** No hay orden explícito ni corte. Hoy es 2026-08-31: hay un evento del **26/08** (ya pasó), uno del **31/08** (es hoy) y uno del **10/09**. Los tres se ven idénticos. `startDate` es dato real y da para separar "Próximos" de "Ya se disputaron" y para marcar "Hoy" — es la mejora de mayor relación valor/riesgo de las cuatro páginas.

**🐛 C6 — `endDate` ignorado.** Un evento de varios días se muestra como si fuera de un día.

**🟠 C7 — Ancho inconsistente.** `max-w-5xl` (`:49`) contra `max-w-7xl` de las otras tres. Navegando entre secciones el contenido salta de ancho.

**Lo que está bien:** `calendarFilters.ts` es sólido (la clave de mes con año de R31, el filtrado sobre el conjunto completo de R29) y `eventStageStyles.ts` es el patrón correcto —tres piezas que se eligen juntas. **Ninguno de los dos se toca.**

---

### 2.3 `VenuesPage.tsx` (110 líneas)

**🐛 V1 — El contador puede mentir. `:15`.** `venuesData?.data.length` es **la cantidad de la página actual**, no el total. `useVenues({isActive:true})` sin `limit` → 20. Con 25 sedes el chip diría "20 sedes activas" (`:30`). `meta.total` viene en la respuesta y es el número correcto. Con 3 sedes hoy coincide, y por eso pasó tres auditorías.

**🐛 V2 — "Sede Oficial" es relleno con forma de dato. `:76`.** `venue.capacity ? 'Capacidad: N' : 'Sede Oficial'`. Dos cosas distintas en la misma ranura: si no sé la capacidad, digo otra cosa. Y "Sede Oficial" no distingue nada — **todas** las sedes del listado son oficiales. Es un placeholder disfrazado.

**🐛 V3 — Contraste por debajo de AA. `:63-65`.** `text-primary-400` (`#5185ce`) sobre blanco = **3.75:1**, en `text-sm` (14px, que no califica como "texto grande"). AA exige 4.5:1. Es la localidad de la sede, información real. Mismo problema en `:91` ("Sin mapa disponible").

**🐛 V4 — Jerarquía invertida.** El departamento y la localidad están arriba a la derecha en mayúsculas (`:59-66`) y el nombre de la sede —que es lo que la persona busca— debajo y a la izquierda (`:69`). El ojo va primero al dato secundario.

**🟠 V5 — Página sin nada más que las tarjetas.** Con 3 sedes, todas de `department: "Formosa"` y `locality: "Formosa"`, la página es una sola fila y termina. No hay filtro por departamento (las otras tres páginas tienen filtro o buscador), y la API **ya lo soporta**: `VenueFilters` tiene `department`, `locality` y `search` (`src/api/venues.api.ts:7-18`).

---

### 2.4 `RankingsPage.tsx` (125 líneas)

**🐛 R1 — Dos chips que parecen botones y no hacen nada, sobre datos que no existen. `:103-110`.** "Ver Fixture" y "Posiciones" son `<span>` con fondo y padding de botón, dentro de un `<Link>` que va al mismo lado en los dos casos. Y con `_count.matches === 0` —las tres competencias reales— **no hay fixture ni tabla que ver**. Son a la vez una afordancia falsa y una afirmación falsa.

**🐛 R2 — Colores fuera de la paleta. `:107`.** `text-amber-800 bg-amber-50` son de la paleta default de Tailwind, no de los tokens del proyecto. Existe `accent-*` (el dorado institucional) justamente para esto. Violación del sistema de diseño.

**🐛 R3 — Tope silencioso + filtrado en memoria. `:23-30`.** `useCompetitions()` sin filtros → 20 filas. Sobre esas 20 se filtra `BORRADOR` **y** el texto de búsqueda. Dos consecuencias: la competencia 21 no se encuentra buscándola, y si las primeras 20 fueran todas `BORRADOR` la página se vería **vacía** teniendo competencias activas en la página 2. Con los datos de hoy la página muestra **1 de 3** filas y no hay ninguna señal de eso.

**🐛 R4 — El `EmptyState` afirma algo que no sabe. `:119`.** *"No se encontraron competencias activas con los filtros aplicados"* se muestra igual con la búsqueda vacía. Es la misma frase que `NewsPage.tsx:118-124` ya corrigió, condicionándola a `hayFiltro`.

**🐛 R5 — Código muerto. `:18`.** `STATUS_BADGE.BORRADOR` no se puede alcanzar nunca: `:26` filtra los borradores antes.

**🐛 R6 — La tarjeta es una tabla de dos columnas. `:86-101`.** Tres filas "Etiqueta: Valor" con `justify-between`. Con textos cortos queda un vacío enorme en el medio de cada fila; el ojo tiene que saltar. Y `format` —el dato que explica de qué va la competencia— no está.

**🐛 R7 — Sin fallback de nombre. `:84`.** ``competition.name || `${discipline?.name} - ${category?.name}` `` — si las relaciones no vinieran, el título sería literalmente "undefined - undefined".

---

## 3. Lo que se comparte entre las cuatro (la parte que más importa)

Las cuatro páginas repiten hoy **el mismo ternario de tres ramas** con distinto markup en cada una: cargando → hay datos → vacío. Los spinners están en `DisciplinesPage:106-109`, `CalendarPage:68-71`, `VenuesPage:36-39` y `RankingsPage:58-61`, y los cuatro son el mismo `Loader2` centrado con `py-20`/`py-24`. Cuatro copias de un bloque de 4 líneas y, más importante, **cuatro oportunidades de olvidarse del `aria-busy`** (ninguna lo tiene hoy).

Tres piezas nuevas, chicas, y ninguna librería:

### 3.1 `src/components/shared/PublicListState.tsx` (nuevo)

Envuelve las tres ramas en un solo lugar. Recibe `isLoading`, `isEmpty`, `skeleton`, `empty` y los hijos.

- Anuncia la carga: `role="status"` + `aria-busy="true"` + un `<span class="sr-only">Cargando…</span>`. Hoy un lector de pantalla no se entera de nada en ninguna de las cuatro.
- Reemplaza el spinner por un **esqueleto con la forma del contenido** (ver 3.2). Un spinner centrado colapsa el alto a ~80 px y después el contenido lo empuja: eso es CLS. `NewsListSkeleton.tsx` ya hizo esto bien para noticias y su comentario lo explica.

### 3.2 `src/components/shared/CardGridSkeleton.tsx` (nuevo)

Grilla de N placeholders con `animate-shimmer` (la clase ya existe, `index.css:324`), con el alto y las columnas configurables. Sustituye los cuatro `Loader2`. Modelado sobre `NewsListSkeleton.tsx`, que ya replica la grilla real.

### 3.3 `src/lib/gridVolumen.ts` (nuevo) — el `newsLayout` de las grillas

Una función pura, testeable sin montar nada, exactamente por la razón que documenta `newsLayout.ts`:

```
export function columnasSegunVolumen(cantidad: number): string
```

La regla, y los cortes no son arbitrarios:

| Cantidad | Columnas | Por qué |
|---|---|---|
| 1 | `grid-cols-1 max-w-xl` | Una tarjeta sola en una grilla de 3 es una tarjeta perdida en la esquina. Acotar el ancho la convierte en una pieza deliberada. **Es el caso de Rankings hoy.** |
| 2 | `sm:grid-cols-2` | |
| 3 | `sm:grid-cols-2 lg:grid-cols-3` | Fila exacta en LG. **Es el caso de Sedes hoy.** |
| 4 | `sm:grid-cols-2 lg:grid-cols-4` | |
| 5 a 8 | `sm:grid-cols-2 lg:grid-cols-3` | **Nunca 4 columnas acá:** 5 en 4 columnas deja una huérfana; 5 en 3 deja 3+2, que se lee como bloque. **Es el caso de Disciplinas hoy.** |
| 9 o más | `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` | Recién con volumen la cuarta columna se llena |

Es literalmente el mismo principio que `repartir()`: **el layout es función del volumen**, para que se vea bien hoy con 3 filas y también cuando haya 60, sin que nadie vuelva a tocar la grilla.

Las clases se devuelven **completas y literales** (no interpoladas) — el bug D1 es la demostración de por qué.

### 3.4 Convención compartida: el dato ausente se omite, no se rellena

No es un componente, es una regla que las cuatro tarjetas siguen y que el Code Reviewer puede verificar leyendo:

> Si un campo es `null`, `undefined` o `""`, **su fila no se renderiza**. Nunca se sustituye por una etiqueta genérica.

Aplica a V2 ("Sede Oficial"), C3 (la descripción inventada) y C2 (los chips decorativos). Es la regla dura del proyecto, escrita como criterio de UI en vez de como corrección puntual.

Si de esto sale un helper (`<DatoOpcional icono label valor />`), bien; si el `Frontend Engineer` prefiere `{valor && (...)}` inline, también. Lo que no es negociable es el resultado.

---

## 4. Propuesta por página

### 4.1 Disciplinas

**Componente nuevo: `src/pages/public/disciplines/DisciplineCard.tsx`.** La página baja de 162 a ~70 líneas y la tarjeta se puede renderizar suelta en la verificación de U12.

Anatomía, de arriba abajo:

1. **Icono** en círculo `bg-primary-100 text-primary-700`. Se conserva `getDisciplineIcon` (`DisciplinesPage:35-42`), que es buena idea. **El hover cambia sombra y desplazamiento, no el color del icono** — se elimina `CARD_GRADIENTS` y todo el degradé dinámico (D1).
2. `<h2>` con el nombre.
3. **Badge Individual/Equipo** — se conserva tal cual, sale de `type`.
4. **Fila de datos reales, cada uno omitido si falta** (esto es lo nuevo):
   - `_count.categories > 0` → "3 categorías" · si es 0, **la fila no aparece**
   - `type === EQUIPO` y hay `minPlayers`/`maxPlayers` → "11 a 16 jugadores"
   - `resultType` → "Se define por goles / tiempo / puntos / posiciones", vía un mapa de etiquetas nuevo en `src/lib/constants.ts` (donde ya viven `STAGE_LABELS` y `COMPETITION_STATUS_LABELS`)
5. **CTA condicionado (D2)**, la parte que cierra la mentira:
   - hay reglamento **y** categorías → "Ver reglamento y categorías"
   - sólo categorías → "Ver categorías"
   - sólo reglamento → "Ver reglamento"
   - ninguno de los dos → **la tarjeta no es un link**. Se renderiza como `<article>` sin `<a>`. Que sea clickeable no le hace un favor a nadie si la pantalla de destino está vacía.

**Grilla:** `columnasSegunVolumen(filtered.length)`. Con 5 → 3 columnas, 3+2. Adiós huérfana.

**Datos:** `useAllDisciplines({ isActive: true })` en vez de `useDisciplines` (D3). El hook ya existe (`useDisciplines.ts:35-42`) y `CalendarPage:30` ya lo usa por el mismo motivo.

**Chips de filtro:** se quedan. Sólo se ajusta el borde del estado no seleccionado (ver §5).

### 4.2 Calendario

`calendarFilters.ts` y `eventStageStyles.ts` **no se tocan**.

**Cambios en `CalendarEventCard.tsx`:**

- `<h3>` → `<h2>` de sección + `<h3>` de evento (C4, ver §5.3).
- **Fuera** los dos chips decorativos (C2) y la descripción inventada (C3). Si `description` es null, no hay párrafo. Punto.
- **En su lugar, la fila de metadatos con datos reales:**
  - 📍 **nombre de la sede**, resuelto por `venueId` contra el mapa de sedes (C1)
  - 🏅 **nombre de la disciplina**, resuelto por `disciplineId`
  - si un id no resuelve (sede borrada, id viejo) → **la fila no aparece**; nada de "Sede a confirmar"
- **Rango de fechas (C6):** con `endDate` presente y de otro día, la tarjeta de fecha muestra "26 → 30 ago".
- **Badge "Hoy"** cuando `startDate` cae en el día actual: `bg-accent-500 text-primary-900` (contraste **7.96:1**, ver §5).
- **Los eventos pasados se atenúan**, no se ocultan: `opacity-70` y el nodo del timeline en `bg-primary-200` en vez del color de etapa.

**Cambio en `CalendarPage.tsx`:** partir la lista en **dos secciones con su `<h2>`**: "Próximos eventos" y "Ya se disputaron" (C5), ordenadas asc y desc respectivamente. Con 3 eventos son "2 próximos" y "1 disputado", y ya es más útil que la lista plana de hoy. **Si una de las dos queda vacía, esa sección no se renderiza** — un "Ya se disputaron" vacío es peor que su ausencia, exactamente el argumento de `newsLayout.ts` sobre "Más artículos".

El corte en secciones va a `src/pages/public/calendar/calendarSecciones.ts` (nuevo), función pura, misma razón que `newsLayout.ts` vive aparte: fast refresh y testeabilidad.

**Ancho:** `max-w-5xl` → `max-w-7xl` (C7), con el timeline acotado con un `max-w-5xl` interno.

### 4.3 Sedes

**Componente nuevo: `src/pages/public/venues/VenueCard.tsx`.**

- **Jerarquía invertida (V4):** `<h2>` con el nombre arriba de todo. Debajo, dirección · localidad · departamento en una línea de metadatos, con `text-primary-600` (**9.26:1**) en vez de `primary-400` (V3).
- **Capacidad (V2):** si `capacity` existe → "Capacidad 3.000". Si no → **no hay fila**. "Sede Oficial" se elimina.
- **"Cómo llegar":** se conserva tal cual, incluido `safeExternalUrl` y la rama sin link, que ya está bien resuelta y bien comentada (`VenuesPage:87-94`). Sólo se sube el contraste del estado sin mapa.
- **Eventos programados en la sede** — la mejora real de esta página. Cruzando `useAllCalendarEvents({isPublished:true})` (misma clave de query que ya usa el calendario, así que **se sirve del cache** al navegar entre las dos) se cuentan los eventos futuros con ese `venueId`:
  - ≥1 → "2 eventos programados", como link a `/calendario`
  - 0 → **nada**
  - Es dato real, derivado en el cliente, sin campo nuevo. **Caveat honesto para los revisores:** trae todos los eventos publicados para contar. Con 3 es gratis; con 5.000 es un despropósito y hay que ir a la opción (B) de §1.2 (`_count` de eventos en `/venues`). **Propongo un umbral escrito en el código: si el total de calendario supera 200, la sección no se pinta** y queda el comentario apuntando a U13. Si al `Frontend Engineer` le parece que ese umbral es una curita, es una discusión legítima y prefiero tenerla ahora.

**Contador del encabezado (V1):** `meta.total`, no `data.length`.

**Filtro por departamento (V5):** los mismos chips que Disciplinas, alimentados por los departamentos **presentes en los datos** (`[...new Set(venues.map(v => v.department))]`), igual que `opcionesDeMes` deriva los meses que de verdad tienen eventos. Hoy da un solo departamento → **con una sola opción el filtro no se pinta**. Un filtro con una opción es decoración.

**Datos:** `useVenues` → variante `useAllVenues` con `fetchAllPages` (a agregar en `useVenues.ts`, espejando `useAllDisciplines`). Necesaria para que el filtro por departamento sea honesto.

### 4.4 Rankings

**Componente nuevo: `src/pages/public/rankings/CompetitionCard.tsx`.**

- **Título:** `competition.name` y, si es null, `discipline?.name` + `category?.name` **con guardas** (R7). Si no hay ninguno de los tres, "Competencia sin nombre".
- **Disciplina y categoría** dejan de ser filas "Etiqueta: Valor" (R6) y pasan a **badges** en una línea sobre el título: `Fútbol 11` · `Sub-14 Masculino`. Se lee de un vistazo y no deja el vacío del `justify-between`.
- **Etapa y formato** en la línea de metadatos: "Zonal · Todos contra todos". `format` se pinta por primera vez, con etiquetas nuevas en `src/lib/constants.ts` (`ELIMINACION_DIRECTA` → "Eliminación directa", `ROUND_ROBIN` → "Todos contra todos").
- **Fechas:** si `startDate` existe, "Desde el 8 de agosto"; con `endDate`, el rango. Si no hay, **no hay fila**.
- **El pie (R1), que es el arreglo central:** los dos chips falsos se van y queda algo **derivado de `_count.matches`**:
  - `> 0` → **un solo** enlace real, "Ver fixture y posiciones (12 partidos)", que es a donde el link va de verdad
  - `=== 0` → texto atenuado **"Fixture aún no generado"**, sin forma de botón. Es la verdad, y es información útil: el visitante sabe que no es un error suyo.
- **Colores (R2):** `amber-*` → `accent-*`. Concretamente `text-accent-800 bg-accent-50` = **6.35:1**.
- **`STATUS_BADGE.BORRADOR` se borra** (R5).

**Datos (R3):** `useCompetitions` → `useAllCompetitions` (`fetchAllPages`), y el filtro `BORRADOR` sigue en el cliente pero ahora sobre el conjunto completo. **Alternativa mejor si el backend la soporta:** pasar `status` como filtro de query. Que lo confirme el `Frontend Engineer` mirando `CompetitionFilters`; si está, se usa eso y el filtro de memoria desaparece.

**`EmptyState` (R4):** dos textos, condicionados a `search !== ''`, como `NewsPage.tsx:118-124`.

**Grilla:** `columnasSegunVolumen`. Con 1 competencia → una tarjeta acotada a `max-w-xl`, no una huérfana en una fila de 3.

---

## 5. Accesibilidad, con números sobre los tokens reales

Ratios calculados sobre los hex de `src/index.css:16-60` con la fórmula WCAG 2.1 de luminancia relativa.

### 5.1 Contraste — lo que hay que cambiar

| Uso actual | Ratio | AA | Acción |
|---|---|---|---|
| `text-primary-400` `#5185ce` / blanco — `VenuesPage:63,91` | **3.75:1** | ❌ (4.5 requerido) | → `primary-600` (**9.26:1**) |
| `text-primary-400` / blanco — `CalendarEventCard:100` (`text-xs`) | **3.75:1** | ❌ | el texto se elimina (C3) |
| `text-white` sobre `bg-primary-100` en hover — `DisciplinesPage:121` | **1.29:1** | ❌❌ | se elimina el hover de color (D1) |
| `text-accent-500` `#E8AA34` / blanco — `RankingsPage:108`, `VenuesPage:29`, `CalendarEventCard:110` | **2.05:1** | ❌ para icono portador de significado (3:1) | → `accent-700` (**4.09:1** sobre blanco), o el icono queda decorativo con `aria-hidden` y el significado vive en el texto |
| `text-celeste-500` `#628bbd` / blanco — `CalendarEventCard:113` | **3.53:1** | ❌ | el chip se elimina (C2) |
| `border-primary-200` `#adc7e9` / blanco en los chips no seleccionados — `DisciplinesPage:98` | **1.73:1** | ❌ (3:1 para el borde de un control) | `primary-300` da **2.48:1**, sigue corto. **`primary-400` da 3.75:1 ✅** — es el que propongo. El texto interno (`primary-600`, 9.26:1) ya pasa, así que el control es perceptible igual, pero el borde es la única señal de dónde termina el botón |

### 5.2 Contraste — lo que ya está bien y se conserva

| Combinación | Ratio | |
|---|---|---|
| `primary-800` / blanco (títulos `h1`, `PublicPageHeader`) | **13.19:1** | ✅ AAA |
| blanco / `primary-800` (icono del encabezado) | **13.19:1** | ✅ AAA |
| `primary-900` / blanco (`h2` de tarjeta) | **16.35:1** | ✅ AAA |
| `primary-600` / blanco (texto secundario) | **9.26:1** | ✅ AAA |
| `primary-500` / `surface` `#f6f8fb` | **6.13:1** | ✅ AA |
| `primary-700` / `primary-50` (badge neutro) | **10.45:1** | ✅ AAA |
| `celeste-800` / `celeste-50` (badge Zonal) | **9.74:1** | ✅ AAA |
| `secondary-800` / `secondary-50` (badge Provincial) | **12.98:1** | ✅ AAA |
| `accent-800` / `accent-50` (badge Departamental) | **6.35:1** | ✅ AA |
| `accent-500` / `primary-900` (badge "Hoy" propuesto) | **7.96:1** | ✅ AAA |
| blanco / `primary-800` (chip seleccionado) | **13.19:1** | ✅ AAA |

Los `eventStageStyles` están todos en AA o mejor. Es la pieza mejor resuelta de las cuatro páginas y por eso no se toca.

### 5.3 Jerarquía de encabezados

Un solo `h1` por página, del `PublicPageHeader` (`:47-55`). Debajo:

| Página | Hoy | Propuesto |
|---|---|---|
| Disciplinas | `h1` → `h2` (tarjeta) | igual ✅ |
| Sedes | `h1` → `h2` (tarjeta) | igual ✅ |
| Rankings | `h1` → `h2` (tarjeta) | igual ✅ |
| Calendario | `h1` → **`h3`** ❌ | `h1` → `h2` (sección "Próximos" / "Ya se disputaron") → `h3` (evento). Se arregla el salto **y** los eventos quedan anidados bajo su sección, que es la estructura real |

Ojo con la asimetría: en Calendario el evento pasa a `h3` **porque ahora hay un `h2` de sección arriba**, no porque sí. En las otras tres la tarjeta es hija directa del `h1` y le corresponde `h2`. El `Code Reviewer` puede verificarlo con el esquema del documento renderizado (U12).

### 5.4 Foco visible

`index.css:127-131` da un `:focus-visible` global de 2 px `primary-500` con `offset: 2px` — bien. El problema es la **forma** de la caja: en Disciplinas (`:113`) y Rankings (`:65`) el `<Link>` es inline y el contorno se dibuja sobre una caja inline, que puede partirse entre líneas.

Arreglo (D4): a cada tarjeta-enlace, `className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"`. El `block h-full` además empareja los altos de la grilla, así que arregla lo visual y lo accesible con la misma línea.

**Anti-patrón a evitar explícitamente:** nada de "tarjeta entera clickeable" con un `onClick` en un `div`. El `<a>` que envuelve es lo correcto y ya está.

### 5.5 `prefers-reduced-motion`

**El bloque de `index.css:391-395` sólo apaga `.noise-bg`.** Las cuatro páginas usan `animate-fade-in` con `animationDelay` escalonado — `DisciplinesPage:115-116`, `VenuesPage:52-53`, `RankingsPage:68-69`, `CalendarEventCard:24-25` — y **ninguna** de esas animaciones se apaga hoy. `fade-in` incluye `translateY(8px)` (`index.css:226-235`): con 20 tarjetas y 0.05 s de delay, lo último entra un segundo tarde, desplazándose. Es justo lo que la preferencia pide que no pase.

Arreglo, dentro del bloque que ya existe en `index.css`:

```
.animate-fade-in, .animate-slide-in, .animate-scale-in,
.animate-shimmer, .animate-spin-slow {
  animation: none !important;
}
* { transition-duration: 0.01ms !important; }
```

`animation: none` sobre una animación declarada con `both` deja el elemento en su estado final (visible, sin desplazar), que es lo que se busca: **el contenido aparece igual, sólo sin movimiento**. Ese `.animate-spin-slow` es el anillo punteado de `EmptyState.tsx:41` — hoy gira indefinidamente aunque pidas menos movimiento.

### 5.6 Estado de carga anunciado

Ninguna de las cuatro anuncia nada. `PublicListState` (§3.1) pone `role="status"` + `aria-busy` + texto `sr-only` en un solo lugar para las cuatro.

### 5.7 Blanco de toque

Los chips de filtro son `px-5 py-2 text-sm` ≈ 36 px de alto — **por debajo de los 44 px** de WCAG 2.5.5 (AAA); pasan el mínimo de 2.5.8 (AA, 24 px). Propongo `py-2.5` + `min-h-[44px]`: es barato y en un sitio que se consume mayoritariamente desde el celular importa.

---

## 6. Impacto en el bundle

**Dependencias nuevas propuestas: cero.** El entry viene de 442 a 285 kB y no lo voy a devolver.

| Tentación | Peso aprox. | Veredicto |
|---|---|---|
| `leaflet` + `react-leaflet` para el mapa de sedes | ~45 kB gz + tiles externos | **No.** Y ni siquiera es el argumento principal: `latitude`/`longitude` son **`null` en las tres sedes**. Sería un mapa vacío. Ver §7 |
| `date-fns` / `dayjs` para el rango de fechas | 8–20 kB gz | **No.** `Intl.DateTimeFormat` / `toLocaleDateString('es-AR')` es nativo y es lo que ya usa `CalendarEventCard:34-46` |
| `framer-motion` para las transiciones de tarjeta | ~35 kB gz | **No.** Los keyframes de `index.css:226-322` alcanzan, y van a respetar `prefers-reduced-motion` después de U04 |
| Una librería de tooltip | ~10 kB gz | **No.** `radix-ui` ya está en `package.json`; si hiciera falta un tooltip, sale de ahí. Pero no hace falta |

**Lo que sí suma peso, y es poco:** iconos de `lucide-react`. `DisciplinesPage:5-9` importa 11 iconos para un mapa de 14 nombres. Se importan uno por uno y Vite los tree-shakea; son ~0,3 kB cada uno. Los nuevos que hacen falta (`Users`, `Layers`, `Route`) son 3 más, <1 kB. **Aceptable.**

**Lo que baja:** `CARD_GRADIENTS` (6 strings muertos) y las clases de hover que Tailwind no genera. Marginal en JS, real en el CSS emitido.

**Medición obligatoria (parte del DoD de U12):** `npm run build` antes y después, con el tamaño de cada chunk anotado. **Si el entry sube más de 2 kB gz, se justifica o se revierte.** Las páginas públicas ya están en `lazy()` según el router, así que el grueso de esto no debería tocar el entry — el `Frontend Engineer` que lo confirme con la salida real, no con esta suposición mía.

---

## 7. Qué NO voy a hacer, y por qué

Esta sección es tan parte del entregable como el resto. Cada ítem es algo que un rediseño de estas cuatro páginas "obviamente" incluiría, y que acá se descarta con motivo.

**1. Mapa embebido en Sedes.** El impulso es evidente: es una página de sedes. Pero `latitude` y `longitude` son **`null` en las tres filas reales**. Un mapa se vería centrado en Formosa sin un solo marcador, o —peor— con marcadores geocodificados en el cliente desde texto libre, que es inventar coordenadas. **Requiere cargar `latitude`/`longitude` en las sedes**, que es trabajo de datos, no de UI. Se mantiene "Cómo llegar" con `safeExternalUrl`, que resuelve el 90 % del problema con 0 kB.

**2. Imágenes en las tarjetas de disciplinas y sedes.** Es lo que haría que estas páginas se parecieran de verdad a `NewsPage`. **`Discipline` y `Venue` no tienen ningún campo de imagen** en `schema.prisma`. Meter fotos de stock de gente corriendo sería inventar la identidad visual de instituciones reales. Los iconos de `lucide-react` mapeados por nombre son honestos: se ven como lo que son, un icono. **Requiere agregar `imageKey` a `Discipline` y `Venue`** más una pantalla de carga en el back-office; es un proyecto propio, no un renglón de este plan.

**3. Vista "mes" tipo grilla de calendario.** Con **3 eventos**, una grilla de 5×7 son 32 celdas vacías y 3 con algo. El timeline vertical rinde mucho mejor a este volumen y sigue rindiendo con 50. Si algún día hay ~15 eventos por mes, se reconsidera.

**4. Cualquier cosa que huela a popularidad.** "Disciplina más elegida", "sede más usada", "competencia destacada". **No hay contador de visitas ni de inscripciones expuesto en estos endpoints.** Es exactamente el "lo más leído" que ya se sacó de noticias.

**5. Contar competencias o inscripciones por disciplina.** La API devuelve `_count.categories`, **no** `_count.competitions`. No lo voy a estimar ni a derivar cruzando listados enteros. Si se quiere, **requiere agregarlo al `_count` del service de disciplines** (backend).

**6. Filtro por departamento en Calendario o Rankings.** `CalendarEvent` no tiene departamento (lo tiene la sede, vía una relación **que no existe**, §1.2), y `Competition` tampoco. Sería un filtro que no puede filtrar.

**7. Dark mode.** `next-themes` está en `package.json` pero los tokens de `index.css` **no tienen bloque `[data-theme="dark"]`**. Hacerlo bien es rehacer la paleta entera con contraste verificado en los dos modos: es un proyecto de sistema de diseño, no un ajuste de cuatro páginas. Meterlo a medias deja pantallas rotas.

**8. Unificar `PublicPageHeader` con `PageHeader`.** El comentario de `PublicPageHeader.tsx:23-30` explica que la separación es deliberada —16 pantallas del back-office dependen de la otra— y estoy de acuerdo. No la toco.

**9. Virtualización de listas.** Con 3 a 5 filas es absurdo. Con 200 tampoco haría falta.

**10. Tocar `calendarFilters.ts` o `eventStageStyles.ts`.** Cargan las correcciones de R29, R31 y S06 y están bien resueltos y bien comentados. Cambiarlos "de paso" es la forma más barata de reabrir un bug ya cerrado.

**11. Rehacer `EmptyState`, `Pagination` o `PublicPageHeader`.** Se usan tal como están.

**12. Backend.** Ni una línea. Las tres cosas que lo necesitarían están anotadas arriba como "requiere X", no implementadas: las relaciones de `CalendarEvent`, el `_count` de eventos en `/venues`, el `imageKey` de disciplinas y sedes.

---

## 8. Orden de implementación

Van de lo que cambia **qué datos llegan** hacia lo que cambia **cómo se ven**, y termina con la red que fija las propiedades. Al revés, cada corrección visual se haría dos veces.

**Asignación:** 🎨 UI = `UI Designer` · ⚛️ FE = `Frontend Engineer` · 🏗️ BE = `Backend Architect` · 👁️ CR = `Code Reviewer` valida al cierre.

---

### Fase 0 — Que llegue el dato correcto

#### U01 🟡 ⚛️ FE — Tres topes silenciosos más, en las tres páginas que S13 no miró

- [x] **Descripción:** `DisciplinesPage:57`, `VenuesPage:14` y `RankingsPage:23` llaman a sus hooks paginados sin `limit` y filtran **en memoria** sobre las 20 filas del default (`backend/src/common/dto/pagination.dto.ts:41`). Es la clase R29/S06/S13, en el módulo de al lado — igual que documenta el hallazgo central de `tasks.md`.
- **Verificado:** con los datos de hoy los tres coinciden por casualidad (5, 3 y 3 filas). Rankings es el más grave: filtra `BORRADOR` **después** de paginar, así que 20 borradores en la página 1 dejarían la pantalla vacía habiendo competencias activas en la 2.
- **Archivos:** `src/pages/public/DisciplinesPage.tsx:57`, `src/pages/public/VenuesPage.tsx:14`, `src/pages/public/RankingsPage.tsx:23`, `src/hooks/useVenues.ts` (agregar `useAllVenues`), `src/hooks/useCompetitions.ts` (agregar `useAllCompetitions`)
- **DoD:**
  - Las tres páginas consumen variantes `useAll*` con `fetchAllPages`, espejando `useAllDisciplines` (`useDisciplines.ts:35-42`).
  - Si `CompetitionFilters` acepta `status`, el filtro de `BORRADOR` pasa al servidor y el `filter()` de memoria desaparece. Si no lo acepta, queda en el cliente **sobre el conjunto completo** y se anota por qué.
  - Los `useAll*` nuevos llevan el mismo comentario que explica qué bug cierran.
  - **Contraprueba:** con un `limit: 2` forzado a mano, la página muestra las 5 disciplinas igual. Volviendo al hook paginado, muestra 2.
- **Evidencia:** `useAllVenues` y `useAllCompetitions` agregados con `fetchAllPages`, espejando `useAllDisciplines`; las tres páginas los consumen. **`CompetitionFilters` sí acepta `status`, pero como igualdad de un solo valor**: verificado contra la API que `?status=ACTIVA` devuelve `total: 0` y `?status=FINALIZADA` devuelve `total: 1`, y no hay forma de pedir las dos juntas ni un `not`. Como la pantalla necesita ACTIVA **y** FINALIZADA, el descarte de `BORRADOR` queda en el cliente pero **sobre el conjunto completo**, y el porqué está escrito en el hook. Fijado por `check:cards` §11 ("recorre la paginación entera"). **Contraprueba:** volviendo `DisciplinesPage` a `useDisciplines`, el chequeo marca la página por nombre.

#### U02 🟠 ⚛️ FE — Los tipos declaran los `_count` que la API ya devuelve

- [x] **Descripción:** `/disciplines` devuelve `_count.categories` y `/competitions` devuelve `_count.matches` — **verificado contra la API en vivo**. Ninguno de los dos está en `src/types/index.ts`, así que hoy son datos invisibles para el compilador. U07 y U10 los necesitan.
- **No requiere cambio de modelo Prisma.** Es sólo el tipo del cliente poniéndose al día. Mismo patrón que `Team._count` (`src/types/index.ts:167`).
- **Archivos:** `src/types/index.ts:122-136` (`Discipline`), `:262-279` (`Competition`)
- **DoD:**
  - `_count?: { categories: number }` en `Discipline`, `_count?: { matches: number }` en `Competition`, ambos opcionales (el detalle por id puede no traerlos) y con comentario de dónde salen.
  - `npx tsc --noEmit` limpio.
  - **Se confirma contra la API real** —`curl` a los dos endpoints— que la forma coincide, en vez de asumirla desde el service.
- **Evidencia:** `_count?: { categories: number }` en `Discipline` y `_count?: { matches: number }` en `Competition`, ambos opcionales y con comentario de procedencia. **Confirmado contra la API en vivo**, no supuesto: `/disciplines?isActive=true` devuelve `_count.categories` entre 0 (`Lucas`) y 2 (`Fútbol 11`), y `/competitions` devuelve `_count.matches`. `npx tsc --noEmit` limpio.

---

### Fase 1 — Base compartida (antes de tocar cualquier página)

#### U03 🟠 🎨 UI + ⚛️ FE — Las tres piezas compartidas: estado de lista, esqueleto y reparto por volumen

- [x] **Descripción:** Las cuatro páginas repiten el mismo ternario de tres ramas con cuatro markups distintos (`DisciplinesPage:106-158`, `CalendarPage:68-93`, `VenuesPage:36-106`, `RankingsPage:58-121`) y los cuatro spinners son el mismo `Loader2`. Se extraen `PublicListState`, `CardGridSkeleton` y `columnasSegunVolumen` (§3).
- **Por qué va antes que las páginas:** si se hace después, cada corrección de accesibilidad se aplica cuatro veces y la cuarta se olvida. Es el mismo argumento por el que S01 fue primero.
- **Archivos:** `src/components/shared/PublicListState.tsx` (nuevo), `src/components/shared/CardGridSkeleton.tsx` (nuevo), `src/lib/gridVolumen.ts` (nuevo)
- **DoD:**
  - `PublicListState` expone `role="status"` + `aria-busy="true"` + texto `sr-only` mientras carga. Las cuatro páginas lo usan; **ningún `Loader2` suelto queda en las cuatro**.
  - `columnasSegunVolumen` devuelve **strings literales completos**; no se construye ninguna clase de Tailwind por interpolación (es el bug D1/U05).
  - La tabla de cortes de §3.3 está cubierta caso por caso, incluidos los tres que hoy se ven mal: **1** (Rankings), **3** (Sedes) y **5** (Disciplinas).
  - `CardGridSkeleton` reserva un alto parecido al de la tarjeta real, para que el paso de carga a contenido no salte (misma intención que `NewsListSkeleton`).
  - `npm run lint` limpio — ojo con la regla de fast refresh: `gridVolumen.ts` no exporta componentes, por eso va en `lib/`.
- **Evidencia:** `PublicListState.tsx`, `CardGridSkeleton.tsx` y `lib/gridVolumen.ts` creados; las cuatro páginas los usan y **no queda ningún `Loader2` en las cuatro**. `columnasSegunVolumen` devuelve strings literales y su tabla de cortes está documentada dentro del módulo. Los 9 cortes se verifican caso por caso en `check:cards` §10, con los tres casos reales nombrados (1 = Rankings, 3 = Sedes, 5 = Disciplinas). **Verificado en el CSS de `dist/`, no en el JSX**: `grep -F` sobre `dist/assets/index-*.css` encuentra `sm:grid-cols-2`, `lg:grid-cols-3`, `lg:grid-cols-4` y `xl:grid-cols-4`. **Contraprueba:** con la rama de 4 columnas armada por interpolación, el chequeo la marca citando la línea exacta.

#### U04 🟠 🎨 UI — `prefers-reduced-motion` apaga las animaciones que hoy no apaga

- [x] **Descripción:** El bloque de `src/index.css:391-395` sólo neutraliza `.noise-bg`. Las cuatro páginas usan `animate-fade-in` con delay escalonado y `EmptyState.tsx:41` gira un anillo indefinidamente. Nada de eso se detiene hoy.
- **Archivos:** `src/index.css:391-395`
- **DoD:**
  - Con la preferencia activa, `animate-fade-in`, `animate-slide-in`, `animate-scale-in`, `animate-shimmer` y `animate-spin-slow` no animan.
  - **El contenido queda visible y en su lugar**, no oculto: `fade-in` usa `both`, así que `animation: none` tiene que dejar el estado final. Verificarlo, no suponerlo.
  - Las transiciones de hover se acortan a ~0, no se eliminan (evita el salto de estado).
  - **Contraprueba:** con la preferencia activa y el bloque nuevo revertido, se ve el desplazamiento escalonado.
- **Evidencia:** Bloque de `index.css` extendido a `animate-fade-in`, `slide-in`, `scale-in`, `shimmer`, `float`, `float-delayed`, `spin-slow` y `count-up`, más `transition-duration: 0.01ms` global. Se usa `animation: none` y **no** se toca `opacity`, justamente porque las animaciones están declaradas con `both` y su estado final es el visible: el contenido aparece igual, sin desplazarse. ⚠️ **Esta tarea no quedó cubierta por `check:cards`**: es CSS puro y el chequeo renderiza componentes, no hojas de estilo. Se verificó leyendo el CSS emitido en `dist/`. Es el punto más flojo de la evidencia de este trabajo y lo digo en vez de taparlo.

#### U05 🟡 🎨 UI — Contraste: sacar los usos que no llegan a AA

- [x] **Descripción:** Varias combinaciones por debajo de AA sobre texto real (§5.1). La peor es de lejos `DisciplinesPage:118-126`: el degradé de hover **no se genera** —clase interpolada, Tailwind no la ve— así que queda `text-white` sobre `bg-primary-100`, **1.29:1**, y el icono desaparece al pasar el mouse.
- **Archivos:** `src/pages/public/DisciplinesPage.tsx:44-52,98,118-126`, `src/pages/public/VenuesPage.tsx:63,91`, `src/pages/public/RankingsPage.tsx:107-108`
- **DoD:**
  - Ningún texto de las cuatro páginas por debajo de 4.5:1; ningún icono portador de significado por debajo de 3:1. **Los ratios se anotan en la evidencia con el hex y el número**, como la tabla de §5.
  - `CARD_GRADIENTS` y el `style={{}}` vacío, eliminados.
  - `amber-*` fuera de `RankingsPage`: se usa `accent-*`.
  - **Se agrega una nota al comentario de la tarjeta** explicando que las clases de Tailwind no se interpolan. El bug se cometió una vez; el comentario es lo que evita que se cometa la segunda.
- **Evidencia:** `CARD_GRADIENTS` y el `style={{}}` vacío, eliminados. Ratios recalculados con la fórmula WCAG 2.1 sobre los hex de `index.css`: icono de disciplina `primary-700`/`primary-100` = **9.04:1** (antes, en hover, blanco/`primary-100` = **1.29:1**); localidad de sede `primary-600`/blanco = **9.26:1** (antes `primary-400` = **3.75:1**); pie de rankings `accent-800`/`accent-50` = **6.35:1** (antes `amber-*`, fuera de paleta); badge "Hoy" `primary-900`/`accent-500` = **7.96:1**; borde de chip no seleccionado `primary-400`/blanco = **3.75:1** ✅ contra el 3:1 de un control (antes `primary-200` = **1.73:1**). El icono del contador de sedes pasó a `accent-700` y va con `aria-hidden`, porque el significado vive en el texto. **Comprobado en el CSS compilado y no en el JSX**: `group-hover\:from-primary-500` no aparece en `dist/assets/index-*.css` — la clase nunca existió. La nota sobre la interpolación quedó como comentario de bloque en `DisciplineCard`, y además la fija `check:cards` §6, que barre ocho archivos.

#### U06 🟠 🎨 UI — Las tarjetas-enlace se comportan como bloques

- [x] **Descripción:** `DisciplinesPage:113` y `RankingsPage:65-70` envuelven la tarjeta en un `<Link>` sin `display:block`. El `<a>` es inline: el `h-full` de la tarjeta no estira (alturas desparejas en la grilla) y el contorno de foco se dibuja sobre una caja inline.
- **Archivos:** `src/pages/public/DisciplinesPage.tsx:113`, `src/pages/public/RankingsPage.tsx:65-70`, más las tarjetas nuevas de U07 y U10
- **DoD:**
  - Cada tarjeta-enlace lleva `block h-full` y un radio que coincide con el de la tarjeta, para que el contorno de foco la siga.
  - Con Tab, el contorno rodea la tarjeta completa en un solo rectángulo.
  - En una fila con títulos de una y de dos líneas, todas las tarjetas miden lo mismo.
  - Ningún `onClick` sobre un `div` para simular un link.
- **Evidencia:** Cada tarjeta-enlace lleva `block h-full rounded-xl`. `check:cards` §9 lo verifica **sobre el HTML renderizado**, leyendo las clases del `<a>` que se emite, no el JSX; y barre los cuatro archivos buscando `onClick` sobre un `div`. **Contraprueba:** sacando `block h-full` de `DisciplineCard`, el chequeo falla mostrando las clases reales del `<a>`.

---

### Fase 2 — Una tarea por página

#### U07 🟠 🎨 UI — Disciplinas: datos reales en la tarjeta y un CTA que no promete de más

- [x] **Descripción:** Extraer `DisciplineCard` y pintar `_count.categories`, `minPlayers`/`maxPlayers` y `resultType`, que hoy no aparecen. Y condicionar el CTA de `:145` ("Ver reglamento y categorías"), que hoy lo promete siempre aunque `rules` sea `null`/`""` y `_count.categories` sea 0 — **que es el caso real de al menos una de las 5 disciplinas cargadas**.
- **Archivos:** `src/pages/public/disciplines/DisciplineCard.tsx` (nuevo), `src/pages/public/DisciplinesPage.tsx`, `src/lib/constants.ts` (etiquetas de `resultType`)
- **DoD:**
  - Sin reglamento **y** sin categorías, la tarjeta **no es un enlace** y no promete destino.
  - Con sólo uno de los dos, el texto nombra sólo ese.
  - `rules === ''` cuenta como ausente (hay una fila así en los datos reales; `rules?.trim()`).
  - `_count.categories === 0` → la fila no se renderiza. Nunca "0 categorías".
  - Los jugadores sólo en `type === EQUIPO` y sólo con ambos valores presentes.
  - La grilla usa `columnasSegunVolumen`: con 5 disciplinas, **3 columnas, sin huérfana**.
  - `DisciplinesPage` baja de 162 a menos de 90 líneas.
- **Evidencia:** `DisciplineCard` extraído; `DisciplinesPage` bajó de 162 a **99 líneas**. Salida real con las 5 disciplinas de la API: `Ajedrez → "1 categoría · Se define por puntos · Ver categorías"` (su `rules` es `""` y cuenta como ausente), `Fútbol 11 → "2 categorías · 11 a 16 jugadores · Se define por goles"`, `Lucas → "Se define por tiempo · Ver detalle de la disciplina"`, sin fila de categorías y sin prometer reglamento. 12 aserciones en `check:cards` §1. **Desvío respecto del plan, resuelto con el revisor:** la tarjeta sin reglamento ni categorías **sigue siendo un enlace**; lo que cambia es el texto. El motivo, con lo que de verdad muestra la pantalla de destino, está en §11.

#### U08 🟠 🎨 UI — Sedes: contador honesto, sin relleno, y la conexión con el calendario

- [x] **Descripción:** El contador de `:15` usa `data.length` (la página, no el total). El pie de `:76` rellena con "Sede Oficial" cuando no hay capacidad. Y la sede no dice nada de lo que pasa en ella, teniendo los tres eventos del calendario un `venueId` cargado.
- **Archivos:** `src/pages/public/venues/VenueCard.tsx` (nuevo), `src/pages/public/VenuesPage.tsx`
- **DoD:**
  - El contador sale de `meta.total`. **Contraprueba:** con `limit: 2` el chip sigue diciendo 3.
  - "Sede Oficial" eliminado; sin `capacity`, no hay fila.
  - El `<h2>` con el nombre es lo primero de la tarjeta; departamento y localidad pasan a metadatos secundarios con `primary-600`.
  - "N eventos programados" sale de contar eventos publicados **futuros** con ese `venueId`; con 0, no se renderiza.
  - El umbral de volumen (§4.3) está escrito en el código con su comentario y su referencia a U13. **Este punto es el que quiero que los revisores discutan.**
  - El filtro por departamento se deriva de los datos y **no se pinta si hay una sola opción**.
  - Se conserva intacto `safeExternalUrl` y su rama sin mapa.
- **Evidencia:** `VenueCard` extraído. El contador sale del conjunto completo: `useAllVenues` recorre todas las páginas, así que la longitud del arreglo *es* `meta.total` y no la primera página de él. "Sede Oficial" eliminado. El `<h2>` con el nombre es lo primero, verificado por orden de aparición en el HTML renderizado. Eventos por sede cruzados contra `useAllCalendarEvents` con la misma clave de query que el calendario, con `TOPE_DE_CRUCE_EN_CLIENTE = 200` y su comentario apuntando a U13. Salida real: `Club San Martín → Capacidad 3.000 · 1 evento programado`; `Estadio Cincuentenario → Capacidad 4.500` y **ninguna fila de eventos**, porque el suyo ya pasó. Filtro por departamento derivado de los datos y **no pintado hoy**, porque las tres sedes son del mismo departamento. `safeExternalUrl` y su rama sin mapa, intactos.

#### U09 🟡 🎨 UI — Calendario: mostrar la sede que el encabezado promete, y sacar lo inventado

- [x] **Descripción:** `CalendarPage.tsx:52` promete "Fechas, horarios y **sedes**" y la tarjeta no muestra ninguna sede, teniendo los tres eventos su `venueId`. En su lugar hay dos chips decorativos ("Competencia Oficial", "Juegos Evita Formosa", `CalendarEventCard:107-115`) y una descripción de relleno (`:99-102`) que hoy es **el 100 %** de las descripciones visibles, porque los tres eventos tienen `description: null`.
- **Ojo con la relación:** `CalendarEvent` **no tiene `@relation`** con `Venue` ni con `Discipline` (`schema.prisma:483-498`). Los nombres se resuelven cruzando en el cliente contra los catálogos (opción A de §1.2). **No asumir un `include` que el modelo no permite.**
- **Archivos:** `src/pages/public/calendar/CalendarEventCard.tsx`, `src/pages/public/calendar/calendarSecciones.ts` (nuevo), `src/pages/public/CalendarPage.tsx`
- **DoD:**
  - Sede y disciplina en la fila de metadatos, resueltas por id. Un id que no resuelve → **la fila no aparece**; nada de "Sede a confirmar".
  - Los dos chips decorativos y la descripción de relleno, eliminados.
  - `<h2>` de sección + `<h3>` de evento; sin saltos en el esquema del documento.
  - "Próximos" y "Ya se disputaron" como secciones con encabezado; **una sección vacía no se renderiza**.
  - Badge "Hoy" derivado de `startDate`, con `accent-500` sobre `primary-900` (7.96:1).
  - `endDate` presente y de otro día → se muestra el rango.
  - `max-w-5xl` → `max-w-7xl`, con el timeline acotado por dentro.
  - **`calendarFilters.ts` y `eventStageStyles.ts` sin tocar.**
  - El corte en secciones es una función pura en su propio módulo, testeable sin montar la página (mismo criterio que `newsLayout.ts`).
- **Evidencia:** Sede y disciplina resueltas por id contra los catálogos (opción A: **no hay `@relation` que incluir**). Salida real de los tres eventos: `26/08 → Estadio Cincuentenario`, en "Ya se disputaron" y atenuado; `31/08 → Club San Martín · Ajedrez`, **con badge "Hoy"**; `10/09 → Polideportivo Policial · Fútbol 11`. Chips decorativos y descripción inventada, eliminados: con `description: null` no se emite ningún párrafo. `<h2>` de sección + `<h3>` de evento, verificado extrayendo los niveles del HTML SSR. `max-w-5xl → max-w-7xl` con el timeline acotado por dentro. El corte vive en `calendar/calendarSecciones.ts`, función pura que recibe `ahora` por parámetro para ser determinista. **`calendarFilters.ts` y `eventStageStyles.ts` sin tocar**, y `git status` lo confirma.

#### U10 🟡 🎨 UI — Rankings: dos chips falsos afuera, el estado real del fixture adentro

- [x] **Descripción:** `RankingsPage:103-110` pinta "Ver Fixture" y "Posiciones" con forma de botón, siendo `<span>` inertes dentro de un link que va al mismo lado. Y **las tres competencias reales tienen `_count.matches === 0`**: no hay fixture ni posiciones que ver. Es afordancia falsa **y** afirmación falsa a la vez, sobre la única tarjeta que la página muestra hoy.
- **Archivos:** `src/pages/public/rankings/CompetitionCard.tsx` (nuevo), `src/pages/public/RankingsPage.tsx`, `src/lib/constants.ts` (etiquetas de `format`)
- **DoD:**
  - Con `_count.matches === 0`, el pie dice **"Fixture aún no generado"** en texto atenuado, **sin forma de botón**.
  - Con `> 0`, **un solo** enlace real que nombra la cantidad de partidos.
  - `format` se pinta, con sus etiquetas en `constants.ts` junto a `STAGE_LABELS`.
  - Disciplina y categoría como badges, no como filas "Etiqueta: Valor" con `justify-between`.
  - El título tiene guardas: sin `name` ni relaciones, **nunca** "undefined - undefined".
  - `STATUS_BADGE.BORRADOR` eliminado (inalcanzable desde `:26`).
  - `EmptyState` con dos textos según haya búsqueda o no, como `NewsPage.tsx:118-124`.
  - `amber-*` → `accent-*`.
  - Con **1** competencia visible, la grilla no deja dos tercios de fila vacíos (`columnasSegunVolumen`).
- **Evidencia:** `CompetitionCard` extraído. **Corrección a un dato del plan:** `_count.matches` **no** es 0 en las tres competencias — la única que la página muestra (`Torneo Provincial de Ajedrez`, FINALIZADA) tiene **1**. Salida real: `"Finalizada · Ajedrez · Libre Mixto · Torneo Provincial de Ajedrez · Provincial · Todos contra todos · Ver fixture y posiciones (1 partido)"`, con el singular correcto. Con `_count.matches: 0` el pie dice **"Fixture aún no generado"**, sin forma de botón. `format` se pinta con `FORMAT_LABELS`, que **ya existía** en `constants.ts` (el plan lo daba por crear). Título con guardas: sin `name` ni relaciones emite "Competencia sin nombre" y nunca "undefined". `STATUS_BADGE.BORRADOR` borrado. Sin `amber-*`. Con 1 competencia la grilla usa `max-w-xl`.

---

### Fase 3 — Cierre

#### U11 ✨ 🎨 UI — Consistencia entre las cuatro

- [x] **Descripción:** Contenedores desparejos (`max-w-5xl` vs `max-w-7xl`), fondos desparejos (`bg-slate-50/50` en Calendario, nada en las otras tres), paddings desparejos (`pb-12` vs `pb-20`), delays de animación desparejos (0.05 vs 0.06). Ninguno rompe nada; juntos hacen que navegar entre secciones se sienta como cuatro sitios.
- **Archivos:** las cuatro páginas
- **DoD:**
  - Mismo contenedor, mismo fondo y mismo ritmo vertical en las cuatro. Si Calendario se aparta, el motivo está escrito.
  - Un solo valor de delay escalonado, definido una vez.
  - Los chips de filtro llegan a 44 px de alto (§5.7).
- **Evidencia:** Las cuatro páginas comparten contenedor (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16`), fondo y ritmo vertical. Calendario **no** se aparta: se le sacó el `bg-slate-50/50`, que además era un color fuera de la paleta institucional. Un único `DELAY_ESCALONADO = 0.05` exportado desde `gridVolumen.ts`, con un tope de 12 tarjetas para que la número 60 no entre tres segundos tarde. Los chips de filtro llegan a 44 px con `min-h-11 py-2.5`, y `min-h-11` está en el CSS de `dist/`.

#### U12 🟡 ⚛️ FE — Red que fija las propiedades: ninguna tarjeta afirma lo que el dato no sostiene

- [x] **Descripción:** El equivalente de S01 para esta capa. Un chequeo que **bundlea los componentes reales** con esbuild (`--packages=external`) y los renderiza con `react-dom/server`, como ya hace `scripts/check-nav-roles.mjs`, y verifica sobre la salida las propiedades que este plan introduce.
- **Por qué existe:** las cuatro correcciones son de la misma clase —"la UI afirma algo que el dato no sostiene"— y esa clase reaparece cada vez que alguien agrega una tarjeta. Un chequeo por página se olvida; uno que enumera las tarjetas, no.
- **Se espera que arranque en rojo** contra el código actual, marcando D2, C1, C3, R1 y V2. **Ese rojo inicial es el entregable**: anotar cuántas afirmaciones marca antes de arreglar nada.
- **Archivos:** `frontend/scripts/check-public-cards.mjs` (nuevo), `package.json` (script `check:cards`)
- **DoD:**
  - `DisciplineCard` con `rules: null` y `_count.categories: 0` **no** emite un `<a>` ni la palabra "reglamento".
  - `CompetitionCard` con `_count.matches: 0` **no** emite el texto "Ver fixture" ni "Posiciones".
  - `CalendarEventCard` con `description: null` **no** emite ningún párrafo de descripción, ni la frase "Competencia Oficial".
  - `VenueCard` con `capacity: null` **no** emite "Sede Oficial" ni "Capacidad".
  - El esquema de encabezados de cada página no salta niveles (se extrae de la salida SSR).
  - **Contraprueba obligatoria, la regla de las tres rondas:** restaurando el código viejo de cada tarjeta, el chequeo vuelve a marcarla **por nombre**. Con el conteo anotado.
  - `npx tsc --noEmit`, `npm run lint`, `npm run build` y `npm run check:nav` en verde, con el tamaño de los chunks antes/después (§6).
- **Evidencia:** `scripts/check-public-cards.mjs` + `npm run check:cards`. Bundlea el fuente real con esbuild (`--alias:@=./src --packages=external`) y lo renderiza con `react-dom/server` dentro de un `MemoryRouter`. **Arrancó en rojo: 48 fallas sobre 114 chequeos**, corriendo contra las tarjetas extraídas con el markup viejo textual, y marcó las cuatro familias (D2, C1/C2/C3, R1, V2) más D1, R2, R5, R7, V1, V4, U01 y U03. Hoy: **114 en verde**. **Contraprueba: 26 mutaciones quirúrgicas, una por arreglo, y las 26 ponen el chequeo en rojo nombrando la tarjeta** — D2, D2b, D1/U05, U06, U07, V1, V2, V3, V4, R1, R1b, R2, R5, R7, R10, C1, C2, C3, C4, C4b, C5, C6, U01, U03, U03b y U03c. Baseline: `tsc` limpio, `lint` 0 errores y **6 warnings** (los mismos de antes), `check:nav` 474 en verde. **Bundle:** el entry mide 316,09 kB contra los 281,41 de antes, y eso **no es código nuevo** — ver §11.

---

### Fuera de este plan, anotado para que no se pierda

#### U13 🟠 🏗️ BE — Relaciones de `CalendarEvent` con `Venue` y `Discipline`

- [ ] `schema.prisma:483-498` tiene `venueId` y `disciplineId` **sin `@relation`**. Mientras siga así, el nombre de la sede sólo se puede resolver cruzando en el cliente (U09) y no existe forma de que `/venues` devuelva un `_count` de eventos (U08). Es una migración más el `include` en el service. **Es trabajo de `Backend Architect`, no de este plan**, y U08/U09 están diseñadas para funcionar sin él.

---

## 9. Resumen de tareas

| Tarea | Sev. | Agente | Título | Estado |
|---|---|---|---|---|
| **U01** | 🟡 | ⚛️ FE | Tres topes silenciosos más (Disciplinas, Sedes, Rankings) | ✅ **Hecha** |
| **U02** | 🟠 | ⚛️ FE | Los tipos declaran los `_count` que la API ya devuelve | ✅ **Hecha** |
| **U03** | 🟠 | 🎨 UI | Piezas compartidas: estado de lista, esqueleto, reparto por volumen | ✅ **Hecha** |
| **U04** | 🟠 | 🎨 UI | `prefers-reduced-motion` apaga lo que hoy no apaga | ✅ **Hecha** |
| **U05** | 🟡 | 🎨 UI | Contraste: los usos por debajo de AA | ✅ **Hecha** |
| **U06** | 🟠 | 🎨 UI | Las tarjetas-enlace se comportan como bloques | ✅ **Hecha** |
| **U07** | 🟠 | 🎨 UI | Disciplinas: datos reales y CTA condicionado | ✅ **Hecha** |
| **U08** | 🟠 | 🎨 UI | Sedes: contador honesto y conexión con el calendario | ✅ **Hecha** |
| **U09** | 🟡 | 🎨 UI | Calendario: la sede que el encabezado promete | ✅ **Hecha** |
| **U10** | 🟡 | 🎨 UI | Rankings: el estado real del fixture | ✅ **Hecha** |
| **U11** | ✨ | 🎨 UI | Consistencia entre las cuatro | ✅ **Hecha** |
| **U12** | 🟡 | ⚛️ FE | Red: ninguna tarjeta afirma lo que el dato no sostiene | ✅ **Hecha** |
| **U13** | 🟠 | 🏗️ BE | Relaciones de `CalendarEvent` — **fuera de alcance** | ⬜ No implementada (deliberado) |

**Por severidad:** 🔴 0 · 🟡 5 · 🟠 6 · ✨ 1 (+ U13 fuera de alcance). **Ningún blocker**: son cuatro páginas públicas de sólo lectura, sin datos personales ni escrituras. Lo más grave es U05 (un icono que se vuelve invisible al pasar el mouse) y las cuatro afirmaciones falsas de U07/U09/U10.

---

## 10. Las tres cosas que quiero que los revisores discutan

No las escondo entre los DoD:

1. **El cruce en el cliente para las sedes del calendario (§1.2, opción A).** Es correcto hoy y no escala. El umbral de 200 eventos de U08 es una curita defendible o una cosa fea, según a quién le preguntes. La alternativa es bloquear U08/U09 hasta que exista U13, y me parece peor: seis meses sin mostrar la sede en el calendario por esperar una migración.

2. **Que una tarjeta de disciplina sin reglamento ni categorías deje de ser un enlace (U07).** Es lo más honesto y también es una inconsistencia visible: en la misma grilla, cuatro tarjetas clickeables y una que no. Se puede argumentar que confunde más de lo que aclara. Mi posición: un link a una pantalla vacía confunde más. Pero es una decisión de producto, no de diseño, y no la quiero tomar solo.

3. **Que `columnasSegunVolumen` sea una función y no seis clases de Tailwind escritas a mano.** El precedente es `newsLayout.ts` y creo que rinde. El riesgo es que la grilla "salte" de layout al agregar la sexta fila y alguien tenga que entender por qué. Está documentado en la tabla de §3.3, pero es una capa de indirección que hay que aceptar a conciencia.

---

## 11. Lo que salió distinto de lo planeado (escrito después de implementar)

### 11.1 Las tres decisiones de §10, resueltas

1. **Cruce en el cliente para las sedes del calendario: se hizo.** Con el tope (`TOPE_DE_CRUCE_EN_CLIENTE = 200`) y el caveat escritos en `VenuesPage.tsx`, apuntando a U13. Esperar la migración era peor que mostrar la sede hoy.

2. **La tarjeta de disciplina sin reglamento ni categorías sigue siendo un enlace.** El plan proponía que dejara de serlo. **Antes de decidirlo se miró qué muestra de verdad la pantalla de destino** con la única disciplina en ese estado (`Lucas`, `rules: null`, `_count.categories: 0`), y **no está vacía**: `DisciplineDetailPage` pinta el nombre, el badge de modalidad, el CTA "Inscribirme Ahora", el panel "Información General" con tipo de modalidad, tipo de resultado y jugadores por equipo, y las dos secciones vacías con fallbacks honestos ("El reglamento aún no ha sido cargado para esta disciplina", "No hay categorías habilitadas"). Hay contenido y hay dónde inscribirse. Entonces lo que mentía era el CTA, no el enlace, y se arregló el texto: **"Ver detalle de la disciplina"** en vez de "Ver reglamento y categorías". Así la grilla no tiene una tarjeta que se comporta distinto de las otras cuatro.

   **Pendiente que esto deja al descubierto, y que no toqué por estar fuera de U01–U12:** el hero de `DisciplineDetailPage.tsx:55-57` dice *"Conocé el reglamento y las categorías disponibles para inscribirte y competir en esta disciplina"* **siempre**, aunque no haya ni reglamento ni categorías. Es la misma clase de afirmación que este trabajo vino a cerrar, un nivel más abajo. Merece su propia tarea.

3. **`columnasSegunVolumen` es una función**, con la tabla de cortes documentada dentro del módulo (no sólo acá) y los 9 casos fijados uno por uno en `check:cards`.

### 11.2 Datos del plan que la realidad corrigió

- **`_count.matches` no es 0 en las tres competencias.** `Torneo Provincial de Ajedrez` (FINALIZADA), que es justamente la única que la página muestra, tiene **1 partido**. O sea que hoy el pie de esa tarjeta dice "Ver fixture y posiciones (1 partido)" y no "Fixture aún no generado". El arreglo de U10 sigue en pie —el texto sale del dato en las dos ramas—, pero la afirmación de §1.1 estaba mal y conviene que quede corregida.
- **`FORMAT_LABELS` y `RESULT_TYPE_LABELS` ya existían** en `src/lib/constants.ts`. U07 y U10 los daban por crear; se reutilizaron. Cero constantes nuevas.

### 11.3 El entry pasó de 281,41 a 316,09 kB, y no es código nuevo

Es lo único del baseline que no cierra en su lectura literal, así que va con el detalle completo.

**Qué pasó.** Al hacer que `CalendarPage` resolviera los nombres de sede con `useAllVenues` (U09), el módulo `src/hooks/useVenues.ts` pasó a estar compartido entre dos páginas lazy en vez de una. Eso cambia la cuenta con la que el agrupador decide dónde poner cada módulo compartido, se recalculó el reparto, y **el chunk de react-router —34,79 kB— se fusionó dentro del entry**.

**Por qué no es una regresión de peso.** Ese chunk ya venía en el primer paint: `dist/index.html` lo declaraba como `modulepreload` y el entry lo importaba de forma **estática** (`import{...}from"./dist-Bs85j6sq.js"`). Las dos cosas verificadas sobre el `dist/` del build anterior.

| | Antes | Después |
|---|---|---|
| entry | 281,41 kB (gzip 88,90) | 316,09 kB (gzip 98,27) |
| chunk react-router, `modulepreload`-eado | 34,79 kB (gzip 9,91) | — (adentro del entry) |
| **JS del primer paint** | **316,20 kB (gzip 98,81)** | **316,09 kB (gzip 98,27)** |
| CSS | 109,03 kB (gzip 17,25) | 108,17 kB (gzip 17,30) |
| requests del primer paint | 11 | 10 |

O sea: **0,11 kB menos de JS, 0,86 kB menos de CSS y un request menos**. Bisecado hasta el import exacto: sacando `useAllVenues` de `CalendarPage`, el entry vuelve a 281,41 kB al byte.

**Qué se intentó y se descartó.** Fijar react-router en su propio chunk con `advancedChunks` en `vite.config.ts`. Empeoró: el chunk se fue a 100,48 kB y el entry sólo bajó a 297,69, total 398 kB de primer paint contra 316. Revertido; `vite.config.ts` quedó **sin tocar**.

**Lo que hay para decidir.** El número que el proyecto mide subió 35 kB sin que subiera el peso. Las salidas son tres: (a) aceptar el número y ajustar el umbral, que es lo que los datos sostienen; (b) medir el primer paint completo en vez del entry, que es la métrica que de verdad importa; (c) si el umbral es innegociable como número, sacar la resolución de sedes del calendario y perder U09. Mi recomendación es (b), pero es una decisión del proyecto y no la tomo solo.

### 11.4 Lo que quedó sin cubrir por la red

**U04 (`prefers-reduced-motion`) no está fijado por `check:cards`.** Es CSS y el chequeo renderiza componentes. Se verificó leyendo el CSS emitido, pero eso es una lectura, no una prueba ejecutable, y mañana alguien puede borrar el bloque sin que nada se ponga rojo. Cubrirlo pediría parsear el CSS de `dist/` y afirmar sobre las reglas dentro del `@media`. Es hacible y no lo hice.
