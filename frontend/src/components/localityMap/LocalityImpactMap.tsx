// ===========================================
// LocalityImpactMap — mapa de calor de la participación por localidad
// ===========================================
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { AlertTriangle, Map as MapIcon, Maximize, Minimize, RotateCcw } from 'lucide-react';
import { GEO_AREAS, GEO_POINTS, GEO_SOURCE } from '@/lib/geo/formosa.generated';
import {
  buildHeatPoints,
  buildLocalityMap,
  departmentTotals,
  localityRows,
  METRIC_OPTIONS,
  provinceTotals,
  topLocalities,
  type MapMetric,
} from '@/lib/localityMap';
import { escapeAction, nextFocusIndex } from '@/lib/fullscreenMode';
import { useFullscreen } from '@/hooks/useFullscreen';
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

/**
 * Proporciones (clases completas). El área del mapa usa la del viewBox
 * (1000 × 1017) en celular y tablet; en escritorio la tarjeta entera usa la del
 * viewBox más el pie con la leyenda (≈ 1000 × 1110), para que el SVG llene su
 * área. `check:map` verifica que sigan coincidiendo con `GEO_VIEWBOX`.
 */
const AREA_MAPA_PROPORCION = 'aspect-[1000/1017]';
const TARJETA_PROPORCION_LG = 'lg:aspect-[1000/1110]';

/** Lo que se puede enfocar dentro de la pantalla completa (foco atrapado). */
const ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const mapaRef = useRef<HTMLElement>(null);
  const salirRef = useRef<HTMLButtonElement>(null);
  const pantallaCompletaRef = useRef<HTMLButtonElement>(null);
  const pantalla = useFullscreen(mapaRef);
  const triggerRef = useRef<Element | null>(null);

  const model = useMemo(() => buildLocalityMap(data?.localities ?? []), [data]);
  const rows = useMemo(() => localityRows(model), [model]);
  const totals = useMemo(() => provinceTotals(data?.localities ?? []), [data]);
  const departments = useMemo(() => departmentTotals(model), [model]);

  // Las localidades que generan calor en la métrica elegida (memo: el calor se
  // recalcula sólo si cambian la métrica o los datos, nunca con el zoom).
  const points = useMemo(() => buildHeatPoints(model, metric), [model, metric]);
  const hayCeros = GEO_AREAS.length + GEO_POINTS.length > points.length;
  const [centerRequest, setCenterRequest] = useState<{ id: string; seq: number } | null>(null);
  const top = useMemo(() => topLocalities(rows, metric), [rows, metric]);

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

  /** Desde el Top 5 o la tabla: además de abrir el detalle, centra el mapa en ella. */
  const seleccionarYCentrar = useCallback((id: string, trigger: Element) => {
    triggerRef.current = trigger;
    setSelected(id);
    setCenterRequest((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }));
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

  // Pantalla completa: el foco entra al botón "Salir" y vuelve al de pantalla
  // completa al salir.
  const estabaActivo = useRef(false);
  useEffect(() => {
    if (pantalla.activo && !estabaActivo.current) salirRef.current?.focus({ preventScroll: true });
    if (!pantalla.activo && estabaActivo.current) pantallaCompletaRef.current?.focus({ preventScroll: true });
    estabaActivo.current = pantalla.activo;
  }, [pantalla.activo]);

  // Escape en la capa (en modo nativo lo maneja el navegador). Con un detalle
  // abierto, Escape cierra el detalle y la pantalla completa sigue.
  const { modo: modoPantalla, salir: salirDePantalla } = pantalla;
  useEffect(() => {
    if (modoPantalla !== 'overlay') return;
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escapeAction('overlay', selected !== null) === 'exit') void salirDePantalla();
    };
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, [modoPantalla, salirDePantalla, selected]);

  /** Foco atrapado: Tab y Shift+Tab ciclan dentro de la pantalla completa. */
  const atraparFoco = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (!pantalla.activo || e.key !== 'Tab' || !mapaRef.current) return;
    const enfocables = Array.from(mapaRef.current.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
      (el) => el.getClientRects().length > 0,
    );
    const actual = document.activeElement instanceof HTMLElement || document.activeElement instanceof SVGElement
      ? enfocables.indexOf(document.activeElement as HTMLElement)
      : -1;
    const siguiente = nextFocusIndex(enfocables.length, actual, e.shiftKey);
    if (siguiente < 0) return;
    e.preventDefault();
    enfocables[siguiente]?.focus();
  };

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
            className={cn(
              'w-full animate-pulse rounded-2xl bg-primary-50 lg:w-auto lg:flex-none lg:min-h-[380px]',
              AREA_MAPA_PROPORCION,
              TARJETA_PROPORCION_LG,
              alto,
            )}
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
      closeText={pantalla.activo ? 'Cerrar el detalle' : undefined}
      onClose={cerrar}
      cardRef={cardRef}
    />
  ) : null;

  const botonPantallaCompleta = (
    <button
      ref={pantallaCompletaRef}
      type="button"
      aria-pressed={pantalla.activo}
      aria-label={pantalla.activo ? 'Salir de pantalla completa' : 'Ver mapa en pantalla completa'}
      title={pantalla.activo ? 'Salir de pantalla completa' : 'Ver mapa en pantalla completa'}
      onClick={() => void (pantalla.activo ? pantalla.salir() : pantalla.entrar())}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-100 bg-white/90 text-primary-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-500 pointer-coarse:h-11 pointer-coarse:w-11"
    >
      {pantalla.activo ? <Minimize className="h-4 w-4" aria-hidden="true" /> : <Maximize className="h-4 w-4" aria-hidden="true" />}
    </button>
  );

  const pie = (
    <div
      className={
        pantalla.activo
          ? 'flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-primary-100 bg-white px-3 py-2 lg:min-h-12 lg:px-4'
          : 'flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 pt-2'
      }
    >
      <MapLegend metric={metric} points={points} hasZeros={hayCeros} compact={pantalla.activo && !esEscritorio} />
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
    </div>
  );

  return (
    <div className="space-y-3">
      {encabezado}

      <ProvinceTotalsBar totals={totals} />

      <div className="flex flex-col gap-3 lg:flex-row">
        {/* El módulo del mapa. En pantalla completa es este mismo elemento (así
            el zoom se conserva): nativo con la Fullscreen API o capa fija. */}
        <section
          ref={mapaRef}
          aria-label={pantalla.activo ? 'Mapa de participación en pantalla completa' : 'Mapa de participación'}
          onKeyDown={atraparFoco}
          className={cn(
            pantalla.activo
              ? 'fixed inset-0 z-[60] flex h-dvh flex-col bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]'
              : cn(
                  'relative flex w-full flex-col rounded-2xl border border-primary-100 bg-white p-2 shadow-sm lg:w-auto lg:flex-none lg:min-h-[380px]',
                  TARJETA_PROPORCION_LG,
                  alto,
                ),
          )}
        >
          {pantalla.activo && (
            <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-primary-100 bg-white px-3 lg:h-14 lg:px-4">
              <p className="hidden shrink-0 font-display text-base font-bold text-primary-800 lg:block">Mapa de impacto</p>
              <div className="min-w-0 flex-1">{selector}</div>
              <button
                ref={salirRef}
                type="button"
                onClick={() => void pantalla.salir()}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 text-sm font-semibold text-primary-800 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-500 lg:h-9"
              >
                <Minimize className="h-4 w-4" aria-hidden="true" />
                Salir
              </button>
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            <div
              className={cn(
                'relative min-w-0 flex-1',
                pantalla.activo ? 'min-h-0 p-2' : cn('w-full lg:aspect-auto lg:min-h-0', AREA_MAPA_PROPORCION),
              )}
            >
              <ImpactMapSvg
                mapped={model.mapped}
                metric={metric}
                points={points}
                centerRequest={centerRequest}
                showAll={showAll}
                selectedId={selected}
                onSelect={seleccionar}
                extraControl={botonPantallaCompleta}
              />
            </div>
            {/* Escritorio en pantalla completa: el detalle achica el mapa, no lo tapa. */}
            {pantalla.activo && esEscritorio && detalle && (
              <div className="w-[340px] shrink-0 overflow-y-auto border-l border-primary-100 bg-white p-4">{detalle}</div>
            )}
          </div>

          {pie}

          {/* Celular en pantalla completa: el detalle es una hoja inferior. */}
          {pantalla.activo && !esEscritorio && detalle}
        </section>

        <aside
          aria-label="Ranking y detalle"
          className={cn(
            '@container rounded-2xl border border-primary-100 bg-white p-4 shadow-sm lg:min-h-[380px] lg:min-w-0 lg:flex-1 lg:overflow-y-auto',
            alto,
          )}
        >
          {detalle && esEscritorio && !pantalla.activo ? (
            detalle
          ) : (
            <div className="grid gap-6 @xl:grid-cols-2">
              <TopLocalities rows={top} metric={metric} onSelect={seleccionarYCentrar} />
              <DepartmentRanking departments={departments} metric={metric} />
            </div>
          )}
        </aside>
      </div>

      {/* En el celular el detalle es una hoja inferior, fuera del panel. */}
      {detalle && !esEscritorio && !pantalla.activo && detalle}

      <UnmappedLocalities localities={model.unmapped} />

      <details className="group rounded-2xl border border-primary-100 bg-white p-4 shadow-sm sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-primary-700 hover:text-primary-900 focus-visible:outline-2 focus-visible:outline-primary-500">
          Ver los datos en una tabla
        </summary>
        <div className="mt-4">
          <LocalityTable
            rows={rows}
            onSelect={(id, trigger) => {
              seleccionarYCentrar(id, trigger);
              // La tabla está debajo: se sube al mapa para ver dónde quedó.
              mapaRef.current?.scrollIntoView({ block: 'nearest' });
            }}
          />
        </div>
      </details>
    </div>
  );
}
