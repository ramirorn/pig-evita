// ===========================================
// PublicPageFallback — placeholder mientras carga una página pública lazy
// ===========================================
import { Loader2 } from 'lucide-react';

/**
 * Fallback del `<Suspense>` que envuelve las rutas públicas (R28).
 *
 * A diferencia del `PageSkeleton` del admin, acá no se imita ninguna
 * estructura: las nueve páginas públicas tienen layouts muy distintos entre sí
 * (hero + grilla, timeline, artículo largo), así que un esqueleto genérico
 * mentiría sobre lo que está por aparecer. Un spinner centrado con altura
 * mínima reserva el alto del viewport y evita que el footer suba y baje.
 */
export function PublicPageFallback() {
  return (
    <div
      className="min-h-[60vh] flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Cargando la página…</span>
      <Loader2 className="w-10 h-10 animate-spin text-primary-500" aria-hidden="true" />
    </div>
  );
}
