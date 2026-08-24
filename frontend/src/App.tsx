import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/store/auth.store';
import { router } from '@/router';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
// El cliente vive en su propio módulo para que el store de auth pueda vaciar la
// cache en el logout (ver lib/queryClient.ts).
import { queryClient } from '@/lib/queryClient';

function App() {
  return (
    // Cortafuegos exterior: cubre lo que el `errorElement` de cada rama de rutas
    // no ve (los providers, el arranque del router, el Toaster). Sin él, un error
    // acá deja la pantalla en blanco.
    <ErrorBoundary scope="App">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
