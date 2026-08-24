// ===========================================
// ErrorScreen — pantallas de error y de 404 con la identidad del sitio
// ===========================================
import { AlertTriangle, Compass, Home, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';

type ErrorScreenVariant = 'error' | 'not-found';

interface ErrorScreenProps {
  variant?: ErrorScreenVariant;
  title?: string;
  description?: string;
  /**
   * `true` cuando la pantalla reemplaza a la aplicación entera (boundary de
   * raíz): ocupa el alto completo y pinta su propio fondo. `false` cuando vive
   * dentro de un layout que ya trae header y footer (el 404 público).
   */
  fullScreen?: boolean;
  className?: string;
}

const TEXTOS: Record<ErrorScreenVariant, { title: string; description: string }> = {
  error: {
    title: 'Algo salió mal',
    description:
      'No pudimos mostrar esta pantalla. Suele resolverse recargando la página: puede que haya una versión nueva del sitio publicada mientras la tenías abierta.',
  },
  'not-found': {
    title: 'Página no encontrada',
    description:
      'La dirección que abriste no existe o dejó de estar disponible. Revisá el enlace o volvé al inicio para seguir navegando.',
  },
};

/**
 * Pantalla de salida para los dos finales feos de la navegación: un error de
 * render (o un chunk que no se pudo descargar) y una URL inexistente.
 *
 * Nunca muestra el error técnico. El detalle va a `logError`, que sólo escribe
 * en consola durante el desarrollo; acá el usuario ve un mensaje sin jerga y las
 * dos salidas que sirven: **recargar** —lo que efectivamente arregla un chunk
 * faltante tras un despliegue— e **ir al inicio**.
 *
 * Las dos salidas son `<a>` y no `<Link>` a propósito: esta pantalla se
 * renderiza también desde el boundary que envuelve al `RouterProvider`, donde no
 * hay contexto de router. Además, después de un crash conviene una navegación
 * completa: vuelve a pedir el `index.html` y con él la versión nueva de los
 * assets.
 */
export function ErrorScreen({
  variant = 'error',
  title,
  description,
  fullScreen = true,
  className,
}: ErrorScreenProps) {
  const textos = TEXTOS[variant];
  const esNotFound = variant === 'not-found';

  return (
    <div
      className={cn(
        'flex items-center justify-center px-4 py-16',
        fullScreen ? 'min-h-screen bg-surface' : 'min-h-[60vh]',
        className,
      )}
      role="alert"
    >
      <div className="card p-8 sm:p-10 max-w-lg w-full text-center animate-fade-in">
        <img
          src="/logo-sinfondo.png"
          alt="Juegos Evita Formoseños"
          width={64}
          height={64}
          className="h-16 w-16 mx-auto mb-6 object-contain"
        />

        <div className="relative w-20 h-20 mx-auto mb-6">
          <div
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center',
              esNotFound ? 'bg-primary-50 text-primary-400' : 'bg-destructive-50 text-destructive-500',
            )}
          >
            {esNotFound ? <Compass className="w-10 h-10" /> : <AlertTriangle className="w-10 h-10" />}
          </div>
          <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-dashed border-primary-100" />
        </div>

        {esNotFound && (
          <p className="text-5xl font-black text-primary-200 leading-none mb-3 tracking-tight">404</p>
        )}

        <h1 className="text-xl sm:text-2xl font-bold text-primary-900 mb-2">
          {title ?? textos.title}
        </h1>
        <p className="text-sm text-primary-600 leading-relaxed mb-8">
          {description ?? textos.description}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {!esNotFound && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-primary-700 to-primary-800 hover:from-primary-800 hover:to-primary-900 shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <RotateCw className="w-4 h-4" />
              Recargar la página
            </button>
          )}
          <a
            href={ROUTES.HOME}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <Home className="w-4 h-4" />
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
