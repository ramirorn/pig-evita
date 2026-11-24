// ===========================================
// PublicPageFallback — placeholder mientras carga una página pública lazy
// ===========================================

/**
 * Fallback del `<Suspense>` que envuelve las rutas públicas (R28).
 *
 * Las nueve páginas públicas tienen layouts distintos entre sí, así que no se
 * imita ninguna en particular: se muestra un esqueleto neutro (título, línea
 * descriptiva y una grilla de tarjetas) con una altura mínima de viewport. Esa
 * altura es lo que importa: reserva el espacio y evita que el footer suba y baje
 * mientras llega el chunk. El pulso sólo corre si el usuario no pidió reducir el movimiento.
 */
export function PublicPageFallback() {
  return (
    <div
      className="min-h-[100dvh] motion-safe:animate-pulse"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Cargando la página…</span>

      <div
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
        aria-hidden="true"
      >
        <div className="mb-8 space-y-3">
          <div className="h-9 w-2/3 max-w-sm rounded-lg bg-primary-100" />
          <div className="h-4 w-full max-w-xl rounded bg-primary-50" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card space-y-3 p-5">
              <div className="h-32 w-full rounded-lg bg-primary-50" />
              <div className="h-4 w-3/4 rounded bg-primary-100" />
              <div className="h-3 w-full rounded bg-primary-50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
