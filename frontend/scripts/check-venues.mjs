// ===========================================
// Foto principal de la sede
//
// Lo que este chequeo fija:
//
//   1. **El filtro del cliente coincide con el backend.** Mismo límite (5 MB,
//      422) y mismos formatos que `ImageSignaturePipe` (JPG, PNG, WebP; 400).
//      Se leen los archivos REALES del backend: si allá cambia el límite o se
//      suma un formato y acá no, esto se pone en rojo.
//   2. **Cada error, su mensaje.** Muy pesada (413/422), no es una imagen de
//      verdad (400), caída de red (sin respuesta) y conflicto (409) piden hacer
//      cosas distintas: no pueden decir lo mismo.
//   3. **La URL de la foto se resuelve contra el ORIGEN de la API**, sea la base
//      relativa (Docker, mismo origen) o absoluta (`npm run dev` contra :3000),
//      y nada que no sea una ruta nuestra llega a un `src`.
//   4. **Documentos no cambió**: DNI y ficha siguen sin aceptar WebP.
//   5. **La reducción antes de subir** decide bien cuándo, a qué tamaño y si
//      conviene (si no achica, se sube la original).
//   6. **Reuso, no copia**: el panel usa el mismo `DocumentUploader` con otras
//      reglas.
//
// Se bundlea el **fuente real** con esbuild —igual que los otros check-*.mjs—.
//
// Corre con: npm run check:venues
// ===========================================
import { execSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const BACKEND = path.resolve(RAIZ, '..', 'backend');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-venues.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

execSync(
  [
    'npx esbuild',
    `"${path.join(RAIZ, 'scripts', 'venues.entry.ts')}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --log-level=error',
    `"--alias:@=${SRC}"`,
    '"--define:import.meta.env={\\"DEV\\":false}"',
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const {
  MAX_VENUE_IMAGE_BYTES,
  ALLOWED_VENUE_IMAGE_FORMATS,
  VENUE_IMAGE_ACCEPT_ATTRIBUTE,
  VENUE_IMAGE_FORMATS_HINT,
  VENUE_IMAGE_ERROR_MESSAGES,
  VENUE_IMAGE_UPLOADER_RULES,
  VENUE_IMAGE_OPTIMIZE_MAX_SIDE,
  VENUE_IMAGE_OPTIMIZE_MAX_BYTES,
  VENUE_IMAGE_TARGET_SIDE,
  VENUE_IMAGE_QUALITY,
  venueImageErrorKindFromStatus,
  classifyVenueImageError,
  validateVenueImageFile,
  needsVenueImageOptimization,
  scaledVenueImageSize,
  renameWithExtension,
  pickSmallerFile,
  resolveVenueImageUrl,
  pickVenueImageSrc,
  venueImageAlt,
  DOCUMENT_ACCEPT_ATTRIBUTE,
  DOCUMENT_UPLOADER_RULES,
  validateDocumentFile,
} = await import(pathToFileURL(SALIDA).href);

const MB = 1024 * 1024;
const archivo = (name, size, type) => ({ name, size, type });
const leer = (relativo) => readFile(path.join(RAIZ, relativo), 'utf8');
const leerBackend = (relativo) => readFile(path.join(BACKEND, relativo), 'utf8');

// -------------------------------------------------
// 1. Paridad con el backend
// -------------------------------------------------
{
  const util = await leerBackend('src/modules/venues/venue-image.util.ts');
  const interceptor = await leerBackend('src/modules/venues/venue-image-upload.interceptor.ts');
  const pipe = await leerBackend('src/modules/venues/image-signature.pipe.ts');

  comprobar(
    'el límite del cliente es el del backend (VENUE_IMAGE_MAX_BYTES = 5 MB)',
    MAX_VENUE_IMAGE_BYTES === 5 * MB &&
      /VENUE_IMAGE_MAX_BYTES\s*=\s*5\s*\*\s*1024\s*\*\s*1024/.test(util),
    `cliente=${MAX_VENUE_IMAGE_BYTES}`,
  );
  comprobar(
    'multer corta con ese mismo límite',
    /fileSize:\s*VENUE_IMAGE_MAX_BYTES\s*\+\s*1/.test(interceptor),
  );
  comprobar(
    'el exceso de tamaño en el backend sigue siendo 422',
    interceptor.includes('UnprocessableEntityException'),
  );

  // `'.jpg': 'jpeg'` en EXTENSION_A_TIPO_IMAGEN, `jpeg: 'image/jpeg'` en TIPOS_IMAGEN.
  const bloque = (nombre) => {
    const inicio = pipe.indexOf(nombre);
    return inicio < 0 ? '' : pipe.slice(inicio, pipe.indexOf('}', inicio));
  };
  const extensionATipo = Object.fromEntries(
    [...bloque('EXTENSION_A_TIPO_IMAGEN').matchAll(/'(\.[a-z]+)':\s*'([a-z]+)'/g)].map((m) => [m[1], m[2]]),
  );
  const tipoAMime = Object.fromEntries(
    [...bloque('TIPOS_IMAGEN = {').matchAll(/([a-z]+):\s*'([a-z]+\/[a-z]+)'/g)].map((m) => [m[1], m[2]]),
  );

  const backend = {};
  for (const [extension, tipo] of Object.entries(extensionATipo)) {
    const mime = tipoAMime[tipo];
    (backend[mime] ??= []).push(extension);
  }
  const normalizar = (mapa) =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(mapa)
          .map(([mime, exts]) => [mime, [...exts].sort()])
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    );

  comprobar(
    'se pudieron leer los formatos del ImageSignaturePipe (red del propio chequeo)',
    Object.keys(extensionATipo).length >= 4 && Object.keys(tipoAMime).length >= 3,
    `extensiones=${JSON.stringify(extensionATipo)} tipos=${JSON.stringify(tipoAMime)}`,
  );
  comprobar(
    'los formatos del cliente son exactamente los del ImageSignaturePipe',
    normalizar(ALLOWED_VENUE_IMAGE_FORMATS) === normalizar(backend),
    `cliente=${normalizar(ALLOWED_VENUE_IMAGE_FORMATS)} backend=${normalizar(backend)}`,
  );
  comprobar(
    'el pipe de imágenes no acepta PDF',
    !pipe.includes("'application/pdf'") && !('application/pdf' in ALLOWED_VENUE_IMAGE_FORMATS),
  );
  comprobar(
    'el accept del input lista JPG, PNG y WebP',
    VENUE_IMAGE_ACCEPT_ATTRIBUTE === 'image/jpeg,image/png,image/webp',
    VENUE_IMAGE_ACCEPT_ATTRIBUTE,
  );
  comprobar(
    'la ayuda dice los formatos y el límite reales',
    /JPG/.test(VENUE_IMAGE_FORMATS_HINT) &&
      /PNG/.test(VENUE_IMAGE_FORMATS_HINT) &&
      /WebP/.test(VENUE_IMAGE_FORMATS_HINT) &&
      /5 MB/.test(VENUE_IMAGE_FORMATS_HINT),
    VENUE_IMAGE_FORMATS_HINT,
  );
}

// -------------------------------------------------
// 2. Validación en el cliente
// -------------------------------------------------
{
  const casos = [
    ['JPG', archivo('cancha.jpg', MB, 'image/jpeg'), true],
    ['JPEG', archivo('cancha.JPEG', MB, 'image/jpeg'), true],
    ['PNG', archivo('cancha.png', MB, 'image/png'), true],
    ['WebP', archivo('cancha.webp', MB, 'image/webp'), true],
    ['image/jpg (MIME no registrado que mandan algunos navegadores)', archivo('c.jpg', MB, 'image/jpg'), true],
    ['sin MIME (Android)', archivo('c.webp', MB, ''), true],
    ['exactamente 5 MB', archivo('c.jpg', 5 * MB, 'image/jpeg'), true],
  ];
  for (const [nombre, file, esperado] of casos) {
    const r = validateVenueImageFile(file);
    comprobar(`acepta ${nombre}`, r.ok === esperado, JSON.stringify(r));
  }

  const rechazos = [
    ['PDF', archivo('plano.pdf', MB, 'application/pdf'), 'not-an-image'],
    ['GIF', archivo('logo.gif', MB, 'image/gif'), 'not-an-image'],
    ['HEIC', archivo('foto.heic', MB, 'image/heic'), 'not-an-image'],
    ['extensión que no coincide con el MIME', archivo('c.png', MB, 'image/jpeg'), 'not-an-image'],
    ['sin extensión', archivo('cancha', MB, 'image/jpeg'), 'not-an-image'],
    ['5 MB + 1 byte', archivo('c.jpg', 5 * MB + 1, 'image/jpeg'), 'too-large'],
    ['archivo vacío', archivo('c.jpg', 0, 'image/jpeg'), 'empty'],
  ];
  for (const [nombre, file, tipo] of rechazos) {
    const r = validateVenueImageFile(file);
    comprobar(`rechaza ${nombre} como "${tipo}"`, !r.ok && r.kind === tipo, JSON.stringify(r));
  }

  const pesada = VENUE_IMAGE_UPLOADER_RULES.validate(archivo('c.jpg', 6 * MB, 'image/jpeg'));
  comprobar(
    'las reglas del uploader devuelven el mensaje de "muy pesada"',
    !pesada.ok && pesada.error === VENUE_IMAGE_ERROR_MESSAGES['too-large'],
  );
  const ok = VENUE_IMAGE_UPLOADER_RULES.validate(archivo('c.webp', MB, 'image/webp'));
  comprobar('las reglas del uploader previsualizan como imagen', ok.ok && ok.preview === 'image');
  comprobar(
    'el uploader de sede usa el accept de sede',
    VENUE_IMAGE_UPLOADER_RULES.accept === VENUE_IMAGE_ACCEPT_ATTRIBUTE,
  );
}

// -------------------------------------------------
// 3. Errores: un mensaje distinto por causa
// -------------------------------------------------
{
  const estados = [
    [422, 'too-large'],
    [413, 'too-large'],
    [400, 'not-an-image'],
    [415, 'not-an-image'],
    [409, 'conflict'],
    [null, 'network'],
    [401, 'forbidden'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [500, 'server'],
    [503, 'server'],
  ];
  for (const [status, tipo] of estados) {
    comprobar(
      `HTTP ${status ?? 'sin respuesta'} → "${tipo}"`,
      venueImageErrorKindFromStatus(status) === tipo,
      venueImageErrorKindFromStatus(status),
    );
  }
  comprobar(
    'un error de Axios con 409 se clasifica como conflicto',
    classifyVenueImageError({ response: { status: 409 } }) === 'conflict',
  );
  comprobar(
    'un error de red (sin response) se clasifica como red',
    classifyVenueImageError({ code: 'ERR_NETWORK', message: 'Network Error' }) === 'network',
  );
  comprobar(
    'describeError del uploader usa esta tabla',
    VENUE_IMAGE_UPLOADER_RULES.describeError({ response: { status: 409 } }) ===
      VENUE_IMAGE_ERROR_MESSAGES.conflict,
  );

  const clave = ['too-large', 'not-an-image', 'network', 'conflict'];
  const titulos = clave.map((k) => VENUE_IMAGE_ERROR_MESSAGES[k].title);
  const acciones = clave.map((k) => VENUE_IMAGE_ERROR_MESSAGES[k].action);
  comprobar(
    'pesada, no-imagen, red y conflicto tienen títulos distintos',
    new Set(titulos).size === clave.length,
    titulos.join(' | '),
  );
  comprobar(
    'pesada, no-imagen, red y conflicto piden acciones distintas',
    new Set(acciones).size === clave.length,
  );
  comprobar(
    'los mensajes de sede no son los de documentos (dicen "foto", no "archivo del participante")',
    Object.values(VENUE_IMAGE_ERROR_MESSAGES).every((m) => !/participante|delegaci/i.test(m.title + m.action)),
  );
  comprobar(
    '"muy pesada" dice el límite',
    /5 MB/.test(VENUE_IMAGE_ERROR_MESSAGES['too-large'].action),
  );
  comprobar(
    '"no es una imagen" nombra los formatos que sí sirven',
    /JPG/.test(VENUE_IMAGE_ERROR_MESSAGES['not-an-image'].action) &&
      /WebP/.test(VENUE_IMAGE_ERROR_MESSAGES['not-an-image'].action),
  );
  comprobar(
    'el conflicto dice que alguien la cambió recién y que se vuelva a intentar',
    /Alguien cambió la foto recién/.test(VENUE_IMAGE_ERROR_MESSAGES.conflict.title) &&
      /Volvé a intentarlo/.test(VENUE_IMAGE_ERROR_MESSAGES.conflict.action),
  );
  comprobar(
    'red y conflicto ofrecen reintentar; pesada y no-imagen no (el mismo archivo va a fallar igual)',
    VENUE_IMAGE_ERROR_MESSAGES.network.retryable &&
      VENUE_IMAGE_ERROR_MESSAGES.conflict.retryable &&
      !VENUE_IMAGE_ERROR_MESSAGES['too-large'].retryable &&
      !VENUE_IMAGE_ERROR_MESSAGES['not-an-image'].retryable,
  );
  comprobar(
    'los mensajes van en voseo (nada de "usted", "intente", "elija")',
    Object.values(VENUE_IMAGE_ERROR_MESSAGES).every(
      (m) => !/\busted\b|\bintente\b|\belija\b|\brevise\b|\bespere\b/i.test(m.title + m.action),
    ),
  );
}

// -------------------------------------------------
// 4. Resolución de imageUrl
// -------------------------------------------------
{
  const URL_API = '/api/v1/venues/0b8e0f5e-0000-4000-8000-000000000001/image?v=a1b2c3d4e5f6';

  comprobar(
    'con base relativa (/api/v1, mismo origen) la URL se usa tal cual',
    resolveVenueImageUrl(URL_API, '/api/v1') === URL_API,
    resolveVenueImageUrl(URL_API, '/api/v1'),
  );
  comprobar(
    'con base absoluta se resuelve contra el ORIGEN de la API (sin duplicar /api/v1)',
    resolveVenueImageUrl(URL_API, 'http://localhost:3000/api/v1') === `http://localhost:3000${URL_API}`,
    resolveVenueImageUrl(URL_API, 'http://localhost:3000/api/v1'),
  );
  comprobar(
    'con base https absoluta y barra final también',
    resolveVenueImageUrl(URL_API, 'https://api.juegosevita.gob.ar/api/v1/') ===
      `https://api.juegosevita.gob.ar${URL_API}`,
  );
  comprobar('base vacía = mismo origen', resolveVenueImageUrl(URL_API, '') === URL_API);

  const peligrosas = [
    ['null', null],
    ['cadena vacía', ''],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:image/png;base64,AAAA'],
    ['protocol-relative (host ajeno)', '//evil.example/x.jpg'],
    ['absoluta de otro host', 'https://evil.example/x.jpg'],
    ['relativa sin barra', 'venues/1/image'],
    ['con comillas (rompería el atributo)', '/api/v1/venues/1/image?v="><script>'],
    ['con espacios', '/api/v1/venues/1/image x'],
  ];
  for (const [nombre, valor] of peligrosas) {
    comprobar(
      `descarta ${nombre}`,
      resolveVenueImageUrl(valor, '/api/v1') === null &&
        resolveVenueImageUrl(valor, 'http://localhost:3000/api/v1') === null,
    );
  }
  comprobar(
    'una base con esquema raro no produce URL',
    resolveVenueImageUrl(URL_API, 'ftp://x/api/v1') === null &&
      resolveVenueImageUrl(URL_API, 'javascript:alert(1)') === null,
  );

  // Error de carga: esa URL falló → placeholder; otra versión → se reintenta.
  comprobar(
    'si ESA foto falló al cargar, se cae al placeholder',
    pickVenueImageSrc(URL_API, '/api/v1', URL_API) === null,
  );
  comprobar(
    'una versión nueva (foto reemplazada) se vuelve a intentar',
    pickVenueImageSrc(URL_API.replace('a1b2c3d4e5f6', 'ffffffffffff'), '/api/v1', URL_API) !== null,
  );
  comprobar('sin fallo, se usa la foto', pickVenueImageSrc(URL_API, '/api/v1', null) === URL_API);

  comprobar(
    'el alt nombra a la sede',
    venueImageAlt('Estadio Cincuentenario') === 'Foto de la sede Estadio Cincuentenario',
  );
}

// -------------------------------------------------
// 5. Documentos no cambió
// -------------------------------------------------
{
  comprobar(
    'documentos NO acepta WebP (validación)',
    !validateDocumentFile(archivo('dni.webp', MB, 'image/webp')).ok,
  );
  comprobar(
    'documentos NO acepta WebP (reglas del uploader)',
    !DOCUMENT_UPLOADER_RULES.validate(archivo('dni.webp', MB, 'image/webp')).ok,
  );
  comprobar('el accept de documentos no lista WebP', !DOCUMENT_ACCEPT_ATTRIBUTE.includes('webp'));
  comprobar('documentos sigue aceptando PDF', validateDocumentFile(archivo('f.pdf', MB, 'application/pdf')).ok);
  comprobar('la foto de sede NO acepta PDF', !validateVenueImageFile(archivo('f.pdf', MB, 'application/pdf')).ok);
}

// -------------------------------------------------
// 6. Reducción antes de subir (decisiones puras)
// -------------------------------------------------
{
  comprobar(
    'umbrales: ~2000 px de lado, ~1,5 MB, destino ~1600 px, calidad 0,85',
    VENUE_IMAGE_OPTIMIZE_MAX_SIDE === 2000 &&
      VENUE_IMAGE_OPTIMIZE_MAX_BYTES === 1.5 * MB &&
      VENUE_IMAGE_TARGET_SIDE === 1600 &&
      VENUE_IMAGE_QUALITY === 0.85,
  );
  comprobar(
    'una foto chica y liviana no se toca',
    !needsVenueImageOptimization({ size: 800 * 1024, width: 1600, height: 900 }),
  );
  comprobar(
    'una foto de 4000 px se reduce aunque pese poco',
    needsVenueImageOptimization({ size: 900 * 1024, width: 4000, height: 3000 }),
  );
  comprobar(
    'una foto de 3 MB se re-codifica aunque mida poco',
    needsVenueImageOptimization({ size: 3 * MB, width: 1200, height: 800 }),
  );
  const horizontal = scaledVenueImageSize(4000, 3000);
  comprobar(
    '4000×3000 → 1600×1200 (mantiene la proporción)',
    horizontal.width === 1600 && horizontal.height === 1200,
    JSON.stringify(horizontal),
  );
  const vertical = scaledVenueImageSize(3024, 4032);
  comprobar(
    'vertical 3024×4032 → lado mayor 1600',
    vertical.height === 1600 && vertical.width === 1200,
    JSON.stringify(vertical),
  );
  const chica = scaledVenueImageSize(800, 600);
  comprobar('nunca agranda', chica.width === 800 && chica.height === 600);
  comprobar(
    'el nombre cambia a la extensión del contenido nuevo',
    renameWithExtension('IMG_2041.PNG', '.webp') === 'IMG_2041.webp' &&
      renameWithExtension('cancha.principal.jpg', '.jpg') === 'cancha.principal.jpg' &&
      renameWithExtension('', '.jpg') === 'foto-sede.jpg',
  );
  const original = { size: 2 * MB };
  comprobar('si la reducción achica, se sube la reducida', pickSmallerFile(original, { size: MB }).size === MB);
  comprobar(
    'si la reducción NO achica, se sube la original',
    pickSmallerFile(original, { size: 3 * MB }) === original,
  );
  comprobar('si la reducción falló, se sube la original', pickSmallerFile(original, null) === original);
}

// -------------------------------------------------
// 7. El fuente: reuso, capas y permisos
// -------------------------------------------------
{
  const seccion = await leer('src/pages/admin/venues/VenuePhotoSection.tsx');
  comprobar('el panel reusa DocumentUploader', seccion.includes('<DocumentUploader'));
  comprobar('el panel le pasa las reglas de sede', seccion.includes('VENUE_IMAGE_UPLOADER_RULES'));
  comprobar('el panel achica con canvas antes de subir', seccion.includes('prepare: optimizeVenueImage'));
  comprobar('"Quitar foto" pide confirmación', seccion.includes('Quitar foto') && seccion.includes('ConfirmDeleteDialog'));
  comprobar('el panel anuncia los cambios (aria-live)', seccion.includes('aria-live="polite"'));
  comprobar(
    'la sección decide por permiso VENUE_MANAGE',
    seccion.includes('usePermisos') && seccion.includes("'VENUE_MANAGE'"),
  );
  comprobar('el panel no habla HTTP directo', !seccion.includes('apiClient') && !seccion.includes('venuesApi'));

  const dialogo = await leer('src/pages/admin/venues/VenueFormDialog.tsx');
  comprobar(
    'en el alta se ofrece la foto después de crear, sin salir del modal',
    dialogo.includes('createdVenue') && dialogo.includes('<VenuePhotoSection'),
  );

  const columnas = await leer('src/pages/admin/venues/venueColumns.tsx');
  comprobar('la tabla del panel muestra la miniatura', columnas.includes('variant="thumb"'));

  const uploaderCopia = await leer('src/components/shared/DocumentUploader.tsx');
  comprobar('el uploader recibe reglas (no hay un segundo uploader)', uploaderCopia.includes('rules?: UploaderRules'));

  const reglas = await leer('src/lib/venues/venueImageRules.ts');
  comprobar('el módulo de reglas no depende de React', !/from 'react'/.test(reglas));
  comprobar('el módulo de reglas no toca el DOM', !/\bdocument\.|createImageBitmap|window\./.test(reglas));

  const optimizar = await leer('src/lib/venues/optimizeVenueImage.ts');
  comprobar(
    'la reducción respeta la orientación EXIF',
    /imageOrientation:\s*'from-image'/.test(optimizar),
  );
  comprobar('la reducción prueba WebP y cae a JPEG', optimizar.includes("'image/webp'") && optimizar.includes("'image/jpeg'"));

  const api = await leer('src/api/venues.api.ts');
  comprobar('la subida manda el campo `file`', /formData\.append\('file', file\)/.test(api));
  comprobar('la subida usa POST /venues/:id/image', api.includes('`/venues/${id}/image`'));
  comprobar('la subida reporta progreso y se puede cancelar', api.includes('onUploadProgress') && /signal:\s*options\.signal/.test(api));

  const hooks = await leer('src/hooks/useVenues.ts');
  comprobar(
    'subir y quitar la foto invalidan las listas de sedes',
    /useUploadVenueImage/.test(hooks) &&
      /useDeleteVenueImage/.test(hooks) &&
      /invalidateQueries\(\{ queryKey: VENUE_KEYS\.lists\(\) \}\)/.test(hooks),
  );

  for (const rel of [
    'src/components/venues/VenuePhoto.tsx',
    'src/pages/admin/venues/VenuePhotoSection.tsx',
    'src/pages/admin/venues/VenueFormDialog.tsx',
    'src/pages/admin/venues/venueColumns.tsx',
    'src/components/shared/DocumentUploader.tsx',
  ]) {
    const fuente = await leer(rel);
    comprobar(`${rel} no interpola clases de Tailwind`, !/className=\{`[^`]*\$\{/.test(fuente));
  }
}

await rm(SALIDA, { force: true });

// -------------------------------------------------
// Resultado
// -------------------------------------------------
if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} problema(s) en la foto de sede:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('');
  process.exit(1);
}

console.log(`Chequeos ejecutados: ${verificaciones.length}`);
console.log('✅ Formatos, límite, mensajes y URL de la foto de sede alineados con el backend.');
