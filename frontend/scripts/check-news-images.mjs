// ===========================================
// Imagen de noticia: subida, URL externa y resolución de imageUrl
//
// Lo que este chequeo fija:
//
//   1. **El filtro del cliente coincide con el backend.** La imagen de noticia
//      usa el MISMO interceptor (5 MB, 422) y el MISMO pipe de firma (JPG, PNG,
//      WebP; 400) que la foto de sede, y los mismos permisos que editar una
//      noticia (NEWS_MANAGE). Se leen los archivos REALES del backend.
//   2. **Cada error, su mensaje.** Muy pesada, no es una imagen, red y
//      conflicto piden hacer cosas distintas; el 403 explica el caso de las
//      notas del portal. En voseo.
//   3. **`imageUrl` se resuelve bien en sus dos formas**: la ruta de la API
//      (subida) contra el ORIGEN de la API, y la URL externa sólo si es
//      `https:`. Nada más llega a un `src`, tampoco una clave de MinIO.
//   4. **El formulario manda lo justo**: "Subir archivo" no toca `imageKey`;
//      "Pegar URL" vacío no borra una imagen subida.
//   5. **Las vistas usan `imageUrl`**, nunca `imageKey`, y el panel reusa el
//      `DocumentUploader` con las reglas de imagen.
//
// Se bundlea el **fuente real** con esbuild —igual que los otros check-*.mjs—.
//
// Corre con: npm run check:news-images
// ===========================================
import { execSync } from 'node:child_process';
import { readFile, readdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const BACKEND = path.resolve(RAIZ, '..', 'backend');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-news-images.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

execSync(
  [
    'npx esbuild',
    `"${path.join(RAIZ, 'scripts', 'news-images.entry.ts')}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --jsx=automatic --log-level=error',
    `"--alias:@=${SRC}"`,
    '--packages=external',
    // Base relativa, la de producción (mismo origen, Docker en 8080).
    '"--define:import.meta.env={\\"DEV\\":false,\\"VITE_API_BASE_URL\\":\\"/api/v1\\"}"',
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const {
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_FORMATS,
  IMAGE_ACCEPT_ATTRIBUTE,
  IMAGE_FORMATS_HINT,
  validateImageFile,
  NEWS_IMAGE_ERROR_MESSAGES,
  NEWS_IMAGE_UPLOADER_RULES,
  resolveNewsImageUrl,
  newsImageSrc,
  isValidExternalImageUrl,
  imageKeyForPayload,
  newsImageAlt,
  VENUE_IMAGE_ERROR_MESSAGES,
  VENUE_IMAGE_UPLOADER_RULES,
  MAX_VENUE_IMAGE_BYTES,
  ALLOWED_VENUE_IMAGE_FORMATS,
  SafeNewsImage,
} = await import(pathToFileURL(SALIDA).href);

const MB = 1024 * 1024;
const archivo = (name, size, type) => ({ name, size, type });
const leer = (relativo) => readFile(path.join(RAIZ, relativo), 'utf8');
const leerBackend = (relativo) => readFile(path.join(BACKEND, relativo), 'utf8');
const sinComentarios = (fuente) =>
  fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('//'))
    .join('\n');

// -------------------------------------------------
// 1. Paridad con el backend
// -------------------------------------------------
{
  const util = await leerBackend('src/modules/images/image.util.ts');
  const interceptor = await leerBackend('src/modules/images/image-upload.interceptor.ts');
  const pipe = await leerBackend('src/modules/images/image-signature.pipe.ts');
  const controller = await leerBackend('src/modules/news/news-images.controller.ts');
  const newsController = await leerBackend('src/modules/news/news.controller.ts');
  const newsUtil = await leerBackend('src/modules/news/news-image.util.ts');
  const dto = await leerBackend('src/modules/news/dto/news.dto.ts');
  const servicio = await leerBackend('src/modules/news/news-images.service.ts');

  comprobar(
    'el límite del cliente es el del backend (IMAGE_MAX_BYTES = 5 MB)',
    MAX_IMAGE_BYTES === 5 * MB && /IMAGE_MAX_BYTES\s*=\s*5\s*\*\s*1024\s*\*\s*1024/.test(util),
  );
  comprobar('multer corta con ese límite y responde 422', /fileSize:\s*IMAGE_MAX_BYTES\s*\+\s*1/.test(interceptor) && interceptor.includes('UnprocessableEntityException'));
  comprobar(
    'la noticia sube con el interceptor y el pipe de imágenes compartidos',
    controller.includes('@UseInterceptors(ImageUploadInterceptor)') &&
      controller.includes('@UploadedFile(ImageSignaturePipe)'),
  );

  // Formatos: los del pipe = los del cliente.
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
    (backend[tipoAMime[tipo]] ??= []).push(extension);
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
  );
  comprobar(
    'los formatos del cliente son exactamente los del ImageSignaturePipe',
    normalizar(ALLOWED_IMAGE_FORMATS) === normalizar(backend),
    `cliente=${normalizar(ALLOWED_IMAGE_FORMATS)} backend=${normalizar(backend)}`,
  );
  comprobar('el accept lista JPG, PNG y WebP', IMAGE_ACCEPT_ATTRIBUTE === 'image/jpeg,image/png,image/webp');
  comprobar('la ayuda dice formatos y límite', /JPG/.test(IMAGE_FORMATS_HINT) && /WebP/.test(IMAGE_FORMATS_HINT) && /5 MB/.test(IMAGE_FORMATS_HINT));
  comprobar(
    'noticia y sede comparten límite y formatos (una sola fuente)',
    MAX_VENUE_IMAGE_BYTES === MAX_IMAGE_BYTES && ALLOWED_VENUE_IMAGE_FORMATS === ALLOWED_IMAGE_FORMATS,
  );

  // Permisos: subir/quitar = editar la noticia.
  const rolesDe = (fuente, decorador) => {
    const i = fuente.indexOf(decorador);
    if (i < 0) return null;
    return fuente.slice(i).match(/@Roles\(([^)]*)\)/)?.[1]?.trim() ?? null;
  };
  comprobar(
    'POST /news/:id/image exige lo mismo que PATCH /news/:id (NEWS_MANAGE)',
    rolesDe(controller, "@Post(':id/image')") === '...ACCIONES.NEWS_MANAGE' &&
      rolesDe(newsController, "@Patch(':id')") === '...ACCIONES.NEWS_MANAGE',
  );
  comprobar(
    'DELETE /news/:id/image exige NEWS_MANAGE',
    rolesDe(controller, "@Delete(':id/image')") === '...ACCIONES.NEWS_MANAGE',
  );
  comprobar(
    'GET /news/:id/image es público con OptionalJwtAuthGuard (borradores sólo con sesión)',
    /@Get\(':id\/image'\)\s*@Public\(\)[\s\S]*?OptionalJwtAuthGuard/.test(controller) &&
      controller.includes('puedeVerBorradores(user)'),
  );
  comprobar(
    'una nota del portal no admite subir ni quitar imagen',
    (servicio.match(/rechazarSiEsExterna\(/g) ?? []).length >= 2,
  );
  comprobar(
    'las imágenes subidas van a MinIO bajo news/<id>/ con nombre fijo',
    /NEWS_IMAGE_FOLDER\s*=\s*'news'/.test(newsUtil) && servicio.includes('`foto${EXTENSION_CANONICA_IMAGEN[tipo]}`'),
  );
  comprobar(
    'el DTO sólo acepta URLs https como imagen externa (no una clave de MinIO)',
    /protocols:\s*\['https'\]/.test(dto) && /require_protocol:\s*true/.test(dto),
  );
  comprobar('la respuesta no expone imageKey', /Omit<T,\s*'imageKey'>/.test(newsUtil));
}

// -------------------------------------------------
// 2. Validación y mensajes
// -------------------------------------------------
{
  for (const [nombre, file, ok] of [
    ['JPG', archivo('portada.jpg', MB, 'image/jpeg'), true],
    ['PNG', archivo('portada.png', MB, 'image/png'), true],
    ['WebP', archivo('portada.webp', MB, 'image/webp'), true],
    ['5 MB justos', archivo('p.jpg', 5 * MB, 'image/jpeg'), true],
    ['5 MB + 1', archivo('p.jpg', 5 * MB + 1, 'image/jpeg'), false],
    ['PDF', archivo('p.pdf', MB, 'application/pdf'), false],
    ['GIF', archivo('p.gif', MB, 'image/gif'), false],
  ]) {
    comprobar(`${ok ? 'acepta' : 'rechaza'} ${nombre}`, validateImageFile(file).ok === ok);
  }

  const pesada = NEWS_IMAGE_UPLOADER_RULES.validate(archivo('p.jpg', 6 * MB, 'image/jpeg'));
  comprobar(
    'las reglas de noticia usan los mensajes de noticia',
    !pesada.ok && pesada.error === NEWS_IMAGE_ERROR_MESSAGES['too-large'],
  );
  comprobar(
    'describeError: 422 pesada, 400 no-imagen, sin respuesta red, 409 conflicto, 403 prohibido',
    NEWS_IMAGE_UPLOADER_RULES.describeError({ response: { status: 422 } }) === NEWS_IMAGE_ERROR_MESSAGES['too-large'] &&
      NEWS_IMAGE_UPLOADER_RULES.describeError({ response: { status: 400 } }) === NEWS_IMAGE_ERROR_MESSAGES['not-an-image'] &&
      NEWS_IMAGE_UPLOADER_RULES.describeError({ code: 'ERR_NETWORK' }) === NEWS_IMAGE_ERROR_MESSAGES.network &&
      NEWS_IMAGE_UPLOADER_RULES.describeError({ response: { status: 409 } }) === NEWS_IMAGE_ERROR_MESSAGES.conflict &&
      NEWS_IMAGE_UPLOADER_RULES.describeError({ response: { status: 403 } }) === NEWS_IMAGE_ERROR_MESSAGES.forbidden,
  );

  const clave = ['too-large', 'not-an-image', 'network', 'conflict'];
  comprobar(
    'pesada, no-imagen, red y conflicto tienen títulos y acciones distintos',
    new Set(clave.map((k) => NEWS_IMAGE_ERROR_MESSAGES[k].title)).size === 4 &&
      new Set(clave.map((k) => NEWS_IMAGE_ERROR_MESSAGES[k].action)).size === 4,
  );
  comprobar('"muy pesada" dice el límite', /5 MB/.test(NEWS_IMAGE_ERROR_MESSAGES['too-large'].action));
  comprobar(
    'el 403 explica el caso de las notas del portal',
    /portal/.test(NEWS_IMAGE_ERROR_MESSAGES.forbidden.action),
  );
  comprobar(
    'los mensajes hablan de la noticia/imagen, no de la sede',
    Object.values(NEWS_IMAGE_ERROR_MESSAGES).every((m) => !/sede/i.test(m.title + m.action)),
  );
  comprobar(
    'los mensajes van en voseo',
    Object.values(NEWS_IMAGE_ERROR_MESSAGES).every(
      (m) => !/\busted\b|\bintente\b|\belija\b|\brevise\b|\bespere\b/i.test(m.title + m.action),
    ),
  );
  comprobar(
    'red y conflicto ofrecen reintentar; pesada y no-imagen no',
    NEWS_IMAGE_ERROR_MESSAGES.network.retryable &&
      NEWS_IMAGE_ERROR_MESSAGES.conflict.retryable &&
      !NEWS_IMAGE_ERROR_MESSAGES['too-large'].retryable &&
      !NEWS_IMAGE_ERROR_MESSAGES['not-an-image'].retryable,
  );
  comprobar(
    'la sede sigue con SUS mensajes (no se pisaron con los de noticia)',
    VENUE_IMAGE_UPLOADER_RULES.describeError({ response: { status: 409 } }) === VENUE_IMAGE_ERROR_MESSAGES.conflict &&
      VENUE_IMAGE_ERROR_MESSAGES.conflict !== NEWS_IMAGE_ERROR_MESSAGES.conflict,
  );
  comprobar('el alt nombra la noticia', newsImageAlt('Arrancan los Evita') === 'Imagen de la noticia Arrancan los Evita');
}

// -------------------------------------------------
// 3. Resolución de imageUrl
// -------------------------------------------------
{
  const SUBIDA = '/api/v1/news/0b8e0f5e-0000-4000-8000-000000000001/image?v=a1b2c3d4e5f6';
  const PORTAL = 'https://archivos.formosa.gob.ar/media/uploads/imagenes_noticias/foto.jpg';

  comprobar('subida + base relativa → la ruta tal cual', resolveNewsImageUrl(SUBIDA, '/api/v1') === SUBIDA);
  comprobar(
    'subida + base absoluta → origen de la API + ruta (sin duplicar /api/v1)',
    resolveNewsImageUrl(SUBIDA, 'http://localhost:3000/api/v1') === `http://localhost:3000${SUBIDA}`,
  );
  comprobar('externa https → tal cual', resolveNewsImageUrl(PORTAL, '/api/v1') === PORTAL);
  comprobar(
    'externa https no depende de la base de la API',
    resolveNewsImageUrl(PORTAL, 'http://localhost:3000/api/v1') === PORTAL,
  );
  comprobar('newsImageSrc usa la base configurada', newsImageSrc(SUBIDA) === SUBIDA && newsImageSrc(PORTAL) === PORTAL);

  for (const [nombre, valor] of [
    ['null', null],
    ['undefined', undefined],
    ['cadena vacía', ''],
    ['una clave de MinIO cruda', 'news/0b8e/123-foto.jpg'],
    ['http (mixed content)', 'http://example.org/a.jpg'],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:image/png;base64,AAAA'],
    ['protocol-relative', '//evil.example/x.jpg'],
    ['ruta con comillas', '/api/v1/news/1/image?v="><script>'],
  ]) {
    comprobar(`descarta ${nombre}`, resolveNewsImageUrl(valor, '/api/v1') === null);
  }

  // URL pegada en el formulario: misma regla que el backend.
  for (const [valor, ok] of [
    ['https://sitio.gob.ar/foto.jpg', true],
    ['  https://sitio.gob.ar/foto.jpg  ', true],
    ['http://sitio.gob.ar/foto.jpg', false],
    ['sitio.gob.ar/foto.jpg', false],
    ['https://localhost/foto.jpg', false],
    ['javascript:alert(1)', false],
    ['', false],
  ]) {
    comprobar(`URL pegada "${valor}" ${ok ? 'sirve' : 'no sirve'}`, isValidExternalImageUrl(valor) === ok);
  }
}

// -------------------------------------------------
// 4. Qué manda el formulario
// -------------------------------------------------
{
  const URL_VIEJA = 'https://sitio.gob.ar/vieja.jpg';
  const casos = [
    ['"Subir archivo" no toca la imagen', { mode: 'upload', value: 'https://x.gob.ar/a.jpg', currentSource: 'url', currentUrl: URL_VIEJA }, undefined],
    ['"Pegar URL" con una URL nueva la manda', { mode: 'url', value: ' https://x.gob.ar/a.jpg ', currentSource: 'upload', currentUrl: '/api/v1/news/1/image?v=1' }, 'https://x.gob.ar/a.jpg'],
    ['"Pegar URL" con la misma URL no la reenvía', { mode: 'url', value: URL_VIEJA, currentSource: 'url', currentUrl: URL_VIEJA }, undefined],
    ['"Pegar URL" vacío sobre una URL la quita (null)', { mode: 'url', value: '', currentSource: 'url', currentUrl: URL_VIEJA }, null],
    ['"Pegar URL" vacío NO borra una imagen subida', { mode: 'url', value: '', currentSource: 'upload', currentUrl: '/api/v1/news/1/image?v=1' }, undefined],
    ['"Pegar URL" vacío sin imagen no manda nada', { mode: 'url', value: '', currentSource: null, currentUrl: null }, undefined],
  ];
  for (const [nombre, entrada, esperado] of casos) {
    const r = imageKeyForPayload(entrada);
    comprobar(nombre, r === esperado, JSON.stringify(r));
  }
}

// -------------------------------------------------
// 5. SafeNewsImage pinta sólo lo que valida
// -------------------------------------------------
{
  const pintar = (imageUrl) => renderToStaticMarkup(h(SafeNewsImage, { imageUrl, alt: 'Nota' }));
  const src = (html) => html.match(/<img[^>]*\ssrc="([^"]*)"/)?.[1] ?? null;

  const SUBIDA = '/api/v1/news/1/image?v=abcdefabcdef';
  comprobar('[SafeNewsImage] imagen subida → <img> con la ruta de la API', src(pintar(SUBIDA)) === SUBIDA);
  comprobar(
    '[SafeNewsImage] URL externa https → <img> con esa URL',
    src(pintar('https://archivos.formosa.gob.ar/a.jpg')) === 'https://archivos.formosa.gob.ar/a.jpg',
  );
  for (const [nombre, valor] of [
    ['sin imagen', null],
    ['http', 'http://example.org/a.jpg'],
    ['clave de MinIO cruda', 'news/1/abc-foto.jpg'],
    ['javascript:', 'javascript:alert(1)'],
  ]) {
    comprobar(`[SafeNewsImage] ${nombre} → placeholder, sin <img>`, !pintar(valor).includes('<img'));
  }
}

// -------------------------------------------------
// 6. El fuente: vistas, capas, reuso y accesibilidad
// -------------------------------------------------
{
  // Ninguna vista lee `imageKey` de una noticia (la API ya no lo manda). Lo
  // único que queda es el campo del BODY (`payload.imageKey`): la URL externa.
  const vistas = [];
  const recorrer = async (dir) => {
    for (const entrada of await readdir(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) await recorrer(ruta);
      else if (/\.tsx?$/.test(entrada.name)) vistas.push(ruta);
    }
  };
  await recorrer(path.join(SRC, 'pages'));
  await recorrer(path.join(SRC, 'components'));
  const conImageKey = [];
  for (const ruta of vistas) {
    const lecturas = [...sinComentarios(await readFile(ruta, 'utf8')).matchAll(/(\w+)\??\.imageKey\b/g)];
    if (lecturas.some((m) => m[1] !== 'payload')) {
      conImageKey.push(path.relative(SRC, ruta));
    }
  }
  comprobar('ninguna vista ni componente lee imageKey', conImageKey.length === 0, conImageKey.join(', '));

  for (const rel of [
    'src/pages/public/news/NewsCard.tsx',
    'src/pages/public/news/FeaturedNewsCard.tsx',
    'src/pages/public/news/NewsMosaicCard.tsx',
    'src/pages/public/news/NewsSidebarList.tsx',
    'src/pages/public/news/NewsTickerCard.tsx',
  ]) {
    comprobar(`${rel} pasa imageUrl a SafeNewsImage`, /<SafeNewsImage[^>]*imageUrl=\{\w+\.imageUrl\}/s.test(await leer(rel)));
  }
  for (const rel of ['src/pages/public/home/LatestNewsSection.tsx', 'src/pages/public/NewsDetailPage.tsx']) {
    comprobar(`${rel} resuelve con newsImageSrc(…imageUrl)`, /newsImageSrc\(\w+\.imageUrl\)/.test(await leer(rel)));
  }
  comprobar(
    'SafeNewsImage resuelve con newsImageSrc',
    (await leer('src/pages/public/news/SafeNewsImage.tsx')).includes('newsImageSrc(imageUrl)'),
  );

  const seccion = await leer('src/pages/admin/news/NewsImageSection.tsx');
  comprobar('el panel reusa DocumentUploader', seccion.includes('<DocumentUploader'));
  comprobar('el panel usa las reglas de noticia', seccion.includes('NEWS_IMAGE_UPLOADER_RULES'));
  comprobar('el panel achica con canvas antes de subir', /prepare:\s*\(file\)\s*=>\s*optimizeImage\(/.test(seccion));
  comprobar('"Quitar imagen" pide confirmación', seccion.includes('Quitar imagen') && seccion.includes('ConfirmDeleteDialog'));
  comprobar('el panel anuncia los cambios (aria-live)', seccion.includes('aria-live="polite"'));
  comprobar('la sección decide por permiso NEWS_MANAGE', seccion.includes("puede('NEWS_MANAGE')"));
  comprobar(
    'el borrador se previsualiza con sesión (no con un <img> que no manda el token)',
    seccion.includes('useNewsImagePreviewSrc'),
  );

  const formulario = await leer('src/pages/admin/components/NewsForm.tsx');
  comprobar(
    'el formulario ofrece "Subir archivo" y "Pegar URL"',
    formulario.includes('Subir archivo') && formulario.includes('Pegar URL') && formulario.includes('<Tabs'),
  );
  comprobar('el formulario arma el body con imageKeyForPayload', formulario.includes('imageKeyForPayload('));
  const dialogo = await leer('src/pages/admin/news/NewsFormDialog.tsx');
  comprobar(
    'en el alta con "Subir archivo" se ofrece la subida al crear, sin salir del modal',
    dialogo.includes('createdNews') && dialogo.includes('<NewsImageSection'),
  );

  for (const rel of ['src/pages/admin/news/NewsImageSection.tsx', 'src/pages/admin/news/NewsFormDialog.tsx', 'src/pages/admin/components/NewsForm.tsx']) {
    const fuente = await leer(rel);
    comprobar(`${rel} no habla HTTP directo`, !fuente.includes('apiClient') && !fuente.includes('newsApi.'));
    comprobar(`${rel} no interpola clases de Tailwind`, !/className=\{`[^`]*\$\{/.test(fuente));
  }

  const api = await leer('src/api/news.api.ts');
  comprobar('la subida manda el campo `file` a POST /news/:id/image', /formData\.append\('file', file\)/.test(api) && api.includes('`/news/${id}/image`'));
  comprobar('la subida reporta progreso y se puede cancelar', api.includes('onUploadProgress') && /signal:\s*options\.signal/.test(api));

  const hooks = await leer('src/hooks/useNews.ts');
  comprobar(
    'subir y quitar la imagen actualizan el detalle e invalidan listas y slugs',
    /useUploadNewsImage/.test(hooks) &&
      /useDeleteNewsImage/.test(hooks) &&
      hooks.includes('setQueryData(NEWS_KEYS.detail(news.id), news)') &&
      hooks.includes('invalidateQueries({ queryKey: NEWS_KEYS.lists() })') &&
      hooks.includes('invalidateQueries({ queryKey: NEWS_KEYS.slugs() })'),
  );
  comprobar('el blob del borrador se suelta (revokeObjectURL)', hooks.includes('URL.revokeObjectURL'));

  for (const rel of ['src/lib/images/imageRules.ts', 'src/lib/news/newsImageRules.ts']) {
    const fuente = await leer(rel);
    comprobar(`${rel} no depende de React`, !/from 'react'/.test(fuente));
    comprobar(`${rel} no toca el DOM`, !/\bdocument\.|createImageBitmap|window\./.test(fuente));
  }
}

await rm(SALIDA, { force: true });

// -------------------------------------------------
// Resultado
// -------------------------------------------------
if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} problema(s) en la imagen de noticia:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('');
  process.exit(1);
}

console.log(`Chequeos ejecutados: ${verificaciones.length}`);
console.log('✅ Subida, URL externa y resolución de la imagen de noticia alineadas con el backend.');
