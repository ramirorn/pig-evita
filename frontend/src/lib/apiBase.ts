// ===========================================
// Base de la API — una sola lectura de VITE_API_BASE_URL
// ===========================================
//
// La usan el cliente de Axios y todo lo que arma URLs de la API **sin** pasar
// por Axios (por ejemplo, el `src` de la foto de una sede). Puede ser relativa
// (`/api/v1`, mismo origen: Docker en 8080) o absoluta
// (`http://localhost:3000/api/v1`, el `.env.example` para `npm run dev`).
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api/v1';
