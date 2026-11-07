// ===========================================
// NewsListSkeleton — esqueleto de carga de /noticias
// ===========================================

/**
 * Replica la forma real para que el salto de esqueleto a contenido no mueva el
 * layout: la portada (tira + carrusel con panel) o la grilla de resultados.
 */
export function NewsListSkeleton({ variante = 'portada' }: { variante?: 'portada' | 'grilla' }) {
  if (variante === 'grilla') {
    return (
      <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-primary-100 bg-surface-elevated">
            <div className="aspect-video animate-pulse bg-primary-100" />
            <div className="space-y-3 p-5">
              <div className="h-3 w-20 animate-pulse rounded bg-primary-100" />
              <div className="h-5 w-full animate-pulse rounded bg-primary-100" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-primary-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[4.5rem] w-72 shrink-0 animate-pulse rounded-xl bg-primary-100 lg:w-auto lg:flex-1"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-0">
        <div className="h-[30rem] animate-pulse rounded-2xl bg-primary-100 lg:col-span-8 lg:h-[28rem] lg:rounded-r-none" />
        <div className="h-80 animate-pulse rounded-2xl bg-primary-200 lg:col-span-4 lg:h-[28rem] lg:rounded-l-none" />
      </div>
    </div>
  );
}
