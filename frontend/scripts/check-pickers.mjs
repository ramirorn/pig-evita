// ===========================================
// Red de los selectores propios (lista desplegable y fecha)
//
// Este chequeo fija dos cosas:
//
//   1. **No vuelven los selectores nativos.** Ni `<select>` ni
//      `<input type="date">` (ni `datetime-local`, `month`, `week` o `time`)
//      en `src/`: se ven distinto en cada navegador, el de fecha obliga a
//      cientos de toques para llegar a un año de nacimiento en el celular y no
//      siguen el estilo del sitio. Se usan `SelectField` y `DatePicker`.
//   2. **La lógica pura del selector de fecha** (`src/lib/datePicker.ts`):
//      parseo y formato dd/mm/aaaa ↔ YYYY-MM-DD, fechas imposibles,
//      bisiestos, min/max, grilla del mes desde el lunes, navegación por
//      teclado en los bordes de mes y año, y que no haya corrimiento por zona
//      horaria.
//
// La zona se fuerza a Argentina (UTC−3) ANTES de importar nada: es la zona en
// la que `new Date('2012-03-05')` cae el 4 a las 21 h, el error que este
// módulo existe para evitar. En una máquina o un CI en UTC el chequeo muerde
// igual.
//
// Se bundlea el **fuente real** con esbuild, igual que los demás chequeos.
//
// Corre con: npm run check:pickers
// ===========================================
process.env.TZ = 'America/Argentina/Buenos_Aires';

import { execSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-pickers.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

function igual(descripcion, obtenido, esperado) {
  comprobar(
    descripcion,
    JSON.stringify(obtenido) === JSON.stringify(esperado),
    `obtuvo ${JSON.stringify(obtenido)}, se esperaba ${JSON.stringify(esperado)}`,
  );
}

async function archivosFuente(dir) {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...(await archivosFuente(ruta)));
    else if (/\.(tsx?|jsx?)$/.test(entrada.name)) salida.push(ruta);
  }
  return salida;
}

const leer = (relativa) => readFile(path.join(SRC, relativa), 'utf8');

// -------------------------------------------------
// 1. Ningún selector nativo en src/
// -------------------------------------------------
{
  const NATIVOS = [
    { nombre: '<select>', patron: /<select\b/ },
    { nombre: 'type="date"', patron: /type\s*=\s*\{?\s*["'`]date["'`]/ },
    { nombre: 'type="datetime-local"', patron: /type\s*=\s*\{?\s*["'`]datetime-local["'`]/ },
    { nombre: 'type="month"', patron: /type\s*=\s*\{?\s*["'`]month["'`]/ },
    { nombre: 'type="week"', patron: /type\s*=\s*\{?\s*["'`]week["'`]/ },
    { nombre: 'type="time"', patron: /type\s*=\s*\{?\s*["'`]time["'`]/ },
  ];
  const hallazgos = [];
  for (const archivo of await archivosFuente(SRC)) {
    const lineas = (await readFile(archivo, 'utf8')).split('\n');
    lineas.forEach((linea, indice) => {
      for (const { nombre, patron } of NATIVOS) {
        if (patron.test(linea)) {
          hallazgos.push(`${path.relative(RAIZ, archivo)}:${indice + 1} (${nombre})`);
        }
      }
    });
  }
  comprobar(
    'no queda ningún selector nativo (<select>, type="date"/datetime-local/month/week/time) en src/',
    hallazgos.length === 0,
    hallazgos.join(', '),
  );

  // Las pantallas que antes tenían selectores nativos usan los propios.
  const conLista = [
    'components/documents/ParticipantDocumentsPanel.tsx',
    'pages/admin/inscription/RosterMemberForm.tsx',
    'pages/admin/inscription/StepRoster.tsx',
    'pages/public/calendar/CalendarFiltersPanel.tsx',
    'pages/public/inscription/StepPersonalData.tsx',
    'pages/public/survey/form/SurveyContextStep.tsx',
  ];
  for (const archivo of conLista) {
    comprobar(`${archivo} usa SelectField`, /<SelectField\b/.test(await leer(archivo)));
  }
  const conFecha = [
    'pages/admin/AuditPage.tsx',
    'pages/admin/components/calendar-event/EventScheduleFields.tsx',
    'pages/admin/components/CompetitionForm.tsx',
    'pages/admin/components/ParticipantForm.tsx',
    'pages/admin/inscription/RosterMemberForm.tsx',
    'pages/admin/survey/SurveyCampaignForm.tsx',
    'pages/public/inscription/StepPersonalData.tsx',
  ];
  for (const archivo of conFecha) {
    comprobar(`${archivo} usa DatePicker`, /<DatePicker\b/.test(await leer(archivo)));
  }

  // Las fechas de nacimiento no admiten el futuro.
  for (const archivo of [
    'pages/admin/components/ParticipantForm.tsx',
    'pages/admin/inscription/RosterMemberForm.tsx',
    'pages/public/inscription/StepPersonalData.tsx',
  ]) {
    comprobar(
      `${archivo}: la fecha de nacimiento tiene max={todayIso()}`,
      /max=\{todayIso\(\)\}/.test(await leer(archivo)),
    );
  }
}

// -------------------------------------------------
// 2. El componente: accesibilidad, estilo y fechas locales
// -------------------------------------------------
{
  const picker = await leer('components/ui/date-picker.tsx');
  const select = await leer('components/ui/select.tsx');
  const logica = await leer('lib/datePicker.ts');

  for (const [descripcion, patron] of [
    ['la grilla es role="grid"', /role="grid"/],
    ['cada día es una celda con aria-selected', /role="gridcell" aria-selected=/],
    ['hoy se marca con aria-current="date"', /aria-current=\{isToday \? 'date'/],
    ['los días fuera de rango llevan aria-disabled', /aria-disabled=/],
    ['el botón del calendario se llama "Elegir fecha"', /pickerLabel = 'Elegir fecha'/],
    ['el campo de texto expone aria-invalid', /aria-invalid=\{invalid\}/],
    ['el error de fecha imposible se anuncia (role="alert")', /role="alert"/],
    ['el error queda asociado con aria-describedby', /aria-describedby=\{describedByIds\}/],
    ['el texto pide teclado numérico en el celular', /inputMode="numeric"/],
    ['la grilla escucha el teclado', /onKeyDown=\{handleGridKeyDown\}/],
    ['hay selector rápido de mes y de año', /aria-label="Mes"[\s\S]*aria-label="Año"/],
    ['el popover entra en 375 px', /w-\[min\(22rem,calc\(100vw-1\.5rem\)\)\]/],
    ['los días son táctiles (44 px en el celular)', /size-11/],
    ['la fecha local sale del módulo puro', /from '@\/lib\/datePicker'/],
  ]) {
    comprobar(`DatePicker: ${descripcion}`, patron.test(picker));
  }

  comprobar(
    'SelectField: el valor vacío viaja como un centinela (Radix no admite value="")',
    /SELECT_EMPTY_VALUE/.test(select) && /next === SELECT_EMPTY_VALUE \? "" : next/.test(select),
  );
  comprobar(
    'SelectField: tamaños táctiles lg/touch/xl en el disparador',
    /data-\[size=lg\]:h-11/.test(select) &&
      /data-\[size=touch\]:h-11/.test(select) &&
      /data-\[size=xl\]:min-h-14/.test(select),
  );
  comprobar(
    'Select: las opciones miden 44 px en pantallas táctiles',
    /pointer-coarse:min-h-11/.test(select),
  );

  for (const [nombre, fuente] of [
    ['date-picker.tsx', picker],
    ['select.tsx', select],
  ]) {
    comprobar(
      `${nombre}: sin clases Tailwind interpoladas`,
      !/className=\{`[^`]*\$\{/.test(fuente) && !/["'`]\s*(?:bg|text|border|h|w|size)-\$\{/.test(fuente),
    );
  }

  // `new Date('YYYY-MM-DD')` es medianoche UTC: en Argentina es el día anterior.
  const sinParseoUtc = (fuente) =>
    !/new Date\(\s*(?:['"`]\d|value|iso|current|text)/.test(fuente);
  comprobar('date-picker.tsx no interpreta fechas con new Date(string)', sinParseoUtc(picker));
  comprobar('lib/datePicker.ts no interpreta fechas con new Date(string)', sinParseoUtc(logica));
  comprobar('lib/datePicker.ts no importa React', !/from 'react'/.test(logica));
}

// -------------------------------------------------
// Bundle de la lógica real
// -------------------------------------------------
execSync(
  [
    'npx esbuild',
    `"${path.join(RAIZ, 'scripts', 'pickers.entry.ts')}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --log-level=error',
    `"--alias:@=${SRC}"`,
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const dp = await import(pathToFileURL(SALIDA).href);

// -------------------------------------------------
// 3. Zona horaria
// -------------------------------------------------
{
  // Prueba de que la zona forzada está activa: la trampa existe acá.
  comprobar(
    'la zona forzada es UTC−3 (new Date("2012-03-05") cae el día 4 a las 21 h)',
    new Date('2012-03-05').getDate() === 4 && new Date('2012-03-05').getHours() === 21,
  );
  igual(
    'hoy se calcula en hora local: las 23 h del 7/10 en Argentina siguen siendo el 7',
    dp.todayIso(new Date('2026-10-08T02:00:00.000Z')),
    '2026-10-07',
  );
  igual(
    'un timestamp del backend se ubica en el día local',
    dp.localIsoFromDate(new Date('2026-10-08T02:59:00.000Z')),
    '2026-10-07',
  );
  igual('localIsoFromDate ante una fecha rota devuelve null', dp.localIsoFromDate(new Date('x')), null);
  igual('el texto de 05/03/2012 no se corre al 04', dp.formatDateText('2012-03-05'), '05/03/2012');
  igual(
    'el nombre largo del día no se corre (jueves 8 de octubre de 2026)',
    dp.formatLongEs('2026-10-08'),
    'jueves 8 de octubre de 2026',
  );
  igual('sumar un día al 31/12 cruza bien el año', dp.addDays('2026-12-31', 1), '2027-01-01');
}

// -------------------------------------------------
// 4. Parseo y formato dd/mm/aaaa ↔ YYYY-MM-DD
// -------------------------------------------------
{
  igual('ISO → texto', dp.formatDateText('2012-03-05'), '05/03/2012');
  igual('texto → ISO', dp.parseDateText('05/03/2012'), { status: 'ok', iso: '2012-03-05' });
  igual('vacío → empty', dp.parseDateText('   '), { status: 'empty' });
  igual('a medias → incomplete', dp.parseDateText('05/03/20'), { status: 'incomplete' });
  igual('un ISO inválido no se formatea', dp.formatDateText('2012-13-01'), '');
  igual('null no se formatea', dp.formatDateText(null), '');

  let idaYVuelta = true;
  for (let d = '1990-01-01'; d <= '2030-12-31'; d = dp.addDays(d, 17)) {
    const vuelta = dp.parseDateText(dp.formatDateText(d));
    if (vuelta.status !== 'ok' || vuelta.iso !== d) {
      idaYVuelta = false;
      break;
    }
  }
  comprobar('ida y vuelta ISO → texto → ISO en 40 años de fechas', idaYVuelta);

  // Máscara
  igual('máscara: 8 dígitos seguidos', dp.maskDateText('05032012'), '05/03/2012');
  igual('máscara: 4 dígitos', dp.maskDateText('0503'), '05/03');
  igual('máscara: 3 dígitos', dp.maskDateText('050'), '05/0');
  igual('máscara: la barra tipeada tras el día se respeta', dp.maskDateText('05/'), '05/');
  igual('máscara: la barra tipeada tras el mes se respeta', dp.maskDateText('05/03/'), '05/03/');
  igual('máscara: día y mes de un dígito se completan con 0', dp.maskDateText('1/5/2012'), '01/05/2012');
  igual('máscara: pegar un ISO lo convierte', dp.maskDateText('2012-03-05'), '05/03/2012');
  igual('máscara: letras afuera', dp.maskDateText('ab0c5'), '05');
  igual('máscara: un 0 seguido de barra no se vuelve 00', dp.maskDateText('0/'), '0');
  igual('máscara: corta en 8 dígitos', dp.maskDateText('123456789'), '12/34/5678');
  igual('máscara: borrar todo deja vacío', dp.maskDateText(''), '');
}

// -------------------------------------------------
// 5. Fechas imposibles y bisiestos
// -------------------------------------------------
{
  for (const [texto, descripcion] of [
    ['31/02/2024', '31 de febrero'],
    ['30/02/2024', '30 de febrero'],
    ['29/02/2023', '29/02 de un año no bisiesto'],
    ['29/02/1900', '29/02/1900 (divisible por 100, no bisiesto)'],
    ['31/04/2024', '31 de abril'],
    ['00/01/2024', 'día 0'],
    ['15/13/2024', 'mes 13'],
    ['15/00/2024', 'mes 0'],
    ['01/01/0000', 'año 0'],
  ]) {
    igual(`fecha imposible: ${descripcion}`, dp.parseDateText(texto), { status: 'invalid' });
  }
  igual('29/02/2024 existe', dp.parseDateText('29/02/2024'), { status: 'ok', iso: '2024-02-29' });
  igual('29/02/2000 existe (divisible por 400)', dp.parseDateText('29/02/2000').status, 'ok');
  igual('parseIso rechaza 2023-02-29', dp.parseIso('2023-02-29'), null);
  igual('parseIso rechaza basura', dp.parseIso('2023-2-9'), null);
  comprobar('isLeapYear', dp.isLeapYear(2024) && !dp.isLeapYear(2023) && !dp.isLeapYear(1900) && dp.isLeapYear(2000));
  igual('días de febrero bisiesto/no', [dp.daysInMonth(2024, 2), dp.daysInMonth(2023, 2)], [29, 28]);
  comprobar(
    'el mensaje de fecha imposible lo dice en voseo',
    /no existe/.test(dp.dateTextError({ status: 'invalid' }) ?? '') &&
      /revisá/.test(dp.dateTextError({ status: 'invalid' }) ?? ''),
  );
  comprobar(
    'el mensaje de fecha a medias pide completarla',
    /Completá/.test(dp.dateTextError({ status: 'incomplete' }) ?? ''),
  );
  igual('una fecha vacía no tiene error', dp.dateTextError({ status: 'empty' }), null);
}

// -------------------------------------------------
// 6. min / max
// -------------------------------------------------
{
  const min = '2026-03-10';
  const max = '2026-03-20';
  comprobar('min y max son inclusivos', dp.isInRange(min, min, max) && dp.isInRange(max, min, max));
  igual('antes del mínimo', dp.rangeProblem('2026-03-09', min, max), 'before-min');
  igual('después del máximo', dp.rangeProblem('2026-03-21', min, max), 'after-max');
  igual('sin límites todo entra', dp.rangeProblem('1900-01-01'), null);
  igual('un límite inválido se ignora', dp.rangeProblem('1900-01-01', 'x'), null);
  igual('clamp abajo', dp.clampIso('2026-01-01', min, max), min);
  igual('clamp arriba', dp.clampIso('2027-01-01', min, max), max);
  comprobar(
    'el error de rango dice el límite en dd/mm/aaaa',
    (dp.dateTextError({ status: 'ok', iso: '2026-03-01' }, min, max) ?? '').includes('10/03/2026') &&
      (dp.dateTextError({ status: 'ok', iso: '2026-04-01' }, min, max) ?? '').includes('20/03/2026'),
  );
  comprobar(
    'un mes sin días elegibles se detecta (para deshabilitar las flechas)',
    !dp.monthHasSelectableDays(2026, 2, min, max) &&
      dp.monthHasSelectableDays(2026, 3, min, max) &&
      !dp.monthHasSelectableDays(2026, 4, min, max),
  );
  igual(
    'al abrir sin valor, el foco va a hoy acotado al rango',
    dp.initialFocusDate('', { min, max, today: '2026-10-08' }),
    max,
  );
  igual(
    'al abrir con valor, el foco va al valor',
    dp.initialFocusDate('2026-03-15', { min, max, today: '2026-10-08' }),
    '2026-03-15',
  );
  igual(
    'años del selector rápido con min/max (de más nuevo a más viejo)',
    dp.yearOptions(2026, { min: '2020-05-01', max: '2026-10-08' }),
    [2026, 2025, 2024, 2023, 2022, 2021, 2020],
  );
  const sinLimites = dp.yearOptions(2026, { today: '2026-10-08' });
  comprobar(
    'sin límites, el selector de año llega 100 años atrás (fechas de nacimiento)',
    sinLimites.includes(2012) && sinLimites.includes(1926) && sinLimites[0] === 2036,
    `${sinLimites[0]}…${sinLimites.at(-1)}`,
  );
  comprobar(
    'el año visible siempre está en la lista aunque quede afuera',
    dp.yearOptions(1950, { min: '2000-01-01', max: '2010-01-01' }).includes(1950),
  );
}

// -------------------------------------------------
// 7. Grilla del mes (semana desde el lunes)
// -------------------------------------------------
{
  igual('los encabezados arrancan el lunes', dp.WEEKDAY_SHORT_ES[0], 'Lu');
  igual('y terminan el domingo', dp.WEEKDAY_NAMES_ES[6], 'domingo');
  igual('1/1/2024 fue lunes (índice 0)', dp.weekdayIndex('2024-01-01'), 0);
  igual('7/1/2024 fue domingo (índice 6)', dp.weekdayIndex('2024-01-07'), 6);

  const feb2021 = dp.monthGrid(2021, 2);
  igual('febrero 2021 (arranca lunes, 28 días) ocupa 4 semanas justas', feb2021.length, 4);
  igual('su primera celda es el 1', feb2021[0][0], '2021-02-01');

  const oct2026 = dp.monthGrid(2026, 10);
  igual('octubre 2026 arranca jueves: 3 huecos antes del 1', oct2026[0].slice(0, 4), [null, null, null, '2026-10-01']);
  comprobar('todas las semanas tienen 7 celdas', oct2026.every((semana) => semana.length === 7));
  const dias = oct2026.flat().filter(Boolean);
  comprobar(
    'están los 31 días, en orden y sin repetir',
    dias.length === 31 && dias.every((d, i) => d === `2026-10-${String(i + 1).padStart(2, '0')}`),
  );
  comprobar(
    'cada día cae en la columna de su día de semana',
    oct2026.every((semana) => semana.every((d, col) => d === null || dp.weekdayIndex(d) === col)),
  );
  igual('febrero bisiesto tiene 29 días en la grilla', dp.monthGrid(2024, 2).flat().filter(Boolean).length, 29);
  igual('nombre del mes', dp.formatMonthYearEs(2012, 3), 'marzo de 2012');
}

// -------------------------------------------------
// 8. Teclado: siguiente foco en los bordes
// -------------------------------------------------
{
  const casos = [
    ['ArrowRight del 31/10 pasa al 1/11', '2026-10-31', 'ArrowRight', false, '2026-11-01'],
    ['ArrowLeft del 1/10 vuelve al 30/09', '2026-10-01', 'ArrowLeft', false, '2026-09-30'],
    ['ArrowDown del 29/10 baja al 5/11', '2026-10-29', 'ArrowDown', false, '2026-11-05'],
    ['ArrowUp del 3/10 sube al 26/09', '2026-10-03', 'ArrowUp', false, '2026-09-26'],
    ['Home (Inicio) del jueves 1/10 va al lunes 28/09', '2026-10-01', 'Home', false, '2026-09-28'],
    ['End (Fin) del jueves 1/10 va al domingo 4/10', '2026-10-01', 'End', false, '2026-10-04'],
    ['Home en un lunes se queda', '2026-10-05', 'Home', false, '2026-10-05'],
    ['End en un domingo se queda', '2026-10-04', 'End', false, '2026-10-04'],
    ['PageUp (RePág) del 31/03 va al 28/02', '2026-03-31', 'PageUp', false, '2026-02-28'],
    ['PageDown (AvPág) del 31/01/2024 va al 29/02 bisiesto', '2024-01-31', 'PageDown', false, '2024-02-29'],
    ['PageDown del 15/12 cruza el año', '2026-12-15', 'PageDown', false, '2027-01-15'],
    ['Mayús+PageUp del 29/02/2024 va al 28/02/2023', '2024-02-29', 'PageUp', true, '2023-02-28'],
    ['Mayús+PageDown suma un año', '2012-03-05', 'PageDown', true, '2013-03-05'],
    ['ArrowRight del 31/12 cruza el año', '2026-12-31', 'ArrowRight', false, '2027-01-01'],
  ];
  for (const [descripcion, desde, tecla, shift, esperado] of casos) {
    igual(`teclado: ${descripcion}`, dp.nextFocusDate(desde, tecla, { shift }), esperado);
  }
  const rango = { min: '2026-10-01', max: '2026-10-31' };
  igual('el foco no sale del máximo', dp.nextFocusDate('2026-10-31', 'ArrowRight', rango), '2026-10-31');
  igual('el foco no sale del mínimo', dp.nextFocusDate('2026-10-01', 'ArrowLeft', rango), '2026-10-01');
  igual('PageDown contra el máximo se acota', dp.nextFocusDate('2026-10-15', 'PageDown', rango), '2026-10-31');
  comprobar('isGridKey reconoce las teclas de la grilla', dp.isGridKey('PageUp') && !dp.isGridKey('Enter'));
  igual('addMonths conserva el día cuando existe', dp.addMonths('2026-01-15', 1), '2026-02-15');
  igual('withMonthYear acota el día', dp.withMonthYear('2024-03-31', 2023, 2), '2023-02-28');
}

// -------------------------------------------------
// Resultado
// -------------------------------------------------
if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} problema(s) en los selectores:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('');
  process.exit(1);
}

console.log(`Chequeos ejecutados: ${verificaciones.length}`);
console.log(
  '✅ Sin selectores nativos; el selector de fecha parsea, valida, arma la grilla y navega sin correrse de día.',
);
