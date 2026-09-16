// ===========================================
// SurveyMetricsPanel — qué contestaron (S20)
// ===========================================
import { useMemo, useState } from 'react';
import { BarChart3, Loader2, RotateCcw, Users } from 'lucide-react';

import { useSurveyMetrics } from '@/hooks/useSurvey';
import { useAllDisciplines } from '@/hooks/useDisciplines';
import {
  STAGE_LABELS,
  SURVEY_AUDIENCE_LABELS,
  SURVEY_QUESTION_KIND_LABELS,
  SURVEY_WINDOW_LABELS,
} from '@/lib/constants';
import {
  CompetitionStage,
  DisciplineType,
  SurveyWindow,
  type SurveyFlowResult,
  type SurveyQuestionMetric,
} from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CorteSuprimidoEntero, NotaSupresion } from './SupresionKAnonimato';

/** "Sin filtrar". Radix Select no admite `''` como valor de ítem. */
const TODOS = 'todos';

interface SurveyMetricsPanelProps {
  campaignId: string;
  /**
   * El flujo ya está pedido por la pantalla y trae los nombres de las
   * localidades que **efectivamente respondieron**. Se reusa para armar el
   * selector de localidad: no existe un `GET /localities` en el proyecto, y un
   * campo de texto libre produciría "Formosa", "formosa" y "Fsa" como tres
   * cortes distintos. Como efecto lateral bueno, el selector sólo ofrece
   * localidades que tienen datos, en vez de una lista de 180 sin respuestas.
   */
  flow?: SurveyFlowResult;
}

export function SurveyMetricsPanel({ campaignId, flow }: SurveyMetricsPanelProps) {
  const [etapa, setEtapa] = useState<string>(TODOS);
  const [ventana, setVentana] = useState<string>(TODOS);
  const [disciplineId, setDisciplineId] = useState<string>(TODOS);
  const [disciplineType, setDisciplineType] = useState<string>(TODOS);
  const [localityId, setLocalityId] = useState<string>(TODOS);

  const { data: disciplinas } = useAllDisciplines({ isActive: true });

  const filtros = {
    etapa: etapa === TODOS ? undefined : (etapa as CompetitionStage),
    ventana: ventana === TODOS ? undefined : (ventana as SurveyWindow),
    disciplineId: disciplineId === TODOS ? undefined : disciplineId,
    disciplineType:
      disciplineType === TODOS ? undefined : (disciplineType as DisciplineType),
    localityId: localityId === TODOS ? undefined : localityId,
  };

  const hayFiltros = Object.values(filtros).some((v) => v !== undefined);

  // Sin filtros se pide `undefined` y no un objeto con las cinco claves en
  // `undefined`: son dos `queryKey` distintas para la misma respuesta, y la
  // pantalla ya pide las métricas sin filtrar para el editor. Así las dos
  // comparten entrada de cache y el backend recibe una sola request.
  const { data, isLoading, isError, refetch } = useSurveyMetrics(
    campaignId,
    hayFiltros ? filtros : undefined,
  );

  /** Localidades con respuestas, sin repetir y ordenadas alfabéticamente. */
  const localidades = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const fila of flow?.porDisciplinaYLocalidad ?? []) {
      if (fila.localityId && fila.localidad) vistas.set(fila.localityId, fila.localidad);
    }
    return [...vistas.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [flow]);

  const limpiar = () => {
    setEtapa(TODOS);
    setVentana(TODOS);
    setDisciplineId(TODOS);
    setDisciplineType(TODOS);
    setLocalityId(TODOS);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={etapa} onValueChange={setEtapa}>
          <SelectTrigger className="w-[170px]" aria-label="Filtrar los resultados por etapa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las etapas</SelectItem>
            {Object.values(CompetitionStage).map((v) => (
              <SelectItem key={v} value={v}>
                {STAGE_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ventana} onValueChange={setVentana}>
          <SelectTrigger className="w-[190px]" aria-label="Filtrar los resultados por momento">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>En cualquier momento</SelectItem>
            {Object.values(SurveyWindow).map((v) => (
              <SelectItem key={v} value={v}>
                {SURVEY_WINDOW_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={disciplineId} onValueChange={setDisciplineId}>
          <SelectTrigger className="w-[200px]" aria-label="Filtrar los resultados por disciplina">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las disciplinas</SelectItem>
            {(disciplinas ?? []).map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={disciplineType} onValueChange={setDisciplineType}>
          <SelectTrigger className="w-[190px]" aria-label="Filtrar por tipo de disciplina">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Individuales y de equipo</SelectItem>
            <SelectItem value={DisciplineType.INDIVIDUAL}>Deportes individuales</SelectItem>
            <SelectItem value={DisciplineType.EQUIPO}>Deportes de equipo</SelectItem>
          </SelectContent>
        </Select>

        {/* Sin respuestas todavía no hay ninguna localidad que ofrecer: el
            filtro directamente no se pinta en vez de aparecer vacío. */}
        {localidades.length > 0 && (
          <Select value={localityId} onValueChange={setLocalityId}>
            <SelectTrigger className="w-[190px]" aria-label="Filtrar los resultados por localidad">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas las localidades</SelectItem>
              {localidades.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hayFiltros && (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={limpiar}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Ver todo
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-primary-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          Cargando los resultados...
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-destructive-200 bg-destructive-50 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-destructive-700">
            No pudimos traer los resultados.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {data && !isLoading && !isError && (
        <>
          <p className="flex items-center gap-2 rounded-xl border border-primary-100 bg-white px-4 py-3 text-sm text-primary-800">
            <Users className="h-4 w-4 text-primary-500" aria-hidden="true" />
            <strong className="font-bold tabular-nums">
              {data.totalRespuestas.toLocaleString('es-AR')}
            </strong>
            {data.totalRespuestas === 1 ? 'respuesta' : 'respuestas'}
            {hayFiltros ? ' en este recorte' : ' en total'}.
          </p>

          {/* Tres estados distintos, y hay que distinguirlos: nadie contestó
              todavía / contestaron pero son muy pocos para publicar el detalle
              / hay resultados. Pintar los dos primeros igual sería mentir sobre
              uno de los dos. */}
          {data.totalRespuestas === 0 ? (
            <EmptyState
              icon={<BarChart3 className="h-10 w-10" />}
              title={hayFiltros ? 'Nadie contestó con estos filtros' : 'Todavía no contestó nadie'}
              description={
                hayFiltros
                  ? 'Probá sacar algún filtro para mirar un grupo más grande.'
                  : 'Cuando lleguen las primeras respuestas, los resultados aparecen acá.'
              }
            />
          ) : data.suprimido ? (
            <CorteSuprimidoEntero
              umbral={data.umbral}
              totalRespuestas={data.totalRespuestas}
              hayFiltros={hayFiltros}
            />
          ) : (
            <>
              <ul className="space-y-4">
                {[...data.preguntas]
                  .sort((a, b) => a.orden - b.orden)
                  .map((pregunta) => (
                    <PreguntaMetrica key={pregunta.questionId} pregunta={pregunta} />
                  ))}
              </ul>
              <NotaSupresion umbral={data.umbral} />
            </>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Los resultados de una pregunta, en barras de CSS puro.
 *
 * No se usa `recharts` a propósito, y no es sólo por peso: acá hay una barra
 * horizontal por opción con su etiqueta y su porcentaje, que es exactamente lo
 * que un `<div>` con un ancho hace bien, seleccionable y legible por un lector
 * de pantalla. El único archivo del proyecto que importa `recharts` sigue
 * siendo el donut del dashboard (ver `InscriptionsStatusDonut`).
 */
function PreguntaMetrica({ pregunta }: { pregunta: SurveyQuestionMetric }) {
  return (
    <li className="rounded-xl border border-primary-100 bg-white p-4">
      <p className="font-semibold text-primary-900">{pregunta.texto}</p>
      <p className="mt-0.5 text-xs text-primary-500">
        {pregunta.totalRespuestas === 1
          ? '1 chico la contestó'
          : `${pregunta.totalRespuestas.toLocaleString('es-AR')} la contestaron`}{' '}
        · {SURVEY_QUESTION_KIND_LABELS[pregunta.kind]} ·{' '}
        {SURVEY_AUDIENCE_LABELS[pregunta.audiencia]}
        {!pregunta.activa && ' · Ya no se muestra en el cuestionario'}
      </p>

      <ul className="mt-3 space-y-2">
        {[...pregunta.opciones]
          .sort((a, b) => a.orden - b.orden)
          .map((opcion) => (
            <li key={opcion.optionId}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-primary-800">{opcion.texto}</span>
                <span className="shrink-0 font-semibold text-primary-900 tabular-nums">
                  {opcion.porcentaje.toLocaleString('es-AR')}%
                  <span className="ml-1.5 text-xs font-medium text-primary-500">
                    ({opcion.conteo.toLocaleString('es-AR')})
                  </span>
                </span>
              </div>
              {/*
                El ancho va como estilo en línea y no como clase: un
                `w-[${porcentaje}%]` no existiría para Tailwind en tiempo de
                build y la barra saldría sin ancho (es el bug D1).
              */}
              <div
                className="mt-1 h-2 w-full overflow-hidden rounded-full bg-primary-100"
                role="img"
                aria-label={`${opcion.texto}: ${opcion.porcentaje}% (${opcion.conteo})`}
              >
                <div
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${Math.min(opcion.porcentaje, 100)}%` }}
                />
              </div>
            </li>
          ))}
      </ul>
    </li>
  );
}
