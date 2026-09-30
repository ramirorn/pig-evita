// ===========================================
// ImpactMapSvg — coropleta por departamento + burbujas por localidad
// ===========================================
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { GEO_AREAS, GEO_DEPARTMENTS, GEO_POINTS, GEO_VIEWBOX } from '@/lib/geo/formosa.generated';
import {
  BUBBLE_COLOR,
  BUBBLE_LABEL_SIZE,
  formatMetric,
  heatColor,
  heatLabelColor,
  KIND_LABELS,
  metricValue,
  NO_DATA_COLOR,
  NO_DATA_HATCH,
  themeColor,
  pickDepartmentAnchor,
  placeBubbleLabels,
  textWidth,
  type Bubble,
  type HeatClass,
  type LocalityFigures,
  type MapMetric,
  type MappedLocality,
} from '@/lib/localityMap';

/** Id del patrón de rayado de "sin participación". Único por página. */
const HATCH_ID = 'impacto-sin-participacion';
const SOMBRA_ID = 'impacto-sombra-provincia';
const SOMBRA_BURBUJA_ID = 'impacto-sombra-burbuja';

/** Colores de la interfaz del mapa, todos tokens del tema. */
const TINTA = themeColor('primary-900');
const TINTA_SUAVE = themeColor('primary-100');
const PUNTO_SIN_DATOS = themeColor('celeste-400');

/** Todas las localidades del mapa con su punto, para "Mostrar todas". */
const TODAS = [
  ...GEO_AREAS.map((a) => ({ id: a.id, name: a.name, kind: a.kind, x: a.labelX, y: a.labelY })),
  ...GEO_POINTS.map((p) => ({ id: p.id, name: p.name, kind: p.kind, x: p.x, y: p.y })),
].sort((a, b) => a.name.localeCompare(b.name, 'es'));

interface ImpactMapSvgProps {
  mapped: ReadonlyMap<string, MappedLocality>;
  departments: ReadonlyMap<string, LocalityFigures>;
  metric: MapMetric;
  departmentClasses: readonly HeatClass[];
  bubbles: readonly Bubble[];
  /** Localidades que llevan el nombre escrito junto a la burbuja (el Top 5). */
  labeledIds: readonly string[];
  /** Dibuja también las localidades sin participación (apagado por defecto). */
  showAll: boolean;
  selectedId: string | null;
  onSelect: (id: string, trigger: Element) => void;
}

type Tooltip = { x: number; y: number; titulo: string; detalle: string };

/**
 * El mapa. Dos capas que se leen solas:
 *
 * - **Departamentos** coloreados por el total de la métrica: de un vistazo se
 *   ve dónde "hay calor" en la provincia.
 * - **Burbujas** en las localidades con participación, con área proporcional
 *   al valor. Las localidades en cero no se dibujan (salvo que se pida con
 *   "Mostrar todas"): un punto gris no informa y ensucia.
 *
 * Las burbujas son botones (Tab + Enter/Espacio) con `aria-label` completo.
 * Los departamentos sólo responden al mouse con un tooltip: su dato está
 * también en la tabla y no hace falta sumar nueve paradas de foco.
 */
export function ImpactMapSvg({
  mapped,
  departments,
  metric,
  departmentClasses,
  bubbles,
  labeledIds,
  showAll,
  selectedId,
  onSelect,
}: ImpactMapSvgProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);

  const { width: W, height: H } = GEO_VIEWBOX;

  const rotulos = useMemo(() => placeBubbleLabels(bubbles, labeledIds, W, H), [bubbles, labeledIds, W, H]);

  const rotulosDepto = useMemo(
    () =>
      GEO_DEPARTMENTS.map((d) => ({
        d,
        pos: pickDepartmentAnchor(d.label.anchors, d.label.width, d.label.height, bubbles, rotulos),
      })),
    [bubbles, rotulos],
  );

  const valorDepto = (nombre: string) => {
    const f = departments.get(nombre);
    return f ? metricValue(f, metric) : 0;
  };

  const etiqueta = (id: string, nombre: string, tipo: keyof typeof KIND_LABELS) => {
    const m = mapped.get(id);
    const valor = m ? metricValue(m.figures, metric) : 0;
    const texto = valor > 0 ? formatMetric(valor, metric) : 'sin participación registrada';
    return `${nombre}, ${KIND_LABELS[tipo].toLowerCase()}: ${texto}`;
  };

  const boton = (id: string) => ({
    role: 'button' as const,
    tabIndex: 0,
    'data-locality-id': id,
    className: 'cursor-pointer outline-none',
    onClick: (e: MouseEvent<SVGElement>) => onSelect(id, e.currentTarget),
    onMouseEnter: () => setHovered(id),
    onMouseLeave: () => setHovered(null),
    onFocus: () => setFocused(id),
    onBlur: () => setFocused(null),
    onKeyDown: (e: KeyboardEvent<SVGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(id, e.currentTarget);
      }
    },
  });

  // Resaltado: selección, hover y foco de teclado.
  const activos = new Set([selectedId, hovered, focused].filter((x): x is string => x !== null));
  const anillos = [...activos].flatMap((id) => {
    const b = bubbles.find((x) => x.id === id);
    if (b) return [{ id, x: b.x, y: b.y, r: b.r }];
    const t = showAll ? TODAS.find((x) => x.id === id) : undefined;
    return t ? [{ id, x: t.x, y: t.y, r: 5 }] : [];
  });

  // Tooltip: localidad con hover o foco (si no es la seleccionada, que ya tiene
  // su tarjeta); si no, el departamento bajo el mouse.
  let tooltip: Tooltip | null = null;
  const idTooltip = hovered ?? focused;
  if (idTooltip && idTooltip !== selectedId) {
    const lugar = TODAS.find((t) => t.id === idTooltip);
    const b = bubbles.find((x) => x.id === idTooltip);
    const m = mapped.get(idTooltip);
    const valor = m ? metricValue(m.figures, metric) : 0;
    if (lugar) {
      tooltip = {
        x: b?.x ?? lugar.x,
        y: (b?.y ?? lugar.y) - (b?.r ?? 5) - 8,
        titulo: lugar.name,
        detalle: valor > 0 ? formatMetric(valor, metric) : 'sin participación',
      };
    }
  } else if (hoveredDept) {
    const r = rotulosDepto.find((x) => x.d.name === hoveredDept);
    const [ax, ay] = r?.pos ? [r.pos.x, r.pos.y] : (r?.d.label.anchors[0] ?? [W / 2, H / 2]);
    const valor = valorDepto(hoveredDept);
    tooltip = {
      x: ax,
      y: ay - 16,
      titulo: `Departamento ${hoveredDept}`,
      detalle: valor > 0 ? formatMetric(valor, metric) : 'sin participación',
    };
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-full w-full select-none"
      overflow="visible"
      role="group"
      aria-label="Mapa de la provincia de Formosa. Cada departamento está coloreado según su participación y cada círculo es una localidad con atletas. Recorré las localidades con Tab y abrí el detalle con Enter."
    >
      <defs>
        <pattern id={HATCH_ID} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" style={{ fill: NO_DATA_COLOR }} />
          <line x1="0" y1="0" x2="0" y2="7" strokeWidth="1.5" style={{ stroke: NO_DATA_HATCH }} />
        </pattern>
        <filter id={SOMBRA_ID} x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.16" style={{ floodColor: TINTA }} />
        </filter>
        <filter id={SOMBRA_BURBUJA_ID} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.25" style={{ floodColor: TINTA }} />
        </filter>
      </defs>

      {/* Capa base: departamentos coloreados por el total de la métrica. */}
      <g filter={`url(#${SOMBRA_ID})`} aria-hidden="true">
        {GEO_DEPARTMENTS.map((d) => {
          const valor = valorDepto(d.name);
          return (
            <path
              key={d.name}
              d={d.d}
              style={{ fill: valor > 0 ? heatColor(valor, departmentClasses) : `url(#${HATCH_ID})` }}
              stroke="white"
              strokeWidth={2}
              strokeLinejoin="round"
              onMouseEnter={() => setHoveredDept(d.name)}
              onMouseLeave={() => setHoveredDept(null)}
            />
          );
        })}
      </g>

      {/* Ejidos: contorno sutil, sólo de contexto. */}
      <g aria-hidden="true" pointerEvents="none" fill="none" strokeOpacity={0.18} strokeWidth={0.8} style={{ stroke: TINTA }}>
        {GEO_AREAS.map((a) => (
          <path key={a.id} d={a.d} />
        ))}
      </g>

      {/* Rótulos de departamento: dentro del polígono, sin pisar burbujas. */}
      <g aria-hidden="true" pointerEvents="none">
        {rotulosDepto.map(({ d, pos }) => {
          if (!pos) return null;
          const alto = d.label.size * 1.2;
          const y0 = pos.y - ((d.label.lines.length - 1) * alto) / 2;
          return (
            <text
              key={d.name}
              x={pos.x}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={d.label.size}
              fontWeight={600}
              letterSpacing={1.5}
              // Color con contraste AA garantizado para el tono del fondo.
              style={{ fill: heatLabelColor(valorDepto(d.name), departmentClasses) }}
            >
              {d.label.lines.map((linea, i) => (
                <tspan key={linea} x={pos.x} y={y0 + i * alto}>
                  {linea}
                </tspan>
              ))}
            </text>
          );
        })}
      </g>

      {/* Localidades sin participación: sólo si se pidió "Mostrar todas". */}
      {showAll && (
        <g>
          {TODAS.filter((t) => !bubbles.some((b) => b.id === t.id)).map((t) => (
            <circle
              key={t.id}
              cx={t.x}
              cy={t.y}
              r={3.5}
              stroke="white"
              strokeWidth={1.2}
              style={{ fill: PUNTO_SIN_DATOS }}
              aria-label={etiqueta(t.id, t.name, t.kind)}
              {...boton(t.id)}
            />
          ))}
        </g>
      )}

      {/* Burbujas: área proporcional al valor. */}
      <g>
        {bubbles.map((b) => {
          const m = mapped.get(b.id);
          const kind = m?.feature.feature.kind ?? 'MUNICIPIO';
          return (
            <circle
              key={b.id}
              cx={b.x}
              cy={b.y}
              r={b.r}
              stroke="white"
              strokeWidth={1.75}
              filter={`url(#${SOMBRA_BURBUJA_ID})`}
              style={{ fill: BUBBLE_COLOR }}
              aria-label={etiqueta(b.id, b.name, kind)}
              {...boton(b.id)}
            />
          );
        })}
      </g>

      {/* Nombres de las principales, sin encimarse (greedy en localityMap). */}
      <g aria-hidden="true" pointerEvents="none">
        {rotulos.map((r) => (
          <text
            key={r.id}
            x={r.x}
            y={r.y}
            textAnchor={r.anchor}
            dominantBaseline="central"
            fontSize={BUBBLE_LABEL_SIZE}
            fontWeight={500}
            stroke="white"
            strokeWidth={3.5}
            style={{ fill: TINTA }}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {r.text}
          </text>
        ))}
      </g>

      {/* Resaltado de la localidad activa. */}
      <g aria-hidden="true" pointerEvents="none">
        {anillos.map((a) => (
          <g key={a.id}>
            <circle cx={a.x} cy={a.y} r={a.r + 3} fill="none" stroke="white" strokeWidth={4} />
            <circle cx={a.x} cy={a.y} r={a.r + 3} fill="none" strokeWidth={2.5} style={{ stroke: TINTA }} />
          </g>
        ))}
      </g>

      {tooltip && <MapTooltip {...tooltip} ancho={W} />}
    </svg>
  );
}

/** Tooltip dibujado dentro del SVG, así escala y se posiciona con el mapa. */
function MapTooltip({ x, y, titulo, detalle, ancho }: Tooltip & { ancho: number }) {
  const w = Math.max(textWidth(titulo, 22), textWidth(detalle, 19)) + 32;
  const h = 66;
  const x0 = Math.min(ancho - w - 4, Math.max(4, x - w / 2));
  const y0 = Math.max(4, y - h);
  return (
    <g aria-hidden="true" pointerEvents="none">
      <rect x={x0} y={y0} width={w} height={h} rx={10} fillOpacity={0.95} style={{ fill: TINTA }} />
      <text x={x0 + 16} y={y0 + 27} fontSize={22} fontWeight={700} fill="white">
        {titulo}
      </text>
      <text x={x0 + 16} y={y0 + 52} fontSize={19} style={{ fill: TINTA_SUAVE }}>
        {detalle}
      </text>
    </g>
  );
}

