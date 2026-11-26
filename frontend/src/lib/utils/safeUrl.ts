// ===========================================
// URLs armadas con datos del backend
// ===========================================
// ===========================================
// URLs armadas con datos del backend (T17 / hallazgo F15)
// ===========================================

/**
 * Schemas que nunca deben terminar en un `href` o un `src`.
 *
 * `javascript:` ejecuta código en el origen de la página; `vbscript:` hace lo
 * mismo en motores viejos; `data:` permite servir un documento entero (por
 * ejemplo `data:text/html,<script>…</script>`) desde nuestro propio origen.
 */
const DANGEROUS_SCHEMES = 'javascript|data|vbscript';

/**
 * Detecta un schema peligroso **como schema**, no como substring.
 *
 * Ésta es la parte delicada del helper. Buscar `'data'` con `includes()`
 * rompería una dirección legítima como "Barrio Los Datos 123", así que la regex
 * exige las dos condiciones que definen un schema en la RFC 3986:
 *
 * 1. Va seguido de `:` — "Los Datos 123" no tiene dos puntos, así que ni se
 *    evalúa.
 * 2. El carácter previo **no** puede ser parte de un schema (`[a-z0-9+.-]`).
 *    Un schema arranca en el borde del string o después de un separador, nunca
 *    pegado a otra palabra: sin esta condición "Avenida Nodata: 500" daría
 *    falso positivo.
 *
 * Entre el token y los dos puntos se permiten espacios en blanco porque los
 * navegadores los ignoran al resolver el schema.
 */
const DANGEROUS_SCHEME_RE = new RegExp(
  `(?:^|[^a-z0-9+.\\-])(?:${DANGEROUS_SCHEMES})[\\s]*:`,
  'i',
);

/**
 * Caracteres que el navegador descarta al parsear una URL y que un atacante usa
 * para partir el schema en dos (`java&#10;script:`).
 *
 * Alcanza con `\s` (cubre tab, LF, CR, espacios Unicode y el BOM), que es
 * exactamente lo que el estándar de URL manda ignorar, más los invisibles
 * zero-width, que `\s` no incluye. No hace falta el rango completo de
 * caracteres de control: un `java<0x01>script:` no lo resuelve ningún
 * navegador, así que no es un vector de ataque sino un string roto.
 */
const URL_NOISE_RE = /[\s\u200B-\u200D\uFEFF]/g;

/**
 * ¿El texto contiene un schema peligroso?
 *
 * Se evalúa dos veces: sobre el texto tal cual y sobre el texto sin ruido. La
 * segunda pasada existe porque `java\nscript:alert(1)` es un `javascript:`
 * válido para el navegador y la regex sola no lo vería. La primera pasada sigue
 * siendo necesaria porque limpiar el ruido pega palabras que estaban separadas
 * ("Los Datos: 5" → "LosDatos:5") y ahí el borde de schema se pierde.
 */
function hasDangerousScheme(value: string): boolean {
  return (
    DANGEROUS_SCHEME_RE.test(value) ||
    DANGEROUS_SCHEME_RE.test(value.replace(URL_NOISE_RE, ''))
  );
}

/**
 * Arma una URL externa a partir de una base fija y parámetros dinámicos.
 *
 * Devuelve `null` cuando el resultado no es seguro; quien llama **no debe
 * renderizar el link** en ese caso (y conviene mostrar el dato como texto plano
 * para que la información no desaparezca de la pantalla).
 *
 * La validación es sobre el **resultado final parseado**, no sobre substrings:
 * se construye con `URL` + `URLSearchParams` y se exige `protocol === 'https:'`.
 * Chequear `startsWith('https://')` sería más frágil, porque no normaliza el
 * schema (`HTTPS://`), no entiende qué parte del string es realmente el schema
 * y no detecta credenciales embebidas.
 *
 * El escaneo de schemas en los parámetros es defensa en profundidad: hoy
 * `URLSearchParams` ya los codifica dentro del query string, así que un
 * `javascript:` ahí no puede escaparse al `href`. Se rechaza igual para que el
 * helper siga siendo seguro si mañana alguien lo llama con una base dinámica o
 * mete el valor en el `pathname`.
 *
 * @param base   URL base **hardcodeada** (debe ser `https://`).
 * @param params Pares clave/valor que se agregan al query string.
 */
export function safeExternalUrl(
  base: string,
  params: Record<string, string>,
): string | null {
  if (hasDangerousScheme(base)) return null;

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null; // base relativa o malformada: no es una URL externa válida
  }

  if (url.protocol !== 'https:') return null;

  const entries = Object.entries(params);
  let hasContent = false;

  for (const [key, rawValue] of entries) {
    // El dato viene del backend: si no es string, se descarta la URL entera en
    // vez de dejar que `URLSearchParams` lo convierta a "[object Object]".
    if (typeof rawValue !== 'string') return null;
    if (hasDangerousScheme(key) || hasDangerousScheme(rawValue)) return null;

    const value = rawValue.trim();
    if (value) hasContent = true;
    url.searchParams.set(key, value);
  }

  // Todos los parámetros vacíos abriría Google Maps sin nada que buscar: es un
  // link roto, no un link peligroso, pero tampoco tiene sentido mostrarlo.
  if (entries.length > 0 && !hasContent) return null;

  // Revalidación del resultado ya serializado: si algún parámetro llegara a
  // alterar el schema (hoy imposible, mañana quién sabe), acá se cae.
  try {
    const result = url.toString();
    if (new URL(result).protocol !== 'https:') return null;
    return result;
  } catch {
    return null;
  }
}

/**
 * Valida una URL de imagen que llega del backend como texto libre.
 *
 * La `imageUrl` EXTERNA de una noticia (pegada en el formulario o traída del
 * portal) es **la URL entera**, no un parámetro dentro de una base fija; el
 * backend hoy exige `https://`, pero el dato viejo o el del sync no pasaron
 * por ese DTO. Ése es el caso realmente riesgoso del hallazgo F15:
 * acá no hay `encodeURIComponent()` que valga, porque no estamos escapando un
 * dato *dentro* de una URL sino usando el dato *como* la URL.
 *
 * Qué se acepta:
 * - URLs absolutas `https://` (el caso que documenta el placeholder del form).
 * - Rutas relativas al propio origen (`/api/v1/news/<id>/image?v=…`), que
 *   es la imagen subida servida por la API (ver `resolveApiImageUrl`).
 *
 * Qué se rechaza:
 * - `javascript:` / `vbscript:` — inertes en `<img src>` en navegadores
 *   actuales, pero el helper no depende de esa garantía del navegador.
 * - `data:` — un SVG embebido no ejecuta script cuando se carga vía `<img>`,
 *   pero permite inyectar contenido arbitrario sin pasar por la red.
 * - `http://` — mixed content: el navegador lo bloquea igual en un sitio HTTPS,
 *   así que renderizar el `<img>` sólo produce un hueco roto.
 * - `//host/img.jpg` (protocol-relative), que parece relativo pero apunta
 *   afuera y hereda el schema de la página.
 *
 * @returns La URL a usar en `src`, o `null` para mostrar el placeholder.
 */
export function safeImageSrc(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (hasDangerousScheme(trimmed)) return null;

  // Protocol-relative: parsearía como "https://…" y pasaría el chequeo de
  // protocolo, pero el host lo elige el backend. Se corta antes.
  if (trimmed.startsWith('//')) return null;

  let url: URL | null = null;
  try {
    url = new URL(trimmed);
  } catch {
    url = null; // no es absoluta: se evalúa como ruta relativa más abajo
  }

  if (url) return url.protocol === 'https:' ? trimmed : null;

  // Ruta relativa: se resuelve contra nuestro propio origen, así que no puede
  // salir del sitio. Igual se exige que arranque como ruta y no como algo raro.
  return /^[A-Za-z0-9._~%/-]/.test(trimmed) ? trimmed : null;
}
