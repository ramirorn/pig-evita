// ===========================================
// CalendarAgenda — eventos del calendario como tarjetas con ficha de fecha
// ===========================================
import { Clock, MapPin, Tag } from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { cn } from '@/lib/utils';
import { BORDE_SIN_ETAPA, getStageStyle } from './eventStageStyles';
import {
  agruparPorMes,
  claveDia,
  diaDeSemanaCorto,
  etiquetaDeEtapa,
  fechaLarga,
  horaCorta,
  mesCorto,
  ocurreHoy,
  rangoDeDias,
  rangoLargo,
} from './agendaPorMes';

interface CalendarAgendaProps {
  /** Los eventos de la sección, ya ordenados (próximos ↑, pasados ↓). */
  eventos: readonly CalendarEvent[];
  /**
   * Nombres de sede y disciplina ya resueltos por la página.
   *
   * ⚠️ Llegan resueltos y no como relación porque `CalendarEvent` no tiene
   * `@relation` con `Venue` ni con `Discipline` en `schema.prisma` (ver U13):
   * la página cruza contra los catálogos, que son chicos y ya están en cache.
   * Un id que no resuelve (sede dada de baja) no produce texto: nada de "Sede a
   * confirmar", que sería inventar.
   */
  nombreDeSede: (event: CalendarEvent) => string | null;
  nombreDeDisciplina: (event: CalendarEvent) => string | null;
  /**
   * "Ya se disputaron". Se atenúa **sin opacity** (con opacity varios pares
   * caían debajo de AA): la ficha pasa a primary-600 y no hay chip "Hoy".
   */
  esPasado: boolean;
  /** Para el chip "Hoy". Se recibe para que el render sea determinista. */
  hoy: Date;
  /** Prefijo de los ids de los encabezados de mes (únicos por sección). */
  idPrefix: string;
}

/**
 * Propuesta A, "tarjetas con ficha de fecha": un encabezado por mes (`h3`,
 * fijo debajo de la barra del sitio al scrollear) y una grilla de tarjetas,
 * una por evento, cada una con su ficha.
 *
 * Esquema de encabezados: el `h2` de la sección lo pone la página; cada mes es
 * un `h3`. El título del evento es un párrafo, no un encabezado.
 */
export function CalendarAgenda({
  eventos,
  nombreDeSede,
  nombreDeDisciplina,
  esPasado,
  hoy,
  idPrefix,
}: CalendarAgendaProps) {
  const meses = agruparPorMes(eventos);

  return (
    <>
      {meses.map((mes) => {
        const id = `${idPrefix}-${mes.clave}`;
        return (
          <section key={mes.clave} aria-labelledby={id} className="mb-7 last:mb-0">
            {/* top-16: debajo de la barra del sitio (h-16, z-50). */}
            <h3
              id={id}
              className="sticky top-16 z-10 mb-3 border-b-2 border-primary-200 bg-surface/95 py-2.5 font-display text-base font-bold text-primary-800 backdrop-blur"
            >
              {mes.titulo}
            </h3>
            {/* auto-fill y 21rem: a 768 px entran 2 columnas aunque haya barra
                de desplazamiento; a 375 px, `min(100%, …)` evita el desborde. */}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))] gap-3.5">
              {mes.dias
                .flatMap((d) => d.eventos)
                .map((evento) => (
                  <TarjetaDeEvento
                    key={evento.id}
                    evento={evento}
                    sede={nombreDeSede(evento)}
                    disciplina={nombreDeDisciplina(evento)}
                    esPasado={esPasado}
                    hoy={hoy}
                  />
                ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** Base de los chips: clases completas, nunca armadas. */
const CHIP = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5';

/**
 * Una tarjeta. **No es interactiva** (no hay página de detalle ni enlace a la
 * sede), así que no tiene hover, sombra, cursor de mano ni foco propio: una
 * elevación al pasar el mouse promete un clic que no existe.
 */
function TarjetaDeEvento({
  evento,
  sede,
  disciplina,
  esPasado,
  hoy,
}: {
  evento: CalendarEvent;
  sede: string | null;
  disciplina: string | null;
  esPasado: boolean;
  hoy: Date;
}) {
  const inicio = new Date(evento.startDate);
  const fechaValida = !Number.isNaN(inicio.getTime());
  const rango = fechaValida ? rangoDeDias(evento) : null;
  const rangoLeido = rango ? rangoLargo(evento) : null;
  const estilo = getStageStyle(evento.stage);
  const etapa = estilo ? etiquetaDeEtapa(evento.stage) : null;
  // Sólo en próximos. Un evento de varios días en curso también es "de hoy".
  const esHoy = !esPasado && ocurreHoy(evento, hoy);
  const hayChips = esHoy || etapa !== null || rango !== null;
  const hayMeta = fechaValida || sede !== null || disciplina !== null;

  return (
    <li
      className={cn(
        'grid gap-3.5 rounded-2xl border border-l-4 border-primary-100 bg-surface-elevated py-3.5 pl-3 pr-3.5',
        estilo ? estilo.borde : BORDE_SIN_ETAPA,
        fechaValida ? 'grid-cols-[4.25rem_minmax(0,1fr)]' : 'grid-cols-1',
      )}
    >
      {fechaValida && (
        <time
          dateTime={claveDia(inicio)}
          className={cn(
            'flex flex-col items-center self-start rounded-xl py-2 text-center text-white',
            esPasado ? 'bg-primary-600' : 'bg-primary-800',
          )}
        >
          {/* Los tres textos visuales se ocultan al lector, que lee la fecha
              completa de una vez en vez de "JUE, 1, OCT". */}
          <span aria-hidden="true" className="text-xs font-semibold text-primary-200">
            {diaDeSemanaCorto(inicio)}
          </span>
          <span aria-hidden="true" className="font-display text-3xl font-black leading-none">
            {inicio.getDate()}
          </span>
          <span aria-hidden="true" className="text-xs font-semibold text-primary-100">
            {mesCorto(inicio)}
          </span>
          <span className="sr-only">{fechaLarga(inicio)}</span>
        </time>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        {hayChips && (
          <div className="flex flex-wrap gap-1.5">
            {esHoy && (
              // accent-500 sobre primary-900 = 7.96:1.
              <span className={cn(CHIP, 'bg-accent-500 font-bold text-primary-900')}>Hoy</span>
            )}
            {estilo && etapa && (
              <span className={cn(CHIP, estilo.chip)}>
                <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', estilo.dot)} />
                <span className="sr-only">Etapa </span>
                {etapa}
              </span>
            )}
            {rango && (
              // primary-50/700 y no celeste: el celeste es el del chip Zonal y
              // un rango zonal parecería tener dos etapas.
              <span className={cn(CHIP, 'bg-primary-50 text-primary-700')}>
                <span aria-hidden="true">{rango}</span>
                {rangoLeido && <span className="sr-only">{rangoLeido}</span>}
              </span>
            )}
          </div>
        )}

        <p className="break-words text-base font-bold leading-snug text-primary-900">{evento.title}</p>

        {hayMeta && (
          <ul className="flex flex-col gap-1 text-sm text-primary-600">
            {fechaValida && (
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  <time dateTime={evento.startDate}>{horaCorta(inicio)} hs</time>
                </span>
              </li>
            )}
            {sede && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  <span className="sr-only">Sede: </span>
                  {sede}
                </span>
              </li>
            )}
            {disciplina && (
              <li className="flex items-start gap-2">
                <Tag className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  <span className="sr-only">Disciplina: </span>
                  {disciplina}
                </span>
              </li>
            )}
          </ul>
        )}

        {evento.description && (
          // line-clamp-3: no hay página de detalle donde leer el resto.
          <p className="line-clamp-3 text-sm text-muted-foreground">{evento.description}</p>
        )}
      </div>
    </li>
  );
}

/** Esqueleto con la forma de las tarjetas (no salta el alto al cargar). */
export function CalendarAgendaSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-4 h-8 w-48 animate-pulse rounded-lg bg-primary-100" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))] gap-3.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-primary-50" />
        ))}
      </div>
    </div>
  );
}
