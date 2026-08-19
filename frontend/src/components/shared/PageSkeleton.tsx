// ===========================================
// PageSkeleton — placeholder mientras carga una página lazy
// ===========================================

/**
 * Fallback del `<Suspense>` que envuelve las rutas admin.
 *
 * Las páginas admin se cargan bajo demanda (`React.lazy`), así que entre el
 * click y el render hay una descarga de JS. Este esqueleto imita la estructura
 * típica de una pantalla admin —encabezado, tarjetas, tabla— para que el salto
 * de layout sea mínimo cuando llega el contenido real.
 */
export function PageSkeleton() {
  return (
    <div
      className="space-y-6 animate-pulse"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Cargando la sección…</span>

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-100" />
          <div className="space-y-2">
            <div className="h-4 w-44 rounded bg-primary-100" />
            <div className="h-3 w-64 rounded bg-primary-50" />
          </div>
        </div>
        <div className="h-9 w-32 rounded-xl bg-primary-100" />
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-6 space-y-3">
            <div className="h-3 w-24 rounded bg-primary-50" />
            <div className="h-6 w-16 rounded bg-primary-100" />
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="card p-6 space-y-3">
        <div className="h-3 w-full rounded bg-primary-100" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-3 w-full rounded bg-primary-50" />
        ))}
      </div>
    </div>
  );
}
