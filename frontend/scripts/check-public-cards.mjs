// ===========================================
// Red de las tarjetas públicas (U12)
//
// El bug que cierra, y es una **clase** de bug, no uno solo: la UI afirma algo
// que el dato no sostiene. Las cuatro páginas públicas de listado lo hacían al
// mismo tiempo y de la misma forma:
//
//   · Disciplinas: el CTA decía "Ver reglamento y categorías" siempre, aunque
//     `rules` fuera null/"" y `_count.categories` fuera 0.
//   · Calendario: cuando `description` era null se pintaba una frase inventada
//     ("Evento oficial del cronograma…") con el formato de una descripción real
//     —y los tres eventos cargados tienen `description: null`, o sea que era el
//     100 % de lo que se veía—, más dos chips decorativos que no salían de
//     ningún campo ("Competencia Oficial", "Juegos Evita Formosa").
//   · Rankings: dos chips con forma de botón, "Ver Fixture" y "Posiciones",
//     sobre competencias sin fixture generado.
//   · Sedes: "Sede Oficial" ocupando la ranura de la capacidad cuando la
//     capacidad no se sabe.
//
// Un chequeo por página se olvida el día que alguien agrega la quinta. Éste
// enumera las tarjetas y renderiza el **fuente real** —bundleado con esbuild y
// pasado por `react-dom/server`, igual que `check-nav-roles.mjs`— así que no
// hay forma de que pase en verde con el markup viejo puesto.
//
// Corre con: npm run check:cards
// ===========================================
import { execSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-public-cards.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

// -------------------------------------------------
// Se bundlea el fuente REAL, no una copia de la lógica
// -------------------------------------------------
// `--packages=external` deja react, react-router y lucide-react como imports
// que resuelve Node desde node_modules: acá sí se ejecutan de verdad, porque el
// punto de todo esto es mirar el HTML que sale.
execSync(
  [
    'npx esbuild',
    `"${path.join(RAIZ, 'scripts', 'public-cards.entry.ts')}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --jsx=automatic --log-level=error',
    `"--alias:@=${SRC}"`,
    '--packages=external',
    // La portada de sede resuelve la foto contra `VITE_API_BASE_URL`
    // (`@/lib/apiBase`): en Node no hay `import.meta.env`, se fija la base
    // relativa, que es la de producción (mismo origen).
    '"--define:import.meta.env={\\"DEV\\":false,\\"VITE_API_BASE_URL\\":\\"/api/v1\\"}"',
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const {
  DisciplineCard,
  VenueCard,
  CompetitionCard,
  CalendarAgenda,
  agruparPorMes,
  rangoDeDias,
  ocurreHoy,
  columnasSegunVolumen,
  NewsCard,
  FeaturedNewsCard,
  NewsMosaicCard,
  NewsSidebarList,
  antiguedadDeNoticia,
  fechaDeNoticia,
  fechaDePublicacion,
  formatDate,
} = await import(pathToFileURL(SALIDA).href);

/** Renderiza una tarjeta a HTML. El router hace falta por los `<Link>`. */
function pintar(Componente, props) {
  return renderToStaticMarkup(
    h(MemoryRouter, null, h(Componente, props)),
  );
}

/** Texto visible, sin etiquetas: para preguntar "¿esto se lee en pantalla?". */
function texto(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * El fuente sin sus comentarios.
 *
 * Hace falta porque varios comentarios de este trabajo **citan** el markup que
 * se eliminó, para explicar qué bug cerraba. Sin este paso, el propio
 * comentario que documenta que `CARD_GRADIENTS` se borró hacía fallar al
 * chequeo que verifica que `CARD_GRADIENTS` se borró.
 */
function sinComentarios(fuente) {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('//'))
    .join('\n');
}

/** Los niveles de encabezado que emite un fragmento, en orden de aparición. */
function niveles(html) {
  return [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
}

// =================================================
// 1. Disciplinas — el CTA no puede prometer lo que no hay
// =================================================
//
// Datos reales de la API (2026-08-31): de las 5 disciplinas activas, "Lucas"
// tiene `_count.categories: 0` y `rules: null`, y "Ajedrez" tiene `rules: ""`
// —cadena vacía, que es ausencia disfrazada de presencia—. El CTA viejo les
// prometía reglamento y categorías a las dos.
const DISCIPLINA_BASE = {
  id: 'd1',
  name: 'Lucas',
  type: 'INDIVIDUAL',
  resultType: 'TIEMPO',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-07-22T21:47:44.116Z',
  updatedAt: '2026-07-22T21:47:44.116Z',
};

{
  // (a) Sin reglamento y sin categorías: no promete ninguna de las dos cosas.
  const html = pintar(DisciplineCard, {
    discipline: { ...DISCIPLINA_BASE, rules: null, _count: { categories: 0 } },
    index: 0,
  });
  const t = texto(html).toLowerCase();

  comprobar(
    '[Disciplinas] sin reglamento ni categorías, el CTA no dice "reglamento"',
    !t.includes('reglamento'),
    `la tarjeta emite: "${texto(html)}"`,
  );
  comprobar(
    '[Disciplinas] sin reglamento ni categorías, el CTA no dice "categorías"',
    !t.includes('categoría'),
    `la tarjeta emite: "${texto(html)}"`,
  );
  comprobar(
    '[Disciplinas] sin reglamento ni categorías, nunca aparece "0 categorías"',
    !/\b0 categor/.test(t),
  );
  // Decisión de producto: la tarjeta **sigue siendo un enlace**. La pantalla de
  // destino no está vacía (muestra tipo, tipo de resultado, jugadores y el CTA
  // de inscripción); lo que se corrige es lo que el enlace promete, no su
  // existencia. Una grilla con cuatro tarjetas clickeables y una que no lo es
  // sería una inconsistencia peor que el texto genérico.
  comprobar(
    '[Disciplinas] la tarjeta sigue siendo un enlace aunque no haya reglamento ni categorías',
    html.includes('<a '),
  );
}

{
  // (b) `rules: ""` cuenta como ausente: es el caso real de Ajedrez.
  const html = pintar(DisciplineCard, {
    discipline: { ...DISCIPLINA_BASE, name: 'Ajedrez', rules: '   ', _count: { categories: 0 } },
    index: 0,
  });
  comprobar(
    '[Disciplinas] `rules` en blanco cuenta como ausente (caso real: Ajedrez)',
    !texto(html).toLowerCase().includes('reglamento'),
    `la tarjeta emite: "${texto(html)}"`,
  );
}

{
  // (c) Sólo categorías: nombra sólo eso.
  const html = pintar(DisciplineCard, {
    discipline: { ...DISCIPLINA_BASE, rules: null, _count: { categories: 3 } },
    index: 0,
  });
  const t = texto(html).toLowerCase();
  comprobar(
    '[Disciplinas] con categorías y sin reglamento, el CTA nombra sólo las categorías',
    t.includes('categoría') && !t.includes('reglamento'),
    `la tarjeta emite: "${texto(html)}"`,
  );
  comprobar(
    '[Disciplinas] el conteo real de categorías se pinta',
    t.includes('3 categorías'),
    `la tarjeta emite: "${texto(html)}"`,
  );
}

{
  // (d) Sólo reglamento: nombra sólo eso.
  const html = pintar(DisciplineCard, {
    discipline: { ...DISCIPLINA_BASE, rules: 'Un reglamento de verdad.', _count: { categories: 0 } },
    index: 0,
  });
  const t = texto(html).toLowerCase();
  comprobar(
    '[Disciplinas] con reglamento y sin categorías, el CTA nombra sólo el reglamento',
    t.includes('reglamento') && !t.includes('categoría'),
    `la tarjeta emite: "${texto(html)}"`,
  );
}

{
  // (e) Los dos: la frase completa, que es la única vez que es cierta.
  const html = pintar(DisciplineCard, {
    discipline: { ...DISCIPLINA_BASE, rules: 'Reglamento.', _count: { categories: 2 } },
    index: 0,
  });
  const t = texto(html).toLowerCase();
  comprobar(
    '[Disciplinas] con reglamento y categorías, el CTA los nombra a los dos',
    t.includes('reglamento') && t.includes('categoría'),
    `la tarjeta emite: "${texto(html)}"`,
  );
}

{
  // (f) Jugadores: sólo en EQUIPO y sólo con los dos valores.
  const conRango = pintar(DisciplineCard, {
    discipline: {
      ...DISCIPLINA_BASE, name: 'Fútbol 11', type: 'EQUIPO',
      minPlayers: 11, maxPlayers: 16, rules: null, _count: { categories: 2 },
    },
    index: 0,
  });
  comprobar(
    '[Disciplinas] en EQUIPO con min y max, se pinta el rango de jugadores',
    texto(conRango).includes('11 a 16'),
    `la tarjeta emite: "${texto(conRango)}"`,
  );

  const individual = pintar(DisciplineCard, {
    discipline: {
      ...DISCIPLINA_BASE, type: 'INDIVIDUAL',
      minPlayers: 1, maxPlayers: 1, rules: null, _count: { categories: 1 },
    },
    index: 0,
  });
  comprobar(
    '[Disciplinas] en INDIVIDUAL no se habla de jugadores por equipo',
    !texto(individual).toLowerCase().includes('jugador'),
    `la tarjeta emite: "${texto(individual)}"`,
  );

  const sinMax = pintar(DisciplineCard, {
    discipline: {
      ...DISCIPLINA_BASE, type: 'EQUIPO',
      minPlayers: 5, maxPlayers: null, rules: null, _count: { categories: 1 },
    },
    index: 0,
  });
  comprobar(
    '[Disciplinas] en EQUIPO con un solo valor de jugadores, la fila no se renderiza',
    !texto(sinMax).toLowerCase().includes('jugador'),
    `la tarjeta emite: "${texto(sinMax)}"`,
  );
}

{
  // (g) La tarjeta es un `h2` (hija directa del `h1` del encabezado).
  const html = pintar(DisciplineCard, {
    discipline: { ...DISCIPLINA_BASE, rules: 'x', _count: { categories: 1 } },
    index: 0,
  });
  comprobar(
    '[Disciplinas] el título de la tarjeta es un h2',
    JSON.stringify(niveles(html)) === '[2]',
    `niveles emitidos: ${JSON.stringify(niveles(html))}`,
  );
}

// =================================================
// 2. Sedes — nada de relleno con forma de dato
// =================================================
const SEDE_BASE = {
  id: 'v1',
  name: 'Estadio Cincuentenario',
  address: 'Av. Antártida Argentina',
  department: 'Formosa',
  locality: 'Formosa',
  latitude: null,
  longitude: null,
  isActive: true,
  imageUrl: null,
  createdAt: '2026-07-22T21:57:48.707Z',
  updatedAt: '2026-07-22T21:57:48.707Z',
};

{
  const html = pintar(VenueCard, {
    venue: { ...SEDE_BASE, capacity: null },
    index: 0,
    eventosProgramados: 0,
  });
  const t = texto(html);

  comprobar(
    '[Sedes] sin capacidad, no aparece "Sede Oficial"',
    !t.includes('Sede Oficial'),
    `la tarjeta emite: "${t}"`,
  );
  comprobar(
    '[Sedes] sin capacidad, tampoco aparece la palabra "Capacidad"',
    !t.toLowerCase().includes('capacidad'),
    `la tarjeta emite: "${t}"`,
  );
  comprobar(
    '[Sedes] con 0 eventos programados, no se pinta la fila de eventos',
    !t.toLowerCase().includes('evento'),
    `la tarjeta emite: "${t}"`,
  );
}

{
  const html = pintar(VenueCard, {
    venue: { ...SEDE_BASE, capacity: 4500 },
    index: 0,
    eventosProgramados: 2,
  });
  const t = texto(html);
  comprobar('[Sedes] con capacidad, el número se pinta', /4\.?500/.test(t), `emite: "${t}"`);
  comprobar(
    '[Sedes] con eventos programados, se pinta el conteo',
    /2 eventos/.test(t),
    `emite: "${t}"`,
  );
}

{
  // El nombre es lo primero que se lee: hoy el ojo iba primero al departamento,
  // que está arriba a la derecha en mayúsculas (V4).
  const html = pintar(VenueCard, {
    venue: { ...SEDE_BASE, capacity: 4500 },
    index: 0,
    eventosProgramados: null,
  });
  const t = texto(html);
  comprobar(
    '[Sedes] el nombre de la sede se lee antes que el departamento',
    t.indexOf('Estadio Cincuentenario') < t.indexOf('Formosa'),
    `emite: "${t}"`,
  );
  comprobar(
    '[Sedes] el título de la tarjeta es un h2',
    JSON.stringify(niveles(html)) === '[2]',
    `niveles emitidos: ${JSON.stringify(niveles(html))}`,
  );
  comprobar(
    '[Sedes] se conserva el enlace "Cómo llegar" con URL https limpia',
    html.includes('https://maps.google.com/') && html.includes('rel="noopener noreferrer"'),
  );
}

// -------------------------------------------------
// 2b. Sedes — la portada es la foto real, o un placeholder que no finge serlo
// -------------------------------------------------
{
  const FOTO = '/api/v1/venues/v1/image?v=a1b2c3d4e5f6';
  const imgs = (html) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const attr = (tag, nombre) => new RegExp(`\\s${nombre}="([^"]*)"`).exec(tag)?.[1];

  // Con foto
  const conFoto = pintar(VenueCard, {
    venue: { ...SEDE_BASE, capacity: 4500, imageUrl: FOTO },
    index: 0,
    eventosProgramados: null,
  });
  const [portada] = imgs(conFoto);
  comprobar('[Sedes] con foto, la tarjeta pinta UNA imagen de portada', imgs(conFoto).length === 1, `imgs: ${imgs(conFoto).length}`);
  comprobar('[Sedes] la portada usa la URL de la API (mismo origen)', portada && attr(portada, 'src') === FOTO, portada);
  comprobar(
    '[Sedes] la portada tiene alt descriptivo con el nombre de la sede',
    portada && attr(portada, 'alt') === 'Foto de la sede Estadio Cincuentenario',
    portada,
  );
  comprobar(
    '[Sedes] la portada es diferida (loading="lazy", decoding="async")',
    portada && attr(portada, 'loading') === 'lazy' && attr(portada, 'decoding') === 'async',
    portada,
  );
  comprobar(
    '[Sedes] la portada reserva su lugar (width/height + aspect-video): no mueve el layout',
    portada && attr(portada, 'width') && attr(portada, 'height') && /\baspect-video\b/.test(attr(portada, 'class') ?? ''),
    portada,
  );
  comprobar(
    '[Sedes] la portada recorta sin deformar (object-cover)',
    portada && /\bobject-cover\b/.test(attr(portada, 'class') ?? ''),
  );
  comprobar(
    '[Sedes] la portada va antes que el nombre (arriba de la tarjeta)',
    conFoto.indexOf('<img') < conFoto.indexOf('<h2'),
  );
  comprobar(
    '[Sedes] con foto no se pinta además el placeholder',
    !conFoto.includes('data-venue-photo="placeholder"'),
  );
  comprobar(
    '[Sedes] con foto, el título sigue siendo el único encabezado (h2)',
    JSON.stringify(niveles(conFoto)) === '[2]',
  );

  // Sin foto
  const sinFoto = pintar(VenueCard, {
    venue: { ...SEDE_BASE, capacity: 4500, imageUrl: null },
    index: 0,
    eventosProgramados: null,
  });
  comprobar('[Sedes] sin foto, no se inventa ninguna imagen', imgs(sinFoto).length === 0, `imgs: ${imgs(sinFoto).length}`);
  const placeholder = /<div[^>]*data-venue-photo="placeholder"[^>]*>/.exec(sinFoto)?.[0] ?? '';
  comprobar('[Sedes] sin foto, hay un placeholder de portada', placeholder !== '');
  comprobar(
    '[Sedes] el placeholder es decorativo (aria-hidden) y no dice "sin foto" en pantalla',
    placeholder.includes('aria-hidden="true"') && !/sin (foto|imagen)/i.test(texto(sinFoto)),
    placeholder,
  );
  comprobar(
    '[Sedes] el placeholder ocupa el mismo lugar que la foto (aspect-video)',
    /\baspect-video\b/.test(placeholder),
  );
  comprobar(
    '[Sedes] el placeholder usa los tokens del sitio (primary/celeste)',
    /from-primary-\d+/.test(placeholder) && /to-celeste-\d+/.test(placeholder),
    placeholder,
  );

  // URL que no es nuestra: no llega a un src
  for (const [nombre, valor] of [
    ['javascript:', 'javascript:alert(1)'],
    ['host ajeno', 'https://evil.example/x.jpg'],
    ['protocol-relative', '//evil.example/x.jpg'],
  ]) {
    const html = pintar(VenueCard, {
      venue: { ...SEDE_BASE, imageUrl: valor },
      index: 0,
      eventosProgramados: null,
    });
    comprobar(
      `[Sedes] una imageUrl ${nombre} no llega a un <img> (cae al placeholder)`,
      imgs(html).length === 0 && html.includes('data-venue-photo="placeholder"'),
    );
  }

  // Error de carga: el componente guarda QUÉ URL falló y cae al placeholder.
  // El `onError` no corre en render estático, así que se fija el fuente y la
  // decisión (la función pura la prueba `check:venues`).
  const foto = sinComentarios(await readFile(path.join(SRC, 'components/venues/VenuePhoto.tsx'), 'utf8'));
  comprobar(
    '[Sedes] si la foto falla al cargar, cae al placeholder (onError → failedSrc)',
    /onError=\{\(\) => setFailedSrc\(src\)\}/.test(foto) && /pickVenueImageSrc\(/.test(foto),
  );
}

// =================================================
// 3. Rankings — el pie dice el estado real del fixture
// =================================================
const COMPETENCIA_BASE = {
  id: 'c1',
  disciplineId: 'd1',
  categoryId: 'k1',
  stage: 'ZONAL',
  format: 'ROUND_ROBIN',
  status: 'FINALIZADA',
  startDate: null,
  endDate: null,
  createdAt: '2026-08-01T21:22:06.607Z',
  updatedAt: '2026-08-29T00:37:22.169Z',
  discipline: { id: 'd1', name: 'Fútbol 11' },
  category: { id: 'k1', name: 'Sub-14 Masculino' },
};

{
  const html = pintar(CompetitionCard, {
    competition: { ...COMPETENCIA_BASE, name: 'Torneo Zonal', _count: { matches: 0 } },
    index: 0,
  });
  const t = texto(html);

  comprobar(
    '[Rankings] sin partidos, no aparece "Ver Fixture"',
    !/ver fixture/i.test(t),
    `la tarjeta emite: "${t}"`,
  );
  comprobar(
    '[Rankings] sin partidos, no aparece "Posiciones"',
    !/posiciones/i.test(t),
    `la tarjeta emite: "${t}"`,
  );
  comprobar(
    '[Rankings] sin partidos, se dice que el fixture no está generado',
    /fixture a[úu]n no generado/i.test(t),
    `la tarjeta emite: "${t}"`,
  );
}

{
  const html = pintar(CompetitionCard, {
    competition: { ...COMPETENCIA_BASE, name: 'Torneo Provincial', _count: { matches: 12 } },
    index: 0,
  });
  const t = texto(html);
  comprobar(
    '[Rankings] con partidos, hay un enlace que nombra la cantidad',
    /12 partidos/.test(t),
    `la tarjeta emite: "${t}"`,
  );
  comprobar(
    '[Rankings] el singular está contemplado (1 partido, no "1 partidos")',
    !/\b1 partidos\b/.test(
      texto(pintar(CompetitionCard, {
        competition: { ...COMPETENCIA_BASE, name: 'X', _count: { matches: 1 } },
        index: 0,
      })),
    ),
  );
  comprobar(
    '[Rankings] el formato de la competencia se pinta',
    /todos contra todos/i.test(t),
    `la tarjeta emite: "${t}"`,
  );
}

{
  // R7: sin nombre ni relaciones, nunca "undefined - undefined".
  const html = pintar(CompetitionCard, {
    competition: {
      ...COMPETENCIA_BASE,
      name: null, discipline: undefined, category: undefined,
      _count: { matches: 0 },
    },
    index: 0,
  });
  const t = texto(html);
  comprobar(
    '[Rankings] sin nombre ni relaciones, no se emite "undefined"',
    !/undefined/i.test(t),
    `la tarjeta emite: "${t}"`,
  );
  comprobar(
    '[Rankings] el título de la tarjeta es un h2',
    JSON.stringify(niveles(html)) === '[2]',
    `niveles emitidos: ${JSON.stringify(niveles(html))}`,
  );
}

// =================================================
// 4. Calendario — tarjetas con ficha de fecha: lo que el encabezado promete, sin lo inventado
// =================================================
//
// "Próximos eventos" es una grilla de tarjetas por mes, cada una con su ficha
// de fecha (Propuesta A). Las reglas de siempre —no inventar descripción ni
// chips, sede y disciplina resueltas, nada de relleno— se verifican sobre la
// agenda renderizada, más las propias de A.
const EVENTO_BASE = {
  id: 'e1',
  title: 'Acto de Apertura Zonal Formosa',
  description: null,
  startDate: '2026-09-10T19:15:26.801Z',
  endDate: null,
  stage: 'ZONAL',
  venueId: '11111111-1111-1111-1111-111111111111',
  disciplineId: 'd1',
  isPublished: true,
  createdAt: '2026-08-21T19:15:26.809Z',
  updatedAt: '2026-08-21T19:15:26.809Z',
};

const SEDES_POR_ID = new Map([['11111111-1111-1111-1111-111111111111', 'Estadio Cincuentenario']]);
const DISCIPLINAS_POR_ID = new Map([['d1', 'Fútbol 11']]);
const HOY_FIJO = new Date(2026, 8, 1, 12, 0);

const agenda = (eventos, extra = {}) =>
  pintar(CalendarAgenda, {
    eventos,
    nombreDeSede: (e) => (e.venueId && SEDES_POR_ID.get(e.venueId)) || null,
    nombreDeDisciplina: (e) => (e.disciplineId && DISCIPLINAS_POR_ID.get(e.disciplineId)) || null,
    esPasado: false,
    hoy: HOY_FIJO,
    idPrefix: 'cal-proximos',
    ...extra,
  });

/** Clases de la tarjeta (el primer `<li class="grid …">`). */
const clasesDeTarjeta = (html) => /<li class="(grid[^"]*rounded-2xl[^"]*)"/.exec(html)?.[1] ?? '';

{
  const html = agenda([EVENTO_BASE]);
  const t = texto(html);

  comprobar(
    '[Calendario] con description null, no se inventa una descripción',
    !/evento oficial del cronograma/i.test(t),
    `la agenda emite: "${t}"`,
  );
  comprobar(
    '[Calendario] no aparece el chip decorativo "Competencia Oficial"',
    !/competencia oficial/i.test(t),
    `la agenda emite: "${t}"`,
  );
  comprobar(
    '[Calendario] no aparece el chip decorativo "Juegos Evita Formosa"',
    !/juegos evita formosa/i.test(t),
    `la agenda emite: "${t}"`,
  );
  comprobar(
    '[Calendario] la sede resuelta se pinta (es lo que el encabezado promete)',
    t.includes('Estadio Cincuentenario'),
    `la agenda emite: "${t}"`,
  );
  comprobar('[Calendario] la disciplina resuelta se pinta', t.includes('Fútbol 11'), `la agenda emite: "${t}"`);
  comprobar('[Calendario] el encabezado del mes dice "Septiembre 2026"', t.includes('Septiembre 2026'));
  comprobar(
    '[Calendario] cada mes es un h3 (bajo el h2 de su sección) y los eventos no son encabezados',
    JSON.stringify(niveles(html)) === '[3]',
    `niveles emitidos: ${JSON.stringify(niveles(html))}`,
  );

  // Ficha de fecha accesible: <time datetime> con la fecha completa en sr-only
  // y los tres textos visuales ocultos al lector.
  const ficha = /<time datetime="2026-09-10"[^>]*>([\s\S]*?)<\/time>/i.exec(html);
  comprobar('[Calendario] cada tarjeta lleva su ficha <time datetime="aaaa-mm-dd">', ficha !== null);
  comprobar(
    '[Calendario] la ficha se lee completa ("jueves 10 de septiembre") y sus fragmentos van aria-hidden',
    ficha !== null &&
      /<span class="sr-only">jueves 10 de septiembre<\/span>/i.test(ficha[1]) &&
      (ficha[1].match(/aria-hidden="true"/g) ?? []).length === 3,
    ficha?.[1],
  );
  comprobar('[Calendario] ficha de próximos en primary-800', /<time datetime="2026-09-10"[^>]*class="[^"]*bg-primary-800/i.test(html));

  // Meta en lista: hora, sede y disciplina, cada una con su rótulo para el lector.
  const meta = /<ul class="flex flex-col gap-1[^"]*">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '';
  comprobar('[Calendario] la hora va en la meta como <time> ISO, con "hs"', /<time datetime="2026-09-10T19:15:26.801Z">\d{2}:\d{2} hs<\/time>/i.test(meta), meta);
  comprobar('[Calendario] la sede va en la meta con su rótulo "Sede:" para el lector', /Sede: <\/span>Estadio Cincuentenario/.test(meta));
  comprobar('[Calendario] la disciplina va en la meta con su rótulo "Disciplina:"', /Disciplina: <\/span>Fútbol 11/.test(meta));

  // Etapa como chip legible, con las clases completas del mapa.
  comprobar(
    '[Calendario] la etapa es un chip legible ("Etapa Zonal" para el lector) con la clase del mapa',
    /<span class="[^"]*bg-celeste-100 text-celeste-800[^"]*">[\s\S]*?<span class="sr-only">Etapa <\/span>Zonal<\/span>/.test(html),
  );
  comprobar('[Calendario] el borde de la tarjeta es el de su etapa', clasesDeTarjeta(html).includes('border-l-celeste-500'));

  // Tarjeta no interactiva: nada que prometa un clic que no existe.
  const clases = clasesDeTarjeta(html);
  comprobar(
    '[Calendario] la tarjeta no tiene cursor-pointer, hover ni transición (no es un enlace)',
    clases !== '' && !/cursor-pointer|hover:|transition|translate/.test(clases),
    clases,
  );
}

{
  // Un id que no resuelve —sede borrada, id viejo— no puede producir un
  // "Sede a confirmar": el ítem directamente no aparece, ni un "—".
  const html = agenda([{ ...EVENTO_BASE, venueId: 'fantasma', disciplineId: null, stage: null }]);
  const t = texto(html);
  comprobar(
    '[Calendario] un venueId que no resuelve no produce ningún texto de relleno',
    !/a confirmar|sin sede|por definir|—/i.test(t),
    `la agenda emite: "${t}"`,
  );
  comprobar('[Calendario] sin sede ni disciplina, la meta sólo trae la hora', !/Sede:|Disciplina:/.test(html));
  comprobar('[Calendario] sin etapa no hay chip de etapa', !/Etapa </.test(html));
  comprobar('[Calendario] sin etapa el borde es neutro (primary-200)', clasesDeTarjeta(html).includes('border-l-primary-200'));
}

{
  const html = agenda([{ ...EVENTO_BASE, endDate: '2026-09-14T19:15:26.801Z' }]);
  const t = texto(html);
  comprobar('[Calendario] con endDate de otro día se muestra el rango ("10–14 sept")', /10–14/.test(t), `la agenda emite: "${t}"`);
  comprobar('[Calendario] el rango se lee completo ("del 10 al 14 de septiembre")', /del 10 al 14 de septiembre/.test(t));
  comprobar('[Calendario] el chip de rango no es celeste (no se confunde con Zonal)', /bg-primary-50 text-primary-700[^"]*"><span aria-hidden="true">10–14/.test(html));
}

{
  const hoy = new Date(EVENTO_BASE.startDate);
  const t = texto(agenda([EVENTO_BASE], { hoy }));
  comprobar('[Calendario] un evento de hoy lleva su chip "Hoy"', /\bhoy\b/i.test(t), `la agenda emite: "${t}"`);
  const pasado = agenda([EVENTO_BASE], { hoy, esPasado: true, idPrefix: 'cal-pasados' });
  comprobar('[Calendario] en "Ya se disputaron" no hay chip "Hoy"', !/\bhoy\b/i.test(texto(pasado)));

  // Un evento de varios días en curso (empezó antes y termina después de hoy).
  const enCurso = { ...EVENTO_BASE, startDate: '2026-09-08T15:00:00.000Z', endDate: '2026-09-12T15:00:00.000Z' };
  comprobar('[Calendario] un evento de varios días en curso hoy también lleva "Hoy"', /\bhoy\b/i.test(texto(agenda([enCurso], { hoy }))));
  comprobar(
    '[Calendario] … pero nunca en "Ya se disputaron"',
    !/\bhoy\b/i.test(texto(agenda([enCurso], { hoy, esPasado: true, idPrefix: 'cal-pasados' }))),
  );
  comprobar('[Calendario] un evento que todavía no empezó no lleva "Hoy"', !/\bhoy\b/i.test(texto(agenda([EVENTO_BASE]))));
}

{
  // Varios eventos el mismo día: una tarjeta cada uno, cada una con su ficha.
  const html = agenda([
    EVENTO_BASE,
    { ...EVENTO_BASE, id: 'e2', title: 'Torneo Relámpago de Ajedrez', startDate: '2026-09-10T21:00:00.000Z' },
    { ...EVENTO_BASE, id: 'e3', title: 'Final de Vóley', startDate: '2026-10-05T18:00:00.000Z' },
  ]);
  const fichas = html.match(/<time datetime="2026-09-10"[^>]*class="[^"]*rounded-xl/gi) ?? [];
  comprobar('[Calendario] dos eventos el mismo día: una tarjeta con su ficha cada uno', fichas.length === 2, `fichas: ${fichas.length}`);
  comprobar('[Calendario] los dos eventos del día se listan', texto(html).includes('Torneo Relámpago de Ajedrez'));
  comprobar(
    '[Calendario] un encabezado por mes, en el orden de la sección',
    JSON.stringify(niveles(html)) === '[3,3]' && texto(html).indexOf('Septiembre') < texto(html).indexOf('Octubre'),
    `niveles emitidos: ${JSON.stringify(niveles(html))}`,
  );

  // "Ya se disputaron": atenuado con la ficha primary-600, SIN opacity (con
  // opacity varios pares caían debajo de AA).
  const pasado = agenda([EVENTO_BASE], { esPasado: true, idPrefix: 'cal-pasados' });
  comprobar('[Calendario] "Ya se disputaron" lleva la ficha en primary-600', /<time datetime="2026-09-10"[^>]*class="[^"]*bg-primary-600/i.test(pasado));
  comprobar('[Calendario] "Ya se disputaron" se atenúa sin opacity (AA)', !/\bopacity-/.test(pasado));
  comprobar('[Calendario] los ids de los meses no chocan entre secciones', /id="cal-pasados-2026-09"/.test(pasado) && /id="cal-proximos-2026-09"/.test(agenda([EVENTO_BASE])));
}

{
  // Sin fecha legible: la tarjeta va sin ficha, en "Sin fecha confirmada".
  const html = agenda([{ ...EVENTO_BASE, startDate: 'no-es-una-fecha' }]);
  comprobar('[Calendario] una fecha ilegible va a "Sin fecha confirmada"', texto(html).includes('Sin fecha confirmada'));
  comprobar('[Calendario] sin fecha, la tarjeta no tiene ficha ni hora', !/<time/.test(html));
  comprobar('[Calendario] sin fecha, la tarjeta ocupa una sola columna', clasesDeTarjeta(html).includes('grid-cols-1'));
  comprobar('[Calendario] sin fecha, el evento igual se lista', texto(html).includes(EVENTO_BASE.title));
}

{
  // Lógica pura de la agenda.
  const meses = agruparPorMes([
    { ...EVENTO_BASE, id: 'a', startDate: '2026-10-05T18:00:00.000Z' },
    { ...EVENTO_BASE, id: 'b', startDate: '2026-09-10T18:00:00.000Z' },
    { ...EVENTO_BASE, id: 'c', startDate: 'no-es-una-fecha' },
  ]);
  comprobar(
    '[Calendario] agruparPorMes respeta el orden de entrada (sirve para próximos ↑ y pasados ↓)',
    meses[0]?.titulo === 'Octubre 2026' && meses[1]?.titulo === 'Septiembre 2026',
    JSON.stringify(meses.map((m) => m.titulo)),
  );
  comprobar(
    '[Calendario] una fecha ilegible no se descarta: va a "Sin fecha confirmada"',
    meses.at(-1)?.titulo === 'Sin fecha confirmada' && meses.at(-1)?.dias[0]?.eventos.length === 1,
  );
  comprobar(
    '[Calendario] el rango que cruza de mes nombra los dos meses',
    /30 sept? – 2 oct/.test(rangoDeDias({ ...EVENTO_BASE, startDate: '2026-09-30T15:00:00.000Z', endDate: '2026-10-02T15:00:00.000Z' }) ?? ''),
    rangoDeDias({ ...EVENTO_BASE, startDate: '2026-09-30T15:00:00.000Z', endDate: '2026-10-02T15:00:00.000Z' }),
  );
  comprobar('[Calendario] un evento de un día no tiene rango', rangoDeDias(EVENTO_BASE) === null);
  comprobar(
    '[Calendario] ocurreHoy: un evento de varios días está "hoy" en todo su rango (por día)',
    ocurreHoy({ ...EVENTO_BASE, startDate: '2026-09-08T23:00:00.000Z', endDate: '2026-09-12T02:00:00.000Z' }, new Date(2026, 8, 10, 12)) &&
      !ocurreHoy({ ...EVENTO_BASE, startDate: '2026-09-08T15:00:00.000Z', endDate: '2026-09-09T15:00:00.000Z' }, new Date(2026, 8, 10, 12)),
  );
  comprobar('[Calendario] ocurreHoy con fecha ilegible es falso', !ocurreHoy({ ...EVENTO_BASE, startDate: 'x' }, new Date()));
}

// =================================================
// 5. El esquema de encabezados de cada página no salta niveles
// =================================================
//
// Las tarjetas de arriba ya se verificaron renderizadas. Lo que falta es el
// nivel del que cuelgan, y eso vive en la página. Montar las cuatro páginas
// pediría el QueryClient, el router y los 30 chunks lazy para comprobar una
// propiedad sintáctica, así que se lee el fuente — el mismo criterio con el que
// `check-nav-roles.mjs` barre `router.tsx`.
{
  const PAGINAS = [
    { archivo: 'DisciplinesPage.tsx', tarjeta: 2, seccion: false },
    { archivo: 'VenuesPage.tsx', tarjeta: 2, seccion: false },
    { archivo: 'RankingsPage.tsx', tarjeta: 2, seccion: false },
    // Calendario es la única con un nivel intermedio: las secciones "Próximos"
    // y "Ya se disputaron" son h2 y los meses cuelgan de ellas como h3; las
    // tarjetas de evento no son encabezados.
    { archivo: 'CalendarPage.tsx', tarjeta: 3, seccion: true },
  ];

  for (const { archivo, seccion } of PAGINAS) {
    const fuente = sinComentarios(
      await readFile(path.join(SRC, 'pages', 'public', archivo), 'utf8'),
    );

    comprobar(
      `[${archivo}] el h1 lo pone PublicPageHeader, no la página`,
      !/<h1[\s>]/.test(fuente) && fuente.includes('PublicPageHeader'),
    );
    comprobar(
      `[${archivo}] la página no emite h4/h5/h6 sueltos`,
      !/<h[456][\s>]/.test(fuente),
    );
    if (seccion) {
      comprobar(
        `[${archivo}] declara los h2 de sección de los que cuelgan los h3 de evento`,
        /<h2[\s>]/.test(fuente),
        'sin un h2 de sección, el h3 del evento salta un nivel bajo el h1',
      );
    }
  }
}

// =================================================
// 6. Ninguna clase de Tailwind armada por interpolación
// =================================================
//
// El bug D1: `` `group-hover:${CARD_GRADIENTS[i]}` `` en DisciplinesPage.
// Tailwind escanea el fuente buscando clases escritas tal cual, así que esa
// clase nunca se generó: quedaba `group-hover:text-white` sobre un
// `bg-primary-100` que no cambiaba, o sea blanco sobre #d6e4f4 = 1.29:1, y el
// icono desaparecía al pasar el mouse. Es un fallo de accesibilidad disparado
// por una interacción, y no lo agarra ningún linter.
{
  const ARCHIVOS = [
    'pages/public/DisciplinesPage.tsx',
    'pages/public/VenuesPage.tsx',
    'pages/public/RankingsPage.tsx',
    'pages/public/CalendarPage.tsx',
    'pages/public/disciplines/DisciplineCard.tsx',
    'pages/public/venues/VenueCard.tsx',
    'pages/public/rankings/CompetitionCard.tsx',
    'pages/public/calendar/CalendarAgenda.tsx',
    'pages/public/calendar/CalendarFiltersPanel.tsx',
    'pages/public/calendar/eventStageStyles.ts',
    'components/shared/CardGridSkeleton.tsx',
    'components/venues/VenuePhoto.tsx',
    'lib/gridVolumen.ts',
  ];

  // Prefijos de utilidades de Tailwind seguidos de una interpolación: es la
  // forma exacta que Tailwind no puede ver.
  const INTERPOLADA =
    /(?:^|[\s"'`])(?:hover:|focus:|group-hover:|focus-visible:|sm:|md:|lg:|xl:)*(?:bg|text|border|from|to|via|grid-cols|col-span|w|h|p|m|gap|rounded|shadow|ring|opacity)-\$\{/;

  for (const relativo of ARCHIVOS) {
    const fuente = await readFile(path.join(SRC, relativo), 'utf8');
    const linea = fuente
      .split('\n')
      .find((l) => INTERPOLADA.test(l) && !l.trimStart().startsWith('*'));

    comprobar(
      `[${relativo}] no arma clases de Tailwind por interpolación`,
      linea === undefined,
      linea && `Tailwind no genera esa clase: ${linea.trim()}`,
    );
  }
}

// =================================================
// 7. Colores fuera de la paleta institucional
// =================================================
//
// R2: `amber-800`/`amber-50` son de la paleta default de Tailwind. El proyecto
// tiene `accent-*` (el dorado institucional) exactamente para eso.
{
  const ARCHIVOS = [
    'pages/public/DisciplinesPage.tsx',
    'pages/public/VenuesPage.tsx',
    'pages/public/RankingsPage.tsx',
    'pages/public/CalendarPage.tsx',
    'pages/public/disciplines/DisciplineCard.tsx',
    'pages/public/venues/VenueCard.tsx',
    'pages/public/rankings/CompetitionCard.tsx',
    'pages/public/calendar/CalendarAgenda.tsx',
    'pages/public/calendar/CalendarFiltersPanel.tsx',
    'pages/public/calendar/eventStageStyles.ts',
    'components/venues/VenuePhoto.tsx',
  ];
  // Las de la paleta default que no son tokens del proyecto.
  const FUERA_DE_PALETA = /\b(?:text|bg|border|from|to|via)-(?:amber|yellow|orange|sky|indigo|emerald|teal|rose|violet)-\d{2,3}\b/;

  for (const relativo of ARCHIVOS) {
    const fuente = sinComentarios(await readFile(path.join(SRC, relativo), 'utf8'));
    const halladas = fuente.match(new RegExp(FUERA_DE_PALETA, 'g'));
    comprobar(
      `[${relativo}] usa sólo los tokens de la paleta institucional`,
      halladas === null,
      halladas && `fuera de paleta: ${[...new Set(halladas)].join(', ')}`,
    );
  }
}

// =================================================
// 8. Contraste: los usos que estaban por debajo de AA
// =================================================
//
// Ratios calculados con la fórmula WCAG 2.1 de luminancia relativa sobre los
// hex de `index.css`. `primary-400` (#5185ce) sobre blanco da 3.75:1, que no
// llega al 4.5:1 que AA pide para texto normal — y en las sedes ese color
// pintaba la localidad, que es información, no decoración.
{
  const ARCHIVOS = [
    'pages/public/venues/VenueCard.tsx',
    'pages/public/calendar/CalendarAgenda.tsx',
    'pages/public/calendar/CalendarFiltersPanel.tsx',
    'pages/public/calendar/eventStageStyles.ts',
    'pages/public/disciplines/DisciplineCard.tsx',
    'pages/public/rankings/CompetitionCard.tsx',
  ];
  for (const relativo of ARCHIVOS) {
    const fuente = sinComentarios(await readFile(path.join(SRC, relativo), 'utf8'));
    comprobar(
      `[${relativo}] no pinta texto con primary-400 sobre blanco (3.75:1 < 4.5:1)`,
      !/\btext-primary-400\b/.test(fuente),
      'usar primary-600 (9.26:1)',
    );
  }
  const disciplinas = sinComentarios(
    await readFile(path.join(SRC, 'pages/public/disciplines/DisciplineCard.tsx'), 'utf8'),
  );
  comprobar(
    '[DisciplineCard] no hay hover a texto blanco sobre un fondo claro (1.29:1)',
    !/group-hover:text-white/.test(disciplinas),
    'el degradé que lo justificaba nunca se generó: era texto blanco sobre primary-100',
  );
  comprobar(
    '[DisciplineCard] CARD_GRADIENTS (6 constantes muertas) fue eliminado',
    !/CARD_GRADIENTS/.test(disciplinas),
  );
}

// =================================================
// 9. Las tarjetas-enlace se comportan como bloques (U06)
// =================================================
//
// Un `<a>` sin `display:block` es inline: el `h-full` de la tarjeta no estira
// —alturas desparejas en la grilla— y el contorno de `:focus-visible` se dibuja
// sobre una caja inline, que puede partirse en dos entre líneas.
{
  const enlaces = [
    ['[Disciplinas]', pintar(DisciplineCard, {
      discipline: { ...DISCIPLINA_BASE, rules: 'x', _count: { categories: 1 } },
      index: 0,
    })],
    ['[Rankings]', pintar(CompetitionCard, {
      competition: { ...COMPETENCIA_BASE, name: 'X', _count: { matches: 0 } },
      index: 0,
    })],
  ];

  for (const [pagina, html] of enlaces) {
    const clasesDelEnlace = /<a [^>]*class="([^"]*)"/.exec(html)?.[1] ?? '';
    comprobar(
      `${pagina} la tarjeta-enlace es un bloque de alto completo`,
      /\bblock\b/.test(clasesDelEnlace) && /\bh-full\b/.test(clasesDelEnlace),
      `clases del <a>: "${clasesDelEnlace}"`,
    );
    comprobar(
      `${pagina} el contorno de foco sigue el radio de la tarjeta`,
      /\brounded-/.test(clasesDelEnlace),
      `clases del <a>: "${clasesDelEnlace}"`,
    );
  }

  // Anti-patrón: nada de simular un enlace con un onClick sobre un div.
  for (const relativo of [
    'pages/public/disciplines/DisciplineCard.tsx',
    'pages/public/venues/VenueCard.tsx',
    'pages/public/rankings/CompetitionCard.tsx',
    'pages/public/calendar/CalendarAgenda.tsx',
    'pages/public/calendar/CalendarFiltersPanel.tsx',
    'pages/public/calendar/eventStageStyles.ts',
  ]) {
    const fuente = sinComentarios(await readFile(path.join(SRC, relativo), 'utf8'));
    comprobar(
      `[${relativo}] no simula un enlace con onClick sobre un div`,
      !/<div[^>]*onClick/.test(fuente),
    );
  }
}

// =================================================
// 10. columnasSegunVolumen — la tabla de cortes, caso por caso
// =================================================
{
  const CASOS = [
    [0, ['grid-cols-1']],
    [1, ['grid-cols-1', 'max-w-xl']],
    [2, ['sm:grid-cols-2']],
    [3, ['sm:grid-cols-2', 'lg:grid-cols-3']],
    [4, ['sm:grid-cols-2', 'lg:grid-cols-4']],
    [5, ['sm:grid-cols-2', 'lg:grid-cols-3']],
    [8, ['sm:grid-cols-2', 'lg:grid-cols-3']],
    [9, ['sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4']],
    [60, ['sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4']],
  ];

  for (const [cantidad, esperadas] of CASOS) {
    const clases = columnasSegunVolumen(cantidad).split(/\s+/);
    comprobar(
      `[grilla] con ${cantidad} tarjetas: ${esperadas.join(' ')}`,
      esperadas.every((c) => clases.includes(c)),
      `devolvió "${columnasSegunVolumen(cantidad)}"`,
    );
  }

  // Los tres casos que hoy se ven mal en producción, nombrados.
  comprobar(
    '[grilla] 1 competencia (Rankings hoy) no queda huérfana en una fila de 3',
    columnasSegunVolumen(1).includes('max-w-xl') &&
      !columnasSegunVolumen(1).includes('lg:grid-cols-3'),
  );
  comprobar(
    '[grilla] 3 sedes (Sedes hoy) llenan una fila exacta en LG',
    columnasSegunVolumen(3).includes('lg:grid-cols-3'),
  );
  comprobar(
    '[grilla] 5 disciplinas (Disciplinas hoy) van a 3 columnas, nunca a 4',
    columnasSegunVolumen(5).includes('lg:grid-cols-3') &&
      !columnasSegunVolumen(5).includes('grid-cols-4'),
  );

  // Y que sean literales: si alguna rama trajera un `${`, Tailwind no la vería.
  for (const [cantidad] of CASOS) {
    comprobar(
      `[grilla] las clases de ${cantidad} son literales, sin interpolación`,
      !columnasSegunVolumen(cantidad).includes('${'),
    );
  }
}

// =================================================
// 11. Las cuatro páginas usan la base compartida (U03)
// =================================================
{
  for (const archivo of [
    'DisciplinesPage.tsx',
    'VenuesPage.tsx',
    'RankingsPage.tsx',
    'CalendarPage.tsx',
  ]) {
    const fuente = sinComentarios(
      await readFile(path.join(SRC, 'pages', 'public', archivo), 'utf8'),
    );
    comprobar(
      `[${archivo}] usa PublicListState (que es lo que anuncia la carga)`,
      fuente.includes('PublicListState'),
    );
    comprobar(
      `[${archivo}] no quedó ningún Loader2 suelto`,
      !fuente.includes('Loader2'),
      'el spinner centrado colapsa el alto y produce CLS; va CardGridSkeleton',
    );
    comprobar(
      `[${archivo}] recorre la paginación entera (nada de filtrar sobre 20 filas)`,
      /use(All\w+|AllCalendarEvents)\(/.test(fuente),
      'los filtros en memoria sobre la primera página son el bug R29/S06/S13',
    );
  }

  // V1: el contador del encabezado sale de meta.total, no de data.length.
  const sedes = sinComentarios(
    await readFile(path.join(SRC, 'pages', 'public', 'VenuesPage.tsx'), 'utf8'),
  );
  comprobar(
    '[VenuesPage] el contador no sale de `data.length` (que es la página, no el total)',
    !/data\.length/.test(sedes),
  );

  // R5: STATUS_BADGE.BORRADOR era inalcanzable (se filtra antes de pintar).
  const tarjetaCompetencia = sinComentarios(
    await readFile(path.join(SRC, 'pages/public/rankings/CompetitionCard.tsx'), 'utf8'),
  );
  comprobar(
    '[CompetitionCard] no queda el estilo muerto de BORRADOR',
    !/BORRADOR:/.test(tarjetaCompetencia),
    'la página descarta los borradores antes de pintar: esa rama no se alcanza nunca',
  );
}

// =================================================
// 12. Noticias — la fecha es la de PUBLICACIÓN, nunca la del sync
// =================================================
//
// El bug: las tarjetas mostraban `createdAt`, que para una nota del portal
// oficial es el momento en que el sync la trajo. Una nota del 23/9 sincronizada
// hoy se veía "de hoy" en la grilla y "hace 1 min" en el mosaico. La fecha real
// está en `publishedAt` (el portal da sólo el día, anclado a las 12:00 UTC).
{
  const ahora = new Date();
  // Más de una semana atrás siempre: el mosaico tiene que mostrar la fecha.
  const PUBLICADA = '2026-08-20T12:00:00.000Z';
  const NOTA_DEL_PORTAL = {
    id: 'n1',
    title: 'Las chicas de Belgrano, campeonas',
    slug: 'las-chicas-de-belgrano-campeonas-formosa-34709',
    content: 'Bajada de la nota.',
    excerpt: 'Bajada de la nota.',
    imageKey: null,
    isPublished: true,
    publishedAt: PUBLICADA,
    authorId: null,
    sourceUrl: 'https://www.formosa.gob.ar/noticia/34709/0/x',
    sourceName: 'Secretaría de Deportes',
    isExternal: true,
    // El momento del sync: hace un minuto.
    createdAt: new Date(ahora.getTime() - 60_000).toISOString(),
    updatedAt: new Date(ahora.getTime() - 60_000).toISOString(),
  };
  const fechaReal = formatDate(PUBLICADA);
  const fechaDelSync = formatDate(NOTA_DEL_PORTAL.createdAt);
  const relativaDelSync = /\b(recién|hace \d+ (min|h))\b/;

  const tarjetas = [
    ['NewsCard', pintar(NewsCard, { news: NOTA_DEL_PORTAL, index: 0 })],
    ['FeaturedNewsCard', pintar(FeaturedNewsCard, { news: NOTA_DEL_PORTAL })],
    ['NewsMosaicCard', pintar(NewsMosaicCard, { news: NOTA_DEL_PORTAL, tamano: 'grande' })],
    ['NewsSidebarList', pintar(NewsSidebarList, { news: [NOTA_DEL_PORTAL] })],
  ];

  for (const [nombre, html] of tarjetas) {
    const visible = texto(html);
    comprobar(
      `[${nombre}] muestra la fecha de publicación del portal (${fechaReal})`,
      visible.includes(fechaReal),
      `texto visible: "${visible.slice(0, 160)}"`,
    );
    comprobar(
      `[${nombre}] no muestra la fecha en que la trajo el sync (${fechaDelSync})`,
      !visible.includes(fechaDelSync),
    );
    comprobar(
      `[${nombre}] no dice "hace N min/h" a partir del momento del sync`,
      !relativaDelSync.test(visible),
      `texto visible: "${visible.slice(0, 160)}"`,
    );
  }

  // Antigüedad del mosaico: en días para las del portal (el portal sólo da el
  // día), y "hoy/ayer" según el calendario de Formosa, no el UTC.
  const delPortal = (publishedAt) => ({ ...NOTA_DEL_PORTAL, publishedAt });
  const mediodiaFormosa = new Date('2026-10-01T15:00:00.000Z'); // 12:00 ART
  const casiMedianoche = new Date('2026-10-02T02:30:00.000Z'); // 23:30 ART del 1/10
  const casos = [
    ['2026-10-01T12:00:00.000Z', mediodiaFormosa, 'hoy'],
    ['2026-09-30T12:00:00.000Z', mediodiaFormosa, 'ayer'],
    ['2026-09-28T12:00:00.000Z', mediodiaFormosa, 'hace 3 d'],
    ['2026-10-01T12:00:00.000Z', casiMedianoche, 'hoy'],
    ['2026-09-10T12:00:00.000Z', mediodiaFormosa, formatDate('2026-09-10T12:00:00.000Z')],
  ];
  for (const [publicada, momento, esperado] of casos) {
    const obtenido = antiguedadDeNoticia(
      { ...delPortal(publicada), createdAt: new Date(momento.getTime() - 60_000).toISOString() },
      momento,
    );
    comprobar(
      `[antiguedadDeNoticia] nota del portal del ${publicada.slice(0, 10)} vista el ${momento.toISOString()} → "${esperado}"`,
      obtenido === esperado,
      `dio "${obtenido}"`,
    );
  }

  // Una nota propia sí tiene hora real de publicación: ahí la antigüedad en
  // horas es cierta, y sale de `publishedAt`, no de cuándo se creó el borrador.
  const propia = {
    ...NOTA_DEL_PORTAL,
    isExternal: false,
    sourceUrl: null,
    sourceName: null,
    publishedAt: new Date(ahora.getTime() - 3 * 3_600_000).toISOString(),
    createdAt: new Date(ahora.getTime() - 5 * 86_400_000).toISOString(),
  };
  comprobar(
    '[antiguedadDeNoticia] nota propia: cuenta desde que se publicó (hace 3 h), no desde el borrador',
    antiguedadDeNoticia(propia, ahora) === 'hace 3 h',
    `dio "${antiguedadDeNoticia(propia, ahora)}"`,
  );
  comprobar(
    '[fechaDePublicacion] cae a createdAt sólo si no hay publishedAt',
    fechaDePublicacion({ publishedAt: null, createdAt: PUBLICADA }) === PUBLICADA &&
      fechaDePublicacion(NOTA_DEL_PORTAL) === PUBLICADA &&
      fechaDeNoticia(NOTA_DEL_PORTAL) === fechaReal,
  );

  // Las vistas que no se pueden pintar sin la API (detalle, portada de la
  // landing) y cualquier componente nuevo de noticias: ninguno lee `createdAt`
  // directo. La fecha sale del helper único de `newsSource.ts`.
  const vistasDeNoticias = [
    'pages/public/NewsDetailPage.tsx',
    'pages/public/NewsPage.tsx',
    'pages/public/home/LatestNewsSection.tsx',
    ...(await readdir(path.join(SRC, 'pages/public/news')))
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => `pages/public/news/${f}`),
  ];
  for (const archivo of vistasDeNoticias) {
    const fuente = sinComentarios(await readFile(path.join(SRC, archivo), 'utf8'));
    comprobar(
      `[${archivo}] no muestra \`createdAt\` (la fecha es la de publicación)`,
      !/\.createdAt\b/.test(fuente),
      'usar fechaDeNoticia / antiguedadDeNoticia de news/newsSource.ts',
    );
  }
}

// -------------------------------------------------
// Salida
// -------------------------------------------------
console.log(`Chequeos ejecutados: ${verificaciones.length}`);

if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} afirmación(es) que el dato no sostiene:\n`);
  for (const p of problemas) console.error(`  · ${p}`);
  process.exit(1);
}

console.log('✅ Ninguna tarjeta pública afirma lo que el dato no sostiene.');
