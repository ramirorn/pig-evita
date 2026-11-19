// ===========================================
// StatTile — número grande con su rótulo y una mini tendencia
// ===========================================
//
// La fila de tarjetas de arriba del panel: un número que se lee desde lejos,
// un rótulo corto en mayúsculas y, a la derecha, la tendencia de respuestas
// (o un ícono si el dato no tiene serie). El borde alterna azul y verde.
import type { ReactNode } from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { puntosSparkline } from '@/lib/metrics/metricsRules';

const ANCHO_SPARK = 56;
const ALTO_SPARK = 20;

interface StatTileProps {
  etiqueta: string;
  valor: ReactNode;
  acento?: 'primary' | 'secondary';
  /** Serie para la mini tendencia; `null` = punto suprimido. */
  tendencia?: readonly (number | null)[];
  /** Texto chico debajo del rótulo (base, motivo de "—"). */
  pie?: ReactNode;
  /** Botones (editar/borrar) para quien gestiona la encuesta; van al pie. */
  acciones?: ReactNode;
  /** Texto largo (descripción) como tooltip, para no estirar la fila. */
  titulo?: string;
  testId?: string;
  /** Modo presentación: todo más grande. */
  grande?: boolean;
}

export function StatTile({
  etiqueta,
  valor,
  acento = 'primary',
  tendencia,
  pie,
  acciones,
  titulo,
  testId,
  grande = false,
}: StatTileProps) {
  const puntos = tendencia ? puntosSparkline(tendencia, ANCHO_SPARK, ALTO_SPARK) : '';
  const color = acento === 'primary' ? 'var(--color-primary-500)' : 'var(--color-secondary-500)';

  return (
    <article
      aria-label={etiqueta}
      title={titulo}
      className={cn(
        'flex h-full min-w-0 flex-col justify-between gap-3 rounded-xl border-2 bg-white p-4 shadow-sm',
        acento === 'primary' ? 'border-primary-500' : 'border-secondary-500',
        grande && 'p-6',
      )}
    >
      {/* El número tiene todo el ancho: "42,9 %" no choca con la tendencia. */}
      <div
        className={cn(
          'min-w-0 whitespace-nowrap font-black tabular-nums leading-none text-primary-900',
          grande ? 'text-5xl' : 'text-3xl',
        )}
        data-testid={testId}
      >
        {valor}
      </div>
      <div className="min-w-0">
        <div className="flex items-end justify-between gap-2">
          <p
            className={cn(
              'min-w-0 font-semibold uppercase tracking-wide text-primary-800',
              grande ? 'text-sm' : 'text-[11px] leading-snug',
            )}
          >
            {etiqueta}
          </p>
          <span
            className={cn(
              'flex h-8 w-16 shrink-0 items-center justify-center rounded-md',
              acento === 'primary' ? 'bg-primary-50' : 'bg-secondary-50',
            )}
            aria-hidden="true"
          >
            {puntos ? (
              <svg width={ANCHO_SPARK} height={ALTO_SPARK} viewBox={`-2 -2 ${ANCHO_SPARK + 4} ${ALTO_SPARK + 4}`}>
                <polyline points={puntos} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <TrendingUp className="h-5 w-5" style={{ color }} />
            )}
          </span>
        </div>
        {pie && <div className="mt-1 text-xs leading-snug text-primary-500">{pie}</div>}
        {acciones && <div className="-mb-2 -ml-2 mt-1 flex gap-0.5">{acciones}</div>}
      </div>
    </article>
  );
}
