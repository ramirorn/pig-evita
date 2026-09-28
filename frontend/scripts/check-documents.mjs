// ===========================================
// Carga de documentos (DNI, ficha médica y resto)
//
// Lo que este chequeo fija es lo que, si se rompe, deja a un delegado con el
// teléfono en la mano sin saber qué hacer:
//
//   1. **El filtro del cliente coincide con el backend.** Mismo límite (5 MB,
//      422) y mismos formatos que `FileSignaturePipe` (JPG, PNG, PDF, 400). Se
//      leen los archivos REALES del backend: si allá cambia el límite o se
//      suma un formato y acá no, esto se pone en rojo.
//   2. **Tres errores, tres mensajes, tres acciones.** Muy pesado (413/422),
//      no es lo que dice ser (400) y caída de red (sin respuesta) no pueden
//      decir lo mismo: cada uno pide hacer algo distinto.
//   3. **La carpeta se lee bien.** Al reemplazar, el backend deja el anterior
//      como RECHAZADO; el vigente es el más reciente de cada tipo, y "qué
//      falta" sale de ahí.
//   4. **La pantalla de Documentos no inventa cifras.** La maqueta tenía
//      12 / 845 / 3 y tres filas escritas a mano.
//
// Se bundlea el **fuente real** con esbuild —igual que los otros check-*.mjs—.
//
// Corre con: npm run check:documents
// ===========================================
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const BACKEND = path.resolve(RAIZ, '..', 'backend');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-documents.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

execSync(
  [
    'npx esbuild',
    `"${path.join(RAIZ, 'scripts', 'documents.entry.ts')}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --log-level=error',
    `"--alias:@=${SRC}"`,
    '"--define:import.meta.env={\\"DEV\\":false}"',
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const {
  MAX_DOCUMENT_BYTES,
  ALLOWED_DOCUMENT_FORMATS,
  DOCUMENT_ACCEPT_ATTRIBUTE,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_HINTS,
  FEATURED_DOCUMENT_TYPES,
  SECONDARY_DOCUMENT_TYPES,
  DOCUMENT_STATUS_BADGE_CLASSES,
  DOCUMENT_ERROR_MESSAGES,
  documentErrorKindFromStatus,
  classifyUploadError,
  isCanceledUpload,
  validateDocumentFile,
  uploadPercent,
  safeDocumentUrl,
  currentDocumentsByType,
  missingFeaturedTypes,
  countByStatus,
  describeMissing,
  validateRejectionNote,
  isDocumentType,
  formatFileSize,
  DocumentType,
  DocumentStatus,
} = await import(pathToFileURL(SALIDA).href);

const MB = 1024 * 1024;
const archivo = (name, size, type) => ({ name, size, type });
const leer = (relativo) => readFile(path.join(RAIZ, relativo), 'utf8');

// -------------------------------------------------
// 1. Paridad con el backend
// -------------------------------------------------
{
  const controller = await readFile(
    path.join(BACKEND, 'src/modules/documents/documents.controller.ts'),
    'utf8',
  );
  const pipe = await readFile(
    path.join(BACKEND, 'src/modules/documents/file-signature.pipe.ts'),
    'utf8',
  );
  const schema = await readFile(path.join(BACKEND, 'prisma/schema.prisma'), 'utf8');

  comprobar(
    'el límite del cliente es el mismo que el del controller (5 MB)',
    MAX_DOCUMENT_BYTES === 5 * MB && /maxSize:\s*5\s*\*\s*1024\s*\*\s*1024/.test(controller),
    `cliente=${MAX_DOCUMENT_BYTES}`,
  );
  comprobar(
    'el tamaño excedido en el backend sigue siendo 422',
    controller.includes('HttpStatus.UNPROCESSABLE_ENTITY'),
  );

  // `'.jpg': 'jpeg'` en EXTENSION_A_TIPO, `jpeg: 'image/jpeg'` en TIPOS_PERMITIDOS.
  const extensionATipo = Object.fromEntries(
    [...pipe.matchAll(/'(\.[a-z0-9]+)':\s*'([a-z]+)'/g)].map((m) => [m[1], m[2]]),
  );
  const tipoAMime = Object.fromEntries(
    [...pipe.matchAll(/^\s*([a-z]+):\s*'([a-z]+\/[a-z0-9.+-]+)'/gm)].map((m) => [m[1], m[2]]),
  );
  const backend = new Map();
  for (const [ext, tipo] of Object.entries(extensionATipo)) {
    const mime = tipoAMime[tipo];
    if (mime) backend.set(ext, mime);
  }
  const cliente = new Map();
  for (const [mime, exts] of Object.entries(ALLOWED_DOCUMENT_FORMATS)) {
    for (const ext of exts) cliente.set(ext, mime);
  }
  const ordenar = (m) => JSON.stringify([...m.entries()].sort());
  comprobar(
    'las extensiones y MIME del cliente son exactamente las del FileSignaturePipe',
    backend.size > 0 && ordenar(backend) === ordenar(cliente),
    `backend=${ordenar(backend)} cliente=${ordenar(cliente)}`,
  );

  const enumPrisma = schema.match(/enum DocumentType \{([^}]*)\}/)?.[1] ?? '';
  const valoresPrisma = enumPrisma.split(/\s+/).filter(Boolean).sort();
  comprobar(
    'el enum DocumentType del frontend es el de Prisma',
    JSON.stringify(valoresPrisma) === JSON.stringify(Object.values(DocumentType).sort()),
    `prisma=${valoresPrisma.join(',')}`,
  );
}

// -------------------------------------------------
// 2. Validación en el cliente
// -------------------------------------------------
comprobar(
  'el accept del input es image/jpeg,image/png,application/pdf',
  DOCUMENT_ACCEPT_ATTRIBUTE === 'image/jpeg,image/png,application/pdf',
  DOCUMENT_ACCEPT_ATTRIBUTE,
);

const aceptados = [
  archivo('dni-frente.jpg', 2 * MB, 'image/jpeg'),
  archivo('DNI.JPEG', 800_000, 'image/jpeg'),
  archivo('dorso.png', 1 * MB, 'image/png'),
  archivo('ficha medica.pdf', 300_000, 'application/pdf'),
  // Android a veces no informa el MIME: manda la extensión.
  archivo('IMG_2026.jpg', 1 * MB, ''),
  // MIME no registrado pero habitual.
  archivo('foto.jpg', 1 * MB, 'image/jpg'),
  // Justo en el límite.
  archivo('limite.pdf', 5 * MB, 'application/pdf'),
];
for (const f of aceptados) {
  const r = validateDocumentFile(f);
  comprobar(`acepta ${f.name} (${f.type || 'sin MIME'}, ${f.size} B)`, r.ok === true, JSON.stringify(r));
}
comprobar(
  'un PDF se previsualiza como PDF y una foto como imagen',
  validateDocumentFile(aceptados[3]).preview === 'pdf' && validateDocumentFile(aceptados[0]).preview === 'image',
);

const rechazados = [
  [archivo('grande.jpg', 5 * MB + 1, 'image/jpeg'), 'too-large'],
  [archivo('scan.pdf', 12 * MB, 'application/pdf'), 'too-large'],
  // Tamaño antes que formato: al que sacó una foto HEIC de 8 MB le sirve más
  // saber que es pesada (achicarla suele convertirla).
  [archivo('IMG_0001.HEIC', 8 * MB, 'image/heic'), 'too-large'],
  [archivo('IMG_0001.heic', 2 * MB, 'image/heic'), 'wrong-type'],
  [archivo('foto.webp', 1 * MB, 'image/webp'), 'wrong-type'],
  [archivo('animada.gif', 1 * MB, 'image/gif'), 'wrong-type'],
  [archivo('virus.exe', 1 * MB, 'application/x-msdownload'), 'wrong-type'],
  [archivo('dni.jpg.exe', 1 * MB, ''), 'wrong-type'],
  [archivo('sin-extension', 1 * MB, 'image/jpeg'), 'wrong-type'],
  [archivo('ficha.docx', 1 * MB, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'wrong-type'],
  // Extensión y MIME que no cierran: renombrado.
  [archivo('ficha.pdf', 1 * MB, 'image/png'), 'wrong-type'],
  [archivo('dni.png', 1 * MB, 'image/jpeg'), 'wrong-type'],
  [archivo('vacio.jpg', 0, 'image/jpeg'), 'empty'],
];
for (const [f, esperado] of rechazados) {
  const r = validateDocumentFile(f);
  comprobar(
    `rechaza ${f.name} como ${esperado}`,
    r.ok === false && r.kind === esperado,
    JSON.stringify(r),
  );
}

// -------------------------------------------------
// 3. Errores HTTP → mensaje
// -------------------------------------------------
comprobar('413 → muy pesado', documentErrorKindFromStatus(413) === 'too-large');
comprobar('422 → muy pesado', documentErrorKindFromStatus(422) === 'too-large');
comprobar('400 → no es lo que dice ser', documentErrorKindFromStatus(400) === 'wrong-type');
comprobar('sin respuesta → red', documentErrorKindFromStatus(null) === 'network');
comprobar('403 → sin permiso', documentErrorKindFromStatus(403) === 'forbidden');
comprobar('404 → participante inexistente', documentErrorKindFromStatus(404) === 'not-found');
comprobar('500 → servidor', documentErrorKindFromStatus(500) === 'server');

comprobar(
  'un error de Axios con response 422 se clasifica como muy pesado',
  classifyUploadError({ isAxiosError: true, response: { status: 422, data: {} } }) === 'too-large',
);
comprobar(
  'un error de Axios con response 400 se clasifica como tipo equivocado',
  classifyUploadError({ isAxiosError: true, response: { status: 400, data: {} } }) === 'wrong-type',
);
comprobar(
  'un Network Error (sin response) se clasifica como red',
  classifyUploadError({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' }) === 'network',
);
comprobar(
  'un timeout (ECONNABORTED, sin response) se clasifica como red',
  classifyUploadError({ isAxiosError: true, code: 'ECONNABORTED' }) === 'network',
);
comprobar('una cancelación no cuenta como fallo', isCanceledUpload({ code: 'ERR_CANCELED', name: 'CanceledError' }));
comprobar('una caída de red no es una cancelación', !isCanceledUpload({ code: 'ERR_NETWORK' }));

{
  const pesado = DOCUMENT_ERROR_MESSAGES['too-large'];
  const tipo = DOCUMENT_ERROR_MESSAGES['wrong-type'];
  const red = DOCUMENT_ERROR_MESSAGES.network;
  const titulos = new Set([pesado.title, tipo.title, red.title]);
  const acciones = new Set([pesado.action, tipo.action, red.action]);
  comprobar('los tres mensajes clave tienen títulos distintos', titulos.size === 3);
  comprobar('los tres mensajes clave piden acciones distintas', acciones.size === 3);
  comprobar('muy pesado nombra el límite de 5 MB', pesado.action.includes('5 MB'));
  comprobar(
    'muy pesado orienta a achicar o sacar otra foto',
    /sacá otra foto|recort|menor calidad|menos resolución/i.test(pesado.action),
  );
  comprobar('tipo equivocado orienta a elegir el archivo real', /original/i.test(tipo.action));
  comprobar('red orienta a reintentar', /reintentar/i.test(red.action));
  comprobar('sólo la red y el servidor ofrecen reintentar con el mismo archivo',
    red.retryable && DOCUMENT_ERROR_MESSAGES.server.retryable && !pesado.retryable && !tipo.retryable);

  for (const [kind, msg] of Object.entries(DOCUMENT_ERROR_MESSAGES)) {
    comprobar(`el mensaje ${kind} tiene título y acción`, msg.title.trim() !== '' && msg.action.trim() !== '');
    // Voseo: nada de "usted"/"puede"/"intente".
    comprobar(
      `el mensaje ${kind} está en voseo`,
      !/\b(usted|intente|verifique|seleccione|elija)\b/i.test(`${msg.title} ${msg.action}`),
    );
  }
}

// -------------------------------------------------
// 4. Tipos y etiquetas
// -------------------------------------------------
{
  const todos = Object.values(DocumentType);
  comprobar(
    'los protagonistas son DNI frente, DNI dorso y ficha médica',
    JSON.stringify([...FEATURED_DOCUMENT_TYPES]) ===
      JSON.stringify([DocumentType.DNI_FRENTE, DocumentType.DNI_DORSO, DocumentType.CERTIFICADO_MEDICO]),
  );
  comprobar(
    'protagonistas + secundarios cubren el enum sin repetir',
    FEATURED_DOCUMENT_TYPES.length + SECONDARY_DOCUMENT_TYPES.length === todos.length &&
      new Set([...FEATURED_DOCUMENT_TYPES, ...SECONDARY_DOCUMENT_TYPES]).size === todos.length,
  );
  for (const type of todos) {
    comprobar(`${type} tiene etiqueta`, typeof DOCUMENT_TYPE_LABELS[type] === 'string' && DOCUMENT_TYPE_LABELS[type] !== '');
    comprobar(`${type} tiene ayuda`, typeof DOCUMENT_TYPE_HINTS[type] === 'string' && DOCUMENT_TYPE_HINTS[type] !== '');
    comprobar(`${type} se reconoce como tipo`, isDocumentType(type));
  }
  comprobar('un valor fuera del enum no se acepta', !isDocumentType('PASAPORTE'));
  for (const status of Object.values(DocumentStatus)) {
    comprobar(`${status} tiene clases de badge completas`, /^bg-\S+ text-\S+ border-\S+$/.test(DOCUMENT_STATUS_BADGE_CLASSES[status] ?? ''));
  }
}

// -------------------------------------------------
// 5. Progreso, URLs y tamaños
// -------------------------------------------------
comprobar('progreso 50/100 → 50', uploadPercent(50, 100) === 50);
comprobar('progreso sin total → desconocido', uploadPercent(50, undefined) === null && uploadPercent(50, 0) === null);
comprobar('progreso nunca pasa de 100', uploadPercent(150, 100) === 100);

comprobar('una URL pre-firmada https se usa', safeDocumentUrl('https://minio.example/bucket/a.jpg?X-Amz=1') !== null);
comprobar('una URL http (MinIO local) se usa', safeDocumentUrl('http://localhost:9000/evita/a.pdf') !== null);
comprobar('javascript: se descarta', safeDocumentUrl('javascript:alert(1)') === null);
comprobar('data: se descarta', safeDocumentUrl('data:text/html,<script>x</script>') === null);
comprobar('una URL relativa o rota se descarta', safeDocumentUrl('/relativa') === null && safeDocumentUrl(undefined) === null);

comprobar('1536 B → "2 KB"', formatFileSize(1536) === '2 KB', formatFileSize(1536));
comprobar('1,5 MB con coma decimal', formatFileSize(1.5 * MB) === '1,5 MB', formatFileSize(1.5 * MB));
comprobar('un tamaño inválido no imprime basura', formatFileSize(-1) === '' && formatFileSize(Number.NaN) === '');

// -------------------------------------------------
// 6. La carpeta: vigente por tipo y qué falta
// -------------------------------------------------
{
  const doc = (id, documentType, status, createdAt) => ({
    id,
    participantId: 'p1',
    documentType,
    status,
    createdAt,
    fileKey: `k-${id}`,
    originalName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    fileSize: 1000,
    updatedAt: createdAt,
  });

  comprobar('sin papeles faltan los tres', missingFeaturedTypes([]).length === 3);
  comprobar(
    'el aviso de faltantes enumera en castellano',
    describeMissing([DocumentType.DNI_DORSO, DocumentType.CERTIFICADO_MEDICO]) === 'Faltan DNI (dorso) y Ficha médica.',
    describeMissing([DocumentType.DNI_DORSO, DocumentType.CERTIFICADO_MEDICO]),
  );
  comprobar('un solo faltante va en singular', describeMissing([DocumentType.DNI_FRENTE]) === 'Falta DNI (frente).');
  comprobar('sin faltantes no hay aviso', describeMissing([]) === null);

  // Frente reemplazado: el viejo quedó RECHAZADO, el nuevo PENDIENTE.
  const carpeta = [
    doc('frente-nuevo', DocumentType.DNI_FRENTE, DocumentStatus.PENDIENTE, '2026-09-20T10:00:00.000Z'),
    doc('ficha', DocumentType.CERTIFICADO_MEDICO, DocumentStatus.RECHAZADO, '2026-09-19T10:00:00.000Z'),
    doc('frente-viejo', DocumentType.DNI_FRENTE, DocumentStatus.RECHAZADO, '2026-09-18T10:00:00.000Z'),
    doc('foto', DocumentType.FOTO, DocumentStatus.APROBADO, '2026-09-17T10:00:00.000Z'),
  ];
  const vigentes = currentDocumentsByType(carpeta);
  comprobar('el vigente de cada tipo es el más reciente', vigentes.get(DocumentType.DNI_FRENTE)?.id === 'frente-nuevo');
  comprobar(
    'el orden de llegada no cambia cuál es el vigente',
    currentDocumentsByType([...carpeta].reverse()).get(DocumentType.DNI_FRENTE)?.id === 'frente-nuevo',
  );
  const faltan = missingFeaturedTypes(carpeta);
  comprobar(
    'falta el dorso (nunca se subió) y la ficha (rechazada)',
    JSON.stringify(faltan) === JSON.stringify([DocumentType.DNI_DORSO, DocumentType.CERTIFICADO_MEDICO]),
    JSON.stringify(faltan),
  );
  const conteo = countByStatus(carpeta);
  comprobar(
    'el conteo usa sólo los vigentes (el reemplazado no suma rechazos)',
    conteo.PENDIENTE === 1 && conteo.APROBADO === 1 && conteo.RECHAZADO === 1,
    JSON.stringify(conteo),
  );
}

comprobar('rechazar sin motivo no se permite', validateRejectionNote('   ') !== null);
comprobar('rechazar con motivo se permite', validateRejectionNote('Foto borrosa') === null);

// -------------------------------------------------
// 7. El fuente: sin cifras inventadas, capas respetadas
// -------------------------------------------------
{
  const pagina = await leer('src/pages/admin/DocumentsPage.tsx');
  comprobar(
    'DocumentsPage no tiene las cifras inventadas de la maqueta',
    !/>\s*(12|845|3)\s*</.test(pagina) && !pagina.includes('845'),
  );
  comprobar(
    'DocumentsPage no dibuja números literales en JSX',
    !/>\s*\d+\s*<\//.test(pagina),
  );
  comprobar(
    'DocumentsPage no tiene filas escritas a mano',
    !pagina.includes('pendingReviews') && !pagina.includes('Pérez, Juan') && !/submittedAt:\s*'/.test(pagina),
  );
  comprobar('DocumentsPage lee la carpeta real', pagina.includes('useParticipantDocuments'));
  comprobar('DocumentsPage calcula las cifras con countByStatus', pagina.includes('countByStatus('));
  comprobar('DocumentsPage no habla HTTP directo', !pagina.includes('apiClient') && !pagina.includes('documentsApi'));

  const dialogo = await leer('src/pages/admin/documents/ReviewDocumentDialog.tsx');
  comprobar('"Revisar" usa PATCH /documents/:id/review vía useReviewDocument', dialogo.includes('useReviewDocument'));

  const api = await leer('src/api/documents.api.ts');
  comprobar('la subida reporta progreso (onUploadProgress)', api.includes('onUploadProgress'));
  comprobar('la subida se puede cancelar (signal)', /signal:\s*options\.signal/.test(api));
  comprobar(
    'la revisión manda `notes` (el DTO rechaza `rejectionNote` con forbidNonWhitelisted)',
    /notes\?:\s*string/.test(api) && !/rejectionNote\?:/.test(api),
  );

  const uploader = await leer('src/components/shared/DocumentUploader.tsx');
  comprobar('el uploader usa el accept del módulo', uploader.includes('accept={DOCUMENT_ACCEPT_ATTRIBUTE}'));
  comprobar(
    'el uploader ofrece cámara (capture) y además elegir archivo (sin capture)',
    uploader.includes('capture="environment"') && (uploader.match(/type="file"/g) ?? []).length >= 2,
  );
  comprobar('el uploader anuncia estado y errores (aria-live)', uploader.includes('aria-live="polite"') && uploader.includes('role="alert"'));
  comprobar('el uploader tiene barra de progreso accesible', uploader.includes('role="progressbar"'));
  comprobar('el uploader acepta drag & drop', uploader.includes('onDrop='));
  comprobar('el uploader no hace HTTP (recibe onUpload)', !uploader.includes('@/api/') && !uploader.includes('@/hooks/'));

  const reglas = await leer('src/lib/documents/documentRules.ts');
  comprobar('el módulo de reglas no depende de React', !/from 'react'/.test(reglas));

  for (const rel of [
    'src/components/shared/DocumentUploader.tsx',
    'src/components/documents/ParticipantDocumentsPanel.tsx',
    'src/components/documents/InscriptionDocuments.tsx',
    'src/pages/admin/DocumentsPage.tsx',
    'src/pages/admin/documents/ReviewDocumentDialog.tsx',
  ]) {
    const fuente = await leer(rel);
    comprobar(`${rel} no interpola clases de Tailwind`, !/className=\{`[^`]*\$\{/.test(fuente));
  }

  const individual = await leer('src/pages/public/inscription/StepSuccess.tsx');
  const plantel = await leer('src/pages/admin/inscription/StepTeamSuccess.tsx');
  comprobar('el paso final individual ofrece la carga', individual.includes('IndividualInscriptionDocuments'));
  comprobar('el paso final del plantel ofrece la carga por integrante', plantel.includes('TeamInscriptionDocuments'));
}

// -------------------------------------------------
// Resultado
// -------------------------------------------------
if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} problema(s) en la carga de documentos:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('');
  process.exit(1);
}

console.log(`Chequeos ejecutados: ${verificaciones.length}`);
console.log('✅ Límites, formatos y mensajes de la carga de documentos alineados con el backend.');
