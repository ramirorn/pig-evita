// ===========================================
// NewsListSkeleton — esqueleto de carga del listado de noticias
// ===========================================

/**
 * Replica la grilla real (destacada arriba + tres tarjetas) para que el salto
 * de skeleton a contenido no mueva el layout.
 */
export function NewsListSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white rounded-2xl border border-primary-100 overflow-hidden shadow-sm">
        <div className="grid md:grid-cols-2 h-80">
          <div className="bg-primary-100 animate-shimmer" />
          <div className="p-8 space-y-4">
            <div className="h-4 w-24 bg-primary-100 rounded animate-shimmer" />
            <div className="h-8 w-4/5 bg-primary-100 rounded animate-shimmer" />
            <div className="h-4 w-full bg-primary-100 rounded animate-shimmer" />
            <div className="h-4 w-2/3 bg-primary-100 rounded animate-shimmer" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-primary-100 overflow-hidden shadow-sm"
          >
            <div className="h-48 bg-primary-100 animate-shimmer" />
            <div className="p-6 space-y-3">
              <div className="h-3 w-20 bg-primary-100 rounded animate-shimmer" />
              <div className="h-5 w-full bg-primary-100 rounded animate-shimmer" />
              <div className="h-4 w-3/4 bg-primary-100 rounded animate-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
