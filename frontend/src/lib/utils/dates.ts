// ===========================================
// Fechas
// ===========================================
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const fecha = new Date(dateStr);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Fecha "de calendario" (dd/mm/aaaa) sin corrimiento de zona horaria (F-28).
 *
 * Una fecha de nacimiento llega como `2012-05-05T00:00:00.000Z`: medianoche
 * UTC, que en Formosa (UTC-3) son las 21 h del día anterior. Formatearla en la
 * zona del navegador mostraba `4/5/2012`. Acá se toma el día tal como se
 * guardó: se lee `aaaa-mm-dd` del texto, y si no viene así se formatea en UTC.
 */
export function formatCalendarDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const fecha = new Date(dateStr);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

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

/** Fecha y hora (dd/mm/aaaa hh:mm). Ausente o inválida → "—". */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const fecha = new Date(dateStr);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Truncate text to a max length */
