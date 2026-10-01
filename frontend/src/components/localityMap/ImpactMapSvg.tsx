// ===========================================
// ImpactMapSvg — mapa de calor fluido de la provincia, con zoom
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
  formatMetric,
  KIND_LABELS,
  metricInfo,
  metricValue,
  PROVINCE_FILL,
  textWidth,
  themeColor,
  placeBubbleLabels,
  type Box,
  type HeatPoint,
  type MapMetric,
  type MappedLocality,
  boxTouchesCircle,
} from '@/lib/localityMap';
import {
  centerOn,
  FOCUS_ZOOM,
  IDENTITY_VIEW,
  inverseScale,
  isVisible,
  lerpView,
  markersOnScreen,
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
import { useHeatImage } from '@/hooks/useHeatImage';

/** Ids únicos por página. */
const RECORTE_ID = 'impacto-recorte-provincia';
const AFUERA_ID = 'impacto-afuera-provincia';

/** Colores de la interfaz del mapa, todos tokens del tema. */
const AZUL_MARINO = themeColor(PROVINCE_FILL);
const LIMITE_DEPTO = themeColor('celeste-700');
const ROTULO_DEPTO = themeColor('celeste-100');
const SIN_DATOS = themeColor('celeste-300');
const TOOLTIP_SUAVE = themeColor('primary-100');

/** Medidas en píxeles de pantalla (se convierten a unidades con `u`). */
const PX = {
  marcador: 2.5,
  zonaDeClic: 12,
  anilloFoco: 8,
  anilloSeleccion: 10,
  sinDatos: 3,
  halo: 3,
  rotuloLocalidad: 13,
  rotuloDepto: 11,
  /** Lo que un rótulo no puede tapar alrededor de un marcador. */
  marcadorParaRotulos: 4,
};

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
  metric: MapMetric;
  /** Localidades con calor, de mayor a menor valor. */
  points: readonly HeatPoint[];
  /** Dibuja también las localidades sin participación (apagado por defecto). */
  showAll: boolean;
  selectedId: string | null;
  onSelect: (id: string, trigger: Element) => void;
  /** Pedido de centrar una localidad (desde el Top 5 o la tabla). */
  centerRequest: { id: string; seq: number } | null;
  /** Un control más, arriba de la pila de zoom (el botón de pantalla completa). */
  extraControl?: ReactNode;
}

type Tooltip = { x: number; y: number; titulo: string; detalle: string };

/**
 * El mapa: la provincia en azul marino y, encima, el **calor** de cada
 * localidad como una mancha difusa (azul → verde azulado → verde → amarillo).
 * Cada localidad brilla según su propio valor: las manchas cercanas no se suman
 * (ver `computeHeatField`).
 *
 * Capas dentro del grupo que hace zoom: fondo de la provincia, imagen del calor
 * (recortada al contorno), límites de departamento y contorno. Afuera, a tamaño
 * fijo en pantalla: marcadores, zonas de clic, anillos y rótulos. El calor se
 * precalcula por métrica (`useHeatImage`): acercar o arrastrar no lo recalcula.
 *
 * Cada localidad con participación es un botón (Tab + Enter/Espacio) con
 * `aria-label` completo y una zona de clic de 24 × 24 px. El mapa en sí es
 * enfocable: + / − / 0 y flechas acercan, alejan, restablecen y desplazan.
 */
export function ImpactMapSvg({
  mapped,
  metric,
  points,
  showAll,
  selectedId,
  onSelect,
  centerRequest,
  extraControl,
}: ImpactMapSvgProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [view, setView] = useState<MapView>(IDENTITY_VIEW);
  const [aviso, setAviso] = useState(false);

  const { width: W, height: H } = GEO_VIEWBOX;
  const sinMovimiento = useMediaQuery('(prefers-reduced-motion: reduce)');
  const urlCalor = useHeatImage(points, W, H);

  const svgRef = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const animRef = useRef<number | null>(null);
  const finRef = useRef<number | null>(null);
  const avisoRef = useRef<number | null>(null);

  // ---------- Vista y transiciones ----------

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
      // al <svg> y ninguna localidad respondería.
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

  // Píxeles de pantalla por unidad del viewBox: los marcadores, anillos y
  // rótulos se miden en píxeles (`u` los pasa a unidades).
  const [pxPorUnidad, setPxPorUnidad] = useState(0.65);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const medir = () => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setPxPorUnidad(Math.min(r.width / W, r.height / H));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(svg);
    return () => obs.disconnect();
  }, [W, H]);
  const u = 1 / pxPorUnidad;
  const tamLocalidad = PX.rotuloLocalidad * u;
  const tamDepto = PX.rotuloDepto * u;

  // Marcadores en pantalla (posición con zoom, tamaño fijo) que caen en la vista.
  const marcadores = useMemo(
    () => markersOnScreen(points, view, PX.marcadorParaRotulos * u).filter((m) => isVisible(m.x, m.y, m.r, W, H)),
    [points, view, u, W, H],
  );

  // Cuántos nombres: Top 5 a 1×, Top 10 desde 2×, todos los que entren desde 4×.
  // La seleccionada va siempre primero (su rótulo se fuerza).
  const idsConNombre = useMemo(() => {
    const orden = marcadores.map((m) => m.id); // ya vienen de mayor a menor valor
    const tope = view.k >= 4 ? orden.length : view.k >= 2 ? 10 : 5;
    const ids = orden.slice(0, tope);
    return selectedId && orden.includes(selectedId)
      ? [selectedId, ...ids.filter((id) => id !== selectedId)]
      : ids;
  }, [marcadores, view.k, selectedId]);

  // Rótulos de departamento: siempre, y se ubican primero. Primera posición
  // candidata visible que no pisa un marcador; si ninguna, la primera visible.
  const rotulosDepto = useMemo(
    () =>
      GEO_DEPARTMENTS.map((d) => {
        const lineas = d.label.lines;
        const w = Math.max(...lineas.map((l) => textWidth(l, tamDepto) * 1.1)) + tamDepto;
        const h = lineas.length * tamDepto * 1.25;
        const caja = (p: { x: number; y: number }): Box => ({ x0: p.x - w / 2, y0: p.y - h / 2, x1: p.x + w / 2, y1: p.y + h / 2 });
        const visibles = d.label.anchors
          .map(([x, y]) => toScreen(view, x, y))
          .filter((p) => p.x - w / 2 >= 0 && p.x + w / 2 <= W && p.y - h / 2 >= 0 && p.y + h / 2 <= H);
        const pos = visibles.find((p) => !marcadores.some((m) => boxTouchesCircle(caja(p), m))) ?? visibles[0] ?? null;
        return { d, pos, caja: pos ? caja(pos) : null };
      }),
    [view, tamDepto, marcadores, W, H],
  );

  // Nombres de localidad: no pisan marcadores, otros nombres ni los rótulos de
  // departamento (que se ubicaron antes).
  const rotulos = useMemo(
    () =>
      placeBubbleLabels(
        marcadores,
        idsConNombre,
        W,
        H,
        tamLocalidad,
        rotulosDepto.flatMap((r) => (r.caja ? [r.caja] : [])),
      ),
    [marcadores, idsConNombre, W, H, tamLocalidad, rotulosDepto],
  );

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
    ? TODAS.filter((t) => !points.some((p) => p.id === t.id))
        .map((t) => ({ ...t, ...toScreen(view, t.x, t.y) }))
        .filter((t) => isVisible(t.x, t.y, PX.sinDatos * u, W, H))
    : [];

  // Anillos: hover o foco (8 px) y selección (10 px), doble trazo blanco +
  // azul marino para verse igual sobre el amarillo y sobre el azul.
  const posicionDe = (id: string) =>
    marcadores.find((m) => m.id === id) ?? puntosSinDatos.find((t) => t.id === id) ?? null;
  const anillos = [
    ...[hovered, focused]
      .filter((id): id is string => id !== null && id !== selectedId)
      .map((id) => ({ id, pos: posicionDe(id), r: PX.anilloFoco * u, fijo: false })),
    ...(selectedId ? [{ id: selectedId, pos: posicionDe(selectedId), r: PX.anilloSeleccion * u, fijo: true }] : []),
  ].filter((a, i, arr) => a.pos && arr.findIndex((b) => b.id === a.id) === i);

  // Tooltip de la localidad con hover o foco (la seleccionada ya tiene su detalle).
  let tooltip: Tooltip | null = null;
  const idTooltip = hovered ?? focused;
  if (idTooltip && idTooltip !== selectedId) {
    const lugar = TODAS.find((t) => t.id === idTooltip);
    const m = mapped.get(idTooltip);
    const valor = m ? metricValue(m.figures, metric) : 0;
    if (lugar) {
      const p = toScreen(view, lugar.x, lugar.y);
      tooltip = {
        x: p.x,
        y: p.y - PX.anilloFoco * u - 6 * u,
        titulo: lugar.name,
        detalle: valor > 0 ? formatMetric(valor, metric) : 'sin participación',
      };
    }
  }

  const inv = inverseScale(view);
  const hayZoom = view.k > MIN_ZOOM + 0.01;
  const halo = {
    stroke: AZUL_MARINO,
    strokeWidth: PX.halo * u,
    strokeLinejoin: 'round' as const,
    paintOrder: 'stroke' as const,
  };

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
        aria-label={`Mapa de calor de ${metricInfo(metric).plural} por localidad; la tabla de más abajo tiene los mismos datos. Con el mapa enfocado: más y menos acercan, cero restablece y las flechas desplazan. Recorré las localidades con Tab y abrí el detalle con Enter.`}
        onKeyDown={alTeclado}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onClickCapture={alClicCaptura}
        onDoubleClick={alDobleClic}
      >
        <defs>
          {/* Recorte estricto: el calor no se pinta fuera de Formosa. */}
          <clipPath id={RECORTE_ID}>
            {GEO_DEPARTMENTS.map((d) => (
              <path key={d.name} d={d.d} />
            ))}
          </clipPath>
          {/* Afuera de la provincia: para dibujar sólo la mitad exterior del
              contorno (los límites internos quedan tapados). */}
          <mask id={AFUERA_ID} maskUnits="userSpaceOnUse" x={-W} y={-H} width={3 * W} height={3 * H}>
            <rect x={-W} y={-H} width={3 * W} height={3 * H} fill="white" />
            {GEO_DEPARTMENTS.map((d) => (
              <path key={d.name} d={d.d} fill="black" />
            ))}
          </mask>
        </defs>

        {/* Capa que escala con el zoom. Los trazos se dividen por el zoom para
            mantener su grosor en pantalla. */}
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`} aria-hidden="true" pointerEvents="none">
          {/* 1. Fondo uniforme de la provincia (= calor 0). */}
          <g style={{ fill: AZUL_MARINO }}>
            {GEO_DEPARTMENTS.map((d) => (
              <path key={d.name} d={d.d} />
            ))}
          </g>

          {/* 2. El calor, precalculado por métrica y recortado al contorno. */}
          {urlCalor && (
            <image
              href={urlCalor}
              x={0}
              y={0}
              width={W}
              height={H}
              preserveAspectRatio="none"
              clipPath={`url(#${RECORTE_ID})`}
            />
          )}

          {/* 3. Límites de departamento, finos y apenas visibles, encima del calor. */}
          <g fill="none" strokeOpacity={0.55} strokeWidth={0.75 * inv} strokeLinejoin="round" style={{ stroke: LIMITE_DEPTO }}>
            {GEO_DEPARTMENTS.map((d) => (
              <path key={d.name} d={d.d} />
            ))}
          </g>

          {/* 4. Contorno de la provincia: sólo la mitad de afuera del trazo. */}
          <g fill="none" strokeWidth={2.5 * inv} strokeLinejoin="round" mask={`url(#${AFUERA_ID})`} style={{ stroke: AZUL_MARINO }}>
            {GEO_DEPARTMENTS.map((d) => (
              <path key={d.name} d={d.d} />
            ))}
          </g>
        </g>

        {/* Rótulos de departamento: claros, en mayúsculas, con halo azul marino. */}
        <g aria-hidden="true" pointerEvents="none">
          {rotulosDepto.map(({ d, pos }) => {
            if (!pos) return null;
            const alto = tamDepto * 1.2;
            const y0 = pos.y - ((d.label.lines.length - 1) * alto) / 2;
            return (
              <text
                key={d.name}
                x={pos.x}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={tamDepto}
                fontWeight={600}
                letterSpacing={tamDepto * 0.06}
                fillOpacity={0.9}
                style={{ fill: ROTULO_DEPTO }}
                {...halo}
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

        {/* Localidades sin participación: anillos huecos, sólo si se pidió. */}
        {showAll && (
          <g>
            {puntosSinDatos.map((t) => (
              <g key={t.id} aria-label={etiqueta(t.id, t.name, t.kind)} {...boton(t.id)}>
                <circle cx={t.x} cy={t.y} r={PX.zonaDeClic * u} fill="transparent" />
                <circle cx={t.x} cy={t.y} r={PX.sinDatos * u} fill="none" strokeWidth={u} style={{ stroke: SIN_DATOS }} />
              </g>
            ))}
          </g>
        )}

        {/* Localidades con participación: marcador discreto + zona de clic de 24 px. */}
        <g>
          {marcadores.map((m) => {
            const kind = mapped.get(m.id)?.feature.feature.kind ?? 'MUNICIPIO';
            return (
              <g key={m.id} aria-label={etiqueta(m.id, m.name, kind)} {...boton(m.id)}>
                <circle cx={m.x} cy={m.y} r={PX.zonaDeClic * u} fill="transparent" />
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={PX.marcador * u}
                  fill="white"
                  fillOpacity={0.9}
                  strokeWidth={u}
                  style={{ stroke: AZUL_MARINO }}
                />
              </g>
            );
          })}
        </g>

        {/* Anillos de hover, foco y selección. */}
        <g aria-hidden="true" pointerEvents="none">
          {anillos.map((a) =>
            a.pos ? (
              <g key={`${a.id}-${a.fijo ? 'sel' : 'foco'}`}>
                <circle cx={a.pos.x} cy={a.pos.y} r={a.r + 2 * u} fill="none" strokeWidth={4 * u} style={{ stroke: AZUL_MARINO }} />
                <circle cx={a.pos.x} cy={a.pos.y} r={a.r - u} fill="none" stroke="white" strokeWidth={2 * u} />
                {/* Pulso único al seleccionar (no con movimiento reducido). */}
                {a.fijo && !sinMovimiento && (
                  <circle cx={a.pos.x} cy={a.pos.y} r={a.r} fill="none" stroke="white" strokeWidth={2 * u}>
                    <animate attributeName="r" from={a.r} to={a.r + 12 * u} dur="0.6s" fill="freeze" />
                    <animate attributeName="stroke-opacity" from="1" to="0" dur="0.6s" fill="freeze" />
                  </circle>
                )}
              </g>
            ) : null,
          )}
        </g>

        {/* Nombres de localidad: blancos con halo, sin cajas. */}
        <g aria-hidden="true" pointerEvents="none">
          {rotulos.map((r) => (
            <RotuloLocalidad key={r.id} texto={r.text} x={r.x} y={r.y} tamano={tamLocalidad} halo={halo} />
          ))}
        </g>

        {tooltip && <MapTooltip {...tooltip} ancho={W} u={u} />}
      </svg>

      {/* Controles: pantalla completa arriba de la pila de zoom. En el celular
          abajo a la izquierda (esquina SO, libre por la diagonal); desde tablet
          arriba a la derecha (esquina NE, libre ahora que la leyenda va abajo). */}
      <div className="absolute bottom-2 left-2 flex flex-row gap-1 md:bottom-auto md:left-auto md:right-2 md:top-2 md:flex-col" role="group" aria-label="Zoom del mapa">
        {extraControl}
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

/**
 * Nombre de una localidad: **blanco con halo azul marino**, sin caja. El halo
 * es obligatorio: blanco sobre el amarillo del calor da 1,26:1; con el halo
 * cada letra queda sobre azul marino (16,35:1) en toda la rampa.
 *
 * `check:map` verifica que use halo y que no use opacidad ni cajas.
 */
function RotuloLocalidad({
  texto,
  x,
  y,
  tamano,
  halo,
}: {
  texto: string;
  x: number;
  y: number;
  tamano: number;
  halo: { stroke: string; strokeWidth: number; strokeLinejoin: 'round'; paintOrder: 'stroke' };
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={tamano}
      fontWeight={600}
      fill="white"
      {...halo}
    >
      {texto}
    </text>
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
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-100 bg-white/90 text-primary-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-default disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11"
    >
      {children}
    </button>
  );
}

/** Tooltip dibujado dentro del SVG, a tamaño fijo en pantalla. */
function MapTooltip({ x, y, titulo, detalle, ancho, u }: Tooltip & { ancho: number; u: number }) {
  const t1 = 14 * u;
  const t2 = 12 * u;
  const w = Math.max(textWidth(titulo, t1), textWidth(detalle, t2)) + 20 * u;
  const h = 44 * u;
  const x0 = Math.min(ancho - w - 4, Math.max(4, x - w / 2));
  const y0 = Math.max(4, y - h);
  return (
    <g aria-hidden="true" pointerEvents="none">
      <rect x={x0} y={y0} width={w} height={h} rx={8 * u} style={{ fill: AZUL_MARINO }} />
      <text x={x0 + 10 * u} y={y0 + 18 * u} fontSize={t1} fontWeight={700} fill="white">
        {titulo}
      </text>
      <text x={x0 + 10 * u} y={y0 + 35 * u} fontSize={t2} style={{ fill: TOOLTIP_SUAVE }}>
        {detalle}
      </text>
    </g>
  );
}

