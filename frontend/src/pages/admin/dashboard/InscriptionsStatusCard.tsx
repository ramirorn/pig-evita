// ===========================================
// InscriptionsStatusCard — donut de inscripciones por estado
// ===========================================
import { Suspense, lazy, useMemo } from 'react';
import { Activity } from 'lucide-react';
import { InscriptionStatus, type DashboardStatusCount } from '@/types';
import { INSCRIPTION_STATUS_LABELS } from '@/lib/constants';

/**
 * El SVG del donut se carga aparte (R27).
 *
 * `recharts` es lo que hacía que el chunk de `DashboardPage` pesara 322 kB (el
 * más grande del admin por lejos, 22× el siguiente). Como `DashboardPage` es el
 * aterrizaje post-login de todos los roles, esos 95 kB gzip estaban en el camino
 * crítico de cada login. Con el gráfico aislado en `InscriptionsStatusDonut` y
 * este `lazy()`, `recharts` sale del chunk de la ruta y se descarga sólo cuando
 * hay inscripciones que dibujar.
 *
 * El corte está puesto acá adentro y no en `DashboardPage` a propósito: la
 * leyenda y el marco de la card no dependen de `recharts`, así que pueden
 * pintarse de una y sólo el hueco de 160×160 espera al chunk.
 */
const InscriptionsStatusDonut = lazy(() => import('./InscriptionsStatusDonut'));

const DONUT_COLORS: Record<InscriptionStatus, string> = {
  [InscriptionStatus.PENDIENTE]: '#E8AA34',    // accent-500
  [InscriptionStatus.REVISADA]: '#1b5ea9',     // primary-500
  [InscriptionStatus.APROBADA]: '#2D723B',     // secondary-500
  [InscriptionStatus.RECHAZADA]: '#d32f2f',    // destructive-500
};

interface InscriptionsStatusCardProps {
  /** Los 4 estados tal como los manda el backend, ceros incluidos. */
  data: DashboardStatusCount[];
}

export function InscriptionsStatusCard({ data }: InscriptionsStatusCardProps) {
  // El backend ya manda los 4 estados en orden y con `count: 0` si no hay
  // filas, así que acá sólo se descartan los ceros: una porción de valor 0 no
  // se ve en el donut pero sí ensucia la leyenda.
  const donutData = useMemo(
    () =>
      data
        .filter((row) => row.count > 0)
        .map((row) => ({
          key: row.status,
          name: INSCRIPTION_STATUS_LABELS[row.status],
          value: row.count,
        })),
    [data],
  );

  return (
    <div className="card p-6">
      <h3 className="font-bold text-primary-900 mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary-500" />
        Inscripciones por Estado
      </h3>
      {donutData.length > 0 ? (
        <div className="flex items-center gap-6">
          {/* El contenedor con su `w-40 h-40` queda **fuera** del Suspense: el
              hueco del gráfico ya ocupa su lugar antes de que llegue el chunk,
              así la card no salta cuando el donut aparece. */}
          <div className="w-40 h-40 flex-shrink-0">
            <Suspense fallback={<DonutFallback />}>
              <InscriptionsStatusDonut data={donutData} colors={DONUT_COLORS} />
            </Suspense>
          </div>
          <div className="flex-1 space-y-2">
            {donutData.map((d) => (
              <div key={d.key} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: DONUT_COLORS[d.key] }}
                  />
                  <span className="text-primary-600">{d.name}</span>
                </div>
                <span className="font-bold text-primary-800">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center py-8 text-primary-500 text-sm">
          No hay inscripciones todavía.
        </p>
      )}
    </div>
  );
}

/**
 * Anillo gris del mismo diámetro que el donut (140 px de caja externa dentro de
 * los 160 del contenedor), para que el espacio esté reservado desde el primer
 * frame y no haya salto de layout al resolver el `lazy()`.
 */
function DonutFallback() {
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Cargando el gráfico de inscripciones por estado…</span>
      <span className="w-[140px] h-[140px] rounded-full border-[30px] border-primary-100 animate-pulse" />
    </div>
  );
}
