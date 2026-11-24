import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Vendors estables en chunks propios: cambian poco y se cachean entre
        // deploys. `recharts` NO tiene grupo: forzarlo a un chunk nombrado lo hacía
        // aparecer en el modulepreload de la entrada; así queda sólo detrás del
        // import dinámico del gráfico.
        advancedChunks: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\/](react|react-dom|scheduler|react-router)[\/]/, priority: 20 },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
