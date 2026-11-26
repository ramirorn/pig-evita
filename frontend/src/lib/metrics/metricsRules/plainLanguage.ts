// ===========================================
// Lenguaje simple (frases para quien no lee gráficos)
// ===========================================
// ===========================================
// Lenguaje simple
// ===========================================
//
// Frases para quien no lee gráficos: "4 de cada 10 eligieron «Transporte»".
// Redondean al décimo más cercano pero nunca exageran: 47 % es "casi la
// mitad", no "la mitad"; "casi todos" pide al menos 95 %. Sólo se muestran
// cuando el backend dice que la base alcanza el mínimo (`puedeAfirmar`).

export function fraseOpcion(porcentaje: number, texto: string): string {
  const opcion = `«${texto}»`;
  if (porcentaje >= 95) return `Casi todos eligieron ${opcion}`;
  if (porcentaje >= 50 && porcentaje < 55) return `La mitad eligió ${opcion}`;
  if (porcentaje >= 45 && porcentaje < 50) return `Casi la mitad eligió ${opcion}`;
  if (porcentaje < 5) return `Menos de 1 de cada 10 eligió ${opcion}`;
  const decimos = Math.min(9, Math.max(1, Math.round(porcentaje / 10)));
  return decimos === 1
    ? `1 de cada 10 eligió ${opcion}`
    : `${decimos} de cada 10 eligieron ${opcion}`;
}

export const ZONA_HORARIA = 'America/Argentina/Cordoba';

/** "Sobre 312 respuestas · datos al 18/11 12:04" (hora de Formosa). */
export function textoBase(respuestas: number, generadoEn: string): string {
  const partes = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(generadoEn));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? '';
  const sustantivo = respuestas === 1 ? 'respuesta' : 'respuestas';
  return `Sobre ${respuestas.toLocaleString('es-AR')} ${sustantivo} · datos al ${parte('day')}/${parte('month')} ${parte('hour')}:${parte('minute')}`;
}
