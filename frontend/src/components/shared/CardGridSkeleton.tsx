// ===========================================
// CardGridSkeleton — placeholders con la forma de una grilla de tarjetas
// ===========================================
import { columnasSegunVolumen } from '@/lib/gridVolumen';

interface CardGridSkeletonProps {
  /** Cuántos placeholders pintar. Define también el reparto de columnas. */
  cantidad?: number;
  /** Alto aproximado de la tarjeta real, en clases de Tailwind (literal). */
  alto?: string;
}

/**
 * Reemplaza al `Loader2` centrado que tenían las cuatro páginas públicas.
 *
 * Un spinner solo colapsa el alto del listado a unos 80 píxeles y, cuando llega
 * la respuesta, el contenido empuja todo hacia abajo: eso es CLS, y se nota
 * sobre todo en el celular. Un esqueleto con **la forma del contenido** reserva
 * el espacio, así que el paso de carga a datos no mueve nada. Es la misma
 * intención que ya documenta `NewsListSkeleton`, generalizada para las grillas.
 *
 * El reparto de columnas sale de `columnasSegunVolumen`, el mismo que usa la
 * grilla real, para que el esqueleto no prometa un layout distinto del que va a
 * aparecer.
 */
export function CardGridSkeleton({ cantidad = 6, alto = 'h-56' }: CardGridSkeletonProps) {
  return (
    <div className={columnasSegunVolumen(cantidad)}>
      {Array.from({ length: cantidad }, (_, i) => (
        <div
          key={i}
          className={`${alto} rounded-xl border border-primary-100 bg-white p-6 shadow-sm`}
        >
          <div className="h-12 w-12 rounded-full bg-primary-100 animate-shimmer" />
          <div className="mt-4 h-5 w-3/4 rounded bg-primary-100 animate-shimmer" />
          <div className="mt-3 h-4 w-1/2 rounded bg-primary-100 animate-shimmer" />
          <div className="mt-6 h-4 w-2/3 rounded bg-primary-100 animate-shimmer" />
        </div>
      ))}
    </div>
  );
}
