// ===========================================
// LocalityImpactMap — mapa de calor de la participación por localidad
// ===========================================
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Map as MapIcon, RotateCcw } from 'lucide-react';
import { GEO_AREAS, GEO_POINTS, GEO_SOURCE, GEO_VIEWBOX } from '@/lib/geo/formosa.generated';
import {
  bubbleLegendValues,
  buildBubbles,
  buildLocalityMap,
  computeHeatClasses,
  departmentTotals,
  localityRows,
  METRIC_OPTIONS,
  metricValue,
  provinceTotals,
  topLocalities,
  type MapMetric,
} from '@/lib/localityMap';
import type { LocalityStats } from '@/schemas/localityStats';
import { cn, formatDateTime } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { ImpactMapSvg } from './ImpactMapSvg';
import { MapLegend } from './MapLegend';
import { LocalityDetailCard } from './LocalityDetailCard';
import { DepartmentRanking, ProvinceTotalsBar, TopLocalities } from './ImpactSummary';
import { LocalityTable } from './LocalityTable';
import { UnmappedLocalities } from './UnmappedLocalities';

interface LocalityImpactMapProps {
  data: LocalityStats | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isRetrying?: boolean;
  /** Título de la página: va en la misma fila que el selector de métrica. */
  header: ReactNode;
  /**
   * Dónde se monta: define cuánto alto se come lo que está arriba del bloque
   * (barra del sitio o del panel, encabezado, KPIs) para que mapa y panel
   * entren enteros en la ventana.
   */
  placement: 'public' | 'admin';
}

/**
 * Alto del bloque mapa + panel en escritorio: la ventana menos lo que queda
 * arriba y un margen abajo. Clases completas, nunca armadas con variables.
 *
 * - público: barra 64 + padding 16 + encabezado 40 + 12 + KPIs 64 + 12 + 12 = 220
 * - panel:   barra 64 + padding 24 + encabezado 40 + 12 + KPIs 64 + 12 + 24 = 240
 */
const ALTO_BLOQUE: Record<LocalityImpactMapProps['placement'], string> = {
  public: 'lg:h-[calc(100dvh-220px)]',
  admin: 'lg:h-[calc(100dvh-240px)]',
};

/** Todo lo dibujable del mapa, por id, para la tarjeta de detalle. */
const LUGARES = new Map(
  [
    ...GEO_AREAS.map((a) => ({ id: a.id, name: a.name, kind: a.kind, department: a.department })),
    ...GEO_POINTS.map((p) => ({ id: p.id, name: p.name, kind: p.kind, department: p.department })),
  ].map((l) => [l.id, l]),
);

/** Proporción del mapa: la tarjeta la copia para que el SVG la llene entera. */
const PROPORCION = `${GEO_VIEWBOX.width} / ${GEO_VIEWBOX.height}`;

/** Mismo corte que `lg:` de Tailwind: desde acá el detalle va en el panel. */
const ESCRITORIO = '(min-width: 1024px)';

/**
 * El mapa de impacto: un solo componente para el sitio público y el panel.
 *
 * No pide datos (regla de `components/`): la página llama a `useLocalityStats`
 * y le pasa el estado de la query. Acá se resuelven los tres estados —cargando,
 * error y sin datos— para que las dos pantallas se comporten igual.
 *
 * Disposición en escritorio: encabezado + selector en una fila, los 4 KPIs a
 * todo el ancho y debajo el mapa y el panel **con el mismo alto**, calculado
 * por la ventana. La provincia es casi tan alta como ancha, así que la tarjeta
 * del mapa toma la proporción del mapa (el SVG la llena) y el panel se queda
 * con el resto del ancho. La leyenda y los controles van dentro del mapa, en
 * las esquinas que la diagonal NO→SE deja vacías.
 */
export function LocalityImpactMap({
  data,
  isLoading,
  isError,
  onRetry,
  isRetrying = false,
  header,
  placement,
}: LocalityImpactMapProps) {
  const [metric, setMetric] = useState<MapMetric>('athletes');
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const esEscritorio = useMediaQuery(ESCRITORIO);

  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const model = useMemo(() => buildLocalityMap(data?.localities ?? []), [data]);
  const rows = useMemo(() => localityRows(model), [model]);
  const totals = useMemo(() => provinceTotals(data?.localities ?? []), [data]);
  const departments = useMemo(() => departmentTotals(model), [model]);

  const departmentClasses = useMemo(
    () => computeHeatClasses([...departments.values()].map((f) => metricValue(f, metric))),
    [departments, metric],
  );
  const bubbles = useMemo(() => buildBubbles(model, metric), [model, metric]);
  const bubbleValues = useMemo(() => bubbleLegendValues(bubbles.map((b) => b.value)), [bubbles]);
  const top = useMemo(() => topLocalities(rows, metric), [rows, metric]);
  const labeledIds = useMemo(() => top.filter((r) => r.onMap).map((r) => r.key), [top]);

  const cerrar = useCallback(() => {
    const id = selected;
    const trigger = triggerRef.current;
    triggerRef.current = null;
    setSelected(null);
    // El foco vuelve a quien abrió el detalle. Si era un botón del Top 5, ese
    // botón se desmontó al abrirse el detalle: se busca el nuevo por su id.
    setTimeout(() => {
      if (trigger instanceof HTMLElement || trigger instanceof SVGElement) {
        if (trigger.isConnected && trigger.getAttribute('tabindex') !== '-1') {
          trigger.focus({ preventScroll: true });
          return;
        }
      }
      if (id) {
        const reemplazo = document.querySelector<HTMLElement>(`button[data-locality-id="${id}"]`);
        reemplazo?.focus({ preventScroll: true });
      }
    });
  }, [selected]);

  const seleccionar = useCallback((id: string, trigger: Element) => {
    triggerRef.current = trigger;
    setSelected(id);
  }, []);

  // Escape y clic afuera cierran el detalle.
  useEffect(() => {
    if (!selected) return;

    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    const alTocar = (e: PointerEvent) => {
      const destino = e.target;
      if (!(destino instanceof Element)) return;
      if (cardRef.current?.contains(destino)) return;
      // Tocar otra localidad cambia el detalle: eso lo resuelve su onClick.
      if (destino.closest('[data-locality-id]')) return;
      setSelected(null);
      triggerRef.current = null;
    };

    document.addEventListener('keydown', alTeclado);
    document.addEventListener('pointerdown', alTocar);
    return () => {
      document.removeEventListener('keydown', alTeclado);
      document.removeEventListener('pointerdown', alTocar);
    };
  }, [selected, cerrar]);

  const alto = ALTO_BLOQUE[placement];
  const hayDatos = !isLoading && !isError && data !== undefined && data.localities.length > 0;

  const selector = (
    <div
      role="group"
      aria-label="Qué muestra el mapa"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:shrink-0 md:overflow-visible md:px-0"
    >
      <div className="flex shrink-0 gap-1 rounded-xl bg-primary-50 p-1">
        {METRIC_OPTIONS.map((m) => (
          <button
            key={m.value}
            type="button"
            aria-pressed={metric === m.value}
            onClick={() => setMetric(m.value)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary-500',
              metric === m.value ? 'bg-white text-primary-800 shadow-sm' : 'text-primary-600 hover:text-primary-800',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );

  const encabezado = (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between lg:h-10">
      <div className="min-w-0">{header}</div>
      {hayDatos && selector}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {encabezado}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-primary-50" />
          ))}
        </div>
        <div className="flex flex-col gap-3 lg:flex-row" aria-busy="true" aria-label="Cargando el mapa">
          <div
            className={cn('w-full animate-pulse rounded-2xl bg-primary-50 lg:w-auto lg:flex-none lg:min-h-[380px]', alto)}
            style={{ aspectRatio: PROPORCION }}
          />
          <div className={cn('h-64 animate-pulse rounded-2xl bg-primary-50 lg:flex-1 lg:min-h-[380px]', alto)} />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-3">
        {encabezado}
        <div className="rounded-2xl border border-primary-100 bg-white">
          <EmptyState
            icon={<AlertTriangle className="h-10 w-10" />}
            title="No pudimos cargar el mapa"
            description="Puede ser un problema de conexión. Probá de nuevo en unos segundos; si sigue sin andar, avisale al equipo técnico."
            action={
              <Button type="button" variant="outline" onClick={onRetry} disabled={isRetrying}>
                <RotateCcw className={cn('h-4 w-4', isRetrying && 'animate-spin')} aria-hidden="true" />
                Reintentar
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (data.localities.length === 0) {
    return (
      <div className="space-y-3">
        {encabezado}
        <div className="rounded-2xl border border-primary-100 bg-white">
          <EmptyState
            icon={<MapIcon className="h-10 w-10" />}
            title="Todavía no hay inscripciones"
            description="Cuando se registren las primeras inscripciones, vas a ver acá cuántos atletas aporta cada localidad de la provincia."
          />
        </div>
      </div>
    );
  }

  const seleccionado = selected ? LUGARES.get(selected) : undefined;
  const seleccionadoDatos = selected ? model.mapped.get(selected) : undefined;
  const actualizado = formatDateTime(data.generatedAt);

  const detalle = seleccionado ? (
    <LocalityDetailCard
      name={seleccionado.name}
      kind={seleccionado.kind}
      department={seleccionado.department}
      figures={seleccionadoDatos?.figures ?? null}
      sourceNames={seleccionadoDatos?.sourceNames ?? []}
      variant={esEscritorio ? 'panel' : 'sheet'}
      onClose={cerrar}
      cardRef={cardRef}
    />
  ) : null;

  const controles = (
    <>
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-primary-600">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
          className="h-4 w-4 cursor-pointer rounded border-primary-300 accent-primary-700"
        />
        Mostrar localidades sin participación
      </label>
      <p className="text-[11px] leading-tight text-primary-400">
        Fuente: {GEO_SOURCE} (CC BY 4.0).
        {/* Fecha ausente o inválida: se omite la frase, no se muestra "—". */}
        {actualizado !== '—' && ` Datos al ${actualizado.replace(/\.$/, '')}.`}
      </p>
    </>
  );

  return (
    <div className="space-y-3">
      {encabezado}

      <ProvinceTotalsBar totals={totals} />

      <div className="flex flex-col gap-3 lg:flex-row">
        <section
          aria-label="Mapa de participación"
          className={cn(
            'relative w-full rounded-2xl border border-primary-100 bg-white p-2 shadow-sm lg:w-auto lg:flex-none lg:min-h-[380px]',
            alto,
          )}
          style={{ aspectRatio: PROPORCION }}
        >
          <ImpactMapSvg
            mapped={model.mapped}
            departments={departments}
            metric={metric}
            departmentClasses={departmentClasses}
            bubbles={bubbles}
            labeledIds={labeledIds}
            showAll={showAll}
            selectedId={selected}
            onSelect={seleccionar}
          />

          {/* Esquina NE, vacía por la diagonal de la provincia: la leyenda. */}
          <MapLegend
            classes={departmentClasses}
            metric={metric}
            bubbleValues={bubbleValues}
            layout="overlay"
            className="absolute right-2 top-2 hidden md:block"
          />

          {/* Esquina SO, también vacía: controles y fuente. */}
          <div className="absolute bottom-2 left-3 hidden max-w-[45%] flex-col items-start gap-1 md:flex">
            {controles}
          </div>
        </section>

        {/* En el celular la leyenda y los controles van debajo del mapa. */}
        <div className="space-y-2 md:hidden">
          <MapLegend classes={departmentClasses} metric={metric} bubbleValues={bubbleValues} layout="row" />
          <div className="flex flex-col gap-1 px-1">{controles}</div>
        </div>

        <aside
          aria-label="Ranking y detalle"
          className={cn(
            '@container rounded-2xl border border-primary-100 bg-white p-4 shadow-sm lg:min-h-[380px] lg:min-w-0 lg:flex-1 lg:overflow-y-auto',
            alto,
          )}
        >
          {detalle && esEscritorio ? (
            detalle
          ) : (
            <div className="grid gap-6 @xl:grid-cols-2">
              <TopLocalities rows={top} metric={metric} onSelect={seleccionar} />
              <DepartmentRanking departments={departments} metric={metric} classes={departmentClasses} />
            </div>
          )}
        </aside>
      </div>

      {/* En el celular el detalle es una hoja inferior, fuera del panel. */}
      {detalle && !esEscritorio && detalle}

      <UnmappedLocalities localities={model.unmapped} />

      <details className="group rounded-2xl border border-primary-100 bg-white p-4 shadow-sm sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-primary-700 hover:text-primary-900 focus-visible:outline-2 focus-visible:outline-primary-500">
          Ver los datos en una tabla
        </summary>
        <div className="mt-4">
          <LocalityTable rows={rows} />
        </div>
      </details>
    </div>
  );
}
