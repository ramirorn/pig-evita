// ===========================================
// HighlightCard — "Lo que más necesitan los deportistas es:"
// ===========================================
//
// Un destacado se lee como un titular: el título, una frase en lenguaje
// simple para la opción más elegida y el ranking con barras gruesas. Debajo,
// siempre, sobre cuántas respuestas y a qué hora: el dato tiene que poder
// rastrearse aunque la tarjeta se proyecte en una reunión.
import type { ReactNode } from 'react';
import { EyeOff, Megaphone } from 'lucide-react';
import type { DestacadoResultado } from '@/types';
import { cn } from '@/lib/utils';
import { colorDeSerie, fraseOpcion, textoBase } from '@/lib/metrics/metricsRules';

interface HighlightCardProps {
  destacado: DestacadoResultado;
  generadoEn: string;
  umbral: number;
  minimoFrases: number;
  acciones?: ReactNode;
  /** Modo presentación: tipografía más grande. */
  grande?: boolean;
}

export function HighlightCard({
  destacado,
  generadoEn,
  umbral,
  minimoFrases,
  acciones,
  grande = false,
}: HighlightCardProps) {
  const { base, opciones, ocultas, puedeAfirmar } = destacado;
  const primera = opciones[0];

  return (
    <article
      aria-labelledby={`destacado-${destacado.id}`}
      className={cn('card flex h-full flex-col gap-4 p-5', grande && 'p-8')}
    >
      <header className="flex items-start justify-between gap-2">
        <h3
          id={`destacado-${destacado.id}`}
          className={cn(
            'flex items-start gap-2 font-bold text-primary-900',
            grande ? 'text-3xl' : 'text-lg',
          )}
        >
          <Megaphone className={cn('mt-0.5 shrink-0 text-accent-500', grande ? 'h-8 w-8' : 'h-5 w-5')} aria-hidden="true" />
          {destacado.titulo}
        </h3>
        {acciones}
      </header>

      {base.suprimido ? (
        <p className="rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
          Todavía hay muy pocas respuestas: se muestra cuando haya al menos {umbral}, para proteger el anonimato.
        </p>
      ) : opciones.length === 0 ? (
        <p className="rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
          Nadie eligió todavía estas opciones en este corte.
        </p>
      ) : (
        <>
          {primera &&
            (puedeAfirmar ? (
              <p className={cn('font-semibold text-primary-800', grande ? 'text-2xl' : 'text-base')}>
                {fraseOpcion(primera.porcentaje, primera.texto)}.
              </p>
            ) : (
              <p className="text-sm text-primary-600">
                Todavía hay pocas respuestas para sacar conclusiones (se necesitan al menos {minimoFrases}).
              </p>
            ))}
          <ol className="space-y-3" aria-label="Ranking">
            {opciones.map((opcion, i) => (
              <li key={opcion.valor} className="space-y-1">
                <div className={cn('flex items-baseline justify-between gap-3', grande ? 'text-xl' : 'text-sm')}>
                  <span className="min-w-0 font-semibold text-primary-900">
                    <span className="mr-2 tabular-nums text-primary-500">{i + 1}.</span>
                    {opcion.texto}
                  </span>
                  <span className="shrink-0 font-black tabular-nums text-primary-900">
                    {opcion.porcentaje.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %
                  </span>
                </div>
                <div className={cn('w-full overflow-hidden rounded-full bg-primary-50', grande ? 'h-5' : 'h-3')}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, opcion.porcentaje)}%`, background: colorDeSerie(i) }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      <footer className="mt-auto space-y-1 border-t border-primary-100 pt-3 text-xs text-primary-500">
        {!base.suprimido && <p>{textoBase(base.conteo, generadoEn)}</p>}
        {ocultas > 0 && (
          <p className="flex items-center gap-1.5">
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            {ocultas === 1
              ? 'Una opción no se muestra porque tiene menos de 5 respuestas o permitiría deducirlas.'
              : `${ocultas} opciones no se muestran porque tienen menos de 5 respuestas o permitirían deducirlas.`}
          </p>
        )}
      </footer>
    </article>
  );
}
