// ===========================================
// CalendarEventCard — item del timeline del calendario público
// ===========================================
import { Clock, MapPin, Medal } from 'lucide-react';
import type { CalendarEvent } from '@/types';
import { cn } from '@/lib/utils';
import { getStageStyle } from './eventStageStyles';
import { esMismoDia } from './calendarSecciones';
import { retrasoDeEntrada } from '@/lib/gridVolumen';

interface CalendarEventCardProps {
  event: CalendarEvent;
  /** Posición en la lista ya filtrada: define el delay de la animación y el recorte del eje. */
  index: number;
  isLast: boolean;
  /**
   * Nombre de la sede, ya resuelto por la página.
   *
   * ⚠️ Llega resuelto y no como relación porque **`CalendarEvent` no tiene
   * `@relation` con `Venue` ni con `Discipline`** en `schema.prisma`: hay un
   * `venueId` y un `disciplineId` sueltos, así que la API no puede devolver
   * `event.venue.name` con un `include` — no existe la relación que incluir. La
   * página cruza contra el catálogo de sedes, que es chico y ya está en cache.
   * La alternativa correcta a largo plazo es la migración anotada como U13.
   *
   * `null` = el id no resuelve (sede dada de baja, id viejo). En ese caso la
   * fila no se pinta: nada de "Sede a confirmar", que sería inventar.
   */
  nombreDeSede: string | null;
  /** Ídem, para la disciplina. */
  nombreDeDisciplina: string | null;
  /** El evento ya se disputó: se atenúa, no se oculta. */
  esPasado: boolean;
  /** El evento arranca hoy. */
  esHoy: boolean;
}

/** Día y mes abreviado, en español rioplatense. `Intl` es nativo: cero kB. */
function diaYMes(fecha: Date): string {
  return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function CalendarEventCard({
  event,
  index,
  isLast,
  nombreDeSede,
  nombreDeDisciplina,
  esPasado,
  esHoy,
}: CalendarEventCardProps) {
  const date = new Date(event.startDate);
  const stageStyle = getStageStyle(event.stage);

  // Un evento de varios días se mostraba como si fuera de un día: `endDate`
  // estaba en el modelo, en el tipo y en la respuesta, y no se pintaba en
  // ningún lado.
  const fin = event.endDate ? new Date(event.endDate) : null;
  const hayRango = fin !== null && !Number.isNaN(fin.getTime()) && !esMismoDia(date, fin);

  return (
    <div
      className={cn(
        'group relative flex flex-col md:flex-row items-stretch gap-4 md:gap-8 pb-10 last:pb-0 animate-fade-in',
        // Los eventos que ya se disputaron se atenúan, no se esconden: siguen
        // siendo información, sólo que no es la que se está buscando.
        esPasado && 'opacity-70',
      )}
      style={{ animationDelay: retrasoDeEntrada(index) }}
    >
      {/* Columna Izquierda: Tarjeta de Fecha */}
      <div className="w-full md:w-44 flex-shrink-0 flex md:justify-end">
        <div className="w-full bg-white rounded-2xl border border-primary-100 shadow-sm group-hover:shadow-md group-hover:border-primary-200 transition-all duration-300 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-primary-800 to-primary-700 text-white py-1.5 px-3 text-center">
            <span className="font-bold uppercase tracking-wider text-xs block">
              {date.toLocaleDateString('es-AR', { weekday: 'long' })}
            </span>
          </div>

          <div className="p-4 flex flex-col items-center justify-center flex-1 bg-white">
            {hayRango && fin ? (
              <span className="text-2xl md:text-3xl font-black text-primary-900 tracking-tight leading-none text-center">
                {diaYMes(date)} <span aria-label="hasta el">→</span> {diaYMes(fin)}
              </span>
            ) : (
              <>
                <span className="text-4xl md:text-5xl font-black text-primary-900 tracking-tight leading-none">
                  {date.getDate()}
                </span>
                <span className="text-primary-700 font-semibold text-sm capitalize mt-1">
                  {date.toLocaleDateString('es-AR', { month: 'long' })}
                </span>
              </>
            )}

            <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-semibold border border-primary-100/80">
              <Clock className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span>
                {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Columna Central: Eje y Nodo de Conexión (Timeline) */}
      <div className="hidden md:flex flex-col items-center relative w-8 flex-shrink-0">
        <div
          className={cn(
            'w-0.5 bg-gradient-to-b from-primary-200 via-celeste-300 to-primary-200 absolute top-0 bottom-0 left-1/2 -translate-x-1/2',
            index === 0 && 'top-6',
            isLast && 'bottom-[calc(100%-2.5rem)]',
          )}
        />

        <div className="relative z-10 w-7 h-7 rounded-full bg-white border-2 border-primary-500 shadow-md flex items-center justify-center mt-6 group-hover:scale-110 group-hover:border-accent-500 transition-all duration-300">
          {/* Un evento pasado pierde el color de etapa en el nodo: la línea de
              tiempo se lee de un vistazo sin tener que leer las fechas. */}
          <span
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-colors duration-300',
              esPasado ? 'bg-primary-200' : stageStyle.dot,
            )}
          />
        </div>
      </div>

      {/* Columna Derecha: Tarjeta de Contenido del Evento */}
      <div className="flex-1 bg-white rounded-2xl p-6 border border-primary-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between relative overflow-hidden group/card">
        <div className={cn('absolute left-0 top-0 bottom-0 w-1.5', stageStyle.stripe)} />

        <div>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            {/* `h3` porque cuelga del `h2` de su sección ("Próximos eventos" /
                "Ya se disputaron"). Antes era un `h3` directamente bajo el `h1`
                del encabezado, saltándose un nivel: era la única de las cuatro
                páginas que rompía el esquema del documento. */}
            <h3 className="text-xl font-bold text-primary-900 group-hover/card:text-primary-700 transition-colors leading-snug">
              {event.title}
            </h3>

            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              {esHoy && (
                // accent-500 sobre primary-900 = 7.96:1.
                <span className="inline-flex items-center rounded-full bg-accent-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-900">
                  Hoy
                </span>
              )}

              {event.stage && (
                <span
                  className={cn(
                    'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-xs',
                    stageStyle.badge,
                  )}
                >
                  Etapa {event.stage.charAt(0) + event.stage.slice(1).toLowerCase()}
                </span>
              )}
            </div>
          </div>

          {/* Si no hay descripción, no hay párrafo. Antes se pintaba "Evento
              oficial del cronograma de los Juegos Evita Formosa." en itálica
              cuando `description` era null — y como los tres eventos cargados
              la tienen en null, esa frase inventada era el 100 % de las
              descripciones que se veían en la página. Texto de relleno con el
              formato de un texto real. */}
          {event.description && (
            <p className="text-primary-600 text-sm leading-relaxed mb-4">
              {event.description}
            </p>
          )}
        </div>

        {/* La fila de metadatos. Acá había dos chips decorativos: "Competencia
            Oficial", que no salía de ningún campo, y "Juegos Evita Formosa",
            que es el nombre del sitio en el que ya estás. Ocupaban exactamente
            el lugar donde va la sede que el encabezado de la página promete
            ("Fechas, horarios y sedes…") y que la tarjeta no mostraba, teniendo
            los tres eventos su `venueId` cargado. */}
        {(nombreDeSede || nombreDeDisciplina) && (
          <div className="pt-3 border-t border-primary-50 flex flex-wrap items-center gap-4 text-xs font-medium text-primary-600">
            {nombreDeSede && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary-500" aria-hidden="true" />
                {nombreDeSede}
              </span>
            )}
            {nombreDeDisciplina && (
              <span className="flex items-center gap-1.5">
                <Medal className="w-3.5 h-3.5 text-primary-500" aria-hidden="true" />
                {nombreDeDisciplina}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
