// ===========================================
// Utility Functions
// ===========================================
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with clsx */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format ISO date string to localized date */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format ISO date string to localized datetime */
/**
 * Antigüedad en lenguaje corriente: "hace 5 min", "hace 3 h", "hace 2 d".
 *
 * Es lo que usan los lectores de noticias, y comunica algo que la fecha
 * absoluta no: si la nota es de hoy o de hace un mes. Pasada la semana vuelve a
 * la fecha, porque "hace 43 d" no le dice nada a nadie.
 *
 * Devuelve cadena vacía ante una fecha ausente o inválida en vez de "Invalid
 * Date" o "hace NaN d": si no se sabe cuándo fue, no se dice nada.
 */
export function tiempoRelativo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';

  const fecha = new Date(dateStr);
  if (Number.isNaN(fecha.getTime())) return '';

  const segundos = Math.floor((Date.now() - fecha.getTime()) / 1000);

  // Una fecha futura —un desfase de reloj, una nota programada— no se muestra
  // como "hace -3 h".
  if (segundos < 60) return 'recién';

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias <= 7) return dias === 1 ? 'ayer' : `hace ${dias} d`;

  return formatDate(dateStr);
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format relative time (e.g., "hace 5 minutos") */
export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return formatDate(dateStr);
}

/** Calculate age from birth date */
export function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** Truncate text to a max length */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/** Generate initials from first and last name */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Format file size in human-readable form */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ===========================================
// Errores del backend → mensaje seguro para el usuario (T16 / hallazgo F13)
// ===========================================

/** Largo máximo del texto que termina en el toast. */
const MAX_ERROR_LENGTH = 200;

/** Separador entre varios errores de validación. */
const ERROR_SEPARATOR = ' · ';

/**
 * Status HTTP cuyos `message` se consideran escritos para el usuario final.
 *
 * El backend usa class-validator, y esos mensajes están redactados en español
 * pensando en quien completa el formulario ("El DNI debe tener 7 u 8 dígitos").
 * Esconderlos detrás de un fallback genérico empeoraría la UX en vez de
 * mejorarla, así que se dejan pasar:
 *
 * - `400` validación de DTO.
 * - `403` regla de negocio o permisos ("No podés aprobar tus propias
 *   inscripciones"): dice *qué* no se puede hacer, sin filtrar estructura.
 * - `404` "La competencia no existe": informativo y sin detalle interno.
 * - `409` conflicto de estado ("El participante ya está inscripto").
 * - `422` entidad no procesable.
 *
 * Se dejan **fuera** a propósito:
 * - `401`: lo maneja el interceptor de `client.ts` (renueva el token o saca al
 *   usuario). Mostrar acá "Unauthorized" encima de eso sólo confunde.
 * - `429`: el mensaje suele venir del rate limiter, no del dominio.
 * - `5xx`: es justamente el caso donde se filtran errores de Prisma/SQL.
 *
 * Los que quedan afuera no se silencian: se reemplazan por el `fallback` que
 * escribió quien llama, que es específico de la acción intentada.
 */
const SAFE_ERROR_STATUSES: ReadonlySet<number> = new Set([400, 403, 404, 409, 422]);

/**
 * Patrones que delatan que el mensaje no fue escrito para un humano.
 *
 * El criterio es **asimétrico a propósito**: perder un mensaje útil cuesta un
 * toast genérico; filtrar el nombre de una tabla, una ruta del servidor o un
 * stack trace le regala a un atacante el mapa interno del sistema. Ante la
 * duda, fallback.
 */
const LEAK_PATTERNS: readonly RegExp[] = [
  // --- ORM / base de datos ---
  /prisma/i,
  /\bP\d{4}\b/, // códigos de error de Prisma (P2002, P2025, …)
  /sql/i, // cubre SQL, PostgreSQL, SQLSTATE, MySQL
  /\b(?:select|insert into|update .* set|delete from|drop|alter table)\b/i,
  /\b(?:constraint|violates|duplicate key|foreign key|unique key)\b/i,
  /\b(?:column|table|relation)\b/i, // nombres de esquema (en español serían "columna"/"tabla")
  // --- Excepciones y stack traces ---
  /Error:/,
  /\b\w*(?:Exception|TypeError|ReferenceError|SyntaxError)\b/,
  /\bat\s+(?:Object\.|Function\.|async\s|new\s|\/|[A-Z])/, // frames de stack
  /\n\s*at\s/,
  /Cannot read propert/i,
  // --- Infraestructura ---
  /\bE(?:CONNREFUSED|CONNRESET|NOTFOUND|TIMEDOUT|ADDRINUSE|HOSTUNREACH)\b/,
  /\blocalhost\b|\b\d{1,3}(?:\.\d{1,3}){3}\b/, // hosts y IPs internas
  // --- Rutas de archivos del servidor ---
  /[A-Za-z]:\\/, // rutas Windows del servidor (C:\Users\...)
  /\/(?:src|dist|node_modules|home|usr|var)\//,
  /\.(?:ts|js|tsx|jsx):\d+/, // archivo.ts:42
];

/** ¿El texto contiene algo que no debería ver un usuario final? */
function looksLikeLeak(text: string): boolean {
  return LEAK_PATTERNS.some((pattern) => pattern.test(text));
}

/** Extrae el `message` del error de Axios sin asumir su forma. */
function extractRawMessage(error: unknown): string[] | null {
  if (typeof error !== 'object' || error === null) return null;

  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return null;

  const data = (response as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return null;

  const message = (data as { message?: unknown }).message;

  if (typeof message === 'string') {
    return message.trim() ? [message.trim()] : null;
  }

  if (Array.isArray(message)) {
    const items = message
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : null;
  }

  return null;
}

/** Lee el status HTTP del error, si lo tiene. */
function extractStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null) return null;
  const status = (response as { status?: unknown }).status;
  return typeof status === 'number' ? status : null;
}

/**
 * Arma el texto final a partir de los mensajes de validación.
 *
 * class-validator devuelve **varios** errores a la vez, y cortar el string
 * concatenado a 200 caracteres dejaría el último mensaje partido al medio
 * ("La contraseña debe tener al me…"), que es peor que no mostrarlo. Por eso se
 * agregan mensajes **completos** mientras entren en el límite y se avisa
 * cuántos quedaron afuera: el usuario corrige los que ve y, al reintentar, el
 * backend le devuelve los que faltan.
 */
function joinMessages(items: string[]): string {
  const shown: string[] = [];
  let length = 0;

  for (const item of items) {
    const cost = item.length + (shown.length > 0 ? ERROR_SEPARATOR.length : 0);
    if (shown.length > 0 && length + cost > MAX_ERROR_LENGTH) break;
    shown.push(item);
    length += cost;
  }

  // Un único mensaje larguísimo sí se trunca: no hay nada completo que mostrar.
  if (shown.length === 1) {
    const only = shown[0] ?? '';
    const suffix = items.length > 1 ? ` (y ${items.length - 1} más)` : '';
    // `truncate` agrega la elipsis *encima* del corte, así que se descuenta
    // para que el total nunca pase de MAX_ERROR_LENGTH.
    return truncate(only, MAX_ERROR_LENGTH - suffix.length - 1) + suffix;
  }

  if (shown.length === items.length) return shown.join(ERROR_SEPARATOR);

  // Quedaron mensajes afuera: hay que hacerle lugar al aviso "(y N más)" sin
  // pasarse del límite, así que se devuelven mensajes completos hasta que entre.
  while (shown.length > 1) {
    const text = `${shown.join(ERROR_SEPARATOR)} (y ${items.length - shown.length} más)`;
    if (text.length <= MAX_ERROR_LENGTH) return text;
    shown.pop();
  }

  // Caso extremo: ni siquiera el primer mensaje más el aviso entran enteros.
  const suffix = ` (y ${items.length - 1} más)`;
  return truncate(shown[0] ?? '', MAX_ERROR_LENGTH - suffix.length - 1) + suffix;
}

/**
 * Convierte un error de Axios en un texto seguro para mostrar en un toast.
 *
 * Reemplaza al patrón `toast.error(error?.response?.data?.message)`, que
 * mostraba tal cual lo que mandara el backend: si un 500 se escapaba con
 * `"PrismaClientKnownRequestError: Unique constraint failed on the fields:
 * (`dni`)"`, el usuario —y cualquiera mirando la pantalla— se enteraba del ORM,
 * de la tabla y del nombre de la columna.
 *
 * El mensaje del backend sólo sobrevive si pasa **tres** filtros: status en la
 * whitelist, sin patrones de leak y recortado a 200 caracteres. Si falla
 * cualquiera de los tres, se devuelve el `fallback` que escribió quien llama.
 *
 * @param error    El error tal cual llega al `onError` / `catch`.
 * @param fallback Texto propio de la acción ("No se pudo crear el evento").
 */
export function getFriendlyError(error: unknown, fallback: string): string {
  const status = extractStatus(error);

  // Sin `response` es un error de red, un timeout o un abort: no hay mensaje
  // del backend que mostrar, y el detalle de Axios ("Network Error") no le
  // dice nada al usuario.
  if (status === null) return fallback;

  if (!SAFE_ERROR_STATUSES.has(status)) return fallback;

  const items = extractRawMessage(error);
  if (!items) return fallback;

  // Alcanza con que **uno** de los mensajes filtre para descartar todo el lote:
  // no vale la pena adivinar cuál era el inocente.
  if (items.some(looksLikeLeak)) return fallback;

  const text = joinMessages(items);
  return text.trim() ? text : fallback;
}

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
 * `News.imageKey` está tipado como `String?` en Prisma y validado sólo con
 * `@IsString()`, así que su contenido es **la URL entera**, no un parámetro
 * dentro de una base fija. Ése es el caso realmente riesgoso del hallazgo F15:
 * acá no hay `encodeURIComponent()` que valga, porque no estamos escapando un
 * dato *dentro* de una URL sino usando el dato *como* la URL.
 *
 * Qué se acepta:
 * - URLs absolutas `https://` (el caso que documenta el placeholder del form).
 * - Rutas relativas al propio origen (`/uploads/foo.jpg`, `noticias/foo.jpg`),
 *   que es lo que sería una "clave de MinIO" servida por un reverse proxy.
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
