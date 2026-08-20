// ===========================================
// Medición manual de memoria de los reportes (T23 / DoD)
// ===========================================
//
// El DoD de T23 pide que generar un reporte de 20.000 filas mantenga el RSS del
// proceso por debajo de 300MB. Ese número no se puede verificar adentro de Jest:
// un worker de Jest arranca en ~280MB de RSS sólo por ts-jest, el grafo de
// módulos de Nest y las suites anteriores, así que el techo se rompe antes de
// generar la primera fila. La suite `reports-streaming.e2e-spec.ts` acota el
// **delta** de RSS, que sí es atribuible al reporte.
//
// Este script mide el número absoluto en un proceso limpio, y de paso corre la
// implementación vieja (todo en memoria + `writeBuffer()`) para tener con qué
// comparar.
//
// Uso:
//   npm run build
//   node test/reports-memoria-manual.js            # 20.000 filas
//   node --expose-gc test/reports-memoria-manual.js 50000
//
// No es un `.e2e-spec.ts` a propósito: el `testRegex` de jest-e2e.json no lo
// levanta y no ensucia la suite con una medición que depende de la máquina.
const { Writable } = require('stream');
const ExcelJS = require('exceljs');
const { ReportsService } = require('../dist/modules/reports/reports.service');

const MB = 1024 * 1024;
const TOTAL = Number(process.argv[2] || 20000);
const LOTE = 1000;

function participanteEn(i) {
  return {
    id: `p${String(i).padStart(11, '0')}`,
    dni: `4${String(20000000 + i)}`,
    firstName: 'Juan Ignacio',
    lastName: `Pérez ${String(i).padStart(6, '0')}`,
    sex: i % 2 === 0 ? 'MASCULINO' : 'FEMENINO',
    birthDate: new Date('2010-05-15T00:00:00.000Z'),
    department: 'Pilcomayo',
    locality: 'Clorinda',
    phone: '3704123456',
    email: `participante.${i}@example.com`,
    inscriptions: [
      { category: { name: 'Sub-14 Masculino', discipline: { name: 'Fútbol' } } },
    ],
  };
}

/** Doble de Prisma que genera las filas por página (nunca las guarda todas). */
const prismaFalso = {
  participant: {
    findMany: (args) => {
      const desde = args.cursor ? Number(args.cursor.id.slice(1)) + 1 : 0;
      const hasta = Math.min(desde + (args.take || TOTAL), TOTAL);
      const pagina = [];
      for (let i = desde; i < hasta; i++) pagina.push(participanteEn(i));
      return Promise.resolve(pagina);
    },
  },
};

class DestinoNulo extends Writable {
  constructor() {
    super();
    this.bytes = 0;
    this.headersSent = false;
    this.terminado = new Promise((resolve) => {
      this.once('finish', resolve);
      this.once('close', resolve);
      this.once('error', resolve);
    });
  }
  _write(chunk, _enc, cb) {
    this.headersSent = true;
    this.bytes += chunk.length;
    cb();
  }
}

/** Corre `fn` muestreando memoria cada 20ms y devuelve los picos. */
async function medir(nombre, fn) {
  if (global.gc) global.gc();
  await new Promise((r) => setTimeout(r, 100));

  const base = process.memoryUsage();
  let picoRss = base.rss;
  let picoHeap = base.heapUsed;
  const t0 = Date.now();
  const muestreo = setInterval(() => {
    const m = process.memoryUsage();
    if (m.rss > picoRss) picoRss = m.rss;
    if (m.heapUsed > picoHeap) picoHeap = m.heapUsed;
  }, 20);

  let bytes = 0;
  try {
    bytes = await fn();
  } finally {
    clearInterval(muestreo);
  }

  const fin = process.memoryUsage();
  if (fin.rss > picoRss) picoRss = fin.rss;
  if (fin.heapUsed > picoHeap) picoHeap = fin.heapUsed;

  console.log(
    `${nombre.padEnd(26)} ` +
      `salida ${(bytes / MB).toFixed(1).padStart(6)}MB  ` +
      `RSS base ${(base.rss / MB).toFixed(0).padStart(4)}MB  ` +
      `RSS pico ${(picoRss / MB).toFixed(0).padStart(4)}MB  ` +
      `ΔRSS ${((picoRss - base.rss) / MB).toFixed(0).padStart(4)}MB  ` +
      `Δheap ${((picoHeap - base.heapUsed) / MB).toFixed(0).padStart(4)}MB  ` +
      `${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  return picoRss;
}

// ===========================================
// Implementación VIEJA (para comparar)
// ===========================================
async function viejaFilas() {
  // Un único findMany sin paginar, como antes de T23.
  const participantes = await prismaFalso.participant.findMany({});
  return participantes.map((p) => [
    p.dni,
    p.firstName,
    p.lastName,
    p.sex,
    p.birthDate.toISOString().split('T')[0],
    p.department,
    p.locality,
    p.phone || '',
    p.email || '',
    p.inscriptions
      .map((i) => `${i.category.discipline.name} - ${i.category.name}`)
      .join(' | '),
  ]);
}

const HEADERS = [
  'DNI',
  'Nombre',
  'Apellido',
  'Sexo',
  'Fecha Nacimiento',
  'Departamento',
  'Localidad',
  'Teléfono',
  'Email',
  'Categorías',
];

async function viejaCsv() {
  const filas = await viejaFilas();
  const csv = [HEADERS, ...filas]
    .map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const cuerpo = '﻿' + csv;
  const destino = new DestinoNulo();
  destino.end(cuerpo);
  return Buffer.byteLength(cuerpo);
}

async function viejaExcel() {
  const filas = await viejaFilas();
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Padrón Participantes', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  const header = ws.addRow(HEADERS);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0A3560' } },
      left: { style: 'thin', color: { argb: 'FF0A3560' } },
      bottom: { style: 'medium', color: { argb: 'FF041A33' } },
      right: { style: 'thin', color: { argb: 'FF0A3560' } },
    };
  });
  filas.forEach((valores, idx) => {
    const row = ws.addRow(valores);
    row.height = 22;
    const isEven = idx % 2 === 1;
    row.eachCell((cell) => {
      cell.font = { size: 10, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });
  ws.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const val = cell.value ? String(cell.value) : '';
      if (val.length > maxLength) maxLength = val.length;
    });
    column.width = Math.min(Math.max(maxLength + 4, 12), 40);
  });
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const destino = new DestinoNulo();
  destino.end(buffer);
  return buffer.length;
}

// ===========================================
// Implementación NUEVA
// ===========================================
const service = new ReportsService(prismaFalso);

async function nuevaCsv() {
  const destino = new DestinoNulo();
  await service.escribirCsv(destino, service.especificacionParticipants());
  await destino.terminado;
  return destino.bytes;
}

async function nuevaExcel() {
  const destino = new DestinoNulo();
  await service.escribirExcel(destino, service.especificacionParticipants());
  await destino.terminado;
  return destino.bytes;
}

const CASOS = {
  'nueva-csv': ['NUEVA csv (streaming)', nuevaCsv],
  'nueva-xlsx': ['NUEVA xlsx (streaming)', nuevaExcel],
  'vieja-csv': ['VIEJA csv (en memoria)', viejaCsv],
  'vieja-xlsx': ['VIEJA xlsx (en memoria)', viejaExcel],
};

/**
 * Cada caso corre en su **propio proceso**. Es imprescindible: el RSS de Node no
 * baja cuando V8 libera objetos (el allocator se queda con las páginas), así que
 * si la corrida vieja dejara el RSS en 900MB, la nueva heredaría ese piso y el
 * número absoluto no querría decir nada.
 */
async function main() {
  const caso = process.argv[3];

  if (caso) {
    const [nombre, fn] = CASOS[caso];
    await medir(nombre, fn);
    return;
  }

  const { spawnSync } = require('child_process');
  console.log(
    `Filas: ${TOTAL} — lote: ${LOTE} — un proceso por caso\n` +
      `RSS inicial de un proceso Node vacío: ` +
      `${(process.memoryUsage().rss / MB).toFixed(0)}MB\n`,
  );
  for (const clave of Object.keys(CASOS)) {
    spawnSync(
      process.execPath,
      [__filename, String(TOTAL), clave],
      { stdio: 'inherit' },
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
