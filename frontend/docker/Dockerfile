# ===========================================
# Juegos Evita — frontend (build de Vite servido por nginx)
# ===========================================
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Sin VITE_API_BASE_URL el cliente usa `/api/v1` relativo, y nginx lo
# reenvía al backend: una sola dirección, sin CORS.
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1
