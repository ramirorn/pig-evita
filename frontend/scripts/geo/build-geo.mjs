// ===========================================
// geo:build — prepara el mapa de Formosa a partir de los datos del IGN
//
// Entrada (datos públicos oficiales del Instituto Geográfico Nacional, licencia
// CC BY 4.0, descargados a mano en `scripts/geo/ign/`):
//   · municipios.json        37 polígonos: municipios, comisiones de fomento y
//                            una junta vecinal con ejido propio.
//   · departamentos.json     9 departamentos, muy detallados (1,4 MB).
//   · gobiernos-locales.json 55 gobiernos locales como PUNTOS.
//
// Salida: `src/lib/geo/formosa.generated.ts`, un módulo TS estático con los
// paths SVG ya proyectados y simplificados. Se commitea: el build de la app no
// corre este script ni lee los JSON del IGN.
//
// Sin dependencias: proyección equirectangular con corrección por la latitud
// media (en una provincia de 4° de alto la deformación es despreciable para un
// mapa de calor) y Douglas-Peucker para simplificar.
//
// Corre con: npm run geo:build
// ===========================================
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..', '..');
const IGN = path.join(import.meta.dirname, 'ign');
const SALIDA = path.join(RAIZ, 'src', 'lib', 'geo', 'formosa.generated.ts');

/** Ancho del viewBox. El alto sale de la proporción real de la provincia. */
const ANCHO = 1000;
const MARGEN = 4;
/** Tolerancias de Douglas-Peucker, en unidades del viewBox. */
const TOLERANCIA_AREAS = 0.5;
const TOLERANCIA_DEPARTAMENTOS = 1.0;
/** Anillos más chicos que esto (en unidades² del viewBox) no se dibujan. */
const AREA_MINIMA_AREAS = 2;
const AREA_MINIMA_DEPARTAMENTOS = 12;

const leer = async (nombre) => JSON.parse(await readFile(path.join(IGN, nombre), 'utf8'));

const municipios = await leer('municipios.json');
const departamentos = await leer('departamentos.json');
const gobiernos = await leer('gobiernos-locales.json');

// -------------------------------------------------
// Proyección
// -------------------------------------------------
let minLon = Infinity;
let maxLon = -Infinity;
let minLat = Infinity;
let maxLat = -Infinity;
for (const f of departamentos.features) {
  for (const poligono of f.geometry.coordinates) {
    for (const anillo of poligono) {
      for (const [lon, lat] of anillo) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }
}

const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
const escala = (ANCHO - 2 * MARGEN) / ((maxLon - minLon) * cosLat);
const ALTO = Math.ceil((maxLat - minLat) * escala + 2 * MARGEN);

const proyectar = ([lon, lat]) => [
  MARGEN + (lon - minLon) * cosLat * escala,
  MARGEN + (maxLat - lat) * escala,
];

// -------------------------------------------------
// Simplificación (Douglas-Peucker iterativo)
// -------------------------------------------------
function distanciaASegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const largo2 = dx * dx + dy * dy;
  if (largo2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function douglasPeucker(puntos, tolerancia) {
  if (puntos.length < 3) return puntos;
  const conservar = new Uint8Array(puntos.length);
  conservar[0] = 1;
  conservar[puntos.length - 1] = 1;
  const pila = [[0, puntos.length - 1]];
  while (pila.length > 0) {
    const [ini, fin] = pila.pop();
    let maxDist = 0;
    let indice = -1;
    for (let i = ini + 1; i < fin; i++) {
      const d = distanciaASegmento(puntos[i], puntos[ini], puntos[fin]);
      if (d > maxDist) {
        maxDist = d;
        indice = i;
      }
    }
    if (indice !== -1 && maxDist > tolerancia) {
      conservar[indice] = 1;
      pila.push([ini, indice], [indice, fin]);
    }
  }
  return puntos.filter((_, i) => conservar[i] === 1);
}

function areaAnillo(puntos) {
  let s = 0;
  for (let i = 0; i < puntos.length; i++) {
    const [x1, y1] = puntos[i];
    const [x2, y2] = puntos[(i + 1) % puntos.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Área (en unidades² del viewBox) del anillo exterior más grande. */
function areaExteriorMayor(multipoligono) {
  return Math.max(
    ...multipoligono.map(([exterior]) => areaAnillo(exterior.slice(0, -1).map(proyectar))),
  );
}

/**
 * MultiPolygon → atributo `d` de un `<path>`, con coordenadas relativas
 * redondeadas a un decimal (el grueso del ahorro de bytes está acá).
 */
function aPath(multipoligono, tolerancia, areaMinima) {
  const partes = [];
  // El anillo más grande se dibuja siempre, aunque sea más chico que el mínimo:
  // un ejido diminuto (Portón Negro) no puede desaparecer del mapa.
  const areaMayor = areaExteriorMayor(multipoligono);
  for (const poligono of multipoligono) {
    for (const anillo of poligono) {
      const proyectado = anillo.map(proyectar);
      // Un anillo cerrado repite el primer punto al final: DP necesita los dos
      // extremos distintos para no colapsarlo.
      const abierto = proyectado.slice(0, -1);
      const area = areaAnillo(abierto);
      if (abierto.length < 3 || (area < areaMinima && area < areaMayor)) continue;
      const simple = douglasPeucker(proyectado, tolerancia).slice(0, -1);
      if (simple.length < 3) continue;

      const r = (n) => Math.round(n * 10);
      let [px, py] = [r(simple[0][0]), r(simple[0][1])];
      let d = `M${(px / 10).toString()} ${(py / 10).toString()}l`;
      const pasos = [];
      for (let i = 1; i < simple.length; i++) {
        const [x, y] = [r(simple[i][0]), r(simple[i][1])];
        if (x === px && y === py) continue;
        pasos.push(`${((x - px) / 10).toString()} ${((y - py) / 10).toString()}`);
        [px, py] = [x, y];
      }
      if (pasos.length < 2) continue;
      d += pasos.join(' ').replace(/ -/g, '-') + 'z';
      partes.push(d);
    }
  }
  return partes.join('');
}

// -------------------------------------------------
// Utilidades geométricas (en lon/lat)
// -------------------------------------------------
function puntoEnAnillo([x, y], anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function puntoEnMultipoligono(p, multi) {
  return multi.some(
    ([exterior, ...huecos]) =>
      puntoEnAnillo(p, exterior) && !huecos.some((h) => puntoEnAnillo(p, h)),
  );
}

/** Centroide del anillo exterior más grande: sirve de ancla para el tooltip. */
function centroide(multi) {
  let mejor = null;
  let mejorArea = -1;
  for (const [exterior] of multi) {
    const a = areaAnillo(exterior);
    if (a > mejorArea) {
      mejorArea = a;
      mejor = exterior;
    }
  }
  let cx = 0;
  let cy = 0;
  for (const [x, y] of mejor) {
    cx += x;
    cy += y;
  }
  return [cx / mejor.length, cy / mejor.length];
}

// -------------------------------------------------
// Rótulos de departamento
// -------------------------------------------------
//
// El rótulo tiene que caber ENTERO dentro de su departamento: ni cortado
// contra el borde del mapa ni pisando al vecino. Se prueban diseños de mayor a
// menor (una línea a 21, 18 y 15; dos líneas a 18 y 15) y, para el primero
// que entra, se devuelven varias posiciones candidatas ordenadas por holgura
// (distancia al borde). El componente elige la primera que no choque con una
// burbuja; por eso son varias y separadas entre sí.

/** Ancho estimado de un texto en mayúsculas con `letter-spacing`. */
const anchoRotulo = (texto, tamano) => texto.length * (tamano * 0.7 + 1.5);

function distanciaABorde(p, anillos) {
  let min = Infinity;
  for (const anillo of anillos) {
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      min = Math.min(min, distanciaASegmento(p, anillo[j], anillo[i]));
    }
  }
  return min;
}

function cajaAdentro([cx, cy], w, h, anillos, multi) {
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  // Se muestrea el perímetro de la caja cada ~6 unidades.
  const pasosX = Math.max(2, Math.ceil(w / 6));
  const pasosY = Math.max(2, Math.ceil(h / 6));
  const puntos = [];
  for (let i = 0; i <= pasosX; i++) {
    const x = x0 + (w * i) / pasosX;
    puntos.push([x, y0], [x, y0 + h]);
  }
  for (let j = 0; j <= pasosY; j++) {
    const y = y0 + (h * j) / pasosY;
    puntos.push([x0, y], [x0 + w, y]);
  }
  if (x0 < 2 || y0 < 2 || x0 + w > ANCHO - 2 || y0 + h > ALTO - 2) return false;
  return puntos.every((p) => puntoEnMultipoligono(p, multi)) && distanciaABorde([cx, cy], anillos) >= h / 2;
}

function partirEnDos(nombre) {
  const palabras = nombre.split(' ');
  if (palabras.length < 2) return null;
  let mejor = null;
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(' ');
    const b = palabras.slice(i).join(' ');
    if (!mejor || Math.max(a.length, b.length) < Math.max(mejor[0].length, mejor[1].length)) mejor = [a, b];
  }
  return mejor;
}

function ubicarRotulo(nombre, multiProyectado) {
  const texto = nombre.toUpperCase();
  const dos = partirEnDos(texto);
  const disenos = [
    { lines: [texto], size: 21 },
    { lines: [texto], size: 18 },
    ...(dos ? [{ lines: dos, size: 18 }] : []),
    { lines: [texto], size: 15 },
    ...(dos ? [{ lines: dos, size: 15 }] : []),
    { lines: [texto], size: 12 },
  ];
  const anillos = multiProyectado.flat();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const anillo of anillos) for (const [x, y] of anillo) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  for (const diseno of disenos) {
    const w = Math.max(...diseno.lines.map((l) => anchoRotulo(l, diseno.size))) + 8;
    const h = diseno.lines.length * diseno.size * 1.2 + 6;
    const candidatos = [];
    for (let y = minY; y <= maxY; y += 5) {
      for (let x = minX; x <= maxX; x += 5) {
        if (!cajaAdentro([x, y], w, h, anillos, multiProyectado)) continue;
        candidatos.push({ x, y, holgura: distanciaABorde([x, y], anillos) });
      }
    }
    if (candidatos.length === 0) continue;
    candidatos.sort((a, b) => b.holgura - a.holgura);
    const elegidos = [];
    for (const c of candidatos) {
      if (elegidos.every((e) => Math.hypot(e.x - c.x, e.y - c.y) >= 45)) elegidos.push(c);
      if (elegidos.length === 6) break;
    }
    return {
      lines: diseno.lines,
      size: diseno.size,
      width: Math.round(w),
      height: Math.round(h),
      anchors: elegidos.map((e) => [redondear(e.x), redondear(e.y)]),
    };
  }
  throw new Error(`El rótulo de ${nombre} no entra en ningún diseño`);
}

const departamentoDe = (lonLat) =>
  departamentos.features.find((d) => puntoEnMultipoligono(lonLat, d.geometry.coordinates))
    ?.properties.nam ?? null;

const TIPO = {
  Municipio: 'MUNICIPIO',
  Comisión: 'COMISION_FOMENTO',
  Junta: 'JUNTA_VECINAL',
};

const tipoDe = (gna) => {
  const tipo = TIPO[gna];
  if (!tipo) throw new Error(`Tipo de gobierno local desconocido: ${gna}`);
  return tipo;
};

const redondear = (n) => Math.round(n * 10) / 10;

// Punto oficial de cada gobierno local, por código INDEC.
const puntoPorCodigo = new Map(
  gobiernos.features.map((f) => [f.properties.in1, f.geometry.coordinates[0]]),
);

// -------------------------------------------------
// Áreas: municipios, comisiones de fomento y la junta con ejido
// -------------------------------------------------
const areas = municipios.features
  .map((f) => {
    const multi = f.geometry.coordinates;
    const ancla = puntoPorCodigo.get(f.properties.in1);
    // El punto oficial puede caer fuera del polígono simplificado o del propio
    // ejido (pasa con ejidos muy irregulares): en ese caso se usa el centroide.
    const referencia = ancla && puntoEnMultipoligono(ancla, multi) ? ancla : centroide(multi);
    const [lx, ly] = proyectar(referencia);
    const departamento = departamentoDe(referencia);
    if (!departamento) throw new Error(`Sin departamento: ${f.properties.nam}`);
    return {
      id: f.properties.in1,
      name: f.properties.nam,
      kind: tipoDe(f.properties.gna),
      department: departamento,
      d: aPath(multi, TOLERANCIA_AREAS, AREA_MINIMA_AREAS),
      // Un ejido de menos de ~12×12 unidades es difícil de acertar con el dedo:
      // el componente le suma un marcador clickeable encima.
      small: areaExteriorMayor(multi) < 150,
      labelX: redondear(lx),
      labelY: redondear(ly),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

const conArea = new Set(areas.map((a) => a.id));

// -------------------------------------------------
// Puntos: los gobiernos locales que no tienen polígono propio
// -------------------------------------------------
const puntos = gobiernos.features
  .filter((f) => !conArea.has(f.properties.in1))
  .map((f) => {
    const lonLat = f.geometry.coordinates[0];
    const [x, y] = proyectar(lonLat);
    const departamento = departamentoDe(lonLat);
    if (!departamento) throw new Error(`Sin departamento: ${f.properties.nam}`);
    return {
      id: f.properties.in1,
      name: f.properties.nam,
      kind: tipoDe(f.properties.gna),
      department: departamento,
      x: redondear(x),
      y: redondear(y),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

// -------------------------------------------------
// Departamentos: sólo contornos de referencia
// -------------------------------------------------
const deptos = departamentos.features
  .map((f) => {
    const multi = f.geometry.coordinates;
    // Para ubicar el rótulo alcanza con la geometría simplificada.
    const multiProyectado = multi.map((poligono) =>
      poligono.map((anillo) => douglasPeucker(anillo.map(proyectar), TOLERANCIA_DEPARTAMENTOS)),
    );
    return {
      name: f.properties.nam,
      label: ubicarRotulo(f.properties.nam, multiProyectado),
      d: aPath(multi, TOLERANCIA_DEPARTAMENTOS, AREA_MINIMA_DEPARTAMENTOS),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'es'));

// -------------------------------------------------
// Emisión
// -------------------------------------------------
const json = (v) => JSON.stringify(v);
const lineasArea = areas.map(
  (a) =>
    `  { id: ${json(a.id)}, name: ${json(a.name)}, kind: ${json(a.kind)}, department: ${json(a.department)}, labelX: ${a.labelX}, labelY: ${a.labelY}, small: ${a.small}, d: ${json(a.d)} },`,
);
const lineasPunto = puntos.map(
  (p) =>
    `  { id: ${json(p.id)}, name: ${json(p.name)}, kind: ${json(p.kind)}, department: ${json(p.department)}, x: ${p.x}, y: ${p.y} },`,
);
const lineasDepto = deptos.map(
  (d) => `  { name: ${json(d.name)}, label: ${json(d.label)}, d: ${json(d.d)} },`,
);

const fuente = `// ===========================================
// ⚠️ ARCHIVO GENERADO — no editar a mano.
// Lo produce \`npm run geo:build\` (scripts/geo/build-geo.mjs) a partir de los
// datos del Instituto Geográfico Nacional (CC BY 4.0) en scripts/geo/ign/.
// ===========================================
/* oxlint-disable */
import type { GeoArea, GeoDepartment, GeoPoint } from './geoTypes';

export const GEO_VIEWBOX = { width: ${ANCHO}, height: ${ALTO} } as const;

export const GEO_SOURCE = 'Instituto Geográfico Nacional';

/** Municipios, comisiones de fomento y juntas con ejido propio. */
export const GEO_AREAS: readonly GeoArea[] = [
${lineasArea.join('\n')}
];

/** Gobiernos locales sin polígono propio: se dibujan como puntos. */
export const GEO_POINTS: readonly GeoPoint[] = [
${lineasPunto.join('\n')}
];

/** Contornos de los departamentos, sólo como referencia visual. */
export const GEO_DEPARTMENTS: readonly GeoDepartment[] = [
${lineasDepto.join('\n')}
];
`;

await mkdir(path.dirname(SALIDA), { recursive: true });
await writeFile(SALIDA, fuente, 'utf8');

const kb = (Buffer.byteLength(fuente, 'utf8') / 1024).toFixed(1);
console.log(
  `✅ ${path.relative(RAIZ, SALIDA)}: ${areas.length} áreas, ${puntos.length} puntos, ` +
    `${deptos.length} departamentos — ${kb} KB (viewBox ${ANCHO}×${ALTO})`,
);
