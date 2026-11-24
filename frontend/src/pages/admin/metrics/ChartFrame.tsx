// ===========================================
// ChartFrame — marco con alto fijo para un gráfico lazy de recharts
// ===========================================
//
// Las tarjetas del panel dibujan con `MetricsChart`, que se carga con `lazy()`
// para que recharts no viaje en el chunk de la ruta. Este marco pone el
// `Suspense` y el alto: `ResponsiveContainer` necesita un padre con alto.
import { Suspense, lazy, type ComponentProps } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MetricsChart = lazy(() => import('./MetricsChart'));

type ChartFrameProps = ComponentProps<typeof MetricsChart> & {
  /** Alto en px, o una clase de alto de Tailwind (`h-64`). */
  alto?: number | string;
  className?: string;
  /** Resumen del gráfico para lectores de pantalla. */
  etiqueta: string;
};

export function ChartFrame({ alto = 'h-64', className, etiqueta, ...grafico }: ChartFrameProps) {
  const altoEnPx = typeof alto === 'number';
  return (
    <div
      role="img"
      aria-label={etiqueta}
      className={cn('relative w-full', !altoEnPx && alto, className)}
      style={altoEnPx ? { height: alto } : undefined}
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-400" aria-hidden="true" />
          </div>
        }
      >
        <MetricsChart {...grafico} />
      </Suspense>
    </div>
  );
}
