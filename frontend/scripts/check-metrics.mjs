// ===========================================
// Red del panel de Métricas de la encuesta
//
// Lo que este chequeo fija es la promesa de anonimato del lado del navegador:
// un corte suprimido por k-anonimato nunca se dibuja ni se exporta como cero.
// Además, que cada gráfico se ofrezca sólo donde tiene sentido, que el CSV no
// abra una fórmula en Excel y que los filtros sobrevivan a la URL.
//
// Se bundlea el **fuente real** con esbuild, igual que check-survey.mjs: no hay
// runner de tests en el frontend y el presupuesto de dependencias nuevas es
// cero.
//
// Corre con: npm run check:metrics
// ===========================================
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-metrics.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

execSync(
  [
    'npx esbuild',
    `"${path.join(RAIZ, 'scripts', 'metrics.entry.ts')}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --log-level=error',
    `"--alias:@=${SRC}"`,
    '"--define:import.meta.env={\\"DEV\\":false}"',
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const {
  TIPOS_GRAFICO,
  DIMENSION_SIN_DESGLOSE,
  graficoCompatible,
  tiposDisponibles,
  ajustarTipo,
  aDatosTorta,
  aDatosBarras,
  aDatosDispersion,
  aDatosSerie,
  etiquetaFecha,
  colorDeSerie,
  formatearKpi,
  motivoKpiOculto,
  celdaCsv,
  tablaACsv,
  nombreArchivo,
  filtrosDesdeBusqueda,
  filtrosABusqueda,
  hayFiltrosActivos,
  aplicarCambioDeFiltro,
  MAXIMO_FILTROS,
  filtrosEnUso,
  puedeSumarFiltro,
  orientacionBarras,
  anchoEjeEtiquetas,
  recortarEtiqueta,
  disponerBarras,
  FILAS_VISIBLES_BARRAS,
  fraseOpcion,
  textoBase,
  colorCalor,
  heatmapDesdeCruce,
  hoyEnFormosa,
  rangoDePeriodo,
  periodoActivo,
  puntosSparkline,
  textoTotal,
} = await import(pathToFileURL(SALIDA).href);

// -------------------------------------------------
// Datos de prueba
// -------------------------------------------------
const SUP = { suprimido: true, motivo: 'MUESTRA_INSUFICIENTE', conteo: null };
const vis = (conteo) => ({ suprimido: false, conteo });
const COLUMNAS = [
  { optionId: 'o1', valor: 'no', texto: 'No', orden: 0 },
  { optionId: 'o2', valor: 'si', texto: 'Sí', orden: 1 },
];
const celdas = (a, b) => [
  { optionId: 'o1', valor: 'no', texto: 'No', ...a },
  { optionId: 'o2', valor: 'si', texto: 'Sí', ...b },
];
function cruce(filas, extra = {}) {
  return {
    campaignId: 'c',
    version: 1,
    umbral: 5,
    filtros: {},
    pregunta: { questionId: 'q', orden: 1, texto: 'P', kind: 'UNICA', audiencia: 'TODOS', activa: true, opciones: COLUMNAS },
    dimension: 'zona',
    etiquetaDimension: 'Zona',
    columnas: COLUMNAS,
    filas,
    totalRespuestas: 0,
    ...extra,
  };
}

// -------------------------------------------------
// 1. Qué gráfico se ofrece con qué configuración
// -------------------------------------------------
comprobar('hay cinco tipos de gráfico', TIPOS_GRAFICO.length === 5);
comprobar('sin desglose se ofrece torta', graficoCompatible('torta', undefined) === true);
comprobar('con desglose no se ofrece torta', graficoCompatible('torta', 'zona') === false);
comprobar('barras apiladas necesitan desglose', graficoCompatible('barras_apiladas', undefined) === false);
comprobar(
  'dispersión sólo para pregunta × pregunta',
  graficoCompatible('dispersion', 'zona') === false &&
    graficoCompatible('dispersion', 'pregunta:abc') === true,
);
comprobar(
  'los tipos disponibles sin desglose son barras, torta y líneas',
  tiposDisponibles(undefined).join() === 'barras,torta,lineas',
);
comprobar(
  'si el tipo elegido deja de servir, se cambia al primero disponible',
  ajustarTipo('torta', 'zona') === 'barras' && ajustarTipo('lineas', 'zona') === 'lineas',
);
comprobar('sin desglose se cruza por ventana (una sola fila)', DIMENSION_SIN_DESGLOSE === 'ventana');

// -------------------------------------------------
// 2. Un suprimido nunca se dibuja como cero
// -------------------------------------------------
{
  const torta = aDatosTorta(cruce([{ clave: 'DURANTE', etiqueta: 'Durante', celdas: celdas(vis(8), SUP), totalFila: SUP }]));
  comprobar('torta: la celda suprimida no aparece', torta.datos.length === 1 && torta.datos[0].valor === 8);
  comprobar('torta: se cuenta la suprimida para avisarlo', torta.suprimidas === 1);

  const ceros = aDatosTorta(cruce([{ clave: 'D', etiqueta: 'D', celdas: celdas(vis(0), vis(6)), totalFila: vis(6) }]));
  comprobar('torta: una opción en cero no dibuja una porción vacía', ceros.datos.length === 1 && ceros.suprimidas === 0);
}
{
  const filas = [
    { clave: 'INTERIOR', etiqueta: 'INTERIOR', celdas: celdas(vis(7), SUP), totalFila: SUP },
    { clave: 'CAPITAL', etiqueta: 'CAPITAL', celdas: celdas(vis(5), vis(5)), totalFila: vis(10) },
  ];
  const barras = aDatosBarras(cruce(filas));
  comprobar('barras: la fila con celda suprimida conserva sus visibles', barras.datos[0].No === 7);
  comprobar('barras: la celda suprimida no se convierte en cero', !('Sí' in barras.datos[0]));
  comprobar('barras: se cuentan las suprimidas', barras.suprimidas === 1);

  const porcentaje = aDatosBarras(cruce(filas), { porcentaje: true });
  comprobar(
    'barras %: una fila con total oculto queda afuera (el % lo revelaría)',
    porcentaje.datos.length === 1 && porcentaje.datos[0].etiqueta === 'CAPITAL',
  );
  comprobar('barras %: el porcentaje se calcula sobre el total de la fila', porcentaje.datos[0].No === 50);
}
{
  const disp = aDatosDispersion(
    cruce([
      { clave: 'o-a', etiqueta: 'A', celdas: celdas(vis(6), SUP), totalFila: SUP },
      { clave: 'o-b', etiqueta: 'B', celdas: celdas(vis(0), vis(9)), totalFila: vis(9) },
    ], { dimension: 'pregunta:x' }),
  );
  comprobar('dispersión: una burbuja por combinación visible con respuestas', disp.datos.length === 2);
  comprobar('dispersión: x = fila, y = columna', disp.datos[1].x === 1 && disp.datos[1].y === 1 && disp.datos[1].conteo === 9);
  comprobar('dispersión: se cuentan las suprimidas', disp.suprimidas === 1);
}
{
  const serie = aDatosSerie({
    serie: {
      granularidad: 'dia',
      puntos: [
        { fecha: '2026-11-09', ...vis(12) },
        { fecha: '2026-11-10', ...SUP },
      ],
    },
  });
  comprobar('serie: un día suprimido corta la línea (null), no baja a cero', serie.datos[1].respuestas === null);
  comprobar('serie: la etiqueta del día es dd/mm', serie.datos[0].etiqueta === '09/11');
  comprobar('serie: etiqueta por hora', etiquetaFecha('2026-11-10T14:00', 'hora') === '10/11 14 h');
}

// -------------------------------------------------
// 3. KPIs
// -------------------------------------------------
{
  const kpi = (valor, numerador, denominador, formato = 'porcentaje') => ({
    id: 'k', nombre: 'K', descripcion: null, orden: 0, formato, numerador, denominador, valor,
  });
  comprobar('kpi: porcentaje con coma decimal', formatearKpi(kpi(60.5, vis(6), vis(10))) === '60,5 %');
  comprobar('kpi: conteo', formatearKpi(kpi(12, vis(12), vis(20), 'conteo')) === '12');
  comprobar('kpi: oculto se muestra como —', formatearKpi(kpi(null, SUP, vis(10))) === '—');
  comprobar(
    'kpi: el motivo de ocultarlo nombra el umbral',
    /Menos de 5 respuestas/.test(motivoKpiOculto(kpi(null, SUP, vis(10)), 5) ?? ''),
  );
  comprobar('kpi: visible no tiene motivo', motivoKpiOculto(kpi(60, vis(6), vis(10)), 5) === null);
}

// -------------------------------------------------
// 4. CSV
// -------------------------------------------------
comprobar('csv: una fórmula queda neutralizada', celdaCsv('=SUMA(A1)') === `"'=SUMA(A1)"`);
comprobar('csv: comillas escapadas', celdaCsv('dijo "hola"') === '"dijo ""hola"""');
comprobar('csv: null es celda vacía, no "null"', celdaCsv(null) === '""');
{
  const csv = tablaACsv(cruce([{ clave: 'I', etiqueta: 'Interior', celdas: celdas(vis(7), SUP), totalFila: SUP }]));
  const lineas = csv.split('\r\n');
  comprobar('csv: encabezado con la dimensión, las opciones y el total', lineas[0] === '"Zona";"No";"Sí";"Total"');
  comprobar('csv: el suprimido se escribe "< 5", nunca 0', lineas[1] === '"Interior";"7";"< 5";"< 5"');
}
comprobar('nombre de archivo sin tildes ni espacios', nombreArchivo('¿Te lesionaste? por Zona', 'csv') === 'te-lesionaste-por-zona.csv');

// -------------------------------------------------
// 5. Filtros ↔ URL
// -------------------------------------------------
{
  const busqueda = new URLSearchParams('zona=INTERIOR&campania=abc&sexo=FEMENINO&basura=1');
  const filtros = filtrosDesdeBusqueda(busqueda);
  comprobar('url: lee sólo las claves de filtro', JSON.stringify(filtros) === '{"zona":"INTERIOR","sexo":"FEMENINO"}');
  const escrita = filtrosABusqueda({ zona: 'CAPITAL' }, busqueda);
  comprobar(
    'url: escribe los filtros y conserva las claves ajenas',
    escrita.get('zona') === 'CAPITAL' && escrita.get('campania') === 'abc' && !escrita.has('sexo'),
  );
  comprobar('url: sin filtros no hay filtros activos', hayFiltrosActivos({}) === false);
}
{
  const catalogo = {
    departamentos: [
      { id: 'd1', localidades: [{ id: 'l1' }] },
      { id: 'd2', localidades: [{ id: 'l2' }] },
    ],
    categorias: [{ id: 'c1', disciplineId: 'x' }],
  };
  comprobar(
    'filtros: cambiar de departamento limpia una localidad ajena',
    aplicarCambioDeFiltro({ localityId: 'l1' }, { departmentId: 'd2' }, catalogo).localityId === undefined,
  );
  comprobar(
    'filtros: cambiar de disciplina limpia una categoría ajena',
    aplicarCambioDeFiltro({ categoryId: 'c1' }, { disciplineId: 'y' }, catalogo).categoryId === undefined,
  );
  comprobar(
    'filtros: el mismo departamento conserva la localidad',
    aplicarCambioDeFiltro({ localityId: 'l1' }, { departmentId: 'd1' }, catalogo).localityId === 'l1',
  );
}
{
  // Tope de filtros: el backend rechaza más de 2 a la vez (anonimato).
  comprobar('tope: son 2 filtros a la vez', MAXIMO_FILTROS === 2);
  comprobar(
    'tope: el rango de fechas cuenta como un solo filtro',
    JSON.stringify(filtrosEnUso({ zona: 'INTERIOR', desde: '2026-11-01', hasta: '2026-11-10' })) === '["zona","fecha"]',
  );
  comprobar('tope: con 1 filtro se puede sumar otro', puedeSumarFiltro({ zona: 'INTERIOR' }, 'etapa'));
  comprobar('tope: con 2 filtros no se suma un tercero', !puedeSumarFiltro({ zona: 'INTERIOR', sexo: 'FEMENINO' }, 'etapa'));
  comprobar('tope: con 2 filtros se puede cambiar uno de los dos', puedeSumarFiltro({ zona: 'INTERIOR', sexo: 'FEMENINO' }, 'zona'));
  comprobar(
    'tope: una URL con 3 filtros se lee con los 2 primeros',
    JSON.stringify(filtrosDesdeBusqueda(new URLSearchParams('zona=INTERIOR&sexo=FEMENINO&desde=2026-11-01'))) ===
      '{"zona":"INTERIOR","sexo":"FEMENINO"}',
  );
  const catalogoVacio = { departamentos: [], categorias: [] };
  comprobar(
    'tope: un tercer filtro no se aplica',
    aplicarCambioDeFiltro({ zona: 'INTERIOR', sexo: 'FEMENINO' }, { etapa: 'ZONAL' }, catalogoVacio).etapa === undefined,
  );
  comprobar(
    'tope: cambiar el valor de un filtro en uso sí se aplica',
    aplicarCambioDeFiltro({ zona: 'INTERIOR', sexo: 'FEMENINO' }, { zona: 'CAPITAL' }, catalogoVacio).zona === 'CAPITAL',
  );
}
comprobar('paleta: usa variables del tema y cicla', colorDeSerie(0).startsWith('var(--color-') && colorDeSerie(0) === colorDeSerie(10));
comprobar(
  'paleta: el rojo de error no se usa para series comunes',
  Array.from({ length: 10 }, (_, i) => colorDeSerie(i)).every((c) => !c.includes('destructive')),
);

// -------------------------------------------------
// Barras legibles: nunca etiquetas encimadas
// -------------------------------------------------
comprobar('barras: pocas categorías cortas van en columnas', orientacionBarras(['Capital', 'Interior']) === 'vertical');
comprobar(
  'barras: más de 5 categorías pasan a horizontal',
  orientacionBarras(['A', 'B', 'C', 'D', 'E', 'F']) === 'horizontal',
);
comprobar(
  'barras: una etiqueta larga pasa a horizontal',
  orientacionBarras(['Formosa', 'Ingeniero Juárez']) === 'horizontal',
);
comprobar('barras: el eje crece con la etiqueta más larga', anchoEjeEtiquetas(['Laguna Blanca']) > anchoEjeEtiquetas(['Pirané']));
comprobar('barras: el eje tiene tope', anchoEjeEtiquetas(['x'.repeat(200)]) === 180);
comprobar('barras: una etiqueta corta queda igual', recortarEtiqueta('Clorinda', 20) === 'Clorinda');
comprobar(
  'barras: una etiqueta larga se recorta con puntos suspensivos',
  recortarEtiqueta('Comandante Fontana del Norte', 12) === 'Comandante…' && recortarEtiqueta('Comandante Fontana del Norte', 12).length <= 12,
);
{
  const muchas = Array.from({ length: 20 }, (_, i) => ({ etiqueta: `Localidad ${i}`, No: i, Sí: 1 }));
  const d = disponerBarras(muchas);
  comprobar('barras: con muchas filas se muestran las primeras', d.filas.length === FILAS_VISIBLES_BARRAS && d.ocultas === 20 - FILAS_VISIBLES_BARRAS);
  comprobar('barras: en horizontal se ordena de mayor a menor', d.filas[0].etiqueta === 'Localidad 19');
  comprobar('barras: en horizontal la altura crece con las filas', d.alto !== null && d.alto >= FILAS_VISIBLES_BARRAS * 36);
  const todas = disponerBarras(muchas, { verTodas: true });
  comprobar('barras: "Ver todas" muestra todas las filas', todas.filas.length === 20 && todas.ocultas === 0);
  const pocas = disponerBarras([{ etiqueta: 'ZONAL', No: 1 }, { etiqueta: 'PROVINCIAL', No: 9 }]);
  comprobar(
    'barras: en columnas se respeta el orden original y la altura fija',
    pocas.orientacion === 'vertical' && pocas.filas[0].etiqueta === 'ZONAL' && pocas.alto === null,
  );
}

// -------------------------------------------------
// Lenguaje simple: frases honestas, nunca exageradas
// -------------------------------------------------
comprobar('frase: 42 % son 4 de cada 10', fraseOpcion(42, 'Transporte') === '4 de cada 10 eligieron «Transporte»');
comprobar('frase: 12 % es 1 de cada 10 (singular)', fraseOpcion(12, 'Beca') === '1 de cada 10 eligió «Beca»');
comprobar('frase: 3 % es menos de 1 de cada 10', fraseOpcion(3, 'Comida') === 'Menos de 1 de cada 10 eligió «Comida»');
comprobar('frase: 47 % es casi la mitad (no "la mitad")', fraseOpcion(47, 'X') === 'Casi la mitad eligió «X»');
comprobar('frase: 52 % es la mitad', fraseOpcion(52, 'X') === 'La mitad eligió «X»');
comprobar('frase: 61 % son 6 de cada 10', fraseOpcion(61, 'X') === '6 de cada 10 eligieron «X»');
comprobar('frase: 97 % es casi todos', fraseOpcion(97, 'X') === 'Casi todos eligieron «X»');
comprobar('frase: 94 % son 9 de cada 10, no "casi todos"', fraseOpcion(94, 'X') === '9 de cada 10 eligieron «X»');
comprobar(
  'base: dice sobre cuántas respuestas y con singular correcto',
  textoBase(312, '2026-11-18T15:04:00.000Z').startsWith('Sobre 312 respuestas · datos al ') &&
    textoBase(1, '2026-11-18T15:04:00.000Z').startsWith('Sobre 1 respuesta · '),
);
comprobar(
  'base: la fecha va en hora de Formosa',
  textoBase(40, '2026-11-18T15:04:00.000Z').endsWith('18/11 12:04'),
);

// -------------------------------------------------
// Mapa de calor
// -------------------------------------------------
comprobar('calor: el cero es el tono más claro', colorCalor(0).fondo === 'var(--color-celeste-50)');
comprobar('calor: el máximo es el más oscuro con texto blanco', colorCalor(1).fondo === 'var(--color-primary-800)' && colorCalor(1).texto === 'var(--color-white, #ffffff)');
comprobar('calor: los tonos claros llevan texto oscuro', colorCalor(0.1).texto === 'var(--color-primary-900)');
comprobar('calor: fuera de rango se acota', colorCalor(-1).fondo === colorCalor(0).fondo && colorCalor(7).fondo === colorCalor(1).fondo);
{
  const mapa = heatmapDesdeCruce(
    cruce([
      { clave: 'd1', etiqueta: 'Pirané', celdas: celdas(vis(10), vis(30)), totalFila: vis(40) },
      { clave: 'd2', etiqueta: 'Patiño', celdas: celdas(SUP, vis(8)), totalFila: SUP },
    ]),
  );
  comprobar('calor: una fila por departamento y una columna por opción', mapa.filas.length === 2 && mapa.columnas.length === 2);
  comprobar('calor: la intensidad es la proporción dentro de la fila', mapa.filas[0].celdas[1].intensidad === 0.75);
  comprobar('calor: una celda suprimida queda sin intensidad, nunca en cero', mapa.filas[1].celdas[0].suprimida === true && mapa.filas[1].celdas[0].intensidad === null);
  comprobar('calor: con el total de la fila oculto no se calculan proporciones', mapa.filas[1].celdas[1].intensidad === null && mapa.filas[1].celdas[1].conteo === 8);
}

// -------------------------------------------------
// Período (Día / Semana / Todo)
// -------------------------------------------------
comprobar('período: hoy en Formosa a las 23:30 UTC sigue siendo el mismo día', hoyEnFormosa(new Date('2026-11-18T23:30:00Z')) === '2026-11-18');
comprobar('período: hoy en Formosa a las 02:00 UTC es el día anterior', hoyEnFormosa(new Date('2026-11-19T02:00:00Z')) === '2026-11-18');
comprobar('período: día = desde y hasta hoy', JSON.stringify(rangoDePeriodo('dia', '2026-11-18')) === JSON.stringify({ desde: '2026-11-18', hasta: '2026-11-18' }));
comprobar('período: semana = los últimos 7 días contando hoy', JSON.stringify(rangoDePeriodo('semana', '2026-11-03')) === JSON.stringify({ desde: '2026-10-28', hasta: '2026-11-03' }));
comprobar('período: todo limpia las fechas', JSON.stringify(rangoDePeriodo('todo', '2026-11-18')) === JSON.stringify({ desde: undefined, hasta: undefined }));
comprobar('período: sin fechas es "todo"', periodoActivo({}, '2026-11-18') === 'todo');
comprobar('período: reconoce la semana', periodoActivo({ desde: '2026-11-12', hasta: '2026-11-18' }, '2026-11-18') === 'semana');
comprobar('período: un rango a mano no marca ningún botón', periodoActivo({ desde: '2026-11-01', hasta: '2026-11-18' }, '2026-11-18') === 'personalizado');

// -------------------------------------------------
// Mini tendencia
// -------------------------------------------------
comprobar('sparkline: sin datos no dibuja', puntosSparkline([], 60, 20) === '');
comprobar('sparkline: un punto es una línea plana al medio', puntosSparkline([5], 60, 20) === '0,10 60,10');
comprobar('sparkline: escala de abajo (mínimo) a arriba (máximo)', puntosSparkline([0, 10], 60, 20) === '0,20 60,0');
comprobar('sparkline: los huecos suprimidos (null) no se inventan', puntosSparkline([2, null, 4], 60, 20) === '0,20 60,0');

// -------------------------------------------------
// Totales con umbral
// -------------------------------------------------
comprobar('total: visible con plural', textoTotal(vis(12), 5, 'en el corte') === '12 respuestas en el corte');
comprobar('total: visible en singular', textoTotal(vis(1), 5, 'en el corte') === '1 respuesta en el corte');
comprobar('total: suprimido dice "menos de", nunca el número', textoTotal(SUP, 5, 'en el corte') === 'Menos de 5 respuestas en el corte');

// -------------------------------------------------
// Resultado
// -------------------------------------------------
if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} problema(s) en el panel de métricas:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('');
  process.exit(1);
}

console.log(`Chequeos ejecutados: ${verificaciones.length}`);
console.log('✅ Ningún corte suprimido se dibuja ni se exporta como cero.');
