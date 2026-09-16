// ===========================================
// SurveyFlowPanel — quiénes contestaron (S20)
// ===========================================
//
// El otro tablero: no *qué* contestaron sino *quiénes*. Sirve para la pregunta
// de cobertura —¿la encuesta llegó a la etapa zonal o sólo a la provincial?,
// ¿qué disciplinas predominan en cada localidad?— que es la que decide dónde
// hay que insistir con el QR.
//
// Cada fila es un `CorteEncuesta` y **cualquiera puede venir suprimida**, celda
// por celda. Acá es donde más importa: "Ramón Lista, handball, zonal: 2" ya es
// casi un nombre propio.

import type { ReactNode } from 'react';
import { Loader2, MapPin, Trophy, Waypoints } from 'lucide-react';

import { STAGE_LABELS, SURVEY_WINDOW_LABELS } from '@/lib/constants';
import { DisciplineType, type CorteEncuesta, type SurveyFlowResult } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConteoCorte, NotaSupresion } from './SupresionKAnonimato';

const TIPO_DISCIPLINA: Record<DisciplineType, string> = {
  [DisciplineType.INDIVIDUAL]: 'Individual',
  [DisciplineType.EQUIPO]: 'De equipo',
};

/** El dato ausente se omite, no se rellena — pero tampoco se deja en blanco. */
const SIN_DATO = 'Sin informar';

interface SurveyFlowPanelProps {
  flow?: SurveyFlowResult;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function SurveyFlowPanel({ flow, isLoading, isError, onRetry }: SurveyFlowPanelProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-primary-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        Cargando la participación...
      </div>
    );
  }

  if (isError || !flow) {
    return (
      <div className="rounded-xl border border-destructive-200 bg-destructive-50 px-4 py-6 text-center">
        <p className="text-sm font-semibold text-destructive-700">
          No pudimos traer la participación.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-sm font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-900"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (flow.totalRespuestas === 0) {
    return (
      <EmptyState
        icon={<Waypoints className="h-10 w-10" />}
        title="Todavía no contestó nadie"
        description="Cuando lleguen las primeras respuestas vas a poder ver de qué etapas, disciplinas y localidades vinieron."
      />
    );
  }

  const suprimidas = (filas: { suprimido: boolean }[]) =>
    filas.filter((f) => f.suprimido).length;

  return (
    <div className="space-y-6">
      <Bloque
        icono={<Waypoints className="h-4 w-4 text-primary-500" aria-hidden="true" />}
        titulo="Por etapa y momento"
        descripcion="Con cuánta gente llegó la encuesta a cada instancia de la competencia."
        umbral={flow.umbral}
        suprimidas={suprimidas(flow.porEtapaVentana)}
        columnas={['Etapa', 'Momento', 'Respuestas']}
        filas={flow.porEtapaVentana.map((fila, i) => ({
          clave: `${fila.etapa}-${fila.ventana}-${i}`,
          celdas: [STAGE_LABELS[fila.etapa], SURVEY_WINDOW_LABELS[fila.ventana]],
          corte: fila,
        }))}
      />

      <Bloque
        icono={<Trophy className="h-4 w-4 text-primary-500" aria-hidden="true" />}
        titulo="Por disciplina"
        descripcion="Qué deportes están respondiendo más."
        umbral={flow.umbral}
        suprimidas={suprimidas(flow.porDisciplina)}
        columnas={['Disciplina', 'Tipo', 'Respuestas']}
        filas={flow.porDisciplina.map((fila, i) => ({
          clave: `${fila.disciplineId ?? 'sin'}-${i}`,
          celdas: [fila.disciplina ?? SIN_DATO, TIPO_DISCIPLINA[fila.disciplineType]],
          corte: fila,
        }))}
      />

      <Bloque
        icono={<MapPin className="h-4 w-4 text-primary-500" aria-hidden="true" />}
        titulo="Por localidad y disciplina"
        descripcion="Qué deportes predominan en cada lugar. Es el cruce más fino, y por eso el que más filas trae sin publicar."
        umbral={flow.umbral}
        suprimidas={suprimidas(flow.porDisciplinaYLocalidad)}
        columnas={['Localidad', 'Disciplina', 'Respuestas']}
        filas={flow.porDisciplinaYLocalidad.map((fila, i) => ({
          clave: `${fila.localityId ?? 'sin'}-${fila.disciplineId ?? 'sin'}-${i}`,
          celdas: [fila.localidad ?? SIN_DATO, fila.disciplina ?? SIN_DATO],
          corte: fila,
        }))}
      />
    </div>
  );
}

interface FilaCorte {
  clave: string;
  /** La primera identifica la fila y se renderiza como `<th scope="row">`. */
  celdas: string[];
  corte: CorteEncuesta;
}

/**
 * Una tabla de cortes.
 *
 * Las filas suprimidas **se muestran igual**: si se escondieran, las localidades
 * chicas —las que más interesa mirar— desaparecerían del tablero sin que nada
 * lo indique. Lo que no se publica es el número, no la existencia de la fila.
 */
function Bloque({
  icono,
  titulo,
  descripcion,
  columnas,
  filas,
  umbral,
  suprimidas,
}: {
  icono: ReactNode;
  titulo: string;
  descripcion: string;
  columnas: string[];
  filas: FilaCorte[];
  umbral: number;
  suprimidas: number;
}) {
  return (
    <section className="rounded-xl border border-primary-100 bg-white p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary-900">
        {icono}
        {titulo}
      </h3>
      <p className="mt-0.5 text-xs text-primary-500">{descripcion}</p>

      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-primary-600">Sin datos para este corte.</p>
      ) : (
        // Las tablas anchas scrollean dentro de su propio contenedor: el cuerpo
        // de la página nunca scrollea en horizontal.
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary-100 text-left">
                {columnas.map((columna, i) => (
                  <th
                    key={columna}
                    scope="col"
                    className={
                      i === columnas.length - 1
                        ? 'px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-primary-600'
                        : 'px-2 py-2 text-xs font-semibold uppercase tracking-wider text-primary-600'
                    }
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.clave} className="border-b border-primary-50 last:border-0">
                  {fila.celdas.map((celda, i) =>
                    i === 0 ? (
                      <th
                        key={`${fila.clave}-0`}
                        scope="row"
                        className="px-2 py-2 text-left font-medium text-primary-900"
                      >
                        {celda}
                      </th>
                    ) : (
                      <td key={`${fila.clave}-${i}`} className="px-2 py-2 text-primary-800">
                        {celda}
                      </td>
                    ),
                  )}
                  <td className="px-2 py-2 text-right">
                    <ConteoCorte corte={fila.corte} umbral={umbral} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NotaSupresion umbral={umbral} suprimidas={suprimidas} />
    </section>
  );
}
