// ===========================================
// InscriptionsStatusCard — donut de inscripciones por estado
// ===========================================
import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { InscriptionStatus, type DashboardStatusCount } from '@/types';
import { INSCRIPTION_STATUS_LABELS } from '@/lib/constants';

/**
 * Este módulo es **el único** del área admin que importa `recharts`, y por eso
 * vive aparte de `DashboardPage`.
 *
 * `recharts` es lo que hacía que el chunk de `DashboardPage` pesara 322 KB (el
 * más grande del admin por lejos). Con el gráfico acá adentro, convertir el
 * import de la página en un `lazy()` alcanza para sacar esas 322 KB del chunk
 * de la ruta: la tarjeta entera se resuelve en un único límite de carga y el
 * fallback puede ser el marco de la card. Ese paso es otra tarea — acá sólo
 * queda servido el corte.
 */
const DONUT_COLORS = {
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
          <div className="w-40 h-40 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={DONUT_COLORS[entry.key]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value}`, `${name}`]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '13px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
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
