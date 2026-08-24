// ===========================================
// ErrorBoundary — boundary de clase para errores de render
// ===========================================
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '@/lib/logger';
import { ErrorScreen } from './ErrorScreen';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Etiqueta con la que se identifica el origen en el log. */
  scope?: string;
  /** Pantalla alternativa. Por defecto, la `ErrorScreen` del sitio. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Último cortafuegos de la aplicación.
 *
 * React sigue sin tener boundaries funcionales: capturar un error de render
 * exige una clase con `getDerivedStateFromError` (para pintar el fallback) y
 * `componentDidCatch` (para reportarlo). Sin uno de estos, React desmonta el
 * árbol entero y la pantalla queda en blanco.
 *
 * El reporte va por `logError`, el único lugar del repo autorizado a escribir en
 * consola y que además vive detrás del guard de DEV: en producción el stack no
 * se imprime ni —mucho menos— se pinta en el DOM.
 *
 * Se monta por encima del `RouterProvider` y cubre lo que el router no ve: los
 * providers, el `Toaster` y el propio arranque del router. Los errores de una
 * ruta los atrapa antes el `errorElement` de esa ruta (ver `RouteErrorBoundary`).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logError(this.props.scope ?? 'ErrorBoundary', { error, componentStack: info.componentStack });
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <ErrorScreen />;
    }
    return this.props.children;
  }
}
