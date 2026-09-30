// ===========================================
// LocalityTable — la alternativa en tabla al mapa
// ===========================================
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { KIND_LABELS, podiumTotal, type LocalityFigures, type LocalityRow } from '@/lib/localityMap';

type Columna = 'name' | 'department' | 'athletes' | 'delegations' | 'disciplines' | 'categories' | 'podiums' | 'wins';

const COLUMNAS: ReadonlyArray<{ key: Columna; label: string; numeric: boolean }> = [
  { key: 'name', label: 'Localidad', numeric: false },
  { key: 'department', label: 'Departamento', numeric: false },
  { key: 'athletes', label: 'Atletas', numeric: true },
  { key: 'delegations', label: 'Delegaciones', numeric: true },
  { key: 'disciplines', label: 'Disciplinas', numeric: true },
  { key: 'categories', label: 'Categorías', numeric: true },
  { key: 'podiums', label: 'Podios', numeric: true },
  { key: 'wins', label: 'Victorias', numeric: true },
];

function numero(f: LocalityFigures, col: Columna): number {
  switch (col) {
    case 'podiums':
      return podiumTotal(f);
    case 'athletes':
    case 'delegations':
    case 'disciplines':
    case 'categories':
    case 'wins':
      return f[col];
    default:
      return 0;
  }
}

interface LocalityTableProps {
  rows: readonly LocalityRow[];
  /** Abre el detalle (y centra el mapa) de una localidad ubicada. */
  onSelect?: (key: string, trigger: Element) => void;
}

/**
 * Los mismos datos del mapa en una tabla ordenable, para quien no puede o no
 * quiere usar el mapa (lector de pantalla, celular chico, impresión).
 */
export function LocalityTable({ rows, onSelect }: LocalityTableProps) {
  const [orden, setOrden] = useState<{ col: Columna; desc: boolean }>({ col: 'athletes', desc: true });

  const ordenadas = useMemo(() => {
    const copia = [...rows];
    copia.sort((a, b) => {
      let cmp: number;
      if (orden.col === 'name') cmp = a.name.localeCompare(b.name, 'es');
      else if (orden.col === 'department') cmp = a.department.localeCompare(b.department, 'es');
      else cmp = numero(a.figures, orden.col) - numero(b.figures, orden.col);
      return (orden.desc ? -cmp : cmp) || a.name.localeCompare(b.name, 'es');
    });
    return copia;
  }, [rows, orden]);

  const ordenarPor = (col: Columna, numeric: boolean) =>
    setOrden((prev) =>
      prev.col === col ? { col, desc: !prev.desc } : { col, desc: numeric },
    );

  return (
    <div className="overflow-x-auto rounded-xl border border-primary-100">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">
          Participación por localidad. Tocá el título de una columna para ordenar.
        </caption>
        <thead className="bg-primary-50 text-left text-xs font-semibold uppercase tracking-wide text-primary-600">
          <tr>
            {COLUMNAS.map((c) => {
              const activa = orden.col === c.key;
              const Icono = !activa ? ArrowUpDown : orden.desc ? ArrowDown : ArrowUp;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={activa ? (orden.desc ? 'descending' : 'ascending') : 'none'}
                  className={c.numeric ? 'px-3 py-2 text-right' : 'px-3 py-2'}
                >
                  <button
                    type="button"
                    onClick={() => ordenarPor(c.key, c.numeric)}
                    className="inline-flex items-center gap-1 rounded uppercase hover:text-primary-800 focus-visible:outline-2 focus-visible:outline-primary-500"
                  >
                    {c.label}
                    <Icono className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-primary-50">
          {ordenadas.map((r) => (
            <tr key={r.key} className="bg-white hover:bg-primary-50/40">
              <th scope="row" className="px-3 py-2 text-left font-medium text-primary-800">
                {r.onMap && onSelect ? (
                  <button
                    type="button"
                    data-locality-id={r.key}
                    onClick={(e) => onSelect(r.key, e.currentTarget)}
                    className="rounded text-left underline decoration-primary-200 underline-offset-2 hover:text-primary-900 hover:decoration-primary-500 focus-visible:outline-2 focus-visible:outline-primary-500"
                    aria-label={`Ver ${r.name} en el mapa`}
                  >
                    {r.name}
                  </button>
                ) : (
                  r.name
                )}
                <span className="block text-xs font-normal text-primary-500">
                  {r.kind ? KIND_LABELS[r.kind] : 'Sin ubicación en el mapa'}
                </span>
              </th>
              <td className="px-3 py-2 text-primary-700">{r.department}</td>
              {COLUMNAS.filter((c) => c.numeric).map((c) => (
                <td key={c.key} className="px-3 py-2 text-right tabular-nums text-primary-800">
                  {numero(r.figures, c.key).toLocaleString('es-AR')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
