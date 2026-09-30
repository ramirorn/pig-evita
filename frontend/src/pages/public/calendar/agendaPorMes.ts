// ===========================================
// agendaPorMes — agrupado por mes y día, y formatos de la agenda
// ===========================================
//
// Lógica pura (sin React) de la vista "Agenda por mes" del calendario público.
// Vive aparte del componente por la misma razón que `calendarSecciones.ts`: se
// ejercita sin montar nada y no rompe el fast refresh.
import type { CalendarEvent } from '@/types';
import { esMismoDia } from './calendarSecciones';
import { MONTH_NAMES } from './eventStageStyles';

export interface DiaDeAgenda {
  /** `aaaa-mm-dd` del día de inicio. */
  clave: string;
  fecha: Date;
  eventos: CalendarEvent[];
}

export interface MesDeAgenda {
  /** `aaaa-mm`. */
  clave: string;
  /** "Octubre 2026". */
  titulo: string;
  dias: DiaDeAgenda[];
}

const dos = (n: number) => String(n).padStart(2, '0');
const claveDia = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const claveMes = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}`;

/**
 * Agrupa por mes y, dentro del mes, por día de inicio. **Respeta el orden de
 * entrada** (la sección ya viene ordenada: próximos ascendente, pasados
 * descendente), así que la misma función sirve para las dos.
 *
 * Varios eventos el mismo día comparten el día: la agenda lo muestra una vez.
 * Una fecha ilegible no se descarta: va a un grupo "Sin fecha" al final, donde
 * alguien la va a ver (mismo criterio que `repartirPorFecha`).
 */
export function agruparPorMes(eventos: readonly CalendarEvent[]): MesDeAgenda[] {
  const meses: MesDeAgenda[] = [];
  const sinFecha: CalendarEvent[] = [];

  for (const evento of eventos) {
    const inicio = new Date(evento.startDate);
    if (Number.isNaN(inicio.getTime())) {
      sinFecha.push(evento);
      continue;
    }
    const cm = claveMes(inicio);
    let mes = meses.find((m) => m.clave === cm);
    if (!mes) {
      mes = { clave: cm, titulo: `${MONTH_NAMES[inicio.getMonth()] ?? ''} ${inicio.getFullYear()}`, dias: [] };
      meses.push(mes);
    }
    const cd = claveDia(inicio);
    let dia = mes.dias.find((d) => d.clave === cd);
    if (!dia) {
      dia = { clave: cd, fecha: inicio, eventos: [] };
      mes.dias.push(dia);
    }
    dia.eventos.push(evento);
  }

  if (sinFecha.length > 0) {
    meses.push({
      clave: 'sin-fecha',
      titulo: 'Sin fecha confirmada',
      dias: [{ clave: 'sin-fecha', fecha: new Date(Number.NaN), eventos: sinFecha }],
    });
  }
  return meses;
}

/** "LUN", "SÁB": día de la semana abreviado, en mayúsculas. */
export function diaDeSemanaCorto(fecha: Date): string {
  return fecha
    .toLocaleDateString('es-AR', { weekday: 'short' })
    .replace('.', '')
    .toUpperCase();
}

/** "14:57". */
export function horaCorta(fecha: Date): string {
  return fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const mesCorto = (d: Date) => d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');

/**
 * Rango de un evento de varios días: "5–7 oct" dentro del mismo mes y
 * "30 sep – 2 oct" si cruza de mes. `null` si dura un solo día (o si la fecha
 * de cierre falta o es ilegible: el dato ausente se omite).
 */
export function rangoDeDias(evento: CalendarEvent): string | null {
  const inicio = new Date(evento.startDate);
  if (!evento.endDate || Number.isNaN(inicio.getTime())) return null;
  const fin = new Date(evento.endDate);
  if (Number.isNaN(fin.getTime()) || esMismoDia(inicio, fin) || fin < inicio) return null;
  if (inicio.getMonth() === fin.getMonth() && inicio.getFullYear() === fin.getFullYear()) {
    return `${inicio.getDate()}–${fin.getDate()} ${mesCorto(fin)}`;
  }
  return `${inicio.getDate()} ${mesCorto(inicio)} – ${fin.getDate()} ${mesCorto(fin)}`;
}

/** "ZONAL" → "Zonal". `null` si no hay etapa. */
export function etiquetaDeEtapa(stage: string | null | undefined): string | null {
  if (!stage) return null;
  return `${stage.charAt(0)}${stage.slice(1).toLowerCase()}`;
}

/**
 * La línea de detalle debajo del título: sede · etapa · disciplina, sólo lo
 * que existe. Nada de "—" ni "a confirmar" de relleno.
 */
export function lineaDeDetalle(partes: ReadonlyArray<string | null | undefined>): string[] {
  return partes.filter((p): p is string => typeof p === 'string' && p.trim() !== '');
}
