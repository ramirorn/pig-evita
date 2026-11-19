// ===========================================
// TerritoryCard — la pregunta en foco por departamento
// ===========================================
//
// Barras horizontales: los nombres de los departamentos van a la izquierda y
// nunca se enciman (ver `disponerBarras`). Es el gráfico para "¿dónde falta?".
import { useState } from 'react';
import type { MetricsCross } from '@/types';
import { aDatosBarras, disponerBarras } from '@/lib/metrics/metricsRules';
import { Button } from '@/components/ui/button';
import { NotaSupresion } from '@/pages/admin/survey/SupresionKAnonimato';
import { ChartFrame } from './ChartFrame';

interface TerritoryCardProps {
  cruce: MetricsCross | undefined;
  cargando: boolean;
}

export function TerritoryCard({ cruce, cargando }: TerritoryCardProps) {
  const [verTodas, setVerTodas] = useState(false);
  const [suprimidas, setSuprimidas] = useState(0);
  const disposicion = cruce ? disponerBarras(aDatosBarras(cruce).datos, { verTodas }) : null;

  return (
    <section className="card flex h-full flex-col gap-4 p-5" aria-labelledby="titulo-territorio">
      <h2 id="titulo-territorio" className="type-h3 text-primary-900">Por departamento</h2>
      {cargando && !cruce ? (
        <div className="h-72 animate-pulse rounded-xl bg-primary-50" />
      ) : !disposicion || disposicion.filas.length === 0 ? (
        <p className="rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
          Todavía no hay respuestas con departamento en este corte.
        </p>
      ) : (
        <>
          <ChartFrame
            tipo="barras"
            cruce={cruce}
            verTodas={verTodas}
            onSuprimidas={setSuprimidas}
            alto={disposicion.alto ?? 288}
            etiqueta={`${cruce?.pregunta.texto ?? 'Pregunta'} por departamento`}
          />
          {(disposicion.ocultas > 0 || verTodas) && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setVerTodas((v) => !v)}>
              {verTodas ? 'Ver menos' : `Ver todos (${disposicion.ocultas} más)`}
            </Button>
          )}
        </>
      )}
      {suprimidas > 0 && cruce && <NotaSupresion umbral={cruce.umbral} suprimidas={suprimidas} />}
    </section>
  );
}
