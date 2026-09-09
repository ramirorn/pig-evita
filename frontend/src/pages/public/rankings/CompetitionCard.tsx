// ===========================================
// CompetitionCard — tarjeta del listado público de rankings
// ===========================================
import { CalendarDays, ListChecks } from 'lucide-react';
import { Link } from 'react-router';
import type { Competition, CompetitionStatus } from '@/types';
import { cn } from '@/lib/utils';
import { STAGE_LABELS, FORMAT_LABELS, COMPETITION_STATUS_LABELS } from '@/lib/constants';
import { retrasoDeEntrada } from '@/lib/gridVolumen';

/**
 * `BORRADOR` no está en este mapa a propósito: la página descarta los
 * borradores antes de pintar nada, así que la rama era inalcanzable. Un estilo
 * que no se puede alcanzar es código muerto que igual hay que leer y mantener.
 */
const STATUS_BADGE: Record<string, string> = {
  ACTIVA: 'bg-secondary-50 text-secondary-800 border-secondary-200',
  FINALIZADA: 'bg-primary-50 text-primary-700 border-primary-200',
};

/** Fecha corta en español rioplatense, sin dependencias: `Intl` es nativo. */
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

/**
 * El título, con guardas.
 *
 * Antes era `` competition.name || `${discipline?.name} - ${category?.name}` ``:
 * si las relaciones no venían —y el listado público no controla el `include`—
 * el título de la tarjeta era literalmente "undefined - undefined".
 */
function tituloDe(competition: Competition): string {
  const propio = competition.name?.trim();
  if (propio) return propio;

  const derivado = [competition.discipline?.name, competition.category?.name]
    .filter((parte): parte is string => Boolean(parte))
    .join(' · ');

  return derivado || 'Competencia sin nombre';
}

interface CompetitionCardProps {
  competition: Competition;
  index: number;
}

export function CompetitionCard({ competition, index }: CompetitionCardProps) {
  /**
   * El pie de la tarjeta, que era el peor de los cuatro problemas.
   *
   * Antes había dos `<span>` con fondo y padding de botón —"Ver Fixture" y
   * "Posiciones"— dentro de un `<Link>` que iba al mismo lado en los dos casos:
   * una afordancia falsa. Y peor, una afirmación falsa: sin partidos generados
   * no hay fixture ni tabla de posiciones que ver.
   *
   * `_count.matches` es el dato que lo decide, y la API ya lo devuelve. Si no
   * viniera (el detalle por id trae `matches[]` en su lugar), no se afirma nada
   * en ninguna dirección: el pie no se pinta.
   */
  const partidos = competition._count?.matches;

  const inicio = competition.startDate ? fechaCorta(competition.startDate) : null;
  const fin = competition.endDate ? fechaCorta(competition.endDate) : null;

  const etapa: string | undefined = STAGE_LABELS[competition.stage];
  const formato: string | undefined = FORMAT_LABELS[competition.format];
  const metadatos = [etapa, formato].filter((parte): parte is string => Boolean(parte));

  return (
    <Link
      to={`/competencias/${competition.id}`}
      // `block h-full` + el radio de la tarjeta: ver el comentario de
      // `DisciplineCard`. Es el mismo arreglo por el mismo motivo.
      className="group block h-full rounded-xl animate-fade-in"
      style={{ animationDelay: retrasoDeEntrada(index) }}
    >
      <div className="card p-6 h-full hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between border-t-4 border-t-accent-500">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border',
                STATUS_BADGE[competition.status] || 'bg-primary-50 text-primary-700 border-primary-200',
              )}
            >
              {COMPETITION_STATUS_LABELS[competition.status as CompetitionStatus] || competition.status}
            </span>
          </div>

          {/* Disciplina y categoría como badges y no como filas
              "Etiqueta: Valor" con `justify-between`: con textos cortos aquello
              dejaba un vacío enorme en el medio de cada fila y el ojo tenía que
              saltar de una punta a la otra para leer dos palabras. */}
          {(competition.discipline?.name || competition.category?.name) && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {competition.discipline?.name && (
                <span className="inline-flex items-center rounded-md bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                  {competition.discipline.name}
                </span>
              )}
              {competition.category?.name && (
                <span className="inline-flex items-center rounded-md bg-celeste-50 px-2 py-0.5 text-xs font-semibold text-celeste-800">
                  {competition.category.name}
                </span>
              )}
            </div>
          )}

          <h2 className="text-xl font-bold text-primary-900 mb-2">{tituloDe(competition)}</h2>

          <div className="space-y-1 text-sm text-primary-600">
            {metadatos.length > 0 && <p>{metadatos.join(' · ')}</p>}

            {/* Sin fechas cargadas no hay fila: dos de las tres competencias
                reales tienen `startDate: null`. */}
            {inicio && (
              <p className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-primary-500" aria-hidden="true" />
                {fin ? `Del ${inicio} al ${fin}` : `Desde el ${inicio}`}
              </p>
            )}
          </div>
        </div>

        {partidos !== undefined && (
          <div className="mt-6 pt-4 border-t border-primary-100">
            {partidos > 0 ? (
              // Un solo texto, y nombra a dónde lleva de verdad el enlace que ya
              // envuelve toda la tarjeta.
              <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-800">
                <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
                Ver fixture y posiciones ({partidos} {partidos === 1 ? 'partido' : 'partidos'})
              </span>
            ) : (
              // Sin forma de botón, porque no es una acción. Y es información
              // útil: quien mira sabe que no es un error suyo.
              <span className="text-xs font-medium text-primary-600">
                Fixture aún no generado
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
