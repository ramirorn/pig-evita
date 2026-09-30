// ===========================================
// ImpactMapSvg — coropleta por departamento + burbujas, con zoom
// ===========================================
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { GEO_AREAS, GEO_DEPARTMENTS, GEO_POINTS, GEO_VIEWBOX } from '@/lib/geo/formosa.generated';
import {
  BUBBLE_LABEL_SIZE,
  BUBBLE_OUTLINE,
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
  type PlacedLabel,
} from '@/lib/localityMap';
import {
  bubblesOnScreen,
  centerOn,
  FOCUS_ZOOM,
  IDENTITY_VIEW,
  inverseScale,
  isVisible,
  lerpView,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  sameView,
  toScreen,
  ZOOM_STEP,
  zoomAt,
  type MapView,
} from '@/lib/mapZoom';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/** Id del patrón de rayado de "sin participación". Único por página. */
const HATCH_ID = 'impacto-sin-participacion';
const SOMBRA_ID = 'impacto-sombra-provincia';
const SOMBRA_ETIQUETA_ID = 'impacto-sombra-etiqueta';

/** Colores de la interfaz del mapa, todos tokens del tema. */
const TINTA = themeColor('primary-900');
const TINTA_SUAVE = themeColor('primary-100');
const PUNTO_SIN_DATOS = themeColor('celeste-400');
const BORDE_ETIQUETA = themeColor('primary-200');
const BORDE_ETIQUETA_ACTIVA = themeColor('primary-300');
const CONTORNO_BURBUJA = themeColor(BUBBLE_OUTLINE);

/** Desplazamiento de las flechas del teclado, en unidades de pantalla. */
const PASO_FLECHA = 80;
const DURACION_MS = 220;

/** Todas las localidades del mapa con su punto, para "Mostrar todas" y centrar. */
const TODAS = [
  ...GEO_AREAS.map((a) => ({ id: a.id, name: a.name, kind: a.kind, x: a.labelX, y: a.labelY })),
  ...GEO_POINTS.map((p) => ({ id: p.id, name: p.name, kind: p.kind, x: p.x, y: p.y })),
].sort((a, b) => a.name.localeCompare(b.name, 'es'));

interface ImpactMapSvgProps {
  mapped: ReadonlyMap<string, MappedLocality>;
  departments: ReadonlyMap<string, LocalityFigures>;
  metric: MapMetric;
  departmentClasses: readonly HeatClass[];
  /** Burbujas en su lugar real (sin separar): la separación se hace en pantalla. */
  bubbles: readonly Bubble[];
  /** Clases de color de las burbujas (amarillo → rojo). */
  bubbleClasses: readonly HeatClass[];
  /** Localidades cuyo nombre se escribe sin zoom (el Top 5). */
  labeledIds: readonly string[];
  /** Dibuja también las localidades sin participación (apagado por defecto). */
  showAll: boolean;
  selectedId: string | null;
  onSelect: (id: string, trigger: Element) => void;
  /** Pedido de centrar una localidad (desde el Top 5 o la tabla). */
  centerRequest: { id: string; seq: number } | null;
}

type Tooltip = { x: number; y: number; titulo: string; detalle: string };

/**
 * El mapa. Dos capas que se leen solas:
 *
 * - **Departamentos** en verde según el total de la métrica: de un vistazo se
 *   ve dónde "hay calor" en la provincia.
 * - **Burbujas** en las localidades con participación: el área es la cantidad
 *   y el color (amarillo → rojo) la concentración. Las localidades en cero no se
 *   dibujan salvo que se pida con "Mostrar todas".
 *
 * **Zoom.** Los departamentos y ejidos viven en un grupo transformado; las
 * burbujas, sus nombres y los rótulos se dibujan afuera, en coordenadas de
 * pantalla, así mantienen su tamaño al acercar: el zoom separa localidades
 * vecinas en vez de agrandarlas. Toda la cuenta está en `@/lib/mapZoom`.
 *
 * Las burbujas son botones (Tab + Enter/Espacio) con `aria-label` completo. El
 * mapa en sí es enfocable: + / − / 0 y flechas acercan, alejan, restablecen y
 * desplazan.
 */
export function ImpactMapSvg({
  mapped,
  departments,
  metric,
  departmentClasses,
  bubbles,
  bubbleClasses,
  labeledIds,
  showAll,
  selectedId,
  onSelect,
  centerRequest,
}: ImpactMapSvgProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [view, setView] = useState<MapView>(IDENTITY_VIEW);
  const [aviso, setAviso] = useState(false);

  const { width: W, height: H } = GEO_VIEWBOX;
  const sinMovimiento = useMediaQuery('(prefers-reduced-motion: reduce)');

  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const animRef = useRef<number | null>(null);
  const avisoRef = useRef<number | null>(null);

  // ---------- Vista y transiciones ----------

  const finRef = useRef<number | null>(null);

  const cortarAnimacion = () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    if (finRef.current !== null) window.clearTimeout(finRef.current);
    finRef.current = null;
  };

  /** Pasa a una vista nueva, con transición salvo movimiento reducido. */
  const irA = useCallback(
    (destino: MapView, animar = true) => {
      cortarAnimacion();
      const desde = viewRef.current;
      if (!animar || sinMovimiento || document.hidden || sameView(desde, destino)) {
        setView(destino);
        return;
      }
      const inicio = performance.now();
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - inicio) / DURACION_MS);
        const suave = 1 - (1 - t) ** 3;
        setView(t >= 1 ? destino : lerpView(desde, destino, suave));
        animRef.current = t >= 1 ? null : requestAnimationFrame(paso);
        if (t >= 1 && finRef.current !== null) {
          window.clearTimeout(finRef.current);
          finRef.current = null;
        }
      };
      animRef.current = requestAnimationFrame(paso);
      // Red de seguridad: si el navegador frena los frames (pestaña en segundo
      // plano, ventana tapada), la vista igual llega a destino.
      finRef.current = window.setTimeout(() => {
        cortarAnimacion();
        setView(destino);
      }, DURACION_MS + 80);
    },
    [sinMovimiento],
  );

  useEffect(() => () => {
    cortarAnimacion();
    if (avisoRef.current !== null) window.clearTimeout(avisoRef.current);
  }, []);

  /** Posición del cliente → coordenadas del viewBox (fuera del grupo transformado). */
  const aSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: W / 2, y: H / 2 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, [W, H]);

  /** Unidades del viewBox por píxel de pantalla. */
  const unidadesPorPx = () => {
    const ctm = svgRef.current?.getScreenCTM();
    return ctm ? 1 / ctm.a : 1;
  };

  const acercar = (factor: number, px = W / 2, py = H / 2, animar = true) =>
    irA(zoomAt(viewRef.current, factor, px, py, W, H), animar);
  const restablecer = () => irA(IDENTITY_VIEW);

  // Centrar una localidad pedida desde el Top 5 o la tabla.
  useEffect(() => {
    if (!centerRequest) return;
    const lugar = TODAS.find((t) => t.id === centerRequest.id);
    if (!lugar) return;
    irA(centerOn(lugar.x, lugar.y, Math.max(viewRef.current.k, FOCUS_ZOOM), W, H));
  }, [centerRequest, irA, W, H]);

  // ---------- Rueda (Ctrl/⌘ + rueda) y pellizco ----------
  //
  // Van con listeners nativos porque React registra `wheel` y `touchmove` como
  // pasivos y acá hace falta `preventDefault`: con Ctrl + rueda el navegador
  // haría zoom de la página entera, y con dos dedos la desplazaría.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const alRodar = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const p = aSvg(e.clientX, e.clientY);
        irA(zoomAt(viewRef.current, Math.exp(-e.deltaY * 0.0025), p.x, p.y, W, H), false);
        return;
      }
      // Rueda sola: la página sigue scrolleando; sólo se avisa cómo acercar.
      setAviso(true);
      if (avisoRef.current !== null) window.clearTimeout(avisoRef.current);
      avisoRef.current = window.setTimeout(() => setAviso(false), 1400);
    };
    const alMoverDedos = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
    };
    svg.addEventListener('wheel', alRodar, { passive: false });
    svg.addEventListener('touchmove', alMoverDedos, { passive: false });
    return () => {
      svg.removeEventListener('wheel', alRodar);
      svg.removeEventListener('touchmove', alMoverDedos);
    };
  }, [aSvg, irA, W, H]);

  // ---------- Arrastre (mouse) y pellizco (dos dedos) ----------

  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const pellizco = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const arrastre = useRef<{ id: number; x: number; y: number; movio: boolean } | null>(null);
  const suprimirClic = useRef(false);

  const datosPellizco = () => {
    const [a, b] = [...dedos.current.values()];
    if (!a || !b) return null;
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mid: aSvg((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
  };

  const alBajar = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.current.size === 2) {
        cortarAnimacion();
        pellizco.current = datosPellizco();
      }
      return;
    }
    if (e.button !== 0 || viewRef.current.k <= MIN_ZOOM) return;
    cortarAnimacion();
    arrastre.current = { id: e.pointerId, x: e.clientX, y: e.clientY, movio: false };
  };

  const alMover = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      if (!dedos.current.has(e.pointerId)) return;
      dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const antes = pellizco.current;
      const ahora = datosPellizco();
      if (!antes || !ahora || antes.dist === 0) return;
      let v = zoomAt(viewRef.current, ahora.dist / antes.dist, ahora.mid.x, ahora.mid.y, W, H);
      v = panBy(v, ahora.mid.x - antes.mid.x, ahora.mid.y - antes.mid.y, W, H);
      setView(v);
      pellizco.current = ahora;
      suprimirClic.current = true;
      return;
    }
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    if (!a.movio && Math.hypot(dx, dy) < 4) return;
    if (!a.movio) {
      a.movio = true;
      // La captura recién ahora: capturar en el pointerdown mandaría el clic
      // al <svg> y ninguna burbuja respondería.
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const u = unidadesPorPx();
    setView(panBy(viewRef.current, dx * u, dy * u, W, H));
    a.x = e.clientX;
    a.y = e.clientY;
  };

  const alSoltar = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      dedos.current.delete(e.pointerId);
      if (dedos.current.size < 2) pellizco.current = null;
      if (dedos.current.size === 0) window.setTimeout(() => (suprimirClic.current = false), 0);
      return;
    }
    const a = arrastre.current;
    if (a?.movio) {
      suprimirClic.current = true;
      window.setTimeout(() => (suprimirClic.current = false), 0);
    }
    arrastre.current = null;
  };

  const alClicCaptura = (e: MouseEvent<SVGSVGElement>) => {
    if (suprimirClic.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const alDobleClic = (e: MouseEvent<SVGSVGElement>) => {
    const p = aSvg(e.clientX, e.clientY);
    acercar(2, p.x, p.y);
  };

  const alTeclado = (e: KeyboardEvent<SVGSVGElement>) => {
    const v = viewRef.current;
    const mover = (dx: number, dy: number) => {
      if (v.k <= MIN_ZOOM) return;
      e.preventDefault();
      irA(panBy(v, dx, dy, W, H));
    };
    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault();
        acercar(ZOOM_STEP);
        break;
      case '-':
      case '_':
        e.preventDefault();
        acercar(1 / ZOOM_STEP);
        break;
      case '0':
        e.preventDefault();
        restablecer();
        break;
      case 'ArrowLeft':
        mover(PASO_FLECHA, 0);
        break;
      case 'ArrowRight':
        mover(-PASO_FLECHA, 0);
        break;
      case 'ArrowUp':
        mover(0, PASO_FLECHA);
        break;
      case 'ArrowDown':
        mover(0, -PASO_FLECHA);
        break;
    }
  };

  // ---------- Geometría en pantalla ----------

  // En pantallas chicas el mapa se dibuja a ~0,35 px por unidad y un nombre de
  // 17 unidades quedaría en 6 px: se agranda hasta un mínimo legible de 12 px
  // en escritorio y 11 px en el celular.
  const [pxPorUnidad, setPxPorUnidad] = useState(0.65);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const medir = () => {
      const ancho = svg.getBoundingClientRect().width;
      if (ancho > 0) setPxPorUnidad(Math.min(ancho / W, svg.getBoundingClientRect().height / H));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(svg);
    return () => obs.disconnect();
  }, [W, H]);
  const minimoPx = pxPorUnidad >= 0.5 ? 12 : 11;
  const tamRotulo = Math.max(BUBBLE_LABEL_SIZE, minimoPx / pxPorUnidad);

  const enPantalla = useMemo(
    () => bubblesOnScreen(bubbles, view).filter((b) => isVisible(b.x, b.y, b.r, W, H)),
    [bubbles, view, W, H],
  );

  // Sin zoom se nombran las del Top 5; con zoom, todas las visibles por orden
  // de importancia: el anti-choque decide cuáles entran.
  const idsConNombre = useMemo(
    () =>
      view.k <= MIN_ZOOM + 0.01
        ? labeledIds
        : [...enPantalla].sort((a, b) => b.value - a.value).map((b) => b.id),
    [view.k, labeledIds, enPantalla],
  );
  const rotulos = useMemo(
    () => placeBubbleLabels(enPantalla, idsConNombre, W, H, tamRotulo),
    [enPantalla, idsConNombre, W, H, tamRotulo],
  );

  // Los rótulos de departamento crecen un poco con el zoom (raíz, con tope) y
  // se ubican en la primera posición candidata visible que no choque.
  const escalaRotulo = Math.min(1.5, Math.sqrt(view.k));
  const rotulosDepto = useMemo(
    () =>
      GEO_DEPARTMENTS.map((d) => {
        const w = d.label.width * escalaRotulo;
        const h = d.label.height * escalaRotulo;
        const candidatos = d.label.anchors
          .map(([x, y]) => toScreen(view, x, y))
          .filter((p) => p.x - w / 2 >= 0 && p.x + w / 2 <= W && p.y - h / 2 >= 0 && p.y + h / 2 <= H)
          .map((p) => [p.x, p.y] as const);
        return { d, pos: pickDepartmentAnchor(candidatos, w, h, enPantalla, rotulos) };
      }),
    [view, escalaRotulo, enPantalla, rotulos, W, H],
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
        e.stopPropagation();
        onSelect(id, e.currentTarget);
      }
    },
  });

  const puntosSinDatos = showAll
    ? TODAS.filter((t) => !bubbles.some((b) => b.id === t.id))
        .map((t) => ({ ...t, ...toScreen(view, t.x, t.y) }))
        .filter((t) => isVisible(t.x, t.y, 4, W, H))
    : [];

  // Resaltado: selección, hover y foco de teclado.
  const activos = new Set([selectedId, hovered, focused].filter((x): x is string => x !== null));
  const anillos = [...activos].flatMap((id) => {
    const b = enPantalla.find((x) => x.id === id);
    if (b) return [{ id, x: b.x, y: b.y, r: b.r }];
    const t = puntosSinDatos.find((x) => x.id === id);
    return t ? [{ id, x: t.x, y: t.y, r: 4 }] : [];
  });

  // Tooltip: localidad con hover o foco (si no es la seleccionada, que ya tiene
  // su detalle); si no, el departamento bajo el mouse.
  let tooltip: Tooltip | null = null;
  const idTooltip = hovered ?? focused;
  if (idTooltip && idTooltip !== selectedId) {
    const lugar = TODAS.find((t) => t.id === idTooltip);
    const b = enPantalla.find((x) => x.id === idTooltip);
    const m = mapped.get(idTooltip);
    const valor = m ? metricValue(m.figures, metric) : 0;
    if (lugar) {
      const p = b ?? toScreen(view, lugar.x, lugar.y);
      tooltip = {
        x: p.x,
        y: p.y - (b?.r ?? 5) - 8,
        titulo: lugar.name,
        detalle: valor > 0 ? formatMetric(valor, metric) : 'sin participación',
      };
    }
  } else if (hoveredDept) {
    const r = rotulosDepto.find((x) => x.d.name === hoveredDept);
    const ancla = r?.d.label.anchors[0];
    const p = r?.pos ?? (ancla ? toScreen(view, ancla[0], ancla[1]) : { x: W / 2, y: H / 2 });
    const valor = valorDepto(hoveredDept);
    tooltip = {
      x: p.x,
      y: p.y - 16,
      titulo: `Departamento ${hoveredDept}`,
      detalle: valor > 0 ? formatMetric(valor, metric) : 'sin participación',
    };
  }

  const inv = inverseScale(view);
  const hayZoom = view.k > MIN_ZOOM + 0.01;

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={
          hayZoom
            ? 'block h-full w-full cursor-grab select-none rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 active:cursor-grabbing'
            : 'block h-full w-full select-none rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500'
        }
        // Un dedo sigue desplazando la página; dos dedos son del mapa.
        style={{ touchAction: 'pan-x pan-y' }}
        tabIndex={0}
        role="group"
        aria-label="Mapa de la provincia de Formosa. Los departamentos están coloreados según su participación y cada círculo es una localidad con atletas. Con el mapa enfocado: más y menos acercan, cero restablece y las flechas desplazan. Recorré las localidades con Tab y abrí el detalle con Enter."
        onKeyDown={alTeclado}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onClickCapture={alClicCaptura}
        onDoubleClick={alDobleClic}
      >
        <defs>
          <pattern id={HATCH_ID} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" style={{ fill: NO_DATA_COLOR }} />
            <line x1="0" y1="0" x2="0" y2="7" strokeWidth="1.5" style={{ stroke: NO_DATA_HATCH }} />
          </pattern>
          <filter id={SOMBRA_ID} x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.16" style={{ floodColor: TINTA }} />
          </filter>
          <filter id={SOMBRA_ETIQUETA_ID} x="-10%" y="-20%" width="120%" height="160%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodOpacity="0.22" style={{ floodColor: TINTA }} />
          </filter>
        </defs>

        {/* Capa que escala con el zoom: departamentos y ejidos. Los trazos se
            dividen por el zoom para mantener su grosor en pantalla. */}
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <g filter={`url(#${SOMBRA_ID})`} aria-hidden="true">
            {GEO_DEPARTMENTS.map((d) => {
              const valor = valorDepto(d.name);
              return (
                <path
                  key={d.name}
                  d={d.d}
                  style={{ fill: valor > 0 ? heatColor(valor, departmentClasses) : `url(#${HATCH_ID})` }}
                  stroke="white"
                  strokeWidth={2 * inv}
                  strokeLinejoin="round"
                  onMouseEnter={() => setHoveredDept(d.name)}
                  onMouseLeave={() => setHoveredDept(null)}
                />
              );
            })}
          </g>

          <g aria-hidden="true" pointerEvents="none" fill="none" strokeOpacity={0.18} strokeWidth={0.8 * inv} style={{ stroke: TINTA }}>
            {GEO_AREAS.map((a) => (
              <path key={a.id} d={a.d} />
            ))}
          </g>
        </g>

        {/* Rótulos de departamento: dentro del polígono, sin pisar burbujas. */}
        <g aria-hidden="true" pointerEvents="none">
          {rotulosDepto.map(({ d, pos }) => {
            if (!pos) return null;
            const tam = d.label.size * escalaRotulo;
            const alto = tam * 1.2;
            const y0 = pos.y - ((d.label.lines.length - 1) * alto) / 2;
            return (
              <text
                key={d.name}
                x={pos.x}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={tam}
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
            {puntosSinDatos.map((t) => (
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

        {/* Burbujas: área = cantidad, color = concentración. Tamaño fijo en pantalla. */}
        <g>
          {enPantalla.map((b) => {
            const m = mapped.get(b.id);
            const kind = m?.feature.feature.kind ?? 'MUNICIPIO';
            return (
              <g key={b.id}>
                {/* Contorno oscuro por fuera del borde blanco: separa el
                    amarillo de los verdes claros. */}
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={b.r + 1.6}
                  fillOpacity={0.45}
                  aria-hidden="true"
                  pointerEvents="none"
                  style={{ fill: CONTORNO_BURBUJA }}
                />
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={b.r}
                  stroke="white"
                  strokeWidth={1.75}
                  style={{ fill: heatColor(b.value, bubbleClasses) }}
                  aria-label={etiqueta(b.id, b.name, kind)}
                  {...boton(b.id)}
                />
              </g>
            );
          })}
        </g>

        {/* Nombres: los del Top 5 sin zoom; con zoom, todos los que entren. */}
        <g aria-hidden="true" pointerEvents="none">
          {rotulos.map((r) => (
            <EtiquetaLocalidad key={r.id} rotulo={r} tamano={tamRotulo} activa={activos.has(r.id)} />
          ))}
        </g>

        {/* Resaltado de la localidad activa. */}
        <g aria-hidden="true" pointerEvents="none">
          {anillos.map((a) => (
            <g key={a.id}>
              <circle cx={a.x} cy={a.y} r={a.r + 4} fill="none" stroke="white" strokeWidth={4} />
              <circle cx={a.x} cy={a.y} r={a.r + 4} fill="none" strokeWidth={2.5} style={{ stroke: TINTA }} />
            </g>
          ))}
        </g>

        {tooltip && <MapTooltip {...tooltip} ancho={W} />}
      </svg>

      {/* Controles de zoom, en una esquina que la diagonal deja libre. */}
      {/* En el celular van abajo a la izquierda (los controles del mapa quedan
          debajo, así que esa esquina está libre); desde tablet, abajo a la derecha. */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1 md:left-auto md:right-2" role="group" aria-label="Zoom del mapa">
        <BotonZoom etiqueta="Acercar" disabled={view.k >= MAX_ZOOM - 0.01} onClick={() => acercar(ZOOM_STEP)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </BotonZoom>
        <BotonZoom etiqueta="Alejar" disabled={!hayZoom} onClick={() => acercar(1 / ZOOM_STEP)}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </BotonZoom>
        <BotonZoom etiqueta="Restablecer vista" disabled={!hayZoom} onClick={restablecer}>
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </BotonZoom>
      </div>

      {/* Aviso de "Ctrl + rueda", como en los mapas conocidos. */}
      {aviso && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-lg bg-primary-900/85 px-3 py-2 text-sm font-medium text-white shadow-lg">
            Usá Ctrl + rueda para acercar
          </p>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {hayZoom ? `Zoom ${view.k.toFixed(1).replace('.', ',')} aumentos` : 'Vista de la provincia entera'}
      </p>
    </>
  );
}

function BotonZoom({
  etiqueta,
  disabled,
  onClick,
  children,
}: {
  etiqueta: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary-100 bg-white/90 text-primary-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * Etiqueta de una localidad: fondo blanco sólido con borde fino, esquinas
 * redondeadas y texto primary-900 en semibold. **Sin opacidades parciales ni
 * halo**: sobre los verdes oscuros el halo blanco se lavaba y el nombre se
 * "transparentaba". Un conector corto la une a su burbuja; si la burbuja está
 * activa (hover, foco o selección) la etiqueta se remarca también.
 *
 * `check:map` verifica que esta función no use opacidad.
 */
function EtiquetaLocalidad({ rotulo, tamano, activa }: { rotulo: PlacedLabel; tamano: number; activa: boolean }) {
  const { box } = rotulo;
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  // El conector va del borde de la burbuja al punto más cercano de la caja.
  const hastaX = Math.max(box.x0, Math.min(rotulo.from.x, box.x1));
  const hastaY = Math.max(box.y0, Math.min(rotulo.from.y, box.y1));
  return (
    <g>
      <line
        x1={rotulo.from.x}
        y1={rotulo.from.y}
        x2={hastaX}
        y2={hastaY}
        strokeWidth={activa ? 2.5 : 1.5}
        style={{ stroke: activa ? TINTA : BORDE_ETIQUETA_ACTIVA }}
      />
      <rect
        x={box.x0}
        y={box.y0}
        width={w}
        height={h}
        rx={h * 0.3}
        fill="white"
        strokeWidth={activa ? 2.5 : 1.25}
        filter={`url(#${SOMBRA_ETIQUETA_ID})`}
        style={{ stroke: activa ? TINTA : BORDE_ETIQUETA }}
      />
      <text
        x={rotulo.x}
        y={rotulo.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={tamano}
        fontWeight={600}
        style={{ fill: TINTA }}
      >
        {rotulo.text}
      </text>
    </g>
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

