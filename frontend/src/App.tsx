import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/store/auth.store';
import { router } from '@/router';
import { Toaster } from '@/components/ui/sonner';
// El cliente vive en su propio módulo para que el store de auth pueda vaciar la
// cache en el logout (ver lib/queryClient.ts).
import { queryClient } from '@/lib/queryClient';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
