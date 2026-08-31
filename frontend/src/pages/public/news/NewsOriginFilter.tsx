// ===========================================
// NewsOriginFilter — chips de filtro por origen de la noticia
// ===========================================

/** `undefined` = sin filtrar. */
export type OrigenDeNoticia = undefined | true | false;

interface Opcion {
  label: string;
  valor: OrigenDeNoticia;
}

/**
 * Las tres opciones reales.
 *
 * ⚠️ El diseño original proponía filtros temáticos —"Oficial", "Sedes",
 * "Resultados", "Disciplinas"—, pero **el modelo `News` no tiene categorías**:
 * no hay campo que las respalde ni forma de asignarlas. Unos chips así no
 * filtrarían nada, o peor, filtrarían por una heurística sobre el título.
 *
 * Lo que sí existe desde S19 es el **origen**: hay noticias propias de la
 * plataforma y noticias que vienen del portal oficial y enlazan afuera. Ésa es
 * la distinción que el usuario percibe —una la lee acá y la otra lo saca del
 * sitio— y la única que los datos sostienen.
 *
 * El día que el modelo tenga categorías, este componente es el lugar donde se
 * agregan.
 */
const OPCIONES: Opcion[] = [
  { label: 'Todas', valor: undefined },
  { label: 'De la plataforma', valor: false },
  { label: 'Del portal oficial', valor: true },
];

interface NewsOriginFilterProps {
  valor: OrigenDeNoticia;
  onChange: (valor: OrigenDeNoticia) => void;
}

export function NewsOriginFilter({ valor, onChange }: NewsOriginFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filtrar noticias por origen"
      className="mb-8 flex flex-wrap gap-2"
    >
      {OPCIONES.map((opcion) => {
        const activo = opcion.valor === valor;
        return (
          <button
            key={opcion.label}
            type="button"
            // `aria-pressed` y no sólo el color: quien navega con lector de
            // pantalla tiene que saber cuál está aplicado.
            aria-pressed={activo}
            onClick={() => onChange(opcion.valor)}
            className={
              activo
                ? 'rounded-full bg-primary-800 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors'
                : 'rounded-full border border-primary-200 bg-white px-5 py-2 text-sm font-semibold text-primary-600 shadow-sm transition-colors hover:bg-primary-50'
            }
          >
            {opcion.label}
          </button>
        );
      })}
    </div>
  );
}
