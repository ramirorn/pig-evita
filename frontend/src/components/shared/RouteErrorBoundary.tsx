// ===========================================
// RouteErrorBoundary — `errorElement` de las rutas raíz
// ===========================================
import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { logError } from '@/lib/logger';
import { ErrorScreen } from './ErrorScreen';

/**
 * Pantalla que react-router monta cuando algo falla dentro de una rama de rutas:
 * un error de render, un `loader` que revienta o —el caso frecuente— un
 * `React.lazy` que no puede descargar su chunk porque se publicó una versión
 * nueva con la pestaña abierta.
 *
 * Sin `errorElement`, ese lugar lo ocupa el `DefaultErrorComponent` de
 * react-router, que en el build de **producción** pinta el mensaje y el stack
 * trace completo dentro de un `<pre>`: la misma información que se sacó de la
 * consola queda visible en el `<body>`, sin necesidad de abrir DevTools.
 *
 * El detalle del error sale por `logError` (sólo en desarrollo) y el usuario ve
 * la pantalla del sitio. Un 404 devuelto por un `loader` se muestra como 404, no
 * como error genérico.
 */
export function RouteErrorBoundary({ fullScreen = true }: { fullScreen?: boolean }) {
  const error = useRouteError();
  const esNotFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    logError('RouteErrorBoundary', error);
  }, [error]);

  return <ErrorScreen variant={esNotFound ? 'not-found' : 'error'} fullScreen={fullScreen} />;
}
