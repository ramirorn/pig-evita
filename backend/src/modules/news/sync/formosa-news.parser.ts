// ===========================================
// S19 — Parseo de una nota del portal oficial (formosa.gob.ar)
// ===========================================
//
// Todo lo de este archivo es puro: entra el HTML crudo de una nota y sale una
// estructura o un motivo de descarte. Ninguna función acá hace red ni toca la
// base, para que el test pueda correr contra el HTML **real** guardado en
// `test/fixtures/` y grite el día que el portal cambie el markup.
//
// Lo que se investigó contra el sitio antes de escribir esto (2026-08-31) y por
// qué el camino obvio no sirve, está en la tarea S19 de `documentacion/tasks.md`.
// Los tres puntos que definen este parseo:
//
//   1. **El número del medio de la URL NO es la categoría.** `33163/671/...` es
//      "Información Pública" y `34709/671/...` es "Juegos Evita Formoseños": el
//      mismo 671. Clasificar por ahí trae cualquier cosa.
//   2. **La sección se lee del href de "Cargada en"**, que contiene el slug
//      `juegos_evita_formosenos`. Es más estable que el texto visible, que
//      viene con acentos y en ISO-8859-1.
//   3. **Los datos salen de los tags Open Graph**, no del DOM del artículo. Es
//      lo único que el portal expone de forma declarada y estable, y además nos
//      deja fuera del cuerpo HTML de la nota, que a propósito no se copia.

/** Slug de sección que identifica a las notas de los Juegos Evita. */
export const SLUG_JUEGOS_EVITA = 'juegos_evita_formosenos';

/** Base pública del portal. */
export const BASE_PORTAL = 'https://www.formosa.gob.ar';

/**
 * URL canónica de una nota.
 *
 * Hallazgo del relevamiento: **sólo el ID importa**. Los otros dos segmentos
 * son cosméticos — `/noticia/34709/0/x` devuelve la misma nota que la URL
 * larga —, así que el descubrimiento puede recorrer IDs sin conocer ni la
 * categoría ni el slug del título.
 */
export function urlDeNota(id: number): string {
  return `${BASE_PORTAL}/noticia/${id}/0/x`;
}

/** Datos de una nota, tal como se guardan. Nunca incluye el cuerpo del artículo. */
export interface NotaDelPortal {
  /** ID en el portal. */
  idPortal: number;
  /** Link al original: es lo que se publica, y la clave de idempotencia. */
  sourceUrl: string;
  titulo: string;
  /** Bajada (`og:description`). Texto plano. */
  bajada: string;
  /** URL absoluta de la imagen, o `null`. Sale por https de archivos.formosa.gob.ar. */
  imagenUrl: string | null;
  /** Slug de la sección ("Cargada en"). */
  seccionSlug: string;
  /** Nombre visible de la sección, ya con los acentos bien. */
  seccionNombre: string;
  /** Quién publicó el original, del "- Fuente:" del pie. */
  fuente: string | null;
  /** Fecha de publicación en el portal. */
  fecha: Date | null;
}

/**
 * Motivos por los que una página no produce una nota.
 *
 * Están separados a propósito y **no** colapsados en un `null`: el sync decide
 * si tiene que gritar según cuál sea. `inexistente` es normal (se recorren IDs
 * que todavía no existen); `sin-open-graph` y `sin-seccion` significan que el
 * portal cambió el markup y hay que enterarse.
 */
export type MotivoDescarte = 'inexistente' | 'sin-open-graph' | 'sin-seccion';

export type ResultadoParseo =
  { ok: true; nota: NotaDelPortal } | { ok: false; motivo: MotivoDescarte };

/**
 * El portal declara `charset=ISO-8859-1` y **lo cumple**: los acentos vienen
 * como bytes latin-1 crudos, incluso adentro de los tags Open Graph. Decodificar
 * como UTF-8 deja el título de la noticia lleno de caracteres de reemplazo
 * ("Ingeniero Ju?rez", "Juegos Evita Formose?os").
 *
 * Se respeta el charset declarado en el propio HTML en vez de asumir latin-1
 * para siempre: si mañana el portal migra a UTF-8, esto sigue andando.
 */
export function decodificarHtml(cuerpo: Buffer): string {
  // El `<meta http-equiv="Content-Type">` está en ASCII puro, así que se puede
  // leer con latin1 sin riesgo antes de saber el charset real.
  const tanteo = cuerpo.toString('latin1');
  const declarado = /charset=["']?\s*([\w-]+)/i
    .exec(tanteo)?.[1]
    ?.toLowerCase();

  if (declarado && /^utf-?8$/.test(declarado)) {
    return cuerpo.toString('utf8');
  }
  return tanteo;
}

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ntilde: 'ñ',
  Ntilde: 'Ñ',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  uuml: 'ü',
  Uuml: 'Ü',
  ordf: 'ª',
  ordm: 'º',
  deg: '°',
  laquo: '«',
  raquo: '»',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

/** Decodifica las entidades HTML que aparecen en los campos que extraemos. */
export function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    )
    .replace(/&([a-zA-Z]+);/g, (entera, nombre: string) =>
      Object.prototype.hasOwnProperty.call(ENTIDADES, nombre)
        ? ENTIDADES[nombre]
        : entera,
    );
}

function limpiar(texto: string): string {
  return decodificarEntidades(texto).replace(/\s+/g, ' ').trim();
}

/** Lee un `<meta property="og:...">`. Tolera el orden de los atributos. */
export function leerOpenGraph(html: string, propiedad: string): string | null {
  const prop = propiedad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patrones = [
    new RegExp(
      `<meta[^>]+property=["']og:${prop}["'][^>]*content=["']([^"']*)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:${prop}["']`,
      'i',
    ),
  ];

  for (const patron of patrones) {
    const encontrado = patron.exec(html);
    if (encontrado) {
      const valor = limpiar(encontrado[1]);
      if (valor) return valor;
    }
  }
  return null;
}

/**
 * ⚠️ Hallazgo del relevamiento, y es el que más importa para no traer basura:
 * **un ID inexistente NO devuelve 404**. `/noticia/99999/0/x` responde **200**
 * con la plantilla sin rellenar — los marcadores del CMS quedan literales en el
 * HTML (`{sysnoti02_fecha}`, `{urlCat}`) y los tags Open Graph son los genéricos
 * del portal. Probado con 99999, 34999 y 34710 el 2026-08-31: los tres devuelven
 * exactamente los mismos 35.396 bytes.
 *
 * Si esto se detectara por status code, el sync guardaría "Portal Oficial del
 * Gobierno de la Provincia de Formosa" como noticia una vez por cada ID que
 * recorre.
 *
 * ⚠️ Y no alcanza con buscar "algún marcador `{...}` sin rellenar": **una nota
 * real también trae marcadores colgados** (`{sysnoti02_titulo_alt}` y
 * `{js_callback}` aparecen en las tres páginas que se relevaron, la 34709
 * incluida). Por eso se miran dos marcadores puntuales, que son los que en una
 * nota de verdad están siempre rellenos: el de la fecha del pie y el del enlace
 * a la categoría. La primera versión de esta función usaba el patrón genérico
 * y descartaba **todas** las notas, incluida la que la tarea pide traer.
 */
const MARCADORES_DE_PLANTILLA_VACIA = ['{urlCat}', '{sysnoti02_fecha}'];

export function esPlantillaSinNota(html: string): boolean {
  return MARCADORES_DE_PLANTILLA_VACIA.some((marca) => html.includes(marca));
}

/** Fecha del pie: `<span class="time">29-08-2026</span>`, en DD-MM-AAAA. */
export function leerFecha(html: string): Date | null {
  const crudo =
    /<span[^>]*class=["']time["'][^>]*>\s*([^<]*?)\s*<\/span>/i.exec(html)?.[1];
  if (!crudo) return null;

  const partes = /^(\d{2})-(\d{2})-(\d{4})$/.exec(crudo.trim());
  if (!partes) return null;

  const [, dia, mes, anio] = partes;
  // El portal publica una fecha sin hora. Se ancla a las 12:00 UTC (09:00 en
  // Formosa, UTC-3) para que ningún corrimiento de zona horaria la mueva de día
  // al formatearla, ni acá ni en el navegador del visitante.
  const fecha = new Date(
    Date.UTC(Number(anio), Number(mes) - 1, Number(dia), 12, 0, 0),
  );
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/**
 * Sección de la nota, leída del href de "Cargada en".
 *
 * El href tiene la forma `/noticias/categoria///juegos_evita_formosenos`. Ese
 * enlace **no funciona** si se lo sigue (responde 302 a una página de error),
 * pero el slug que lleva adentro es dato bueno y es lo único del markup que
 * declara la sección sin ambigüedad.
 */
export function leerSeccion(
  html: string,
): { slug: string; nombre: string } | null {
  const encontrado =
    /Cargada\s+en\s*<a[^>]+href=["'][^"']*\/noticias\/categoria\/*\/([a-z0-9_-]+)["'][^>]*>([^<]*)<\/a>/i.exec(
      html,
    );
  if (!encontrado) return null;

  const slug = encontrado[1].toLowerCase();
  if (!slug) return null;

  return { slug, nombre: limpiar(encontrado[2]) || slug };
}

/** "- Fuente: Secretaría de Deportes y Recreación Comunitaria" del pie. */
export function leerFuente(html: string): string | null {
  const encontrado = /-\s*Fuente:\s*([^<]+)</i.exec(html);
  if (!encontrado) return null;
  const valor = limpiar(encontrado[1]);
  return valor || null;
}

/**
 * Parsea una nota del portal.
 *
 * No devuelve el cuerpo del artículo **a propósito**: de la nota ajena se guarda
 * lo que hace falta para enlazarla (título, bajada, imagen, fecha), y el texto
 * completo se lee en el portal. Ver el comentario del modelo `News`.
 */
export function parsearNota(html: string, idPortal: number): ResultadoParseo {
  if (esPlantillaSinNota(html)) {
    return { ok: false, motivo: 'inexistente' };
  }

  const titulo = leerOpenGraph(html, 'title');
  const bajada = leerOpenGraph(html, 'description');

  // Sin título no hay nota que guardar, y sin bajada la tarjeta queda vacía:
  // si alguno de los dos falta, el markup cambió y el sync tiene que enterarse.
  if (!titulo || !bajada) {
    return { ok: false, motivo: 'sin-open-graph' };
  }

  const seccion = leerSeccion(html);
  if (!seccion) {
    return { ok: false, motivo: 'sin-seccion' };
  }

  const imagen = leerOpenGraph(html, 'image');

  return {
    ok: true,
    nota: {
      idPortal,
      sourceUrl: urlDeNota(idPortal),
      titulo,
      bajada,
      // Sólo https: es lo que exige `safeImageSrc` en el frontend (T17), y el
      // portal ya sirve las imágenes por https desde archivos.formosa.gob.ar.
      imagenUrl: imagen && imagen.startsWith('https://') ? imagen : null,
      seccionSlug: seccion.slug,
      seccionNombre: seccion.nombre,
      fuente: leerFuente(html),
      fecha: leerFecha(html),
    },
  };
}

/** ¿Esta nota es de los Juegos Evita? Se decide por el slug, nunca por la URL. */
export function esDeJuegosEvita(nota: NotaDelPortal): boolean {
  return nota.seccionSlug === SLUG_JUEGOS_EVITA;
}

/** Slug propio de la noticia. Lleva el ID del portal para no colisionar nunca. */
export function slugDeNotaExterna(nota: NotaDelPortal): string {
  const base = nota.titulo
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80)
    .replace(/-$/, '');

  return `${base || 'noticia'}-formosa-${nota.idPortal}`;
}
