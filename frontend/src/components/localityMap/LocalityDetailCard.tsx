// ===========================================
// LocalityDetailCard — detalle de una localidad
// ===========================================
import { useEffect, useId, useRef, type RefObject } from 'react';
import { ArrowLeft, Medal, Trophy, X } from 'lucide-react';
import type { GeoKind } from '@/lib/geo/geoTypes';
import { KIND_LABELS, podiumTotal, type LocalityFigures } from '@/lib/localityMap';
import { cn } from '@/lib/utils';

interface LocalityDetailCardProps {
  name: string;
  kind: GeoKind;
  department: string;
  /** `null` si la localidad no tiene participación registrada. */
  figures: LocalityFigures | null;
  /** Cómo vino escrita en las inscripciones, si difiere del nombre oficial. */
  sourceNames: readonly string[];
  /**
   * `panel`: en la columna derecha (escritorio), reemplaza al Top 5 y se cierra
   * con "Volver". `sheet`: hoja inferior fija (celular).
   */
  variant: 'panel' | 'sheet';
  /** Texto del botón de cierre del panel (en pantalla completa no hay Top 5). */
  closeText?: string;
  onClose: () => void;
  cardRef: RefObject<HTMLDivElement | null>;
}

/** Colores fijos de cada puesto: clases completas, nunca interpoladas. */
const PUESTOS = [
  { key: 'first', label: '1.º puesto', icon: 'text-amber-500' },
  { key: 'second', label: '2.º puesto', icon: 'text-slate-400' },
  { key: 'third', label: '3.º puesto', icon: 'text-orange-700' },
] as const;

/**
 * No es modal: el mapa sigue usable (tocar otra burbuja cambia el detalle). Se
 * cierra con Escape, con el botón o tocando fuera — eso lo maneja el
 * contenedor, que es quien sabe qué es "fuera".
 */
export function LocalityDetailCard({
  name,
  kind,
  department,
  figures,
  sourceNames,
  variant,
  closeText = 'Volver al Top 5',
  onClose,
  cardRef,
}: LocalityDetailCardProps) {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const tituloId = useId();

  // El foco pasa a la tarjeta al abrirla (o al cambiar de localidad), para que
  // quien navega con teclado o lector escuche el detalle de inmediato.
  useEffect(() => {
    cerrarRef.current?.focus({ preventScroll: true });
  }, [name]);

  const otrosNombres = [...new Set(sourceNames.filter((n) => n !== name))];
  const sinPodios = figures !== null && podiumTotal(figures) === 0 && figures.wins === 0;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={tituloId}
      className={cn(
        'bg-white animate-fade-in',
        variant === 'sheet'
          ? 'fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-primary-100 p-5 shadow-2xl'
          : '',
      )}
    >
      {variant === 'sheet' && (
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-primary-100" />
      )}

      {variant === 'panel' && (
        <button
          ref={cerrarRef}
          type="button"
          onClick={onClose}
          className="-ml-1 mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm font-medium text-primary-600 hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-primary-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {closeText}
        </button>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={tituloId} className="text-lg font-bold leading-tight text-primary-800">
            {name}
          </h2>
          <p className="mt-0.5 text-sm text-primary-500">
            {KIND_LABELS[kind]} · Departamento {department}
          </p>
        </div>
        {variant === 'sheet' && (
          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-primary-500 transition-colors hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-primary-500"
            aria-label={`Cerrar el detalle de ${name}`}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {figures ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-2">
            {[
              { label: 'Atletas', valor: figures.athletes },
              { label: 'Delegaciones', valor: figures.delegations },
              { label: 'Disciplinas', valor: figures.disciplines },
              { label: 'Categorías', valor: figures.categories },
            ].map((c) => (
              <div key={c.label} className="rounded-xl bg-primary-50 px-3 py-2">
                <dt className="text-xs font-medium text-primary-500">{c.label}</dt>
                <dd className="text-xl font-bold text-primary-800">{c.valor.toLocaleString('es-AR')}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-4 text-sm font-semibold text-primary-800">Posiciones obtenidas</h3>
          {sinPodios ? (
            <p className="mt-1.5 text-sm text-primary-500">Sin podios ni victorias todavía.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {PUESTOS.map((p) => {
                const n = figures.podiums[p.key];
                return (
                  <li key={p.key} className={cn('flex items-center justify-between', n === 0 && 'opacity-45')}>
                    <span className="flex items-center gap-2 text-primary-700">
                      <Medal className={cn('h-4 w-4', p.icon)} aria-hidden="true" />
                      {p.label}
                    </span>
                    <span className="font-semibold text-primary-800">{n}</span>
                  </li>
                );
              })}
              <li
                className={cn(
                  'flex items-center justify-between border-t border-primary-100 pt-1.5',
                  figures.wins === 0 && 'opacity-45',
                )}
              >
                <span className="flex items-center gap-2 text-primary-700">
                  <Trophy className="h-4 w-4 text-secondary-500" aria-hidden="true" />
                  Victorias
                </span>
                <span className="font-semibold text-primary-800">{figures.wins}</span>
              </li>
            </ul>
          )}

          {otrosNombres.length > 0 && (
            <p className="mt-3 text-xs text-primary-500">
              En las inscripciones figura como: {otrosNombres.join(', ')}.
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm text-primary-600">
          Todavía no hay atletas inscriptos de esta localidad.
        </p>
      )}
    </div>
  );
}
