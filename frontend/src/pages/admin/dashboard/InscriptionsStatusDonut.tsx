// ===========================================
// InscriptionsStatusDonut — el gráfico, y nada más que el gráfico
// ===========================================
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { InscriptionStatus } from '@/types';

/**
 * Este archivo es **el único** de todo `src/` que importa `recharts`, y por eso
 * está separado de la card que lo contiene.
 *
 * `recharts` pesa 322 kB (95 kB gzip). Mientras vivía dentro de
 * `InscriptionsStatusCard.tsx` viajaba en el chunk de `DashboardPage`, que es
 * el destino post-login de **todos** los roles: 95 kB gzip en el camino crítico
 * de cada login por un donut de cuatro porciones. Con el gráfico acá, el
 * `lazy()` de la card lo manda a un chunk propio que sólo se descarga cuando el
 * dashboard efectivamente tiene inscripciones que dibujar (R27).
 *
 * La leyenda —que no necesita `recharts`— se quedó en la card a propósito: así
 * el usuario ve los números apenas carga la página, aunque el SVG llegue medio
 * segundo después.
 */
export interface DonutSlice {
  key: InscriptionStatus;
  name: string;
  value: number;
}

interface InscriptionsStatusDonutProps {
  data: DonutSlice[];
  /** Color por estado; lo define la card, que también pinta la leyenda. */
  colors: Record<InscriptionStatus, string>;
}

export default function InscriptionsStatusDonut({ data, colors }: InscriptionsStatusDonutProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={70}
          paddingAngle={3}
          dataKey="value"
          stroke="none"
        >
          {data.map((entry) => (
            <Cell key={entry.key} fill={colors[entry.key]} />
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
  );
}
