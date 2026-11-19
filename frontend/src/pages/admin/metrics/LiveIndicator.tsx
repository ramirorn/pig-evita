// ===========================================
// LiveIndicator — "en vivo, actualizado hace 4 s"
// ===========================================
import { useEffect, useState } from 'react';
import { INTERVALO_VERSION_MS } from '@/hooks/useMetrics';

interface LiveIndicatorProps {
  /** `dataUpdatedAt` de la consulta de versión (ms); 0 = todavía no. */
  actualizadoEn: number;
  /** La consulta de versión falló: se avisa en vez de fingir que está en vivo. */
  error: boolean;
}

function hace(segundos: number): string {
  if (segundos < 5) return 'recién';
  if (segundos < 60) return `hace ${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  return `hace ${minutos} min`;
}

export function LiveIndicator({ actualizadoEn, error }: LiveIndicatorProps) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const segundos = actualizadoEn ? Math.max(0, Math.round((ahora - actualizadoEn) / 1000)) : null;
  // Más de tres intervalos sin novedades del servidor: ya no es "en vivo".
  const atrasado = segundos !== null && segundos * 1000 > INTERVALO_VERSION_MS * 3;

  return (
    <p
      className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white px-3 py-1 text-xs font-semibold text-primary-700"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        {!error && !atrasado && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${error || atrasado ? 'bg-warning-500' : 'bg-secondary-500'}`}
        />
      </span>
      {error
        ? 'Sin conexión con el servidor: los datos pueden estar desactualizados'
        : segundos === null
          ? 'Conectando…'
          : `En vivo · actualizado ${hace(segundos)}`}
    </p>
  );
}
